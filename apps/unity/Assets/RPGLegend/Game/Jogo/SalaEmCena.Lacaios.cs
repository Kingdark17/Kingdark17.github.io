using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O Necromante na sala (rodada 4b do doc do Breno, só no app): na luta, os lacaios com corpo vão onde a arena
    /// diz (em vez da fila atrás do herói); depois dela, os cristais dos inimigos que caíram ficam no chão até o herói
    /// sair da sala; e, em dupla, os lacaios do parceiro aparecem onde ele diz (só desenho).
    /// </summary>
    public sealed partial class SalaEmCena
    {
        /// <summary>Na luta: pra cada lugar da fila de seguidores, onde o lacaio dele está (pixel do site, no pé).</summary>
        private readonly Dictionary<int, Vector2> _lugarNaLuta = new Dictionary<int, Vector2>();

        /// <summary>O ponto da sala (em unidades dela, o pé) em pixel do site, como o herói.</summary>
        private Vector2 PixelDaSala(double x, double y) =>
            new Vector2((_emendada ? _origemX : 0f) + (float)x * _escala, (_emendada ? _origemY : 0f) + (float)(y + GameData.RoomWalkTable.HeroHalf) * _escala);

        /// <summary>
        /// Na luta, cada lacaio com corpo vai pro lugar dele na arena (os recrutas continuam na fila). A ordem é a da
        /// fila de <see cref="DefinirSeguidores"/>: os de pé da equipe.
        /// </summary>
        public void PorLacaiosNaLuta(IReadOnlyList<Companion> equipe, IReadOnlyList<CompanheiroNaArena> companheiros)
        {
            _lugarNaLuta.Clear();
            if (equipe == null || companheiros == null) return;
            int k = 0;
            for (int i = 0; i < equipe.Count; i++)
            {
                if (!SegueOHeroi(equipe[i])) continue;
                foreach (var c in companheiros)
                    if (c.Indice == i && c.X != null && c.Y != null) _lugarNaLuta[k] = PixelDaSala(c.X.Value, c.Y.Value);
                k++;
            }
        }

        /// <summary>A luta acabou: a fila volta a seguir o herói.</summary>
        public void EsquecerLacaiosNaLuta() => _lugarNaLuta.Clear();

        // ---------- os cristais ----------

        private readonly List<SpriteRenderer> _cristais = new List<SpriteRenderer>();

        /// <summary>Os cristais no chão da sala, em unidades dela (vazio: nenhum).</summary>
        public void DefinirCristais(IReadOnlyList<CristalNaSala> cristais)
        {
            int quantos = cristais?.Count ?? 0;
            while (_cristais.Count < quantos)
            {
                var objeto = new GameObject("Cristal " + (_cristais.Count + 1));
                objeto.transform.SetParent(transform, false);
                var renderizador = objeto.AddComponent<SpriteRenderer>();
                PorNoPe(renderizador, EmojiDoSistema.Sprite("💠"), Lado * 0.6f);
                _cristais.Add(renderizador);
            }
            for (int i = 0; i < _cristais.Count; i++)
            {
                bool usado = i < quantos;
                if (_cristais[i].gameObject.activeSelf != usado) _cristais[i].gameObject.SetActive(usado);
                if (!usado) continue;
                var onde = PixelDaSala(cristais[i].X, cristais[i].Y);
                _cristais[i].transform.position = Mundo(onde.x, onde.y);
                _cristais[i].sortingOrder = (int)onde.y - 1;
            }
        }

        // ---------- os lacaios do parceiro ----------

        private readonly List<SpriteRenderer> _lacaiosDoParceiro = new List<SpriteRenderer>();
        private readonly List<string> _iconesDoParceiro = new List<string>();

        /// <summary>Os lacaios do parceiro, onde ele disse (unidades da sala) e com o ícone de cada um; vazio, nenhum.</summary>
        public void DefinirLacaiosDoParceiro(IReadOnlyList<(double X, double Y, string Icone)> lacaios)
        {
            int quantos = lacaios?.Count ?? 0;
            while (_lacaiosDoParceiro.Count < quantos)
            {
                var objeto = new GameObject("Lacaio do parceiro " + (_lacaiosDoParceiro.Count + 1));
                objeto.transform.SetParent(transform, false);
                _lacaiosDoParceiro.Add(objeto.AddComponent<SpriteRenderer>());
                _iconesDoParceiro.Add(null);
            }
            for (int i = 0; i < _lacaiosDoParceiro.Count; i++)
            {
                bool usado = i < quantos;
                if (_lacaiosDoParceiro[i].gameObject.activeSelf != usado) _lacaiosDoParceiro[i].gameObject.SetActive(usado);
                if (!usado) continue;
                var (x, y, icone) = lacaios[i];
                if (_iconesDoParceiro[i] != icone)
                {
                    _iconesDoParceiro[i] = icone;
                    PorNoPe(_lacaiosDoParceiro[i], EmojiDoSistema.Sprite(string.IsNullOrEmpty(icone) ? "💀" : icone), Lado * 1.1f);
                }
                var onde = PixelDaSala(x, y);
                _lacaiosDoParceiro[i].transform.position = Mundo(onde.x, onde.y);
                _lacaiosDoParceiro[i].sortingOrder = (int)onde.y;
            }
        }
    }
}
