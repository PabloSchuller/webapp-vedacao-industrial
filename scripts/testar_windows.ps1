$ErrorActionPreference = 'Stop'
& node "$PSScriptRoot/ci.mjs"
exit $LASTEXITCODE
