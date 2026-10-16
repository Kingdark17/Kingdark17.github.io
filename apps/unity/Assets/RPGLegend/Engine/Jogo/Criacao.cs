using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Criacao — o que a criação de personagem decide: nome, raça e cabelo.</summary>
    public sealed class Criacao
    {
        public string Nome;
        [KeepNull] public RaceDef Raca;
        /// <summary>Penteado: começa no padrão e só muda se a pessoa quiser.</summary>
        [KeepNull] public string Cabelo;
    }

    /// <summary>TS: SaveInicial — o save de um personagem recém-criado.</summary>
    public sealed class SaveInicial
    {
        public Hero Hero;
        public List<Item> Inventory;
        /// <summary>Sempre vazia (o <c>never[]</c> do TS).</summary>
        public List<Companion> Party;
        public double Floor;
        /// <summary>Sempre vazia (o <c>never[]</c> do TS).</summary>
        public List<Quest> Quests;
    }

    /// <summary>
    /// Port de shared/src/jogo/criacao.ts e save-inicial.ts: o herói nasce Aprendiz, com atributos fixos, e a
    /// classe vem do Treinamento de Guilda. A fraqueza é sorteada sem aparecer na criação.
    /// </summary>
    public static class Criacoes
    {
        /// <summary>TS: criacaoVazia.</summary>
        public static Criacao CriacaoVazia(string nome) => new Criacao { Nome = nome, Raca = null, Cabelo = null };

        /// <summary>TS: faltaParaComecar — "nome", "raca" ou null; o cabelo não trava o começo.</summary>
        public static string FaltaParaComecar(Criacao criacao)
        {
            if (criacao.Nome.Trim().Length == 0) return "nome";
            if (criacao.Raca == null) return "raca";
            return null;
        }

        /// <summary>
        /// TS: montarSaveInicial — o Aprendiz e o consumível do começo. Sem raça, o erro
        /// <c>CriacaoIncompletaError</c> do TS. <paramref name="now"/> é o relógio do uid da poção.
        /// </summary>
        public static SaveInicial MontarSaveInicial(Criacao criacao, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            if (criacao.Raca == null) throw new EngineError("Criação incompleta: falta a raça.", "CriacaoIncompletaError");

            var fraquezas = Catalog.Debuffs;
            var fraqueza = fraquezas[(int)Math.Floor(rng() * fraquezas.Count)];

            var hero = Heroes.BuildApprentice(new ApprenticeCreation
            {
                Name = criacao.Nome.Trim(),
                Race = criacao.Raca,
                Debuff = fraqueza,
                // Quem não escolheu não grava penteado nenhum: o paperdoll resolve o padrão na hora de desenhar.
                Hair = criacao.Cabelo,
            }, rng);

            var inventory = Inventory.AddItem(new List<Item>(), Items.RandomItem(new Items.RandomItemOptions
            {
                Category = "consumivel",
                Floor = 1,
                Rng = rng,
                Now = now,
            }));

            return new SaveInicial { Hero = hero, Inventory = inventory, Party = new List<Companion>(), Floor = 1, Quests = new List<Quest>() };
        }
    }
}
