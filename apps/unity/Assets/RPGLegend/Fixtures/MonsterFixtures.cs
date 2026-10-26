using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/monsters.json (species e generate) e os de fixtures/combat.json que são de
    /// combat/monster-state.ts (freshCombatMonster, setStatusField, decrementField).
    /// </summary>
    internal sealed class MonsterFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "monsters";

            // ---------- species ----------
            Const(M, "BEHAVIORS", () => W(MonsterCatalog.Behaviors));
            Const(M, "AFFINITY_TYPES", () => W(MonsterCatalog.AffinityTypes));
            Const(M, "SPECIES", () => W(MonsterCatalog.Species));
            Const(M, "ENEMY_CLASSES", () => W(MonsterCatalog.EnemyClasses));
            Const(M, "TIER_ADJECTIVES", () => W(MonsterCatalog.TierAdjectives));
            Const(M, "BOSS_TITLES", () => W(MonsterCatalog.BossTitles));
            Fn(M, "speciesById", (a, c) => W(MonsterCatalog.SpeciesById(Str(a["id"]))));
            Fn(M, "enemyClassById", (a, c) => W(MonsterCatalog.EnemyClassById(Str(a["id"]))));
            Fn(M, "tierLabelFor", (a, c) => W(MonsterCatalog.TierLabelFor(Num(a["floor"]))));

            // ---------- generate ----------
            // O gerador chama generate*(floor, { ...args.options, rng }).
            Fn(M, "generate", (a, c) => W(Monsters.Generate(Num(a["floor"]), Options(a["options"], c))));
            Fn(M, "generateBoss", (a, c) => W(Monsters.GenerateBoss(Num(a["floor"]), Options(a["options"], c))));
            Fn(M, "generateMimic", (a, c) => W(Monsters.GenerateMimic(Num(a["floor"]), Options(a["options"], c))));
            // Lido no tipo mais rico (a visão): assim nenhum campo conhecido do monstro cai no Extra.
            Fn(M, "monsterView", (a, c) => W(Monsters.View(R<CombatMonsterView>(a["monster"]))));

            // ---------- combat/monster-state ----------
            const string C = "combat";
            Fn(C, "freshCombatMonster", (a, c) => W(MonsterState.FreshCombatMonster(R<MonsterInstance>(a["monster"]))));
            Fn(C, "setStatusField", (a, c) =>
            {
                string key = Str(a["key"]);
                return W(MonsterState.SetStatusField(R<MonsterStatus>(a["status"]), key, StatusValue(key, a["value"])));
            });
            // O TS não distingue DotStatus de AmountStatus em tempo de execução; aqui o formato decide.
            Fn(C, "decrementField", (a, c) =>
            {
                var s = a["status"];
                TurnStatus status = JsJson.IsUndefined(JsJson.Prop(s, "dmg")) ? (TurnStatus)R<AmountStatus>(s) : R<DotStatus>(s);
                var next = MonsterState.DecrementField(status);
                return next == null ? null : W(next);
            });
        }

        private static Monsters.GenerateOptions Options(JToken options, CaseContext c) => new Monsters.GenerateOptions
        {
            Rng = c.RngFn,
            Species = R<List<string>>(JsJson.Prop(options, "species")),
            Main = R<bool?>(JsJson.Prop(options, "main")),
            Final = JsJson.Truthy(JsJson.Prop(options, "final")),
        };

        /// <summary>
        /// O valor de setStatusField no tipo da chave (DotStatus, AmountStatus ou número). Quem decide é o
        /// próprio MonsterStatus: lê <c>{ [key]: value }</c> e devolve o campo; chave desconhecida fica com o
        /// valor cru. Ausente é null (o undefined, que remove a chave).
        /// </summary>
        private static object StatusValue(string key, JToken value)
        {
            if (JsJson.IsUndefined(value)) return null;
            return R<MonsterStatus>(new JObject { [key] = value.DeepClone() }).Get(key);
        }
    }
}
