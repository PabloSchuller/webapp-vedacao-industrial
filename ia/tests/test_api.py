from fastapi.testclient import TestClient
from api import app, carregar_modelo, analisar, Registro

client=TestClient(app)
def test_saude():
    assert client.get('/saude').status_code==200

def test_saude_modelo_ausente(monkeypatch,tmp_path):
    import api
    monkeypatch.setattr(api,'_model',None)
    monkeypatch.setattr(api,'MODEL_PATH',tmp_path/'ausente.joblib')
    assert client.get('/saude').status_code==503

def test_saude_modelo_corrompido(monkeypatch,tmp_path):
    import api
    path=tmp_path/'corrompido.joblib'
    path.write_bytes(b'artefato invalido')
    monkeypatch.setattr(api,'_model',None)
    monkeypatch.setattr(api,'MODEL_PATH',path)
    assert client.get('/saude').status_code==503

def test_rejeita_entrada_ruim():
    assert client.post('/classificar',json={'descricao':'curto','percentual_anterior':10,'percentual_atual':110}).status_code==422

def test_modelo_executa():
    modelo=carregar_modelo()
    r=analisar(Registro(descricao='Aplicado selante nas juntas laterais e executada a vedação.',percentual_anterior=20,percentual_atual=50),modelo)
    assert r['classificacao_ia'] in {'INDEFINIDO','SEM_EXECUCAO','TRABALHO_EXECUTADO'}
    assert 0<=r['score_modelo']<=1
    assert isinstance(r['avisos'],list)

class ModeloFalso:
    classes_=['INDEFINIDO','SEM_EXECUCAO','TRABALHO_EXECUTADO']
    def predict_proba(self,textos):
        import numpy as np
        return np.array([[0.20,0.45,0.35]])

def test_contradicao_nao_some_por_baixa_confianca():
    registro=Registro(descricao='Nenhuma atividade foi realizada por falta de materiais.',percentual_anterior=40,percentual_atual=80)
    r=analisar(registro,ModeloFalso())
    assert any('progresso aumentou' in a for a in r['avisos'])
    assert any('baixa confiança' in a for a in r['avisos'])

def test_classificacao_textual_sem_percentuais():
    relatos = ['Aplicado selante em duas paredes laterais.',
               'Nenhuma atividade realizada por falta de placas.',
               'Equipe esteve no local para inspeção inicial.']
    for relato in relatos:
        resposta = client.post('/classificar', json={'descricao': relato})
        assert resposta.status_code == 200
        dados = resposta.json()
        assert dados['classificacao_ia'] in {'TRABALHO_EXECUTADO','SEM_EXECUCAO','INDEFINIDO'}
        assert not any('progresso' in aviso for aviso in dados['avisos'])
