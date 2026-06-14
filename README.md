# WebApp para Gestão de Obras de Vedação Industrial
### com Geolocalização e Inteligência Artificial

**Pablo Arman Schuller** — Engenharia de Software  
Centro Universitário Católica de Santa Catarina — PAC Extensionista VIII · 2026

---

## O Problema

Empresas de vedação industrial geralmente atendem dezenas de galpões ao mesmo tempo. O controle dessas obras ainda depende de planilhas, cadernos e aplicativos genéricos — sem padronização, sem rastreabilidade e sem controle de qualidade dos dados.

O que foi feito em cada galpão, quando foi feito e o que ainda falta muitas vezes existe só na memória de quem esteve lá. O resultado é retrabalho, atraso e perda de materiais.

---

## A Solução

Um WebApp centralizado que reúne em um único lugar:

- 📋 **Histórico completo** de cada galpão — equipes, status, progresso
- 📍 **Geolocalização** via Google Maps API — localização e rotas para os canteiros
- 🤖 **Validação automática via IA** — bloqueia registros inconsistentes antes de salvar

Qualquer equipe autorizada consegue assumir um serviço e saber exatamente o que aconteceu antes dela.

---

## Inovação

O diferencial exclusivo é o **módulo de validação semântica via IA** (API da Anthropic — Claude).

Antes de salvar qualquer registro, o sistema analisa o contexto dos dados em relação ao histórico da obra e bloqueia inconsistências como:

- Endereço incompatível com as coordenadas GPS
- Percentual de conclusão menor que o registrado na visita anterior
- Equipe responsável não cadastrada no sistema
- Datas de visita anteriores à criação do galpão

Nenhum sistema existente no mercado faz isso de forma integrada para o setor de vedação industrial.

---

## Arquitetura

```
[Frontend: React.js]
        ↕ HTTPS
[Backend: Node.js + Express]
        ↕ SQL                    ↔ [Claude API — Anthropic]
[Banco: PostgreSQL]
        ↕
[Google Maps JavaScript API]
```

| Camada | Tecnologia |
|---|---|
| Frontend | React.js |
| Backend | Node.js + Express + JWT |
| Banco de dados | PostgreSQL + Prisma ORM |
| Validação IA | Anthropic Claude API |
| Geolocalização | Google Maps JavaScript API |
| Hospedagem | Railway / Render |

---

## Resultados Esperados

| Métrica | Meta |
|---|---|
| Consistência dos dados | > 95% |
| Redução no tempo de localização | ≥ 50% |
| Usabilidade (SUS) | ≥ 70 pontos |
| Retomada segura de obras | Validado com parceiro externo |

---

## Cronograma

| Semana | Atividade |
|---|---|
| S1–S2 | Levantamento de requisitos |
| S2–S3 | Projeto arquitetural e DER |
| S3–S4 | Wireframes e protótipos |
| S4–S5 | Implementação — módulo de cadastro |
| S5–S6 | Implementação — módulo de geolocalização |
| S6–S7 | Implementação — módulo de IA |
| S7–S8 | Testes e ajustes |
| S8–S9 | Validação com parceiro externo |
| S9–S10 | Relatório e artigo final |

---

## Contato

**pablo.schuller@catolicasc.edu.br**  
Curso de Engenharia de Software — Centro Universitário Católica de Santa Catarina  
Jaraguá do Sul, SC, Brasil
