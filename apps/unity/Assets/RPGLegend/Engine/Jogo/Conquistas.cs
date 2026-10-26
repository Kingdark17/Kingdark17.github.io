using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de jogo/conquista.ts (fixtures/data/jogo/conquista.json).</summary>
    public sealed class ConquistaData
    {
        /// <summary>A primeira palavra do título, pela dificuldade.</summary>
        [JsName("TITULOS")] public OrderedMap<string> Titulos = new OrderedMap<string>();
        [JsName("RARIDADE_DO_BAU")] public string RaridadeDoBau;
        [JsName("OURO_DO_BAU")] public OuroDoBauData OuroDoBau;
    }

    public sealed class OuroDoBauData
    {
        public double Base;
        public double PorAndar;
    }

    public static partial class GameData
    {
        private static ConquistaData _conquistaTable;

        /// <summary>jogo/conquista: os títulos e o baú do chefe final.</summary>
        public static ConquistaData ConquistaTable
        {
            get => Require(_conquistaTable, "jogo/conquista");
            set => _conquistaTable = value;
        }
    }

    /// <summary>TS: Conquista — a vitória que a tela mostra: o que foi zerado e o que se ganhou.</summary>
    public sealed class Conquista
    {
        public DungeonRun Masmorra;
        /// <summary>"Floresta · Normal".</summary>
        public string Nome;
        /// <summary>O chefe vencido.</summary>
        public string Chefe;
        /// <summary>O item do baú do chefe.</summary>
        public Item Item;
        public double Ouro;
        public string Titulo;
        /// <summary>O que abriu no portão (a dificuldade seguinte, a próxima masmorra).</summary>
        public List<string> Abertos;
    }

    /// <summary>TS: o que abrirBauDoChefe devolve.</summary>
    public sealed class BauDoChefe
    {
        public EstadoNaMasmorra Estado;
        public Item Item;
        public double Ouro;
    }

    /// <summary>
    /// O que se ganha ao zerar uma masmorra numa dificuldade (port de shared/src/jogo/conquista.ts; decisão do
    /// usuário, 2026-10-25): o baú do chefe (uma peça de equipar lendária da força do andar e muito ouro) e o título no cartão de
    /// guilda, o da maior conquista, que sai de progresso.cleared. O item único de cada masmorra ainda vai ser
    /// desenhado.
    /// </summary>
    public static class Conquistas
    {
        private static ConquistaData D => GameData.ConquistaTable;

        /// <summary>TS: tituloDe — "Sobrevivente da Floresta", "Lenda da Torre".</summary>
        public static string TituloDe(DungeonRun run)
        {
            string palavra = D.Titulos.TryGet(run.Difficulty, out var t) ? t : D.Titulos.Get("normal");
            return palavra + " da " + (Dungeons.ById(run.Dungeon)?.Name ?? Js.Str(run.Dungeon));
        }

        /// <summary>
        /// TS: tituloDoHeroi — o título que o cartão mostra: o da conquista mais difícil (o degrau de força mais alto;
        /// no empate, a masmorra mais adiante). null pra quem ainda não zerou nada.
        /// </summary>
        public static string TituloDoHeroi(DungeonProgress progresso)
        {
            DungeonRun melhor = null;
            var zeradas = progresso?.Cleared ?? new List<string>();
            foreach (var masmorra in Dungeons.All)
            {
                foreach (var dificuldade in Dungeons.Difficulties)
                {
                    var run = new DungeonRun { Dungeon = masmorra.Id, Difficulty = dificuldade.Id };
                    if (!zeradas.Contains(run.Dungeon + ":" + run.Difficulty)) continue;
                    if (melhor == null || Dungeons.TierOf(run) >= Dungeons.TierOf(melhor)) melhor = run;
                }
            }
            return melhor == null ? null : TituloDe(melhor);
        }

        /// <summary>TS: ouroDoBau — uma base e um tanto por andar de força.</summary>
        public static double OuroDoBau(double andarDeForca) => D.OuroDoBau.Base + D.OuroDoBau.PorAndar * andarDeForca;

        /// <summary>
        /// TS: abrirBauDoChefe — a peça lendária (a categoria de equipar sorteada antes, pra não cair material nem poção;
        /// com material no app) vai pra mochila, e o ouro pro herói.
        /// </summary>
        public static BauDoChefe AbrirBauDoChefe(EstadoNaMasmorra estado, RngFn rng = null, Func<double> now = null, bool app = false)
        {
            rng = rng ?? Rng.Default;
            double forca = Estados.AndarDeForca(estado);
            string categoria = Rng.Pick(GameData.ItemTable.EquippableCategories, rng);
            var item = Items.RandomItem(new Items.RandomItemOptions { Category = categoria, Rarity = D.RaridadeDoBau, Floor = forca, Rng = rng, Now = now, App = app, Chefe = app });
            double ouro = OuroDoBau(forca);
            var comBau = estado.Clone();
            var hero = estado.Hero.Clone();
            hero.Gold = estado.Hero.Gold + ouro;
            comBau.Hero = hero;
            comBau.Inventory = Inventory.AddItem(estado.Inventory, item);
            return new BauDoChefe { Estado = comBau, Item = item, Ouro = ouro };
        }
    }
}
