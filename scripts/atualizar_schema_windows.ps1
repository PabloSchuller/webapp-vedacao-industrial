# Operação explícita. Não usa --accept-data-loss, reset ou remoção de volumes.
$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    & "$PSScriptRoot/backup_windows.ps1"
    docker compose run --rm --no-deps api npx prisma db push
    if($LASTEXITCODE -ne 0){throw 'Schema não atualizado. Não force perda de dados; revise a mensagem e o backup.'}
    Write-Host 'Schema verificado/atualizado. Nenhum seed foi executado.'
} finally { Pop-Location }
