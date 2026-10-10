namespace RPGLegend.Engine
{
    /// <summary>TS: NpcServiceInfo — o ícone e o rótulo do botão de um serviço.</summary>
    public sealed class NpcServiceInfo
    {
        public string Icon;
        public string Label;
    }

    /// <summary>
    /// As tabelas de npc/npc-services.ts (fixtures/data/npc/npc-services.json), inclusive as privadas
    /// MAX_PARTY_SIZE e TEMPORARY_RECRUIT_COMBATS.
    /// </summary>
    public sealed class NpcServicesData
    {
        /// <summary>Por serviço (<see cref="NpcServiceIds"/>), na ordem heal, blessing, barter, reveal, recruit.</summary>
        [JsName("NPC_SERVICE_INFO")] public OrderedMap<NpcServiceInfo> ServiceInfo = new OrderedMap<NpcServiceInfo>();
        /// <summary>Tamanho máximo da equipe (sem contar o herói).</summary>
        [JsName("MAX_PARTY_SIZE")] public double MaxPartySize;
        /// <summary>Por quantos combates fica quem foi recrutado por um NPC.</summary>
        [JsName("TEMPORARY_RECRUIT_COMBATS")] public double TemporaryRecruitCombats;
    }

    /// <summary>A parte dos serviços de NPC em GameData (carregada por NpcTables).</summary>
    public static partial class GameData
    {
        private static NpcServicesData _npcServicesTable;

        /// <summary>npc/npc-services: o catálogo dos serviços, o tamanho da equipe e a duração do recruta.</summary>
        public static NpcServicesData NpcServicesTable
        {
            get => Require(_npcServicesTable, "npc/npc-services");
            set => _npcServicesTable = value;
        }
    }
}
