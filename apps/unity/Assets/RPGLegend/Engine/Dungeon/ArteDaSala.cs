using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de dungeon/arte-da-sala.ts (fixtures/data/dungeon/arte-da-sala.json).</summary>
    public sealed class ArteDaSalaData
    {
        /// <summary>Pixels da arte por casa da sala (a sala do Breno tem 288 × 288).</summary>
        [JsName("PIXELS_DA_SALA")] public double PixelsDaSala;
        /// <summary>As camadas de cada masmorra que tem arte, na ordem em que se desenham.</summary>
        [JsName("CAMADAS_DAS_SALAS")] public OrderedMap<List<CamadaDaSala>> CamadasDasSalas = new OrderedMap<List<CamadaDaSala>>();
        /// <summary>As casas de dentro que a arte faz de parede, além da borda (os cantos da Caverna).</summary>
        [JsName("PAREDES_DAS_SALAS")] public OrderedMap<List<TileRef>> ParedesDasSalas = new OrderedMap<List<TileRef>>();
        /// <summary>As casas onde a arte põe um enfeite na parede (as tochas da Caverna): anda-se nelas, mas extra não fica.</summary>
        [JsName("ENFEITES_DAS_SALAS")] public OrderedMap<List<TileRef>> EnfeitesDasSalas = new OrderedMap<List<TileRef>>();
        /// <summary>O formato da sala de cada masmorra que não é a de sempre (a Torre: 11 × 12, vãos de 3).</summary>
        [JsName("GEOMETRIAS_DAS_SALAS")] public OrderedMap<GeometriaDaSala> GeometriasDasSalas = new OrderedMap<GeometriaDaSala>();
        /// <summary>Privada no TS: o corpo do herói desenhado na sala, em unidades, a partir do pé (o boneco tem 1,25 casa).</summary>
        [JsName("CORPO_NA_SALA")] public CorpoDoHeroi CorpoNaSala = new CorpoDoHeroi();
    }

    /// <summary>
    /// TS: CamadaDaSala — uma camada da arte da sala e o plano dela: "chao" debaixo do herói e do que está na sala,
    /// "cima" por cima de tudo. Com <see cref="Porta"/>, é o caminho até a porta desse lado, e só aparece se ela existe.
    /// </summary>
    public sealed class CamadaDaSala
    {
        public string Arquivo;
        public string Plano;
        public string Porta;
        /// <summary>Só aparece quando a sala NÃO tem porta deste lado: a parede que fecha o vão (a Torre).</summary>
        public string SemPorta;
        /// <summary>
        /// Só nas de "cima": as casas em que a arte esconde o herói ('#'), uma linha por fileira. É o que diz se a camada
        /// está cobrindo o herói (<see cref="ArteDaSala.CobreOHeroiNaSala"/>).
        /// </summary>
        public List<string> Cobre;
    }

    public static partial class GameData
    {
        private static ArteDaSalaData _arteDaSalaTable;

        /// <summary>dungeon/arte-da-sala: as camadas desenhadas das salas da masmorra.</summary>
        public static ArteDaSalaData ArteDaSalaTable
        {
            get => Require(_arteDaSalaTable, "dungeon/arte-da-sala");
            set => _arteDaSalaTable = value;
        }
    }

    /// <summary>
    /// A arte desenhada das salas da masmorra (port de shared/src/dungeon/arte-da-sala.ts; 2026-10-24, a Floresta do
    /// Breno): o chão, um caminho até cada porta que a sala tem e o que passa por cima do herói. A masmorra sem arte
    /// continua com os quadradinhos coloridos.
    /// </summary>
    public static class ArteDaSala
    {
        private static ArteDaSalaData D => GameData.ArteDaSalaTable;

        public static double PixelsDaSala => D.PixelsDaSala;

        /// <summary>
        /// TS: camadasDaSala — as camadas da arte da masmorra, sem os caminhos das portas que a sala não tem; null quando
        /// ela ainda não tem arte.
        /// </summary>
        public static List<CamadaDaSala> CamadasDaSala(string dungeon, IReadOnlyList<string> portas)
        {
            if (!D.CamadasDasSalas.TryGet(dungeon, out var camadas) || camadas == null) return null;
            var lista = new List<CamadaDaSala>();
            foreach (var camada in camadas)
            {
                if (camada.Porta != null && !Contem(portas, camada.Porta)) continue;
                if (camada.SemPorta != null && Contem(portas, camada.SemPorta)) continue;
                lista.Add(new CamadaDaSala { Arquivo = camada.Arquivo, Plano = camada.Plano, Porta = camada.Porta, SemPorta = camada.SemPorta, Cobre = camada.Cobre });
            }
            return lista;
        }

        /// <summary>
        /// TS: cobreOHeroiNaSala — se a camada de cima está por cima do desenho do herói: aí ela fica meio transparente,
        /// como as construções da cidade. <paramref name="walker"/> contado do canto desta sala (o da vizinha fica além
        /// da borda dela).
        /// </summary>
        public static bool CobreOHeroiNaSala(CamadaDaSala camada, Walker walker)
        {
            if (camada.Plano != "cima" || camada.Cobre == null) return false;
            var corpo = D.CorpoNaSala;
            double t = RoomWalk.TileUnits;
            double esquerda = walker.X - corpo.MeiaLargura;
            double direita = walker.X + corpo.MeiaLargura;
            double pe = walker.Y + RoomWalk.HeroHalf;
            double topo = pe - corpo.Ate;
            double baixo = pe - corpo.De;
            for (int row = 0; row < camada.Cobre.Count; row++)
            {
                var linha = camada.Cobre[row];
                for (int col = 0; col < linha.Length; col++)
                {
                    if (linha[col] == '#' && col * t < direita && (col + 1) * t > esquerda && row * t < baixo && (row + 1) * t > topo) return true;
                }
            }
            return false;
        }

        /// <summary>
        /// TS: paredesDaSala — as casas de dentro que são parede nas salas desta masmorra (nenhuma fora dela, ou quando
        /// a arte não fecha nada).
        /// </summary>
        public static List<TileRef> ParedesDaSala(string dungeon) => Casas(D.ParedesDasSalas, dungeon);

        /// <summary>TS: geometriaDaSala — o formato das salas desta masmorra: o dela, ou o de sempre.</summary>
        public static GeometriaDaSala GeometriaDaSala(string dungeon) =>
            !string.IsNullOrEmpty(dungeon) && D.GeometriasDasSalas.TryGet(dungeon, out var g) && g != null ? g : RoomWalk.GeometriaPadrao;

        /// <summary>
        /// TS: enfeitesDaSala — as casas de enfeite das salas desta masmorra (as tochas da Caverna): um extra ali anda rumo
        /// ao meio, como o do canto.
        /// </summary>
        public static List<TileRef> EnfeitesDaSala(string dungeon) => Casas(D.EnfeitesDasSalas, dungeon);

        private static List<TileRef> Casas(OrderedMap<List<TileRef>> tabela, string dungeon)
        {
            var lista = new List<TileRef>();
            if (string.IsNullOrEmpty(dungeon) || !tabela.TryGet(dungeon, out var casas) || casas == null) return lista;
            foreach (var casa in casas) lista.Add(new TileRef { Col = casa.Col, Row = casa.Row });
            return lista;
        }

        private static bool Contem(IReadOnlyList<string> portas, string porta)
        {
            foreach (var p in portas)
                if (p == porta) return true;
            return false;
        }
    }
}
