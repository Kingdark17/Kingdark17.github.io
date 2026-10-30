using System.Collections.Generic;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// Os efeitos sonoros do jogo, com as mesmas notas do site (apps/web/lib/som/efeitos.ts, que vêm do js/effects.js
    /// original): cada efeito é um punhado de ondas simples tocadas juntas, que somem num decaimento exponencial, mais o
    /// eco único do barramento do site. Cada um é sintetizado na primeira vez que toca.
    ///
    /// O clipe sai no teto do mestre do site (0,48), e cada efeito toca com o ganho da tela de Configurações
    /// (<see cref="PreferenciaDeSom"/>): o volume geral, zero com o som desligado, vezes o dos efeitos. No padrão
    /// (0,28 e 100%) soa como antes da tela existir.
    /// </summary>
    public static class Sons
    {
        private const int Taxa = 44100;
        private const float Teto = 0.48f;
        private const float AtrasoDoEco = 0.24f;
        private const float GanhoDoEco = 0.16f;
        /// <summary>O oscilador do site para 20 ms depois do fim da rampa.</summary>
        private const float Cauda = 0.02f;

        private readonly struct Nota
        {
            public readonly float Hz, Duracao, Ganho;
            public readonly string Onda;

            public Nota(float hz, float duracao, string onda, float ganho)
            {
                Hz = hz;
                Duracao = duracao;
                Onda = onda;
                Ganho = ganho;
            }
        }

        private static readonly Dictionary<string, Nota[]> Efeitos = new Dictionary<string, Nota[]>
        {
            ["hit"] = new[] { new Nota(180, 0.12f, "square", 0.07f) },
            ["crit"] = new[] { new Nota(260, 0.18f, "square", 0.09f), new Nota(180, 0.12f, "square", 0.06f) },
            ["miss"] = new[] { new Nota(110, 0.1f, "sine", 0.05f) },
            ["gold"] = new[] { new Nota(880, 0.08f, "triangle", 0.06f), new Nota(1100, 0.08f, "triangle", 0.05f) },
            ["buy"] = new[] { new Nota(520, 0.09f, "triangle", 0.06f) },
            ["sell"] = new[] { new Nota(400, 0.09f, "triangle", 0.06f) },
            ["door"] = new[] { new Nota(220, 0.15f, "sine", 0.06f) },
            ["levelup"] = new[] { new Nota(523, 0.12f, "triangle", 0.08f), new Nota(659, 0.12f, "triangle", 0.08f), new Nota(784, 0.18f, "triangle", 0.09f) },
            ["victory"] = new[] { new Nota(660, 0.12f, "triangle", 0.08f), new Nota(880, 0.16f, "triangle", 0.08f) },
            ["defeat"] = new[] { new Nota(200, 0.3f, "sawtooth", 0.07f) },
            ["step"] = new[] { new Nota(140, 0.05f, "sine", 0.03f) },
            ["heal"] = new[] { new Nota(587, 0.1f, "triangle", 0.05f), new Nota(784, 0.14f, "triangle", 0.05f) },
        };

        private static readonly Dictionary<string, AudioClip> Prontos = new Dictionary<string, AudioClip>();
        private static AudioSource _fonte;

        /// <summary>Toca o efeito (TS: Efeito). Nome desconhecido não toca nada.</summary>
        public static void Tocar(string efeito)
        {
            if (efeito == null || !Efeitos.TryGetValue(efeito, out var notas)) return;
            float ganho = PreferenciaDeSom.GanhoDosEfeitos;
            if (ganho <= 0f) return;
            if (!Prontos.TryGetValue(efeito, out var clipe))
            {
                clipe = Sintetizar(efeito, notas);
                Prontos[efeito] = clipe;
            }
            Fonte().PlayOneShot(clipe, ganho);
        }

        private static AudioSource Fonte()
        {
            if (_fonte != null) return _fonte;
            var objeto = new GameObject("Sons do jogo");
            Object.DontDestroyOnLoad(objeto);
            _fonte = objeto.AddComponent<AudioSource>();
            _fonte.playOnAwake = false;
            _fonte.spatialBlend = 0f;
            return _fonte;
        }

        private static AudioClip Sintetizar(string nome, Nota[] notas)
        {
            float maior = 0f;
            foreach (var nota in notas) maior = Mathf.Max(maior, nota.Duracao + Cauda);
            int amostras = Mathf.CeilToInt((maior + AtrasoDoEco) * Taxa);

            var seco = new float[amostras];
            foreach (var nota in notas)
            {
                int fim = Mathf.Min(amostras, Mathf.CeilToInt((nota.Duracao + Cauda) * Taxa));
                for (int i = 0; i < fim; i++)
                {
                    float t = i / (float)Taxa;
                    // O exponentialRampToValueAtTime do site: do ganho até 0,0001 ao fim da duração.
                    float envelope = t < nota.Duracao ? nota.Ganho * Mathf.Pow(0.0001f / nota.Ganho, t / nota.Duracao) : 0.0001f;
                    seco[i] += Onda(nota.Onda, nota.Hz * t) * envelope;
                }
            }

            // O mestre vai direto pra saída e também por um eco de 0,24 s com ganho 0,16 (sem realimentação).
            int atraso = Mathf.RoundToInt(AtrasoDoEco * Taxa);
            var dados = new float[amostras];
            for (int i = 0; i < amostras; i++)
            {
                float eco = i >= atraso ? seco[i - atraso] * GanhoDoEco : 0f;
                dados[i] = (seco[i] + eco) * Teto;
            }

            var clipe = AudioClip.Create("som-" + nome, amostras, 1, Taxa, false);
            clipe.SetData(dados, 0);
            return clipe;
        }

        /// <summary>As ondas do OscillatorNode, a partir da fase 0.</summary>
        private static float Onda(string tipo, float ciclos)
        {
            float fase = ciclos - Mathf.Floor(ciclos);
            switch (tipo)
            {
                case "square": return fase < 0.5f ? 1f : -1f;
                case "triangle": return fase < 0.25f ? 4f * fase : fase < 0.75f ? 2f - 4f * fase : 4f * fase - 4f;
                case "sawtooth": return fase < 0.5f ? 2f * fase : 2f * fase - 2f;
                default: return Mathf.Sin(2f * Mathf.PI * fase);
            }
        }
    }
}
