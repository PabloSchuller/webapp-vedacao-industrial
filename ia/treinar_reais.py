"""Treina candidato a partir de relatos reais ROTULADOS, sem modelos pré-treinados.

IMPORTANTE: não ativa automaticamente. Exige exemplos diversos de vários galpões.
Não confundir o arquivo usado para TREINO com o conjunto independente de AVALIAÇÃO.

Exemplo:
 python ia/treinar_reais.py --dados avaliacao/coleta/relatos_para_treino.csv

Entrada CSV com colunas: descricao;classe;galpao_id.
Saídas: ia/modelos/modelo_candidato.joblib e metricas_candidato.json.
Após revisão do relatório, a ativação é manual e documentada.
"""
from pathlib import Path
import argparse
import json
import sys
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import GroupShuffleSplit, StratifiedGroupKFold, cross_val_score
from sklearn.metrics import f1_score, classification_report, confusion_matrix

BASE=Path(__file__).resolve().parent
CLASSES=['INDEFINIDO','SEM_EXECUCAO','TRABALHO_EXECUTADO']


def ler_validar(path):
    df=pd.read_csv(path,sep=None,engine='python',encoding='utf-8-sig')
    faltam=set(['descricao','classe','galpao_id'])-set(df.columns)
    if faltam:raise ValueError(f'Colunas ausentes: {sorted(faltam)}. Exporte os rótulos pelo VedaçãoHub.')
    df=df.dropna(subset=['descricao','classe','galpao_id']).copy()
    for c in ['descricao','classe','galpao_id']:
        df[c]=df[c].astype(str).str.strip()
    df=df[df['descricao'].str.len()>=10]
    if not set(df['classe']).issubset(CLASSES):raise ValueError('Classe de registro não reconhecida.')
    # Repetições literais entre grupos artificialmente inflam a métrica.
    df=df.drop_duplicates(subset=['descricao'])
    if len(df)<60 or len(df['galpao_id'].unique())<6 or df['classe'].value_counts().reindex(CLASSES,fill_value=0).min()<12:
        raise ValueError('Base insuficiente: mínimo 60 relatos únicos, 6 galpões e 12 exemplos por classe; não fabrique registros para alcançar isso.')
    return df


def separar(df):
    # Somente Galpões inteiros em treino OU teste. Repetição do mesmo galpão viola a independência.
    for seed in range(42,142):
        tr,te=next(GroupShuffleSplit(n_splits=1,test_size=0.25,random_state=seed).split(df['descricao'],df['classe'],df['galpao_id']))
        a,b=df.iloc[tr],df.iloc[te]
        if min(a['classe'].value_counts().reindex(CLASSES,fill_value=0))>=6 and min(b['classe'].value_counts().reindex(CLASSES,fill_value=0))>=2 and len(a['galpao_id'].unique())>=3:
            return a,b,seed
    raise ValueError('Distribuição por galpão não permite teste independente nas três classes. Diversifique a amostra.')


def treinar(df):
    treino,teste,seed=separar(df)
    vect=lambda: TfidfVectorizer(strip_accents='unicode',ngram_range=(1,2),sublinear_tf=True,min_df=1)
    modelos={
      'logistica':Pipeline([('tfidf',vect()),('modelo',LogisticRegression(max_iter=2000,class_weight='balanced',random_state=42))]),
      'naive_bayes':Pipeline([('tfidf',vect()),('modelo',MultinomialNB(alpha=0.7))]),
      'logistica_caracteres':Pipeline([('tfidf',TfidfVectorizer(strip_accents='unicode',analyzer='char_wb',ngram_range=(3,5))),('modelo',LogisticRegression(max_iter=2000,class_weight='balanced',random_state=42))]),
    }
    cv=StratifiedGroupKFold(n_splits=3,shuffle=True,random_state=42)
    pontuacoes={}
    for nome,modelo in modelos.items():
        try:
            notas=cross_val_score(modelo,treino['descricao'],treino['classe'],groups=treino['galpao_id'],cv=cv,scoring='f1_macro',error_score='raise')
            pontuacoes[nome]=round(float(notas.mean()),4)
        except ValueError:
            raise ValueError('Algumas classes estão concentradas em poucos galpões. Coleta mais diversa é necessária para CV por grupo.')
    nome=max(pontuacoes,key=pontuacoes.get)
    modelo=modelos[nome]
    modelo.fit(treino['descricao'],treino['classe'])
    estimado=modelo.predict(teste['descricao'])
    report={
      'tipo_dados':'reais_rotulados', 'candidato_nao_ativado':True,
      'alerta':'Avaliação interna por galpão, não equivale a validação independente por outra empresa.',
      'registros':len(df),'galpoes':df['galpao_id'].nunique(),
      'treino':len(treino),'teste':len(teste),'semente_separacao':seed,
      'galpoes_treino':len(treino['galpao_id'].unique()),'galpoes_teste':len(teste['galpao_id'].unique()),
      'modelo_escolhido':nome,'f1_cv_por_galpao':pontuacoes,
      'f1_macro_teste':round(float(f1_score(teste['classe'],estimado,labels=CLASSES,average='macro',zero_division=0)),4),
      'matriz_confusao':confusion_matrix(teste['classe'],estimado,labels=CLASSES).tolist(),
      'relatorio':classification_report(teste['classe'],estimado,labels=CLASSES,output_dict=True,zero_division=0),
      'nota':'Evite usar registros do teste para ajustar o modelo. Antes de implantação, testar em período ou galpões ainda não observados.'
    }
    return modelo,report


def main():
    arg=argparse.ArgumentParser()
    arg.add_argument('--dados',required=True,help='Arquivo CSV real com descricao;classe;galpao_id')
    a=arg.parse_args()
    df=ler_validar(Path(a.dados))
    modelo,report=treinar(df)
    pasta=BASE/'modelos';pasta.mkdir(exist_ok=True)
    joblib.dump(modelo,pasta/'modelo_candidato.joblib')
    (pasta/'metricas_candidato.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k not in ('relatorio','matriz_confusao')},ensure_ascii=False,indent=2))
    print('CANDIDATO gerado. O modelo em uso NÃO foi substituído. Leia as métricas antes de ativá-lo.')

if __name__=='__main__':
    try:main()
    except (ValueError,FileNotFoundError) as e:sys.exit(str(e))
