using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas de events/events.ts: events/events (EVENT_TEMPLATES).</summary>
    [Preserve]
    internal sealed class EventTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.EventsTable = JsSerializer.Parse<EventsData>(readTable("events/events"));
        }
    }
}
