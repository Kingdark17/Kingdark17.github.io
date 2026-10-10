namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: PetBonus — os bônus de combate do pet. Bônus que o pet não dá fica ausente (undefined), não zero.
    /// </summary>
    public sealed class PetBonus
    {
        public double? Esquiva;
        public double? Critico;
        /// <summary>% de chance de poupar a mana do poder (ainda sem ponto de consumo portado no TS).</summary>
        public double? ManaSave;
        /// <summary>% a mais de cura recebida (ainda sem ponto de consumo portado no TS).</summary>
        public double? Healing;
        public string Label;
    }

    /// <summary>As tabelas de pets/pets.ts (fixtures/data/pets/pets.json), inclusive a privada NO_BONUS.</summary>
    public sealed class PetsData
    {
        /// <summary>Chaveado pelo PetId (chicken, cat, fox…).</summary>
        [JsName("PET_ICONS")] public OrderedMap<string> PetIcons = new OrderedMap<string>();
        [JsName("PET_BONUSES")] public OrderedMap<PetBonus> PetBonuses = new OrderedMap<PetBonus>();
        /// <summary>O bônus vazio de quem não tem pet: só <c>label: ""</c>.</summary>
        [JsName("NO_BONUS")] public PetBonus NoBonus;
    }

    public static partial class GameData
    {
        private static PetsData _petsTable;

        /// <summary>pets/pets.</summary>
        public static PetsData PetsTable
        {
            get => Require(_petsTable, "pets/pets");
            set => _petsTable = value;
        }
    }
}
