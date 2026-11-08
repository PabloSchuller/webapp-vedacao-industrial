"""Avalia um artefato local confiável nos mesmos dois conjuntos, sem retreinar.

No contêiner de cada revisão, com avaliacao montado em /avaliacao:
python /avaliacao/comparar_execucao.py /app/modelos/modelo.joblib
"""
import argparse
from pathlib import Path
import sys

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

raiz = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(raiz / 'ia' if (raiz / 'ia').is_dir() else Path('/app')))
from treinar import baseline, CLASSES, DADOS, SEMENTE


def comparar(artefato):
    modelo = joblib.load(artefato)
    original = pd.read_csv(DADOS)
    treino, teste = train_test_split(original, test_size=.25, random_state=SEMENTE, stratify=original.classe)
    campo = pd.read_csv(Path(__file__).parent / 'modelos/teste_campo_sintetico.csv')
    complemento = DADOS.with_name('complemento_treino.csv')
    conhecidos = set(original.descricao)
    if complemento.exists():
        conhecidos.update(pd.read_csv(complemento).descricao)
    if conhecidos.intersection(campo.descricao) or campo.descricao.duplicated().any():
        raise ValueError('Sobreposição no teste de campo sintético.')
    for nome, dados in [('holdout original', teste), ('linguagem de campo sintética', campo)]:
        for sistema, previsto in [('baseline', dados.descricao.map(baseline)), ('modelo', modelo.predict(dados.descricao))]:
            acertos = accuracy_score(dados.classe, previsto, normalize=False)
            f1 = f1_score(dados.classe, previsto, labels=CLASSES, average='macro', zero_division=0)
            print(f'{nome}: {sistema}: {acertos}/{len(dados)}, F1 macro {f1:.4f}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('artefato', type=Path)
    comparar(parser.parse_args().artefato)
