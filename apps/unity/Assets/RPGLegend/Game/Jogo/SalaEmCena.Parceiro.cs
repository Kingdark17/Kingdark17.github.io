using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O parceiro do co-op na sala (2026-11-16, só no app): o mini boneco dele, com a raça e a roupa dele, onde ele
    /// disse que está. Só desenho: a posição vem pela rede umas dez vezes por segundo, e aqui ela é alisada pra ele
    /// não andar aos trancos. Não tem colisão nem encosta em nada — quem decide o que acontece na sala é quem conduz.
    /// </summary>
    public sealed partial class SalaEmCena
    {
        /// <summary>Quanto do caminho até o lugar novo ele anda por quadro.</summary>
        private const float AlisarOParceiro = 0.3f;

        private Seguidor _parceiro;
        private bool _temParceiro, _parceiroTemLugar;
        private Vector2 _alvoDoParceiro;
        /// <summary>O parceiro caiu: o boneco dele fica meio transparente e azulado, como um fantasma.</summary>
        private bool _parceiroFantasma;
        private static readonly Color CorDoFantasma = new Color(0.7f, 0.85f, 1f, 0.45f);
        /// <summary>O status de morto (2026-11-17, decisão do usuário): a caveira boiando em cima do parceiro caído.</summary>
        private SpriteRenderer _caveiraDoParceiro;
        private float _baseDaCaveira;

        /// <summary>Quem é o parceiro (pra vestir o boneco); null tira ele da sala.</summary>
        public void DefinirParceiro(Hero hero)
        {
            if (hero == null)
            {
                _temParceiro = false;
                _parceiroTemLugar = false;
                if (_parceiro != null) _parceiro.Raiz.gameObject.SetActive(false);
                return;
            }
            if (_parceiro == null)
            {
                _parceiro = NovoSeguidor(0);
                _parceiro.Raiz.name = "Parceiro";
                _parceiro.Raiz.gameObject.SetActive(false);
                // Filha da raiz, e não do lado de frente: não espelha nem some quando ele vira de costas.
                var caveira = new GameObject("Morto");
                caveira.transform.SetParent(_parceiro.Raiz, false);
                _caveiraDoParceiro = caveira.AddComponent<SpriteRenderer>();
                PorNoPe(_caveiraDoParceiro, EmojiDoSistema.Sprite("💀"), Lado * 0.5f);
                _baseDaCaveira = caveira.transform.localPosition.y;
                _caveiraDoParceiro.enabled = false;
            }
            VestirOParceiro(hero);
            _temParceiro = true;
        }

        /// <summary>Onde o parceiro está, nas unidades da sala atual (as do <see cref="Walker"/>), e pra onde olha.</summary>
        public void MoverParceiro(double x, double y, string facing, bool fantasma = false)
        {
            _parceiroFantasma = fantasma;
            if (!_temParceiro || _parceiro == null) return;
            float cx = (_emendada ? _origemX : 0f) + (float)x * _escala;
            float cy = (_emendada ? _origemY : 0f) + (float)(y + GameData.RoomWalkTable.HeroHalf) * _escala;
            _alvoDoParceiro = new Vector2(cx, cy);
            if (facing == "W") _parceiro.Espelhado = true;
            else if (facing == "E") _parceiro.Espelhado = false;
            _parceiro.Subindo = facing == "N";
            // A primeira posição, ou um salto grande (outra sala): aparece lá em vez de correr.
            if (!_parceiroTemLugar || (_alvoDoParceiro - _parceiro.Onde).magnitude > SaltoDoSeguidor)
            {
                _parceiro.Onde = _alvoDoParceiro;
                _parceiroTemLugar = true;
            }
        }

        /// <summary>O parceiro some até dizer onde está de novo (a sala mudou, e a posição antiga era da outra).</summary>
        public void EsconderParceiro()
        {
            _parceiroTemLugar = false;
            if (_parceiro != null) _parceiro.Raiz.gameObject.SetActive(false);
        }

        private void VestirOParceiro(Hero hero)
        {
            var frente = Paperdoll.Mini(hero, false);
            var costas = Paperdoll.Mini(hero, true);
            var emoji = string.IsNullOrEmpty(hero.RaceIcon) ? "🙂" : hero.RaceIcon;
            var chave = string.Join(",", frente) + "|" + string.Join(",", costas) + "|" + emoji;
            var s = _parceiro;
            if (chave == s.Chave) return;
            s.Chave = chave;
            foreach (var camada in s.Camadas) Destroy(camada.gameObject);
            s.Camadas.Clear();
            s.DeEmoji = frente.Count == 0;
            s.TemCostas = costas.Count > 0;
            if (s.DeEmoji)
            {
                PorNoPe(CamadaDoSeguidor(s, s.DeFrente, 0), EmojiDoSistema.Sprite(emoji), Lado * 1.25f);
                return;
            }
            for (int i = 0; i < frente.Count; i++) PorCamadaDoMini(CamadaDoSeguidor(s, s.DeFrente, i), frente[i]);
            for (int i = 0; i < costas.Count; i++) PorCamadaDoMini(CamadaDoSeguidor(s, s.DeCostas, i), costas[i]);
        }

        /// <summary>A cada quadro: leva o boneco do parceiro rumo ao lugar que ele disse.</summary>
        private void ColocarParceiro()
        {
            var s = _parceiro;
            if (s == null) return;
            bool visivel = _temParceiro && _parceiroTemLugar;
            if (s.Raiz.gameObject.activeSelf != visivel) s.Raiz.gameObject.SetActive(visivel);
            if (!visivel) return;

            var ate = _alvoDoParceiro - s.Onde;
            bool andou = ate.magnitude > 0.5f;
            s.Onde = andou ? s.Onde + ate * AlisarOParceiro : _alvoDoParceiro;
            if (andou) s.Fase++;
            float pulo = andou ? Mathf.Abs(Mathf.Sin(s.Fase * 0.35f)) * 3f : 0f;
            s.Raiz.position = Mundo(s.Onde.x, s.Onde.y - pulo);

            bool deCostas = s.Subindo && s.TemCostas;
            if (s.DeCostas.gameObject.activeSelf != deCostas)
            {
                s.DeCostas.gameObject.SetActive(deCostas);
                s.DeFrente.gameObject.SetActive(!deCostas);
            }
            float tamanho = s.DeEmoji ? 1f : _escala * (float)GameData.RoomWalkTable.TileUnits / Paperdoll.AlturaDoMini;
            s.DeFrente.localScale = new Vector3(s.Espelhado ? -tamanho : tamanho, tamanho, 1f);
            s.DeCostas.localScale = new Vector3(tamanho, tamanho, 1f);
            var cor = _parceiroFantasma ? CorDoFantasma : Color.white;
            foreach (var camada in s.Camadas)
            {
                camada.sortingOrder = (int)s.Onde.y;
                camada.color = cor;
            }
            ColocarCaveira(s);
        }

        /// <summary>A caveira acima da cabeça (o boneco de emoji é mais alto que o mini), boiando devagar.</summary>
        private void ColocarCaveira(Seguidor s)
        {
            if (_caveiraDoParceiro == null) return;
            if (_caveiraDoParceiro.enabled != _parceiroFantasma) _caveiraDoParceiro.enabled = _parceiroFantasma;
            if (!_parceiroFantasma) return;
            float cabeca = s.DeEmoji ? Lado * 1.3f : Lado * 1.05f;
            float boia = Mathf.Sin(Time.unscaledTime * 3f) * 2f;
            var t = _caveiraDoParceiro.transform;
            t.localPosition = new Vector3(t.localPosition.x, _baseDaCaveira + cabeca + boia, -0.05f);
            _caveiraDoParceiro.sortingOrder = (int)s.Onde.y + 1;
        }
    }
}
