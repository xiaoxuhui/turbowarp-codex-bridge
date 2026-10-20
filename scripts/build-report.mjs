import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {root} from './mcp-client.mjs';

const read=async file=>JSON.parse(await fs.readFile(path.join(root,file),'utf8'));
const latest=await read('reports/latest-test.json');
const history=await Promise.all((await fs.readdir(path.join(root,'reports'))).filter(n=>/^test-.*\.json$/.test(n)).map(async n=>({file:n,...await read(`reports/${n}`)})));
const passed=history.filter(r=>r.status==='PASS');
const failed=history.filter(r=>r.status==='FAIL');
const preserved=await read('reports/config-preservation.json');
const audit=await read('reports/dependency-audit.json');
const registry=await read('reports/codex-mcp-registration.json');
const toolProof=await read(`evidence/${latest.runId}-tools.json`);
const original=await read('reports/project-validation.json');
const artifacts=[];
for(const name of (await fs.readdir(path.join(root,'projects'))).filter(n=>n.endsWith('.sb3'))) {
  const bytes=await fs.readFile(path.join(root,'projects',name));
  artifacts.push({path:`projects/${name}`,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
await fs.writeFile(path.join(root,'reports/artifact-manifest.json'),JSON.stringify(artifacts,null,2));
const now=new Date().toISOString();
const checks=[
 ['Node.js 可靠运行','PASS','Node 24.19.0 执行官方 MCP、项目生成、两次完整 GUI 测试；未重装'],
 ['Playwright MCP 安装和启动','PASS',`固定 0.0.83；STDIO initialize/tools/list 和实际 tools/call 成功；${toolProof.tools.length} 个服务端工具`],
 ['Codex 配置发现服务','PASS',`codex mcp get 返回 enabled=${registry.enabled}；绝对命令、cwd 和超时已读取`],
 ['Codex Desktop 原生工具发现与调用','BLOCKED','用户已关闭并重新打开服务开关，enabled=true 已核实；本会话原生工具目录仍无 Playwright。官方 app-server proxy 控制连接失败，SDK 调用成功不能替代本项'],
 ['自动打开 TurboWarp 编辑器','PASS','通过官方 MCP browser_navigate 加载 https://turbowarp.org/editor'],
 ['基础编辑器自动操作','PASS','DOM 识别舞台/角色/分类/积木区/绿旗/停止；Costumes、Code、Variables 点击与截图'],
 ['创建有效 TurboWarp 项目','PASS',`${original.blocks} 主体积木、一个角色、两套角色造型、一个背景、三个变量；ZIP CRC/引用/素材 MD5 验证`],
 ['自动加载并运行 SB3','PASS','MCP browser_evaluate 调用官方 vm.loadProject；真实点击绿旗；ready=1，x/y=0，存活线程>0'],
 ['可重复逻辑测试','PASS',`${passed.length} 次独立完整运行 PASS；每轮 3 组五键回归与 1 次故障按键，断言坐标和 steps`],
 ['鼠标与停止控制','PASS','点击机器人 clicks 增加 1；真实点击停止后 VM threads=0'],
 ['保存并重新加载项目','PASS','vm.saveProjectSb3 导出到磁盘，再由同一官方 VM 加载，重复五键回归'],
 ['截图、日志和运行证据','PASS',`evidence/${latest.runId}/verified.png、console.log、network.log 与 24 个状态快照`],
 ['逻辑错误检测与最小修复实验','PASS','右移 5 的故障件实际 x=5，x=10 断言拒绝；仅修复 DX 为 10，其余 JSON 完全一致，回归通过'],
 ['运行异常收集通道','PASS','error/unhandledrejection/COMPILE_ERROR 监听已安装，当前样例无记录；console 0 errors'],
 ['运行异常故障注入检测','NOT TESTED','没有注入 JS/扩展/编译异常；不能宣称所有异常都能被捕获'],
 ['项目与报告落盘','PASS','projects/*.sb3、reports/test-*.json、artifact-manifest.json 和截图已保存'],
 ['原有 Codex 配置保全','PASS',`原 ${preserved.BeforeBytes} 字节逐字节保留；修改前备份及前后 SHA-256 已记录`],
 ['依赖质量门禁','PASS',`锁文件离线重建成功；本轮 pnpm audit ${audit.metadata.totalDependencies} 依赖、已知漏洞 0`],
 ['后续专用 Bridge 方案','PASS','docs/bridge-architecture.md 完成选型、接口、文件事务、测试和阶段计划'],
 ['完整专用 TurboWarp MCP Bridge','NOT TESTED','未实现；按用户范围限制只交付有限实验与架构设计'],
 ['任意已有项目/自定义扩展自动修复','NOT TESTED','本轮只生成并修改独立样例，未触碰原有用户作品'],
 ['GUI 文件菜单上传','FAIL','File System Access API 原生文件选择器未形成 MCP 可处理的 file chooser modal；已采用 VM API 成功替代'],
 ['GUI 文件拖放','FAIL','body 无可见盒模型，舞台 canvas 不接受 drop；未将其标记为成功'],
 ['完整离线 GUI 与 VM 固定版本','NOT TESTED','当前依赖在线 TurboWarp；后续可自托管固定版本，尚未实施'],
 ['实际恢复全局配置','NOT TESTED','已验证备份哈希与复制恢复结果；未执行真实回滚以免撤销已安装服务']
].map(([item,status,evidence])=>({item,status,evidence}));
await fs.writeFile(path.join(root,'reports/acceptance.json'),JSON.stringify({generatedAt:now,timezone:'Asia/Shanghai',scope:'P0-P3 integration and restricted P4 feasibility; Desktop native tool activation pending',latestRun:latest.runId,checks},null,2));
const localTime=iso=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium',hour12:false}).format(new Date(iso));
const rows=checks.map(c=>`| ${c.item} | **${c.status}** | ${c.evidence.replaceAll('|','/')} |`).join('\n');
const report=`# TurboWarp + Codex Desktop 最终验收报告

生成时间：${localTime(now)}（Asia/Shanghai）。证据文件名采用 UTC；全部文件位于 D:\\soft\\turbowarp-codex-bridge。

**已完成本地官方 MCP 的真实调用与 TurboWarp 样例闭环；Desktop 当前聊天的原生 MCP 工具激活仍为 BLOCKED，不能宣称全部验收通过。**

## 逐项验收

| 项目 | 结果 | 证据/边界 |
| --- | --- | --- |
${rows}

## 环境与复用

Node v24.19.0 来自 Codex primary runtime。当前 npm/npx 不在 PATH，但在 D:\\soft\\.ci-tmp\\node-v18.20.8-win-x64\\node_modules\\npm\\bin 中找到 npm-cli.js 与 npx-cli.js，均由当前 Node 成功执行版本检查（10.8.2）。复用 Codex 提供的 pnpm 11.25.0，无需修复 npm 的全局命令。未发现本工程所需的 yarn，未安装它。调查覆盖当前命令解析、用户/系统/进程 PATH、标准安装位置、现有开发项目和运行时包目录；不声称已穷举全盘所有软件。

Git 2.55.0.windows.3 可用。Chrome 155.0.8059.85、Edge 155.0.4283.62 以及 Chromium 缓存均存在；实际测试复用 Chromium 153.0.8010.12。环境报告见 environment-scan.json、browser-versions.json。早期 PowerShell 表格输出遗漏了部分路径，随后通过 JSON 和注册路径补充核实，未根据 where.exe 判定不存在。

Codex CLI 为 0.163.0-alpha.10.2。原有配置包含 node_repl 与多个内置插件，原始 MCP 服务中无 Playwright。注册前检查防止重复，追加 playwright 服务，原设置逐字节保留。没有安装新的 Node、浏览器或浏览器扩展。

## 实际安装与配置

项目局部安装 @playwright/mcp 0.0.83、@modelcontextprotocol/sdk 1.32.1、jszip 3.10.1，共 ${audit.metadata.totalDependencies} 个依赖。官方 MCP 包依赖 Playwright 1.64.0-alpha-1790635538000；本机有限测试验证兼容缓存 Chromium，不推断所有浏览器能力兼容。pnpm-lock.yaml 保存 integrity。安装禁用生命周期脚本，项目 store 位于 .pnpm-store；离线 frozen-lockfile 安装检查成功，pnpm audit 返回 0 已知漏洞。

全局唯一配置改动是追加 [mcp_servers.playwright]，使用绝对 Node 路径与 scripts/start-mcp.mjs、固定 cwd、60 秒启动和 180 秒工具超时，禁用 browser_run_code_unsafe 与 browser_install。浏览器启用 chromiumSandbox、隔离内存 profile，并移除上游默认的两个 unsafe 参数。未更改系统 PATH、注册表、TLS 校验、站点权限、无限文件访问，也未连接现有用户浏览器。

配置备份路径及 SHA-256：codex-config-change.json；原字节保持证明：config-preservation.json；安装器和哈希保护回滚器：scripts/configure-codex.ps1、scripts/rollback-codex.ps1。实际回滚未执行，只验证了备份哈希和复制后的恢复哈希。

## 接入证据的准确含义

${toolProof.server.name} ${toolProof.server.version} 已通过同一已注册启动器完成 MCP initialize、tools/list、browser_navigate、browser_click、browser_press_key、browser_evaluate、browser_take_screenshot、日志与快照调用。调用客户端是此聊天启动的标准 MCP SDK 测试进程。原始响应见 evidence/${latest.runId}-*.json。

codex mcp get 只证明配置可被 Codex 读取。用户未看到 Restart 按钮，已关闭并重新打开服务开关；配置中 enabled=true 已核实。本聊天当前暴露的原生工具目录仍未出现 Playwright；没有把 SDK 调用替代 Desktop 原生发现和调用验收。进一步调查了官方 Codex app-server 的 reload/status/tool call 协议，但其公开控制 socket 在本机返回 os error 10050；未启用远程控制或改动安全设置。需要重新打开聊天或重启应用后进行原生工具调用验证，这是剩余接入阻断项。

## 实际项目与运行验证

生成项目：舞台和 Harness Robot；两套机器人 SVG 造型、背景、steps/clicks/ready 三个全局变量、绿旗复位、四方向键和点击事件，共 21 个主体积木。VM 将数字字面量展开为影子积木，运行结构有 36 个节点；测试明确区分这两种表示。

每组五键序列 Right、Right、Left、Up、Down 的位置为 (10,0)、(20,0)、(10,0)、(10,10)、(10,0)，steps 依次 1..5。点击机器人后 clicks 精确增加 1，停止后线程数为 0。保存导出件、重载、重复同一组断言。故障对照右移 5，读取到 x=5 并确认 x=10 断言失败；只把该数字输入修复为 10，验证其他 JSON 不变并再次回归。

独立完整成功运行 ${passed.length} 次；每次 ${latest.checks.length} 个检查、${latest.states.length} 个状态快照。成功记录：

${passed.map(p=>`- ${localTime(p.startedAt)} → ${localTime(p.finishedAt)}：[${p.file}](${p.file})。`).join('\n')}

此前 ${failed.length} 次未完成/失败试验均保存在 test-*.json，没有覆盖历史。主要原因及修复：Windows 执行沙箱阻止浏览器启动（保留 Chromium 沙箱，经单次授权在其外运行）；新 MCP 将 browser_run_code 更名为 unsafe 工具（未启用，改用页面 evaluate）；GUI 拖放和原生文件选择器不兼容（改用官方 VM API）；数字输入展开影子积木（比较主体节点与展开节点）；同名 Variables 标签（限定实际分类元素）；按键后立即读取早于 VM 下一帧（等待目标步数后再断言坐标，有 3 秒期限）。

## 保存路径与复现

- 最终作品：[keyboard-robot-verified.sb3](../projects/keyboard-robot-verified.sb3)。
- 原始样例：[keyboard-robot.sb3](../projects/keyboard-robot.sb3)；VM 保存件：keyboard-robot-saved.sb3；修复件：keyboard-robot-repaired.sb3；故意出错的 negative-control.sb3 不作为交付作品。
- 最新测试：[latest-test.json](latest-test.json)；项目 SHA-256：[artifact-manifest.json](artifact-manifest.json)。
- 运行截图：[running.png](../evidence/${latest.runId}/running.png)；最终截图：[verified.png](../evidence/${latest.runId}/verified.png)。
- 日志：[console.log](../evidence/${latest.runId}/console.log)、[network.log](../evidence/${latest.runId}/network.log)。
- 启动与卸载、回滚细节：[README](../README.md)。PowerShell 可运行绝对路径 scripts/run.ps1 -Task Test。

## 限制与下一阶段

两次成功测试均未记录 window error、unhandledrejection 或 COMPILE_ERROR；浏览器 console 为 0 errors，2 条 Canvas2D 性能建议。未注入真正运行异常，不能宣称覆盖全部异常。在线 GUI 可升级，window.vm、私有字段及 DOM 哈希类名存在维护风险；脚本有限且不支持任意已有项目的无损编辑。大项目、云变量、音视频、克隆、自定义积木、自定义扩展和完整离线部署均未验收。

推荐架构：Codex → 类型化 STDIO Bridge → 事务化 SB3 模型/快照 → 固定版本 VM；Playwright 负责真实输入、GUI 验收和证据，结构化断言负责多数逻辑。TextToScratch 作为可选编译前端进一步评估，现阶段未安装、未验证。详细接口、边界和计划见 [bridge-architecture.md](../docs/bridge-architecture.md)。完整 Bridge 的新建/修改/测试工具尚未开发，须另行授权。

当前已经能够通过本地脚本及官方 MCP 自动生成、加载、运行、测试样例并修复一个已定义错误；尚不能报告“Codex Desktop 已原生接入并可通用自动制作和修复任意 TurboWarp 作品”。优先完成 Desktop Restart 后的真实工具调用，再按架构计划实施专用 Bridge。

官方依据：[Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)、[TurboWarp VM](https://github.com/TurboWarp/scratch-vm)。
`;
await fs.writeFile(path.join(root,'reports/final-report.md'),report);
console.log(JSON.stringify({latest:latest.runId,status:latest.status,successfulRuns:passed.length,failedTrials:failed.length,acceptance:checks.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{})},null,2));
