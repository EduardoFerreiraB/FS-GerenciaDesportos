# Roteiro de Teste – Tela para Gestão de Usuários

| Projeto | Gerencia Desportos |
| --- | --- |
| Roteiro | RT06 – Usuários |
| Versão | V2.0.0 (revisão da V1.0.0 de 20/02/2026 para o novo frontend) |
| Execução | Claude (Claude in Chrome), acompanhado por Eduardo Ferreira de Brito Matos |
| Data de execução | 16/11/2026 |
| Ambiente | Local — frontend `http://localhost:3000`, API `http://localhost:8000`, MySQL de desenvolvimento |
| Versão do sistema | branch `frontend/redesign`, commit `b10ab55` |
| Navegador | Chrome, janela 1440×900 |
| Usuário | `Admin` / `admin123` (administrador); `coord.rt06` (coordenador criado para o teste) |

## Escopo do roteiro

- **Objetivo:** comprovar consulta, cadastro, validações e exclusão de usuários; primeiro acesso com troca obrigatória de senha; limites do perfil coordenador.
- **Massa de teste:** usuários existentes admin, Prof, Coord, Prof1 e Coordenador (não alterados). `coord.rt06` (id 7) criado no caso 005, usado nos casos 007–008 e excluído no caso 009.
- **Cobre pendência do RT08:** o caso 007 faz uma troca de senha real (no usuário de teste), que o RT08 só validou.
- **Correspondência com a V1.0.0:** 001→001, 002→002, 003→003, 004→004, 009→005.

## Resumo

| Contador | Objeto do Teste | Prioridade | Status |
| --- | --- | --- | --- |
| 001 | Consultar usuário | Alta | [OK] |
| 002 | Consultar usuário não cadastrado | Alta | [OK] |
| 003 | Cadastrar com campos vazios e senha curta | Alta | [OK] |
| 004 | Cadastrar com nome de usuário existente | Alta | [OK] |
| 005 | Cadastrar coordenador | Alta | [OK] |
| 006 | Excluir a própria conta (bloqueio) | Alta | [OK] |
| 007 | Primeiro acesso: troca obrigatória de senha | Alta | [!] |
| 008 | Coordenador na tela de Usuários | Média | [!] |
| 009 | Excluir usuário | Alta | [OK] |
| 010 | Alterar perfil de um usuário | Média | [B] |

**Status:** `[ ]` pendente · `[OK]` passou · `[!]` passou com ressalva · `[X]` falhou · `[B]` bloqueado/não executável.

---

## Caso 001 — Consultar usuário
Localização: Login › Usuários · Código: `frontend/src/app/dashboard/usuarios/page.tsx`, backend `app/routers/auth.py`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Abrir Usuários | Nome, cargo e ações | Colunas Usuário e Perfil (selo colorido: Administrador, Professor, Coordenador), menu "…" com Excluir | [OK] |
| 2 | Buscar `PROF` | Filtra sem diferenciar maiúsculas | "Prof" e "Prof1" | [OK] |

Observação: a V1 listava também o id; o novo design não mostra (aceitável).
Evidências: `001-lista.jpg`, `001-busca.jpg`

## Caso 002 — Usuário não cadastrado
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Buscar `fulano` | "Nenhum usuário encontrado" | "Nenhum usuário encontrado / Nada encontrado para "fulano"." | [OK] |

Evidência: `002-sem-resultado.jpg`

## Caso 003 — Campos vazios e senha curta
Localização: Usuários › Novo usuário · Código: `frontend/src/app/dashboard/usuarios/novo/page.tsx`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | "Criar usuário" vazio | Mensagem vermelha abaixo dos campos | "Obrigatório" em usuário e senha; nenhuma chamada à API | [OK] |
| 2 | Senha `abc` | "Mínimo 6 caracteres" | Exibido | [OK] |

Evidência: `003-campos-obrigatorios.jpg`

## Caso 004 — Nome de usuário existente
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Usuário `ADMIN` | "Nome de usuário já cadastrado" | API 400 "Nome de usuário já cadastrado." (sem diferenciar maiúsculas) | [OK] |

Evidência: `004-usuario-duplicado.jpg`

## Caso 005 — Cadastrar coordenador
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | `coord.rt06`, senha de teste, perfil Coordenador | Criado e listado | `POST /register` 201; "Usuário criado com sucesso!"; aparece como Coordenador | [OK] |

Evidência: `005-usuario-criado.jpg`

## Caso 006 — Excluir a própria conta
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Conferir que "admin" (id 1) é o usuário logado; … › Excluir; digitar "admin"; confirmar | Bloquear | `DELETE /users/1` 400; erro no diálogo "Você não pode excluir sua própria conta."; nada excluído | [OK] |

Observação: a opção "Excluir" aparece na própria linha; poderia ficar oculta (PD-RT06-03).
Evidência: `006-excluir-propria-conta.jpg`

## Caso 007 — Primeiro acesso: troca obrigatória de senha
Código: `frontend/src/components/auth/ChangePasswordModal.tsx` (`forceChange`), backend `POST /change-password`
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Sair e entrar como `coord.rt06` | Modal "Alteração obrigatória" que não pode ser fechado | Modal aberto sobre o Dashboard, sem botão Cancelar | [OK] |
| 2 | Esc, clique fora, clique no "×" | Nada fecha; sem "×" visível | Nada fecha, mas o **"×" aparece e não faz nada** | [!] |
| 3 | Senha atual de teste, nova senha e confirmação | Troca e libera o sistema | `POST /change-password` 200; modal fechou | [OK] |
| 4 | Pela API: senha antiga, senha nova, `/users/me` | Antiga recusada; nova aceita; troca não mais exigida | Antiga 401; nova 200; `must_change_password=false`; perfil coordenador | [OK] |

