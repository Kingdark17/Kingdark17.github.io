using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/jogo.json de jogo/sala.ts, do começo do encontro de jogo/combate.ts e de criacao.ts e
    /// save-inicial.ts.
    /// </summary>
    internal sealed class JogoInteracaoFixtures : IFixtureModule
    {
        private const string M = "jogo";

        public void Register()
        {
            Fn(M, "lutaAoEntrar", (a, c) => W(Salas.LutaAoEntrar(R<DungeonCell>(a["celula"]))));
            Fn(M, "confirmaAoTocar", (a, c) => W(Salas.ConfirmaAoTocar(R<DungeonCell>(a["celula"]))));
            Fn(M, "interagir", (a, c) => W(Salas.Interagir(JogoJson.LerEstado(a["estado"]), c.RngFn, Str(a["pet"]), c.NowOrFail)));

            Fn(M, "salaDeCombate", (a, c) => W(Combates.SalaDeCombate(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "monstroAtual", (a, c) => W(Combates.MonstroAtual(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "inimigosRestantes", (a, c) => N(Combates.InimigosRestantes(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "iniciarEncontro", (a, c) => W(Combates.IniciarEncontro(R<EstadoNaMasmorra>(a["estado"]), Str(a["pet"]))));
            Fn(M, "comecarCombate", (a, c) => W(Combates.ComecarCombate(R<Combate>(a["combate"]))));

            Fn(M, "criacaoVazia", (a, c) => W(Criacoes.CriacaoVazia(Str(a["nome"]))));
            Fn(M, "faltaParaComecar", (a, c) => W(Criacoes.FaltaParaComecar(R<Criacao>(a["criacao"]))));
            Fn(M, "montarSaveInicial", (a, c) => W(Criacoes.MontarSaveInicial(R<Criacao>(a["criacao"]), c.RngFn, c.NowOrFail)));
        }
    }
}
