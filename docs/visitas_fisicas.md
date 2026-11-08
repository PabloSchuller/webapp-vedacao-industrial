# Visitas por serviços e materiais

Na tela do galpão, escolha **Registrar visita** e informe a situação observada. Em **Com execução**, registre pelo menos um serviço, por exemplo “Montagem de placas”, quantidade 4, unidade “un”. Paredes, vigas e pilares podem ser descritos da mesma forma, na unidade usada pela equipe. Em **Sem execução**, registre o motivo no próprio relato. **Execução indefinida** permite documentar uma vistoria em que ainda não foi possível determinar se houve serviço.

As listas de materiais utilizados, restantes e necessários são independentes. Cada linha guarda nome, quantidade e unidade. Um saldo restante pode ser zero. Serviços, consumo e necessidades exigem quantidades positivas. Impedimentos e próximos passos são campos de texto opcionais. O saldo é o observado na visita, sem dedução automática nem conversão entre unidades.

## Contrato da API

`POST /visitas/validar` e `POST /visitas` aceitam o mesmo corpo. Exemplo de execução:

```json
{
  "galpaoId": "00000000-0000-4000-8000-000000000001",
  "dataVisita": "2026-11-08",
  "descricao": "A equipe montou quatro placas na parede norte.",
  "registroFisico": {
    "situacao": "TRABALHO_EXECUTADO",
    "servicos": [{"nome":"Montagem de placas", "quantidade":4, "unidade":"un"}],
    "materiaisUtilizados": [{"nome":"Selante", "quantidade":1.5, "unidade":"kg"}],
    "materiaisRestantes": [{"nome":"Placas", "quantidade":0, "unidade":"un"}],
    "materiaisNecessarios": [{"nome":"Viga de apoio", "quantidade":2, "unidade":"un"}],
    "impedimentos": "Acesso bloqueado à fachada leste."
  }
}
```

As listas omitidas são vazias. A situação `SEM_EXECUCAO` exige `motivo` e uma lista de serviços vazia. No formulário, o motivo também fornece a descrição textual à IA, com uma única digitação. O relato tem de 10 a 3.000 caracteres, limitado a 2.000 quando usado como motivo. Em `INDEFINIDO`, os materiais e impedimentos podem ser preenchidos, mantendo vazia a lista de serviços confirmados. Cada lista aceita até 100 itens, observando também o limite geral do corpo HTTP de 100 KB.

O histórico, a revisão e o relatório imprimível exibem os itens. O CSV de visitas mantém as colunas antigas e acrescenta `registro_fisico_json`. Em visitas físicas, os dois percentuais legados são nulos. Aprovação e rejeição preservam as medições informadas. A situação cadastral do galpão pode ser alterada pelo responsável e fica na auditoria. Continuam valendo as regras de data, autorização, GPS e revisão pendente.

Clientes antigos podem enviar exclusivamente o formato com `progressoDepois`; nesse caso continuam valendo as regras legadas. Misturar percentual e `registroFisico` retorna HTTP 400. Para leitura, `registroFisico` nulo identifica o histórico anterior. As visitas antigas conservam os valores originais.

## PostgreSQL

A migração `api/prisma/migrations/20261108000000_registro_fisico/migration.sql` acrescenta uma coluna JSONB opcional e torna opcionais os dois campos percentuais da visita. O modelo continua usando os mesmos IDs, relações e registros. A migração cabe em uma transação e dispensa atualização em massa.

Em banco que já usa Prisma Migrate, faça backup antes de `prisma migrate deploy`. A instalação local existente usava `db push` e não tinha histórico Prisma. Nela foi aplicado somente o SQL dessa migração após o backup. Para uma instalação equivalente que **ainda não recebeu essa coluna**, execute na raiz:

```powershell
$ErrorActionPreference = 'Stop'
docker compose up -d --wait postgres
if ($LASTEXITCODE) { throw 'PostgreSQL indisponível' }
& ./scripts/backup_windows.ps1
docker compose build api ia web
if ($LASTEXITCODE) { throw 'Falha na construção' }
Get-Content -Raw api/prisma/migrations/20261108000000_registro_fisico/migration.sql |
  docker compose exec -T postgres psql -X --single-transaction -v ON_ERROR_STOP=1 -U vedacao -d vedacao -f -
if ($LASTEXITCODE) { throw 'Migração não aplicada' }
docker compose up -d --no-build --wait
```

## IA e avaliação

O classificador scikit-learn recebe o texto do relato. No fluxo físico, a inferência dispensa percentuais. Divergência entre a situação declarada e a classe estimada sinaliza revisão humana. A IA não altera quantidades ou o saldo. A situação declarada, a previsão e o rótulo humano para avaliação continuam distintos.

A avaliação externa usa relatos anonimizados, rotulados por pessoa antes de consultar a previsão, nas classes `TRABALHO_EXECUTADO`, `SEM_EXECUCAO` e `INDEFINIDO`. O responsável pode rotular relatos e exportar o CSV de relatos rotulados. Separe treino e avaliação por galpão ou período e preencha `avaliacao/coleta/relatos_reais_rotulados.csv` apenas com os relatos reservados. O script calcula acurácia, F1 macro, métricas por classe e matriz de confusão na ordem explicitada na saída. As situações informadas na visita e as previsões automáticas não são substitutos da rotulagem independente.

Crie a pasta privada `avaliacao/coleta` e copie para ela os cabeçalhos de `avaliacao/modelos`, removendo o sufixo `.example`. Para avaliar localmente, construa uma imagem e execute o script com os arquivos privados:

```powershell
docker build -t vedacaohub42-ia ./ia
docker run --rm --network none -e PYTHONPATH=/app -e VEDACAO_MODELO_IA=/app/modelos/modelo.joblib -v "${PWD}/avaliacao:/avaliacao" vedacaohub42-ia python /avaliacao/avaliar_ia_real.py
```

Na execução de 08/11/2026, o conjunto real estava vazio. Os cenários de execução, ausência e indefinição foram exercitados com dados de teste.
