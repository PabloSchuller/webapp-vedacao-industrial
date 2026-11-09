# Deploy automático por consulta da EC2

O GitHub Actions executa testes, cobertura, análise e build em runners hospedados pelo GitHub. Só um push aprovado pela CI na `main` pode publicar no GHCR e criar a pré-release pública `deploy-<SHA>`. Seu corpo JSON associa o SHA aos três digests. As imagens novas recebem tag do commit; entradas de build iguais reutilizam o digest de uma release publicada. A chave considera a árvore Git do serviço, o publicador e, para o frontend, a URL compilada da API. O primeiro ciclo sem manifesto compatível constrói as três imagens.

Na EC2, um timer consulta a ponta da main e procura a release daquele SHA a cada cinco minutos. Uma main sem release aguarda a CI. O agente aceita apenas o manifesto do bot do GitHub Actions no repositório fixo, baixa por `@sha256`, compara IDs de imagem e chama Compose somente para os serviços alterados. Na transição das imagens antigas, todos os serviços de aplicação cujos IDs diferem podem ser recriados uma vez. O mecanismo usa HTTPS de saída, os pacotes públicos e o Docker já instalado. Não precisa de IAM, OIDC, SSM, chaves de AWS, credencial GHCR no host, webhook, runner na EC2 ou nova porta.

## 1. Autorizar publicação no GitHub

1. Revise o diff, proteja a main e exija aprovação da CI. Alterações em workflows e imagens merecem revisão de mantenedor, pois a EC2 executará as imagens publicadas.
2. Permita ao workflow publicar Packages e criar releases com o `GITHUB_TOKEN`. Em pacotes preexistentes, confira o acesso de escrita do repositório. Depois do merge autorizado, confirme que os jobs `verificar` e `imagens` passaram. O segundo publica o manifesto após obter os três digests.
3. Em **Packages → Package settings**, permita leitura pública apenas dos três pacotes de código `webapp-vedacao-industrial/api`, `webapp-vedacao-industrial/web` e `webapp-vedacao-industrial/ia`. Pacotes novos podem iniciar privados. O banco, uploads e arquivos de ambiente não integram as imagens. O build usa a variável pública `PUBLIC_API_URL`, com padrão `https://3-19-67-254.sslip.io/api`. A sonda externa continua no workflow de disponibilidade.

## 2. Instalar o timer uma vez no Ubuntu

Faça a configuração no terminal administrativo já disponível da EC2. Os blocos desta seção são para **Bash na mesma sessão**, após o merge e a publicação da primeira release. O projeto em produção deve usar os nomes de serviço `postgres`, `api`, `ia` e `web`, PostgreSQL 16 em volume nomeado, Nginx na porta interna 80 e API na 3001. O computador de produção precisa de Docker Compose v2 com `--wait`, Python 3.8+, Git, curl, util-linux e systemd.

Obtenha o código do agente em um diretório separado. Confira a revisão e a existência do manifesto antes de instalá-lo:

```bash
set -euo pipefail
repo=PabloSchuller/webapp-vedacao-industrial
src=$(mktemp -d)
git clone --quiet --depth 1 --branch main "https://github.com/$repo.git" "$src"
sha=$(git -C "$src" rev-parse HEAD)
curl -fsS "https://api.github.com/repos/$repo/releases/tags/deploy-$sha" |
  python3 -c 'import json,sys; r=json.load(sys.stdin); m=json.loads(r["body"]); assert r["author"]["login"]=="github-actions[bot]" and m["sha"]==sys.argv[1]; print(m)' "$sha"
```

Identifique o projeto Compose ativo. Se houver mais de um PostgreSQL, o bloco interrompe antes de escolher a instância. Nesse caso, identifique o contêiner do VedaçãoHub com `sudo docker ps` e atribua manualmente o ID correto a `pg` antes de prosseguir.

```bash
mapfile -t ids < <(sudo docker ps -q --filter label=com.docker.compose.service=postgres)
(( ${#ids[@]} == 1 ))
pg=${ids[0]}
project=$(sudo docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$pg")
dir=$(sudo docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$pg")
files=$(sudo docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$pg")
volume=$(sudo docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$pg")
test -n "$volume" && test -d "$dir"
printf 'Projeto=%s\nDiretório=%s\nArquivos=%s\nVolume=%s\n' "$project" "$dir" "$files" "$volume"
```

Confira que os arquivos identificados contêm as configurações reais de rede, proxy e serviços da aplicação. Se Caddy ou os aplicativos usam overrides adicionais, inclua os caminhos absolutos em `files`, separados por vírgula e na ordem original. Se a instalação usa arquivo de ambiente personalizado, informe seu caminho existente em `COMPOSE_ENV_FILES` no arquivo privado gerado abaixo. Preserve o `.env` atual. O host deve permitir saída HTTPS para GitHub e GHCR. Confira espaço para a imagem nova e a anterior. Reserve as imagens locais de rollback; não configure limpeza automática delas.

