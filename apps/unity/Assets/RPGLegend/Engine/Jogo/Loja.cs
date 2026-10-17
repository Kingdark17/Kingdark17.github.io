using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: Loja — a sessão de loja ou de ferreiro: o que só existe enquanto ela está aberta (o desconto da
    /// pechincha e as renovações desta visita). O estoque não é sessão: mora na sala e vai pro save.
    /// </summary>
    public sealed class Loja
    {
        public EstadoNaCidade Estado;
        /// <summary>TS: ShopKind — "shop" ou "blacksmith".</summary>
        public string Kind;
        /// <summary>Bônus de pechincha desta visita, de 0 a 0,3.</summary>
        public double Desconto;
        /// <summary>O dado de pechincha só pode ser rolado uma vez por visita.</summary>
        public bool DescontoRolado;
        public double Renovacoes;
        [KeepNull] public double? Dado;
        public List<string> Log;
        /// <summary>A loja é a do app: o estoque novo pode ter peça no degrau 2 do material. Só aparece quando é true.</summary>
        public bool? App;

        /// <summary>O <c>{ ...loja }</c> do TS.</summary>
        public Loja Clone() => (Loja)MemberwiseClone();

        internal Loja ComLog(string linha)
        {
            var c = Clone();
            c.Log = new List<string> { linha };
            return c;
        }
    }

    /// <summary>Port de shared/src/jogo/loja.ts. A economia mora em <see cref="Shop"/>.</summary>
    public static class Lojas
    {
        private static CityCell ComEstoque(CityCell sala, List<Item> estoque)
        {
            var nova = sala.Clone();
            nova.ForSale = estoque;
            return nova;
        }

        /// <summary>
        /// TS: abrirLoja — sorteia o estoque só quando a sala ainda não tem um guardado. <paramref name="app"/>: a loja é a
        /// do app (o estoque dela, e o da renovação, pode ter peça com material).
        /// </summary>
        public static Loja AbrirLoja(EstadoNaCidade estado, string kind, RngFn rng = null, Func<double> now = null, bool app = false)
        {
            rng = rng ?? Rng.Default;
            var sala = (CityCell)Estados.CelulaAtual(estado);
            var comEstoque = sala.ForSale != null && sala.ForSale.Count > 0
                ? estado
                : Estados.SubstituirCelulaAtual(estado, ComEstoque(sala, Shop.RollStock(kind, Estados.AndarDeForca(estado), rng, now, app)));

            return new Loja
            {
                Estado = comEstoque,
                Kind = kind,
                Desconto = 0,
                DescontoRolado = false,
                Renovacoes = 0,
                Dado = null,
                Log = new List<string> { kind == ShopKinds.Blacksmith ? "A forja do ferreiro está acesa." : "O vendedor itinerante abre a sacola." },
                App = app ? true : (bool?)null,
            };
        }

        /// <summary>TS: estoque.</summary>
        public static List<Item> Estoque(Loja loja) => (Estados.CelulaAtual(loja.Estado) as CityCell)?.ForSale ?? new List<Item>();

        /// <summary>TS: vendaveis — equipado não sai da mão.</summary>
        public static List<Item> Vendaveis(Loja loja) => loja.Estado.Inventory.FindAll(item => !item.Equipped);

        /// <summary>TS: precoDeCompra.</summary>
        public static double PrecoDeCompra(Loja loja, Item item) => Shop.BuyPrice(loja.Estado.Hero, item, loja.Desconto);

        /// <summary>TS: precoDeVenda.</summary>
        public static double PrecoDeVenda(Item item) => Shop.SellPrice(item);

        /// <summary>TS: precoDaRenovacao.</summary>
        public static double PrecoDaRenovacao(Loja loja) => 10 + Estados.AndarDeForca(loja.Estado) * 3 + loja.Renovacoes * 10;

        /// <summary>TS: pechinchar — o d20 da pechincha, uma vez por visita. A rolagem vem de fora.</summary>
        public static Loja Pechinchar(Loja loja, double roll)
        {
            if (loja.DescontoRolado) return loja;

            double desconto = Shop.DiscountForRoll(roll);
            double pct = Js.Round(desconto * 100);
            var nova = loja.ComLog(pct > 0 ? "Você conseguiu " + Js.NumberToString(pct) + "% de desconto." : "O comerciante não concedeu desconto.");
            nova.Desconto = desconto;
            nova.DescontoRolado = true;
            nova.Dado = roll;
            return nova;
        }

        /// <summary>TS: comprar.</summary>
        public static Loja Comprar(Loja loja, Item item)
        {
            var sala = (CityCell)Estados.CelulaAtual(loja.Estado);
            var compra = Shop.ResolveBuy(loja.Estado.Hero, loja.Estado.Inventory, sala.ForSale ?? new List<Item>(), item, loja.Desconto);

            if (compra.Outcome.Kind == BuyOutcome.KindInsufficientGold)
            {
                var custa = Items.Concordar(item, new[] { "custa", "custa", "custam", "custam" });
                return loja.ComLog("Ouro insuficiente: " + Items.DisplayName(item) + " " + custa + " " + Js.NumberToString(compra.Outcome.Required ?? double.NaN) + ".");
            }

            var comCompra = loja.Estado.Clone();
            comCompra.Hero = compra.Hero;
            comCompra.Inventory = compra.Inventory;
            var nova = loja.ComLog("Você compra " + Items.DisplayName(item) + " por " + Js.NumberToString(compra.Outcome.Price ?? double.NaN) + " de ouro.");
            nova.Estado = Estados.SubstituirCelulaAtual(comCompra, ComEstoque(sala, compra.ForSale));
            return nova;
        }

        /// <summary>TS: vender.</summary>
        public static Loja Vender(Loja loja, Item item)
        {
            var venda = Shop.ResolveSell(loja.Estado.Hero, loja.Estado.Inventory, item);
            var comVenda = loja.Estado.Clone();
            comVenda.Hero = venda.Hero;
            comVenda.Inventory = venda.Inventory;
            var nova = loja.ComLog("Você vende " + Items.DisplayName(item) + " por " + Js.NumberToString(venda.Outcome.Price) + " de ouro.");
            nova.Estado = comVenda;
            return nova;
        }

        /// <summary>TS: renovarEstoque — cobra ouro e sorteia outro estoque.</summary>
        public static Loja RenovarEstoque(Loja loja, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            var sala = (CityCell)Estados.CelulaAtual(loja.Estado);
            var renovacao = Shop.ResolveRestock(loja.Estado.Hero, loja.Kind, Estados.AndarDeForca(loja.Estado), loja.Renovacoes, rng, now, loja.App == true);

            if (renovacao.Outcome.Kind == RestockOutcome.KindInsufficientGold)
                return loja.ComLog("Renovar o estoque custa " + Js.NumberToString(renovacao.Outcome.Required ?? double.NaN) + " de ouro.");
            if (renovacao.ForSale == null) return loja;

            var comOuro = loja.Estado.Clone();
            comOuro.Hero = renovacao.Hero;
            var nova = loja.ComLog("Estoque renovado por " + Js.NumberToString(renovacao.Outcome.Price ?? double.NaN) + " de ouro.");
            nova.Estado = Estados.SubstituirCelulaAtual(comOuro, ComEstoque(sala, renovacao.ForSale));
            nova.Renovacoes = renovacao.RestockCount;
            return nova;
        }

        /// <summary>TS: reforjar.</summary>
        public static Loja Reforjar(Loja loja, Item item, string materialId, RngFn rng = null, Func<double> now = null)
        {
            var forja = Shop.ResolveForge(loja.Estado.Hero, loja.Estado.Inventory, item, materialId, rng ?? Rng.Default, now);

            if (forja.Outcome.Kind == ForgeOutcome.KindInsufficientGold)
                return loja.ComLog("A reforja custa " + Js.NumberToString(forja.Outcome.Required ?? double.NaN) + " de ouro.");
            if (forja.Outcome.Kind == ForgeOutcome.KindNoMaterial) return loja.ComLog("Você não tem esse material na mochila.");
            if (forja.Outcome.Kind == ForgeOutcome.KindUnavailable) return loja.ComLog("Material desconhecido.");

            var antes = forja.Outcome.OldTier;
            var depois = forja.Outcome.NewTier;
            string veredito = "Piorou.";
            if (forja.Outcome.Improved ?? false) veredito = "Melhorou!";
            else if (antes == depois) veredito = "Manteve o tier.";

            var comForja = loja.Estado.Clone();
            comForja.Hero = forja.Hero;
            comForja.Inventory = forja.Inventory;
            var nova = loja.ComLog("Reforja de " + Items.DisplayName(item) + ": Tier " + Js.Str(antes) + " → Tier " + Js.Str(depois) + ". " + veredito);
            foreach (var runa in forja.Outcome.RunasDevolvidas ?? new List<Item>())
                nova.Log.Add("A arma perdeu um espaço de runa: " + Items.DisplayName(runa) + " volta pra mochila.");
            nova.Estado = comForja;
            return nova;
        }
    }
}
