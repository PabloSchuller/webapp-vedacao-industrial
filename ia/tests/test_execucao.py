import pytest
from api import Registro, analisar, carregar_modelo

SERVICO = 'Aplicação de P.U.'
INCIDENTE = 'Foi feito 24 placas das 30 que faltam, sobraram 6 placas para fazer.'


@pytest.mark.parametrize('texto,esperada', [
    (INCIDENTE, 'TRABALHO_EXECUTADO'),
    ('Foram feitas 24 placas', 'TRABALHO_EXECUTADO'),
    ('Aplicamos P.U.', 'TRABALHO_EXECUTADO'),
    ('Fizemos três paredes', 'TRABALHO_EXECUTADO'),
    ('Restam seis placas', 'INDEFINIDO'),
    ('Não aplicamos P.U. por falta de material.', 'SEM_EXECUCAO'),
])
def test_previsao_do_modelo(texto, esperada):
    assert carregar_modelo().predict([texto])[0] == esperada


@pytest.mark.parametrize('texto', [
    'Não aplicamos P.U. por falta de material.',
    'Limpamos as gretas, mas não aplicamos P.U.',
    'Não sei se aplicamos o PU na segunda parede.',
    'Restam seis placas para fazer.',
    'Limpamos as gretas mas o PU ficou para amanhã.',
])
def test_servico_sozinho_nao_confirma_execucao(texto):
    resultado = analisar(Registro(descricao=texto, servicos=[SERVICO]), carregar_modelo())
    assert not resultado['execucao_corroborada']
    assert resultado['avisos']


def test_evidencias_coerentes_preservam_score_bruto():
    from test_api import ModeloFalso
    resultado = analisar(Registro(descricao=INCIDENTE, servicos=[SERVICO]), ModeloFalso())
    assert resultado['classificacao_ia'] == 'SEM_EXECUCAO'
    assert resultado['score_modelo'] == 0.45
    assert resultado['execucao_corroborada'] and not resultado['avisos']
    assert analisar(Registro(descricao=INCIDENTE), ModeloFalso())['avisos']
