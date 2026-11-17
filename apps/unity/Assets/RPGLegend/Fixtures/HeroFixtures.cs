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

            // ---------- classes-de-luta ----------
            Fn(M, "classeDeLuta", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.De(quem.ClassId, quem.ClassName));
            });
            Fn(M, "alcanceDoHeroi", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.AlcanceDoHeroi(quem.ClassId, quem.ClassName, quem.Equip?.Get("arma")?.TemplateId));
            });
            Fn(M, "ataqueDasMaos", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.AtaqueDasMaos(quem.ClassId, quem.ClassName, quem.Level, quem.Equip?.Get("arma") != null));
            });
            Fn(M, "vidaComAClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.VidaComAClasse(Num(a["vida"]), quem.ClassId, quem.ClassName));
            });
            Fn(M, "classeRefeita", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ClasseRefeita(quem.ClassId, quem.ClassName));
            });
            Fn(M, "criticoDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.CriticoDaClasse(quem.ClassId, quem.ClassName));
            });
            Fn(M, "puxaOsMonstros", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.PuxaOsMonstros(quem.ClassId, quem.ClassName));
            });
            Fn(M, "bonusDoAtaque", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.BonusDoAtaque(quem.ClassId, quem.ClassName, quem.Equip?.Get("arma")?.TemplateId, R<ContadoresDaClasse>(a["c"]),
                    JsJson.Truthy(JsJson.Prop(a["alvo"], "colado")), JsJson.Truthy(JsJson.Prop(a["alvo"], "chefe")),
                    JsJson.ToOptionalNumber(JsJson.Prop(a["alvo"], "blocos")) ?? 0));
            });
            Fn(M, "esquivaDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.EsquivaDaClasse(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"]), JsJson.Truthy(a["chefe"])));
            });
            Fn(M, "resistenciaDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.ResistenciaDaClasse(quem.ClassId, quem.ClassName, quem.Hp ?? 0, quem.MaxHp ?? 0, R<ContadoresDaClasse>(a["c"])));
            });
            Fn(M, "textosDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                var extras = a["extras"] != null && a["extras"].Type != JTokenType.Null ? R<ExtrasDaClasse>(a["extras"]) : null;
                return W(ClassesDeLuta.TextosDaClasse(quem.ClassId, quem.ClassName, quem.Hp ?? 0, quem.MaxHp ?? 0, R<ContadoresDaClasse>(a["c"]), extras));
            });
            Fn(M, "apoiaAliado", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ApoiaAliado(quem.ClassId, quem.ClassName));
            });
            Fn(M, "miraDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.MiraDaClasse(quem.ClassId, quem.ClassName));
            });
            Fn(M, "mortoVivo", (a, c) => W(ClassesDeLuta.MortoVivo(Str(a["especie"]))));
            Fn(M, "danoDaDistancia", (a, c) => N(ClassesDeLuta.DanoDaDistancia(Num(a["blocos"]), Num(a["parado"]))));
            Fn(M, "efeitosDaMoral", (a, c) => W(ClassesDeLuta.EfeitosDaMoral(Num(a["nivel"]))));
            Fn(M, "contarCriticoNoAliado", (a, c) => W(ClassesDeLuta.ContarCriticoNoAliado(R<Moral>(a["moral"]))));
            Fn(M, "curaDoApoio", (a, c) =>
                N(ClassesDeLuta.CuraDoApoio(Str(a["tipo"]), Num(JsJson.Prop(a["vida"], "hp")), Num(JsJson.Prop(a["vida"], "maxHp")))));
            Fn(M, "duracaoDaFe", (a, c) => N(ClassesDeLuta.DuracaoDaFe(JsJson.Truthy(a["comunhao"]), Num(a["dano"]), Num(a["quantos"]))));
            Fn(M, "oQueCanaliza", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.OQueCanaliza(quem.ClassId, quem.ClassName));
            });
            Fn(M, "custoDaMagia", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.CustoDaMagia(quem.ClassId, quem.ClassName));
            });
            Fn(M, "manaComAClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.ManaComAClasse(Num(a["mana"]), quem.ClassId, quem.ClassName));
            });
            Fn(M, "passosPorPonto", (a, c) => N(ClassesDeLuta.PassosPorPonto(Str(a["tipo"]))));
            Fn(M, "forcaDaExplosao", (a, c) => N(ClassesDeLuta.ForcaDaExplosao(Num(a["ki"]))));
            Fn(M, "contarParado", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ContarParado(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"]), JsJson.Truthy(a["andou"])));
            });
            Fn(M, "contarAcerto", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ContarAcerto(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"]), JsJson.Truthy(a["critico"])));
            });
            Fn(M, "contarGolpeLevado", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ContarGolpeLevado(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"])));
            });
            Fn(M, "esfriar", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.Esfriar(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"])));
            });
            Fn(M, "devolucaoDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.DevolucaoDaClasse(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"])));
            });

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

    /// <summary>O `quem` dos casos de classes-de-luta: a classe e a arma na mão.</summary>
    internal sealed class QuemLutaDoCaso
    {
        public string ClassId;
        public string ClassName;
        public double? Level;
        public Equipment Equip;
        public double? Hp;
        public double? MaxHp;
    }
}
