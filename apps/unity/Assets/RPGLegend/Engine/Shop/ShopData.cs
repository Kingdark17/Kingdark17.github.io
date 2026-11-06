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
        /// <summary>O degrau de material mais alto que a loja do app vende.</summary>
        [JsName("DEGRAU_DA_LOJA")] public double DegrauDaLoja;
        /// <summary>As poções custam 50% a mais pra comprar (2026-11-06, o Moderado).</summary>
        [JsName("SOBREPRECO_DA_POCAO")] public double SobreprecoDaPocao;
        /// <summary>Privada no TS: os templates que são poção (o sobrepreço vale só pra elas).</summary>
        [JsName("POCOES")] public List<string> Pocoes = new List<string>();
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
