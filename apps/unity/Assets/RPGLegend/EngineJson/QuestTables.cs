using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas de quests/quests.ts: quests/quests (QUEST_TYPES).</summary>
    [Preserve]
    internal sealed class QuestTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.QuestsTable = JsSerializer.Parse<QuestsData>(readTable("quests/quests"));
        }
    }
}
