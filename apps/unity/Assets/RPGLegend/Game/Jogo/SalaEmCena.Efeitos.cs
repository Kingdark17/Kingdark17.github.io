using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// Os efeitos tocados na sala (2026-11-13): o golpe que acerta, o monstro caindo, a cura, o esqueleto surgindo.
    /// Cada um é uma folha de <see cref="Efeitos"/>, posta no mundo da sala na escala da arte (uma casa = a altura do
    /// mini boneco), por cima de tudo, e some sozinho no último quadro. Os renderizadores voltam pra uma pilha.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        /// <summary>Por cima das camadas de cima da sala (as copas, a parede da frente).</summary>
        private const int OrdemDosEfeitos = OrdemDeCima + 1000;

        private sealed class Tocando
        {
            public SpriteRenderer Desenho;
            public Efeitos.Folha Folha;
            public float Desde;
        }

        private readonly List<Tocando> _efeitos = new List<Tocando>();
        private readonly Stack<SpriteRenderer> _efeitosLivres = new Stack<SpriteRenderer>();
        private Transform _camadaDosEfeitos;

        /// <summary>
        /// Toca o efeito <paramref name="nome"/> com o ponto de apoio dele em (<paramref name="x"/>, <paramref name="y"/>),
        /// em unidades da sala atual (as do herói e dos monstros). <paramref name="espelhar"/> vira pra esquerda.
        /// </summary>
        public void TocarEfeito(string nome, double x, double y, bool espelhar = false)
        {
            var folha = Efeitos.Pegar(nome);
            if (folha == null || folha.Quadros.Length == 0) return;
            if (_camadaDosEfeitos == null)
            {
                _camadaDosEfeitos = new GameObject("Efeitos").transform;
                _camadaDosEfeitos.SetParent(transform, false);
            }
            var desenho = _efeitosLivres.Count > 0 ? _efeitosLivres.Pop() : NovoDesenhoDeEfeito();
            desenho.gameObject.SetActive(true);
            desenho.sprite = folha.Quadros[0];
            float px = (_emendada ? _origemX : 0f) + (float)x * _escala;
            float py = (_emendada ? _origemY : 0f) + (float)y * _escala;
            float escala = _escala * (float)GameData.RoomWalkTable.TileUnits / Paperdoll.AlturaDoMini;
            desenho.transform.position = Mundo(px, py) + new Vector3(0f, 0f, -1f);
            desenho.transform.localScale = new Vector3(espelhar ? -escala : escala, escala, 1f);
            _efeitos.Add(new Tocando { Desenho = desenho, Folha = folha, Desde = Time.unscaledTime });
        }

        private SpriteRenderer NovoDesenhoDeEfeito()
        {
            var objeto = new GameObject("Efeito");
            objeto.transform.SetParent(_camadaDosEfeitos, false);
            var desenho = objeto.AddComponent<SpriteRenderer>();
            desenho.sortingOrder = OrdemDosEfeitos;
            return desenho;
        }

        /// <summary>A cada quadro: cada efeito no quadro da vez; o que acabou volta pra pilha.</summary>
        private void AnimarEfeitos()
        {
            if (_efeitos.Count == 0) return;
            float agora = Time.unscaledTime;
            for (int i = _efeitos.Count - 1; i >= 0; i--)
            {
                var e = _efeitos[i];
                var dados = e.Folha.Dados;
                int quadro = (int)((agora - e.Desde) * dados.fps);
                if (dados.laco) quadro %= e.Folha.Quadros.Length;
                if (quadro >= e.Folha.Quadros.Length)
                {
                    e.Desenho.gameObject.SetActive(false);
                    _efeitosLivres.Push(e.Desenho);
                    _efeitos.RemoveAt(i);
                    continue;
                }
                e.Desenho.sprite = e.Folha.Quadros[quadro];
            }
        }
    }
}
