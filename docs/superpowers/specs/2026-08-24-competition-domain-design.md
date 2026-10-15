# Competition Domain Design

## Goal

Support recurring single-sport championships and multi-sport events while keeping team and individual competitions separate.

## Domain hierarchy

`Evento` is the recurring umbrella, `Edicao` is one occurrence of that event, and `Competicao` is one modality/category within an edition. A direct municipal championship uses the same hierarchy with one competition in its edition.

`Competicao` owns one `Modalidade`, a textual age category, one exclusive registration mode (`EQUIPE` or `INDIVIDUAL`), one format, and one result criterion.

## Team competitions

Team competitions own their teams, rosters, fixtures, results, and standings. Fixtures are not shared with individual competitions. Initial formats are points league, groups, and knockout. Results retain the existing score-based behavior.

## Individual competitions

Individual competitions own direct participant registrations, internal events (`Prova`), and one final result per participant per event. Initial time results use integer milliseconds and are ranked ascending. Heats, qualifiers, finals, relays, and team results within individual modalities are out of scope.

## Constraints

- The school-management domain remains unchanged.
- Do not calculate or validate ages; category is a required textual label.
- A competition accepts exactly one registration mode.
- A participant may appear in at most one team of a given competition.
- Existing competition data must be migrated without destructive reset.
- No commits are created during this implementation.
