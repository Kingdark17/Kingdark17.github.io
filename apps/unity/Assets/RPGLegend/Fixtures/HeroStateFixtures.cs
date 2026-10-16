using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/hero.json de hero.ts, mastery.ts e teachers.ts (o resto do módulo está em HeroFixtures).
    /// Cada handler reproduz o executor do gerador (scripts/gen-fixtures.ts, seção modulo('hero')).
    /// </summary>
    internal sealed class HeroStateFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "hero";

            // ---------- hero.ts ----------
            Const(M, "BASE_ATTR", () => N(Heroes.BaseAttr));
            Const(M, "APPRENTICE", () => W(Heroes.Apprentice));

            Fn(M, "heroPowers", (a, c) => W(Heroes.HeroPowers(R<Hero>(a["hero"]))));
            Fn(M, "rollAttrs", (a, c) =>
                W(Heroes.RollAttrs(R<RaceDef>(a["race"]), R<ClassDef>(a["cls"]), R<DebuffDef>(a["debuff"]), c.RngFn)));
            // O gerador passa o mesmo rng e o relógio do caso como armaInicial ({ rng, now } da arma).
            Fn(M, "buildHero", (a, c) => W(Heroes.BuildHero(R<HeroCreation>(a["creation"]), c.RngFn, c.RngFn, c.NowOrFail)));
            Fn(M, "apprenticeAttrs", (a, c) => W(Heroes.ApprenticeAttrs(R<RaceDef>(a["race"]), R<DebuffDef>(a["debuff"]))));
            Fn(M, "buildApprentice", (a, c) => W(Heroes.BuildApprentice(R<ApprenticeCreation>(a["creation"]), c.RngFn)));
            Fn(M, "hasClass", (a, c) => W(Heroes.HasClass(R<Hero>(a["hero"]))));
            // Idem buildHero: o rng e o relógio do caso são a armaInicial.
            Fn(M, "trainAtGuild", (a, c) => W(Heroes.TrainAtGuild(R<Hero>(a["hero"]), R<ClassDef>(a["cls"]), c.RngFn, c.NowOrFail)));
            Fn(M, "recomputeDerived", (a, c) =>
                W(Heroes.RecomputeDerived(R<Hero>(a["hero"]), JsJson.Truthy(JsJson.Prop(a["options"], "critPenalty")))));
            Fn(M, "spendAttrPoint", (a, c) => W(Heroes.SpendAttrPoint(R<Hero>(a["hero"]), Str(a["key"]))));
            Fn(M, "gainXP", (a, c) => W(Heroes.GainXP(R<Hero>(a["hero"]), Num(a["amount"]))));
            Fn(M, "isOffhandEligible", (a, c) => W(Heroes.IsOffhandEligible(R<Item>(a["item"]))));
            Fn(M, "isTwoHanded", (a, c) => W(Heroes.IsTwoHanded(R<Item>(a["item"]))));
            Fn(M, "equippedSlot", (a, c) => W(Heroes.EquippedSlot(R<Hero>(a["hero"]), R<Item>(a["item"]))));
            Fn(M, "equipItem", (a, c) => W(Heroes.EquipItem(R<Hero>(a["hero"]), R<Item>(a["item"]), Str(a["requestedSlot"]))));
            Fn(M, "unequipItem", (a, c) => W(Heroes.UnequipItem(R<Hero>(a["hero"]), Str(a["slot"]))));
            Fn(M, "hasDebuffEffect", (a, c) => W(Heroes.HasDebuffEffect(R<Hero>(a["hero"]), Str(a["effect"]))));
            Fn(M, "weaponAffinityPct", (a, c) => N(Heroes.WeaponAffinityPct(R<Hero>(a["hero"]))));
            Fn(M, "generateCompanion", (a, c) => W(Heroes.GenerateCompanion(c.RngFn)));
            Fn(M, "hydrateSavedHero", (a, c) => W(Heroes.HydrateSavedHero(R<Hero>(a["hero"]))));

            // ---------- mastery.ts ----------
            Const(M, "MASTERY_MAX_LEVEL", () => N(Mastery.MaxLevel));
            Const(M, "MASTERY_DAMAGE_PER_LEVEL", () => N(Mastery.DamagePerLevel));
            Fn(M, "masteryBattlesFor", (a, c) => N(Mastery.BattlesFor(Num(a["level"]))));
            Fn(M, "masteryLevel", (a, c) => N(Mastery.Level(Num(a["battles"]))));
            Fn(M, "masteryProgress", (a, c) => W(Mastery.Progress(R<Hero>(a["hero"]))));
            Fn(M, "masteryWeapons", (a, c) => W(Mastery.Weapons(R<ClassDef>(a["cls"]))));
            Fn(M, "wieldsMasteryWeapon", (a, c) => W(Mastery.WieldsMasteryWeapon(R<Hero>(a["hero"]))));
            Fn(M, "masteryDamageMult", (a, c) => N(Mastery.DamageMult(R<Hero>(a["hero"]))));
            Fn(M, "winBattle", (a, c) => W(Mastery.WinBattle(R<Hero>(a["hero"]))));
            Fn(M, "veteranMasteryBattles", (a, c) => N(Mastery.VeteranBattles(Num(a["killCount"]))));

            // ---------- teachers.ts ----------
            Const(M, "CLASS_TEACHER_POWERS", () => W(Teachers.ClassTeacherPowers));
            Const(M, "TEACHERS", () => W(Teachers.All));
            Fn(M, "teacherOffer", (a, c) => W(Teachers.Offer(R<Hero>(a["hero"]))));
            Fn(M, "teacherMode", (a, c) => W(Teachers.Mode(R<Hero>(a["hero"]))));
            Fn(M, "swappablePowers", (a, c) => W(Teachers.SwappablePowers(R<Hero>(a["hero"]))));
            Fn(M, "teacherFor", (a, c) => W(Teachers.For(R<Hero>(a["hero"]), Num(a["floor"]))));
            Fn(M, "teacherAppears", (a, c) =>
                W(Teachers.Appears(R<TeacherDef>(a["professor"]), Num(a["floor"]), Num(a["roll"]))));
            Fn(M, "learnFromTeacher", (a, c) => W(Teachers.Learn(R<Hero>(a["hero"]), Str(a["powerId"]))));
            Fn(M, "swapWithTeacher", (a, c) => W(Teachers.Swap(R<Hero>(a["hero"]), Str(a["giveUp"]), Str(a["learn"]))));
        }
    }
}
