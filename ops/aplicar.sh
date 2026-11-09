#!/usr/bin/env bash
set -euo pipefail
umask 077
exec 9>/run/lock/vedacaohub-release
flock -n 9 || { echo 'Atualização em andamento'; exit 75; }
set -a
source /etc/vedacaohub/pull.conf
set +a
: "${APP_DIR:?}" "${COMPOSE_PROJECT_NAME:?}" "${COMPOSE_FILE:?}" "${PG_VOLUME:?}"
cd "$APP_DIR"
exec python3 /usr/local/lib/vedacaohub/pull.py "$@"
