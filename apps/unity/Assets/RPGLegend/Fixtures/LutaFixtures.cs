using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/luta.json: a luta em tempo real do app (luta/eventos-de-arma.ts e o resolverGolpe).</summary>
    internal sealed class LutaFixtures : IFixtureModule
    {
        private const string M = "luta";

        public void Register()
        {
            Fn(M, "eventoDaArma", (a, c) => W(EventosDeArma.EventoDaArma(Str(a["templateId"]))));
            Fn(M, "eventoDoAtaque", (a, c) => W(EventosDeArma.EventoDoAtaque(R<Hero>(a["hero"]), Str(a["estilo"]), c.RngFn)));
            Fn(M, "lerEvento", (a, c) => W(EventosDeArma.LerEvento(R<EventoDeArma>(a["evento"]), R<JogadaDoEvento>(a["jogada"]))));
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
