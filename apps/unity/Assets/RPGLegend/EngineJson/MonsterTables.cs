using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas de monstros: monsters/species e monsters/generate.</summary>
    [Preserve]
    internal sealed class MonsterTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.SpeciesTable = JsSerializer.Parse<MonsterSpeciesData>(readTable("monsters/species"));
            GameData.MonstersGenerateTable = JsSerializer.Parse<MonstersGenerateData>(readTable("monsters/generate"));
        }
    }
}
