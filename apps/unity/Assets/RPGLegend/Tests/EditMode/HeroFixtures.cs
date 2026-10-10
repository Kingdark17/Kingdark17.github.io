using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/hero.json: stats, derived e catalog (hero.ts, mastery e teachers vêm depois).</summary>
    internal sealed class HeroFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "hero";

            // ---------- stats ----------
            Const(M, "ATTR_KEYS", () => W(StatKeys.Attrs));
            Const(M, "EQUIP_SLOTS", () => W(StatKeys.EquipSlots));
            Const(M, "ITEM_STAT_KEYS", () => W(StatKeys.ItemStats));
            Fn(M, "emptyAttributes", (a, c) => W(Attributes.Empty()));

            // ---------- derived ----------
            Const(M, "CRIT_PENALTY", () => N(Derived.CritPenalty));
            Fn(M, "equipmentCap", (a, c) => N(Derived.EquipmentCap(Num(a["level"]))));
            Fn(M, "equipmentStat", (a, c) =>
                N(Derived.EquipmentStat(R<Equipment>(a["equip"]), Str(a["key"]), JsJson.ToOptionalNumber(a["cap"]))));
            Fn(M, "equipmentBonus", (a, c) => W(Derived.EquipmentBonus(R<Equipment>(a["equip"]))));
            Fn(M, "xpForLevel", (a, c) => N(Derived.XpForLevel(Num(a["level"]))));
            Fn(M, "attrModifier", (a, c) => N(Derived.AttrModifier(Num(a["value"]))));
            Fn(M, "totalAttributePoints", (a, c) => N(Derived.TotalAttributePoints(R<Attributes>(a["attrs"]))));
            Fn(M, "derivedStats", (a, c) =>
                W(Derived.Compute(R<HeroCore>(a["hero"]), JsJson.Truthy(JsJson.Prop(a["options"], "critPenalty")))));

            // ---------- catalog ----------
            Const(M, "RACES", () => W(Catalog.Races));
            Const(M, "CLASSES", () => W(Catalog.Classes));
            Const(M, "POWERS", () => W(Catalog.Powers));
            Const(M, "DEBUFFS", () => W(Catalog.Debuffs));
            Const(M, "LEGACY_DEBUFF_EFFECTS", () => W(GameData.HeroCatalog.LegacyDebuffEffects));
            Const(M, "CLASS_PASSIVES", () => W(GameData.HeroCatalog.ClassPassives));
            Fn(M, "classById", (a, c) => W(Catalog.ClassById(Str(a["id"]))));
            Fn(M, "classByName", (a, c) => W(Catalog.ClassByName(Str(a["name"]))));
            Fn(M, "raceByName", (a, c) => W(Catalog.RaceByName(Str(a["name"]))));
            Fn(M, "powerById", (a, c) => W(Catalog.PowerById(Str(a["id"]))));
            Fn(M, "powerByName", (a, c) => W(Catalog.PowerByName(Str(a["name"]))));
            Fn(M, "debuffById", (a, c) => W(Catalog.DebuffById(Str(a["id"]))));
            Fn(M, "classPassive", (a, c) => W(Catalog.ClassPassive(Str(a["classId"]))));
            Fn(M, "idDaClasse", (a, c) =>
                W(Catalog.IdDaClasse(Str(JsJson.Prop(a["quem"], "classId")), Str(JsJson.Prop(a["quem"], "className")))));
            Fn(M, "idDaRaca", (a, c) =>
                W(Catalog.IdDaRaca(Str(JsJson.Prop(a["quem"], "raceId")), Str(JsJson.Prop(a["quem"], "race")))));
        }
    }
}
