"""Portal publico: leitura sem login, 404 para o que nao foi publicado.

Os testes usam HTTP real sem cabecalho de autenticacao.
"""

from __future__ import annotations

import uuid
from datetime import date

from competicoes.contratos.configuracao import validar_configuracao
from competicoes.modelos import Partida

from .factories import (
    criar_competicao,
    criar_competidor,
    criar_edicao_competicao,
    criar_edicao_evento,
    criar_equipe,
    criar_evento,
    criar_integrante,
)

PONTOS = {"formato": "PONTOS_CORRIDOS", "desempates": ["SALDO_GOLS"]}


def _edicao(db, *, competicao=None, publicada=True, formato="PONTOS_CORRIDOS",
            configuracao=PONTOS, equipes=0, **campos):
    config = validar_configuracao(formato, configuracao).model_dump(mode="json")
    edicao = criar_edicao_competicao(
        db, competicao, formato=formato, configuracao=config, publicada=publicada, **campos
    )
    lista = []
    for i in range(equipes):
        equipe = criar_equipe(db, edicao, nome=f"Time {edicao.id_edicao_competicao}-{i}")
        criar_integrante(db, equipe, criar_competidor(db), nome_esportivo=f"Craque {i}", numero_camisa=10 + i)
        lista.append(equipe)
    db.commit()
    return edicao, lista


class TestPublicacaoEVisibilidade:
    def test_edicao_nao_publicada_e_inexistente_retornam_mesmo_404(self, client, db):
        privada, _ = _edicao(db, publicada=False)
        r_privada = client.get(f"/competicoes/publico/edicoes/{privada.id_edicao_competicao}")
        r_inexistente = client.get("/competicoes/publico/edicoes/999999")
        assert r_privada.status_code == 404
        assert r_inexistente.status_code == 404
        assert r_privada.json() == r_inexistente.json()
        assert r_privada.json()["codigo"] == "NAO_ENCONTRADO"

    def test_rascunho_publicado_aparece_e_cancelada_despublicada_some(self, client, db, usuario):
        from competicoes.servicos.organizacao import cancelar_edicao_competicao, publicar_edicao

        edicao, _ = _edicao(db, publicada=False)
        publicar_edicao(db, edicao.id_edicao_competicao, True, usuario)
        resposta = client.get(f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}")
        assert resposta.status_code == 200
        assert resposta.json()["estado"] == "RASCUNHO"

        cancelar_edicao_competicao(db, edicao.id_edicao_competicao, "Sem quorum", usuario)
        publicar_edicao(db, edicao.id_edicao_competicao, False, usuario)
        assert client.get(f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}").status_code == 404

    def test_competicao_sem_edicao_publicada_nao_aparece(self, client, db):
        edicao, _ = _edicao(db, publicada=False)
        slug = edicao.competicao.slug
        slugs = [c["slug"] for c in client.get("/competicoes/publico/competicoes").json()]
        assert slug not in slugs
        assert client.get(f"/competicoes/publico/competicoes/{slug}").status_code == 404

    def test_evento_mostra_so_edicoes_com_disputa_publicada(self, client, db):
        evento = criar_evento(db)
        com_publicada = criar_edicao_evento(db, evento, identificacao="2026")
        so_privada = criar_edicao_evento(db, evento, identificacao="2027",
                                         data_inicio=date(2027, 1, 1), data_fim=date(2027, 12, 31))
        _edicao(db, id_edicao_evento=com_publicada.id_edicao_evento)
        _edicao(db, publicada=False, id_edicao_evento=so_privada.id_edicao_evento,
                data_inicio=date(2027, 3, 1), data_fim=date(2027, 6, 30))

        resposta = client.get(f"/competicoes/publico/eventos/{evento.slug}")
        assert resposta.status_code == 200
        assert [e["identificacao"] for e in resposta.json()["edicoes"]] == ["2026"]
        assert evento.slug in [e["slug"] for e in client.get("/competicoes/publico/eventos").json()]

    def test_evento_sem_disputa_publicada_e_404(self, client, db):
        evento = criar_evento(db)
        edicao_evento = criar_edicao_evento(db, evento)
        _edicao(db, publicada=False, id_edicao_evento=edicao_evento.id_edicao_evento)
        assert client.get(f"/competicoes/publico/eventos/{evento.slug}").status_code == 404
        assert evento.slug not in [e["slug"] for e in client.get("/competicoes/publico/eventos").json()]

    def test_competicao_arquivada_sai_da_lista_mas_edicao_continua_acessivel(self, client, db):
        edicao, _ = _edicao(db)
        edicao.competicao.arquivado = True
        db.commit()
        slugs = [c["slug"] for c in client.get("/competicoes/publico/competicoes").json()]
        assert edicao.competicao.slug not in slugs
        assert client.get(f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}").status_code == 200


