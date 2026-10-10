using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// Tabelas de dungeon/generate.ts: dungeon/generate (NPCs da masmorra, tetos de salas e baús, ícones fixos).
    /// As outras tabelas da masmorra (graph, dungeons) ficam em DungeonTables.
    /// </summary>
    [Preserve]
    internal sealed class DungeonGenerateTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.DungeonGenerateTable = JsSerializer.Parse<DungeonGenerateData>(readTable("dungeon/generate"));
        }
    }
}
