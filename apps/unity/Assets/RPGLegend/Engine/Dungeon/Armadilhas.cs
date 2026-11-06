using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Armadilha — uma armadilha numa casa da sala.</summary>
    public sealed class Armadilha
    {
        /// <summary>"espinhos", "dardo" ou "pedras".</summary>
        public string Tipo;
        public double Col;
        public double Row;
        /// <summary>Já disparou: fica à vista, e não dispara de novo.</summary>
        public bool? Disparada;
        /// <summary>O herói viu o brilho dela antes de pisar.</summary>
        public bool? Vista;

        public Armadilha Clone() => (Armadilha)MemberwiseClone();
    }

    /// <summary>TS: DefDaArmadilha.</summary>
    public sealed class DefDaArmadilha
    {
        public string Nome;
        public string Icone;
        /// <summary>O dano, em fração da vida máxima do herói (nunca mata: para em 1).</summary>
        public double Dano;
        public double? Sangramento;
        public double? Veneno;
        /// <summary>Chance de quebrar um braço ou uma perna.</summary>
        public double? Quebra;
    }

    /// <summary>TS: a marca de armadilha no chão (marcasDasArmadilhas).</summary>
    public sealed class MarcaDeArmadilha
    {
        public double Col;
        public double Row;
        public string Icone;
    }

    /// <summary>As tabelas de dungeon/armadilhas.ts (fixtures/data/dungeon/armadilhas.json).</summary>
    public sealed class ArmadilhasData
    {
        [JsName("ARMADILHAS")] public OrderedMap<DefDaArmadilha> Armadilhas = new OrderedMap<DefDaArmadilha>();
        /// <summary>Privada no TS: os tipos, na ordem do sorteio.</summary>
        [JsName("TIPOS")] public List<string> Tipos = new List<string>();
        [JsName("ICONE_DO_BRILHO")] public string IconeDoBrilho;
        [JsName("CHANCE_DE_ARMADILHA")] public double ChanceDeArmadilha;
        /// <summary>Privada no TS: as salas sem armadilha.</summary>
        [JsName("SEM_ARMADILHA")] public List<string> SemArmadilha = new List<string>();
    }

    public static partial class GameData
    {
        private static ArmadilhasData _armadilhasTable;

        /// <summary>dungeon/armadilhas: os tipos de armadilha e a chance de uma sala ter.</summary>
        public static ArmadilhasData ArmadilhasTable
        {
            get => Require(_armadilhasTable, "dungeon/armadilhas");
            set => _armadilhasTable = value;
        }
    }

    /// <summary>
    /// As armadilhas (port de shared/src/dungeon/armadilhas.ts; doc do Breno de 2026-11-06): casas do chão de salas
    /// sorteadas que disparam quando o herói pisa nelas. Escondidas até disparar; quem tem mais Sabedoria às vezes vê
    /// o brilho antes.
    /// </summary>
    public static class Armadilhas
    {
        private static ArmadilhasData D => GameData.ArmadilhasTable;

        public static DefDaArmadilha Def(string tipo) => D.Armadilhas.Get(tipo);

        public static string IconeDoBrilho => D.IconeDoBrilho;

        /// <summary>TS: chanceDeVer — 6% por ponto de Sabedoria acima de 8, até 60%.</summary>
        public static double ChanceDeVer(double sabedoria) => Js.Min(0.6, Js.Max(0, (sabedoria - 8) * 0.06));

        /// <summary>TS: casasLivres — o chão de dentro da sala, sem o conteúdo, os extras e as casas de chegada.</summary>
        private static List<TileRef> CasasLivres(DungeonCell cell, string dungeon)
        {
            var geometria = ArteDaSala.GeometriaDaSala(dungeon);
            var portas = new DoorMap();
            if (cell.Doors != null)
                foreach (var porta in cell.Doors.Keys)
                    if (cell.Doors.Get(porta)) portas.Set(porta, true);
            var planta = RoomWalk.Layout(portas, new List<RoomObject>(), ArteDaSala.ParedesDaSala(dungeon), geometria);
            var ocupadas = new HashSet<string> { Chave(geometria.Conteudo.Col, geometria.Conteudo.Row) };
            if (cell.Extras != null) foreach (var extra in cell.Extras) ocupadas.Add(Chave(extra.Col, extra.Row));
            if (cell.Doors != null)
            {
                foreach (var porta in cell.Doors.Keys)
                {
                    var chegada = RoomWalk.Arrival(Js.Str(Directions.Opposite.Get(porta)), geometria);
                    ocupadas.Add(Chave(Math.Floor(chegada.X / RoomWalk.TileUnits), Math.Floor(chegada.Y / RoomWalk.TileUnits)));
                }
            }
            var livres = new List<TileRef>();
            for (int row = 1; row < geometria.Rows - 1; row++)
            {
                for (int col = 1; col < geometria.Cols - 1; col++)
                {
                    bool solida = row < planta.Solid.Count && col < planta.Solid[row].Count && planta.Solid[row][col];
                    if (!solida && !ocupadas.Contains(Chave(col, row))) livres.Add(new TileRef { Col = col, Row = row });
                }
            }
            return livres;
        }

        private static string Chave(double col, double row) => Js.NumberToString(col) + "," + Js.NumberToString(row);

        /// <summary>
        /// TS: colocarArmadilhas — uma por sala, com CHANCE_DE_ARMADILHA. Por sala que leva: a chance (um número), o
        /// tipo, a casa e o brilho (mais três).
        /// </summary>
        public static void ColocarArmadilhas(List<DungeonCell> rooms, string dungeon, double sabedoria, RngFn rng)
        {
            foreach (var cell in rooms)
            {
                if (D.SemArmadilha.Contains(cell.Type)) continue;
                if (rng() >= D.ChanceDeArmadilha) continue;
                string tipo = Rng.Pick(D.Tipos, rng);
                var livres = CasasLivres(cell, dungeon);
                if (livres.Count == 0) continue;
                var casa = Rng.Pick(livres, rng);
                bool vista = rng() < ChanceDeVer(sabedoria);
                cell.Armadilhas = new List<Armadilha> { new Armadilha { Tipo = tipo, Col = casa.Col, Row = casa.Row, Vista = vista ? true : (bool?)null } };
            }
        }

        /// <summary>TS: armadilhaSob — a armadilha ainda armada sob o herói (a casa do centro da base dele), ou null.</summary>
        public static double? ArmadilhaSob(DungeonCell cell, Walker walker)
        {
            double col = Math.Floor(walker.X / RoomWalk.TileUnits);
            double row = Math.Floor(walker.Y / RoomWalk.TileUnits);
            var lista = cell?.Armadilhas;
            if (lista == null) return null;
            for (int i = 0; i < lista.Count; i++)
                if (lista[i].Disparada != true && lista[i].Col == col && lista[i].Row == row) return i;
            return null;
        }

        /// <summary>TS: marcasDasArmadilhas — as disparadas e o brilho das vistas.</summary>
        public static List<MarcaDeArmadilha> MarcasDasArmadilhas(DungeonCell cell)
        {
            var marcas = new List<MarcaDeArmadilha>();
            if (cell?.Armadilhas == null) return marcas;
            foreach (var a in cell.Armadilhas)
            {
                if (a.Disparada != true && a.Vista != true) continue;
                marcas.Add(new MarcaDeArmadilha { Col = a.Col, Row = a.Row, Icone = a.Disparada == true ? Def(a.Tipo).Icone : D.IconeDoBrilho });
            }
            return marcas;
        }
    }
}
