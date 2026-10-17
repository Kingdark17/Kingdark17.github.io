using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas da luta em tempo real do app: luta/eventos-de-arma e luta/arena.</summary>
    [Preserve]
    internal sealed class LutaTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.EventosDeArmaTable = JsSerializer.Parse<EventosDeArmaData>(readTable("luta/eventos-de-arma"));
            GameData.ArenaTable = JsSerializer.Parse<ArenaData>(readTable("luta/arena"));
        }
    }
}
