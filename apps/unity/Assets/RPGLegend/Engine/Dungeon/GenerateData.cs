using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: NpcTemplate (privada de dungeon/generate.ts) — um NPC que a masmorra sorteia.</summary>
    public sealed class DungeonNpcTemplate
    {
        public string Name;
        public string Role;
        /// <summary>TS: NpcService — um de <see cref="NpcServiceIds"/>.</summary>
        public string Service;
        public string Icon;
        public List<string> Lines = new List<string>();
    }

    /// <summary>
    /// As tabelas de dungeon/generate.ts (fixtures/data/dungeon/generate.json). Todas são privadas no TS:
    /// os dois NPCs da masmorra, os tetos de salas e de baús por andar e os ícones das salas que não mudam.
    /// </summary>
    public sealed class DungeonGenerateData
    {
        [JsName("NPC_TEMPLATES")] public List<DungeonNpcTemplate> NpcTemplates = new List<DungeonNpcTemplate>();
        /// <summary>Teto de salas por andar (era 22; 14 dá umas 5 batalhas).</summary>
        [JsName("MAX_ROOMS")] public double MaxRooms;
        /// <summary>Teto de baús por andar.</summary>
        [JsName("MAX_TREASURES")] public double MaxTreasures;
        /// <summary>Ícone das salas que não mudam depois de visitadas, por tipo de sala.</summary>
        [JsName("ICONES_FIXOS")] public OrderedMap<string> IconesFixos = new OrderedMap<string>();
    }

    /// <summary>A parte de dungeon/generate.ts em GameData (carregada por DungeonGenerateTables).</summary>
    public static partial class GameData
    {
        private static DungeonGenerateData _dungeonGenerateTable;

        /// <summary>dungeon/generate: NPCs da masmorra, tetos de salas e baús, ícones fixos.</summary>
        public static DungeonGenerateData DungeonGenerateTable
        {
            get => Require(_dungeonGenerateTable, "dungeon/generate");
            set => _dungeonGenerateTable = value;
        }
    }
}
