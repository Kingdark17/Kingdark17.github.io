namespace RPGLegend.Engine
{
    /// <summary>As tabelas do combate (carregadas por RPGLegend.Engine.Json.CombatTables).</summary>
    public static partial class GameData
    {
        private static ResolveAttackData _resolveAttackTable;
        private static PartyData _partyTable;
        private static StatusEffectsData _statusEffectsTable;
        private static UsePowerData _usePowerTable;
        private static FleeData _fleeTable;
        private static DodgeData _dodgeTable;

        /// <summary>combat/resolve-attack: o d20 de dano, as zonas da barra de mira e o custo do golpe mágico.</summary>
        public static ResolveAttackData ResolveAttackTable
        {
            get => Require(_resolveAttackTable, "combat/resolve-attack");
            set => _resolveAttackTable = value;
        }

        /// <summary>combat/party: a chance de acerto dos companheiros por postura.</summary>
        public static PartyData PartyTable
        {
            get => Require(_partyTable, "combat/party");
            set => _partyTable = value;
        }

        /// <summary>combat/status-effects: os status de dano contínuo.</summary>
        public static StatusEffectsData StatusEffectsTable
        {
            get => Require(_statusEffectsTable, "combat/status-effects");
            set => _statusEffectsTable = value;
        }

        /// <summary>combat/use-power: a penalidade de mana.</summary>
        public static UsePowerData UsePowerTable
        {
            get => Require(_usePowerTable, "combat/use-power");
            set => _usePowerTable = value;
        }

        /// <summary>combat/flee: o total mínimo para fugir.</summary>
        public static FleeData FleeTable
        {
            get => Require(_fleeTable, "combat/flee");
            set => _fleeTable = value;
        }

        /// <summary>combat/dodge: o total mínimo para esquivar.</summary>
        public static DodgeData DodgeTable
        {
            get => Require(_dodgeTable, "combat/dodge");
            set => _dodgeTable = value;
        }
    }
}
