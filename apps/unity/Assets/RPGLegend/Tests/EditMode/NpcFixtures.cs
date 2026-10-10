using System.Collections.Generic;
using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/npc.json (npc/npc-services.ts). Cada handler reproduz o executor do gerador
    /// (scripts/gen-fixtures.ts, seção modulo('npc')).
    /// </summary>
    internal sealed class NpcFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "npc";

            Const(M, "NPC_SERVICE_INFO", () => W(NpcServices.Info));

            Fn(M, "npcServiceInfo", (a, c) => W(NpcServices.InfoOf(Str(a["service"]))));
            Fn(M, "resolveHeal", (a, c) => W(NpcServices.ResolveHeal(R<Hero>(a["hero"]), Num(a["floor"]))));
            Fn(M, "resolveBlessing", (a, c) => W(NpcServices.ResolveBlessing(R<Hero>(a["hero"]))));
            Fn(M, "applyNpcBlessing", (a, c) => W(NpcServices.ApplyNpcBlessing(R<Hero>(a["hero"]))));
            // O gerador chama resolveBarter(inventory, floor, { rng, now }): o now de args.options é só registro.
            Fn(M, "resolveBarter", (a, c) =>
                W(NpcServices.ResolveBarter(R<List<Item>>(a["inventory"]), Num(a["floor"]), new BarterOptions { Rng = c.RngFn, Now = c.NowOrFail })));
            Fn(M, "resolveReveal", (a, c) =>
                W(NpcServices.ResolveReveal(R<List<List<DungeonCell>>>(a["grid"]), R<GridPosition>(a["pos"]))));
            Fn(M, "resolveRecruit", (a, c) => W(NpcServices.ResolveRecruit(R<List<Companion>>(a["party"]), c.RngFn)));
        }
    }
}
