using System;
using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A sala durante a luta (a sala é a arena, 2026-11-11): ela continua à vista, com a câmera enquadrando-a na área
    /// que o palco reserva (<see cref="PalcoDaLuta.AreaDaSala"/>), e os monstros por cima dela. O herói anda por ela,
    /// mas quem o move é a arena (<see cref="MoverNaLuta"/>), com as regras da luta. Quando ela acaba, a câmera volta
    /// a segui-lo, e a sala vencida volta com os extras dela.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        /// <summary>Em luta: o andar e o encostar param.</summary>
        public bool EmLuta { get; private set; }

        /// <summary>A sala da luta enquadrada: a fração da tela (de cima pra baixo) em que ela aparece inteira.</summary>
        private Rect? _enquadre;

        /// <summary>Onde o herói fica depois da luta se ele acabar em cima de algo que apareceu na sala (o baú, a escada).</summary>
        private Walker _reservaDaLuta;

        /// <summary>A luta começou: a sala para de andar sozinha, com o herói em <paramref name="heroi"/> (um passo pra dentro da porta).</summary>
        public void EntrarNaLuta(Walker heroi)
        {
            if (EmLuta) return;
            EmLuta = true;
            _tocando = null;
            if (heroi != null)
            {
                _walker = Copia(heroi);
                _reservaDaLuta = Copia(heroi);
            }
            ColocarHeroi(false);
        }

        /// <summary>A cada quadro da luta: o herói onde a arena diz, com o pulinho de quem anda.</summary>
        public void MoverNaLuta(Walker heroi)
        {
            if (!EmLuta || heroi == null) return;
            bool andou = _walker == null || heroi.X != _walker.X || heroi.Y != _walker.Y;
            _walker = Copia(heroi);
            ColocarHeroi(andou);
        }

        private static Walker Copia(Walker w) => new Walker { X = w.X, Y = w.Y, Facing = w.Facing };

        /// <summary>
        /// Depois da luta a sala ganha o que estava escondido (o baú, os potes, a escada), e o herói pode ter acabado
        /// em cima de uma dessas casas: aí ele volta pro lugar em que a luta começou, que é sempre chão.
        /// </summary>
        private void TirarDeCimaDoQueApareceu()
        {
            if (EmLuta || _reservaDaLuta == null || _walker == null || _planta == null) return;
            var reserva = _reservaDaLuta;
            _reservaDaLuta = null;
            double t = GameData.RoomWalkTable.TileUnits;
            double meio = GameData.RoomWalkTable.HeroHalf;
            for (int row = (int)Math.Floor((_walker.Y - meio) / t); row <= (int)Math.Floor((_walker.Y + meio - 1) / t); row++)
            {
                for (int col = (int)Math.Floor((_walker.X - meio) / t); col <= (int)Math.Floor((_walker.X + meio - 1) / t); col++)
                {
                    if (row < 0 || row >= _planta.Solid.Count || col < 0 || col >= _planta.Solid[row].Count) continue;
                    if (!_planta.Solid[row][col]) continue;
                    _walker = reserva;
                    return;
                }
            }
        }

        /// <summary>
        /// A câmera mostra a sala atual inteira na fração <paramref name="alvo"/> da tela (x e y a partir do canto de cima
        /// à esquerda, largura e altura), na escala que couber: a cena tem a proporção da tela.
        /// </summary>
        public void EnquadrarNaLuta(Rect alvo)
        {
            if (!EmLuta || _camera == null || alvo.width <= 0 || alvo.height <= 0) return;
            if (_enquadre.HasValue && _enquadre.Value == alvo) return;
            _enquadre = alvo;
            float aspecto = _camera.aspect;
            float meiaAltura = Mathf.Max(_altura / (alvo.height * 2f), _largura / (alvo.width * 2f * aspecto));
            _camera.orthographicSize = meiaAltura;
            // O meio da sala no meio do alvo: o quanto o alvo foge do meio da tela, em unidades do mundo.
            float dx = (alvo.x + alvo.width / 2f - 0.5f) * 2f * meiaAltura * aspecto;
            float dy = (alvo.y + alvo.height / 2f - 0.5f) * 2f * meiaAltura;
            var meio = Mundo((_emendada ? _origemX : 0f) + _largura / 2f, (_emendada ? _origemY : 0f) + _altura / 2f);
            _camera.transform.position = meio + new Vector3(-dx, dy, -10f);
        }

        /// <summary>A luta acabou: o herói fica em <paramref name="heroi"/>, e o próximo Mostrar redesenha a sala.</summary>
        public void SairDaLuta(Walker heroi)
        {
            if (!EmLuta) return;
            EmLuta = false;
            _enquadre = null;
            AjustarZoom();
            _walker = heroi;
            _tocando = null;
            _sobra = 0;
            _assinaturaDoDesenho = null;
        }
    }
}
