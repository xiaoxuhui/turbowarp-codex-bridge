import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { root } from './mcp-client.mjs';

const md5 = data => crypto.createHash('md5').update(data).digest('hex');
export async function validateSb3(bytes) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  assert(zip.file('project.json'), 'project.json required');
  const project = JSON.parse(await zip.file('project.json').async('string'));
  assert.equal(project.meta.semver, '3.0.0');
  assert.equal(project.targets.filter(t => t.isStage).length, 1);
  const ids = new Set(project.targets.flatMap(t => Object.keys(t.variables)));
  for (const target of project.targets) {
    for (const costume of target.costumes) {
      const asset = zip.file(costume.md5ext);
      assert(asset, `missing asset ${costume.md5ext}`);
      assert.equal(md5(await asset.async('nodebuffer')), costume.assetId);
    }
    for (const [id, block] of Object.entries(target.blocks)) {
      assert(typeof block.opcode === 'string');
      for (const ref of [block.next, block.parent]) if (ref) assert(target.blocks[ref], `${id}: missing ${ref}`);
      for (const value of Object.values(block.inputs)) {
        for (const ref of value.slice(1)) if (typeof ref === 'string') assert(target.blocks[ref], `${id}: missing input ${ref}`);
      }
      if (block.fields.VARIABLE) assert(ids.has(block.fields.VARIABLE[1]));
    }
  }
  return { targets: project.targets.map(t => t.name), blocks: project.targets.reduce((n,t)=>n+Object.keys(t.blocks).length,0), assets: project.targets.reduce((n,t)=>n+t.costumes.length,0), entries: Object.keys(zip.files) };
}

export async function generate() {
  const zip = new JSZip();
  function costume(name, svg, cx, cy) {
    const assetId = md5(svg);
    const md5ext = `${assetId}.svg`;
    zip.file(md5ext, svg);
    return { name, assetId, dataFormat: 'svg', md5ext, bitmapResolution: 1, rotationCenterX: cx, rotationCenterY: cy };
  }
  const backdrop = costume('Test Stage', '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#edf3fc"/><path d="M240 0V360M0 180H480" stroke="#c4d4ed"/><text x="18" y="335" font-size="16" font-family="sans-serif" fill="#425b85">Codex + TurboWarp | Arrow keys move | Click robot</text></svg>', 240, 180);
  const robotSvg = color => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72"><path d="M32 7V1" stroke="#263752" stroke-width="4"/><rect x="5" y="9" width="54" height="48" rx="12" fill="${color}" stroke="#263752" stroke-width="3"/><circle cx="22" cy="29" r="5" fill="white"/><circle cx="43" cy="29" r="5" fill="white"/><path d="M21 45H43M18 58V70M46 58V70" stroke="#263752" stroke-width="5"/></svg>`;
  const costumes = [costume('Robot Blue', robotSvg('#4b8df8'), 32, 36), costume('Robot Green', robotSvg('#48b68b'), 32, 36)];
  const blocks = {};
  const block = (id, opcode, parent, next, inputs={}, fields={}, xy) => { blocks[id]={opcode,next,parent,inputs,fields,shadow:false,topLevel:!parent,...(xy?{x:xy[0],y:xy[1]}:{})}; };
  const num = n => [1,[4,String(n)]];
  const variable = name => ({VARIABLE:[name,`var_${name}`]});
  block('flag','event_whenflagclicked',null,'home',{}, {},[40,40]);
  block('home','motion_gotoxy','flag','resetSteps',{X:num(0),Y:num(0)});
  block('resetSteps','data_setvariableto','home','resetClicks',{VALUE:num(0)},variable('steps'));
  block('resetClicks','data_setvariableto','resetSteps','ready',{VALUE:num(0)},variable('clicks'));
  block('ready','data_setvariableto','resetClicks','loop',{VALUE:num(1)},variable('ready'));
  block('loop','control_forever','ready',null,{SUBSTACK:[2,'wait']});
  block('wait','control_wait','loop',null,{DURATION:num(0.05)});
  for (const [key,opcode,n,x,y] of [['right arrow','motion_changexby',10,340,40],['left arrow','motion_changexby',-10,340,230],['up arrow','motion_changeyby',10,600,40],['down arrow','motion_changeyby',-10,600,230]]) {
    const id=key.split(' ')[0];
    block(`${id}Hat`,'event_whenkeypressed',null,`${id}Move`,{},{KEY_OPTION:[key,null]},[x,y]);
    block(`${id}Move`,opcode,`${id}Hat`,`${id}Count`,{[opcode==='motion_changexby'?'DX':'DY']:num(n)});
    block(`${id}Count`,'data_changevariableby',`${id}Move`,null,{VALUE:num(1)},variable('steps'));
  }
  block('clickHat','event_whenthisspriteclicked',null,'clickCount',{},{},[40,420]);
  block('clickCount','data_changevariableby','clickHat',null,{VALUE:num(1)},variable('clicks'));
  const stage = {isStage:true,name:'Stage',variables:{var_steps:['steps',-1],var_clicks:['clicks',-1],var_ready:['ready',0]},lists:{},broadcasts:{},blocks:{},comments:{},currentCostume:0,costumes:[backdrop],sounds:[],volume:100,layerOrder:0,tempo:60,videoTransparency:50,videoState:'on',textToSpeechLanguage:null};
  const sprite = {isStage:false,name:'Harness Robot',variables:{},lists:{},broadcasts:{},blocks,comments:{},currentCostume:0,costumes,sounds:[],volume:100,layerOrder:1,visible:true,x:-80,y:0,size:100,direction:90,draggable:false,rotationStyle:'all around'};
  const project={targets:[stage,sprite],monitors:['steps','clicks','ready'].map((name,i)=>({id:`var_${name}`,mode:'default',opcode:'data_variable',params:{VARIABLE:name},spriteName:null,value:0,width:0,height:0,x:8,y:8+i*28,visible:true,sliderMin:0,sliderMax:100,isDiscrete:true})),extensions:[],meta:{semver:'3.0.0',vm:'0.2.0',agent:'Codex TurboWarp feasibility harness'}};
  zip.file('project.json',JSON.stringify(project));
  const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  const validation=await validateSb3(bytes);
  await fs.writeFile(path.join(root,'projects/keyboard-robot.sb3'),bytes);
  await fs.writeFile(path.join(root,'projects/project.json'),JSON.stringify(project,null,2));
  await fs.writeFile(path.join(root,'reports/project-validation.json'),JSON.stringify({status:'PASS',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...validation},null,2));
  console.log('Generated and validated keyboard-robot.sb3',validation);
  return {project,bytes};
}
if (process.argv[1] && path.resolve(process.argv[1])===path.join(root,'scripts/generate-project.mjs')) await generate();
