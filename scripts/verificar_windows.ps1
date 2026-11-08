# Diagnóstico SEM alterar registros do banco.
$ErrorActionPreference='Continue'
Write-Host '=== Serviços Docker ==='
docker compose ps
Write-Host '=== API Node ==='
try{(Invoke-RestMethod -Uri 'http://localhost:3001/saude' -TimeoutSec 10) | ConvertTo-Json}catch{Write-Warning $_}
Write-Host '=== Serviço de IA ==='
try{(Invoke-RestMethod -Uri 'http://localhost:8000/saude' -TimeoutSec 10) | ConvertTo-Json}catch{Write-Warning $_}
Write-Host '=== Frontend ==='
try{$r=Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 10; Write-Host "HTTP $($r.StatusCode)"}catch{Write-Warning $_}
Write-Host '=== Últimos eventos do backend ==='
docker compose logs --tail 25 api
