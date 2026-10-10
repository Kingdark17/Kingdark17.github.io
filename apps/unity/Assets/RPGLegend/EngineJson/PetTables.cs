using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas dos pets: pets/pets.</summary>
    [Preserve]
    internal sealed class PetTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.PetsTable = JsSerializer.Parse<PetsData>(readTable("pets/pets"));
        }
    }
}
