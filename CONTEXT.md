```markdown
# Contexto do projeto

Este projeto é um **sistema Web para gerenciamento de programas esportivos**. Ele foi desenvolvido para centralizar a administração de atividades esportivas, turmas, alunos, eventos e competições.

## Sobre o sistema

O objetivo principal é facilitar a gestão de uma estrutura esportiva, permitindo:

- Cadastrar **alunos** no sistema, e matricular eles em uma turma 
- criação de **modalidades**;
- cadastro e organização de **turmas** de diferentes **modalidades**;
- criação de **eventos**;
- criação de **competições** entre turmas ou com participantes externos;
- cadastro de **novas pessoas** apenas para participação em competições, mesmo sem vínculo com turma.

## Contexto do app

O app concentra a lógica de negócio do sistema. Ele representa as operações e regras relacionadas ao domínio esportivo, como:

- cadastro de pessoas;
- gestão de turmas;
- matrícula de alunos;
- organização de eventos;
- criação e acompanhamento de competições;
- controle de participantes internos e externos.

## Contexto do front-end

O front-end é a interface usada para operar o sistema. Ele deve apresentar as telas e fluxos necessários para:

- visualizar e gerenciar cadastros;
- consultar turmas e alunos;
- matricular alunos;
- criar e editar eventos;
- criar competições;
- cadastrar participantes que não fazem parte de turmas;
- acompanhar informações operacionais do sistema.

## Entidades principais do domínio

As entidades mais importantes do projeto são:

- **Pessoa**: qualquer indivíduo cadastrado no sistema;
- **Aluno**: pessoa matriculada em uma turma;
- **Turma**: grupo de prática de um esporte específico;
- **Matrícula**: vínculo entre aluno e turma;
- **Evento**: atividade organizada pelo sistema;
- **Competição**: disputa entre turmas ou participantes;
- **Participante de competição**: pode ser aluno de turma ou pessoa cadastrada apenas para competir.

## Regras e comportamentos esperados

- uma turma está associada a um esporte;
- um aluno pode ser matriculado em uma turma;
- uma competição pode envolver turmas internas;
- uma competição também pode aceitar pessoas externas às turmas;
- o sistema permite cadastrar pessoas somente para participação em competições.

## Finalidade deste arquivo

Este arquivo serve como **contexto para agentes de IA** que precisem entender rapidamente o projeto, seu objetivo, suas partes principais e o domínio de negócio que ele atende.

## Observação

O conteúdo pode ser atualizado conforme novas funcionalidades, telas ou regras de negócio forem adicionadas ao sistema.
```
