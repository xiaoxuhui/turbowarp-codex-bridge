# TurboWarp + Codex Desktop 本机自动化验证环境

独立工作区：`D:\soft\turbowarp-codex-bridge`。已安装 Microsoft Playwright MCP，建立生成 SB3 → MCP 加载 TurboWarp → 真实键鼠输入 → VM 断言 → 保存重载 → 故障检测与最小修复的有限样例闭环。

完整验收见 [最终报告](reports/final-report.md) 和 [逐项状态](reports/acceptance.json)。完整专用 Bridge 仅有 [架构设计](docs/bridge-architecture.md)。Desktop 原生工具注册后的刷新验收须与 SDK 端到端调用分开看。

## 运行

在本机 PowerShell 使用绝对启动器，不依赖 npm 或全局 PATH：

```powershell
& 'D:\soft\turbowarp-codex-bridge\scripts\run.ps1' -Task Generate
& 'D:\soft\turbowarp-codex-bridge\scripts\run.ps1' -Task Test
```

测试会打开独立的可见 Chromium 窗口，结束后关闭。不会访问用户已打开的浏览器标签页。网络需要访问 `https://turbowarp.org/editor` 及其资源。Codex Windows 执行沙箱内 Chromium 启动曾被拒绝；批准单次在执行沙箱外运行，仍保留 Chromium 自身沙箱后，本机端到端测试成功。

编辑器加载后，绿旗复位到 (0,0)，方向键每次移动 10，steps 每次加 1，点击机器人使 clicks 加 1。原始项目、VM 导出、故障对照和修复产物都保存在 projects/。negative-control.sb3 故意包含右移 5 的错误，不作为最终作品使用。

## 已复用与安装

| 组件 | 来源/版本 | 处理 |
| --- | --- | --- |
| Node | Codex primary runtime，v24.19.0 | 只读复用 |
| pnpm | 同运行时，11.25.0 | 只读复用；项目 store |
| npm/npx | `D:\soft\.ci-tmp\node-v18.20.8-win-x64\node_modules\npm\bin\`，10.8.2 | 找到并执行版本检查；本工程不依赖 |
| Git | `C:\Program Files\Git\cmd\git.exe`，2.55.0.windows.3 | 本地快照 |
| Chromium | `%LOCALAPPDATA%\ms-playwright\chromium-1243\chrome-win64\chrome.exe`，153.0.8010.12 | 只读复用，独立 profile |
| Chrome / Edge | 155.0.8059.85 / 155.0.4283.62 | 检测到；未用于测试 |
| @playwright/mcp | npm 官方包，0.0.83 | 项目局部固定版本 |
| @modelcontextprotocol/sdk | 1.32.1 | 标准 STDIO 客户端验证 |
| jszip | 3.10.1 | 生成/检查 SB3 |

MCP 0.0.83 的上游依赖 Playwright 1.64.0-alpha-1790635538000。这是该官方包自身依赖，本机已验证兼容现有 Chromium；不代表所有操作兼容。锁文件保留精确依赖与 integrity。安装禁用生命周期脚本；未使用 `curl | shell`、Invoke-Expression 或全局安装。

重建项目依赖（无需 npm）：

```powershell
Set-Location 'D:\soft\turbowarp-codex-bridge'
& 'C:\Users\25133\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' install --frozen-lockfile --ignore-scripts --store-dir .pnpm-store
```

## Codex MCP 配置

注册名 `playwright`。已在用户 `C:\Users\25133\.codex\config.toml` 末尾追加：

```toml
[mcp_servers.playwright]
command = 'C:\Users\25133\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
args = ['D:\soft\turbowarp-codex-bridge\scripts\start-mcp.mjs']
cwd = 'D:\soft\turbowarp-codex-bridge'
startup_timeout_sec = 60
tool_timeout_sec = 180
disabled_tools = ["browser_run_code_unsafe", "browser_install"]
```

启动器固定 cwd 与配置文件，直接运行官方本地包，不在启动时下载。浏览器隔离、沙箱及输出目录见 config/playwright.json。未增加站点权限、使用用户 profile、放开文件访问或忽略证书错误。服务使用 STDIO，无开放 TCP 监听端口。

[官方 Codex MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) 说明客户端共享配置，Desktop 保存后需要 Restart。若当前 chat 未出现 Playwright 工具，在设置 → MCP servers 对 playwright 执行 Restart；如工具目录仍未更新，重新打开聊天后调用 browser_navigate/browser_snapshot。只有成功取得原生工具响应，才能将 Desktop 原生调用项标为 PASS。

## 文件

- scripts/generate-project.mjs：有限 SB3 生成器与引用/素材/CRC 检查。
- scripts/mcp-client.mjs：真实官方 MCP SDK STDIO 调用与原始证据保存。
- scripts/verify-mcp.mjs：绿旗、四方向键、变量、鼠标、停止、存档重载、负对照和修复回归。
- projects/keyboard-robot-verified.sb3：验证后 VM 导出的项目。
- reports/latest-test.json：最近一次测试报告；test-*.json 包含历史失败和成功。
- evidence/：DOM 快照、MCP 工具响应、截图、浏览器 console/network 与会话记录。
- backups/：原 Codex 配置备份，不加入 Git。

## 回滚和卸载

精确回滚，仅在配置未被后续修改时恢复原始备份：

```powershell
& 'D:\soft\turbowarp-codex-bridge\scripts\rollback-codex.ps1'
```

脚本校验当前配置与备份 SHA-256；若 Codex 后续修改了配置则停止，避免覆盖新设置。此时使用官方 `codex mcp remove playwright` 只移除该服务，再重启 MCP。禁止直接覆盖更新后的全局配置。

保留需要的 projects/reports/evidence 后，可在文件管理器删除本工作区以卸载局部依赖。不需卸载 Node、pnpm、浏览器，不修改 PATH 或注册表。删除前先移除 MCP 配置，否则 Desktop 将指向不存在的启动器。Git 中保留实现和证据快照；依赖可按锁文件重建。

## 已知限制

在线 GUI 可能升级，window.vm 与私有 `_blocks` 不是永久稳定接口。真实 GUI 与 VM 均依赖浏览器运行。原生 File System Access API 文件选择器未被 MCP 捕获，拖放也未成功；实际成功路径是官方 VM API 导入/导出。自定义扩展、云变量、摄像头、音频、复杂自定义积木和任意用户作品自动修复均未测试。测试只能证明明确列出的样例断言。
