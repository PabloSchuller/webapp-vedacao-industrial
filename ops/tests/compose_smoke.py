"""Ensaio isolado do plano, troca e rollback com Docker real; GHCR substituído por imagens locais."""
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pull


def main():
    project = "vedacao-pull-test-" + secrets.token_hex(6)
    password = secrets.token_hex(24)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        config = root / "compose.json"
        volume = project + "_db"
        env = {**os.environ,"COMPOSE_FILE":str(config),"COMPOSE_PROJECT_NAME":project,"PG_VOLUME":volume}
        def compose(*args):
            return pull.command("docker","compose","-p",project,"-f",str(config),*args,env=env)
        images = {}
        for version, html in [("a",'<div id="root">a</div>'),("b",'<div id="root">b</div>'),("ruim","erro")]:
            image = project + "-web:" + version
            (root / "Dockerfile").write_text("FROM nginx:1.27-alpine\nCOPY index.html /usr/share/nginx/html/index.html\n")
            (root / "index.html").write_text(html)
            pull.command("docker","build","-q","-t",image,str(root))
            images[version]=image
        node="node:22-bookworm-slim"
        python="python:3.11-slim"
        services={
            "postgres":{"image":"postgres:16-alpine","environment":{"POSTGRES_USER":"teste","POSTGRES_DB":"teste","POSTGRES_PASSWORD":password},
                        "volumes":["db:/var/lib/postgresql/data"],"healthcheck":{"test":["CMD","pg_isready","-U","teste"],"interval":"1s"}},
            "ia":{"image":python,"command":["sh","-ec","mkdir -p /tmp/ia; echo ok >/tmp/ia/saude; exec python -m http.server 8000 --directory /tmp/ia"]},
            "api":{"image":node,"environment":{"DATABASE_URL":"postgresql://teste:"+password+"@postgres:5432/teste","DEMO_SEED":"false"}},
            "web":{"image":images["a"]},
            "caddy":{"image":"postgres:16-alpine","entrypoint":["sleep","infinity"]},
        }
        # A API de ensaio usa o mesmo contrato npm start de produção.
        (root/"package.json").write_text(json.dumps({"scripts":{"start":"node /tmp/saude.cjs"}}))
        (root/"saude.cjs").write_text('require("http").createServer((q,r)=>r.end(JSON.stringify({situacao:"ok"}))).listen(3001)')
        (root/"Dockerfile").write_text("FROM "+node+"\nWORKDIR /tmp\nCOPY package.json saude.cjs /tmp/\nCMD [\"npm\",\"start\"]\n")
        api=project+"-api:teste"
        pull.command("docker","build","-q","-t",api,str(root))
        services["api"]["image"]=api
        config.write_text(json.dumps({"services":services,"networks":{"default":{"internal":True}},"volumes":{"db":{"name":volume}}}))
        try:
            compose("up","-d","--wait")
            with patch.dict(os.environ,env):
                class LocalStack(pull.Stack):
                    retained_prefix = project + "-retido"
                    def prepare(self, manifest):
                        return self.prepare_images(manifest["images"])
                stack=LocalStack(root)
                protected={s:stack.cid(s) for s in ("postgres","caddy","ia","api")}
                sql=lambda query: stack.compose("exec","-T","postgres","psql","-XAt","-v","ON_ERROR_STOP=1","-U","teste","-c",query)
                sql("CREATE TABLE sentinela (valor text); INSERT INTO sentinela VALUES ('preservado')")
                def deploy(version):
                    manifest={"sha":version,"images":{"ia":python,"api":api,"web":images[version]}}
                    pull.operate(stack,root,"poll",lambda:manifest)
                deploy("b")
                web_id=stack.cid("web")
                deploy("b")
                assert stack.cid("web")==web_id
                try:
                    with patch.object(pull.time,"sleep",lambda _:None):
                        deploy("ruim")
                except RuntimeError as err:
                    assert "Frontend indisponível" in str(err)
                else:
                    raise AssertionError("Imagem defeituosa aceita")
                assert json.loads((root/"estado.json").read_text())=={"active":"b","blocked":"ruim"}
                assert ">b<" in stack.compose("exec","-T","web","wget","-qO-","http://127.0.0.1/")
                assert protected=={s:stack.cid(s) for s in protected}
                assert sql("SELECT valor FROM sentinela")=="preservado"
                print("Troca seletiva, repetição e rollback confirmados; contêineres protegidos e linha PostgreSQL preservados.")
        finally:
            # Apenas o projeto com nome aleatório e volume criado acima.
            compose("down","--volumes")


if __name__=="__main__":
    main()
