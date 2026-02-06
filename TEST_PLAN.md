# Plano de Testes Funcionais - Gerência Esporte API

Este documento descreve os cenários de teste para validação das funcionalidades do sistema. Os testes devem ser executados manualmente na interface (Frontend) ou via ferramentas de API para garantir que as regras de negócio estão sendo respeitadas.

## Estrutura do Caso de Teste
- **ID**: Identificador único.
- **Cenário**: O que está sendo testado.
- **Pré-condições**: Estado necessário do sistema antes do teste.
- **Passos**: Sequência de ações.
- **Resultado Esperado**: O que deve acontecer se o sistema estiver correto.
- **Status**: [ ] Pendente | [OK] Passou | [X] Falhou

---

## 1. Módulo: Professores
| ID | Cenário | Pré-condições | Passos | Resultado Esperado | Status |
|:---|:---|:---|:---|:---|:---|
| PR01 | Cadastro de novo professor | Estar na tela "Novo Professor" | 1. Preencher Nome e Especialidade.<br>2. Clicar em "Salvar". | Professor listado com sucesso. | [ ] |
| PR02 | Validação de campos obrigatórios | Tela "Novo Professor" | 1. Tentar salvar sem preencher o "Nome". | Mensagem de erro "Campo obrigatório". | [ ] |

## 2. Módulo: Turmas
| ID | Cenário | Pré-condições | Passos | Resultado Esperado | Status |
|:---|:---|:---|:---|:---|:---|
| TR01 | Criar Turma com Professor | Existir ao menos um professor cadastrado | 1. Ir em "Nova Turma".<br>2. Selecionar Professor.<br>3. Definir Horário e Vagas.<br>4. Salvar. | Turma criada e vinculada ao professor. | [ ] |
| TR02 | Edição de Horário | Turma TR01 criada | 1. Editar turma TR01.<br>2. Alterar o horário.<br>3. Salvar. | Horário atualizado na listagem. | [ ] |

## 3. Módulo: Alunos e Matrículas
| ID | Cenário | Pré-condições | Passos | Resultado Esperado | Status |
|:---|:---|:---|:---|:---|:---|
| AL01 | Cadastro de Aluno | Tela "Novo Aluno" | 1. Preencher dados pessoais.<br>2. Salvar. | Aluno salvo no banco de dados. | [ ] |
| MT01 | Matricular Aluno em Turma | Aluno e Turma existentes | 1. Acessar "Matrículas".<br>2. Selecionar Aluno e Turma.<br>3. Confirmar. | Vaga ocupada na turma e matrícula gerada. | [ ] |
| MT02 | Impedir matrícula em turma cheia | Turma com 0 vagas disponíveis | 1. Tentar matricular aluno na turma cheia. | Exibir erro: "Não há vagas disponíveis". | [ ] |

---

## 4. Segurança e Acesso
| ID | Cenário | Pré-condições | Passos | Resultado Esperado | Status |
|:---|:---|:---|:---|:---|:---|
| AC01 | Login com Sucesso | Usuário cadastrado | 1. Inserir email e senha válidos. | Redirecionar para o Dashboard. | [ ] |
| AC02 | Bloqueio de Acesso Não Autenticado | Estar deslogado | 1. Tentar acessar `/dashboard` diretamente via URL. | Redirecionar para tela de Login. | [ ] |

---

## Registro de Execução
- **Data da Última Execução:** __/__/____
- **Responsável:** ________________
- **Versão do Sistema:** v1.0.0