class TestElencoEHistorico:
    def test_elenco_publico_nao_vaza_dados_privados(self, client, db):
        edicao, _ = _edicao(db)
        equipe = criar_equipe(db, edicao, nome="Leões")
        competidor = criar_competidor(db, documento="DOC-SECRETO-123", data_nascimento=date(2011, 4, 5))
        criar_integrante(db, equipe, competidor, nome_esportivo="Pelézinho", numero_camisa=10, posicao="ATA")
        criar_integrante(db, equipe, criar_competidor(db), nome_esportivo="Reserva Inativo", situacao="INATIVO")
        db.commit()

        resposta = client.get(f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}")
        assert resposta.status_code == 200
        assert "DOC-SECRETO-123" not in resposta.text
        assert "2011-04-05" not in resposta.text
        assert "Reserva Inativo" not in resposta.text
        (leoes,) = [e for e in resposta.json()["equipes"] if e["nome"] == "Leões"]
        assert leoes["integrantes"] == [{"nome_esportivo": "Pelézinho", "numero_camisa": 10, "posicao": "ATA"}]

    def test_historico_duas_edicoes_nao_se_misturam(self, client, db):
        competicao = criar_competicao(db)
        e2025, eq2025 = _edicao(db, competicao=competicao, identificacao="2025",
                                data_inicio=date(2025, 3, 1), data_fim=date(2025, 6, 30), equipes=2)
        e2026, eq2026 = _edicao(db, competicao=competicao, identificacao="2026", equipes=3)

        detalhe = client.get(f"/competicoes/publico/competicoes/{competicao.slug}").json()
        assert [e["identificacao"] for e in detalhe["edicoes"]] == ["2026", "2025"]

        r2025 = client.get(f"/competicoes/publico/edicoes/{e2025.id_edicao_competicao}").json()
        r2026 = client.get(f"/competicoes/publico/edicoes/{e2026.id_edicao_competicao}").json()
        assert {e["id_equipe"] for e in r2025["equipes"]} == {e.id_equipe for e in eq2025}
        assert {e["id_equipe"] for e in r2026["equipes"]} == {e.id_equipe for e in eq2026}
        assert "configuracao" not in r2026


def _resultado(db, partida, gm, gv, usuario):
    from competicoes.contratos.partidas import ResultadoSimples
    from competicoes.servicos.partidas import registrar_resultado_simples

    registrar_resultado_simples(
        db, id_partida=partida.id_partida,
        dados=ResultadoSimples(gols_mandante=gm, gols_visitante=gv),
        idempotency_key=str(uuid.uuid4()), responsavel=usuario,
    )


