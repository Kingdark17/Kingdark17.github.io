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

        /// <summary>
        /// TS: roomLayout — parede em volta, vão onde há porta e os objetos, cada um no seu quadrado. <paramref name="walls"/>
        /// são as casas de dentro que a arte da masmorra faz de parede (<see cref="ArteDaSala.ParedesDaSala"/>).
        /// </summary>
        public static RoomLayout Layout(DoorMap doors, IReadOnlyList<RoomObject> objects, IReadOnlyList<TileRef> walls = null)
        {
            var solid = new List<List<bool>>();
            for (int row = 0; row < RoomRows; row++)
            {
                var linha = new List<bool>();
                for (int col = 0; col < RoomCols; col++) linha.Add(col == 0 || row == 0 || col == RoomCols - 1 || row == RoomRows - 1);
                solid.Add(linha);
            }
            if (walls != null)
                foreach (var parede in walls) solid[(int)parede.Row][(int)parede.Col] = true;
            var abertas = new List<string>();
            foreach (var direcao in Directions.Order)
            {
                if (doors == null || !doors.TryGet(direcao, out var aberta) || !aberta) continue;
                abertas.Add(direcao);
                var vao = D.DoorTile[direcao];
                solid[(int)vao.Row][(int)vao.Col] = false;
            }
            var copias = new List<RoomObject>();
            foreach (var objeto in objects)
            {
                solid[(int)objeto.Row][(int)objeto.Col] = true;
                copias.Add(new RoomObject { Id = objeto.Id, Col = objeto.Col, Row = objeto.Row });
            }
            return new RoomLayout { Doors = abertas, Solid = solid, Objects = copias };
        }

        /// <summary>TS: stickInput — do joystick (-1 a 1 em cada eixo) pro inteiro da regra.</summary>
        public static WalkInput StickInput(double x, double y) => new WalkInput { X = Limitar(x), Y = Limitar(y) };

        private static double Limitar(double v) => Math.Truncate(Math.Max(-1, Math.Min(1, v)) * StickMax);

        /// <summary>TS: roomArrival — onde o herói aparece numa sala.</summary>
        public static Walker Arrival(string movedTowards)
        {
            if (movedTowards == null) return new Walker { X = Centro(ContentTile.Col), Y = Centro(ContentTile.Row + 2), Facing = "S" };
            var vao = D.DoorTile[Directions.Opposite[movedTowards]];
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
            var vao = D.DoorTile[lado];
            bool colado =
                lado == "N" ? y - HeroHalf == TileUnits
                : lado == "S" ? y + HeroHalf == (Linhas(layout) - 1) * TileUnits
                : lado == "W" ? x - HeroHalf == TileUnits
                : x + HeroHalf == (Colunas(layout) - 1) * TileUnits;
            if (!colado) return atual;
            double meio = Centro(eixoX ? vao.Col : vao.Row);
            double falta = meio - atual;
            if (falta == 0 || Math.Abs(falta) > DoorAssist) return atual;
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
