using System;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de items/acessorios-unicos.ts (fixtures/data/items/acessorios-unicos.json).</summary>
    public sealed class AcessoriosUnicosData
    {
        /// <summary>O acessório único de cada masmorra (o id do modelo).</summary>
        [JsName("ACESSORIOS_UNICOS")] public OrderedMap<string> AcessoriosUnicos = new OrderedMap<string>();
        [JsName("RARIDADE_DO_UNICO")] public string RaridadeDoUnico;
    }

    public static partial class GameData
    {
        private static AcessoriosUnicosData _acessoriosUnicosTable;

        /// <summary>items/acessorios-unicos: o acessório de cada masmorra e a raridade com que nasce.</summary>
        public static AcessoriosUnicosData AcessoriosUnicosTable
        {
            get => Require(_acessoriosUnicosTable, "items/acessorios-unicos");
            set => _acessoriosUnicosTable = value;
        }
    }

    /// <summary>TS: o efeito do acessório único que o herói está usando, com o valor da versão dele.</summary>
    public sealed class EfeitoNoHeroi
    {
        public string Efeito;
        public double Valor;
    }

    /// <summary>
    /// Os acessórios únicos das masmorras (port de shared/src/items/acessorios-unicos.ts; decisão do usuário,
    /// 2026-10-26): um por masmorra, na primeira vez que se zera cada dificuldade (a versão Normal, Difícil ou
    /// Pesadelo). O Amuleto da Floresta Antiga recupera vida a cada rodada, a Presa do Morcego devolve parte do dano
    /// em vida, a Coroa do Arquimago barateia os poderes — e só a arena do app aplica o efeito.
    /// </summary>
    public static class AcessoriosUnicos
    {
        private static AcessoriosUnicosData D => GameData.AcessoriosUnicosTable;

        /// <summary>TS: acessorioUnico — o desta masmorra, na versão desta dificuldade (Normal 1, Difícil 2, Pesadelo 3).</summary>
        public static Item AcessorioUnico(DungeonRun run, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            string id = D.AcessoriosUnicos.TryGet(run.Dungeon, out var achado) ? achado : D.AcessoriosUnicos.Get("floresta");
            var template = ItemTemplates.ById(id) ?? throw new EngineError("Acessório único desconhecido: " + run.Dungeon, "Error");
            double nivel = Js.Max(1, Dungeons.Difficulties.FindIndex(d => d.Id == run.Difficulty) + 1);
            var item = Items.Instantiate(template, Rarities.ById(D.RaridadeDoUnico), rng, now);
            if (nivel > 1) item.NivelDoUnico = nivel;
            return item;
        }

        /// <summary>TS: efeitoDoUnico — o efeito do acessório único equipado, com o valor da versão; null sem um.</summary>
        public static EfeitoNoHeroi EfeitoDoUnico(Hero hero)
        {
            var peca = hero?.Equip?.Get("acessorio");
            var unico = peca != null ? ItemTemplates.ById(peca.TemplateId)?.Unico : null;
            if (peca == null || unico == null) return null;
            int nivel = (int)Items.NivelDoUnico(peca) - 1;
            return new EfeitoNoHeroi { Efeito = unico.Efeito, Valor = nivel < unico.Valores.Count ? unico.Valores[nivel] : 0 };
        }

        /// <summary>TS: descontoDeMana — quanto o herói paga a menos nos poderes (a Coroa do Arquimago); 0 sem ela.</summary>
        public static double DescontoDeMana(Hero hero)
        {
            var efeito = EfeitoDoUnico(hero);
            return efeito != null && efeito.Efeito == "desconto_de_mana" ? efeito.Valor : 0;
        }
    }
}
