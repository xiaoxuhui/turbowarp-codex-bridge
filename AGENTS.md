# TurboWarp local automation workspace

- 本目录是 P0–P4 的接入验证与有限可行性实验，完整专用 MCP Bridge 尚未实现。不要把固定样例测试当成任意作品的通用验收。
- 先读 README.md、reports/acceptance.json 和 reports/latest-test.json。用户作品另建副本，勿覆盖 D:\aiden 的既有 SB3。
- Playwright MCP 名称为 playwright；启动器 scripts/start-mcp.mjs；配置 config/playwright.json。不要重复注册。
- 当前会话若未暴露 MCP 原生工具，明确区分“通过本地 SDK 实际调用成功”与“Desktop 工具目录/原生调用已验证”。不能把 codex mcp get 当成连接成功。
- 本机 Node/pnpm 路径见 README；不得写入 Codex 运行时缓存。不要修改系统 PATH、注册表或禁用浏览器沙箱。
- 通过 scripts/run.ps1 -Task Test 运行有限样例闭环。它只修改本目录 projects 下的固定测试样例，使用新的独立浏览器上下文。网络与 Windows 执行沙箱可能需要单次工具授权，不能通过 --no-sandbox 绕开。
- 通过 VM 的 loadProject/saveProjectSb3 与结构化 SB3 修改实现逻辑；browser_click/browser_press_key 负责真实 GUI 输入；状态断言负责逻辑验收。不要启用 browser_run_code_unsafe。
- 保留失败结果；每次运行写 reports/test-<UTC>.json 和 evidence。以最新成功与失败记录说明结论。
- 完整 Bridge 开发需要用户另行授权；接口提案在 docs/bridge-architecture.md。
