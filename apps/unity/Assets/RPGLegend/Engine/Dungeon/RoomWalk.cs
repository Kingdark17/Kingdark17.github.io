using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: RoomObject — algo da sala que se aciona encostando. Ocupa um quadrado inteiro, sólido.</summary>
    public sealed class RoomObject
    {
        public string Id;
        public double Col;
        public double Row;
    }

    /// <summary>TS: RoomLayout — a planta da sala.</summary>
    public sealed class RoomLayout
    {
        /// <summary>As portas da sala, na ordem de DIR_ORDER.</summary>
        public List<string> Doors;
        /// <summary>
        /// O tamanho, quando não é o da sala (ROOM_COLS × ROOM_ROWS): a cidade desenhada é uma planta grande só
        /// (<see cref="MapaDaCidade"/>). null nas salas, que continuam como sempre foram.
        /// </summary>
        public double? Cols;
        public double? Rows;
        /// <summary>As portas, quando não são as da sala de sempre (a Torre: vãos de 3, parede de cima de 2).</summary>
        public OrderedMap<PortaDaSala> Portas;
        /// <summary>[row][col]: parede, ou quadrado ocupado por um objeto.</summary>
        public List<List<bool>> Solid;
        public List<RoomObject> Objects;
    }

    /// <summary>TS: Walker — o herói na sala; a posição é o centro da base, em unidades.</summary>
    public sealed class Walker
    {
        public double X;
        public double Y;
        public string Facing;
    }

    /// <summary>TS: WalkInput — o joystick, inteiros de -STICK_MAX a STICK_MAX; y positivo é pra baixo.</summary>
    public sealed class WalkInput
    {
        public double X;
        public double Y;
    }

    /// <summary>TS: WalkStep.</summary>
    public sealed class WalkStep
    {
        public Walker Walker;
        /// <summary>Atravessou o vão desta porta: é a vez da sala vizinha.</summary>
        [KeepNull] public string Exit;
        /// <summary>O objeto em que o herói está encostado agora, se algum.</summary>
        [KeepNull] public string Touching;
    }

    /// <summary>
    /// Andar dentro da sala, solto, no estilo Binding of Isaac (port de shared/src/dungeon/room-walk.ts). Tudo em
    /// números inteiros (guardados em double, como no JS): o TS do site e este C# dão o mesmo resultado bit a bit.
    /// </summary>
    public static class RoomWalk
    {
        private static RoomWalkData D => GameData.RoomWalkTable;

        public static double RoomCols => D.RoomCols;
        public static double RoomRows => D.RoomRows;
        public static double TileUnits => D.TileUnits;
        public static double WalkTicksPerSecond => D.WalkTicksPerSecond;
        public static double HeroSpeed => D.HeroSpeed;
        public static double HeroHalf => D.HeroHalf;
        public static double TouchReach => D.TouchReach;
        public static double StickMax => D.StickMax;
        public static double DoorAssist => D.DoorAssist;
        public static TileRef ContentTile => D.ContentTile;
        /// <summary>O vão de cada porta, no meio de cada parede.</summary>
        public static OrderedMap<TileRef> DoorTile => D.DoorTile;

        /// <summary>TS: GEOMETRIA_PADRAO — a sala de sempre.</summary>
        public static GeometriaDaSala GeometriaPadrao => D.GeometriaPadrao;

        /// <summary>TS: geometriaPadrao — é a sala de sempre? A planta dela não leva o tamanho nem as portas.</summary>
        public static bool EhGeometriaPadrao(GeometriaDaSala geometria)
        {
            if (geometria.Cols != RoomCols || geometria.Rows != RoomRows) return false;
            foreach (var lado in Directions.Order)
            {
                var porta = geometria.Portas.Get(lado);
                var padrao = GeometriaPadrao.Portas.Get(lado);
                if (porta == null || porta.Col != padrao.Col || porta.Row != padrao.Row || porta.Largura != 1 || porta.Fundo != 1) return false;
            }
            return true;
        }

        /// <summary>TS: casasDoVao — as casas do vão da porta: a largura dela, em toda a grossura da parede.</summary>
        public static List<TileRef> CasasDoVao(GeometriaDaSala geometria, string lado)
        {
            var porta = geometria.Portas.Get(lado);
            double meia = Math.Truncate((porta.Largura - 1) / 2);
            var casas = new List<TileRef>();
            for (double k = -meia; k <= meia; k++)
            {
                for (double f = 0; f < porta.Fundo; f++)
                {
                    if (lado == "N") casas.Add(new TileRef { Col = porta.Col + k, Row = f });
                    else if (lado == "S") casas.Add(new TileRef { Col = porta.Col + k, Row = geometria.Rows - 1 - f });
                    else if (lado == "W") casas.Add(new TileRef { Col = f, Row = porta.Row + k });
                    else casas.Add(new TileRef { Col = geometria.Cols - 1 - f, Row = porta.Row + k });
                }
            }
            return casas;
        }

        /// <summary>
        /// TS: roomLayout — parede em volta, vão onde há porta e os objetos, cada um no seu quadrado. <paramref name="walls"/>
        /// são as casas de dentro que a arte da masmorra faz de parede (<see cref="ArteDaSala.ParedesDaSala"/>), e
        /// <paramref name="geometria"/> o formato da sala (<see cref="ArteDaSala.GeometriaDaSala"/>): a porta abre o vão
        /// inteiro dela. Fora da sala de sempre, a planta leva o tamanho e as portas.
        /// </summary>
        public static RoomLayout Layout(DoorMap doors, IReadOnlyList<RoomObject> objects, IReadOnlyList<TileRef> walls = null, GeometriaDaSala geometria = null)
        {
            geometria = geometria ?? GeometriaPadrao;
            int cols = (int)geometria.Cols;
            int rows = (int)geometria.Rows;
            var solid = new List<List<bool>>();
            for (int row = 0; row < rows; row++)
            {
                var linha = new List<bool>();
                for (int col = 0; col < cols; col++) linha.Add(col == 0 || row == 0 || col == cols - 1 || row == rows - 1);
                solid.Add(linha);
            }
            if (walls != null)
                foreach (var parede in walls) solid[(int)parede.Row][(int)parede.Col] = true;
            var abertas = new List<string>();
            foreach (var direcao in Directions.Order)
            {
                if (doors == null || !doors.TryGet(direcao, out var aberta) || !aberta) continue;
                abertas.Add(direcao);
                foreach (var vao in CasasDoVao(geometria, direcao)) solid[(int)vao.Row][(int)vao.Col] = false;
            }
            var copias = new List<RoomObject>();
            foreach (var objeto in objects)
            {
                solid[(int)objeto.Row][(int)objeto.Col] = true;
                copias.Add(new RoomObject { Id = objeto.Id, Col = objeto.Col, Row = objeto.Row });
            }
            var planta = new RoomLayout { Doors = abertas, Solid = solid, Objects = copias };
            if (EhGeometriaPadrao(geometria)) return planta;
            planta.Cols = cols;
            planta.Rows = rows;
            planta.Portas = new OrderedMap<PortaDaSala>();
            foreach (var lado in Directions.Order) planta.Portas.Set(lado, geometria.Portas.Get(lado).Clone());
            return planta;
        }

        /// <summary>TS: stickInput — do joystick (-1 a 1 em cada eixo) pro inteiro da regra.</summary>
        public static WalkInput StickInput(double x, double y) => new WalkInput { X = Limitar(x), Y = Limitar(y) };

        private static double Limitar(double v) => Math.Truncate(Math.Max(-1, Math.Min(1, v)) * StickMax);

        /// <summary>TS: roomArrival — onde o herói aparece numa sala.</summary>
        public static Walker Arrival(string movedTowards, GeometriaDaSala geometria = null)
        {
            geometria = geometria ?? GeometriaPadrao;
            if (movedTowards == null) return new Walker { X = Centro(geometria.Conteudo.Col), Y = Centro(geometria.Conteudo.Row + 2), Facing = "S" };
            var vao = geometria.Portas.Get(Directions.Opposite[movedTowards]);
            var vetor = Directions.Vectors[movedTowards];
            return new Walker { X = Centro(vao.Col + vetor.X), Y = Centro(vao.Row + vetor.Y), Facing = movedTowards };
        }

        /// <summary>TS: walkTick — um passo de simulação.</summary>
        public static WalkStep Tick(RoomLayout layout, Walker walker, WalkInput input)
        {
            double ix = Math.Truncate(input.X);
            double iy = Math.Truncate(input.Y);
            double quadrado = ix * ix + iy * iy;
            if (quadrado > StickMax * StickMax)
            {
                double comprimento = Math.Sqrt(quadrado);
                ix = Math.Truncate(ix * StickMax / comprimento);
                iy = Math.Truncate(iy * StickMax / comprimento);
            }
            double dx = Math.Truncate(ix * HeroSpeed / StickMax);
            double dy = Math.Truncate(iy * HeroSpeed / StickMax);

            double x = walker.X;
            double y = walker.Y;
            var emX = MoverEmX(layout, x, y, dx);
            x = emX.Pos;
            var emY = MoverEmY(layout, x, y, dy);
            y = emY.Pos;

            if (emY.Barrado) x = AjudaNaPorta(layout, x, y, dy < 0 ? "N" : "S", true);
            if (emX.Barrado) y = AjudaNaPorta(layout, x, y, dx < 0 ? "W" : "E", false);

            string facing = ix == 0 && iy == 0 ? walker.Facing
                : Math.Abs(ix) > Math.Abs(iy) ? (ix > 0 ? "E" : "W")
                : iy > 0 ? "S" : "N";
            return new WalkStep { Walker = new Walker { X = x, Y = y, Facing = facing }, Exit = Saida(layout, x, y), Touching = Encostado(layout, x, y) };
        }

        // ---------- por dentro ----------

        private struct Movido
        {
            public double Pos;
            public bool Barrado;
        }

        private static double Centro(double quadrado) => quadrado * TileUnits + TileUnits / 2;

        private static double QuadradoDe(double unidades) => Math.Floor(unidades / TileUnits);

        private static double Colunas(RoomLayout layout) => layout.Cols ?? RoomCols;

        private static double Linhas(RoomLayout layout) => layout.Rows ?? RoomRows;

        private static bool Solido(RoomLayout layout, double col, double row)
        {
            if (row < 0 || row >= Linhas(layout) || col < 0 || col >= Colunas(layout)) return true;
            return layout.Solid[(int)row][(int)col];
        }

        private static bool ColunaBarra(RoomLayout layout, double col, double y)
        {
            for (double row = QuadradoDe(y - HeroHalf); row <= QuadradoDe(y + HeroHalf - 1); row++)
                if (Solido(layout, col, row)) return true;
            return false;
        }

        private static bool LinhaBarra(RoomLayout layout, double row, double x)
        {
            for (double col = QuadradoDe(x - HeroHalf); col <= QuadradoDe(x + HeroHalf - 1); col++)
                if (Solido(layout, col, row)) return true;
            return false;
        }

        private static Movido MoverEmX(RoomLayout layout, double x, double y, double dx)
        {
            if (dx == 0) return new Movido { Pos = x };
            double novo = x + dx;
            if (dx > 0)
            {
                double col = QuadradoDe(novo + HeroHalf - 1);
                return ColunaBarra(layout, col, y) ? new Movido { Pos = col * TileUnits - HeroHalf, Barrado = true } : new Movido { Pos = novo };
            }
            double colEsq = QuadradoDe(novo - HeroHalf);
            return ColunaBarra(layout, colEsq, y) ? new Movido { Pos = (colEsq + 1) * TileUnits + HeroHalf, Barrado = true } : new Movido { Pos = novo };
        }

        private static Movido MoverEmY(RoomLayout layout, double x, double y, double dy)
        {
            if (dy == 0) return new Movido { Pos = y };
            double novo = y + dy;
            if (dy > 0)
            {
                double row = QuadradoDe(novo + HeroHalf - 1);
                return LinhaBarra(layout, row, x) ? new Movido { Pos = row * TileUnits - HeroHalf, Barrado = true } : new Movido { Pos = novo };
            }
            double rowCima = QuadradoDe(novo - HeroHalf);
            return LinhaBarra(layout, rowCima, x) ? new Movido { Pos = (rowCima + 1) * TileUnits + HeroHalf, Barrado = true } : new Movido { Pos = novo };
        }

        /// <summary>Quem empurra a parede <paramref name="lado"/>, colado nela e perto do vão, desliza em direção a ele.</summary>
        private static double AjudaNaPorta(RoomLayout layout, double x, double y, string lado, bool eixoX)
        {
            double atual = eixoX ? x : y;
            if (!layout.Doors.Contains(lado)) return atual;
            var porta = layout.Portas?.Get(lado) ?? GeometriaPadrao.Portas.Get(lado);
            // Colado na parede: a base encosta no primeiro quadrado depois do chão (a parede tem Fundo casas).
            bool colado =
                lado == "N" ? y - HeroHalf == porta.Fundo * TileUnits
                : lado == "S" ? y + HeroHalf == (Linhas(layout) - porta.Fundo) * TileUnits
                : lado == "W" ? x - HeroHalf == porta.Fundo * TileUnits
                : x + HeroHalf == (Colunas(layout) - porta.Fundo) * TileUnits;
            if (!colado) return atual;
            double meio = Centro(eixoX ? porta.Col : porta.Row);
            double falta = meio - atual;
            // O vão largo puxa de mais longe: o alcance cresce meia casa por casa a mais de vão.
            double alcance = DoorAssist + (porta.Largura - 1) * TileUnits / 2;
            if (falta == 0 || Math.Abs(falta) > alcance) return atual;
            double passo = Math.Sign(falta) * Math.Min(Math.Abs(falta), HeroSpeed);
            return eixoX ? MoverEmX(layout, x, y, passo).Pos : MoverEmY(layout, x, y, passo).Pos;
        }

        private static string Saida(RoomLayout layout, double x, double y)
        {
            double meio = TileUnits / 2;
            foreach (var direcao in layout.Doors)
            {
                if (direcao == "N" && y < meio) return "N";
                if (direcao == "S" && y > Linhas(layout) * TileUnits - meio) return "S";
                if (direcao == "W" && x < meio) return "W";
                if (direcao == "E" && x > Colunas(layout) * TileUnits - meio) return "E";
            }
            return null;
        }

        private static string Encostado(RoomLayout layout, double x, double y)
        {
            double esquerda = x - HeroHalf - TouchReach;
            double direita = x + HeroHalf + TouchReach;
            double topo = y - HeroHalf - TouchReach;
            double baixo = y + HeroHalf + TouchReach;
            foreach (var objeto in layout.Objects)
            {
                double ox = objeto.Col * TileUnits;
                double oy = objeto.Row * TileUnits;
                if (esquerda < ox + TileUnits && direita > ox && topo < oy + TileUnits && baixo > oy) return objeto.Id;
            }
            return null;
        }
    }
}
