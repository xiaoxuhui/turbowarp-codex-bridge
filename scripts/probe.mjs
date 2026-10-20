import { connect } from './mcp-client.mjs';
const mcp = await connect('probe');
try {
  await mcp.call('browser_navigate', { url: 'https://turbowarp.org/editor' });
  await mcp.call('browser_wait_for', { text: 'Code' });
  await mcp.call('browser_evaluate', { function: `() => ({
      title: document.title, vm: typeof window.vm, Scratch: typeof window.Scratch,
      globals: Object.keys(window).filter(k => /vm|scratch|store|redux/i.test(k)),
      canvases: Array.from(document.querySelectorAll('canvas')).map(e => ({width:e.width,height:e.height,class:e.className})),
      buttons: Array.from(document.querySelectorAll('button,[role=button]')).map(e => ({text:e.innerText,aria:e.getAttribute('aria-label'),title:e.getAttribute('title'),class:e.className})).slice(0,100),
      inputs: Array.from(document.querySelectorAll('input')).map(e => ({type:e.type,placeholder:e.placeholder,accept:e.accept})),
      images: Array.from(document.querySelectorAll('img')).map(e=>({alt:e.alt,class:e.className})).slice(0,60)
    })` });
  await mcp.call('browser_take_screenshot', { type: 'png', filename: 'evidence/editor-probe.png', fullPage: false });
  await mcp.call('browser_click',{target:'text="File"'});
  await mcp.call('browser_snapshot',{filename:'evidence/file-menu.yml'});
} finally { await mcp.close(); }
