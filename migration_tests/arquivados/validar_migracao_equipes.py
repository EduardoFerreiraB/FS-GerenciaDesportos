#!/usr/bin/env python3
"""Read-only validator for an anonymized Passo 3 SQLite migration rehearsal.

The validator deliberately accepts two dumps: one at revision 0002 and its
candidate revision-0003 result.  It opens both with SQLite's ``mode=ro`` and
never imports the application configuration or credentials.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sqlite3
import sys


def connect_readonly(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise ValueError(f"dump SQLite inexistente: {path}")
    return sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)


def table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
    ).fetchone() is not None


def rows(connection: sqlite3.Connection, query: str, parameters=()):
    return connection.execute(query, parameters).fetchall()


def participant_set(connection: sqlite3.Connection, team_id: int) -> list[int]:
    return [
        row[0]
        for row in rows(
            connection,
            "SELECT id_participante FROM equipes_participantes "
            "WHERE id_equipe = ? ORDER BY id_participante",
            (team_id,),
        )
    ]


def match_count(connection: sqlite3.Connection, team_id: int, modality: int | None) -> int:
    if modality is None:
        return 0
    return rows(
        connection,
        "SELECT COUNT(*) FROM partidas WHERE id_modalidade = ? "
        "AND (id_equipe_casa = ? OR id_equipe_visitante = ?)",
        (modality, team_id, team_id),
    )[0][0]


class ForeignEditionMatch(ValueError):
    pass


def infer_targets(before: sqlite3.Connection, team_id: int, edition_id: int):
    foreign = rows(
        before,
        "SELECT id_partida, id_edicao FROM partidas WHERE id_edicao != ? "
        "AND (id_equipe_casa = ? OR id_equipe_visitante = ?) ORDER BY id_partida LIMIT 1",
        (edition_id, team_id, team_id),
    )
    if foreign:
        partida, foreign_edition = foreign[0]
        raise ForeignEditionMatch(
            f"partida {partida} da equipe pertence a edição diferente ({foreign_edition})"
        )
    modalities = [
        row[0]
        for row in rows(
            before,
            "SELECT DISTINCT id_modalidade FROM partidas WHERE id_edicao = ? "
            "AND (id_equipe_casa = ? OR id_equipe_visitante = ?) ORDER BY id_modalidade",
            (edition_id, team_id, team_id),
        )
    ]
    if not modalities:
        candidates = [
            row[0]
            for row in rows(
                before,
                "SELECT id_competicao FROM competicoes WHERE id_edicao = ? "
                "AND modo_inscricao = 'EQUIPE' ORDER BY id_competicao",
                (edition_id,),
            )
        ]
        return [(None, candidates)]
    return [
        (
            modality,
            [
                row[0]
                for row in rows(
                    before,
                    "SELECT id_competicao FROM competicoes WHERE id_edicao = ? "
                    "AND id_modalidade = ? AND modo_inscricao = 'EQUIPE' "
                    "ORDER BY id_competicao",
                    (edition_id, modality),
                )
            ],
        )
        for modality in modalities
    ]


def validate(before: sqlite3.Connection, after: sqlite3.Connection) -> tuple[dict, bool]:
    historic_teams = rows(
        before,
        "SELECT id_equipe, id_edicao FROM equipes WHERE id_competicao IS NULL ORDER BY id_equipe",
    )
    noninferable = []
    manual = []
    manual_ids = set()
    expected = {}
    for team_id, edition_id in historic_teams:
        try:
            targets = infer_targets(before, team_id, edition_id)
        except ForeignEditionMatch as exc:
            noninferable.append(
                {"id_equipe_origem": team_id, "motivo": str(exc)}
            )
            continue
        for modality, candidates in targets:
            if len(candidates) == 1:
                expected[(team_id, candidates[0])] = modality
            elif modality is None:
                manual_ids.add(team_id)
                manual.append(
                    {
                        "id_equipe_origem": team_id,
                        "status": "PENDENTE",
                        "motivo": "sem partidas e sem competição EQUIPE inferível",
                        "competicoes_candidatas": candidates,
                    }
                )
            else:
                noninferable.append(
                    {
                        "id_equipe_origem": team_id,
                        "id_modalidade": modality,
                        "competicoes_candidatas": candidates,
                    }
                )

    report = {
        "duplicacoes": [],
        "pendencias_manuais": manual,
        "equipes_nao_inferiveis_com_partidas": noninferable,
        "erros": [],
    }
    if noninferable:
        return report, False
    if not table_exists(after, "migracao_equipes_origem"):
        report["erros"].append("dump posterior não contém a auditoria migracao_equipes_origem")
        return report, False

    audit_rows = rows(
        after,
        "SELECT id_equipe_origem, id_equipe_resultante, id_competicao, status, motivo "
        "FROM migracao_equipes_origem ORDER BY id_equipe_origem, id_competicao, id_equipe_resultante",
    )
    audited = set()
    pending_audits = set()
    for original, resulting, competition, status, reason in audit_rows:
        if status == "PENDENTE":
            pending_audits.add(original)
            if original not in manual_ids or resulting is not None or competition is not None:
                report["erros"].append(f"auditoria PENDENTE inesperada para equipe {original}")
            continue
        if status != "MIGRADA" or (original, competition) not in expected:
            report["erros"].append(
                f"auditoria inesperada para equipe {original}, competição {competition}"
            )
            continue
        if (original, competition) in audited:
            report["erros"].append(
                f"auditoria duplicada para equipe {original}, competição {competition}"
            )
            continue
        audited.add((original, competition))
        modality = expected.get((original, competition))
        resulting_competition = rows(
            after,
            "SELECT id_competicao FROM equipes WHERE id_equipe = ?",
            (resulting,),
        )
        if not resulting_competition or resulting_competition[0][0] != competition:
            report["erros"].append(
                f"competição divergente para equipe resultante {resulting}: auditoria {competition}"
            )
        before_members = participant_set(before, original)
        after_members = participant_set(after, resulting)
        before_matches = match_count(before, original, modality)
        after_matches = match_count(after, resulting, modality)
        record = {
            "id_equipe_origem": original,
            "id_equipe_resultante": resulting,
            "id_competicao": competition,
            "id_modalidade": modality,
            "partidas_antes": before_matches,
            "partidas_depois": after_matches,
            "participantes_antes": before_members,
            "participantes_depois": after_members,
            "participantes_preservados": before_members == after_members,
        }
        report["duplicacoes"].append(record)
        if modality is None or (before_matches != after_matches):
            report["erros"].append(
                f"partidas divergentes para equipe {original}, competição {competition}"
            )
        if before_members != after_members:
            report["erros"].append(
                f"participantes divergentes para equipe {original}, competição {competition}"
            )

    missing = sorted(set(expected) - audited)
    for original, competition in missing:
        report["erros"].append(
            f"sem auditoria de resultado para equipe {original}, competição {competition}"
        )
    for original in sorted(manual_ids):
        team_scope = rows(after, "SELECT id_competicao FROM equipes WHERE id_equipe = ?", (original,))
        if original not in pending_audits:
            report["erros"].append(f"sem auditoria PENDENTE para equipe manual {original}")
        if not team_scope or team_scope[0][0] is not None:
            report["erros"].append(f"equipe PENDENTE {original} recebeu competição sem revisão manual")
    report["resumo"] = {
        "partidas_antes": sum(item["partidas_antes"] for item in report["duplicacoes"]),
        "partidas_depois": sum(item["partidas_depois"] for item in report["duplicacoes"]),
        "participantes_preservados": all(
            item["participantes_preservados"] for item in report["duplicacoes"]
        ),
    }
    return report, not report["erros"]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--antes", required=True, type=Path, help="dump anonimizado antes da revisão 0003")
    parser.add_argument("--depois", required=True, type=Path, help="dump anonimizado após a revisão 0003")
    parser.add_argument("--relatorio", type=Path, help="arquivo JSON de saída; se omitido, usa stdout")
    args = parser.parse_args(argv)
    try:
        with connect_readonly(args.antes) as before, connect_readonly(args.depois) as after:
            report, valid = validate(before, after)
    except (OSError, ValueError, sqlite3.Error) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 2

    serialized = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.relatorio:
        args.relatorio.write_text(serialized, encoding="utf-8")
    else:
        sys.stdout.write(serialized)
    if report["equipes_nao_inferiveis_com_partidas"]:
        print("ERRO: equipe com modalidade não inferível com partidas.", file=sys.stderr)
        return 1
    if not valid:
        print("ERRO: validação de migração de equipes falhou.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
