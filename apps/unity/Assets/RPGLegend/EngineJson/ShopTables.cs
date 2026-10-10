using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas da loja e da forja: shop/shop.</summary>
    [Preserve]
    internal sealed class ShopTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.ShopTable = JsSerializer.Parse<ShopData>(readTable("shop/shop"));
        }
    }
}
