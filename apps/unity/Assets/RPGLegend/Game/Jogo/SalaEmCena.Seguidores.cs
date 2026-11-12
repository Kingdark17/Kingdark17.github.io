using System.Collections.Generic;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// Os esqueletos do necromante andando atrás do herói (pedido do usuário, 2026-11-12; só no app). É só desenho: a
    /// regra continua sem posição pra eles. Cada um segue o da frente (o primeiro, o herói) como numa corda, a uma
    /// folga de distância, então andam em fila e fazem a curva por dentro. Ainda não há arte de esqueleto: é o 💀 do
    /// monstro, até o Breno desenhar o mini.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        private const string EmojiDoSeguidor = "💀";
        /// <summary>A altura do seguidor e a distância que ele guarda de quem vai na frente, em pixel do site.</summary>
        private const float AlturaDoSeguidor = Lado * 0.6f;
        private const float FolgaDoSeguidor = Lado * 0.7f;
        /// <summary>Mais longe que isto de quem vai na frente (outra sala, outro andar), ele aparece junto em vez de correr.</summary>
        private const float SaltoDoSeguidor = Lado * 3f;

        private sealed class Seguidor
        {
            public Transform Raiz;
            public SpriteRenderer Desenho;
            public Vector2 Onde;
            public bool Posto;
            public bool Espelhado;
            public int Fase;
        }

        private readonly List<Seguidor> _seguidores = new List<Seguidor>();
        private int _quantosSeguem;

        /// <summary>Quantos seguem o herói agora (os esqueletos de pé). Na cidade, nenhum.</summary>
        public void DefinirSeguidores(int quantos)
        {
            quantos = Mathf.Max(0, quantos);
            if (quantos == _quantosSeguem) return;
            _quantosSeguem = quantos;
            while (_seguidores.Count < quantos) _seguidores.Add(NovoSeguidor(_seguidores.Count));
            for (int i = 0; i < _seguidores.Count; i++)
            {
                bool segue = i < quantos;
                _seguidores[i].Raiz.gameObject.SetActive(segue);
                // Quem volta a seguir aparece junto de quem vai na frente, e não onde tinha ficado.
                if (!segue) _seguidores[i].Posto = false;
            }
            ColocarHeroi(false);
        }

        private Seguidor NovoSeguidor(int indice)
        {
            var raiz = new GameObject("Seguidor " + (indice + 1)).transform;
            raiz.SetParent(transform, false);
            var desenho = new GameObject("Desenho");
            desenho.transform.SetParent(raiz, false);
            // Um fio atrás do herói: no mesmo ponto do chão, é ele quem aparece.
            desenho.transform.localPosition = new Vector3(0f, 0f, 0.001f * (indice + 1));
            var renderizador = desenho.AddComponent<SpriteRenderer>();
            PorNoPe(renderizador, EmojiDoSistema.Sprite(EmojiDoSeguidor), AlturaDoSeguidor);
            return new Seguidor { Raiz = raiz, Desenho = renderizador };
        }

        /// <summary>Põe a fila atrás do herói, que está com o pé em (<paramref name="x"/>, <paramref name="y"/>), em pixel do site.</summary>
        private void ColocarSeguidores(float x, float y)
        {
            var frente = new Vector2(x, y);
            for (int i = 0; i < _quantosSeguem && i < _seguidores.Count; i++)
            {
                var s = _seguidores[i];
                var ate = frente - s.Onde;
                float distancia = ate.magnitude;
                bool andou = false;
                if (!s.Posto || distancia > SaltoDoSeguidor)
                {
                    s.Onde = frente;
                    s.Posto = true;
                }
                else if (distancia > FolgaDoSeguidor)
                {
                    s.Onde = frente - ate / distancia * FolgaDoSeguidor;
                    andou = true;
                    if (ate.x < -0.01f) s.Espelhado = true;
                    else if (ate.x > 0.01f) s.Espelhado = false;
                }
                if (andou) s.Fase++;
                float pulo = andou ? Mathf.Abs(Mathf.Sin(s.Fase * 0.35f)) * 3f : 0f;
                s.Raiz.position = Mundo(s.Onde.x, s.Onde.y - pulo);
                s.Raiz.localScale = new Vector3(s.Espelhado ? -1f : 1f, 1f, 1f);
                s.Desenho.sortingOrder = (int)s.Onde.y;
                frente = s.Onde;
            }
        }
    }
}
