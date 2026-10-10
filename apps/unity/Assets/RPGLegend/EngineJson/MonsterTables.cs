using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas de monstros: monsters/species.</summary>
    [Preserve]
    internal sealed class MonsterTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.SpeciesTable = JsSerializer.Parse<MonsterSpeciesData>(readTable("monsters/species"));
        }
    }
}
