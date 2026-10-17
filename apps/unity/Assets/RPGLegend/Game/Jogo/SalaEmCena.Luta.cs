using RPGLegend.Engine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A sala durante a luta: a luta é em primeira pessoa, por cima do palco (<see cref="PalcoDaLuta"/>), e a sala
    /// fica parada embaixo dela, sem desenhar (a câmera desliga). Quando a luta acaba, o herói continua por onde
    /// entrou, e a sala vencida volta com os extras dela.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        /// <summary>Em luta: o andar e o encostar param.</summary>
        public bool EmLuta { get; private set; }

        /// <summary>A luta começou: a sala para e deixa de desenhar.</summary>
        public void EntrarNaLuta()
        {
            if (EmLuta) return;
            EmLuta = true;
            _tocando = null;
            if (_camera != null) _camera.enabled = false;
        }

        /// <summary>A luta acabou: o herói fica em <paramref name="heroi"/>, e o próximo Mostrar redesenha a sala.</summary>
        public void SairDaLuta(Walker heroi)
        {
            if (!EmLuta) return;
            EmLuta = false;
            if (_camera != null) _camera.enabled = true;
            _walker = heroi;
            _tocando = null;
            _sobra = 0;
            _assinaturaDoDesenho = null;
        }
    }
}
