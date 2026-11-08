"""Treina e compara classificadores a partir de dados rotulados no projeto.

As métricas são EXPLORATÓRIAS se o corpus for sintético. Não se deve apresentá-las
como comprovação de desempenho operacional ou da meta de consistência de 95%.
"""
from pathlib import Path
import json
import re
import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline

BASE = Path(__file__).resolve().parent
DADOS = BASE / 'dados' / 'visitas_sinteticas.csv'
MODELO = BASE / 'modelos' / 'modelo.joblib'
METRICAS = BASE / 'modelos' / 'metricas_sinteticas.json'
CLASSES = ['INDEFINIDO', 'SEM_EXECUCAO', 'TRABALHO_EXECUTADO']
SEMENTE = 42


def baseline(descricao):
    t = descricao.lower()
    if re.search(r'nenhum|nenhuma|não (houve|foi|inici|realiz)|paralis|cancelad|aguard|falta de material|sem execução', t):
        return 'SEM_EXECUCAO'
    if re.search(r'instalad|aplicad|executad|conclu|finaliz|substitu|repar|vedad|corrigid', t):
        return 'TRABALHO_EXECUTADO'
    return 'INDEFINIDO'


def candidatos():
    words=lambda: TfidfVectorizer(lowercase=True,strip_accents='unicode',ngram_range=(1,2),sublinear_tf=True)
    return {
        'regressao_logistica_palavras': Pipeline([('tfidf',words()),('modelo',LogisticRegression(max_iter=2000,class_weight='balanced',random_state=SEMENTE))]),
        'naive_bayes_palavras': Pipeline([('tfidf',words()),('modelo',MultinomialNB(alpha=0.7))]),
        'regressao_logistica_caracteres': Pipeline([('tfidf',TfidfVectorizer(strip_accents='unicode',analyzer='char_wb',ngram_range=(3,5),sublinear_tf=True)),('modelo',LogisticRegression(max_iter=2000,class_weight='balanced',random_state=SEMENTE))]),
        'linear_svc_calibrado': Pipeline([('tfidf',words()),('modelo',CalibratedClassifierCV(LinearSVC(class_weight='balanced',random_state=SEMENTE),cv=3))]),
    }


def executar():
    df = pd.read_csv(DADOS).dropna(subset=['descricao','classe'])
    df['descricao'] = df['descricao'].astype(str).str.strip()
    df = df[df['descricao'].str.len() >= 10].drop_duplicates(subset=['descricao'])
    if len(df)<30 or df['classe'].value_counts().reindex(CLASSES,fill_value=0).min()<5:
        raise ValueError('Necessárias no mínimo 30 descrições e 5 itens por classe.')
    if not set(df['classe']).issubset(CLASSES):
        raise ValueError('Foram encontradas classes inesperadas.')

    # Divisão de teste antes da escolha do modelo. O conjunto de teste permanece intocado.
    xt,xv,yt,yv = train_test_split(df['descricao'],df['classe'],test_size=0.25,random_state=SEMENTE,stratify=df['classe'])
    cv=StratifiedKFold(n_splits=3,shuffle=True,random_state=SEMENTE)
    modelos=candidatos()
    resultados_cv={}
    for nome,modelo in modelos.items():
        escores=cross_val_score(modelo,xt,yt,scoring='f1_macro',cv=cv,n_jobs=1)
        resultados_cv[nome]={'f1_macro_media':round(float(escores.mean()),4),'desvio_padrao':round(float(escores.std()),4),'dobras':[round(float(s),4) for s in escores]}
    melhor_nome=max(resultados_cv,key=lambda nome:resultados_cv[nome]['f1_macro_media'])
    modelo=modelos[melhor_nome]
    modelo.fit(xt,yt)
    previsoes=modelo.predict(xv)
    baseline_previsoes=[baseline(t) for t in xv]
    relatorio={
        'aviso':'MÉTRICAS EXPLORATÓRIAS, base de dados sintéticos. Não representam validação real com clientes.',
        'tipo_dados':'sinteticos', 'semente':SEMENTE,
        'registros':len(df),'treino':len(xt),'teste':len(xv),
        'modelo_selecionado':melhor_nome,
        'selecao':'3-fold CV apenas no treino por F1 macro; avaliação final no conjunto de teste separado',
        'comparacao_cv':resultados_cv,
        'acuracia_ia':round(float(accuracy_score(yv,previsoes)),4),
        'f1_macro_ia':round(float(f1_score(yv,previsoes,average='macro')),4),
        'f1_macro_baseline_palavras_chave':round(float(f1_score(yv,baseline_previsoes,average='macro')),4),
        'classes':CLASSES,
        'matriz_confusao':confusion_matrix(yv,previsoes,labels=CLASSES).tolist(),
        'relatorio_por_classe':classification_report(yv,previsoes,labels=CLASSES,output_dict=True,zero_division=0),
        'nota_metodologica':'Somente relatos sintéticos; coleta real precisa de termo de autorização, anonimização e divisão por galpão ou período.'
    }
    MODELO.parent.mkdir(parents=True,exist_ok=True)
    joblib.dump(modelo,MODELO)
    METRICAS.write_text(json.dumps(relatorio,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in relatorio.items() if k not in {'relatorio_por_classe','matriz_confusao'}},ensure_ascii=False,indent=2))
    return relatorio

if __name__=='__main__': executar()
