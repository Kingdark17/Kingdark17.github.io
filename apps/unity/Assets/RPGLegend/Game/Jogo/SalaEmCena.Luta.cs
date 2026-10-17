using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A luta em tempo real desenhada na sala (etapa 5): os monstros pelo emoji da espécie, com a barra de vida e o
    /// aviso de cada golpe no chão — um círculo no golpe de perto, a faixa da investida, a linha do tiro —, a guarda
    /// do defensivo tingida de azul, os companheiros e os tiros. Onde cada um está é a arena que diz
    /// (<see cref="Arenas"/>); aqui é só desenho, a cada quadro.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        private static readonly Color CorDoAviso = new Color(0.86f, 0.18f, 0.16f, 1f);
        private static readonly Color CorDaVida = new Color32(0xc0, 0x53, 0x2f, 255);
        private static readonly Color CorDaVidaAliada = new Color32(0x5f, 0xa8, 0x5a, 255);
        private static readonly Color FundoDaVida = new Color(0f, 0f, 0f, 0.6f);
        private static readonly Color CorDoTiroDoHeroi = new Color32(0xe8, 0xc6, 0x5a, 255);
        private static readonly Color CorDoTiroDoMonstro = new Color32(0xb0, 0x5c, 0xe0, 255);
        private static readonly Color CorDaGuarda = new Color(0.6f, 0.75f, 1f, 1f);

        private Transform _luta;
        private Sprite _circulo;
        private readonly List<FiguraDeLuta> _monstros = new List<FiguraDeLuta>();
        private readonly List<FiguraDeLuta> _companheiros = new List<FiguraDeLuta>();
        private readonly List<SpriteRenderer> _tiros = new List<SpriteRenderer>();
        private double _xAntes, _yAntes;

        /// <summary>Em luta: o herói vem da arena, e o andar e o encostar param.</summary>
        public bool EmLuta { get; private set; }

        /// <summary>Uma figura da luta: o corpo, a barra de vida e, no monstro, o aviso no chão.</summary>
        private sealed class FiguraDeLuta
        {
            public Transform Raiz;
            public SpriteRenderer Corpo;
            public SpriteRenderer Aviso;
            public SpriteRenderer FundoDaVida;
            public SpriteRenderer Vida;
            public string Emoji;
        }

        private void MontarLuta()
        {
            if (_luta != null) return;
            _luta = new GameObject("Luta").transform;
            _luta.SetParent(transform, false);

            // Um disco de borda macia, pro aviso no chão e pros tiros.
            const int lado = 64;
            var textura = new Texture2D(lado, lado, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear };
            for (int y = 0; y < lado; y++)
            {
                for (int x = 0; x < lado; x++)
                {
                    float dx = (x + 0.5f) / lado * 2f - 1f;
                    float dy = (y + 0.5f) / lado * 2f - 1f;
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    textura.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Clamp01((1f - d) * 8f)));
                }
            }
            textura.Apply();
            _circulo = Sprite.Create(textura, new Rect(0, 0, lado, lado), new Vector2(0.5f, 0.5f), lado);
        }

        /// <summary>Desenha a luta como ela está agora (chamado a cada quadro enquanto ela dura).</summary>
        public void MostrarLuta(LutaEmTempoReal luta)
        {
            MontarLuta();
            if (!EmLuta)
            {
                EmLuta = true;
                _luta.gameObject.SetActive(true);
                // Na sala da luta não há conteúdo nem extra: os monstros são as figuras da arena.
                for (int i = _desenho.childCount - 1; i >= 0; i--)
                {
                    var filho = _desenho.GetChild(i);
                    if (filho.GetComponent<SpriteRenderer>() == null && filho.name != "risco") filho.gameObject.SetActive(false);
                }
            }

            var arena = luta.Arena;
            var sala = Estados.CelulaAtual(luta.Estado) as DungeonCell;
            var instancias = sala?.Monsters ?? new List<MonsterInstance>();
            var dados = GameData.ArenaTable;

            for (int i = 0; i < arena.Monstros.Count; i++)
            {
                var m = arena.Monstros[i];
                var figura = Figura(_monstros, i, true);
                bool caido = m.Fase == "caido" || i >= instancias.Count;
                figura.Raiz.gameObject.SetActive(!caido);
                if (caido) continue;

                var visao = Monsters.View(instancias[i]);
                TrocarEmoji(figura, visao.Icon, visao.IsBoss ? 1.6f : 1.15f);
                Posicionar(figura, m.X, m.Y);
                bool olhaPraEsquerda = arena.Heroi.X < m.X;
                figura.Corpo.flipX = olhaPraEsquerda;

                var jeito = dados.JeitosDeLutar.TryGet(visao.Behavior ?? "", out var j) ? j : dados.JeitosDeLutar.Get("agressivo");
                bool guardando = jeito.Guarda == true && m.Fase == "descansando";
                figura.Corpo.color = m.Fase == "atordoado" || m.Fase == "hesitando" ? new Color(1f, 1f, 1f, 0.6f) : guardando ? CorDaGuarda : Color.white;
                // O aviso pisca mais forte perto de cair.
                if (m.Fase == "avisando") DesenharAviso(figura, m, jeito);
                else figura.Aviso.gameObject.SetActive(false);

                Encher(figura, instancias[i].Hp, instancias[i].MaxHp, CorDaVida, visao.IsBoss ? 1.4f : 1f);
            }
            for (int i = arena.Monstros.Count; i < _monstros.Count; i++) _monstros[i].Raiz.gameObject.SetActive(false);

            var equipe = (luta.Estado as EstadoNaMasmorra)?.Party ?? new List<Companion>();
            for (int k = 0; k < arena.Companheiros.Count; k++)
            {
                var c = arena.Companheiros[k];
                var figura = Figura(_companheiros, k, false);
                int indice = (int)c.Indice;
                var membro = indice < equipe.Count ? equipe[indice] : null;
                bool caido = membro == null || membro.Hp <= 0;
                figura.Raiz.gameObject.SetActive(!caido);
                if (caido) continue;
                TrocarEmoji(figura, string.IsNullOrEmpty(membro.ClassIcon) ? "🛡️" : membro.ClassIcon, 0.9f);
                Posicionar(figura, c.X, c.Y);
                Encher(figura, membro.Hp, membro.MaxHp, CorDaVidaAliada, 0.8f);
            }
            for (int k = arena.Companheiros.Count; k < _companheiros.Count; k++) _companheiros[k].Raiz.gameObject.SetActive(false);

            for (int t = 0; t < arena.Tiros.Count; t++)
            {
                var tiro = arena.Tiros[t];
                if (t >= _tiros.Count)
                {
                    var objeto = new GameObject("tiro");
                    objeto.transform.SetParent(_luta, false);
                    var r = objeto.AddComponent<SpriteRenderer>();
                    r.sprite = _circulo;
                    _tiros.Add(r);
                }
                var renderizador = _tiros[t];
                renderizador.gameObject.SetActive(true);
                bool doHeroi = tiro.De == "heroi";
                renderizador.color = doHeroi ? CorDoTiroDoHeroi : CorDoTiroDoMonstro;
                float tamanho = (float)dados.RaioDoTiro * _escala * (doHeroi ? 0.9f : 1.2f);
                renderizador.transform.localScale = new Vector3(tamanho, tamanho, 1f);
                float px = (float)tiro.X * _escala;
                float py = (float)tiro.Y * _escala;
                renderizador.transform.position = Mundo(px, py - Lado * 0.4f);
                renderizador.sortingOrder = (int)py + 1;
            }
            for (int t = arena.Tiros.Count; t < _tiros.Count; t++) _tiros[t].gameObject.SetActive(false);

            bool andou = arena.Heroi.X != _xAntes || arena.Heroi.Y != _yAntes;
            _xAntes = arena.Heroi.X;
            _yAntes = arena.Heroi.Y;
            _walker = arena.Heroi;
            ColocarHeroi(andou);
        }

        /// <summary>A luta acabou: some o que era dela, e o herói continua de onde parou (se a sala for a mesma).</summary>
        public void SairDaLuta(Walker heroi)
        {
            if (!EmLuta) return;
            EmLuta = false;
            if (_luta != null) _luta.gameObject.SetActive(false);
            _walker = heroi;
            _tocando = null;
            _sobra = 0;
            // A sala vencida tem os extras dela de volta: o próximo Mostrar redesenha tudo.
            _assinaturaDoDesenho = null;
        }

        private FiguraDeLuta Figura(List<FiguraDeLuta> lista, int indice, bool comAviso)
        {
            while (lista.Count <= indice)
            {
                var raiz = new GameObject(comAviso ? "monstro" : "companheiro").transform;
                raiz.SetParent(_luta, false);
                var figura = new FiguraDeLuta { Raiz = raiz };

                var corpo = new GameObject("Corpo");
                corpo.transform.SetParent(raiz, false);
                figura.Corpo = corpo.AddComponent<SpriteRenderer>();

                if (comAviso)
                {
                    var aviso = new GameObject("Aviso");
                    aviso.transform.SetParent(_luta, false);
                    figura.Aviso = aviso.AddComponent<SpriteRenderer>();
                    figura.Aviso.sortingOrder = OrdemDaRachadura + 10;
                    aviso.SetActive(false);
                }

                var fundo = new GameObject("Fundo da vida");
                fundo.transform.SetParent(raiz, false);
                figura.FundoDaVida = fundo.AddComponent<SpriteRenderer>();
                figura.FundoDaVida.sprite = _branco;
                figura.FundoDaVida.color = FundoDaVida;
                var vida = new GameObject("Vida");
                vida.transform.SetParent(raiz, false);
                figura.Vida = vida.AddComponent<SpriteRenderer>();
                figura.Vida.sprite = _branco;
                lista.Add(figura);
            }
            return lista[indice];
        }

        private void TrocarEmoji(FiguraDeLuta figura, string emoji, float altura)
        {
            if (figura.Emoji == emoji) return;
            figura.Emoji = emoji;
            PorNoPe(figura.Corpo, EmojiDoSistema.Sprite(emoji), Lado * altura);
        }

        /// <summary>Põe a figura com o pé no ponto da arena (o centro da base, como o herói).</summary>
        private void Posicionar(FiguraDeLuta figura, double x, double y)
        {
            float px = (float)x * _escala;
            float py = (float)(y + GameData.RoomWalkTable.HeroHalf) * _escala;
            figura.Raiz.position = Mundo(px, py);
            int ordem = (int)py;
            figura.Corpo.sortingOrder = ordem;
            figura.FundoDaVida.sortingOrder = ordem + 2;
            figura.Vida.sortingOrder = ordem + 3;
        }

        /// <summary>A barra de vida em cima da cabeça.</summary>
        private void Encher(FiguraDeLuta figura, double vida, double maximo, Color cor, float largura)
        {
            float parte = maximo > 0 ? Mathf.Clamp01((float)(vida / maximo)) : 0f;
            float total = Lado * 0.9f * largura;
            float alto = Lado * 1.25f * Mathf.Max(1f, largura);
            figura.FundoDaVida.transform.localPosition = new Vector3(0f, alto, 0f);
            figura.FundoDaVida.transform.localScale = new Vector3(total + 2f, 6f, 1f);
            figura.Vida.transform.localPosition = new Vector3(-total / 2f + total * parte / 2f, alto, 0f);
            figura.Vida.transform.localScale = new Vector3(total * parte, 4f, 1f);
            figura.Vida.color = cor;
        }

        /// <summary>O aviso no chão: o círculo do golpe de perto, a faixa da investida, a linha do tiro.</summary>
        private void DesenharAviso(FiguraDeLuta figura, MonstroNaArena m, JeitoDeLutar jeito)
        {
            var aviso = figura.Aviso;
            aviso.gameObject.SetActive(true);
            float progresso = jeito.Aviso > 0 ? 1f - Mathf.Clamp01((float)(m.Tempo / jeito.Aviso)) : 1f;
            float alfa = 0.18f + 0.32f * progresso;
            float cx = (float)m.X * _escala;
            float cy = (float)m.Y * _escala;
            var dados = GameData.ArenaTable;

            if (jeito.Golpe == "perto")
            {
                float diametro = (float)jeito.Alcance * 2f * _escala;
                aviso.sprite = _circulo;
                aviso.transform.position = Mundo(cx, cy);
                aviso.transform.rotation = Quaternion.identity;
                aviso.transform.localScale = new Vector3(diametro, diametro, 1f);
                aviso.color = new Color(CorDoAviso.r, CorDoAviso.g, CorDoAviso.b, alfa);
                return;
            }

            // Investida e tiro: uma faixa na direção travada, saindo do monstro.
            float comprimento = jeito.Golpe == "investida" ? (float)(jeito.Alcance + dados.Contato) * _escala : Lado * 4f;
            float largura = jeito.Golpe == "investida" ? (float)dados.Contato * 2f * _escala : Lado * 0.25f;
            var rumo = new Vector2((float)m.RumoX, (float)m.RumoY);
            if (rumo.sqrMagnitude < 1f) rumo = Vector2.down;
            rumo.Normalize();
            var meio = new Vector2(cx, cy) + rumo * comprimento / 2f;
            aviso.sprite = _branco;
            aviso.transform.position = Mundo(meio.x, meio.y);
            aviso.transform.rotation = Quaternion.Euler(0f, 0f, -Mathf.Atan2(rumo.y, rumo.x) * Mathf.Rad2Deg);
            aviso.transform.localScale = new Vector3(comprimento, largura, 1f);
            aviso.color = new Color(CorDoAviso.r, CorDoAviso.g, CorDoAviso.b, alfa * 0.8f);
        }
    }
}