```bash
sudo install -d -m 0700 /etc/vedacaohub /var/lib/vedacaohub-release
sudo install -d -m 0755 /usr/local/lib/vedacaohub
sudo install -m 0755 "$src/ops/aplicar.sh" /usr/local/sbin/vedacaohub-pull
sudo install -m 0644 "$src/ops/pull.py" /usr/local/lib/vedacaohub/pull.py
sudo install -m 0644 "$src/ops/vedacaohub-pull."{service,timer} /etc/systemd/system/
sudo test ! -e /etc/vedacaohub/pull.conf
printf 'APP_DIR=%q\nCOMPOSE_PROJECT_NAME=%q\nCOMPOSE_FILE=%q\nPG_VOLUME=%q\n' \
  "$dir" "$project" "${files//,/:}" "$volume" |
  sudo sh -c 'umask 077; cat > /etc/vedacaohub/pull.conf'
sudo systemd-analyze verify /etc/systemd/system/vedacaohub-pull.{service,timer}
sudo systemctl daemon-reload
sudo systemctl enable --now vedacaohub-pull.timer
sudo systemctl list-timers --all vedacaohub-pull.timer
```

Instale somente código e configurações administrados por pessoas de confiança: o serviço tem acesso ao Docker do host. O agente não escreve nos arquivos da aplicação, no `.env` ou na configuração do Caddy. O override de imagens fica em `/var/lib/vedacaohub-release/images.json`. Para inspeções Compose após a atualização, mantenha a mesma base e acrescente esse override. Não execute um `compose up` genérico com arquivos de outra instalação.

## 3. Comprovar a primeira entrega automática

Aguarde o disparo do **timer**. Se um pacote estiver privado ou se a instalação usar variáveis de ambiente não reproduzidas pelo Compose, o journal aponta o bloqueio. Corrija o acesso/configuração e aguarde a próxima consulta. Para obter a evidência:

```bash
sudo journalctl -u vedacaohub-pull.service --since today --no-pager
sudo cat /var/lib/vedacaohub-release/estado.json
for svc in ia api web postgres caddy; do
  cid=$(sudo docker ps -q --filter "label=com.docker.compose.project=$project" \
                            --filter "label=com.docker.compose.service=$svc")
  if [[ -n "$cid" ]]; then sudo docker inspect -f '{{.Name}} {{.Id}} {{.Config.Image}} {{.Image}}' "$cid"; fi
done
curl -fsS https://3-19-67-254.sslip.io/api/saude
curl -fsS https://3-19-67-254.sslip.io/ | grep -o 'id="root"'
```

Guarde o link do job da main e da release, o evento `Release confirmada` com SHA/digests e a resposta pública. Para provar atualização seletiva, compare os IDs dos contêineres antes e depois de uma release que altere só um serviço. A sondagem seguinte do mesmo SHA deve indicar `Sem atualização`. No primeiro bootstrap, os IDs de imagens locais anteriores podem ser diferentes de todos os digests do GHCR.

## Migrações e rollback

O timer não executa SQL de migração. Antes de trocar a API, compara as migrações da imagem com as somas gravadas em `_prisma_migrations`. Uma migração nova, ausente, incompleta ou com checksum divergente bloqueia a entrega antes da primeira recriação. Para uma mudança de schema futura, revise SQL e compatibilidade com a aplicação anterior, faça backup privado e valide-o antes de autorizar a migração separadamente. O exemplo abaixo somente produz e confere o índice de um backup:

```bash
umask 077
mkdir -p "$HOME/vedacaohub-backups"
backup=$(mktemp "$HOME/vedacaohub-backups/pre-migracao-XXXXXXXX.dump")
sudo docker exec "$pg" sh -ec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup"
sudo docker exec -i "$pg" pg_restore --list < "$backup" > /dev/null
```

Antes de trocar um serviço, o agente retém a imagem anterior e grava um registro de recuperação. Se a recriação ou a verificação interna de IA/API/web falhar, ele reaplica as imagens anteriores apenas aos serviços envolvidos. Uma interrupção é retomada pelo timer a partir de `pendente.json`. Depois de um rollback confirmado, o SHA recusado fica bloqueado. Entregue a correção com um novo commit na main. O rollback é de imagens; não restaura o banco. Para recuar explicitamente da última entrega que mudou imagens:

```bash
sudo systemctl stop vedacaohub-pull.timer
sudo /usr/local/sbin/vedacaohub-pull rollback
sudo cat /var/lib/vedacaohub-release/estado.json
sudo systemctl start vedacaohub-pull.timer
```

Se a recuperação falhar, preserve o estado e as imagens retidas, consulte o journal e corrija a causa antes de retomar. O ensaio automatizado usa projetos Compose e dados descartáveis; a comprovação na EC2 depende da primeira execução registrada pelo timer.
