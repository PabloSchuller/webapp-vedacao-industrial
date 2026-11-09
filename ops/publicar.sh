#!/usr/bin/env bash
set -euo pipefail
base=ghcr.io/pabloschuller/webapp-vedacao-industrial
[[ $GITHUB_SHA =~ ^[0-9a-f]{40}$ && $PUBLIC_API_URL == https://* ]]
for svc in ia api web; do
  args=()
  if [[ $svc == web ]]; then
    args=(-f web/Dockerfile.prod --build-arg "VITE_API_URL=$PUBLIC_API_URL")
  fi
  docker buildx build --platform linux/amd64 --push -t "$base/$svc:$GITHUB_SHA" \
    --metadata-file "$RUNNER_TEMP/$svc.json" "${args[@]}" "$svc"
  digest=$(jq -er '."containerimage.digest"' "$RUNNER_TEMP/$svc.json")
  [[ $digest =~ ^sha256:[0-9a-f]{64}$ ]]
  echo "$svc=$digest" >> "$GITHUB_OUTPUT"
done
