using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: ShopKind — quem vende: o vendedor itinerante (consumíveis) ou o ferreiro (equipamento).</summary>
    public static class ShopKinds
    {
        public const string Shop = "shop";
        public const string Blacksmith = "blacksmith";
    }

    /// <summary>
    /// TS: ForgeOutcome. No TS é uma união pelo <c>kind</c>; aqui é uma classe só, e cada kind preenche só os
    /// seus campos (os outros ficam ausentes): "unavailable" e "no_material" → nada; "insufficient_gold" →
    /// Required; "forged" → OldTier, NewTier, Improved e ReforgeFails.
    /// </summary>
    public sealed class ForgeOutcome
    {
        public const string KindUnavailable = "unavailable";
        public const string KindNoMaterial = "no_material";
        public const string KindInsufficientGold = "insufficient_gold";
        public const string KindForged = "forged";

        public string Kind;
        /// <summary>kind "insufficient_gold": o custo do material.</summary>
        public double? Required;
        /// <summary>kind "forged": o tier antes da tentativa.</summary>
        public string OldTier;
        /// <summary>kind "forged": o tier depois da tentativa.</summary>
        public string NewTier;
        /// <summary>kind "forged": o rank novo passou do antigo.</summary>
        public bool? Improved;
        /// <summary>kind "forged": o "pity" do item depois da tentativa.</summary>
        public double? ReforgeFails;

        public static ForgeOutcome Unavailable() => new ForgeOutcome { Kind = KindUnavailable };

        public static ForgeOutcome NoMaterial() => new ForgeOutcome { Kind = KindNoMaterial };

        public static ForgeOutcome InsufficientGold(double required) =>
            new ForgeOutcome { Kind = KindInsufficientGold, Required = required };

        public static ForgeOutcome Forged(string oldTier, string newTier, bool improved, double reforgeFails) =>
            new ForgeOutcome { Kind = KindForged, OldTier = oldTier, NewTier = newTier, Improved = improved, ReforgeFails = reforgeFails };
    }

    /// <summary>TS: ForgeResult.</summary>
    public sealed class ForgeResult
    {
        public Hero Hero;
        public List<Item> Inventory;
        /// <summary>O item reforjado; nas recusas, o próprio item recebido.</summary>
        public Item Item;
        public ForgeOutcome Outcome;
    }

    /// <summary>TS: BuyOutcome — "insufficient_gold" → Required; "bought" → Price.</summary>
    public sealed class BuyOutcome
    {
        public const string KindInsufficientGold = "insufficient_gold";
        public const string KindBought = "bought";

        public string Kind;
        /// <summary>kind "insufficient_gold": o preço que faltou pagar.</summary>
        public double? Required;
        /// <summary>kind "bought": o preço pago.</summary>
        public double? Price;

        public static BuyOutcome InsufficientGold(double required) => new BuyOutcome { Kind = KindInsufficientGold, Required = required };

        public static BuyOutcome Bought(double price) => new BuyOutcome { Kind = KindBought, Price = price };
    }

    /// <summary>TS: BuyResult.</summary>
    public sealed class BuyResult
    {
        public Hero Hero;
        public List<Item> Inventory;
        public List<Item> ForSale;
        public BuyOutcome Outcome;
    }

    /// <summary>TS: SellResult['outcome'] — <c>{ kind: 'sold', price }</c>, o único resultado da venda.</summary>
    public sealed class SellOutcome
    {
        public const string KindSold = "sold";

        public string Kind;
        public double Price;

        public static SellOutcome Sold(double price) => new SellOutcome { Kind = KindSold, Price = price };
    }

    /// <summary>TS: SellResult.</summary>
    public sealed class SellResult
    {
        public Hero Hero;
        public List<Item> Inventory;
        public SellOutcome Outcome;
    }

    /// <summary>TS: RestockOutcome — "insufficient_gold" → Required; "restocked" → Price.</summary>
    public sealed class RestockOutcome
    {
        public const string KindInsufficientGold = "insufficient_gold";
        public const string KindRestocked = "restocked";

        public string Kind;
        /// <summary>kind "insufficient_gold": o preço da renovação.</summary>
        public double? Required;
        /// <summary>kind "restocked": o preço pago.</summary>
        public double? Price;

        public static RestockOutcome InsufficientGold(double required) => new RestockOutcome { Kind = KindInsufficientGold, Required = required };

        public static RestockOutcome Restocked(double price) => new RestockOutcome { Kind = KindRestocked, Price = price };
    }

    /// <summary>TS: RestockResult.</summary>
    public sealed class RestockResult
    {
        public Hero Hero;
        /// <summary>null de propósito quando a recusa não gera estoque novo — quem chama mantém o estoque atual.</summary>
        [KeepNull] public List<Item> ForSale;
        public double RestockCount;
        public RestockOutcome Outcome;
    }

    /// <summary>
    /// Economia da loja e do ferreiro (port de shared/src/shop/shop.ts): estoque, preço de compra e venda,
    /// desconto pelo dado de pechincha e a reforja na forja, com a garantia de "pity" depois de 4 tentativas
    /// sem melhora.
    ///
    /// O bônus de pechincha (<c>discount</c>) e a contagem de renovações (<c>restockCount</c>) são estado da
    /// visita à loja: quem chama guarda e passa. Como no TS, nada aqui muta o herói nem as listas recebidas:
    /// quando muda algo, devolve cópia.
    ///
    /// <see cref="RollStock"/> e <see cref="ResolveRestock"/> leem o relógio (o uid dos itens) quando não
    /// recebem <c>now</c>, como o TS.
    /// </summary>
    public static class Shop
    {
        private static ShopData D => GameData.ShopTable;

        /// <summary>O que o vendedor itinerante põe à venda (TS: o literal <c>'consumivel'</c> de rollStock).</summary>
        private const string ConsumableCategory = "consumivel";

        /// <summary>TS: FORGE_MATERIALS — o <c>FORGE</c> de js/shop.js, chaveado pelo templateId do material.</summary>
        public static OrderedMap<ForgeMaterialConfig> ForgeMaterials => D.ForgeMaterials;

        /// <summary>TS: BLACKSMITH_CATEGORIES (privada no TS).</summary>
        public static List<string> BlacksmithCategories => D.BlacksmithCategories;

        /// <summary>
        /// TS: rollStock — sorteia 5 itens à venda: equipamento para o ferreiro (cada item sorteia a categoria
        /// antes), consumível para qualquer outro <paramref name="kind"/>. Sorteios por item: a categoria (só no
        /// ferreiro), o template, a raridade e o uid.
        /// </summary>
        public static List<Item> RollStock(string kind, double floor, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            var stock = new List<Item>();
            for (int i = 0; i < 5; i++)
            {
                string category = kind == ShopKinds.Blacksmith ? Rng.Pick(D.BlacksmithCategories, rng) : ConsumableCategory;
                stock.Add(Items.RandomItem(new Items.RandomItemOptions { Category = category, Floor = floor, Rng = rng, Now = now }));
            }
            return stock;
        }

        /// <summary>
        /// TS: buyPrice — o valor do item com o desconto de loja do herói (<c>derived.descontoLoja</c>, em %)
        /// somado ao bônus de pechincha (fração), com teto de 60% de desconto; nunca menos de 1.
        /// </summary>
        public static double BuyPrice(Hero hero, Item item, double discount = 0)
        {
            // hero.derived.descontoLoja do JS: sem derived, o JS lança ao ler o desconto.
            var derived = hero.Derived ?? throw ReadOfUndefined("descontoLoja");
            double descontoLoja = Js.Truthy(derived.DescontoLoja) ? derived.DescontoLoja : 0;
            return Js.Max(1, Js.Round(item.Value * (1 - Js.Min(0.6, descontoLoja / 100 + discount))));
        }

        /// <summary>TS: sellPrice — metade do valor, para baixo; nunca menos de 1.</summary>
        public static double SellPrice(Item item) => Js.Max(1, Math.Floor(item.Value * 0.5));

        /// <summary>TS: discountForRoll — o d20 da pechincha vira desconto: 20 → 30%, 19 → 20%, 15+ → 15%, 11+ → 10%, 6+ → 5%.</summary>
        public static double DiscountForRoll(double roll)
        {
            double pct = roll >= 20 ? 30 : roll >= 19 ? 20 : roll >= 15 ? 15 : roll >= 11 ? 10 : roll >= 6 ? 5 : 0;
            return pct / 100;
        }

        /// <summary>
        /// TS: rollForgeOutcome — sorteia o delta de tier de uma tentativa de reforja (um sorteio, de 0 a 100,
        /// contra os pesos acumulados na ordem da tabela; passando de todos, o delta é 0). Com
        /// <paramref name="pity"/> &gt;= 4 (4 tentativas seguidas sem melhora), o resultado é pelo menos +1.
        /// </summary>
        public static double RollForgeOutcome(ForgeMaterialConfig cfg, double pity, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            double roll = rng() * 100;
            double total = 0;
            double result = 0;
            // for (const [delta, weight] of cfg.outcomes): o JS sorteia antes de olhar a lista.
            if (cfg.Outcomes == null) throw new EngineError("cfg.outcomes is not iterable", "TypeError");
            foreach (var outcome in cfg.Outcomes)
            {
                if (outcome == null) throw new EngineError("object null is not iterable (cannot read property Symbol(Symbol.iterator))", "TypeError");
                // Par incompleto: o que falta é undefined, e o peso undefined deixa o total em NaN.
                double delta = outcome.Count > 0 ? outcome[0] : double.NaN;
                double weight = outcome.Count > 1 ? outcome[1] : double.NaN;
                total += weight;
                if (roll < total)
                {
                    result = delta;
                    break;
                }
            }
            return pity >= 4 ? Js.Max(1, result) : result;
        }

        /// <summary>
        /// TS: resolveForge — reforja <paramref name="item"/> gastando ouro e uma unidade do material (a
        /// primeira da mochila). Sem efeito, com o motivo em <c>outcome</c> e sem sortear, quando o material é
        /// desconhecido (<c>unavailable</c>), não há unidade dele na mochila (<c>no_material</c>) ou falta ouro
        /// (<c>insufficient_gold</c>). Com efeito: um sorteio (o delta), o item reforjado com o "pity"
        /// (<c>reforgeFails</c>) zerado se o rank subiu, ou somado de 1, e trocado na mochila em toda posição
        /// com o mesmo uid.
        ///
        /// "Subiu" compara o rank novo com o <c>tierRank</c> do item, que é -1 para o que não é equipamento:
        /// reforjar um consumível sempre conta como melhora, mesmo com delta 0 (igual ao TS).
        /// </summary>
        public static ForgeResult ResolveForge(Hero hero, IReadOnlyList<Item> inventory, Item item, string materialId, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            // FORGE_MATERIALS[materialId]: aqui só as chaves da tabela contam. No JS, um materialId com nome de
            // membro de Object.prototype ("constructor", "toString"…) acharia a função herdada; isso não é portado.
            if (!ForgeMaterials.TryGet(materialId, out var cfg) || cfg == null)
                return new ForgeResult { Hero = hero, Inventory = Inventory.Copy(inventory), Item = item, Outcome = ForgeOutcome.Unavailable() };

            var material = FindByTemplateId(inventory, materialId);
            if (material == null)
                return new ForgeResult { Hero = hero, Inventory = Inventory.Copy(inventory), Item = item, Outcome = ForgeOutcome.NoMaterial() };
            if (hero.Gold < cfg.Cost)
                return new ForgeResult { Hero = hero, Inventory = Inventory.Copy(inventory), Item = item, Outcome = ForgeOutcome.InsufficientGold(cfg.Cost) };

            double oldRank = Tiers.RankOf(item);
            double delta = RollForgeOutcome(cfg, item.ReforgeFails ?? 0, rng);
            var reforged = Tiers.Reforge(item, delta);
            var result = reforged.Result;
            bool improved = result.NewRank > oldRank;
            // { ...reforgedBase, reforgeFails }: cópia rasa, os stats continuam os do item reforjado.
            var reforgedItem = Espalhar(reforged.Item);
            reforgedItem.ReforgeFails = improved ? 0 : (item.ReforgeFails ?? 0) + 1;

            var afterRemoval = Inventory.RemoveByUid(inventory, material.Uid).Inventory;
            var nextInventory = new List<Item>(afterRemoval.Count);
            foreach (var i in afterRemoval) nextInventory.Add(Inventory.UidOf(i) == item.Uid ? reforgedItem : i);

            var next = hero.Clone();
            next.Gold = hero.Gold - cfg.Cost;
            return new ForgeResult
            {
                Hero = next,
                Inventory = nextInventory,
                Item = reforgedItem,
                Outcome = ForgeOutcome.Forged(result.OldTier, result.NewTier, improved, reforgedItem.ReforgeFails ?? 0),
            };
        }

        /// <summary>
        /// TS: resolveBuy — paga <see cref="BuyPrice"/>, põe o item no fim da mochila e tira do estoque todo item
        /// com o mesmo uid. Sem ouro: o mesmo herói, cópias das listas e <c>insufficient_gold</c> com o preço.
        /// </summary>
        public static BuyResult ResolveBuy(Hero hero, IReadOnlyList<Item> inventory, IReadOnlyList<Item> forSale, Item item, double discount = 0)
        {
            double price = BuyPrice(hero, item, discount);
            if (hero.Gold < price)
                return new BuyResult { Hero = hero, Inventory = Inventory.Copy(inventory), ForSale = Inventory.Copy(forSale), Outcome = BuyOutcome.InsufficientGold(price) };

            var next = hero.Clone();
            next.Gold = hero.Gold - price;
            var nextInventory = Inventory.AddItem(inventory, item);
            var nextForSale = new List<Item>(forSale.Count);
            foreach (var i in forSale)
                if (Inventory.UidOf(i) != item.Uid) nextForSale.Add(i);
            return new BuyResult { Hero = next, Inventory = nextInventory, ForSale = nextForSale, Outcome = BuyOutcome.Bought(price) };
        }

        /// <summary>TS: resolveSell — recebe <see cref="SellPrice"/> e tira o item (o primeiro com o uid) da mochila.</summary>
        public static SellResult ResolveSell(Hero hero, IReadOnlyList<Item> inventory, Item item)
        {
            double price = SellPrice(item);
            var next = hero.Clone();
            next.Gold = hero.Gold + price;
            return new SellResult { Hero = next, Inventory = Inventory.RemoveByUid(inventory, item.Uid).Inventory, Outcome = SellOutcome.Sold(price) };
        }

        /// <summary>
        /// TS: resolveRestock — renovar o estoque custa <c>10 + andar × 3 + renovações × 10</c> (a contagem é da
        /// visita: zera quando a loja reabre). Sem ouro: o mesmo herói, <c>forSale: null</c> (quem chama mantém o
        /// estoque) e a contagem como veio, sem sortear. Com ouro: um <see cref="RollStock"/> novo e a contagem + 1.
        /// </summary>
        public static RestockResult ResolveRestock(Hero hero, string kind, double floor, double restockCount, RngFn rng = null, Func<double> now = null)
        {
            double price = 10 + floor * 3 + restockCount * 10;
            if (hero.Gold < price)
                return new RestockResult { Hero = hero, ForSale = null, RestockCount = restockCount, Outcome = RestockOutcome.InsufficientGold(price) };

            var next = hero.Clone();
            next.Gold = hero.Gold - price;
            return new RestockResult
            {
                Hero = next,
                ForSale = RollStock(kind, floor, rng, now),
                RestockCount = restockCount + 1,
                Outcome = RestockOutcome.Restocked(price),
            };
        }

        // ---------- apoio ----------

        /// <summary>O <c>inventory.find((i) =&gt; i.templateId === materialId)</c> do TS: o primeiro, ou null; item null lança como no JS.</summary>
        private static Item FindByTemplateId(IReadOnlyList<Item> inventory, string templateId)
        {
            foreach (var i in inventory)
            {
                if (i == null) throw new EngineError("Cannot read properties of null (reading 'templateId')", "TypeError");
                if (i.TemplateId == templateId) return i;
            }
            return null;
        }

        /// <summary>
        /// O <c>{ ...item }</c> do TS: cópia rasa, que continua dividindo o objeto de stats com o original
        /// (Item.Clone copia os stats, que é o <c>{ ...item, stats: { ...item.stats } }</c>).
        /// </summary>
        private static Item Espalhar(Item item)
        {
            var c = item.Clone();
            c.Stats = item.Stats;
            return c;
        }

        private static EngineError ReadOfUndefined(string property) =>
            new EngineError("Cannot read properties of undefined (reading '" + property + "')", "TypeError");
    }
}
