using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: DIR_VECTORS[direção] — o passo de uma direção na grade (<c>{ x, y }</c>).</summary>
    public sealed class DirVector
    {
        public double X;
        public double Y;
    }

    /// <summary>
    /// As tabelas de dungeon/graph.ts (fixtures/data/dungeon/graph.json). A direção (TS: Direction) é texto:
    /// "N", "S", "E" ou "W".
    /// </summary>
    public sealed class DungeonGraphData
    {
        [JsName("DIR_VECTORS")] public OrderedMap<DirVector> DirVectors = new OrderedMap<DirVector>();
        [JsName("DIR_LABEL")] public OrderedMap<string> DirLabel = new OrderedMap<string>();
        [JsName("DIR_OPP")] public OrderedMap<string> DirOpp = new OrderedMap<string>();
        /// <summary>N, S, E, W: a ordem que o gerador do grafo embaralha.</summary>
        [JsName("DIR_ORDER")] public List<string> DirOrder = new List<string>();
    }

    /// <summary>TS: DungeonDef.</summary>
    public sealed class DungeonDef
    {
        /// <summary>TS: DungeonId — floresta, caverna, torre.</summary>
        public string Id;
        public string Name;
        public string Icon;
        public double MinLevel;
        /// <summary>A masmorra que precisa estar zerada, no Normal, antes desta abrir; null de propósito na Floresta.</summary>
        [KeepNull] public string Requires;
        /// <summary>Ids de monsters/species que aparecem aqui.</summary>
        public List<string> Species = new List<string>();
    }

    /// <summary>TS: DifficultyDef.</summary>
    public sealed class DifficultyDef
    {
        /// <summary>TS: DifficultyId — normal, dificil, pesadelo.</summary>
        public string Id;
        public string Name;
    }

    /// <summary>As tabelas de dungeon/dungeons.ts (fixtures/data/dungeon/dungeons.json).</summary>
    public sealed class DungeonsData
    {
        [JsName("DUNGEONS")] public List<DungeonDef> Dungeons = new List<DungeonDef>();
        [JsName("DIFFICULTIES")] public List<DifficultyDef> Difficulties = new List<DifficultyDef>();
        [JsName("DUNGEON_FLOORS")] public double DungeonFloors;
        [JsName("TOTEM_FLOORS")] public List<double> TotemFloors = new List<double>();
        [JsName("DEFAULT_RUN")] public DungeonRun DefaultRun;
        [JsName("FLOORS_PER_DUNGEON")] public double FloorsPerDungeon;
    }

    public static partial class GameData
    {
        private static DungeonGraphData _dungeonGraphTable;
        private static DungeonsData _dungeonsTable;

        /// <summary>dungeon/graph: as direções.</summary>
        public static DungeonGraphData DungeonGraphTable
        {
            get => Require(_dungeonGraphTable, "dungeon/graph");
            set => _dungeonGraphTable = value;
        }

        /// <summary>dungeon/dungeons: masmorras, dificuldades, totens.</summary>
        public static DungeonsData DungeonsTable
        {
            get => Require(_dungeonsTable, "dungeon/dungeons");
            set => _dungeonsTable = value;
        }
    }
}
