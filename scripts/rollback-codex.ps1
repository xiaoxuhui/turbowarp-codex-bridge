$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$record = Get-Content -LiteralPath (Join-Path $workspace 'reports\codex-config-change.json') -Raw | ConvertFrom-Json
$currentHash = (Get-FileHash -LiteralPath $record.config -Algorithm SHA256).Hash
if ($currentHash -ne $record.afterSha256) {
    throw 'Codex config changed since installation. Use codex mcp remove playwright to remove only this server; do not overwrite newer settings.'
}
if ((Get-FileHash -LiteralPath $record.backup -Algorithm SHA256).Hash -ne $record.beforeSha256) { throw 'Backup hash mismatch' }
Copy-Item -LiteralPath $record.backup -Destination $record.config -Force
Write-Output 'Restored original Codex config. Restart MCP servers in Codex to apply.'
