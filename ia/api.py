"""Classifica o texto usando somente o modelo treinado neste projeto."""
from pathlib import Path
from hashlib import sha256
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE=Path(__file__).resolve().parent
MODEL_PATH=BASE / 'modelos' / 'modelo.joblib'
app=FastAPI(title='IA própria - Validação de relatos de vedação',version='1.0')
_model=None
_model_version=None

class Registro(BaseModel):
    descricao:str=Field(min_length=10,max_length=3000)
    percentual_anterior:float | None=Field(default=None,ge=0,le=100)
    percentual_atual:float | None=Field(default=None,ge=0,le=100)


def carregar_modelo():
    global _model, _model_version
    if _model is None:
        if not MODEL_PATH.exists():
            raise HTTPException(status_code=503,detail='Execute python treinar.py antes de iniciar a IA.')
        # Jamais carregar arquivo joblib recebido de usuários: serialização pode executar código.
        _model=joblib.load(MODEL_PATH)
        _model_version='sha256:'+sha256(MODEL_PATH.read_bytes()).hexdigest()
    return _model


def analisar(registro,modelo):
    chances=modelo.predict_proba([registro.descricao])[0]
    classe_indice=int(chances.argmax())
    classe=str(modelo.classes_[classe_indice])
    confianca=round(float(chances[classe_indice]),4)
    delta=None
    if registro.percentual_atual is not None and registro.percentual_anterior is not None:
        delta=registro.percentual_atual-registro.percentual_anterior
    avisos=[]
    # Alertas independentes: baixa confiança não pode ocultar contradições.
    # Limiares experimentais; revisar contra registros reais anotados.
    if confianca<0.55:
        avisos.append('Relato com baixa confiança do modelo; revisão humana recomendada.')
    if classe=='SEM_EXECUCAO' and delta is not None and delta>0:
        avisos.append('Relato indica ausência de execução, mas o progresso aumentou.')
    if classe=='TRABALHO_EXECUTADO' and delta==0:
        avisos.append('Relato indica trabalho executado, mas o progresso não avançou.')
    if classe=='INDEFINIDO' and delta is not None and delta>=30:
        avisos.append('Avanço elevado sem descrição conclusiva de execução; conferir evidências.')
    return {'classificacao_ia':classe,'score_modelo':confianca,'avisos':avisos,'versao_modelo':_model_version or 'modelo-de-teste',
            'probabilidades':{str(c):round(float(p),4) for c,p in zip(modelo.classes_,chances)}}

@app.get('/saude')
def saude():
    # Readiness precisa comprovar que o artefato é carregável.
    try:
        carregar_modelo()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503,detail='Modelo indisponível ou incompatível.')
    return {'situacao':'ok'}

@app.post('/classificar')
def classificar(registro:Registro):
    return analisar(registro,carregar_modelo())
