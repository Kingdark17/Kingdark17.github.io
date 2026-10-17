using System;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/jogo.json que são de jogo/estado.ts e jogo/tutorial.ts.</summary>
    internal sealed class JogoEstadoFixtures : IFixtureModule
    {
        private const string M = "jogo";

        private static EstadoDoJogo Estado(JToken token) => JogoJson.LerEstado(token);

        private static double? Opcional(JToken token) => JsJson.IsUndefined(token) ? (double?)null : Num(token);

        public void Register()
        {
            // ---------- estado ----------

            Const(M, "LINHAS_DO_MAPA", () => N(Estados.LinhasDoMapa));
            Const(M, "COLUNAS_DO_MAPA", () => N(Estados.ColunasDoMapa));
            Const(M, "PRIMEIRO_ANDAR", () => N(Estados.PrimeiroAndar));

            Fn(M, "andarDeForca", (a, c) => N(Estados.AndarDeForca(R<DungeonRun>(a["masmorra"]), Num(a["floor"]))));
            Fn(M, "retomarSave", (a, c) => W(Estados.RetomarSave(JogoJson.LerSave(a["save"]), c.RngFn, c.NowOrFail)));
            Fn(M, "entrarNaCidade", (a, c) => W(Estados.EntrarNaCidade(JogoJson.LerSave(a["save"]))));
            Fn(M, "entrarNaMasmorra", (a, c) => W(Estados.EntrarNaMasmorra((EstadoNaCidade)Estado(a["estado"]), c.RngFn, R<DungeonRun>(a["masmorra"]),
                Opcional(a["andar"]), c.NowOrFail, JsJson.Truthy(a["app"]))));
            Fn(M, "voltarParaCidade", (a, c) => W(Estados.VoltarParaCidade((EstadoNaMasmorra)Estado(a["estado"]))));
            Fn(M, "descerEscada", (a, c) => W(Estados.DescerEscada((EstadoNaMasmorra)Estado(a["estado"]), c.RngFn, c.NowOrFail, JsJson.Truthy(a["app"]))));
            Fn(M, "avancarAndar", (a, c) => W(Estados.AvancarAndar((EstadoNaMasmorra)Estado(a["estado"]), c.RngFn, c.NowOrFail, JsJson.Truthy(a["app"]))));
            Fn(M, "temChefeVivo", (a, c) => W(Estados.TemChefeVivo((EstadoNaMasmorra)Estado(a["estado"]))));

            // Cola de teste: os mesmos pontos do gerador, um caso por estado.
            Fn(M, "celulaEm (pontos da grade)", (a, c) =>
            {
                var estado = Estado(a["estado"]);
                var pontos = new[]
                {
                    estado.Pos, new Posicao(0, 0), new Posicao(5, 5), new Posicao(6, 2), new Posicao(-1, 0), new Posicao(0, 9), new Posicao(2.5, 1),
                };
                var salas = new JArray();
                foreach (var ponto in pontos) salas.Add(W(Estados.CelulaEm(estado, ponto)));
                return salas;
            });
            Fn(M, "celulaAtual", (a, c) => W(Estados.CelulaAtual(Estado(a["estado"]))));
            Fn(M, "vizinhaEm e podeAndar (as quatro direções)", (a, c) =>
            {
                var estado = Estado(a["estado"]);
                var direcoes = new JArray();
                foreach (var d in Directions.Order)
                    direcoes.Add(new JObject { ["direcao"] = d, ["vizinha"] = W(Estados.VizinhaEm(estado, d)), ["pode"] = Estados.PodeAndar(estado, d) });
                return direcoes;
            });
            Fn(M, "andar", (a, c) => W(Estados.Andar(Estado(a["estado"]), Str(a["direcao"]))));
            Fn(M, "andar (parede devolve o mesmo estado)", (a, c) =>
            {
                var estado = Estado(a["estado"]);
                return W(ReferenceEquals(Estados.Andar(estado, Str(a["direcao"])), estado));
            });
            Fn(M, "revelar", (a, c) => W(Estados.Revelar(Estado(a["estado"]), R<Posicao>(a["posicao"]))));
            Fn(M, "substituirCelulaAtual", (a, c) =>
            {
                var estado = Estado(a["estado"]);
                return estado is EstadoNaMasmorra masmorra
                    ? W(Estados.SubstituirCelulaAtual(masmorra, R<DungeonCell>(a["celula"])))
                    : W(Estados.SubstituirCelulaAtual((EstadoNaCidade)estado, R<CityCell>(a["celula"])));
            });

            // ---------- tutorial ----------

            Const(M, "PASSOS", () => W(Tutoriais.Passos));
            Const(M, "GUIAS", () => W(Tutoriais.Guias));

            Fn(M, "tutorialDe", (a, c) => W(Tutoriais.TutorialDe(Estado(a["estado"]))));
            Fn(M, "concluidos", (a, c) => N(Tutoriais.Concluidos(R<Tutorial>(a["tutorial"]))));
            Fn(M, "marcar", (a, c) => W(Tutoriais.Marcar(Estado(a["estado"]), Str(a["id"]), c.RngFn, c.NowOrFail)));
        }
    }
}
