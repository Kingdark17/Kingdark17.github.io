using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: SalaEmVolta — uma sala do quadrado de 3 × 3 em volta da atual.</summary>
    public sealed class SalaEmVolta
    {
        public double X;
        public double Y;
        /// <summary>Quantas salas ela fica da atual em cada eixo: -1, 0 ou 1.</summary>
        public double Dx;
        public double Dy;
        public RoomCell Celula;
        /// <summary>A atual, ou uma em que o herói já entrou: desenhada com o que tem dentro. As outras ficam na sombra.</summary>
        public bool Acesa;
        public List<string> Portas;
    }

    /// <summary>
    /// Port de shared/src/jogo/salas-emendadas.ts: as salas emendadas da masmorra (2026-10-30, pedido do Breno, site e
    /// app). A vizinha fica colada do outro lado da porta e o herói passa andando (<see cref="RoomWalk.ContinuarNaVizinha"/>),
    /// então quem desenha precisa das salas em volta. A que ele ainda não visitou fica na sombra, sem o conteúdo.
    /// </summary>
    public static class SalasEmendadas
    {
        /// <summary>TS: salasEmVolta — o quadrado de 3 × 3 em volta da atual, ela inclusive, na ordem de leitura.</summary>
        public static List<SalaEmVolta> SalasEmVolta(EstadoDoJogo estado)
        {
            var salas = new List<SalaEmVolta>();
            if (estado.MapMode != "dungeon") return salas;
            for (int dy = -1; dy <= 1; dy++)
            {
                for (int dx = -1; dx <= 1; dx++)
                {
                    double x = estado.Pos.X + dx;
                    double y = estado.Pos.Y + dy;
                    if (!DungeonGraph.InBounds(x, y, estado.MapCols, estado.MapRows)) continue;
                    var celula = Estados.CelulaEm(estado, new Posicao { X = x, Y = y });
                    if (celula == null || celula.Type == "void") continue;
                    bool atual = dx == 0 && dy == 0;
                    bool visitada = Neblina.EstadoDaSala(estado.Grade, celula, estado.MapCols, estado.MapRows) == EstadosDaSala.Visitada;
                    salas.Add(new SalaEmVolta { X = x, Y = y, Dx = dx, Dy = dy, Celula = celula, Acesa = atual || visitada, Portas = PortasDaPlanta(celula) });
                }
            }
            return salas;
        }

        /// <summary>TS: portasDaPlanta — as portas do mapa e o vão da parede rachada já aberta, na ordem N S E W.</summary>
        public static List<string> PortasDaPlanta(RoomCell celula)
        {
            var portas = new List<string>();
            if (celula == null) return portas;
            var passagem = ExtrasDaSala.PassagemSecreta(celula)?.Lado;
            foreach (var lado in Directions.Order)
            {
                bool temPorta = celula.Doors != null && celula.Doors.TryGet(lado, out var aberta) && aberta;
                if (temPorta || lado == passagem) portas.Add(lado);
            }
            return portas;
        }
    }
}
