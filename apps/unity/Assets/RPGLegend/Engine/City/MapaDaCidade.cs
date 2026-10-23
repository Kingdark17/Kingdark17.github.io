using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de city/mapa-da-cidade.ts (fixtures/data/city/mapa-da-cidade.json).</summary>
    public sealed class MapaDaCidadeData
    {
        [JsName("CIDADE_COLS")] public double CidadeCols;
        [JsName("CIDADE_ROWS")] public double CidadeRows;
        /// <summary>A planta, casa por casa: '.' se pisa, '#' não.</summary>
        [JsName("PLANTA_DA_CIDADE")] public List<string> PlantaDaCidade = new List<string>();
        /// <summary>As casas de cada ponto (porta, entrada de masmorra, troncos): sólidas, e encostar aciona.</summary>
        [JsName("PONTOS_DA_CIDADE")] public List<RoomObject> PontosDaCidade = new List<RoomObject>();
        /// <summary>Pixels da arte por casa (o mapa do Breno tem 960 × 800, 32 por casa).</summary>
        [JsName("PIXELS_POR_CASA")] public double PixelsPorCasa;
        /// <summary>As camadas da arte, na ordem em que se desenham dentro de cada plano.</summary>
        [JsName("CAMADAS_DA_CIDADE")] public List<CamadaDaCidade> CamadasDaCidade = new List<CamadaDaCidade>();
        /// <summary>Privada no TS: de que lado da porta o herói aparece, na ordem em que se procura.</summary>
        [JsName("LADOS_DA_CHEGADA")] public List<string> LadosDaChegada = new List<string>();
    }

    /// <summary>
    /// TS: CamadaDaCidade — uma camada da arte do Breno e o plano dela: "chao" debaixo de tudo, "cima" por cima de
    /// tudo, "meio" ordenada com o herói pelo pé (ele passa na frente quando o pé está abaixo do topo da linha Base).
    /// </summary>
    public sealed class CamadaDaCidade
    {
        public string Arquivo;
        public string Plano;
        public double Base;
        /// <summary>Só aparece enquanto os troncos fecham o caminho da caverna.</summary>
        public bool? SoComTroncos;
    }

    public static partial class GameData
    {
        private static MapaDaCidadeData _mapaDaCidadeTable;

        /// <summary>city/mapa-da-cidade: a planta e os pontos da cidade desenhada.</summary>
        public static MapaDaCidadeData MapaDaCidadeTable
        {
            get => Require(_mapaDaCidadeTable, "city/mapa-da-cidade");
            set => _mapaDaCidadeTable = value;
        }
    }

    /// <summary>
    /// A cidade desenhada pelo Breno (port de shared/src/city/mapa-da-cidade.ts): um mapa só, de 30 × 25 casas, no
    /// lugar das salas da cidade. O herói anda nele com a regra de sempre (<see cref="RoomWalk"/>, numa planta do
    /// tamanho do mapa), e cada porta leva à sala da cidade que já existia (<see cref="Cidades"/>).
    /// </summary>
    public static class MapaDaCidade
    {
        private static MapaDaCidadeData D => GameData.MapaDaCidadeTable;

        public static double Cols => D.CidadeCols;
        public static double Rows => D.CidadeRows;
        public static IReadOnlyList<RoomObject> Pontos => D.PontosDaCidade;
        public static double PixelsPorCasa => D.PixelsPorCasa;
        public static IReadOnlyList<CamadaDaCidade> Camadas => D.CamadasDaCidade;

        /// <summary>TS: plantaDaCidade — a planta na regra do andar; com os troncos, eles fecham o caminho da caverna.</summary>
        public static RoomLayout PlantaDaCidade(bool troncosNoCaminho)
        {
            var solid = new List<List<bool>>();
            foreach (var linha in D.PlantaDaCidade)
            {
                var casas = new List<bool>();
                foreach (char casa in linha) casas.Add(casa == '#');
                solid.Add(casas);
            }
            var objetos = new List<RoomObject>();
            foreach (var ponto in D.PontosDaCidade)
            {
                if (!troncosNoCaminho && ponto.Id == "troncos") continue;
                objetos.Add(new RoomObject { Id = ponto.Id, Col = ponto.Col, Row = ponto.Row });
            }
            foreach (var ponto in objetos) solid[(int)ponto.Row][(int)ponto.Col] = true;
            return new RoomLayout { Doors = new List<string>(), Cols = D.CidadeCols, Rows = D.CidadeRows, Solid = solid, Objects = objetos };
        }

        private static bool Pisa(double col, double row)
        {
            if (row < 0 || row >= D.PlantaDaCidade.Count) return false;
            var linha = D.PlantaDaCidade[(int)row];
            return col >= 0 && col < linha.Length && linha[(int)col] == '.';
        }

        /// <summary>
        /// TS: chegadaNoPonto — a casa de chão ao lado do ponto, do primeiro lado que tiver chão (sul, oeste, leste,
        /// norte), olhando pra longe da porta; ponto de mais de uma casa põe o herói no meio delas.
        /// </summary>
        public static Walker ChegadaNoPonto(string ponto)
        {
            var casas = new List<RoomObject>();
            foreach (var p in D.PontosDaCidade)
                if (p.Id == ponto) casas.Add(p);
            foreach (var lado in D.LadosDaChegada)
            {
                var vetor = Directions.Vectors[lado];
                double somaCol = 0, somaRow = 0, livres = 0;
                foreach (var casa in casas)
                {
                    if (!Pisa(casa.Col + vetor.X, casa.Row + vetor.Y)) continue;
                    somaCol += casa.Col + vetor.X;
                    somaRow += casa.Row + vetor.Y;
                    livres++;
                }
                if (livres == 0) continue;
                return new Walker
                {
                    X = Js.Round((somaCol / livres + 0.5) * RoomWalk.TileUnits),
                    Y = Js.Round((somaRow / livres + 0.5) * RoomWalk.TileUnits),
                    Facing = lado,
                };
            }
            throw new EngineError("ponto da cidade sem chão em volta: " + Js.Str(ponto));
        }

        /// <summary>
        /// TS: pontoDaSala — o ponto de uma sala da cidade, onde quem carrega o jogo nela aparece: a Erma na cabana, o
        /// Bram no ferreiro, e a partida, a pracinha e o resto na árvore da praça. O portão fica com
        /// <see cref="Cidades.ChegadaNaCidade"/>.
        /// </summary>
        public static string PontoDaSala(CityCell celula)
        {
            switch (celula.Type)
            {
                case "tavern": return "taverna";
                case "shop": return "loja";
                case "blacksmith": return "ferreiro";
                case "encantadora": return "igreja";
                case "guild": return "guilda";
                case "questboard": return "quadro";
                case "npc":
                    if (celula.Npc?.Service == "blessing") return "vidente";
                    if (celula.Npc?.Service == "barter") return "ferreiro";
                    return "arvore";
                default: return "arvore";
            }
        }
    }
}
