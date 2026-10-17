using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/jogo.json de jogo/mochila.ts e jogo/impacto.ts.</summary>
    internal sealed class JogoMochilaFixtures : IFixtureModule
    {
        private const string M = "jogo";

        public void Register()
        {
            Fn(M, "abrirMochila", (a, c) => W(Mochilas.AbrirMochila(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "podeEquipar", (a, c) => W(Mochilas.PodeEquipar(R<Item>(a["item"]))));
            Fn(M, "podeUsar", (a, c) => W(Mochilas.PodeUsar(R<Item>(a["item"]))));
            Fn(M, "aceitaMaoSecundaria", (a, c) => W(Mochilas.AceitaMaoSecundaria(R<Item>(a["item"]))));
            Fn(M, "slotDoItem", (a, c) => W(Mochilas.SlotDoItem(JogoJson.LerEstado(a["estado"]), R<Item>(a["item"]))));
            Fn(M, "armaQueOcupaAsMaos", (a, c) => W(Mochilas.ArmaQueOcupaAsMaos(JogoJson.LerEstado(a["estado"]), R<Item>(a["item"]))));

            Fn(M, "equipar", (a, c) => W(Mochilas.Equipar(R<Mochila>(a["mochila"]), R<Item>(a["item"]), Str(a["slot"]))));
            Fn(M, "desequipar", (a, c) => W(Mochilas.Desequipar(R<Mochila>(a["mochila"]), Str(a["slot"]))));
            Fn(M, "usar", (a, c) => W(Mochilas.Usar(R<Mochila>(a["mochila"]), R<Item>(a["item"]))));
            Fn(M, "equiparNoLugarDaArma", (a, c) => W(Mochilas.EquiparNoLugarDaArma(R<Mochila>(a["mochila"]), R<Item>(a["item"]))));
            Fn(M, "descartar", (a, c) => W(Mochilas.Descartar(R<Mochila>(a["mochila"]), R<Item>(a["item"]))));
            Fn(M, "engastarRuna", (a, c) =>
                W(Mochilas.EngastarRuna(R<Mochila>(a["mochila"]), R<Item>(a["arma"]), R<Item>(a["runa"]), JsJson.ToOptionalNumber(a["indice"]))));
            Fn(M, "tirarRuna", (a, c) => W(Mochilas.TirarRuna(R<Mochila>(a["mochila"]), R<Item>(a["arma"]), Num(a["indice"]), c.RngFn, c.NowOrFail)));
            Fn(M, "chanceDeQuebrar", (a, c) => N(Mochilas.ChanceDeQuebrar(R<Item>(a["arma"]), Num(a["indice"]))));
            Fn(M, "gastarPonto", (a, c) => W(Mochilas.GastarPonto(R<Mochila>(a["mochila"]), Str(a["chave"]))));

            Fn(M, "impactoDaPeca", (a, c) => W(Impactos.ImpactoDaPeca(R<Hero>(a["hero"]), R<Item>(a["item"]), Str(a["slotDesejado"]))));
        }
    }
}
