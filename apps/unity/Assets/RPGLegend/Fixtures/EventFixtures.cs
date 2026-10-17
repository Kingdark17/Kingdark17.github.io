using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/events.json (events/events.ts). Cada handler reproduz o executor do gerador
    /// (scripts/gen-fixtures.ts, seção modulo('events')).
    /// </summary>
    internal sealed class EventFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "events";

            Const(M, "EVENT_TEMPLATES", () => W(DungeonEvents.Templates));

            Fn(M, "eventTemplateById", (a, c) => W(DungeonEvents.TemplateById(Str(a["id"]))));
            Fn(M, "randomEventTemplate", (a, c) => W(DungeonEvents.RandomTemplate(c.RngFn)));
            Fn(M, "eventXp", (a, c) => N(DungeonEvents.EventXp(Num(a["floor"]))));
            // O gerador chama resolveEvent(hero, floor, choice, { rng, now }): o now de args.options é só registro.
            Fn(M, "resolveEvent", (a, c) =>
                W(DungeonEvents.Resolve(R<Hero>(a["hero"]), Num(a["floor"]), Str(a["choice"]),
                    new EventResolveOptions { Rng = c.RngFn, Now = c.NowOrFail, App = RPGLegend.Engine.Json.JsJson.Truthy(RPGLegend.Engine.Json.JsJson.Prop(a["options"], "app")) })));
        }
    }
}
