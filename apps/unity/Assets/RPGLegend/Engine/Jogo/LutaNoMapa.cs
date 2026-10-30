using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de jogo/luta-no-mapa.ts (fixtures/data/jogo/luta-no-mapa.json).</summary>
    public sealed class LutaNoMapaData
    {
        /// <summary>Privada no TS: quanto cada monstro fica do meio da sala (coluna, linha), pelo tamanho do grupo.</summary>
        [JsName("DESENHOS")] public List<List<List<double>>> Desenhos = new List<List<List<double>>>();
    }

    public static partial class GameData
    {
        private static LutaNoMapaData _lutaNoMapaTable;

        /// <summary>jogo/luta-no-mapa: onde cada monstro do grupo se põe na sala.</summary>
        public static LutaNoMapaData LutaNoMapaTable
        {
            get => Require(_lutaNoMapaTable, "jogo/luta-no-mapa");
            set => _lutaNoMapaTable = value;
        }
    }

    /// <summary>TS: LugarNaLuta.</summary>
    public sealed class LugarNaLuta
    {
        public double Col;
        public double Row;
    }

    /// <summary>
    /// Port de shared/src/jogo/luta-no-mapa.ts: a luta no mapa (2026-10-30, pedido do Breno, site e app). No lugar da
    /// tela em primeira pessoa, a luta acontece na própria sala, e aqui fica onde cada monstro do grupo se põe nela.
    /// </summary>
    public static class LutaNoMapa
    {
        /// <summary>TS: lugaresNaLuta — os lugares dos monstros na sala, na ordem do grupo, em volta do meio dela.</summary>
        public static List<LugarNaLuta> LugaresNaLuta(double quantos, GeometriaDaSala geometria = null)
        {
            geometria = geometria ?? RoomWalk.GeometriaPadrao;
            var desenhos = GameData.LutaNoMapaTable.Desenhos;
            int n = (int)Math.Max(1, Math.Min(desenhos.Count, quantos));
            var lugares = new List<LugarNaLuta>();
            foreach (var d in desenhos[n - 1]) lugares.Add(new LugarNaLuta { Col = geometria.Conteudo.Col + d[0], Row = geometria.Conteudo.Row + d[1] });
            return lugares;
        }

        /// <summary>
        /// TS: heroiNaLuta — onde o herói fica na luta. Ele entra andando e a luta abre na porta, com ele ainda no vão; como
        /// a câmera enquadra a sala inteira, dá um passo pra dentro (o lugar de quem chega por aquela porta).
        /// </summary>
        public static Walker HeroiNaLuta(Walker walker, GeometriaDaSala geometria = null)
        {
            geometria = geometria ?? RoomWalk.GeometriaPadrao;
            double t = RoomWalk.TileUnits;
            if (walker.Y < t) return RoomWalk.Arrival("S", geometria);
            if (walker.Y >= (geometria.Rows - 1) * t) return RoomWalk.Arrival("N", geometria);
            if (walker.X < t) return RoomWalk.Arrival("E", geometria);
            if (walker.X >= (geometria.Cols - 1) * t) return RoomWalk.Arrival("W", geometria);
            return walker;
        }
    }
}
