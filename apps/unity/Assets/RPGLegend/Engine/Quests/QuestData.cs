using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de quests/quests.ts (fixtures/data/quests/quests.json), inclusive a privada QUEST_TYPES.</summary>
    public sealed class QuestsData
    {
        /// <summary>kill, floor, collect: a ordem que generateQuest sorteia.</summary>
        [JsName("QUEST_TYPES")] public List<string> QuestTypes = new List<string>();
    }

    /// <summary>A parte das missões em GameData (carregada por QuestTables).</summary>
    public static partial class GameData
    {
        private static QuestsData _questsTable;

        /// <summary>quests/quests: os tipos de missão.</summary>
        public static QuestsData QuestsTable
        {
            get => Require(_questsTable, "quests/quests");
            set => _questsTable = value;
        }
    }
}
