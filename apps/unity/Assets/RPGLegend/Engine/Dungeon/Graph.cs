using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: <c>Partial&lt;Record&lt;Direction, true&gt;&gt;</c> — as portas de uma sala, na ordem em que foram
    /// abertas. A ordem importa: <c>distancesFrom</c> e <c>isKnown</c> percorrem <c>Object.keys(doors)</c>.
    /// </summary>
    public sealed class DoorMap : OrderedMap<bool>
    {
        /// <summary>O <c>{ ...doors }</c> do JS.</summary>
        public DoorMap Clone()
        {
            var c = new DoorMap();
            CopyTo(c);
            return c;
        }
    }

    /// <summary>
    /// TS: RoomCell — uma célula da grade: uma sala inteira ou vazio ("void").
    ///
    /// <c>Type</c> é texto solto de propósito, como no TS: o grafo só conhece "void", "start" e "normal"; quem
    /// povoa o andar (dungeon/generate.ts → DungeonCell) e a cidade (city/city.ts → CityCell) estendem esta
    /// classe com os outros tipos e campos. Por isso ela não é sealed, e o gerador do grafo é genérico na célula.
    /// A sala vai no save: campos que o C# não conhece ficam em <see cref="Extra"/>.
    /// </summary>
    public class RoomCell
    {
        public string Type;
        public double X;
        public double Y;
        /// <summary>null = ausente (o TS trata como <c>{}</c> ao ler: <c>cell.doors || {}</c>).</summary>
        public DoorMap Doors;
        /// <summary>O jogador já entrou nesta sala.</summary>
        public bool? Visited;
        /// <summary>Sala marcada como conhecida sem o jogador ter entrado (ex.: dom de vidente).</summary>
        public bool? Revealed;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>
        /// O <c>{ ...cell }</c> do TS: cópia rasa — as portas (e os outros objetos) continuam os mesmos.
        /// Mantém o tipo de verdade da célula (DungeonCell, CityCell…).
        /// </summary>
        public RoomCell Clone()
        {
            var c = (RoomCell)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>
    /// TS: RoomGraph — a grade e as salas. <c>Rooms</c> e <c>Start</c> são as mesmas células de <c>Grid</c>
    /// (a ordem de <c>Rooms</c> é a ordem em que nasceram; a primeira é o início).
    /// </summary>
    public sealed class RoomGraph<TCell> where TCell : RoomCell
    {
        public List<List<TCell>> Grid;
        public List<TCell> Rooms;
        public TCell Start;
    }

    /// <summary>As direções absolutas da grade (TS: Direction, DIR_* de dungeon/graph.ts).</summary>
    public static class Directions
    {
        /// <summary>TS: DIR_VECTORS.</summary>
        public static OrderedMap<DirVector> Vectors => GameData.DungeonGraphTable.DirVectors;

        /// <summary>TS: DIR_LABEL — Norte, Sul, Leste, Oeste.</summary>
        public static OrderedMap<string> Labels => GameData.DungeonGraphTable.DirLabel;

        /// <summary>TS: DIR_OPP — a direção oposta.</summary>
        public static OrderedMap<string> Opposite => GameData.DungeonGraphTable.DirOpp;

        /// <summary>TS: DIR_ORDER.</summary>
        public static List<string> Order => GameData.DungeonGraphTable.DirOrder;
    }

    /// <summary>
    /// Geração procedural da masmorra em salas, estilo "Binding of Isaac" (port de shared/src/dungeon/graph.ts):
    /// cada célula da grade é uma sala inteira ou vazio, e salas vizinhas se ligam por portas N/S/E/W.
    /// </summary>
    public static class DungeonGraph
    {
        /// <summary>TS: inBounds.</summary>
        public static bool InBounds(double x, double y, double cols, double rows) =>
            x >= 0 && x < cols && y >= 0 && y < rows;

        /// <summary>TS: generateRoomGraph, com células RoomCell.</summary>
        public static RoomGraph<RoomCell> GenerateRoomGraph(double rows, double cols, double roomCount, RngFn rng = null) =>
            GenerateRoomGraph<RoomCell>(rows, cols, roomCount, rng);

        /// <summary>
        /// TS: generateRoomGraph — planta uma grade esparsa de salas ligadas por portas, crescendo a partir do
        /// centro. A cada passo sorteia uma sala da fronteira e embaralha N/S/E/W com
        /// <c>sort(() =&gt; rng() - 0.5)</c> (o sort do V8: ver <see cref="JsSort"/>); abre porta na primeira
        /// direção livre, e a sala sem direção livre sai da fronteira.
        ///
        /// Genérico na célula para quem estende RoomCell (o andar da masmorra cria DungeonCell direto aqui,
        /// onde o TS só faz <c>as DungeonCell</c> num objeto solto).
        /// </summary>
        public static RoomGraph<TCell> GenerateRoomGraph<TCell>(double rows, double cols, double roomCount, RngFn rng = null)
            where TCell : RoomCell, new()
        {
            rng = rng ?? Rng.Default;

            var grid = new List<List<TCell>>();
            for (double y = 0; y < rows; y++)
            {
                var row = new List<TCell>();
                for (double x = 0; x < cols; x++) row.Add(new TCell { Type = "void", X = x, Y = y, Doors = new DoorMap() });
                grid.Add(row);
            }

            double cx = Math.Floor(cols / 2);
            double cy = Math.Floor(rows / 2);
            // grid[cy]![cx]! do TS: sem a linha, o JS lança ao ler a coluna; sem a célula, ao gravar o type.
            var startRow = ItemAt(grid, cy);
            if (startRow == null) throw ReadOfUndefined(Js.NumberToString(cx));
            var start = ItemAt(startRow, cx);
            if (start == null) throw new EngineError("Cannot set properties of undefined (setting 'type')", "TypeError");
            start.Type = "start";

            var rooms = new List<TCell> { start };
            var frontier = new List<TCell> { start };
            double count = 1;
            double guard = 0;

            while (count < roomCount && frontier.Count > 0 && guard < 800)
            {
                guard++;
                var r = frontier[(int)Rng.RandomInt(frontier.Count, rng)];
                var dirs = JsSort.SortLikeV8(Directions.Order, (a, b) => rng() - 0.5);
                bool placed = false;
                foreach (var d in dirs)
                {
                    var v = VectorOf(d);
                    double nx = r.X + v.X;
                    double ny = r.Y + v.Y;
                    if (!InBounds(nx, ny, cols, rows)) continue;
                    // grid[ny]![nx]! (com a tabela de direções de inteiros, a posição sempre existe).
                    var targetRow = ItemAt(grid, ny);
                    if (targetRow == null) throw ReadOfUndefined(Js.NumberToString(nx));
                    var target = ItemAt(targetRow, nx);
                    if (target == null) throw ReadOfUndefined("type");
                    if (target.Type != "void") continue;
                    target.Type = "normal";
                    target.Doors.Set(Js.Str(Directions.Opposite.Get(d)), true);
                    r.Doors.Set(d, true);
                    rooms.Add(target);
                    frontier.Add(target);
                    count++;
                    placed = true;
                    break;
                }
                if (!placed) frontier = frontier.FindAll(f => !ReferenceEquals(f, r));
            }

            return new RoomGraph<TCell> { Grid = grid, Rooms = rooms, Start = start };
        }

        /// <summary>TS: isRoom — <c>!!cell &amp;&amp; cell.type !== 'void'</c>.</summary>
        public static bool IsRoom(RoomCell cell) => cell != null && cell.Type != "void";

        /// <summary>
        /// TS: distancesFrom — distância em número de portas a partir de uma sala (BFS), chaveada por "x,y",
        /// na ordem em que as salas foram alcançadas. Serve para afastar escada e saída do início.
        /// Aceita grade de qualquer subclasse de RoomCell.
        /// </summary>
        public static OrderedMap<double> DistancesFrom(IReadOnlyList<IReadOnlyList<RoomCell>> grid, RoomCell start, double cols, double rows)
        {
            if (start == null) throw ReadOfUndefined("x");
            var distances = new OrderedMap<double>();
            var queue = new Queue<RoomCell>();
            queue.Enqueue(start);
            distances.Set(PositionKey(start.X, start.Y), 0);

            while (queue.Count > 0)
            {
                var cell = queue.Dequeue();
                // Uma posição da grade sem célula entra na fila como undefined, e o JS lança ao ler cell.x.
                if (cell == null) throw ReadOfUndefined("x");
                // `as number` do TS: se a célula da grade não estiver na posição que diz, a chave falta e a conta dá NaN.
                double @base = distances.TryGet(PositionKey(cell.X, cell.Y), out var b) ? b : double.NaN;
                foreach (var dir in DoorKeys(cell))
                {
                    var v = VectorOf(dir);
                    double nx = cell.X + v.X;
                    double ny = cell.Y + v.Y;
                    if (!InBounds(nx, ny, cols, rows)) continue;
                    string key = PositionKey(nx, ny);
                    if (distances.Has(key)) continue;
                    distances.Set(key, @base + 1);
                    queue.Enqueue(CellOrThrow(grid, nx, ny));
                }
            }

            return distances;
        }

        /// <summary>
        /// TS: isKnown — a sala fica "conhecida" (silhueta no minimapa) quando já foi visitada ou revelada, ou
        /// quando alguma sala ligada a ela por porta já foi visitada.
        /// </summary>
        public static bool IsKnown(IReadOnlyList<IReadOnlyList<RoomCell>> grid, RoomCell cell, double cols, double rows)
        {
            if (cell == null) throw ReadOfUndefined("visited");
            if (cell.Visited == true || cell.Revealed == true) return true;
            foreach (var dir in DoorKeys(cell))
            {
                var v = VectorOf(dir);
                double nx = cell.X + v.X;
                double ny = cell.Y + v.Y;
                if (!InBounds(nx, ny, cols, rows)) continue;
                var neighbor = CellOrThrow(grid, nx, ny);
                if (neighbor == null) throw ReadOfUndefined("visited");
                if (neighbor.Visited == true) return true;
            }
            return false;
        }

        /// <summary>
        /// O <c>grid[y]?.[x]</c> do TS: a célula, ou null quando a posição não existe na grade (fora dela, negativa
        /// ou não inteira). Para quem porta generate.ts e city.ts.
        /// </summary>
        public static TCell CellAt<TCell>(IReadOnlyList<IReadOnlyList<TCell>> grid, double x, double y) where TCell : class
        {
            var row = ItemAt(grid, y);
            return row == null ? null : ItemAt(row, x);
        }

        /// <summary>A chave "x,y" do TS (<c>`${x},${y}`</c>).</summary>
        public static string PositionKey(double x, double y) => Js.NumberToString(x) + "," + Js.NumberToString(y);

        // ---------- apoio ----------

        /// <summary>Object.keys(cell.doors || {}).</summary>
        private static IReadOnlyList<string> DoorKeys(RoomCell cell) =>
            cell.Doors != null ? cell.Doors.Keys : (IReadOnlyList<string>)Array.Empty<string>();

        /// <summary>DIR_VECTORS[dir]; direção desconhecida dá undefined, e o JS lança ao ler v.x.</summary>
        private static DirVector VectorOf(string dir)
        {
            if (Directions.Vectors.TryGet(dir, out var v) && v != null) return v;
            throw ReadOfUndefined("x");
        }

        /// <summary>grid[y]![x]! do TS: sem a linha, o JS lança ao ler a coluna; sem a célula, vem undefined (null).</summary>
        private static RoomCell CellOrThrow(IReadOnlyList<IReadOnlyList<RoomCell>> grid, double x, double y)
        {
            var row = ItemAt(grid, y);
            if (row == null) throw ReadOfUndefined(Js.NumberToString(x));
            return ItemAt(row, x);
        }

        /// <summary>lista[i] do JS: só índice inteiro dentro da lista acha algo (-0 vale 0); o resto é undefined.</summary>
        private static T ItemAt<T>(IReadOnlyList<T> list, double index) where T : class
        {
            if (!(index >= 0) || index >= list.Count || Math.Floor(index) != index) return null;
            return list[(int)index];
        }

        private static EngineError ReadOfUndefined(string property) =>
            new EngineError("Cannot read properties of undefined (reading '" + property + "')", "TypeError");
    }
}
