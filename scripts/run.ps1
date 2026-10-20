param(
    [ValidateSet('Test','Generate','Probe','Mcp')]
    [string]$Task = 'Test'
)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Users\25133\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Configured Node runtime moved; update this launcher after inspecting the new runtime.' }
$entry = @{Test='verify-mcp.mjs';Generate='generate-project.mjs';Probe='probe.mjs';Mcp='start-mcp.mjs'}[$Task]
Push-Location -LiteralPath $workspace
try { & $nodePath (Join-Path $PSScriptRoot $entry); exit $LASTEXITCODE }
finally { Pop-Location }
