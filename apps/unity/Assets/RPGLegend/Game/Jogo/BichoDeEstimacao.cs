using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;
using UnityEngine.UIElements;
using UnityEngine.UIElements.Experimental;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O bichinho no canto da partida (bicho-de-estimacao.tsx do site): o pet da conta, com a arte própria quando há
    /// (lib/pets/rostos.ts) e o emoji dele quando não. Tocar faz carinho: um coração sobe, o pet reage e toca o som
    /// de cura. É só enfeite — o bônus de combate do pet vem da engine e não depende de carinho.
    /// </summary>
    public sealed class BichoDeEstimacao
    {
        /// <summary>Uma tira de quadros lado a lado num PNG só (arte parada é uma tira de um quadro).</summary>
        private sealed class Animacao
        {
            public string Arquivo;
            public int Quadros;
            /// <summary>A volta inteira; ignorada com um quadro só.</summary>
            public float DuracaoMs;
        }

        /// <summary>TS: ROSTOS_DE_PET — quem não está aqui usa o emoji (petIcon), que é o padrão.</summary>
        private static readonly Dictionary<string, (Animacao Normal, Animacao Coracao)> Rostos = new Dictionary<string, (Animacao, Animacao)>
        {
            ["baby_dragon"] = (new Animacao { Arquivo = "Pets/dragon-normal", Quadros = 1 }, new Animacao { Arquivo = "Pets/dragon-heart", Quadros = 1 }),
            ["slime"] = (new Animacao { Arquivo = "Pets/slime-normal", Quadros = 12, DuracaoMs = 1920 },
                new Animacao { Arquivo = "Pets/slime-heart", Quadros = 24, DuracaoMs = 1200 }),
        };

        /// <summary>Pra arte parada, que não tem duração própria pra ditar o tempo do carinho.</summary>
        private const float DuracaoDoCarinhoMs = 1200;

        private static readonly Dictionary<string, Sprite[]> Tiras = new Dictionary<string, Sprite[]>();

        private readonly Button _botao;
        private readonly VisualElement _rosto;
        private readonly Label _emoji, _coracao;
        private string _pet;
        private IVisualElementScheduledItem _quadros, _fimDoCarinho;
        private ValueAnimation<float> _subida;

        public BichoDeEstimacao(Button botao)
        {
            _botao = botao;
            _botao.AddToClassList("bichinho");
            _rosto = new VisualElement { pickingMode = PickingMode.Ignore };
            _rosto.AddToClassList("rosto-do-bicho");
            _emoji = new Label { pickingMode = PickingMode.Ignore };
            _emoji.AddToClassList("emoji-do-bicho");
            _coracao = new Label("❤") { pickingMode = PickingMode.Ignore };
            _coracao.AddToClassList("coracao-do-bicho");
            _botao.Add(_rosto);
            _botao.Add(_emoji);
            _botao.Add(_coracao);
            _botao.clicked += Carinho;
            // O botão mora em cima da sala: o toque nele não pode virar joystick.
            _botao.RegisterCallback<PointerDownEvent>(e => e.StopPropagation());
            Mostrar(null);
        }

        /// <summary>O pet da conta (o id, ou "none"/vazio pra nenhum).</summary>
        public void Mostrar(string pet)
        {
            _pet = string.IsNullOrEmpty(pet) || pet == "none" ? null : pet;
            _botao.EnableInClassList("escondido", _pet == null);
            _botao.RemoveFromClassList("feliz");
            PararSubida();
            _coracao.style.opacity = 0f;
            _fimDoCarinho?.Pause();
            if (_pet == null)
            {
                _quadros?.Pause();
                return;
            }
            bool temArte = Rostos.ContainsKey(_pet);
            _rosto.EnableInClassList("escondido", !temArte);
            _emoji.EnableInClassList("escondido", temArte);
            _emoji.text = Pets.Icon(_pet);
            if (temArte) Tocar(Rostos[_pet].Normal, emLaco: true);
        }

        private void Carinho()
        {
            if (_pet == null) return;
            Sons.Tocar("heal");
            _botao.AddToClassList("feliz");
            // O coração sobe, cresce e some, como o coracaoSubindo do site; cada toque recomeça do zero. KeepAlive:
            // sem ele a Unity recicla a animação ao terminar, e parar a reciclada no toque seguinte dá erro.
            PararSubida();
            _subida = _coracao.experimental.animation.Start(0f, 1f, 850, (elemento, t) =>
            {
                elemento.style.opacity = 1f - t;
                elemento.style.translate = new Translate(0, -48f * t);
                elemento.style.scale = new Scale(Vector2.one * (1f + 0.4f * t));
            }).Ease(Easing.OutQuad).KeepAlive();

            float duracao = DuracaoDoCarinhoMs;
            if (Rostos.TryGetValue(_pet, out var rosto))
            {
                // A reação toca uma vez e segura a pose; quem manda no tempo é a própria tira.
                Tocar(rosto.Coracao, emLaco: false);
                if (rosto.Coracao.Quadros > 1) duracao = rosto.Coracao.DuracaoMs;
            }
            _fimDoCarinho?.Pause();
            _fimDoCarinho = _botao.schedule.Execute(() =>
            {
                _botao.RemoveFromClassList("feliz");
                if (_pet != null && Rostos.TryGetValue(_pet, out var deVolta)) Tocar(deVolta.Normal, emLaco: true);
            }).StartingIn((long)duracao);
        }

        private void PararSubida()
        {
            if (_subida == null) return;
            if (_subida.isRunning) _subida.Stop();
            _subida.Recycle();
            _subida = null;
        }

        private void Tocar(Animacao animacao, bool emLaco)
        {
            _quadros?.Pause();
            var quadros = Quadros(animacao);
            if (quadros.Length == 0) return;
            int atual = 0;
            _rosto.style.backgroundImage = new StyleBackground(quadros[0]);
            if (quadros.Length == 1) return;
            _quadros = _rosto.schedule.Execute(() =>
            {
                if (atual + 1 >= quadros.Length && !emLaco) return;
                atual = (atual + 1) % quadros.Length;
                _rosto.style.backgroundImage = new StyleBackground(quadros[atual]);
            }).Every((long)(animacao.DuracaoMs / quadros.Length));
        }

        /// <summary>Os quadros da tira, recortados uma vez (a textura é a do Resources, sem cópia).</summary>
        private static Sprite[] Quadros(Animacao animacao)
        {
            if (Tiras.TryGetValue(animacao.Arquivo, out var prontos)) return prontos;
            var textura = Resources.Load<Texture2D>(animacao.Arquivo);
            var quadros = new List<Sprite>();
            if (textura != null)
            {
                float largura = textura.width / (float)animacao.Quadros;
                for (int i = 0; i < animacao.Quadros; i++)
                    quadros.Add(Sprite.Create(textura, new Rect(i * largura, 0, largura, textura.height), new Vector2(0.5f, 0.5f), 1f));
            }
            Tiras[animacao.Arquivo] = quadros.ToArray();
            return Tiras[animacao.Arquivo];
        }
    }
}
