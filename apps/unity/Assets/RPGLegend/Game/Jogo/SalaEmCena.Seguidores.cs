using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A equipe andando atrás do herói (pedido do usuário, 2026-11-12; só no app): os recrutas de pé e os esqueletos
    /// do necromante. É só desenho: a regra continua sem posição pra eles. Cada um segue o da frente (o primeiro, o
    /// herói) como numa corda, a uma folga de distância, então andam em fila e fazem a curva por dentro.
    ///
    /// O desenho é o mini boneco do herói (<see cref="Paperdoll.Mini"/>): o recruta com a raça dele e a roupa de baixo,
    /// como um herói sem equipamento, e o esqueleto com o corpo do Morto-vivo, sem roupa. Raça sem mini (o anão) fica
    /// com o emoji dela, como o herói.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        /// <summary>A distância que cada um guarda de quem vai na frente, em pixel do site.</summary>
        private const float FolgaDoSeguidor = Lado * 0.75f;
        /// <summary>Mais longe que isto de quem vai na frente (outra sala, outro andar), ele aparece junto em vez de correr.</summary>
        private const float SaltoDoSeguidor = Lado * 3f;
        private const string CorpoDoEsqueleto = "corpo/morto_vivo";

        private sealed class Seguidor
        {
            public Transform Raiz, DeFrente, DeCostas;
            public readonly List<SpriteRenderer> Camadas = new List<SpriteRenderer>();
            public string Chave;
            public bool DeEmoji, TemCostas, Espelhado, Subindo;
            public Vector2 Onde;
            public bool Posto;
            public int Fase;
        }

        private readonly List<Seguidor> _seguidores = new List<Seguidor>();
        private int _quantosSeguem;

        /// <summary>Quem segue o herói agora: os de pé da equipe, na ordem dela (os recrutas, depois os esqueletos).</summary>
        public void DefinirSeguidores(IReadOnlyList<Companion> equipe)
        {
            var dePe = new List<Companion>();
            if (equipe != null)
                foreach (var membro in equipe)
                    if (membro != null && membro.Hp > 0) dePe.Add(membro);

            while (_seguidores.Count < dePe.Count) _seguidores.Add(NovoSeguidor(_seguidores.Count));
            bool mudou = dePe.Count != _quantosSeguem;
            for (int i = 0; i < _seguidores.Count; i++)
            {
                var s = _seguidores[i];
                bool segue = i < dePe.Count;
                if (s.Raiz.gameObject.activeSelf != segue) s.Raiz.gameObject.SetActive(segue);
                // Quem volta a seguir aparece junto de quem vai na frente, e não onde tinha ficado.
                if (!segue)
                {
                    s.Posto = false;
                    continue;
                }
                Vestir(s, dePe[i]);
            }
            _quantosSeguem = dePe.Count;
            if (mudou) ColocarHeroi(false);
        }

        private Seguidor NovoSeguidor(int indice)
        {
            var s = new Seguidor { Raiz = new GameObject("Seguidor " + (indice + 1)).transform };
            s.Raiz.SetParent(transform, false);
            s.DeFrente = new GameObject("De frente").transform;
            s.DeFrente.SetParent(s.Raiz, false);
            s.DeCostas = new GameObject("De costas").transform;
            s.DeCostas.SetParent(s.Raiz, false);
            s.DeCostas.gameObject.SetActive(false);
            return s;
        }

        /// <summary>As camadas do mini boneco de quem segue: o esqueleto só com o corpo; o recruta, como um herói sem nada.</summary>
        private static List<string> MiniDoSeguidor(Companion membro, bool costas)
        {
            if (membro.Invocado == true)
            {
                var corpo = (costas ? "costas/" : "frente/") + CorpoDoEsqueleto;
                return Paperdoll.ArteDoMini(corpo) != null ? new List<string> { corpo } : new List<string>();
            }
            return Paperdoll.Mini(new Hero { Race = membro.Race }, costas);
        }

        /// <summary>Monta o desenho de quem segue; só refaz quando a figura muda (outro membro naquele lugar da fila).</summary>
        private void Vestir(Seguidor s, Companion membro)
        {
            var frente = MiniDoSeguidor(membro, false);
            var costas = MiniDoSeguidor(membro, true);
            var emoji = string.IsNullOrEmpty(membro.RaceIcon) ? "🙂" : membro.RaceIcon;
            var chave = string.Join(",", frente) + "|" + string.Join(",", costas) + "|" + emoji;
            if (chave == s.Chave) return;
            s.Chave = chave;

            foreach (var camada in s.Camadas) Destroy(camada.gameObject);
            s.Camadas.Clear();
            s.DeEmoji = frente.Count == 0;
            s.TemCostas = costas.Count > 0;
            if (s.DeEmoji)
            {
                PorNoPe(CamadaDoSeguidor(s, s.DeFrente, 0), EmojiDoSistema.Sprite(emoji), Lado * 1.1f);
                return;
            }
            for (int i = 0; i < frente.Count; i++) PorCamadaDoMini(CamadaDoSeguidor(s, s.DeFrente, i), frente[i]);
            for (int i = 0; i < costas.Count; i++) PorCamadaDoMini(CamadaDoSeguidor(s, s.DeCostas, i), costas[i]);
        }

        private static SpriteRenderer CamadaDoSeguidor(Seguidor s, Transform lado, int indice)
        {
            var camada = new GameObject("Camada " + indice);
            camada.transform.SetParent(lado, false);
            camada.transform.localPosition = new Vector3(0f, 0f, -0.001f * (indice + 1));
            var renderizador = camada.AddComponent<SpriteRenderer>();
            s.Camadas.Add(renderizador);
            return renderizador;
        }

        /// <summary>Põe a fila atrás do herói, que está com o pé em (<paramref name="x"/>, <paramref name="y"/>), em pixel do site.</summary>
        private void ColocarSeguidores(float x, float y)
        {
            var frente = new Vector2(x, y);
            float tamanhoDoMini = _escala * (float)GameData.RoomWalkTable.TileUnits / Paperdoll.AlturaDoMini;
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
                    // Pra onde anda: de costas subindo (y do site cresce pra baixo), de frente nos outros, espelhado à esquerda.
                    if (Mathf.Abs(ate.x) >= Mathf.Abs(ate.y))
                    {
                        s.Espelhado = ate.x < 0f;
                        s.Subindo = false;
                    }
                    else s.Subindo = ate.y < 0f;
                }
                if (andou) s.Fase++;
                float pulo = andou ? Mathf.Abs(Mathf.Sin(s.Fase * 0.35f)) * 3f : 0f;
                s.Raiz.position = Mundo(s.Onde.x, s.Onde.y - pulo);

                bool deCostas = s.Subindo && s.TemCostas;
                if (s.DeCostas.gameObject.activeSelf != deCostas)
                {
                    s.DeCostas.gameObject.SetActive(deCostas);
                    s.DeFrente.gameObject.SetActive(!deCostas);
                }
                float tamanho = s.DeEmoji ? 1f : tamanhoDoMini;
                s.DeFrente.localScale = new Vector3(s.Espelhado ? -tamanho : tamanho, tamanho, 1f);
                s.DeCostas.localScale = new Vector3(tamanho, tamanho, 1f);
                foreach (var camada in s.Camadas) camada.sortingOrder = (int)s.Onde.y;
                frente = s.Onde;
            }
        }
    }
}
