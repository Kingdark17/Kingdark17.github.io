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
                lista.Add(new CamadaDaSala { Arquivo = camada.Arquivo, Plano = camada.Plano, Porta = camada.Porta });
            }
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
