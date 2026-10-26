using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/jogo.json de jogo/sala.ts, do começo do encontro de jogo/combate.ts, de fim-da-luta.ts e
    /// de criacao.ts e save-inicial.ts.
    /// </summary>
    internal sealed class JogoInteracaoFixtures : IFixtureModule
    {
        private const string M = "jogo";

        public void Register()
        {
            Fn(M, "lutaAoEntrar", (a, c) => W(Salas.LutaAoEntrar(R<DungeonCell>(a["celula"]))));
            Fn(M, "confirmaAoTocar", (a, c) => W(Salas.ConfirmaAoTocar(R<DungeonCell>(a["celula"]))));
            Fn(M, "interagir", (a, c) => W(Salas.Interagir(JogoJson.LerEstado(a["estado"]), c.RngFn, Str(a["pet"]), c.NowOrFail, JsJson.Truthy(a["app"]))));

            Fn(M, "salaDeCombate", (a, c) => W(Combates.SalaDeCombate(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "monstroAtual", (a, c) => W(Combates.MonstroAtual(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "inimigosRestantes", (a, c) => N(Combates.InimigosRestantes(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "iniciarEncontro", (a, c) => W(Combates.IniciarEncontro(R<EstadoNaMasmorra>(a["estado"]), Str(a["pet"]))));
            Fn(M, "comecarCombate", (a, c) => W(Combates.ComecarCombate(R<Combate>(a["combate"]))));
            Fn(M, "inimigosDaLuta", (a, c) => W(Combates.InimigosDaLuta(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "vezDoMonstro", (a, c) => NumOuNull(Combates.VezDoMonstro(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "alvoDaLuta", (a, c) => NumOuNull(Combates.AlvoDaLuta(R<Combate>(a["combate"]))));
            Fn(M, "escolherAlvo", (a, c) => W(Combates.EscolherAlvo(R<Combate>(a["combate"]), Num(a["indice"]))));

            // ---------- o começo e o fim da luta (fim-da-luta.ts) ----------

            Fn(M, "vivoNaSala", (a, c) => W(FimDaLuta.VivoNaSala(R<DungeonCell>(a["sala"]), Num(a["indice"]))));
            Fn(M, "indicesDePe", (a, c) => W(FimDaLuta.IndicesDePe(R<DungeonCell>(a["sala"]))));
            Fn(M, "gravarMonstro", (a, c) => W(FimDaLuta.GravarMonstro(R<EstadoNaMasmorra>(a["estado"]), Num(a["indice"]), R<CombatMonsterView>(a["monstro"]))));
            Fn(M, "prepararLuta", (a, c) => W(FimDaLuta.PrepararLuta(R<EstadoNaMasmorra>(a["estado"]))));
            Fn(M, "pagarAbate", (a, c) => W(FimDaLuta.PagarAbate(R<EstadoNaMasmorra>(a["estado"]), R<CombatMonsterView>(a["abatido"]))));
            Fn(M, "limparSala", (a, c) => W(FimDaLuta.LimparSala(R<EstadoNaMasmorra>(a["estado"]), R<CombatMonsterView>(a["abatido"]), c.RngFn, c.NowOrFail,
                JsJson.Truthy(a["app"]))));
            Fn(M, "perderLuta", (a, c) => W(FimDaLuta.PerderLuta(R<EstadoNaMasmorra>(a["estado"]), c.RngFn)));

            // O chefe final e o prêmio de quem zera.
            Fn(M, "poderDaVez", (a, c) => W(ChefeFinal.PoderDaVez(R<CombatMonster>(a["monstro"]))));
            Fn(M, "ferirMonstro", (a, c) => W(ChefeFinal.FerirMonstro(R<EstadoNaMasmorra>(a["estado"]), Num(a["indice"]), R<CombatMonster>(a["depois"]), c.RngFn)));
            Fn(M, "lacaiosDePe", (a, c) => W(ChefeFinal.LacaiosDePe(R<DungeonCell>(a["sala"]))));
            Fn(M, "protegido", (a, c) => W(ChefeFinal.Protegido(R<DungeonCell>(a["sala"]), Num(a["indice"]))));
            Fn(M, "enfurecer", (a, c) => W(ChefeFinal.Enfurecer(R<EstadoNaMasmorra>(a["estado"]))));
            Fn(M, "tituloDe", (a, c) => W(Conquistas.TituloDe(R<DungeonRun>(a["run"]))));
            Fn(M, "tituloDoHeroi", (a, c) => W(Conquistas.TituloDoHeroi(R<DungeonProgress>(a["progresso"]))));
            Fn(M, "ouroDoBau", (a, c) => N(Conquistas.OuroDoBau(Num(a["andar"]))));
            Fn(M, "abrirBauDoChefe", (a, c) => W(Conquistas.AbrirBauDoChefe(R<EstadoNaMasmorra>(a["estado"]), c.RngFn, c.NowOrFail, JsJson.Truthy(a["app"]))));

            Fn(M, "criacaoVazia", (a, c) => W(Criacoes.CriacaoVazia(Str(a["nome"]))));
            Fn(M, "faltaParaComecar", (a, c) => W(Criacoes.FaltaParaComecar(R<Criacao>(a["criacao"]))));
            Fn(M, "montarSaveInicial", (a, c) => W(Criacoes.MontarSaveInicial(R<Criacao>(a["criacao"]), c.RngFn, c.NowOrFail)));
        }

        /// <summary>O <c>number | null</c> do TS.</summary>
        private static Newtonsoft.Json.Linq.JToken NumOuNull(double? valor) =>
            valor.HasValue ? N(valor.Value) : Newtonsoft.Json.Linq.JValue.CreateNull();
    }
}
