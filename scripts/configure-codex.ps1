$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $env:USERPROFILE '.codex\config.toml'
$backupDir = Join-Path $workspace 'backups'
$nodePath = 'C:\Users\25133\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$launcherPath = Join-Path $PSScriptRoot 'start-mcp.mjs'
$current = [IO.File]::ReadAllText($configPath)
if ($current -match '(?m)^\[mcp_servers\.[^\]]*playwright[^\]]*\]') {
    throw 'A Playwright server is already configured. Inspect it before adding a duplicate.'
}
$backupPath = Join-Path $backupDir ('config.before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.toml')
Copy-Item -LiteralPath $configPath -Destination $backupPath
$beforeHash = (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash
$stanza = @"

[mcp_servers.playwright]
command = '$nodePath'
args = ['$launcherPath']
cwd = '$workspace'
startup_timeout_sec = 60
tool_timeout_sec = 180
disabled_tools = ["browser_run_code_unsafe", "browser_install"]
"@
# Append only: preserve every original byte and existing setting.
[IO.File]::AppendAllText($configPath, "`n" + $stanza + "`n", [Text.UTF8Encoding]::new($false))
$afterHash = (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash
[ordered]@{ changedAt=(Get-Date -Format o); config=$configPath; backup=$backupPath; beforeSha256=$beforeHash; afterSha256=$afterHash; server='playwright'; method='append-only official config.toml STDIO stanza' } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $workspace 'reports\codex-config-change.json') -Encoding utf8
Write-Output 'Configured playwright; existing config retained and backup saved.'
