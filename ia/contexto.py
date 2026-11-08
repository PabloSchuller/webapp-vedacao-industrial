"""Marcas de contexto para o TF-IDF; o peso de cada marca é aprendido no treino."""
import re
import unicodedata

ACAO = r'(?:aplicamos|fizemos|(?:foi|foram)\s+feit[oa]s?|passamos|vedamos|montamos|limpamos|alinhamos|selamos|executamos|terminamos|concluimos|instalamos)'
NEGACAO = r'\b(?:nao|nem|nada|nenhum[a]?)\b'


def normalizar(descricao):
    texto = unicodedata.normalize('NFKD', descricao.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'\bp\.\s*u\b\.?', 'pu', texto)


def marcar_contexto(descricao):
    texto = normalizar(descricao)
    marcas = []
    for trecho in re.split(r'[,.;!?]|\b(?:mas|porem|porque)\b', texto):
        for verbo in re.finditer(r'\b' + ACAO + r'\b', trecho):
            antes = trecho[:verbo.start()].split()[-4:]
            negada = re.search(NEGACAO, ' '.join(antes)) or re.match(r'\s+(?:nada|nenhum)', trecho[verbo.end():])
            marcas.append('acao_negada' if negada else 'acao_realizada')
        if re.search(r'\b(?:restam|sobraram|faltam|restante)\b', trecho):
            marcas.append('saldo_pendente')
    return texto + ' ' + ' '.join(marcas)


def evidencia_servicos(descricao, servicos):
    """Só corrobora execução afirmada no texto. Serviço selecionado sozinho não basta."""
    if not servicos:
        return False, None
    texto = normalizar(descricao)
    incerto = re.search(r'\b(?:talvez|se|sera|ontem|anteriormente|sem confirmacao|nao sei|nao sabemos|parece|segundo)\b|\?', texto)
    marcas = marcar_contexto(texto).split()
    familias = (r'\bpu\b|\bselante', r'\blimp', r'\balinh', r'\btarucel', r'\bmont', r'\bved')
    for trecho in re.split(r'[,.;!?]|\b(?:mas|porem)\b', texto):
        negacao_de_servico = re.search(r'\b(?:nao|nem|sem)\s+(?:(?:foi|foram|deu para|conseguimos)\s+)?(?:aplic|pass|realiz|execut|limp|alinh|mont|ved|sel|faz|fiz|feit|instal|coloc)', trecho)
        adiado = re.search(r'\b(?:adiad\w*|ficou para|ficou pra|so amanha)\b', trecho)
        if negacao_de_servico or adiado:
            if any(re.search(p, trecho) and any(re.search(p, normalizar(s)) for s in servicos) for p in familias):
                return False, 'Confira o serviço cadastrado e a negação presente no relato.'
    if ('acao_negada' in marcas and 'acao_realizada' not in marcas) or re.search(
            r'\b(?:nada (?:foi )?feito|nao houve (?:trabalho|execucao|servico)|sem execucao|nenhum servico|nao conseguimos (?:iniciar|trabalhar))\b', texto):
        return False, 'Há serviço cadastrado, mas o relato indica ausência de execução.'
    if incerto or ('saldo_pendente' in marcas and 'acao_realizada' not in marcas
                   and not re.search(r'\b(?:instalad|aplicad|concluid|executad)\w*', texto)):
        return False, 'O relato não confirma com clareza o serviço cadastrado.'
    quantidade_executada = re.search(r'\b(?:feit[oa]s?|fizemos)\s+(?:\d+|uma?|duas|dois|tres)\s+(?:placas?|paredes?|vigas?|pilares?)\b', texto)
    compativel = all(any(re.search(p, normalizar(s)) and re.search(p, texto) for p in familias) for s in servicos)
    return bool('acao_realizada' in marcas and not re.search(NEGACAO, texto)
                and (compativel or quantidade_executada)), None
