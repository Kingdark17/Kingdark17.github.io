using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas de npc/npc-services.ts: npc/npc-services (NPC_SERVICE_INFO, MAX_PARTY_SIZE, TEMPORARY_RECRUIT_COMBATS).</summary>
    [Preserve]
    internal sealed class NpcTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.NpcServicesTable = JsSerializer.Parse<NpcServicesData>(readTable("npc/npc-services"));
        }
    }
}
