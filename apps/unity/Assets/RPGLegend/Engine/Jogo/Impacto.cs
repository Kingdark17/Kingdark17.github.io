using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: LinhaDeImpacto — uma medida que muda, com o valor de antes e o de depois.</summary>
    public sealed class LinhaDeImpacto
    {
        public string Rotulo;
        public double Antes;
        public double Depois;
    }

    /// <summary>TS: Impacto — o que mexer na peça faz. Linhas vazias: cabe, mas não muda nada.</summary>
    public sealed class Impacto
    {
        /// <summary>TS: AcaoDaPeca — "equipar" ou "guardar".</summary>
        public string Acao;
        public List<LinhaDeImpacto> Linhas;
    }

    /// <summary>Uma das medidas que o equipamento move, e as casas com que ela aparece.</summary>
    public sealed class MedidaDef
    {
        public string Chave;
        public string Rotulo;
        public double Casas;
    }

    /// <summary>As tabelas de jogo/impacto.ts (fixtures/data/jogo/impacto.json; MEDIDAS é privada).</summary>
    public sealed class ImpactoData
    {
        [JsName("MEDIDAS")] public List<MedidaDef> Medidas = new List<MedidaDef>();
    }

    public static partial class GameData
    {
        private static ImpactoData _impactoTable;

        /// <summary>jogo/impacto: as medidas da ficha.</summary>
        public static ImpactoData ImpactoTable
        {
            get => Require(_impactoTable, "jogo/impacto");
            set => _impactoTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/impacto.ts: "o que muda em você" antes de equipar uma peça. Nenhuma fórmula nasce
    /// aqui: o "depois" é o herói passado por <see cref="Heroes.EquipItem"/> e medido pelas mesmas funções do
    /// combate. O crítico soma o do equipamento (como no golpe), e o ataque passa pela afinidade da arma.
    /// </summary>
    public static class Impactos
    {
        private static ImpactoData D => GameData.ImpactoTable;

        /// <summary>TS: retrato — o herói nas sete medidas.</summary>
        private static OrderedMap<double> Retrato(Hero hero)
        {
            var derivados = Derived.Compute(hero);
            var daPeca = Derived.EquipmentBonus(hero.Equip);
            var retrato = new OrderedMap<double>();
            retrato.Set("vida", derivados.MaxHp);
            retrato.Set("mana", derivados.MaxMp);
            retrato.Set("ataque", Damage.WeaponAtkContribution(hero, Heroes.WeaponAffinityPct(hero)) + Damage.OtherEquipAtk(hero));
            retrato.Set("defesa", daPeca.Get("defesa"));
            retrato.Set("critico", derivados.Critico + daPeca.Get("critico"));
            retrato.Set("esquiva", derivados.Esquiva);
            retrato.Set("velocidade", derivados.Velocidade);
            return retrato;
        }

        private static double Arredondar(double valor, double casas)
        {
            double fator = Math.Pow(10, casas);
            return Js.Round(valor * fator) / fator;
        }

        /// <summary>TS: diferencas — só as linhas que mudam na tela (comparadas já arredondadas).</summary>
        private static List<LinhaDeImpacto> Diferencas(OrderedMap<double> antes, OrderedMap<double> depois)
        {
            var linhas = new List<LinhaDeImpacto>();
            foreach (var medida in D.Medidas)
            {
                double de = Arredondar(antes.Get(medida.Chave), medida.Casas);
                double para = Arredondar(depois.Get(medida.Chave), medida.Casas);
                if (de != para) linhas.Add(new LinhaDeImpacto { Rotulo = medida.Rotulo, Antes = de, Depois = para });
            }
            return linhas;
        }

        /// <summary>
        /// TS: impactoDaPeca — o impacto de mexer nesta peça, ou null quando ela não é de vestir. Recusada pela arma
        /// de duas mãos, mede a troca inteira (guardar a arma e vestir a peça).
        /// </summary>
        public static Impacto ImpactoDaPeca(Hero hero, Item item, string slotDesejado = null)
        {
            var jaEquipada = Heroes.EquippedSlot(hero, item);
            if (jaEquipada != null)
                return new Impacto { Acao = "guardar", Linhas = Diferencas(Retrato(hero), Retrato(Heroes.UnequipItem(hero, jaEquipada))) };

            var resultado = Heroes.EquipItem(hero, item, slotDesejado);
            if (resultado.Equipped) return new Impacto { Acao = "equipar", Linhas = Diferencas(Retrato(hero), Retrato(resultado.Hero)) };

            if (resultado.Reason == EquipFailReasons.TwoHandedWeapon)
            {
                var trocado = Heroes.EquipItem(Heroes.UnequipItem(hero, "arma"), item, "secundaria");
                if (trocado.Equipped) return new Impacto { Acao = "equipar", Linhas = Diferencas(Retrato(hero), Retrato(trocado.Hero)) };
            }

            return null;
        }
    }
}
