import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function connect(label = 'probe') {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'scripts/start-mcp.mjs')],
    cwd: root,
    stderr: 'pipe'
  });
  const client = new Client({ name: 'turbowarp-local-verification', version: '0.1.0' }, { capabilities: { roots: { listChanged: true } } });
  const { ListRootsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
  client.setRequestHandler(ListRootsRequestSchema, () => ({ roots: [{ uri: new URL('../', import.meta.url).href, name: 'turbowarp-codex-bridge' }] }));
  let stderr = '';
  transport.stderr?.on('data', data => { stderr += data; });
  await client.connect(transport);
  const tools = await client.listTools();
  await fs.writeFile(path.join(root, 'evidence', `${label}-tools.json`), JSON.stringify({ server: client.getServerVersion(), tools: tools.tools }, null, 2));
  let seq = 0;
  async function call(name, args) {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
    const number = String(++seq).padStart(2, '0');
    const safe = { ...result, content: result.content?.map(c => c.type === 'image' ? { type: 'image', mimeType: c.mimeType, data: '[omitted: screenshot file saved separately]' } : c) };
    await fs.writeFile(path.join(root, 'evidence', `${label}-${number}-${name}.json`), JSON.stringify(safe, null, 2));
    const message = result.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') ?? '';
    console.log(`${name}: ${message.slice(0, 400)}`);
    if (result.isError) throw new Error(`${name}: ${message}`);
    return message;
  }
  return { client, call, async close() { await client.close(); await fs.writeFile(path.join(root, 'evidence', `${label}-stderr.log`), stderr); } };
}
