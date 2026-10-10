namespace RPGLegend.Engine
{
    /// <summary>
    /// Pets cosméticos do perfil, com pequenos bônus de combate (port de shared/src/pets/pets.ts).
    /// Só o catálogo e os dois lookups puros; a animação do widget do perfil ficou de fora já no TS.
    ///
    /// O id do pet (TS: PetId — chicken, cat, fox, owl, slime, wolf, fairy, baby_dragon, admin_dragon) é texto.
    /// </summary>
    public static class Pets
    {
        /// <summary>O ícone de pet desconhecido: uma pegada genérica.</summary>
        public const string FallbackIcon = "🐾";

        /// <summary>TS: PET_ICONS.</summary>
        public static OrderedMap<string> Icons => GameData.PetsTable.PetIcons;

        /// <summary>TS: PET_BONUSES.</summary>
        public static OrderedMap<PetBonus> Bonuses => GameData.PetsTable.PetBonuses;

        /// <summary>
        /// TS: petBonus — <c>(pet &amp;&amp; PET_BONUSES[pet]) || NO_BONUS</c>: o bônus do pet ativo, ou o bônus
        /// vazio quando não há pet (null) ou o id é desconhecido. Devolve o próprio objeto da tabela, como o TS.
        /// </summary>
        public static PetBonus Bonus(string pet)
        {
            if (Js.Truthy(pet) && Bonuses.TryGet(pet, out var bonus) && bonus != null) return bonus;
            return GameData.PetsTable.NoBonus;
        }

        /// <summary>TS: petIcon — <c>(pet &amp;&amp; PET_ICONS[pet]) || '🐾'</c>.</summary>
        public static string Icon(string pet)
        {
            if (Js.Truthy(pet) && Icons.TryGet(pet, out var icon) && Js.Truthy(icon)) return icon;
            return FallbackIcon;
        }
    }
}
