using System.Collections.Generic;
using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/inventory.json (inventory/inventory.ts). Cada handler reproduz o executor do gerador
    /// (scripts/gen-fixtures.ts, seção modulo('inventory')): chama a função com os argumentos e grava o retorno.
    /// </summary>
    internal sealed class InventoryFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "inventory";

            Fn(M, "addItem", (a, c) => W(Inventory.AddItem(R<List<Item>>(a["inventory"]), R<Item>(a["item"]))));
            Fn(M, "removeByUid", (a, c) => W(Inventory.RemoveByUid(R<List<Item>>(a["inventory"]), Str(a["uid"]))));
            Fn(M, "findByUid", (a, c) => W(Inventory.FindByUid(R<List<Item>>(a["inventory"]), Str(a["uid"]))));
            Fn(M, "consumeItem", (a, c) =>
                W(Inventory.ConsumeItem(R<Hero>(a["hero"]), R<List<Item>>(a["inventory"]), R<Item>(a["item"]))));
        }
    }
}
