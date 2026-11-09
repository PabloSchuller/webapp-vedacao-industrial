# Auditoria da linha Web Apps

Base auditada: main `dcb7272`. Implementação e testes da correção: `82d61a9`. Data local: 08/11/2026, São Paulo. A conclusão técnica permanece parcial até a primeira entrega automática em produção e a coleta das evidências acadêmicas abaixo. [Diretriz da linha](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-webapp.md) · [Núcleo comum](https://github.com/CatolicaSC-Portfolio/The-Portfolio-Playbook/blob/main/directions/portfolio-directions-GERAL.md)

| Obrigação | Evidência observada e limite |
|---|---|
| Hospedagem pública | Sonda HTTPS executada às 21:33:16 locais. Página React, JS com MIME correto e JSON de saúde da API passaram em 1121 ms no total. O handler consulta o banco com SELECT 1. A configuração Ubuntu/Caddy/t3.small foi informada pelo responsável; a sonda externa não inspeciona a instância. [Aplicação](https://3-19-67-254.sslip.io/) · [Readiness](https://3-19-67-254.sslip.io/api/saude) |
| Escopo real e arquitetura conforme RFC | Descrição dos requisitos, atores, componentes e fronteiras na [wiki](README.md). O backend controla registros operacionais, revisão e auditoria. Não foi identificado no checkout um RFC aprovado que permita atestar correspondência integral; cabe ao autor apresentar a referência institucional. |
| Interface funcional e usabilidade básica | Login, visita, revisão e confirmação de exclusão exercitados em DOM de teste. O commit de layout registra verificação de viewport com dados fictícios. A consulta pública confirmou entrega do app. Não houve sessão autenticada de produção nem estudo de usabilidade nesta auditoria. |
| Modularidade | Schemas, política de exclusão, geografia, fotos, IA, validação e componentes do mapa têm módulos separados. Os arquivos de entrada Express e React concentram parte da implementação. [API](../../api/src) · [Frontend](../../web/src) |
| Código público, histórico e iteração | Main com merges de PRs de validação, interface e exclusão lógica; CI executada em revisões sucessivas. O histórico público começa com a publicação e não demonstra toda a cronologia anterior. [Histórico](https://github.com/PabloSchuller/webapp-vedacao-industrial/commits/main/) |
| Requisitos, casos de uso, arquitetura C4, instruções e Wiki | Índice Markdown navegável no repositório com histórias por papel, três percursos, diagrama de contêineres, fronteira e runbook de implantação. [Wiki equivalente](README.md) · [Deploy](deploy.md) |
| Três fluxos completos | Acesso da equipe, registro de visita física e resolução de pendência. Testados localmente com Express, IA e PostgreSQL temporário, incluindo rejeições de permissão e auditoria. [Fluxo integrado](../../api/tests/integration/fluxo.test.js) |
| Cobertura unitária e TDD | Gates unitários independentes passaram. Os detalhes de método e histórico estão abaixo. A prova de autoria e a avaliação do processo pelo orientador continuam necessárias. |
| CI/CD em funcionamento | CI pública da base concluída com sucesso. A branch implementa CD condicionado ao sucesso da CI em push na main, com imagens por digest e consulta automática pela EC2 via systemd. AWS não foi acionada nesta auditoria. Para fechar: ativar o timer, obter uma release publicada pela CI e conferir o SHA aplicado no journal e a saúde HTTPS. [CI da base](https://github.com/PabloSchuller/webapp-vedacao-industrial/actions/runs/42525945066) · [Workflow](../../.github/workflows/ci.yml) |
| Análise estática e segurança | ESLint da API e do frontend passou. O CI inclui Gitleaks com digest fixado para os arquivos versionados. Testes verificam autorização na API, revogação, alterações em visitas e conflitos. actionlint aprovou os dois workflows; Bash passou em verificação sintática. A auditoria não inspecionou IAM ou grupos de segurança reais. |
| Observabilidade | Sonda externa executada com sucesso no serviço real e três testes de contrato aprovados. Workflow agendado duas vezes por hora, sem processo residente adicional na EC2. Para comprovar continuidade, conferir histórico de execuções após merge e habilitar notificações de falha. [Sonda](../../scripts/monitor.mjs) · [Workflow](../../.github/workflows/disponibilidade.yml) |

## Cobertura reproduzível e testes

Execute `node scripts/ci.mjs` e `node --test scripts/tests/monitor.test.mjs` na raiz. Para a prova, abra os relatórios de cada suíte no artefato **cobertura** do Actions. A métrica usada é cobertura de linhas. O numerador conta linhas executadas, inclusive inicialização dos módulos; as asserções verificam contratos e efeitos observáveis.

| Suíte | Resultado local | Cobertura |
|---|---:|---:|
| API unitária, módulos e controladores com dependências simuladas, sem HTTP, IA ou banco real | 43 passaram | 568/706 linhas, **80,45%**, mínimo 75% |
| API com integração, suíte histórica com PostgreSQL e IA reais em Docker | 53 aprovações na contagem Node, incluindo o agrupador | **92,77%** |
| Frontend unitário, componentes e cliente HTTP isolados | 6 passaram | 79/292 linhas, **27,05%**, mínimo 25% |
| Frontend, todas as specs Vitest, incluindo os 6 acima | 11 passaram | **52,73%** |
| Frontend Node / Python IA e avaliação / sonda Node | 14 / 25 / 3 passaram | Contagens separadas |
| ESLint e build Vite | Aprovados | Distribuição gerada |

A cobertura unitária inicial medida só com os testes JS da API foi 251/706 (35,55%). Os 92,77% anteriores incluíam integração. Os novos testes exercitam controladores com transações e persistência simuladas, rejeição de pendências concorrentes, revisão de medições, fotos e exportação. A primeira execução unitária separada do frontend chegou a 23,28%; o teste de conflito e expiração do cliente HTTP elevou o resultado. Os filtros de produção do c8 e do Istanbul foram mantidos. Os relatórios independentes estão em `api/coverage/unit/` e `web/coverage/unit/`. Estes números se referem ao backend Express e frontend React; os testes Python do serviço de IA estão separados.

**TDD observado.** Nesta auditoria foram escritos primeiro os contratos de sucesso e falha da sonda; a primeira execução falhou por ausência do módulo. A implementação posterior fez os três testes passarem. Os novos testes dos controladores e componentes exercitam código preexistente e caracterizam regressão. Os commits antigos com implementação e testes juntos não permitem afirmar uma sequência red–green anterior. O autor deve conseguir explicar e reproduzir o ciclo na prova.

## Critérios complementares e limites

O projeto usa frameworks web, APIs, PostgreSQL, Docker, cache de geocodificação, autenticação JWT, HTTPS e IA treinada no projeto. O tema é acompanhamento de serviços em obra; materiais pertencem à visita. A hospedagem informada é EC2 administrada pela equipe. Não há evidência para atribuir nota, certificar autoria, ausência de todas as vulnerabilidades ou satisfação de usuários. PostgreSQL persiste em volume; backup externo, restauração ensaiada, regras de entrada e retenção dependem da operação real da AWS.

**Para fechar a auditoria:** o mantenedor deve revisar e integrar a branch, configurar a leitura dos pacotes GHCR e ativar o timer descrito no runbook, comprovar uma entrega automatizada e uma execução agendada, e associar a documentação ao RFC aprovado. Não houve alteração de produção, banco, credenciais ou documentos acadêmicos nesta auditoria.
