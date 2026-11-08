# Validação de execução parcial

A imagem local da revisão anterior reproduziu o incidente com 0,8391 para SEM_EXECUCAO. O TF-IDF de palavras reconheceu apenas “das”, “fazer”, “feito”, “foi”, “foi feito”, “para” e “para fazer”. No corpus anterior, “foi feito” ocorria em negações. A comparação da API com a situação selecionada gerava um aviso a cada divergência, independentemente dos serviços cadastrados.

Foram acrescentados 40 exemplos sintéticos exclusivos de treino. A divisão original foi preservada e a seleção entre candidatos continuou usando F1 macro em três dobras no treino. O pré-processamento normaliza P.U. e identifica ações afirmadas, negadas e expressões de saldo. O candidato selecionado foi regressão logística sobre TF-IDF de caracteres. O modelo bruto atribuiu 0,4938 a TRABALHO_EXECUTADO no incidente. A validação da API retornou APROVAR com o serviço informado. O histórico conserva a classe e o score do modelo. O serviço estruturado corrobora uma ação descrita e permite dispensar o alerta isolado do modelo. Uma negação explícita da aplicação de PU gerou REVISAR mesmo com outro serviço executado.

## Comparação dos classificadores textuais

| Conjunto sintético | Baseline de palavras-chave | Modelo anterior | Modelo novo |
|---|---:|---:|---:|
| Teste original, 23 relatos | 19 acertos; F1 macro 0,8148 | 18; 0,7798 | 14; 0,5909 |
| Linguagem de campo, 18 relatos novos (6 por classe) | 6 acertos; F1 macro 0,1667 | 8; 0,4459 | 12; 0,6370 |

O conjunto de campo foi reservado antes das alterações. O relato do incidente integra o teste de regressão e ficou fora das métricas comparativas. Não houve ajuste posterior com base nos resultados desses dois conjuntos. Os números medem a classificação textual em exemplos sintéticos. A regressão no conjunto original limita a conclusão sobre generalização. A taxa de falsos alertas em visitas reais permanece desconhecida.

Para reproduzir com cada imagem de IA, monte a pasta `avaliacao` desta revisão em `/avaliacao` como somente leitura e execute `python /avaliacao/comparar_execucao.py /app/modelos/modelo.joblib`. A referência anterior é o commit `5203d50`.

## Verificação local

A suíte Docker passou com 25 testes Python, 52 entradas aprovadas no executor da API (incluindo o agrupador de integração), 14 testes Node e 3 Vitest no frontend. Cobertura de linhas de 91,28% na API e 48,32% no frontend. ESLint e build de produção passaram. O teste integrado usou Express, o serviço scikit-learn e um PostgreSQL temporário em um projeto Compose exclusivo. Nenhum dado operacional foi lido ou reclassificado.
