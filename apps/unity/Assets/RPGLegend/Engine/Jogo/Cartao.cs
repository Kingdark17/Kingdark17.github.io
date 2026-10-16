using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: FraquezaNoCartao.</summary>
    public sealed class FraquezaNoCartao
    {
        public string Icone;
        public string Nome;
        public string Efeito;
    }

    /// <summary>TS: PoderNoCartao.</summary>
    public sealed class PoderNoCartao
    {
        public string Id;
        public string Icone;
        public string Nome;
        /// <summary>O mesmo custo que o botão do combate mostra, já com a Mana Instável.</summary>
        public double Custo;
    }

    /// <summary>Port de shared/src/jogo/cartao.ts: o que o cartão de guilda escreve além do que já está no herói.</summary>
    public static class Cartao
    {
        /// <summary>
        /// TS: fraquezaNoCartao — pelo catálogo, e não pela cópia gravada no save (o texto pode ter mudado). Save
        /// antigo gravou só o nome; sem id nem nome, null.
        /// </summary>
        public static FraquezaNoCartao FraquezaNoCartao(Hero hero)
        {
            var gravada = hero.Debuff;
            if (!Js.Truthy(gravada?.Id) && !Js.Truthy(gravada?.Name)) return null;

            var fonte = (Js.Truthy(gravada.Id) ? Catalog.DebuffById(gravada.Id) : null) ?? Catalog.Debuffs.Find(d => d.Name == gravada.Name) ?? gravada;
            return new FraquezaNoCartao { Icone = fonte.Icon ?? "", Nome = fonte.Name ?? "", Efeito = fonte.Desc ?? "" };
        }

        /// <summary>TS: poderesNoCartao.</summary>
        public static List<PoderNoCartao> PoderesNoCartao(Hero hero)
        {
            var poderes = new List<PoderNoCartao>();
            foreach (var poder in Heroes.HeroPowers(hero))
                poderes.Add(new PoderNoCartao { Id = poder.Id, Icone = poder.Icon, Nome = poder.Name, Custo = UsePower.PowerManaCost(hero, poder) });
            return poderes;
        }
    }
}
