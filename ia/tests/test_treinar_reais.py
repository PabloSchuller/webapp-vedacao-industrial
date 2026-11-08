from pathlib import Path
import pandas as pd
import pytest
from treinar_reais import ler_validar

def test_exige_diversidade_de_dados_reais(tmp_path):
    p=tmp_path/'dados.csv'
    p.write_text('descricao;classe;galpao_id\nNenhuma obra ocorreu;SEM_EXECUCAO;galpao1\n',encoding='utf8')
    with pytest.raises(ValueError,match='insuficiente'):
        ler_validar(p)

def test_rejeita_csv_sem_rotulo(tmp_path):
    p=tmp_path/'dados.csv'
    p.write_text('descricao;classe\nNenhuma obra ocorreu;SEM_EXECUCAO\n',encoding='utf8')
    with pytest.raises(ValueError,match='Colunas ausentes'):
        ler_validar(p)
