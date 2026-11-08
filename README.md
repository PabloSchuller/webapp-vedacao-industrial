# VedaçãoHub

Aplicação de gestão de obras de vedação industrial do curso de Engenharia de Software da Católica de Santa Catarina. Cada galpão reúne localização, histórico de visitas, fotos e autoria das alterações.

A equipe pode listar serviços pelo nome e materiais utilizados, restantes ou necessários pelo nome e quantidade. Locais, quantidades dos serviços e impedimentos ficam no relato da visita. Uma visita sem execução guarda o motivo. O histórico recupera também os percentuais informados por versões anteriores. [Contrato das visitas físicas](docs/visitas_fisicas.md)

## Arquitetura

| Componente | Responsabilidade |
|---|---|
| React e Vite | Interface de cadastro, visitas e revisão humana |
| React Leaflet e OpenStreetMap | Marcação e recuperação da localização. A API consulta Nominatim por busca explícita, com cache e limitação de frequência |
| Express e Prisma | Autenticação JWT, autorização por perfil, regras de validação, auditoria e persistência |
| PostgreSQL | Galpões, visitas, materiais registrados, usuários, rótulos e fotos |
| FastAPI e scikit-learn | Inferência local sobre os relatos. As classes são execução, ausência de execução e situação indefinida |

O Docker treina o classificador com o CSV sintético incluído no projeto. A avaliação com dados reais depende de relatos anonimizados e rotulados independentemente. O serviço registra alertas para revisão humana.

## Testar a partir de um clone

Com Node.js 22.12+ e Docker Compose v2, execute na raiz:

```sh
node scripts/ci.mjs
```

O comando constrói as imagens, gera credenciais temporárias, cria um projeto Docker com PostgreSQL em memória e executa pytest, ESLint, testes Node e React, integração HTTP e o build Vite. Os testes da API passam pelo Express e gravam no PostgreSQL isolado. Os testes React de interação usam DOM de teste e respostas HTTP controladas.

O limite global de cobertura de **linhas** é 75% no backend Express e 25% no frontend React. O backend inclui `api/src/**/*.js` e os scripts JS do Prisma. O frontend inclui todos os JS e JSX de `web/src/`. Arquivos sem execução entram no denominador. A suíte Python é informada separadamente. Consulte `api/coverage/index.html` e `web/coverage/react/index.html` após a execução. Cada diretório contém também LCOV e o resumo JSON. O GitHub Actions usa o mesmo comando em pushes e pull requests.

## Executar em instalação local nova

1. Copie `.env.example` para `.env`. Preencha `POSTGRES_PASSWORD` e `JWT_SECRET` com valores aleatórios independentes. Use 32 bytes aleatórios em hexadecimal para cada um. Defina `CORS_ORIGIN=http://localhost:5173`.
2. Execute `docker compose build` e `docker compose up -d --wait postgres`.
3. Para o banco **novo e vazio**, execute `docker compose run --rm --no-deps api npx prisma migrate deploy`. Para um banco preexistente, confira o histórico Prisma e faça backup antes de qualquer migração. [Contrato de visitas e histórico](docs/visitas_fisicas.md)
4. Disponibilize `ADMIN_EMAIL` e `ADMIN_PASSWORD` no ambiente do terminal. Execute `docker compose run --rm --no-deps -e ADMIN_EMAIL -e ADMIN_PASSWORD api node prisma/bootstrap-admin.js`. Use uma senha exclusiva e remova as duas variáveis do terminal ao terminar.
5. Execute `docker compose up -d --wait` e abra http://localhost:5173. O ambiente local usa portas em loopback. O seed demonstrativo é explícito.

O uso do Nominatim público exige uma única instância da API para o limite global de uma busca por segundo, identificação da aplicação, atribuição e cache. Pesquise endereços públicos e evite dados confidenciais. [Política de uso](https://operations.osmfoundation.org/policies/nominatim/)

## Publicação em nuvem

O arquivo `docker-compose.prod.example.yml` documenta serviços e suas configurações. A publicação do sistema exige provisionamento e validação em ambiente próprio. [Avaliação de implantação](docs/nuvem.md)
