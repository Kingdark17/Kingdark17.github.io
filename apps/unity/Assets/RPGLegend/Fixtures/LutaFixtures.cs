using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/luta.json: a luta em tempo real do app (luta/eventos-de-arma.ts, luta/arena.ts e o resolverGolpe).</summary>
    internal sealed class LutaFixtures : IFixtureModule
    {
        private const string M = "luta";

        public void Register()
        {
            Fn(M, "eventoDaArma", (a, c) => W(EventosDeArma.EventoDaArma(Str(a["templateId"]), JsJson.Truthy(a["teclado"]))));
            Fn(M, "eventoDoAtaque", (a, c) => W(EventosDeArma.EventoDoAtaque(R<Hero>(a["hero"]), Str(a["estilo"]), c.RngFn, JsJson.Truthy(a["teclado"]))));
            Fn(M, "lerEvento", (a, c) => W(EventosDeArma.LerEvento(R<EventoDeArma>(a["evento"]), R<JogadaDoEvento>(a["jogada"]))));
            Fn(M, "abrirLuta", (a, c) => W(Arenas.AbrirLuta(R<EstadoNaMasmorra>(a["estado"]), R<Walker>(a["chegada"]), Str(a["pet"]), JsJson.Truthy(a["teclado"]))));
            Fn(M, "simularLuta", (a, c) => W(Arenas.SimularLuta(R<LutaEmTempoReal>(a["luta"]), R<System.Collections.Generic.List<EntradaDaLuta>>(a["entradas"]), c.RngFn, c.NowOrFail)));
            // O gerador chama resolverGolpe(hero, monster, dado, leitura, attackStyle, { ...args.options, rng }).
            Fn(M, "resolverGolpe", (a, c) =>
            {
                var options = new ResolveAttackOptions
                {
                    Rng = c.RngFn,
                    PetCriticoBonus = JsJson.ToOptionalNumber(JsJson.Prop(a["options"], "petCriticoBonus")),
                };
                return W(Attack.ResolverGolpe(R<Hero>(a["hero"]), R<CombatMonsterView>(a["monster"]), Num(a["dado"]), R<LeituraDaMira>(a["leitura"]),
                    Str(a["attackStyle"]), options));
            });
        }
    }
}
