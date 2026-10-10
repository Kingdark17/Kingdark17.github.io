namespace RPGLegend.Engine
{
    /// <summary>A parte do herói em GameData: hero/hero, hero/mastery e hero/teachers (carregadas por HeroTables).</summary>
    public static partial class GameData
    {
        private static HeroData _heroTable;
        private static MasteryData _masteryTable;
        private static TeacherData _teacherTable;

        /// <summary>hero/hero: BASE_ATTR, APPRENTICE e as privadas (teto de níveis, armas de mão, papéis de companheiro).</summary>
        public static HeroData HeroTable
        {
            get => Require(_heroTable, "hero/hero");
            set => _heroTable = value;
        }

        /// <summary>hero/mastery.</summary>
        public static MasteryData MasteryTable
        {
            get => Require(_masteryTable, "hero/mastery");
            set => _masteryTable = value;
        }

        /// <summary>hero/teachers.</summary>
        public static TeacherData TeacherTable
        {
            get => Require(_teacherTable, "hero/teachers");
            set => _teacherTable = value;
        }
    }
}
