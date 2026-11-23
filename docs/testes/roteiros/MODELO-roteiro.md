# Roteiro de Teste – Tela para <Nome da tela>

> Modelo baseado nos roteiros `Documents/RT01 - Alunos.docx` … `RT07 - DashBoard.docx` (branch `main`):
> mesmo cabeçalho e mesmos "cartões" de caso (Contador, Prioridade, Localização, Código do módulo,
> Objeto do Teste, Pré-condição, Procedimento, Resultado esperado), completados com o registro da
> execução: resultado obtido por passo, status, verificações técnicas, evidências, defeitos e diário.

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RTxx – <Nome da tela> |
| Versão | V2.0.0 (V1.0.0 = roteiro original de 20/02/2026, quando existir) |
| Autor(es) | Yuri Rodrigues de Oliveira Jubé, Eduardo Ferreira de Brito Matos, Ian Carlo de Lima Pedroso, João Pedro |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | dd/mm/aaaa |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `<branch>`, commit `<hash>` |
| Navegador | Chrome, desktop <largura> px; celular 390 px quando o caso pede |
| Usuário | `Admin` (perfil administrador) |

## Escopo do roteiro

- **Objetivo:** <o que a tela deve permitir e o que este roteiro comprova>.
- **Fora do escopo:** <o que não é testado aqui e em qual roteiro está>.
- **Dados criados:** <nomes exatos, ex.: "Aluno Teste RT01">.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | <objeto> | Alta | [OK] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado.

---

## Caso 001

| Campo | Conteúdo |
| --- | --- |
| Contador | 001 |
| Prioridade | Alta · Média · Baixa |
| Tipo | Funcional · Negativo · Visual · Responsivo · Acessibilidade |
| Localização | Login > <Menu> > <Tela> |
| Código do módulo | Frontend: `<caminho do arquivo>` · Backend: `<arquivo .py da rota>` |
| Objeto do Teste | <o que é testado, ex.: Consultar "Aluno"> |
| Pré-condição | 1. <estado necessário> |
| Dados de entrada | <valores usados> |
| Resultado esperado | <comportamento correto> |

**Procedimento e execução**

| # | Procedimento | Resultado esperado do passo | Resultado obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | <ação> | <o que deve acontecer> | <o que aconteceu> | [OK] |

**Verificações técnicas:** console <sem erros>; rede <`GET /alunos/` → 200>; tema escuro/celular <ok / n.a.>.

**Evidência:** `evidencias/RTxx/001-<descricao>.png`

**Status final:** [OK] — <observação>.

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RTxx-01 | <título> | Alta | 001 | Aberto |

**DF-RTxx-01 — <título>**
- Severidade: Crítica (bloqueia/perde dados) · Alta (fluxo principal errado) · Média (contornável) · Baixa (cosmético).
- Passos para reproduzir: 1. … 2. …
- Esperado / Obtido: … / …
- Evidência: `evidencias/RTxx/…png`; console/rede: …
- Causa provável: `<arquivo:linha>`, se identificada.
- Situação: Aberto · Corrigido em `<commit>` · Verificado.

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RTxx-01 | <spec/plano/design> | <o que diz> | <o que existe> | <decidir / implementar / aceitar> |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| n | n | n | n | n |

Parecer: <aprovado / aprovado com ressalvas / reprovado>. Recomendações: …

## Diário de execução

| Hora | Evento |
| --- | --- |
| hh:mm | <ação, observação, desvio ou decisão> |
