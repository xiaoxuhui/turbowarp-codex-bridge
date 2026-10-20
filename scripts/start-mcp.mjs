// STDIO must contain MCP JSON-RPC only. This launcher never installs packages.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
if(Number(process.versions.node.split('.')[0])<24) throw Error('Node 24+ required');
const cli=path.join(root,'node_modules/@playwright/mcp/cli.js');
const config=path.join(root,'config/playwright.json');
const options=JSON.parse(fs.readFileSync(config,'utf8'));
for(const file of [cli,options.browser.launchOptions.executablePath]) if(!fs.existsSync(file)) throw Error(`Missing dependency: ${file}`);
process.chdir(root);
process.argv=[process.execPath,cli,'--config',config];
await import(pathToFileURL(cli).href);