class TestDisputaPublica:
    def test_partidas_publicas_sem_placar_quando_agendadas(self, client, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao(db, equipes=4)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        url = f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}/partidas"

        partidas = client.get(url).json()
        assert len(partidas) == 6
        assert all(p["estado"] == "AGENDADA" and p["gols_mandante"] is None for p in partidas)
        assert all(p["data"] is None and p["local"] is None for p in partidas)

        alvo = db.get(Partida, partidas[0]["id_partida"])
        _resultado(db, alvo, 2, 1, usuario)
        (atualizada,) = [p for p in client.get(url).json() if p["id_partida"] == alvo.id_partida]
        assert (atualizada["gols_mandante"], atualizada["gols_visitante"]) == (2, 1)
        assert atualizada["nome_mandante"]

    def test_classificacao_publica_espelha_a_administrativa(self, client, db, usuario):
        from competicoes.servicos.classificacao import obter_classificacao_edicao
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao(db, equipes=3)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        primeira = db.query(Partida).filter(
            Partida.id_edicao_competicao == edicao.id_edicao_competicao
        ).first()
        _resultado(db, primeira, 3, 0, usuario)

        admin = obter_classificacao_edicao(db, edicao.id_edicao_competicao)
        publica = client.get(
            f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}/classificacao"
        ).json()
        assert [(l["posicao"], l["id_equipe"], l["pontos"]) for l in publica["linhas"]] == [
            (l.posicao, l.id_equipe, l.pontos) for l in admin.linhas
        ]

    def test_chaveamento_publico_descreve_vagas_pendentes(self, client, db, usuario):
        from competicoes.servicos.disputa import gerar_tabela_edicao

        edicao, _ = _edicao(db, formato="MATA_MATA", configuracao={"formato": "MATA_MATA"}, equipes=4)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        duelos = client.get(
            f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}/chaveamento"
        ).json()["duelos"]

        (final,) = [d for d in duelos if d["fase"] == "FINAL"]
        assert [v["descricao_origem"] for v in final["vagas"]] == [
            "Vencedor da Semifinal 1", "Vencedor da Semifinal 2",
        ]
        assert all(v["nome_equipe"] is None for v in final["vagas"])
        semi = next(d for d in duelos if d["fase"] == "SEMIFINAL")
        assert all(v["nome_equipe"] for v in semi["vagas"])
        assert [d["fase"] for d in duelos] == ["SEMIFINAL", "SEMIFINAL", "FINAL"]

    def test_artilharia_publica_sem_ids_internos(self, client, db, usuario):
        from competicoes.contratos.sumula import OcorrenciaCriar
        from competicoes.modelos import IntegranteEquipe
        from competicoes.servicos.disputa import gerar_tabela_edicao
        from competicoes.servicos.sumula import finalizar_partida, registrar_ocorrencia

        edicao, _ = _edicao(db, equipes=2)
        gerar_tabela_edicao(db, edicao.id_edicao_competicao, None, usuario)
        partida = db.query(Partida).filter(
            Partida.id_edicao_competicao == edicao.id_edicao_competicao
        ).one()
        autor = db.query(IntegranteEquipe).filter(
            IntegranteEquipe.id_equipe == partida.id_equipe_mandante
        ).one()
        registrar_ocorrencia(db, partida.id_partida, OcorrenciaCriar(
            tipo="GOL", id_equipe=partida.id_equipe_mandante, id_integrante=autor.id_integrante,
        ), None, usuario)
        finalizar_partida(db, partida.id_partida, None, usuario)

        artilharia = client.get(
            f"/competicoes/publico/edicoes/{edicao.id_edicao_competicao}/artilharia"
        ).json()
        (artilheiro,) = artilharia["artilheiros"]
        assert set(artilheiro) == {
            "posicao", "nome_esportivo", "numero_camisa", "id_equipe", "nome_equipe", "gols",
            "gols_em_andamento",
        }
        assert artilheiro["gols"] == 1

    def test_subrecursos_de_edicao_nao_publicada_retornam_404(self, client, db):
        privada, _ = _edicao(db, publicada=False, equipes=2)
        for recurso in ("partidas", "classificacao", "chaveamento", "artilharia"):
            resposta = client.get(
                f"/competicoes/publico/edicoes/{privada.id_edicao_competicao}/{recurso}"
            )
            assert resposta.status_code == 404, recurso
