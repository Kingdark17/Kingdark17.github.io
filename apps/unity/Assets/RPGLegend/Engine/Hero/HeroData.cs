using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: APPRENTICE — nome e ícone de quem ainda não treinou na guilda. Não é uma classe.</summary>
    public sealed class ApprenticeDef
    {
        public string Name;
        public string Icon;
    }

    /// <summary>TS: o valor de COMPANION_ROLES — habilidade do companheiro, por id de classe.</summary>
    public sealed class CompanionRoleDef
    {
        public string Ability;
        public string Desc;
    }

    /// <summary>
    /// As tabelas de hero/hero.ts (fixtures/data/hero/hero.json), inclusive as privadas.
    /// OFFHAND_WEAPON_IDS e TWO_HANDED_WEAPON_IDS são Set no TS e chegam como lista.
    /// </summary>
    public sealed class HeroData
    {
        [JsName("BASE_ATTR")] public double BaseAttr;
        [JsName("APPRENTICE")] public ApprenticeDef Apprentice;
        [JsName("MAX_NIVEIS_POR_GANHO")] public double MaxNiveisPorGanho;
        [JsName("OFFHAND_WEAPON_IDS")] public List<string> OffhandWeaponIds = new List<string>();
        [JsName("TWO_HANDED_WEAPON_IDS")] public List<string> TwoHandedWeaponIds = new List<string>();
        [JsName("COMPANION_ROLES")] public OrderedMap<CompanionRoleDef> CompanionRoles = new OrderedMap<CompanionRoleDef>();
    }

    /// <summary>As tabelas de hero/mastery.ts (fixtures/data/hero/mastery.json).</summary>
    public sealed class MasteryData
    {
        [JsName("MASTERY_MAX_LEVEL")] public double MasteryMaxLevel;
        [JsName("MASTERY_DAMAGE_PER_LEVEL")] public double MasteryDamagePerLevel;
    }

    /// <summary>TS: TeacherDef — um professor de classe.</summary>
    public sealed class TeacherDef
    {
        /// <summary>1 ou 2.</summary>
        public double Number;
        /// <summary>Primeiro e último andar em que ele pode aparecer, em qualquer masmorra.</summary>
        public List<double> Floors;
        /// <summary>Nível de maestria que ele pede.</summary>
        public double Mastery;
        /// <summary>Chance de aparecer em cada andar da faixa; o último andar dela garante.</summary>
        public double Chance;
    }

    /// <summary>As tabelas de hero/teachers.ts (fixtures/data/hero/teachers.json).</summary>
    public sealed class TeacherData
    {
        [JsName("CLASS_TEACHER_POWERS")] public OrderedMap<List<string>> ClassTeacherPowers = new OrderedMap<List<string>>();
        [JsName("TEACHERS")] public List<TeacherDef> Teachers = new List<TeacherDef>();
    }
}
