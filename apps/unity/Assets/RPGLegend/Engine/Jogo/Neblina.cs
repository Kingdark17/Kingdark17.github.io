using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: EstadoDaSala — quanto o jogador sabe de uma sala do minimapa.</summary>
    public static class EstadosDaSala
    {
        /// <summary>Não é sala.</summary>
        public const string Vazia = "vazia";
        /// <summary>Nem vizinha de visitada.</summary>
        public const string Inexplorada = "inexplorada";
        /// <summary>Vizinha de visitada, pela porta: aparece sem o tipo.</summary>
        public const string Silhueta = "silhueta";
        /// <summary>Contaram ao jogador o que tem lá.</summary>
        public const string Revelada = "revelada";
        /// <summary>O jogador entrou.</summary>
        public const string Visitada = "visitada";
    }

    /// <summary>Port de shared/src/jogo/neblina.ts: a neblina do minimapa.</summary>
    public static class Neblina
    {
        /// <summary>TS: estadoDaSala.</summary>
        public static string EstadoDaSala(IReadOnlyList<IReadOnlyList<RoomCell>> grade, RoomCell celula, double colunas, double linhas)
        {
            if (celula.Type == "void") return EstadosDaSala.Vazia;
            if (celula.Visited ?? false) return EstadosDaSala.Visitada;
            if (celula.Revealed ?? false) return EstadosDaSala.Revelada;
            return DungeonGraph.IsKnown(grade, celula, colunas, linhas) ? EstadosDaSala.Silhueta : EstadosDaSala.Inexplorada;
        }

        /// <summary>TS: sabeOTipo — o jogador sabe o que tem nesta sala (libera cor, arte e ícone).</summary>
        public static bool SabeOTipo(string estado) => estado == EstadosDaSala.Visitada || estado == EstadosDaSala.Revelada;
    }
}
