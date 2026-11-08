# Execute na pasta raiz do projeto com o Docker Desktop aberto.
$ErrorActionPreference='Stop'
$agora=Get-Date -Format 'yyyyMMdd_HHmmss_fff'
New-Item -ItemType Directory -Force -Path '.\backups' | Out-Null
$destino=".\backups\vedacaohub_$agora.dump"
Write-Host 'Criando backup lógico do PostgreSQL (inclui fotos anexadas no banco)...'
docker compose exec -T postgres pg_dump -U vedacao -d vedacao -Fc -f /tmp/vedacaohub_backup.dump
if($LASTEXITCODE -ne 0){throw 'Falha ao gerar backup no PostgreSQL.'}
docker compose cp postgres:/tmp/vedacaohub_backup.dump $destino
if($LASTEXITCODE -ne 0){throw 'Falha ao copiar backup para o computador.'}
if(!(Test-Path $destino) -or (Get-Item $destino).Length -eq 0){throw 'O arquivo de backup não foi criado ou está vazio.'}
docker compose exec -T postgres pg_restore --list /tmp/vedacaohub_backup.dump | Out-Null
if($LASTEXITCODE -ne 0){throw 'O arquivo gerado não pôde ser lido pelo pg_restore.'}
Get-FileHash -Algorithm SHA256 $destino | Format-List | Out-File "$destino.sha256.txt" -Encoding utf8
Write-Host "BACKUP CRIADO: $destino"
Write-Host 'Guarde uma cópia em local seguro. O backup contém informações pessoais e fotos.'
