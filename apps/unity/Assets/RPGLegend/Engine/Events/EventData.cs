using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: EventTemplate — um evento de masmorra (o aventureiro ferido, o altar, a porta lacrada).</summary>
    public sealed class EventTemplate
    {
        /// <summary>TS: EventTemplateId — "ferido", "altar" ou "porta".</summary>
        public string Id;
        public string Icon;
        public string Title;
        public string Text;
    }

    /// <summary>As tabelas de events/events.ts (fixtures/data/events/events.json).</summary>
    public sealed class EventsData
    {
        [JsName("EVENT_TEMPLATES")] public List<EventTemplate> EventTemplates = new List<EventTemplate>();
    }

    /// <summary>A parte dos eventos em GameData (carregada por EventTables).</summary>
    public static partial class GameData
    {
        private static EventsData _eventsTable;

        /// <summary>events/events: os modelos de evento.</summary>
        public static EventsData EventsTable
        {
            get => Require(_eventsTable, "events/events");
            set => _eventsTable = value;
        }
    }
}
