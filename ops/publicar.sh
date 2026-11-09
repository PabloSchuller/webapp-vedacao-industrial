#!/usr/bin/env bash
set -euo pipefail
base=ghcr.io/pabloschuller/webapp-vedacao-industrial
[[ $GITHUB_SHA =~ ^[0-9a-f]{40}$ && $PUBLIC_API_URL == https://* ]]
dir=$(mktemp -d)
tag="deploy-$GITHUB_SHA"
gh api "repos/$GITHUB_REPOSITORY/releases?per_page=100" > "$dir/releases"
jq '[.[] | select((.draft|not) and .author.login=="github-actions[bot]" and (.tag_name|test("^deploy-[0-9a-f]{40}$"))) | (.body|fromjson?) ]' "$dir/releases" > "$dir/manifests"
for svc in ia api web; do
  args=()
  input=$(git rev-parse "$GITHUB_SHA:$svc")
  if [[ $svc == web ]]; then
    args=(-f web/Dockerfile.prod --build-arg "VITE_API_URL=$PUBLIC_API_URL")
    input="$input:$PUBLIC_API_URL"
  fi
  key=$(printf '%s' "$input:$(git rev-parse "$GITHUB_SHA:ops/publicar.sh")" | sha256sum | cut -d' ' -f1)
  digest=$(jq -r --arg s "$svc" --arg k "$key" '[.[] | select(.inputs[$s]==$k) | .images[$s]][0] // empty' "$dir/manifests")
  if [[ -z $digest ]]; then
    docker buildx build --platform linux/amd64 --push -t "$base/$svc:$GITHUB_SHA" \
      --label "org.opencontainers.image.source=https://github.com/$GITHUB_REPOSITORY" \
      --label "org.opencontainers.image.revision=$GITHUB_SHA" \
      --metadata-file "$dir/$svc.json" "${args[@]}" "$svc"
    digest=$(jq -er '."containerimage.digest"' "$dir/$svc.json")
  fi
  [[ $digest =~ ^sha256:[0-9a-f]{64}$ ]]
  jq -n --arg svc "$svc" --arg key "$key" --arg digest "$digest" \
    '{images:{($svc):$digest},inputs:{($svc):$key}}' > "$dir/$svc.part"
done
jq -s --arg sha "$GITHUB_SHA" 'reduce .[] as $part ({sha:$sha}; . * $part)' "$dir"/*.part > "$dir/release.json"
if gh release view "$tag" --json body --jq .body > "$dir/published"; then
  diff <(jq -S . "$dir/release.json") <(jq -S . "$dir/published")
else
  gh release create "$tag" --target "$GITHUB_SHA" --title "VedaçãoHub $GITHUB_SHA" --notes-file "$dir/release.json" --prerelease
fi
