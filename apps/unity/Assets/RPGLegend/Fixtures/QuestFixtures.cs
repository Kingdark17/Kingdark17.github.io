using System.Collections.Generic;
using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/quests.json (quests/quests.ts). Cada handler reproduz o executor do gerador
    /// (scripts/gen-fixtures.ts, seção modulo('quests')): as funções que sorteiam recebem { rng, now } do caso;
    /// o now de args.options é só registro.
    /// </summary>
    internal sealed class QuestFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "quests";

            Fn(M, "generateQuest", (a, c) => W(Quests.Generate(Num(a["floor"]), Options(c))));
            Fn(M, "ensureQuestBoard", (a, c) => W(Quests.EnsureBoard(R<List<Quest>>(a["quests"]), Num(a["floor"]), Options(c))));
            Fn(M, "onMonsterKilled", (a, c) => W(Quests.OnMonsterKilled(R<List<Quest>>(a["quests"]))));
            Fn(M, "onFloorReached", (a, c) => W(Quests.OnFloorReached(R<List<Quest>>(a["quests"]), Num(a["floor"]))));
            Fn(M, "onItemCollected", (a, c) => W(Quests.OnItemCollected(R<List<Quest>>(a["quests"]))));
            Fn(M, "claimQuest", (a, c) =>
                W(Quests.Claim(R<Hero>(a["hero"]), R<List<Quest>>(a["quests"]), Str(a["targetId"]), Num(a["floor"]), Options(c))));
        }

        private static GenerateQuestOptions Options(CaseContext c) => new GenerateQuestOptions { Rng = c.RngFn, Now = c.NowOrFail };
    }
}