Observação: os dados do Dashboard carregam por trás do modal; a API não bloqueia o uso enquanto a troca é exigida (PD-RT06-02).
Evidências: `007-primeiro-acesso-modal.jpg`, `007-modal-x-sem-efeito.jpg`, `007-senha-trocada.jpg`
**Status final:** [!] — DF-RT06-01.

## Caso 008 — Coordenador na tela de Usuários
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Como coordenador, ver o menu lateral | Sem "Usuários" | Menu sem o grupo Administração | [OK] |
| 2 | Abrir `/dashboard/usuarios` pela URL | Bloquear ou avisar falta de permissão | Tela abre com "Erro ao carregar usuários — Acesso restrito ou falha de conexão" e o botão "Novo usuário" ativo | [!] |
| 3 | Em `/dashboard/usuarios/novo`, criar outro Coordenador | Não oferecer perfis proibidos | Formulário oferece Coordenador e Administrador; API nega com 403 "Acesso negado: Coordenadores só podem criar usuários de nível inferior (professor ou assistente)." | [!] |

Evidências: `008-coordenador-abre-usuarios.jpg`, `008-coordenador-cria-coordenador-negado.jpg`
**Status final:** [!] — DF-RT06-02. A segurança está garantida pela API; o problema é de tela.

## Caso 009 — Excluir usuário
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Como Admin, … › Excluir em `coord.rt06`, digitar o nome, confirmar | Exclui | `DELETE /users/7` 204; "Usuário excluído com sucesso."; lista com os 5 originais | [OK] |
| 2 | Pela API, login de `coord.rt06` | Recusado | 401 | [OK] |

Evidência: `009-usuario-excluido.jpg`

## Caso 010 — Alterar perfil de um usuário
| # | Procedimento | Esperado | Obtido | Status |
| --- | --- | --- | --- | --- |
| 1 | Procurar a ação de alterar perfil | Editar o perfil | Menu só tem "Excluir"; o backend tem `PUT /users/{username}/role` | [B] |

Ver PD-RT06-01.

---

## Defeitos encontrados

| ID | Título | Severidade | Caso | Situação |
| --- | --- | --- | --- | --- |
| DF-RT06-01 | "×" visível e sem efeito no modal de troca obrigatória | Baixa | 007 | Corrigido (T8) |
| DF-RT06-02 | Tela de Usuários não respeita o perfil coordenador | Baixa | 008 | Corrigido (T7, T10) |

**DF-RT06-01 — "×" sem efeito na troca obrigatória**
- Causa provável: `components/ui/dialog.tsx:77` sempre desenha o botão Fechar; `ChangePasswordModal` bloqueia o fechamento, mas o botão continua visível. Sugestão: opção no `DialogContent` para ocultar o "×" quando `forceChange`.

**DF-RT06-02 — Tela de Usuários sem controle por perfil**
- Passos: entrar como coordenador › abrir `/dashboard/usuarios` e `/dashboard/usuarios/novo` pela URL.
- Esperado / Obtido: aviso de permissão (ou redirecionar) e só os perfis permitidos / erro genérico de carregamento; formulário com Administrador e Coordenador, recusados pela API.
- Sugestão: guarda de rota por perfil (o menu já filtra por `roles`) e lista de perfis conforme o usuário logado.

## Divergências de contrato e pendências

| ID | Referência | Definido | Encontrado | Encaminhamento |
| --- | --- | --- | --- | --- |
| PD-RT06-01 | API × tela | `PUT /users/{username}/role` existe | Sem edição de perfil na tela | Decidir se entra no escopo |
| PD-RT06-02 | Segurança | Troca de senha obrigatória no primeiro acesso | Só a tela exige; a API atende normalmente um usuário com `must_change_password=true` | Decidir se a API deve bloquear até a troca |
| PD-RT06-03 | Usabilidade | — | "Excluir" aparece para a própria conta (a API bloqueia) | Ocultar ou desabilitar na própria linha |
| PD-RT06-04 | Regras de perfil | Backend permite ao coordenador criar professor/assistente | O menu do coordenador não mostra Usuários | Decidir se o coordenador deve ter acesso limitado à tela |

## Conclusão

| Casos | [OK] | [!] | [X] | [B] |
| --- | --- | --- | --- | --- |
| 10 | 7 | 2 | 0 | 1 |

Parecer: **aprovado com ressalvas**. Cadastro, validações, troca obrigatória de senha e exclusão funcionam, e a API protege as regras de perfil. Ficam dois defeitos de tela.

## Diário de execução

| Hora | Evento |
| --- | --- |
| início | Base: 5 usuários. |
| — | Casos 001–005 OK; `coord.rt06` criado (id 7). |
| — | Caso 006: conferido que o admin listado é o logado (id 1) antes de tentar; bloqueado. |
| — | Caso 007: login como `coord.rt06`, troca obrigatória feita; validado pela API. |
| — | Caso 008: coordenador abre Usuários pela URL; criação de coordenador negada pela API (403). |
| — | Volta ao Admin. Instabilidade: por alguns minutos os cliques do mouse (automação) não abriam menus nem o botão de tema em Usuários, embora o clique por JavaScript funcionasse; voltou a funcionar após navegar pelo menu lateral. Não reproduzida; não registrada como defeito. |
| — | Caso 009: `coord.rt06` excluído; login dele recusado (401). Base de volta aos 5 usuários. RT06 encerrado. |
