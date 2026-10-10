using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: ForgeMaterialConfig — o custo em ouro de uma tentativa de reforja com o material e os resultados possíveis.</summary>
    public sealed class ForgeMaterialConfig
    {
        public double Cost;
        /// <summary>
        /// Pares <c>[delta de tier, peso percentual]</c>, na ordem que o original testava (TS: <c>Array&lt;[number, number]&gt;</c>).
        /// Sem inicializador de propósito: ausente continua ausente, como no TS.
        /// </summary>
        public List<List<double>> Outcomes;
    }

    /// <summary>As tabelas de shop/shop.ts (fixtures/data/shop/shop.json), inclusive a privada BLACKSMITH_CATEGORIES.</summary>
    public sealed class ShopData
    {
        /// <summary>As categorias do estoque do ferreiro (arma, armadura, acessório); o vendedor itinerante só vende consumível.</summary>
        [JsName("BLACKSMITH_CATEGORIES")] public List<string> BlacksmithCategories = new List<string>();
        /// <summary>Chaveado pelo templateId do material (minerio, essencia, catalisador_mitico, pedra_protecao).</summary>
        [JsName("FORGE_MATERIALS")] public OrderedMap<ForgeMaterialConfig> ForgeMaterials = new OrderedMap<ForgeMaterialConfig>();
    }

    public static partial class GameData
    {
        private static ShopData _shopTable;

        /// <summary>shop/shop: categorias do ferreiro e materiais de forja.</summary>
        public static ShopData ShopTable
        {
            get => Require(_shopTable, "shop/shop");
            set => _shopTable = value;
        }
    }
}
