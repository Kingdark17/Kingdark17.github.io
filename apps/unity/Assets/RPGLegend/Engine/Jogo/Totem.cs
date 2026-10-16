namespace RPGLegend.Engine
{
    /// <summary>TS: Totem — o totem tocado e o que ele diz.</summary>
    public sealed class Totem
    {
        public EstadoNaMasmorra Estado;
        public string Texto;
    }

    /// <summary>
    /// Port de shared/src/jogo/totem.ts: o totem dos andares 20, 40, 60 e 80. Tocar marca o andar no portão da
    /// cidade, pra esta masmorra e esta dificuldade, e oferece a volta pra cidade.
    /// </summary>
    public static class Totens
    {
        /// <summary>TS: tocarTotem.</summary>
        public static Totem TocarTotem(EstadoNaMasmorra estado)
        {
            var progresso = Dungeons.TouchTotem(estado.Progresso, estado.Masmorra, estado.Floor);
            var lugar = "o andar " + Js.NumberToString(estado.Floor) + " de " + Dungeons.RunName(estado.Masmorra);
            var texto = ReferenceEquals(progresso, estado.Progresso)
                ? "O totem já conhece você: " + lugar + " segue marcado no portão da cidade."
                : "O totem acende quando você o toca. Agora " + lugar + " pode ser escolhido no portão da cidade.";
            var comTotem = estado.Clone();
            comTotem.Progresso = progresso;
            return new Totem { Estado = comTotem, Texto = texto };
        }

        /// <summary>TS: voltarPeloTotem.</summary>
        public static EstadoNaCidade VoltarPeloTotem(Totem totem) => Estados.VoltarParaCidade(totem.Estado);
    }
}
