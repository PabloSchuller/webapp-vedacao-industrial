"""Calcula as metas do TCC apenas com medições coletadas de verdade.

Execute: python avaliacao/calcular_metricas.py
Arquivos sem linhas de dados geram resultado 'não medido'.
"""
import csv
import json
from pathlib import Path

BASE=Path(__file__).resolve().parent
COLETA=BASE/'coleta'
DESTINO=BASE/'resultado_validacao.json'


def ler(nome):
    with (COLETA/nome).open(newline='',encoding='utf-8-sig') as fp:
        return list(csv.DictReader(fp))


def numeros_entre(val,menor,maior,campo):
    try: n=float(val)
    except (ValueError,TypeError):raise ValueError(f'{campo}: informe um número.')
    if not menor<=n<=maior:raise ValueError(f'{campo}: precisa estar entre {menor} e {maior}.')
    return n


def tempo(registros):
    if not registros:return {'estado':'nao_medido','amostras':0}
    pares=[]
    for i,r in enumerate(registros,2):
        a=numeros_entre(r['tempo_antes_seg'],0.001,999999,f'tempo antes linha {i}')
        d=numeros_entre(r['tempo_depois_seg'],0.001,999999,f'tempo depois linha {i}')
        pares.append((a,d))
    reducao=100*(1-sum(d for _,d in pares)/sum(a for a,_ in pares))
    return {'estado':'medido','amostras':len(pares),'media_antes_seg':round(sum(a for a,_ in pares)/len(pares),2),
            'media_depois_seg':round(sum(d for _,d in pares)/len(pares),2),
            'reducao_percentual':round(reducao,2),'meta_50_atingida':reducao>=50}


def sus(registros):
    if not registros:return {'estado':'nao_medido','participantes':0}
    notas=[]
    for i,r in enumerate(registros,2):
        respostas=[numeros_entre(r[f'q{j}'],1,5,f'SUS linha {i} q{j}') for j in range(1,11)]
        if any(n!=int(n) for n in respostas):raise ValueError(f'SUS linha {i}: respostas precisam ser inteiras de 1 a 5.')
        notas.append(2.5*sum((n-1 if j%2 else 5-n) for j,n in enumerate(respostas,1)))
    media=sum(notas)/len(notas)
    return {'estado':'medido','participantes':len(notas),'pontuacoes':[round(n,2) for n in notas],
            'sus_medio':round(media,2),'meta_70_atingida':media>=70}


def consistencia(registros):
    if not registros:return {'estado':'nao_medido','amostras':0}
    valores=[]
    for i,r in enumerate(registros,2):
        x=str(r['consistente']).strip()
        if x not in {'0','1'}:raise ValueError(f'consistência linha {i}: use 1 (válido) ou 0 (inconsistente).')
        valores.append(int(x))
    resultado=100*sum(valores)/len(valores)
    return {'estado':'medido','amostras':len(valores),'consistentes':sum(valores),
            'consistencia_percentual':round(resultado,2),'meta_acima_95_atingida':resultado>95}


def calcular():
    return {'observacao':'Resultados descritivos, não independentes; empresa pertence ao pesquisador. Dados não preenchidos não contam como meta atingida.',
            'tempo_localizacao':tempo(ler('tempos_localizacao.csv')),
            'sus':sus(ler('questionario_sus.csv')),
            'consistencia_dados':consistencia(ler('auditoria_consistencia.csv'))}


if __name__=='__main__':
    resultado=calcular()
    DESTINO.write_text(json.dumps(resultado,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(resultado,ensure_ascii=False,indent=2))
