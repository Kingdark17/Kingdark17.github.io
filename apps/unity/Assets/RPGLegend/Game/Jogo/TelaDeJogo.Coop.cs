using System;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using RPGLegend.Game.App;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A partida em sala (o co-op do app, 2026-11-16): liga a <see cref="Partida"/> à <see cref="Rede"/>.
    ///
    /// - Quem conduz (papel 1) manda o estado a cada mudança dele; quem acompanha o adota (<see cref="Coop"/>).
    /// - Os dois andam livres na mesma sala (decisão do usuário, 2026-11-15); só quem conduz passa pelas portas e
    ///   encosta nas coisas, e leva o outro junto. Cada um diz onde está umas dez vezes por segundo
    ///   (<c>tempo-real</c>, tipo "p"), e o outro o desenha (<see cref="SalaEmCena.MoverParceiro"/>).
    /// - Quem acompanha, ao abrir a partida, pede o estado ("oi"), e quem conduz responde abrindo a aventura de novo.
    /// - Em sala a partida não grava na nuvem, como no site.
    ///
    /// O que chega da rede é de outro jogador: cada campo é lido com o tipo conferido e os números com limite.
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        /// <summary>De quanto em quanto tempo cada um diz onde está, em segundos.</summary>
        private const float IntervaloDaPosicao = 0.1f;
        /// <summary>O maior número que uma posição da rede pode ter (a cidade inteira cabe com muita folga).</summary>
        private const double LimiteDaPosicao = 200000;

        private bool _emCoop;
        private long _versaoEnviada = -1;
        private float _proximaPosicao;
        private string _posicaoEnviada;
        /// <summary>O herói do parceiro que está vestido no boneco (pra não vestir de novo a cada perfil igual).</summary>
        private string _parceiroVestido;

        /// <summary>Chamado quando a partida acabou de carregar: se há sala, a partida entra nela.</summary>
        private void ComecarCoop()
        {
            _emCoop = false;
            if (!Rede.NaSala || _partida == null) return;
            _emCoop = true;
            _versaoEnviada = -1;
            _posicaoEnviada = null;
            _parceiroVestido = null;
            _partida.EmCoop = true;
            _partida.Conduzo = Rede.Conduzo;

            Rede.AoEstado += ChegouEstado;
            Rede.AoTempoReal += ChegouTempoReal;
            Rede.AoEntrar += EntreiNaSala;
            Rede.AoParceiroEntrar += ParceiroEntrou;
            Rede.AoParceiroSair += ParceiroSaiu;
            Rede.AoSala += MudouASala;

            EntreiNaSala();
            // Quem acompanha e chegou depois: o estado que a sala já tinha, e o pedido de um novo.
            if (!Rede.Conduzo)
            {
                if (Rede.EstadoDaSala != null) ChegouEstado(Rede.EstadoDaSala, false);
                Rede.MandarTempoReal(new JObject { ["t"] = "oi" });
            }
            VestirParceiro();
        }

        /// <summary>Chamado ao fechar a partida: solta a rede (quem sai da sala é o fluxo do app).</summary>
        private void AcabarCoop()
        {
            if (!_emCoop) return;
            _emCoop = false;
            Rede.AoEstado -= ChegouEstado;
            Rede.AoTempoReal -= ChegouTempoReal;
            Rede.AoEntrar -= EntreiNaSala;
            Rede.AoParceiroEntrar -= ParceiroEntrou;
            Rede.AoParceiroSair -= ParceiroSaiu;
            Rede.AoSala -= MudouASala;
            _sala?.DefinirParceiro(null);
        }

        /// <summary>Entrei (ou voltei depois de uma queda): o servidor não tem mais o meu perfil nem, talvez, o mapa.</summary>
        private void EntreiNaSala()
        {
            if (!_emCoop || _partida == null || !Rede.NaSala) return;
            _partida.Conduzo = Rede.Conduzo;
            Rede.MandarPerfil(Coop.Perfil(_partida.Estado));
            if (Rede.Conduzo) AbrirAventura();
        }

        private void AbrirAventura()
        {
            _versaoEnviada = _partida.Versao;
            Rede.AbrirAventura(Coop.Instantaneo(_partida.Estado, Rede.Papel));
        }

        private void ParceiroEntrou(string nome)
        {
            if (!_emCoop || _partida == null) return;
            if (Rede.Conduzo) AbrirAventura();
        }

        private void ParceiroSaiu()
        {
            if (!_emCoop) return;
            _parceiroVestido = null;
            _sala?.DefinirParceiro(null);
        }

        /// <summary>A sala mudou: o papel (quem conduz caiu e eu assumi) ou o perfil do parceiro.</summary>
        private void MudouASala()
        {
            if (!_emCoop || _partida == null) return;
            if (_partida.Conduzo != Rede.Conduzo)
            {
                _partida.Conduzo = Rede.Conduzo;
                // Quem assume a condução passa a ser a fonte do mapa.
                if (Rede.Conduzo && Rede.NaSala) AbrirAventura();
            }
            VestirParceiro();
        }

        /// <summary>Veste o boneco do parceiro com o herói que o servidor guarda dele.</summary>
        private void VestirParceiro()
        {
            if (_sala == null || !Rede.NaSala) return;
            var perfil = Rede.Perfil(Rede.PapelDoParceiro);
            if (!(perfil?["hero"] is JObject heroi)) return;
            var texto = heroi.ToString(Newtonsoft.Json.Formatting.None);
            if (texto == _parceiroVestido) return;
            try
            {
                var hero = JsSerializer.Read<Hero>(heroi);
                if (hero == null) return;
                _parceiroVestido = texto;
                _sala.DefinirParceiro(hero);
            }
            catch (Newtonsoft.Json.JsonException) { }
        }

        // ---------- o que chega ----------

        private void ChegouEstado(JObject estado, bool eco)
        {
            // O eco é o meu próprio estado de volta; e quem conduz não adota o mapa de ninguém.
            if (!_emCoop || _partida == null || eco || Rede.Conduzo) return;
            var antes = _partida.ChaveDaSala;
            _partida.AdotarRemoto(Coop.AplicarRemoto(_partida.Estado, estado));
            // Mudou de sala: a posição que eu tinha do parceiro era da outra.
            if (_partida != null && _partida.ChaveDaSala != antes) _sala?.EsconderParceiro();
        }

        private void ChegouTempoReal(int papel, JObject dados)
        {
            if (!_emCoop || _partida == null || papel != Rede.PapelDoParceiro) return;
            var tipo = dados["t"] != null && dados["t"].Type == JTokenType.String ? (string)dados["t"] : "";
            switch (tipo)
            {
                case "oi":
                    if (Rede.Conduzo) AbrirAventura();
                    break;
                case "p":
                    // Só vale se ele está na mesma sala que eu (a chave dela vai junto).
                    if (dados["s"] == null || dados["s"].Type != JTokenType.String || (string)dados["s"] != ChaveDaSalaNaRede()) break;
                    if (!Numero(dados["x"], out var x) || !Numero(dados["y"], out var y)) break;
                    var olha = dados["f"] != null && dados["f"].Type == JTokenType.String ? (string)dados["f"] : "S";
                    _sala?.MoverParceiro(x, y, olha == "N" || olha == "E" || olha == "W" ? olha : "S");
                    break;
            }
        }

        private static bool Numero(JToken t, out double valor)
        {
            valor = 0;
            if (t == null || (t.Type != JTokenType.Integer && t.Type != JTokenType.Float)) return false;
            valor = (double)t;
            return !double.IsNaN(valor) && Math.Abs(valor) <= LimiteDaPosicao;
        }

        /// <summary>A sala em que estou, pra o parceiro saber se a minha posição é da sala dele (a secreta conta como outra).</summary>
        private string ChaveDaSalaNaRede() => _partida.ChaveDaSala + (_partida.Secreta != null ? "#secreta" : "");

        // ---------- o que sai ----------

        /// <summary>Chamado a cada redesenho: quem conduz manda o estado quando ele mudou.</summary>
        private void SincronizarCoop()
        {
            if (!_emCoop || _partida == null || !Rede.NaSala || !Rede.Conduzo) return;
            if (_versaoEnviada == _partida.Versao) return;
            _versaoEnviada = _partida.Versao;
            Rede.MandarEstado(Coop.Instantaneo(_partida.Estado, Rede.Papel));
        }

        /// <summary>Chamado a cada quadro: diz onde o meu herói está, se ele saiu do lugar.</summary>
        private void PassoDoCoop()
        {
            if (!_emCoop || _partida == null || _sala == null || !Rede.NaSala || !Rede.TemParceiro) return;
            if (Time.unscaledTime < _proximaPosicao) return;
            var walker = _sala.Walker;
            if (walker == null) return;
            var sala = ChaveDaSalaNaRede();
            var agora = sala + "|" + Math.Round(walker.X) + "|" + Math.Round(walker.Y) + "|" + walker.Facing;
            // Parado, repete de vez em quando: é o que mostra o herói a quem acabou de chegar.
            bool parado = agora == _posicaoEnviada;
            if (parado && Time.unscaledTime < _proximaPosicao + 1f) return;
            _proximaPosicao = Time.unscaledTime + IntervaloDaPosicao;
            _posicaoEnviada = agora;
            Rede.MandarTempoReal(new JObject { ["t"] = "p", ["s"] = sala, ["x"] = Math.Round(walker.X), ["y"] = Math.Round(walker.Y), ["f"] = walker.Facing ?? "S" });
        }
    }
}
