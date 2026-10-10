using System;

namespace RPGLegend.Engine
{
    /// <summary>
    /// As tabelas do jogo — o que no TypeScript são constantes de módulo (catálogo, templates, espécies…).
    ///
    /// Elas não estão escritas em C#: são lidas dos mesmos JSON que o TypeScript exporta
    /// (packages/shared/fixtures/data), por RPGLegend.Engine.Json.GameDataLoader. Assim, um ajuste de
    /// balanceamento feito no TS chega à Unity sem ninguém copiar número à mão.
    ///
    /// Classe parcial: cada módulo acrescenta as próprias tabelas num arquivo seu (ex.: Monsters/GameData.Monsters.cs),
    /// e o carregamento delas fica num ITableSet em RPGLegend.Engine.Json.
    /// </summary>
    public static partial class GameData
    {
        private static HeroCatalogData _heroCatalog;
        private static RarityData _rarityTable;
        private static ItemTemplatesData _itemTable;
        private static TierData _tierTable;

        /// <summary>hero/catalog: raças, classes, poderes, debuffs.</summary>
        public static HeroCatalogData HeroCatalog
        {
            get => Require(_heroCatalog, "hero/catalog");
            set => _heroCatalog = value;
        }

        /// <summary>items/rarity.</summary>
        public static RarityData RarityTable
        {
            get => Require(_rarityTable, "items/rarity");
            set => _rarityTable = value;
        }

        /// <summary>items/templates.</summary>
        public static ItemTemplatesData ItemTable
        {
            get => Require(_itemTable, "items/templates");
            set => _itemTable = value;
        }

        /// <summary>items/tiers.</summary>
        public static TierData TierTable
        {
            get => Require(_tierTable, "items/tiers");
            set => _tierTable = value;
        }

        /// <summary>Usado pelas partes de GameData de cada módulo (GameData.Monsters.cs, …).</summary>
        internal static T Require<T>(T table, string name) where T : class
        {
            if (table == null)
                throw new InvalidOperationException("Tabela " + name + " não carregada: chame GameDataLoader.Load antes de usar a engine.");
            return table;
        }
    }
}
