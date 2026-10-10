using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/items.json: rarity, templates, item e tiers.</summary>
    internal sealed class ItemFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "items";

            // ---------- constantes ----------
            Const(M, "RARITY_IDS", () => W(Rarities.Ids));
            Const(M, "RARITIES", () => W(Rarities.All));
            Const(M, "ITEM_CATEGORIES", () => W(GameData.ItemTable.ItemCategories));
            Const(M, "EQUIPPABLE_CATEGORIES", () => W(GameData.ItemTable.EquippableCategories));
            Const(M, "STAT_LABELS", () => W(GameData.ItemTable.StatLabels));
            Const(M, "PROC_EFFECTS", () => W(GameData.ItemTable.ProcEffects));
            Const(M, "TEMPLATES", () => W(ItemTemplates.All));
            Const(M, "TIER_ORDER", () => W(Tiers.Order));
            Const(M, "TIER_MIN", () => W(Tiers.Min));

            // ---------- rarity ----------
            Fn(M, "rarityById", (a, c) => W(Rarities.ById(Str(a["id"]))));
            Fn(M, "rarityWeights", (a, c) => W(Rarities.Weights(Num(a["floor"]))));
            // Com count, o gerador grava só o id de cada sorteio; sem count, a raridade inteira.
            Fn(M, "pickRarity", (a, c) =>
            {
                double floor = JsJson.ToOptionalNumber(a["floor"]) ?? 1;
                if (JsJson.IsUndefined(a["count"])) return W(Rarities.Pick(floor, c.RngFn));
                var ids = new JArray();
                for (int i = 0; i < (int)Num(a["count"]); i++) ids.Add(Rarities.Pick(floor, c.RngFn).Id);
                return ids;
            }, countsItself: true);

            // ---------- templates ----------
            Fn(M, "templateById", (a, c) => W(ItemTemplates.ById(Str(a["id"]))));
            Fn(M, "templatesByCategory", (a, c) => W(ItemTemplates.ByCategory(Str(a["category"]))));
            Fn(M, "isEquippable", (a, c) => W(ItemTemplates.IsEquippable(Str(a["category"]))));
            Fn(M, "slotForTemplate", (a, c) => W(ItemTemplates.SlotFor(R<ItemTemplate>(a["template"]))));

            // ---------- item ----------
            // O gerador instancia o template em cada raridade da lista, com o mesmo rng.
            Fn(M, "instantiate", (a, c) =>
            {
                var template = R<ItemTemplate>(a["template"]);
                var list = new JArray();
                foreach (var rarity in R<List<RarityDef>>(a["rarities"]))
                    list.Add(W(Items.Instantiate(template, rarity, c.RngFn, c.NowOrFail)));
                return list;
            });
            Fn(M, "randomItem", (a, c) =>
            {
                var o = a["options"];
                return W(Items.RandomItem(new Items.RandomItemOptions
                {
                    Category = Str(JsJson.Prop(o, "category")),
                    Rarity = Str(JsJson.Prop(o, "rarity")),
                    Floor = JsJson.ToOptionalNumber(JsJson.Prop(o, "floor")),
                    Rng = c.RngFn,
                    Now = c.NowOrFail,
                }));
            });
            Fn(M, "displayName", (a, c) => W(Items.DisplayName(R<Item>(a["item"]))));
            Fn(M, "itemView", (a, c) => W(Items.View(R<Item>(a["item"]))));
            Fn(M, "itemCategory", (a, c) => W(Items.CategoryOf(R<Item>(a["item"]))));
            Fn(M, "concordar", (a, c) => W(Items.Concordar(R<Item>(a["item"]), R<List<string>>(a["formas"]))));
            Fn(M, "itemTemplate", (a, c) => W(Items.TemplateOf(R<Item>(a["item"]))));
            Fn(M, "statTags", (a, c) => W(Items.StatTags(R<Item>(a["item"]))));

            // ---------- tiers ----------
            Fn(M, "powerScore", (a, c) => N(Tiers.PowerScore(R<Item>(a["item"]))));
            Fn(M, "tierFor", (a, c) => W(Tiers.TierFor(R<Item>(a["item"]))));
            Fn(M, "tierRank", (a, c) =>
            {
                var item = a["item"];
                return N(item != null && item.Type == JTokenType.String ? Tiers.RankOf((string)item) : Tiers.RankOf(R<Item>(item)));
            });
            Fn(M, "tierInfo", (a, c) => W(Tiers.Info(R<Item>(a["item"]))));
            Fn(M, "tierFromScore", (a, c) => W(Tiers.FromScore(Num(a["score"]))));
            Fn(M, "tierClass", (a, c) => W(Tiers.CssClass(Str(a["tier"]))));
            Fn(M, "reforge", (a, c) => W(Tiers.Reforge(R<Item>(a["item"]), Num(a["delta"]))));
        }
    }
}
