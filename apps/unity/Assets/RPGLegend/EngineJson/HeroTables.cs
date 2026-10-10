using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas de hero.ts, mastery.ts e teachers.ts: hero/hero, hero/mastery, hero/teachers.</summary>
    [Preserve]
    internal sealed class HeroTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.HeroTable = JsSerializer.Parse<HeroData>(readTable("hero/hero"));
            GameData.MasteryTable = JsSerializer.Parse<MasteryData>(readTable("hero/mastery"));
            GameData.TeacherTable = JsSerializer.Parse<TeacherData>(readTable("hero/teachers"));
        }
    }
}
