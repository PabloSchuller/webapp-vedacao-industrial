#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${AWS_ROLE_ARN:?}" "${AWS_REGION:?}" "${INSTANCE_ID:?}"
export AWS_WEB_IDENTITY_TOKEN_FILE="$RUNNER_TEMP/ssm-oidc"
trap 'rm -f "$AWS_WEB_IDENTITY_TOKEN_FILE"' EXIT
curl --fail --silent --show-error -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -er .value > "$AWS_WEB_IDENTITY_TOKEN_FILE"
params=$(jq -nc --arg api "$API_DIGEST" --arg web "$WEB_DIGEST" --arg ia "$IA_DIGEST" '{api:[$api],web:[$web],ia:[$ia]}')
cmd=$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name VedacaoHubRelease --document-version '1' \
  --parameters "$params" --timeout-seconds 300 --comment "VedacaoHub $GITHUB_SHA" --query Command.CommandId --output text)
echo "SSM $cmd · revisão $GITHUB_SHA"
for ((i=0;i<100;i++)); do
  if status=$(aws ssm get-command-invocation --command-id "$cmd" --instance-id "$INSTANCE_ID" --query Status --output text 2>"$RUNNER_TEMP/ssm-error"); then
    case "$status" in
      Success) exit 0 ;;
      Pending|InProgress|Delayed) ;;
      *) echo "SSM: $status"; exit 1 ;;
    esac
  else
    grep -q InvocationDoesNotExist "$RUNNER_TEMP/ssm-error" || exit 1
  fi
  sleep 15
done
echo 'Sem confirmação de conclusão da EC2'; exit 1
