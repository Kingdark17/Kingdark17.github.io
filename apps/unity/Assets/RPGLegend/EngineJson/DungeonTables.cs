using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// Tabelas da masmorra: dungeon/graph (direções), dungeon/dungeons (masmorras, dificuldades, totens) e
    /// dungeon/room-walk (o andar dentro da sala). A tabela dungeon/generate (de dungeon/generate.ts) é
    /// carregada por DungeonGenerateTables.
    /// </summary>
    [Preserve]
    internal sealed class DungeonTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.DungeonGraphTable = JsSerializer.Parse<DungeonGraphData>(readTable("dungeon/graph"));
            GameData.DungeonsTable = JsSerializer.Parse<DungeonsData>(readTable("dungeon/dungeons"));
            GameData.RoomWalkTable = JsSerializer.Parse<RoomWalkData>(readTable("dungeon/room-walk"));
        }
    }
}
