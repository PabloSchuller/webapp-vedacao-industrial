# Visitas por serviços e materiais

Em **Registrar visita**, selecione a situação e escreva o relato. Detalhe nele quantidades de serviço, locais, atividades, materiais, impedimentos e observações. Em **Sem execução**, o próprio relato informa o motivo.

As listas são opcionais. Cada serviço adicionado exige apenas **Nome do serviço**, por exemplo “Aplicação de P.U.” ou “Limpeza das gretas”. Para materiais utilizados, restantes e necessários, informe **Nome** e **Quantidade**. O saldo restante aceita zero. Consumo e necessidade exigem valores positivos. As quantidades seguem o controle da empresa, sem conversão.

## Contrato da API

`POST /visitas/validar` e `POST /visitas` aceitam o mesmo corpo. Exemplo de execução:

```json
{
  "galpaoId": "00000000-0000-4000-8000-000000000001",
  "dataVisita": "2026-11-08",
  "descricao": "A equipe montou quatro placas na parede norte. O acesso à fachada leste estava bloqueado.",
  "registroFisico": {
    "situacao": "TRABALHO_EXECUTADO",
    "servicos": [{"nome":"Montagem de placas"}],
    "materiaisUtilizados": [{"nome":"Selante", "quantidade":1.5}],
    "materiaisRestantes": [{"nome":"Placas", "quantidade":0}],
    "materiaisNecessarios": [{"nome":"Viga de apoio", "quantidade":2}]
  }
}
```

As listas omitidas são vazias. Em `SEM_EXECUCAO` ou `INDEFINIDO`, a lista de serviços confirmados deve estar vazia. O relato tem de 10 a 3.000 caracteres e segue para a classificação textual. Cada lista aceita até 100 itens dentro do limite geral do corpo HTTP de 100 KB.

O histórico, a revisão e o relatório imprimível exibem os itens. O CSV de visitas mantém as colunas antigas e acrescenta `registro_fisico_json`. Em visitas físicas, os dois percentuais legados são nulos. Aprovação e rejeição preservam as medições informadas. A situação cadastral do galpão pode ser alterada pelo responsável e fica na auditoria. Continuam valendo as regras de data, autorização, GPS e revisão pendente.

Clientes antigos podem enviar exclusivamente o formato com `progressoDepois`; nesse caso continuam valendo as regras legadas. Misturar percentual e `registroFisico` retorna HTTP 400. Para leitura, `registroFisico` nulo identifica o histórico anterior. As visitas antigas conservam os valores originais.

## PostgreSQL

O campo JSONB `Visita.registroFisico` já contém os dados necessários. A simplificação não requer SQL nem alteração de schema. O histórico e a impressão exibem quantidades, unidades, motivos e impedimentos existentes nas visitas antigas. O CSV conserva o JSON original.

## IA e avaliação

O classificador scikit-learn recebe o texto do relato. No fluxo físico, a inferência dispensa percentuais. Divergência entre a situação declarada e a classe estimada sinaliza revisão humana. A IA não altera quantidades ou o saldo. A situação declarada, a previsão e o rótulo humano para avaliação continuam distintos.

A avaliação externa usa relatos anonimizados, rotulados por pessoa antes de consultar a previsão, nas classes `TRABALHO_EXECUTADO`, `SEM_EXECUCAO` e `INDEFINIDO`. O responsável pode rotular relatos e exportar o CSV de relatos rotulados. Separe treino e avaliação por galpão ou período e preencha `avaliacao/coleta/relatos_reais_rotulados.csv` apenas com os relatos reservados. O script calcula acurácia, F1 macro, métricas por classe e matriz de confusão na ordem explicitada na saída. As situações informadas na visita e as previsões automáticas não são substitutos da rotulagem independente.

Crie a pasta privada `avaliacao/coleta` e copie para ela os cabeçalhos de `avaliacao/modelos`, removendo o sufixo `.example`. Para avaliar localmente, construa uma imagem e execute o script com os arquivos privados:

```powershell
docker build -t vedacaohub42-ia ./ia
docker run --rm --network none -e PYTHONPATH=/app -e VEDACAO_MODELO_IA=/app/modelos/modelo.joblib -v "${PWD}/avaliacao:/avaliacao" vedacaohub42-ia python /avaliacao/avaliar_ia_real.py
```

Na execução de 08/11/2026, o conjunto real estava vazio. Os cenários de execução, ausência e indefinição foram exercitados com dados de teste.
