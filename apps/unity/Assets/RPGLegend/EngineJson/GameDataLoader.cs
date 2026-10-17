using System;
using System.Collections.Generic;
using System.Linq;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// Um grupo de tabelas de um módulo (ex.: monstros). Para um módulo novo, crie uma classe
    /// <c>[Preserve] internal sealed class XxxTables : ITableSet</c> neste assembly: o GameDataLoader acha sozinho.
    /// </summary>
    public interface ITableSet
    {
        /// <param name="readTable">Recebe o caminho da tabela (ex.: "monsters/species") e devolve o texto JSON.</param>
        void Load(Func<string, string> readTable);
    }

    /// <summary>
    /// Carrega as tabelas do jogo (GameData) a partir dos JSON exportados pelo TypeScript
    /// (packages/shared/fixtures/data). Quem chama decide de onde vem o texto: nos testes, da pasta do
    /// repositório; no jogo, da cópia dentro do projeto Unity.
    /// </summary>
    public static class GameDataLoader
    {
        /// <param name="readTable">Recebe o caminho da tabela (ex.: "hero/catalog") e devolve o texto JSON.</param>
        public static void Load(Func<string, string> readTable)
        {
            foreach (var set in TableSets()) set.Load(readTable);
        }

        /// <summary>Todos os ITableSet deste assembly, em ordem de nome (determinística).</summary>
        public static IEnumerable<ITableSet> TableSets() =>
            typeof(GameDataLoader).Assembly.GetTypes()
                .Where(t => typeof(ITableSet).IsAssignableFrom(t) && !t.IsAbstract && !t.IsInterface)
                .OrderBy(t => t.FullName, StringComparer.Ordinal)
                .Select(t => (ITableSet)Activator.CreateInstance(t, true));
    }

    /// <summary>Tabelas do herói e dos itens: hero/catalog, items/rarity, items/templates, items/tiers.</summary>
    [Preserve]
    internal sealed class BaseTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.HeroCatalog = JsSerializer.Parse<HeroCatalogData>(readTable("hero/catalog"));
            GameData.RarityTable = JsSerializer.Parse<RarityData>(readTable("items/rarity"));
            GameData.ItemTable = JsSerializer.Parse<ItemTemplatesData>(readTable("items/templates"));
            GameData.MateriaisTable = JsSerializer.Parse<MateriaisData>(readTable("items/materiais"));
            GameData.TierTable = JsSerializer.Parse<TierData>(readTable("items/tiers"));
        }
    }
}
