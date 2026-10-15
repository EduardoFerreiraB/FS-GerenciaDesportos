#!/usr/bin/env python3
"""Read-only validator for an anonymized Passo 4 SQLite migration rehearsal.

The validator accepts two dumps: one before revision 0004 and the candidate result
after revision 0004. It opens both in mode=ro and never accesses credentials or network.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import random
import sqlite3
import sys


STATUS_MAP = {
    "Agendada": "Agendado",
    "Em Andamento": "Em Andamento",
    "Finalizada": "Finalizado",
    "Cancelada": "Cancelado",
}


def connect_readonly(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise ValueError(f"dump SQLite inexistente: {path}")
    conn = sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
    ).fetchone() is not None


def validate(before: sqlite3.Connection, after: sqlite3.Connection, sample_size: int = 10) -> tuple[dict, bool]:
    discrepancies = []

    if not table_exists(before, "partidas"):
        discrepancies.append("tabela 'partidas' não encontrada no banco anterior.")
        return {"valido": False, "discrepancias": discrepancies}, False

    if not table_exists(after, "confrontos"):
        discrepancies.append("tabela 'confrontos' não encontrada no banco posterior.")
        return {"valido": False, "discrepancias": discrepancies}, False

    if not table_exists(after, "migracao_partidas_origem"):
        discrepancies.append("tabela 'migracao_partidas_origem' não encontrada no banco posterior.")
        return {"valido": False, "discrepancias": discrepancies}, False

    partidas = before.execute(
        "SELECT id_partida, id_edicao, id_local, id_arbitro, id_modalidade, "
        "id_equipe_casa, id_equipe_visitante, id_proxima_partida, fase, "
        "part_data, part_hora, placar_casa, placar_visitante, status, "
        "sumula_arquivo, observacoes FROM partidas ORDER BY id_partida"
    ).fetchall()

    confrontos_rows = after.execute(
        "SELECT id_confronto, id_competicao, id_equipe_mandante, id_equipe_visitante, "
        "id_proximo_confronto, fase, rodada, grupo, data, hora, id_local, id_arbitro, "
        "placar_mandante, placar_visitante, id_equipe_vencedora, status, "
        "sumula_arquivo, observacoes FROM confrontos"
    ).fetchall()
    confrontos = {c["id_confronto"]: c for c in confrontos_rows}

    audits_rows = after.execute(
        "SELECT id_migracao, id_partida_origem, id_confronto_resultante, id_competicao, status, motivo "
        "FROM migracao_partidas_origem"
    ).fetchall()

    audits = {}
    for a in audits_rows:
        if a["id_partida_origem"] in audits:
            discrepancies.append(f"auditoria duplicada para partida {a['id_partida_origem']}")
        audits[a["id_partida_origem"]] = a

    total_partidas = len(partidas)
    total_confrontos = len(confrontos)
    total_migrados = sum(1 for a in audits.values() if a["status"] == "MIGRADA")

    if total_partidas != total_confrontos:
        discrepancies.append(f"contagem divergente: {total_partidas} partidas vs {total_confrontos} confrontos.")

    if total_partidas != total_migrados:
        discrepancies.append(f"contagem divergente: {total_partidas} partidas vs {total_migrados} auditorias MIGRADA.")

    # Validation of fields and linkage
    for p in partidas:
        pid = p["id_partida"]
        if pid not in audits:
            discrepancies.append(f"partida {pid} sem registro em migracao_partidas_origem.")
            continue

        audit = audits[pid]
        cid = audit["id_confronto_resultante"]
        if not cid or cid not in confrontos:
            discrepancies.append(f"partida {pid} com confronto resultante inválido ({cid}).")
            continue

        c = confrontos[cid]

        # Field comparisons
        if c["id_local"] != p["id_local"]:
            discrepancies.append(f"partida {pid}: local divergente ({p['id_local']} != {c['id_local']}).")
        if c["id_arbitro"] != p["id_arbitro"]:
            discrepancies.append(f"partida {pid}: árbitro divergente ({p['id_arbitro']} != {c['id_arbitro']}).")
        if str(c["data"]) != str(p["part_data"]):
            discrepancies.append(f"partida {pid}: data divergente ({p['part_data']} != {c['data']}).")
        if str(c["hora"]) != str(p["part_hora"]):
            discrepancies.append(f"partida {pid}: hora divergente ({p['part_hora']} != {c['hora']}).")
        if c["id_equipe_mandante"] != p["id_equipe_casa"]:
            discrepancies.append(f"partida {pid}: mandante divergente ({p['id_equipe_casa']} != {c['id_equipe_mandante']}).")
        if c["id_equipe_visitante"] != p["id_equipe_visitante"]:
            discrepancies.append(f"partida {pid}: visitante divergente ({p['id_equipe_visitante']} != {c['id_equipe_visitante']}).")

        exp_pm = p["placar_casa"] if p["placar_casa"] is not None else 0
        exp_pv = p["placar_visitante"] if p["placar_visitante"] is not None else 0
        if c["placar_mandante"] != exp_pm:
            discrepancies.append(f"partida {pid}: placar mandante divergente ({exp_pm} != {c['placar_mandante']}).")
        if c["placar_visitante"] != exp_pv:
            discrepancies.append(f"partida {pid}: placar visitante divergente ({exp_pv} != {c['placar_visitante']}).")

        exp_status = STATUS_MAP.get(p["status"], "Agendado")
        if c["status"] != exp_status:
            discrepancies.append(f"partida {pid}: status divergente ({exp_status} != {c['status']}).")

        if c["sumula_arquivo"] != p["sumula_arquivo"]:
            discrepancies.append(f"partida {pid}: súmula divergente ({p['sumula_arquivo']} != {c['sumula_arquivo']}).")
        if c["observacoes"] != p["observacoes"]:
            discrepancies.append(f"partida {pid}: observações divergentes.")
        if c["fase"] != p["fase"]:
            discrepancies.append(f"partida {pid}: fase divergente ({p['fase']} != {c['fase']}).")

        # Winner
        exp_vencedor = None
        if exp_status == "Finalizado":
            if exp_pm > exp_pv:
                exp_vencedor = p["id_equipe_casa"]
            elif exp_pv > exp_pm:
                exp_vencedor = p["id_equipe_visitante"]
        if c["id_equipe_vencedora"] != exp_vencedor:
            discrepancies.append(f"partida {pid}: vencedor divergente ({exp_vencedor} != {c['id_equipe_vencedora']}).")

        # Knockout link
        if p["id_proxima_partida"]:
            next_audit = audits.get(p["id_proxima_partida"])
            exp_next_cid = next_audit["id_confronto_resultante"] if next_audit else None
            if c["id_proximo_confronto"] != exp_next_cid:
                discrepancies.append(
                    f"partida {pid}: próximo confronto divergente ({exp_next_cid} != {c['id_proximo_confronto']})."
                )
        else:
            if c["id_proximo_confronto"] is not None:
                discrepancies.append(f"partida {pid}: próximo confronto deveria ser nulo ({c['id_proximo_confronto']}).")

    # Sample generation
    amostra = []
    if partidas:
        rng = random.Random(42)
        n = min(len(partidas), sample_size)
        sampled_partidas = rng.sample(partidas, n)
        for p in sampled_partidas:
            pid = p["id_partida"]
            audit = audits.get(pid)
            cid = audit["id_confronto_resultante"] if audit else None
            c = confrontos.get(cid) if cid else None

            sample_entry = {
                "id_partida": pid,
                "id_confronto": cid,
                "id_competicao": audit["id_competicao"] if audit else None,
                "campos": {
                    "equipe_mandante": {
                        "antes": p["id_equipe_casa"],
                        "depois": c["id_equipe_mandante"] if c else None,
                        "igual": (c["id_equipe_mandante"] == p["id_equipe_casa"]) if c else False,
                    },
                    "equipe_visitante": {
                        "antes": p["id_equipe_visitante"],
                        "depois": c["id_equipe_visitante"] if c else None,
                        "igual": (c["id_equipe_visitante"] == p["id_equipe_visitante"]) if c else False,
                    },
                    "placar_mandante": {
                        "antes": p["placar_casa"] or 0,
                        "depois": c["placar_mandante"] if c else None,
                        "igual": (c["placar_mandante"] == (p["placar_casa"] or 0)) if c else False,
                    },
                    "placar_visitante": {
                        "antes": p["placar_visitante"] or 0,
                        "depois": c["placar_visitante"] if c else None,
                        "igual": (c["placar_visitante"] == (p["placar_visitante"] or 0)) if c else False,
                    },
                    "status": {
                        "antes": p["status"],
                        "depois": c["status"] if c else None,
                        "igual": (c["status"] == STATUS_MAP.get(p["status"])) if c else False,
                    },
                    "local": {
                        "antes": p["id_local"],
                        "depois": c["id_local"] if c else None,
                        "igual": (c["id_local"] == p["id_local"]) if c else False,
                    },
                    "arbitro": {
                        "antes": p["id_arbitro"],
                        "depois": c["id_arbitro"] if c else None,
                        "igual": (c["id_arbitro"] == p["id_arbitro"]) if c else False,
                    },
                    "data": {
                        "antes": str(p["part_data"]),
                        "depois": str(c["data"]) if c else None,
                        "igual": (str(c["data"]) == str(p["part_data"])) if c else False,
                    },
                    "hora": {
                        "antes": str(p["part_hora"]),
                        "depois": str(c["hora"]) if c else None,
                        "igual": (str(c["hora"]) == str(p["part_hora"])) if c else False,
                    },
                    "proximo": {
                        "antes": p["id_proxima_partida"],
                        "depois": c["id_proximo_confronto"] if c else None,
                    },
                },
            }
            amostra.append(sample_entry)

    report = {
        "total_partidas_antes": total_partidas,
        "total_confrontos_depois": total_confrontos,
        "total_migrados": total_migrados,
        "valido": len(discrepancies) == 0,
        "discrepancias": discrepancies,
        "amostra": amostra,
    }

    return report, len(discrepancies) == 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--antes", required=True, type=Path, help="dump anonimizado antes da revisão 0004")
    parser.add_argument("--depois", required=True, type=Path, help="dump anonimizado após a revisão 0004")
    parser.add_argument("--amostra", type=int, default=10, help="tamanho da amostra para conferência humana")
    parser.add_argument("--relatorio", type=Path, help="arquivo JSON de saída; se omitido, usa stdout")
    args = parser.parse_args(argv)

    try:
        with connect_readonly(args.antes) as before, connect_readonly(args.depois) as after:
            report, valid = validate(before, after, sample_size=args.amostra)
    except (OSError, ValueError, sqlite3.Error) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 2

    serialized = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.relatorio:
        args.relatorio.write_text(serialized, encoding="utf-8")
    else:
        sys.stdout.write(serialized)

    if not valid:
        print(f"ERRO: validação de migração de confrontos falhou com {len(report['discrepancias'])} discrepâncias.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
