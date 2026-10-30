using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A sala durante a luta no mapa (2026-10-30): ela continua à vista, parada, com a câmera enquadrando-a na área que
    /// o palco reserva (<see cref="PalcoDaLuta.AreaDaSala"/>), e os monstros por cima dela. O herói dá um passo pra
    /// dentro da porta. Quando a luta acaba, a câmera volta a segui-lo, e a sala vencida volta com os extras dela.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        /// <summary>Em luta: o andar e o encostar param.</summary>
        public bool EmLuta { get; private set; }

        /// <summary>A sala da luta enquadrada: a fração da tela (de cima pra baixo) em que ela aparece inteira.</summary>
        private Rect? _enquadre;

        /// <summary>A luta começou: a sala para, com o herói em <paramref name="heroi"/> (um passo pra dentro da porta).</summary>
        public void EntrarNaLuta(Walker heroi)
        {
            if (EmLuta) return;
            EmLuta = true;
            _tocando = null;
            if (heroi != null) _walker = heroi;
            ColocarHeroi(false);
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
