using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/shop.json (shop/shop.ts). Cada handler reproduz o executor do gerador
    /// (scripts/gen-fixtures.ts, seção modulo('shop')): os sorteios e o relógio vêm do caso (ctx), não de
    /// <c>args.options</c> — o gerador grava <c>options: { now }</c> nos argumentos, mas chama a função com o
    /// <c>{ rng, now }</c> do contexto.
    /// </summary>
    internal sealed class ShopFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "shop";

            Const(M, "FORGE_MATERIALS", () => W(Shop.ForgeMaterials));

            Fn(M, "rollStock", (a, c) => W(Shop.RollStock(Str(a["kind"]), Num(a["floor"]), c.RngFn, c.NowOrFail, JsJson.Truthy(JsJson.Prop(a["options"], "app")))));
            Fn(M, "buyPrice", (a, c) => N(Shop.BuyPrice(R<Hero>(a["hero"]), R<Item>(a["item"]), Discount(a["discount"]))));
            Fn(M, "sellPrice", (a, c) => N(Shop.SellPrice(R<Item>(a["item"]))));
            Fn(M, "discountForRoll", (a, c) => N(Shop.DiscountForRoll(Num(a["roll"]))));
            Fn(M, "rollForgeOutcome", (a, c) => N(Shop.RollForgeOutcome(R<ForgeMaterialConfig>(a["cfg"]), Num(a["pity"]), c.RngFn)));
            Fn(M, "resolveForge", (a, c) =>
                W(Shop.ResolveForge(R<Hero>(a["hero"]), R<List<Item>>(a["inventory"]), R<Item>(a["item"]), Str(a["materialId"]), c.RngFn)));
            Fn(M, "resolveBuy", (a, c) =>
                W(Shop.ResolveBuy(R<Hero>(a["hero"]), R<List<Item>>(a["inventory"]), R<List<Item>>(a["forSale"]), R<Item>(a["item"]),
                    Discount(a["discount"]))));
            Fn(M, "resolveSell", (a, c) => W(Shop.ResolveSell(R<Hero>(a["hero"]), R<List<Item>>(a["inventory"]), R<Item>(a["item"]))));
            Fn(M, "resolveRestock", (a, c) =>
                W(Shop.ResolveRestock(R<Hero>(a["hero"]), Str(a["kind"]), Num(a["floor"]), Num(a["restockCount"]), c.RngFn, c.NowOrFail,
                    JsJson.Truthy(JsJson.Prop(a["options"], "app")))));
        }

        /// <summary>O <c>discount = 0</c> do TS: o padrão só vale para o argumento ausente (null conta como 0 na soma).</summary>
        private static double Discount(JToken token) => JsJson.IsUndefined(token) ? 0 : Num(token);
    }
}
