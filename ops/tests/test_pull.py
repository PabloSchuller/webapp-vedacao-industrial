import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pull


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.sha="a"*40
        self.images={s:"sha256:"+"b"*64 for s in pull.SERVICES}
        self.release={"tag_name":"deploy-"+self.sha,"draft":False,"author":{"login":"github-actions[bot]"},
                      "body":json.dumps({"sha":self.sha,"images":self.images})}

    def test_release_publicada_e_pendente(self):
        with patch.object(pull,"github",side_effect=[{"sha":self.sha},self.release]):
            self.assertEqual(pull.latest()["images"],self.images)
        with patch.object(pull,"github",side_effect=[{"sha":self.sha},HTTPError("",404,"pendente",{},None)]):
            self.assertIsNone(pull.latest())

    def test_manifesto_nao_pode_escolher_comandos_repositorios_ou_outro_sha(self):
        for change in [{"author":{"login":"desconhecido"}},{"draft":True},{"body":json.dumps({"sha":"x","images":self.images})},
                       {"body":json.dumps({"sha":self.sha,"images":{**self.images,"api":"outra/imagem:latest"}})}]:
            with self.subTest(change=change),patch.object(pull,"github",side_effect=[{"sha":self.sha},{**self.release,**change}]):
                with self.assertRaises(RuntimeError):
                    pull.latest()

    def test_schema_divergente_interrompe_antes_de_recriar(self):
        stack=object.__new__(pull.Stack)
        stack.compose=Mock(return_value="abc  prisma/migrations/inicial/migration.sql")
        with patch.object(pull,"command",return_value=stack.compose.return_value+"\ndef  prisma/migrations/nova/migration.sql"):
            with self.assertRaisesRegex(RuntimeError,"Prisma"):
                stack.schema("imagem")
        query=stack.compose.call_args.kwargs["stdin"].upper()
        self.assertTrue(query.strip().startswith("SELECT"))
        self.assertNotIn("MIGRATE DEPLOY",query)

    def test_retomada_interrompida_e_rollback_manual(self):
        for interrupted in (True,False):
            with self.subTest(interrupted=interrupted),tempfile.TemporaryDirectory() as tmp:
                path=Path(tmp)
                record={"from":"a","to":"b","changed":["web"],"old":{"web":"anterior"}}
                pull.save(path/("pendente.json" if interrupted else "anterior.json"),record)
                stack=Mock()
                pull.operate(stack,path,"poll" if interrupted else "rollback",Mock(side_effect=AssertionError))
                stack.switch.assert_called_once_with(record["old"],["web"])
                self.assertEqual(json.loads((path/"estado.json").read_text()),{"active":"a","blocked":"b"})
                self.assertFalse((path/"pendente.json").exists())

    def test_falha_de_rollback_preserva_jornal_para_proxima_tentativa(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)
            pull.save(path/"pendente.json",{"from":"a","to":"b","changed":["web"],"old":{"web":"origem"}})
            stack=Mock()
            stack.switch.side_effect=RuntimeError("indisponível")
            with self.assertRaises(RuntimeError):
                pull.operate(stack,path,"poll")
            self.assertTrue((path/"pendente.json").exists())


if __name__=="__main__":
    unittest.main()
