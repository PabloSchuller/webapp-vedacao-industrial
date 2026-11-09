#!/usr/bin/env bash
# Instalado e administrado por root, chamado pelo documento SSM de parâmetros restritos.
set -euo pipefail
umask 077
[[ $# == 3 ]]
for digest in "$@"; do [[ $digest =~ ^sha256:[0-9a-f]{64}$ ]]; done
exec 9>/run/lock/vedacaohub-release
flock -n 9 || { echo 'Outra atualização em execução'; exit 1; }
set -a
source /etc/vedacaohub/release.conf
set +a
: "${APP_DIR:?}" "${COMPOSE_PROJECT_NAME:?}" "${COMPOSE_FILE:?}" "${PG_VOLUME:?}" "${BACKUP_DIR:?}"
cd "$APP_DIR"
pg=$(docker compose ps --status running -q postgres)
[[ -n $pg && -n $(docker compose ps --status running -q api) ]]
mount=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$pg")
[[ $mount == "$PG_VOLUME" ]]
state=/etc/vedacaohub
tmp=$(mktemp -d)
trap 'rm -f "$tmp"/{images.yml,aplicadas,esperadas,nomes}; rmdir "$tmp"' EXIT
base=ghcr.io/pabloschuller/webapp-vedacao-industrial
printf 'services:\n  api:\n    image: %s/api@%s\n  web:\n    image: %s/web@%s\n  ia:\n    image: %s/ia@%s\n' "$base" "$1" "$base" "$2" "$base" "$3" > "$tmp/images.yml"
base_files=$COMPOSE_FILE
export COMPOSE_FILE="$base_files:$tmp/images.yml"
# O dump e o Prisma devem apontar para o mesmo banco. Nunca imprimir config nem DSN.
export ACTIVE_DSN_HASH
ACTIVE_DSN_HASH=$(docker compose exec -T api node -e 'process.stdout.write(require("crypto").createHash("sha256").update(process.env.DATABASE_URL).digest("hex"))')
export ACTIVE_DB
ACTIVE_DB=$(docker compose exec -T postgres sh -ec 'printf "%s" "$POSTGRES_DB"')
docker compose config --format json | python3 -c '
import hashlib,json,os,sys,urllib.parse as u
s=json.load(sys.stdin)["services"]
a=s["api"]; e=a["environment"]; p=s["postgres"]["environment"]; d=u.urlsplit(e["DATABASE_URL"])
if not (hashlib.sha256(e["DATABASE_URL"].encode()).hexdigest()==os.environ["ACTIVE_DSN_HASH"]
        and d.hostname=="postgres" and d.port in (None,5432) and u.unquote(d.path[1:])==p["POSTGRES_DB"]==os.environ["ACTIVE_DB"]
        and u.unquote(d.username or "")==p["POSTGRES_USER"] and u.unquote(d.password or "")==p["POSTGRES_PASSWORD"]
        and u.parse_qs(d.query).get("schema",["public"])==["public"] and str(e.get("DEMO_SEED","false")).lower()=="false"
        and a.get("command") in (None,"npm start",["npm","start"]) and not a.get("entrypoint")):
    sys.exit("Configuração de produção incompatível com atualização automática")'
docker compose pull api web ia
sql(){ docker compose exec -T postgres sh -ec 'exec psql -X -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"'; }
sql > "$tmp/aplicadas" <<'SQL'
SELECT checksum || '  prisma/migrations/' || migration_name || '/migration.sql'
FROM public._prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name;
SQL
[[ -s $tmp/aplicadas ]]
[[ $(echo 'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL' | sql) == 0 ]]
docker run --rm --network none --entrypoint sh "$base/api@$1" -ec 'sha256sum prisma/migrations/*/migration.sql' > "$tmp/esperadas"
while IFS= read -r anterior; do grep -Fxq "$anterior" "$tmp/esperadas"; done < "$tmp/aplicadas"
pendentes=0
while IFS= read -r linha; do
  if ! grep -Fxq "$linha" "$tmp/aplicadas"; then
    grep -Fxq "$linha" "$state/migracoes-aprovadas.sha256" || { echo 'Migração aguarda revisão do SQL'; exit 1; }
    pendentes=1
  fi
done < "$tmp/esperadas"
if ((pendentes)); then
  install -d -m 700 "$BACKUP_DIR"
  backup=$(mktemp "$BACKUP_DIR/pre-migracao-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXXXX.dump")
  docker compose exec -T postgres sh -ec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup"
  docker compose exec -T postgres pg_restore --list < "$backup" > /dev/null
  docker compose run --rm --no-deps api npx --no-install prisma migrate deploy
fi
# Guardar a seleção inclusive se a recriação for interrompida. Um retry converge para os mesmos digests.
install -m 600 "$tmp/images.yml" "$state/images.next"
mv -f "$state/images.next" "$state/images.yml"
export COMPOSE_FILE="$base_files:$state/images.yml"
docker compose up -d --no-build --no-deps --wait --wait-timeout 120 ia api web
pronto(){
  for tentativa in {1..12}; do
    if docker compose exec -T "$@"; then return 0; fi
    sleep 5
  done
  return 1
}
pronto ia python -c 'import urllib.request; urllib.request.urlopen("http://localhost:8000/saude",timeout=5)'
pronto api node -e 'fetch("http://localhost:3001/saude",{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))'
[[ $(docker compose ps --status running -q postgres) == "$pg" ]]
echo 'Serviços prontos; PostgreSQL preservado'
