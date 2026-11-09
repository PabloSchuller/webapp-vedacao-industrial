"""Poll de releases públicas. Estado local root-only; nenhuma credencial de nuvem."""
import argparse
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

REPO = "PabloSchuller/webapp-vedacao-industrial"
BASE = "ghcr.io/" + REPO.lower()
SERVICES = ("ia", "api", "web")
STATE = Path("/var/lib/vedacaohub-release")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def command(*args, env=None, stdin=None):
    return subprocess.run(args, env=env, input=stdin, text=True,
                          stdout=subprocess.PIPE, check=True, timeout=300).stdout.strip()


def github(path):
    req = urllib.request.Request("https://api.github.com/repos/" + REPO + path,
                                 headers={"User-Agent": "VedacaoHub-EC2", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def latest():
    sha = github("/commits/main")["sha"]
    require(re.fullmatch("[a-f0-9]{40}", sha), "Revisão da main inválida")
    tag = "deploy-" + sha
    try:
        release = github("/releases/tags/" + tag)
    except urllib.error.HTTPError as err:
        if err.code == 404:
            print("Aguardando publicação testada", sha)
            return None
        raise
    require(release["tag_name"] == tag and not release["draft"]
            and release["author"]["login"] == "github-actions[bot]", "Origem da release inválida")
    manifest = json.loads(release["body"])
    require(manifest["sha"] == sha and set(manifest["images"]) == set(SERVICES), "Manifesto inválido")
    for digest in manifest["images"].values():
        require(re.fullmatch("sha256:[a-f0-9]{64}", digest), "Digest inválido")
    return manifest


def save(path, obj):
    temp = path.with_suffix(".next")
    with temp.open("w", encoding="utf-8") as handle:
        json.dump(obj, handle)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


class Stack:
    retained_prefix = "vedacaohub-retido"
    def __init__(self, state):
        self.override = state / "images.json"
        self.base_env = os.environ.copy()
        self.pg = self.cid("postgres")
        mounts = self.inspect(self.pg)["Mounts"]
        require(any(m["Type"] == "volume" and m["Name"] == os.environ["PG_VOLUME"]
                    and m["Destination"] == "/var/lib/postgresql/data" for m in mounts),
                "Volume PostgreSQL diferente do configurado")

    def compose(self, *args, override=False, stdin=None):
        env = self.base_env.copy()
        if override:
            env["COMPOSE_FILE"] += os.pathsep + str(self.override)
        return command("docker", "compose", *args, env=env, stdin=stdin)

    def cid(self, svc):
        cid = self.compose("ps", "-q", svc)
        require(re.fullmatch("[0-9a-f]{12,64}", cid), "Serviço ausente ou replicado: " + svc)
        return cid

    @staticmethod
    def inspect(cid):
        return json.loads(command("docker", "inspect", cid))[0]

    def guard(self):
        services = json.loads(self.compose("config", "--format", "json"))["services"]
        for svc in SERVICES:
            cfg = services[svc]
            require(cfg.get("network_mode") != "host", "Rede host incompatível: " + svc)
            current = self.inspect(self.cid(svc))
            live = dict(item.split("=", 1) for item in current["Config"]["Env"] if "=" in item)
            defaults = dict(item.split("=", 1) for item in self.inspect(current["Image"])["Config"].get("Env", []) if "=" in item)
            configured = cfg.get("environment", {})
            require(all(live.get(k) == str(v) for k,v in configured.items())
                    and all(k in configured or defaults.get(k) == v for k,v in live.items()),
                    "Configuração de ambiente diverge em " + svc)
            bindings = current["HostConfig"].get("PortBindings") or {}
            for port in cfg.get("ports", []):
                key = str(port["target"]) + "/" + port.get("protocol", "tcp")
                require(any(b["HostPort"] == str(port.get("published"))
                            and b["HostIp"] == port.get("host_ip", "") for b in bindings.get(key, [])),
                        "Publicação de porta diverge em " + svc)
        api = services["api"]
        env = api["environment"]
        pg = dict(e.split("=",1) for e in self.inspect(self.pg)["Config"]["Env"] if "=" in e)
        dsn = urlsplit(env["DATABASE_URL"])
        require(dsn.hostname == "postgres" and dsn.port in (None, 5432)
                and unquote(dsn.path[1:]) == pg["POSTGRES_DB"] and unquote(dsn.username or "") == pg["POSTGRES_USER"]
                and unquote(dsn.password or "") == pg["POSTGRES_PASSWORD"]
                and parse_qs(dsn.query).get("schema", ["public"]) == ["public"]
                and str(env.get("DEMO_SEED","false")).lower() == "false"
                and api.get("command") in (None, "npm start", ["npm","start"]) and not api.get("entrypoint"),
                "Inicialização ou banco incompatível")

    def prepare(self, manifest):
        images = {svc:BASE + "/" + svc + "@" + manifest["images"][svc] for svc in SERVICES}
        return self.prepare_images(images)

    def prepare_images(self, images):
        current, target, changed = {}, {}, []
        for svc in SERVICES:
            image = images[svc]
            try:
                image_id = command("docker","image","inspect","--format","{{.Id}}",image)
            except subprocess.CalledProcessError:
                command("docker","pull",image)
                image_id = command("docker","image","inspect","--format","{{.Id}}",image)
            live = self.inspect(self.cid(svc))
            # Reter também imagens locais anteriores à primeira release GHCR.
            local = self.retained_prefix + "/" + svc + ":" + live["Image"].split(":")[1]
            command("docker","tag",live["Image"],local)
            current[svc] = local
            target[svc] = image
            if live["Image"] != image_id:
                changed.append(svc)
        if "api" in changed:
            self.schema(target["api"])
        return current, target, changed

    def schema(self, image):
        expected = command("docker","run","--rm","--network","none","--entrypoint","sh",image,
                           "-ec","sha256sum prisma/migrations/*/migration.sql")
        query = """SELECT CASE WHEN finished_at IS NULL THEN 'INCOMPLETA' ELSE checksum END
                    || '  prisma/migrations/' || migration_name || '/migration.sql'
                    FROM public._prisma_migrations WHERE rolled_back_at IS NULL;"""
        applied = self.compose("exec","-T","postgres","sh","-ec",
                               'exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',stdin=query)
        require(bool(applied) and sorted(applied.splitlines()) == sorted(expected.splitlines()),
                "Histórico Prisma divergente ou pendente; nenhuma migração foi executada")

    def switch(self, images, changed):
        save(self.override, {"services":{s:{"image":v} for s,v in images.items()}})
        if changed:
            self.compose("up","-d","--no-deps","--no-build","--pull","never","--wait","--wait-timeout","120",
                         *changed,override=True)
        for svc in changed:
            require(self.inspect(self.cid(svc))["Image"] == command("docker","image","inspect","--format","{{.Id}}",images[svc]),
                    "Imagem em execução diverge: " + svc)
        for attempt in range(12):
            try:
                self.compose("exec","-T","ia","python","-c",'import urllib.request; urllib.request.urlopen("http://localhost:8000/saude",timeout=4)')
                self.compose("exec","-T","api","node","-e",'fetch("http://localhost:3001/saude",{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok || (await r.json()).situacao!=="ok")process.exit(1)}).catch(()=>process.exit(1))')
                html = self.compose("exec","-T","web","wget","-T","4","-qO-","http://127.0.0.1/")
                require('id="root"' in html, "Frontend indisponível")
                require(self.cid("postgres") == self.pg,"Instância PostgreSQL mudou")
                return
            except (RuntimeError, subprocess.SubprocessError):
                if attempt == 11:
                    raise
                time.sleep(5)


def operate(stack, state, action, fetch_release=latest):
    journal = state / "pendente.json"
    previous = state / "anterior.json"
    status = state / "estado.json"
    info = json.loads(status.read_text()) if status.exists() else {}
    if journal.exists() or action == "rollback":
        record = journal if journal.exists() else previous
        require(record.exists(), "Sem release anterior para rollback")
        entry = json.loads(record.read_text())
        # Persistir a intenção antes de tocar nos contêineres, inclusive no rollback manual.
        save(journal,entry)
        stack.switch(entry["old"],entry["changed"])
        save(status,{"active":entry["from"],"blocked":entry["to"]})
        previous.unlink(missing_ok=True)
        journal.unlink()
        print("Rollback confirmado",entry["to"],"->",entry["from"],entry["changed"])
        return
    manifest = fetch_release()
    if manifest is None:
        return
    sha = manifest["sha"]
    if sha in (info.get("active"),info.get("blocked")):
        print("Sem atualização",sha)
        return
    stack.guard()
    old, target, changed = stack.prepare(manifest)
    if changed:
        entry = {"from":info.get("active"),"to":sha,"old":old,"changed":changed}
        save(journal,entry)
        try:
            stack.switch(target,changed)
        except Exception:
            operate(stack,state,"rollback")
            raise
        save(previous,entry)
    else:
        stack.switch(target, [])
        if previous.exists():
            # Uma publicação só de documentação não invalida a última imagem saudável.
            entry=json.loads(previous.read_text())
            entry["to"]=sha
            save(previous,entry)
    save(status,{"active":sha})
    journal.unlink(missing_ok=True)
    print("Release confirmada",sha,"serviços:",",".join(changed) or "nenhum",manifest["images"])


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("action",choices=["poll","rollback"],default="poll",nargs="?")
    args=parser.parse_args()
    STATE.mkdir(mode=0o700,exist_ok=True)
    operate(Stack(STATE),STATE,args.action)
