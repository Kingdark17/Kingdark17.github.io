using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>Uma figura da sala: a arte, se houver, e o emoji pra quando não houver (o Figura do site).</summary>
    public sealed class Figura
    {
        /// <summary>Nome da arte em Resources (ex.: "Mapa/bau"), ou null.</summary>
        public string Arte;
        public string Emoji;
        /// <summary>Altura em quadrados: os extras são menores que o conteúdo da sala.</summary>
        public float Escala = 1f;
        /// <summary>Já usado (baú aberto): desenhado apagado.</summary>
        public bool Apagada;
        /// <summary>A parede rachada: não é figura, é a pedra riscada.</summary>
        public bool Rachadura;
    }

    /// <summary>As cores provisórias de um lugar, até o tileset do Breno (as mesmas do site).</summary>
    public sealed class TemaDaSala
    {
        public Color Chao, ChaoAlternado, Parede, BordaDaParede, Vao;

        private static Color Cor(int rgb) => new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f);

        private static TemaDaSala De(int chao, int alternado, int parede, int borda, int vao) =>
            new TemaDaSala { Chao = Cor(chao), ChaoAlternado = Cor(alternado), Parede = Cor(parede), BordaDaParede = Cor(borda), Vao = Cor(vao) };

        private static readonly Dictionary<string, TemaDaSala> Temas = new Dictionary<string, TemaDaSala>
        {
            ["cidade"] = De(0x5d7a3f, 0x56723a, 0x6f6a60, 0x8a8478, 0x3b2f22),
            ["floresta"] = De(0x3e5f2c, 0x395828, 0x253a1b, 0x3f5a2c, 0x1d140c),
            ["caverna"] = De(0x5b5148, 0x544b42, 0x2f2925, 0x4a4038, 0x15110e),
            ["torre"] = De(0x4a4258, 0x443d51, 0x2b2536, 0x40384f, 0x120f17),
        };

        /// <summary>O tema do lugar do estado: a cidade, ou a masmorra da descida.</summary>
        public static TemaDaSala Do(EstadoDoJogo estado)
        {
            var lugar = estado.MapMode == "dungeon" ? estado.Masmorra?.Dungeon ?? "floresta" : "cidade";
            return Temas.TryGetValue(lugar, out var tema) ? tema : Temas["floresta"];
        }
    }

    /// <summary>
    /// Como cada objeto da sala é desenhado (o figuras-da-sala.ts do site): o conteúdo com a arte do minimapa (ou o
    /// emoji da apresentação), o baú pequeno com a arte do baú, o vaso e a placa em emoji, a parede rachada riscada
    /// na pedra e, na sala secreta, só o baú dela. Arte provisória até o Breno desenhar.
    /// </summary>
    public static class FigurasDaSala
    {
        private static readonly Dictionary<string, string> ArtePorTipo = new Dictionary<string, string>
        {
            ["start"] = "inicio", ["npc"] = "npc", ["treasure"] = "bau", ["monster"] = "monstro", ["boss"] = "chefe",
            ["stairs"] = "escada", ["exit"] = "saida", ["event"] = "evento", ["shop"] = "loja", ["blacksmith"] = "ferreiro",
            ["tavern"] = "taverna", ["questboard"] = "missoes", ["gate"] = "portao",
        };

        /// <summary>A arte do tipo de sala (Resources "Mapa/…"), ou null quando ainda não há — aí vale o emoji.</summary>
        public static string ArteDoTipo(string tipo) => tipo != null && ArtePorTipo.TryGetValue(tipo, out var arquivo) ? "Mapa/" + arquivo : null;

        public const string ArteDoBau = "Mapa/bau";

        /// <summary>As figuras pelo id do objeto da planta. Na sala secreta (<paramref name="indiceDaSecreta"/>), só o baú dela.</summary>
        public static Dictionary<string, Figura> Da(RoomCell celula, Figura conteudo, double? indiceDaSecreta)
        {
            var figuras = new Dictionary<string, Figura>();
            var extras = ExtrasDaSala.ExtrasDe(celula);
            if (indiceDaSecreta.HasValue)
            {
                int i = (int)indiceDaSecreta.Value;
                bool aberto = i >= 0 && i < extras.Count && (extras[i].SecretCollected ?? false);
                figuras[ExtrasDaSala.IdDoBauSecreto] = new Figura { Arte = ArteDoBau, Emoji = "🧰", Apagada = aberto };
                return figuras;
            }

            if (conteudo != null) figuras[AndarNaSala.IdDoConteudo] = conteudo;
            for (int i = 0; i < extras.Count; i++)
            {
                var extra = extras[i];
                bool usado = extra.Used ?? false;
                var id = ExtrasDaSala.IdDoExtra(i);
                switch (extra.Kind)
                {
                    case "chest":
                        figuras[id] = new Figura { Arte = ArteDoBau, Emoji = "🧰", Escala = 0.75f, Apagada = usado };
                        break;
                    case "pot":
                        figuras[id] = new Figura { Emoji = "🏺", Escala = 0.85f };
                        break;
                    case "sign":
                        figuras[id] = new Figura { Emoji = "🪧", Escala = 0.85f };
                        break;
                    case "crack":
                        figuras[id] = new Figura { Emoji = "", Rachadura = true };
                        break;
                }
            }
            return figuras;
        }

        /// <summary>A assinatura das figuras, pra cena só redesenhar quando algo mudou.</summary>
        public static string Assinatura(Dictionary<string, Figura> figuras)
        {
            var partes = new List<string>();
            foreach (var kv in figuras)
                partes.Add(kv.Key + "=" + kv.Value.Arte + "|" + kv.Value.Emoji + "|" + kv.Value.Escala + "|" + kv.Value.Apagada + "|" + kv.Value.Rachadura);
            partes.Sort(System.StringComparer.Ordinal);
            return string.Join(";", partes);
        }
    }
}
