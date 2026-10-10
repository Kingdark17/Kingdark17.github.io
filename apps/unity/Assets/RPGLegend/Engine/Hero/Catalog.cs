using System.Collections.Generic;
using System.Text;

namespace RPGLegend.Engine
{
    /// <summary>TS: Race.</summary>
    public sealed class RaceDef
    {
        public string Id;
        public string Name;
        public string Icon;
        public string Desc;
        public OrderedMap<double> Bonus;
        /// <summary>"pequeno" para anão, fada e goblin; ausente nas outras.</summary>
        public string Porte;
    }

    /// <summary>TS: ClassDef. Afinidade = % de eficiência com cada tipo de arma (nenhuma é bloqueada).</summary>
    public sealed class ClassDef
    {
        public string Id;
        public string Name;
        public string Icon;
        public string WeaponTemplate;
        public OrderedMap<double> Bias;
        public string Desc;
        public string SignatureId;
        public OrderedMap<double> Affinity;
        /// <summary>"fisico", "magico" ou "distancia"; ausente nas classes sem ataque principal.</summary>
        public string AtaquePrincipal;
    }

    /// <summary>TS: Power.</summary>
    public sealed class PowerDef
    {
        public string Id;
        public string Name;
        public string Icon;
        public string Desc;
        public double Cost;
        public string Type;
        [JsName("power")] public double? PowerValue;
        public string Status;
        public double? Turns;
        public double? DotRatio;
        public double? Amount;
        public double? HealRatio;
        /// <summary>Poder que a classe dá a todo herói dela e que ninguém mais sorteia.</summary>
        public string SoDaClasse;
    }

    /// <summary>TS: Debuff.</summary>
    public sealed class DebuffDef
    {
        public string Id;
        public string Name;
        public string Icon;
        public string Desc;
        [KeepNull] public string Attr;
        public string Effect;

        /// <summary>O debuff vai inteiro para o save (hero.debuff): campos que o C# não conhece voltam intactos.</summary>
        [JsExtra] public JsExtras Extra;
    }

    /// <summary>TS: ClassPassive.</summary>
    public sealed class ClassPassiveDef
    {
        public string Name;
        public string Desc;
    }

    /// <summary>As tabelas de hero/catalog.ts (fixtures/data/hero/catalog.json).</summary>
    public sealed class HeroCatalogData
    {
        [JsName("RACES")] public List<RaceDef> Races = new List<RaceDef>();
        [JsName("CLASSES")] public List<ClassDef> Classes = new List<ClassDef>();
        [JsName("POWERS")] public List<PowerDef> Powers = new List<PowerDef>();
        [JsName("DEBUFFS")] public List<DebuffDef> Debuffs = new List<DebuffDef>();
        [JsName("LEGACY_DEBUFF_EFFECTS")] public OrderedMap<string> LegacyDebuffEffects = new OrderedMap<string>();
        [JsName("CLASS_PASSIVES")] public OrderedMap<ClassPassiveDef> ClassPassives = new OrderedMap<ClassPassiveDef>();
        [JsName("FIRST_NAMES")] public List<string> FirstNames = new List<string>();
        [JsName("SURNAMES")] public List<string> Surnames = new List<string>();
        [JsName("ATTR_LABELS")] public OrderedMap<string> AttrLabels = new OrderedMap<string>();
    }

    /// <summary>
    /// Buscas do catálogo (port de shared/src/hero/catalog.ts).
    /// Identidade é id; nome é texto de tela. As buscas por nome existem para save antigo.
    /// </summary>
    public static class Catalog
    {
        public static List<RaceDef> Races => GameData.HeroCatalog.Races;
        public static List<ClassDef> Classes => GameData.HeroCatalog.Classes;
        public static List<PowerDef> Powers => GameData.HeroCatalog.Powers;
        public static List<DebuffDef> Debuffs => GameData.HeroCatalog.Debuffs;

        /// <summary>TS: raceById.</summary>
        public static RaceDef RaceById(string id)
        {
            foreach (var r in Races) if (r.Id == id) return r;
            return null;
        }

        /// <summary>TS: classById.</summary>
        public static ClassDef ClassById(string id)
        {
            foreach (var c in Classes) if (c.Id == id) return c;
            return null;
        }

        /// <summary>TS: powerById.</summary>
        public static PowerDef PowerById(string id)
        {
            foreach (var p in Powers) if (p.Id == id) return p;
            return null;
        }

        /// <summary>TS: debuffById.</summary>
        public static DebuffDef DebuffById(string id)
        {
            foreach (var d in Debuffs) if (d.Id == id) return d;
            return null;
        }

        /// <summary>TS: classPassive — chaveado pelo id da classe.</summary>
        public static ClassPassiveDef ClassPassive(string classId) =>
            GameData.HeroCatalog.ClassPassives.TryGet(classId, out var p) ? p : null;

        /// <summary>TS: classByName — insensível a acento e caixa.</summary>
        public static ClassDef ClassByName(string name)
        {
            string target = NormalizedName(name);
            foreach (var c in Classes) if (NormalizedName(c.Name) == target) return c;
            return null;
        }

        /// <summary>TS: powerByName — exato, com acento e caixa.</summary>
        public static PowerDef PowerByName(string name)
        {
            foreach (var p in Powers) if (p.Name == name) return p;
            return null;
        }

        /// <summary>TS: raceByName — insensível a acento e caixa.</summary>
        public static RaceDef RaceByName(string name)
        {
            string target = NormalizedName(name);
            foreach (var r in Races) if (NormalizedName(r.Name) == target) return r;
            return null;
        }

        /// <summary>TS: idDaClasse — o classId quando existe, senão o nome antigo traduzido de volta.</summary>
        public static string IdDaClasse(string classId, string className)
        {
            if (Js.Truthy(classId)) return classId;
            return Js.Truthy(className) ? ClassByName(className)?.Id : null;
        }

        /// <summary>TS: idDaRaca.</summary>
        public static string IdDaRaca(string raceId, string race)
        {
            if (Js.Truthy(raceId)) return raceId;
            return Js.Truthy(race) ? RaceByName(race)?.Id : null;
        }

        /// <summary>
        /// TS: normalizedName — NFD, sem as marcas de acento combináveis (U+0300 a U+036F), em minúsculas.
        /// </summary>
        public static string NormalizedName(string name)
        {
            string decomposed = (name ?? "").Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(decomposed.Length);
            foreach (char ch in decomposed)
                if (ch < 0x0300 || ch > 0x036F) sb.Append(ch);
            return sb.ToString().ToLowerInvariant();
        }
    }
}
