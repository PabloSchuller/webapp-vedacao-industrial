"""Avaliação externa do conjunto de treinamento: nunca treina nos relatos avaliados.

Para teste com relatos REAIS e anonimizados, preencher
avaliacao/coleta/relatos_reais_rotulados.csv e executar:
python avaliacao/avaliar_ia_real.py
"""
from pathlib import Path
import csv
import json
import sys
import os
import joblib
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

BASE=Path(__file__).resolve().parent
IA=BASE.parent/'ia'
DADOS=BASE/'coleta'/'relatos_reais_rotulados.csv'
CLASSES=['INDEFINIDO','SEM_EXECUCAO','TRABALHO_EXECUTADO']

# Adicionar pasta da IA antes de importar os helpers de treinamento.
sys.path.insert(0,str(IA))
from treinar import baseline

with DADOS.open(encoding='utf-8-sig',newline='') as fp:
    dados=[(r['descricao'].strip(),r['classe'].strip()) for r in csv.DictReader(fp) if r['descricao'].strip()]
if not dados:
    print('Ainda não há relatos reais rotulados. Nenhuma métrica real foi calculada.')
    raise SystemExit(0)
if any(c not in CLASSES for _,c in dados):raise SystemExit('Classe inválida: escolha uma das 3 classes definidas no projeto.')
if len(dados)<20:print('ATENÇÃO: menos de 20 registros; estimativas são muito instáveis.')
modelo=joblib.load(Path(os.environ.get('VEDACAO_MODELO_IA', IA/'modelos'/'modelo.joblib')))  # somente arquivo do próprio projeto
pred=modelo.predict([d for d,_ in dados]); y=[c for _,c in dados]
saida={
    'tipo_dados':'reais_rotulados',
    'independencia_do_treino':'deve_ser_comprovada_pelo_protocolo_de_coleta',
    'amostras':len(dados),
    'ordem_classes':CLASSES,
    'amostras_por_classe':{classe:y.count(classe) for classe in CLASSES},
    'acuracia':round(float(accuracy_score(y,pred)),4),
    'f1_macro':round(float(f1_score(y,pred,labels=CLASSES,average='macro',zero_division=0)),4),
    'f1_macro_baseline':round(float(f1_score(y,[baseline(d) for d,_ in dados],labels=CLASSES,average='macro',zero_division=0)),4),
    'matriz_confusao':confusion_matrix(y,pred,labels=CLASSES).tolist(),
    'relatorio_classes':classification_report(y,pred,labels=CLASSES,output_dict=True,zero_division=0),
    'observacao':'Rotulagem deve ocorrer antes da previsão, sem consultar a saída do modelo; separar galpões ou períodos para evitar vazamento.'
}
( BASE/'metricas_ia_reais.json').write_text(json.dumps(saida,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in saida.items() if k!='relatorio_classes'},ensure_ascii=False,indent=2))
