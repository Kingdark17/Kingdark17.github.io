namespace RPGLegend.Engine
{
    /// <summary>TS: NegocianteNaSala — o negociante da sala de agora: a peça, o preço e se o herói tem o ouro.</summary>
    public sealed class NegocianteNaSala
    {
        public Item Item;
        public double Preco;
        public bool PodeComprar;
    }

    /// <summary>TS: o retorno de comprarDoNegociante.</summary>
    public sealed class CompraDoNegociante
    {
        public EstadoDoJogo Estado;
        public string Texto;
    }

    /// <summary>
    /// Port de shared/src/jogo/negociante.ts: a sala do negociante secreto (rodada 6, só o app a gera). Ele mostra a
    /// peça que trouxe, por um preço fixo, e depois da compra segue viagem.
    /// </summary>
    public static class Negociantes
    {
        /// <summary>TS: abrirNegociante — null fora da sala dele ou depois da venda.</summary>
        public static NegocianteNaSala Abrir(EstadoDoJogo estado)
        {
            if (estado.MapMode != "dungeon") return null;
            var negociante = (Estados.CelulaAtual(estado) as DungeonCell)?.Negociante;
            if (negociante == null || negociante.Vendido == true) return null;
            return new NegocianteNaSala { Item = negociante.Item, Preco = negociante.Preco, PodeComprar = estado.Hero.Gold >= negociante.Preco };
        }

        /// <summary>TS: comprarDoNegociante — o ouro sai, a peça vai pra mochila e ele segue viagem. Sem ouro, nada muda.</summary>
        public static CompraDoNegociante Comprar(EstadoDoJogo estado)
        {
            var negociante = Abrir(estado);
            if (negociante == null) return new CompraDoNegociante { Estado = estado, Texto = "" };
            if (!negociante.PodeComprar)
                return new CompraDoNegociante { Estado = estado, Texto = "Faltam " + Js.NumberToString(negociante.Preco - estado.Hero.Gold) + " de ouro." };
            var masmorra = (EstadoNaMasmorra)estado;
            var sala = (DungeonCell)Estados.CelulaAtual(masmorra);
            var comprou = masmorra.Clone();
            comprou.Hero = masmorra.Hero.Clone();
            comprou.Hero.Gold = masmorra.Hero.Gold - negociante.Preco;
            comprou.Inventory = Inventory.AddItem(masmorra.Inventory, negociante.Item);
            var novaSala = sala.Clone();
            novaSala.Negociante = sala.Negociante.Clone();
            novaSala.Negociante.Vendido = true;
            var depois = Estados.SubstituirCelulaAtual(comprou, novaSala);
            return new CompraDoNegociante
            {
                Estado = depois,
                Texto = "Você comprou " + Items.DisplayName(negociante.Item) + " por " + Js.NumberToString(negociante.Preco) + " de ouro. O negociante some pelas sombras.",
            };
        }
    }
}
