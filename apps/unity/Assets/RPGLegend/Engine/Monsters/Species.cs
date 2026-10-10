using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Species — a ficha de uma espécie de monstro, de onde a instância sai.</summary>
    public sealed class SpeciesDef
    {
        public string Id;
        public string Name;
        public string Icon;
        /// <summary>Um de BEHAVIORS ("agressivo", "agil", "defensivo", "venenoso", "lento", "magico").</summary>
        public string Behavior;
        public double BaseHp;
        public double BaseSpeed;
        public double BaseDmg;
        /// <summary>Um de AFFINITY_TYPES ("fisico", "magico", "nenhuma").</summary>
        public string Weakness;
        /// <summary>Um de AFFINITY_TYPES ("fisico", "magico", "nenhuma").</summary>
        public string Resistance;
        public string Ability;
        public string AbilityDesc;
    }

    /// <summary>TS: EnemyClass — a classe de inimigo, que multiplica vida, dano e velocidade da espécie.</summary>
    public sealed class EnemyClassDef
    {
        public string Id;
        public string Name;
        public string Icon;
        public string Power;
        public string PowerDesc;
        public double HpMult;
        public double DmgMult;
        public double SpeedMult;
    }

    /// <summary>TS: TierAdjective — o adjetivo que o nome do monstro ganha numa faixa de andares.</summary>
    public sealed class TierAdjective
    {
        public double Min;
        public double Max;
        public string Label;
    }

    /// <summary>As tabelas de monsters/species.ts (fixtures/data/monsters/species.json).</summary>
    public sealed class MonsterSpeciesData
    {
        [JsName("BEHAVIORS")] public List<string> Behaviors = new List<string>();
        [JsName("AFFINITY_TYPES")] public List<string> AffinityTypes = new List<string>();
        [JsName("SPECIES")] public List<SpeciesDef> Species = new List<SpeciesDef>();
        [JsName("ENEMY_CLASSES")] public List<EnemyClassDef> EnemyClasses = new List<EnemyClassDef>();
        [JsName("TIER_ADJECTIVES")] public List<TierAdjective> TierAdjectives = new List<TierAdjective>();
        [JsName("BOSS_TITLES")] public List<string> BossTitles = new List<string>();
    }

    /// <summary>Port de shared/src/monsters/species.ts: as tabelas de monstros e as buscas nelas.</summary>
    public static class MonsterCatalog
    {
        private static MonsterSpeciesData D => GameData.SpeciesTable;

        /// <summary>TS: BEHAVIORS.</summary>
        public static List<string> Behaviors => D.Behaviors;

        /// <summary>TS: AFFINITY_TYPES.</summary>
        public static List<string> AffinityTypes => D.AffinityTypes;

        /// <summary>TS: SPECIES.</summary>
        public static List<SpeciesDef> Species => D.Species;

        /// <summary>TS: ENEMY_CLASSES.</summary>
        public static List<EnemyClassDef> EnemyClasses => D.EnemyClasses;

        /// <summary>TS: TIER_ADJECTIVES.</summary>
        public static List<TierAdjective> TierAdjectives => D.TierAdjectives;

        /// <summary>TS: BOSS_TITLES.</summary>
        public static List<string> BossTitles => D.BossTitles;

        /// <summary>
        /// TS: speciesById — null quando o id não existe. No TS a busca é um Map montado da lista,
        /// então, se um id se repetisse, valeria o último; por isso a busca anda de trás para a frente.
        /// </summary>
        public static SpeciesDef SpeciesById(string id)
        {
            var all = Species;
            for (int i = all.Count - 1; i >= 0; i--)
                if (all[i].Id == id) return all[i];
            return null;
        }

        /// <summary>TS: enemyClassById — null quando o id não existe (Map no TS: id repetido, vale o último).</summary>
        public static EnemyClassDef EnemyClassById(string id)
        {
            var all = EnemyClasses;
            for (int i = all.Count - 1; i >= 0; i--)
                if (all[i].Id == id) return all[i];
            return null;
        }

        /// <summary>TS: tierLabelFor — o adjetivo da faixa do andar; "" fora de todas (abaixo de 1, acima de 99, NaN).</summary>
        public static string TierLabelFor(double floor)
        {
            foreach (var t in TierAdjectives)
                if (floor >= t.Min && floor <= t.Max) return t.Label;
            return "";
        }
    }
}
