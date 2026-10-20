import { connect, root } from './mcp-client.mjs';
import { generate, validateSb3 } from './generate-project.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const runId = new Date().toISOString().replace(/[:.]/g,'-');
const results = { runId, startedAt: new Date().toISOString(), transport:'stdio', browserSandbox:true, checks:[], states:[] };
const evidenceDir = path.join(root,'evidence',runId);
await fs.mkdir(evidenceDir,{recursive:true});
const mcp=await connect(runId);
const record=(name,detail)=>results.checks.push({name,status:'PASS',detail});
async function evaluate(fn) {
  const text = await mcp.call('browser_evaluate',{function: typeof fn==='string'?fn:fn.toString()});
  const match=text.match(/### Result\n([\s\S]*?)(?:\n### |$)/);
  if (!match) throw new Error(`Missing JSON result: ${text.slice(0,300)}`);
  return JSON.parse(match[1]);
}
async function ready() {
  return evaluate(`async () => {
    const deadline=Date.now()+60000;
    while(Date.now()<deadline) {
      const t=window.vm?.runtime?.targets.find(t=>t.getName()==='Harness Robot');
      if(t && document.querySelector('canvas')?.width>0) return {name:t.getName(),costumes:t.getCostumes().length,blocks:Object.values(t.blocks._blocks).filter(b=>!b.shadow).length,runtimeBlocksIncludingShadows:Object.keys(t.blocks._blocks).length};
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('Harness Robot did not load');
  }`);
}
async function state(label, expectedSteps = null) {
  const value=await evaluate(`async () => {
    const expectedSteps=${JSON.stringify(expectedSteps)};
    const deadline=Date.now()+3000;
    while(expectedSteps!==null && vm.runtime.getTargetForStage().variables.var_steps.value!==expectedSteps && Date.now()<deadline) {
      await new Promise(r=>setTimeout(r,16));
    }
    const t=vm.runtime.targets.find(t=>t.getName()==='Harness Robot');
    const stage=vm.runtime.getTargetForStage();
    return {x:t.x,y:t.y,visible:t.visible,costume:t.currentCostume,variables:Object.fromEntries(Object.values(stage.variables).map(v=>[v.name,v.value])),threads:vm.runtime.threads.length,pageErrors:window.__harnessErrors||[]};
  }`);
  results.states.push({label,...value});
  return value;
}
const click=target=>mcp.call('browser_click',{target});
async function load(filename) {
  const bytes=await fs.readFile(path.join(root,'projects',filename));
  await validateSb3(bytes);
  const base64=bytes.toString('base64');
  await evaluate(`async () => {
    const bytes=Uint8Array.from(atob(${JSON.stringify(base64)}),c=>c.charCodeAt(0));
    await vm.loadProject(bytes.buffer);
    const target=vm.runtime.targets.find(t=>t.getName()==='Harness Robot');
    vm.setEditingTarget(target.id);
    return {loaded:true,name:target.getName(),bytes:bytes.length};
  }`);
  return ready();
}
async function flag() {
  await click('img[class*="green-flag_green-flag"]');
  const s=await state('green flag');
  assert.equal(s.x,0);assert.equal(s.y,0);assert.equal(s.variables.steps,0);assert.equal(s.variables.clicks,0);assert.equal(s.variables.ready,1);assert(s.threads>0);
}
async function keyboardCycle(label) {
  await flag();
  // Focus stage away from text/number fields; the first click is separately observed.
  await click('canvas >> nth=0');
  for (const [key,x,y,steps] of [['ArrowRight',10,0,1],['ArrowRight',20,0,2],['ArrowLeft',10,0,3],['ArrowUp',10,10,4],['ArrowDown',10,0,5]]) {
    await mcp.call('browser_press_key',{key});
    const s=await state(`${label} ${key}`,steps);
    assert.equal(s.x,x,`${label} ${key} x`);assert.equal(s.y,y,`${label} ${key} y`);assert.equal(s.variables.steps,steps,`${label} step count`);
  }
  record(label,'Five real browser key presses; exact x/y and step counter assertions');
}
async function saveThroughVm(filename) {
  const data=await evaluate(async () => {
    const blob=await vm.saveProjectSb3();
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let binary='';for(const byte of bytes) binary+=String.fromCharCode(byte);
    return {base64:btoa(binary),bytes:bytes.length};
  });
  const bytes=Buffer.from(data.base64,'base64');
  const summary=await validateSb3(bytes);
  await fs.writeFile(path.join(root,'projects',filename),bytes);
  return summary;
}
try {
  const {bytes}=await generate();
  record('SB3 structural validation',await validateSb3(bytes));
  await mcp.call('browser_navigate',{url:'https://turbowarp.org/editor'});
  await mcp.call('browser_wait_for',{text:'Code'});
  const regions=await evaluate(() => ({
    canvas:!!document.querySelector('canvas'),
    spriteList:!!document.querySelector('[class*="sprite-selector_sprite-selector"]'),
    categories:Array.from(document.querySelectorAll('.scratchCategoryMenuItemLabel')).map(e=>e.textContent),
    workspace:!!document.querySelector('.blocklyWorkspace'),
    flag:!!document.querySelector('img[class*="green-flag_green-flag"]'),
    stop:!!document.querySelector('img[class*="stop-all_stop-all"]'),
    vm:typeof window.vm,redux:typeof window.ReduxStore,
    runtime:vm.runtime.constructor.name
  }));
  await fs.writeFile(path.join(evidenceDir,'regions.json'),JSON.stringify(regions,null,2));
  assert(regions.canvas&&regions.workspace&&regions.flag&&regions.stop);assert(regions.categories.includes('Motion'));
  record('Editor regions',regions);
  const loaded=await load('keyboard-robot.sb3');assert.equal(loaded.costumes,2);assert.equal(loaded.blocks,21);
  record('Load .sb3 via official VM API through MCP',loaded);
  await evaluate(() => {window.__harnessErrors=[];addEventListener('error',e=>window.__harnessErrors.push(String(e.message)));addEventListener('unhandledrejection',e=>window.__harnessErrors.push(String(e.reason)));vm.on('COMPILE_ERROR',(target,error)=>window.__harnessErrors.push(`COMPILE_ERROR ${target?.getName()}: ${error}`));return {installed:true};});
  await click('text="Costumes"');
  await mcp.call('browser_wait_for',{text:'Robot Blue'});
  await click('text="Code"');
  await click('.scratchCategoryMenuItemLabel:text-is("Variables")');
  await mcp.call('browser_snapshot',{filename:`evidence/${runId}/editor-loaded.yml`});
  record('Editor clicks, tabs and category switching','Costumes, Code and Variables selected through browser_click');
  await keyboardCycle('Initial keyboard regression');
  const beforeMouse=await state('before click');
  await click('canvas >> nth=0');
  const afterMouse=await state('after click');assert.equal(afterMouse.variables.clicks,beforeMouse.variables.clicks+1);
  record('Real browser mouse input','Click on robot increments clicks exactly once');
  await mcp.call('browser_take_screenshot',{filename:`evidence/${runId}/running.png`,type:'png',scale:'css'});
  record('Screenshot',`evidence/${runId}/running.png`);
  await click('img[class*="stop-all_stop-all"]');
  const stopped=await state('stop');assert.equal(stopped.threads,0);record('Stop button','VM threads = 0');
  const saved=await saveThroughVm('keyboard-robot-saved.sb3');record('VM export saved .sb3',saved);
  await load('keyboard-robot-saved.sb3');
  await keyboardCycle('Saved project reload regression');
  // Small feasibility experiment: detect and repair exactly one wrong numeric input.
  const goodZip=await JSZip.loadAsync(bytes);
  const json=JSON.parse(await goodZip.file('project.json').async('string'));
  json.targets[1].blocks.rightMove.inputs.DX[1][1]='5';
  goodZip.file('project.json',JSON.stringify(json));
  const broken=await goodZip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  await fs.writeFile(path.join(root,'projects/negative-control.sb3'),broken);
  await load('negative-control.sb3');await flag();
  await click('canvas >> nth=0');await mcp.call('browser_press_key',{key:'ArrowRight'});
  const negative=await state('negative control',1);assert.equal(negative.x,5);assert.throws(()=>assert.equal(negative.x,10));
  record('Negative control catches logic error','DX=5 produced x=5; expected x=10 rejected');
  assert.equal(json.targets[1].blocks.rightMove.inputs.DX[1][1],'5');
  json.targets[1].blocks.rightMove.inputs.DX[1][1]='10';
  const original=JSON.parse(await (await JSZip.loadAsync(bytes)).file('project.json').async('string'));
  assert.deepEqual(json,original,'Repair must change only the erroneous numeric input');
  goodZip.file('project.json',JSON.stringify(json));
  const repaired=await goodZip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  await validateSb3(repaired);
  await fs.writeFile(path.join(root,'projects/keyboard-robot-repaired.sb3'),repaired);
  await load('keyboard-robot-repaired.sb3');
  await keyboardCycle('Repair regression');
  record('Repair feasibility','Patched DX from 5 to 10 in the failed SB3; confirmed other project fields unchanged; full keyboard regression passed');
  await saveThroughVm('keyboard-robot-verified.sb3');
  await mcp.call('browser_take_screenshot',{filename:`evidence/${runId}/verified.png`,type:'png',scale:'css'});
  const final=await state('final');assert.equal(final.pageErrors.length,0);record('Runtime error listeners',final.pageErrors);
  await mcp.call('browser_console_messages',{level:'warning',filename:`evidence/${runId}/console.log`});
  await mcp.call('browser_network_requests',{filename:`evidence/${runId}/network.log`});
  results.status='PASS';
} catch(error) {
  results.status='FAIL';results.error={message:error.message,stack:error.stack};
  results.checks.push({name:'Current test run',status:'FAIL',detail:error.message});
  try{await mcp.call('browser_take_screenshot',{filename:`evidence/${runId}/failure.png`,type:'png',scale:'css'});}catch{}
  process.exitCode=1;
} finally {
  results.finishedAt=new Date().toISOString();
  await mcp.close();
  await fs.writeFile(path.join(root,'reports',`test-${runId}.json`),JSON.stringify(results,null,2));
  await fs.writeFile(path.join(root,'reports/latest-test.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
