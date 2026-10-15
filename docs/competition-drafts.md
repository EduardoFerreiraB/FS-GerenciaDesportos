# Competições em rascunho

Uma competição nasce em `RASCUNHO` com nome, categoria e modalidade. A
configuração de modo, formato, critério e datas pode ser preenchida por `PUT`;
`POST /competicoes/{id}/iniciar` só aceita a configuração completa e coerente.
Depois de iniciada, a configuração e a exclusão retornam conflito.

A revisão `20260824_0002` converte somente `PLANEJADA` em `RASCUNHO` e torna
os campos de configuração anuláveis. O downgrade recusa rascunhos incompletos
antes de restaurar `NOT NULL`; portanto não é um caminho de rollback seguro
enquanto existirem rascunhos parciais.

## Limite atual da proteção de exclusão

O bloqueio vale para `DELETE /competicoes/{id}`. Os fluxos legados de
exclusão de Evento e Edição ainda excluem competições em cascata, sem passar
por essa validação. Essa pendência deve ser resolvida antes do rollout;
não excluir os pais de competições que precisam ser preservadas.
