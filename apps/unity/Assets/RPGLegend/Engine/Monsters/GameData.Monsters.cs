namespace RPGLegend.Engine
{
    /// <summary>As tabelas de monsters/generate.ts (fixtures/data/monsters/generate.json).</summary>
    public sealed class MonstersGenerateData
    {
        /// <summary>Quanto o chefe final é mais forte que um chefe principal, na vida e no dano.</summary>
        [JsName("FORCA_DO_CHEFE_FINAL")] public double ForcaDoChefeFinal;
    }

    /// <summary>As tabelas de monstros (carregadas por RPGLegend.Engine.Json.MonsterTables).</summary>
    public static partial class GameData
    {
        private static MonsterSpeciesData _speciesTable;
        private static MonstersGenerateData _monstersGenerateTable;

        /// <summary>monsters/species: espécies, classes de inimigo, adjetivos de andar e títulos de chefe.</summary>
        public static MonsterSpeciesData SpeciesTable
        {
            get => Require(_speciesTable, "monsters/species");
            set => _speciesTable = value;
        }

        /// <summary>monsters/generate: a força a mais do chefe final.</summary>
        public static MonstersGenerateData MonstersGenerateTable
        {
            get => Require(_monstersGenerateTable, "monsters/generate");
            set => _monstersGenerateTable = value;
        }
    }
}
