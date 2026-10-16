using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/jogo.json do que a tela mostra: jogo/apresentacao.ts, narrador.ts, neblina.ts,
    /// cartao.ts, maestria.ts e diario.ts. Os de cola percorrem a grade inteira, como o gerador.
    /// </summary>
    internal sealed class JogoTelaFixtures : IFixtureModule
    {
        private const string M = "jogo";

        private static EstadoDoJogo Estado(JToken token) => JogoJson.LerEstado(token);

        private static IEnumerable<RoomCell> Salas(EstadoDoJogo estado)
        {
            foreach (var linha in estado.Grade)
                foreach (var celula in linha)
                    yield return celula;
        }

        /// <summary>O <c>{ ...estado, pos }</c> do gerador.</summary>
        private static EstadoDoJogo Em(EstadoDoJogo estado, RoomCell celula)
        {
            var aqui = estado.Clone();
            aqui.Pos = new Posicao(celula.X, celula.Y);
            return aqui;
        }

        public void Register()
        {
            Fn(M, "apresentacaoDe (todas as salas)", (a, c) =>
            {
                var estado = Estado(a["estado"]);
                var visual = Apresentacoes.ApresentacaoDe(estado);
                var salas = new JArray();
                foreach (var sala in Salas(estado))
                {
                    salas.Add(new JObject
                    {
                        ["x"] = N(sala.X),
                        ["y"] = N(sala.Y),
                        ["icone"] = visual.Icone(sala),
                        ["descricao"] = visual.Descricao(sala),
                        ["textoDeEntrada"] = visual.TextoDeEntrada(sala),
                        ["rotulo"] = visual.Rotulo(sala),
                        ["gasta"] = visual.Gasta(sala),
                    });
                }
                return new JObject { ["lugar"] = visual.Lugar, ["legenda"] = W(visual.Legenda), ["salas"] = salas };
            });

            Fn(M, "narrar (todas as salas)", (a, c) =>
            {
                var estado = Estado(a["estado"]);
                var narracoes = new JArray();
                foreach (var sala in Salas(estado))
                    narracoes.Add(new JObject { ["x"] = N(sala.X), ["y"] = N(sala.Y), ["narracao"] = W(Narrador.Narrar(Em(estado, sala))) });
                return narracoes;
            });
            Fn(M, "narrar", (a, c) => W(Narrador.Narrar(Estado(a["estado"]))));

            Fn(M, "estadoDaSala (toda a grade)", (a, c) =>
            {
                var estado = Estado(a["estado"]);
                var estados = new JArray();
                foreach (var sala in Salas(estado)) estados.Add(Neblina.EstadoDaSala(estado.Grade, sala, estado.MapCols, estado.MapRows));
                return estados;
            });
            Fn(M, "sabeOTipo", (a, c) => W(Neblina.SabeOTipo(Str(a["estado"]))));

            Fn(M, "fraquezaNoCartao", (a, c) => W(Cartao.FraquezaNoCartao(R<Hero>(a["hero"]))));
            Fn(M, "poderesNoCartao", (a, c) => W(Cartao.PoderesNoCartao(R<Hero>(a["hero"]))));

            Fn(M, "armasDaMaestria", (a, c) => W(Maestria.ArmasDaMaestria(Str(a["hero"]["classId"]), Str(a["hero"]["className"]))));
            Fn(M, "maestriaNoCartao", (a, c) => W(Maestria.MaestriaNoCartao(R<Hero>(a["hero"]))));
            Fn(M, "maestriaSubiu", (a, c) => W(Maestria.MaestriaSubiu(R<Hero>(a["hero"]), Num(a["nivel"]))));

            Const(M, "LIMITE_DO_DIARIO", () => N(Diario.LimiteDoDiario));
            Fn(M, "anotar", (a, c) => W(Diario.Anotar(R<List<Anotacao>>(a["diario"]), R<Anotacao>(a["entrada"]))));
        }
    }
}
