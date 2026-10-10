namespace RPGLegend.Engine
{
    /// <summary>As tabelas de monstros (carregadas por RPGLegend.Engine.Json.MonsterTables).</summary>
    public static partial class GameData
    {
        private static MonsterSpeciesData _speciesTable;

        /// <summary>monsters/species: espécies, classes de inimigo, adjetivos de andar e títulos de chefe.</summary>
        public static MonsterSpeciesData SpeciesTable
        {
            get => Require(_speciesTable, "monsters/species");
            set => _speciesTable = value;
        }
    }
}
