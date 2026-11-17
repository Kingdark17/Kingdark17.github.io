using System;
using System.Collections.Generic;
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
    /// - Em sala cada um grava o próprio herói (<see cref="Partida.ParaGravar"/>).
    /// - A luta é em dupla (<see cref="Dupla"/>): o app de quem conduz cuida dos monstros e manda o estado deles
    ///   (tipo "e", o <see cref="Espelho"/>) umas dez vezes por segundo; o de quem acompanha testa os golpes no
    ///   próprio herói e devolve o dano que causou (tipo "d"). Cada um diz, junto da posição, se caiu.
    ///
    /// O que chega da rede é de outro jogador: cada campo é lido com o tipo conferido e os números com limite.
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        /// <summary>De quanto em quanto tempo cada um diz onde está (e quem conduz manda o espelho), em segundos.</summary>
        private const float IntervaloDaPosicao = 0.1f;
        /// <summary>O maior número que uma posição da rede pode ter (a cidade inteira cabe com muita folga).</summary>
        private const double LimiteDaPosicao = 200000;
        /// <summary>O maior dano que um pacote do parceiro pode trazer por golpe.</summary>
        private const double LimiteDoDano = 100000;

        private bool _emCoop;
        private long _versaoEnviada = -1;
        private string _salaEnviada;
        private float _proximaPosicao, _proximoEspelho;
        private string _posicaoEnviada;
        /// <summary>O herói do parceiro que está vestido no boneco (pra não vestir de novo a cada perfil igual).</summary>
        private string _parceiroVestido;
        /// <summary>O estado de quem conduz que chegou no meio de uma luta: espera ela acabar.</summary>
        private JObject _estadoPendente;

        // ---- a luta em dupla ----
        /// <summary>Onde o parceiro disse que está, e se caiu (null até ele dizer nesta sala).</summary>
        private ParceiroNaEntrada _parceiroNaLuta;
        private readonly List<DanoNoMonstro> _danosDeFora = new List<DanoNoMonstro>();
        private Espelho _espelhoRecebido;
        private bool _semParceiro;
        /// <summary>Qual monstro vai inteiro no próximo espelho (um por vez, em rodízio).</summary>
        private int _inteiroDaVez;
        private bool _lutando;
        /// <summary>O parceiro me reviveu no meio da luta: com quantos % eu levanto no próximo passo (0 = nada).</summary>
        private double _reviverPendente;
        /// <summary>O REVIVER dos botões de cima (null até a partida em sala abrir).</summary>
        private UnityEngine.UIElements.Button _botaoReviver;
        private bool _botaoReviverVisivel;
        /// <summary>O fantasma fica a esta distância do parceiro, em unidades da sala (uma casa).</summary>
        private const double FolgaDoFantasma = 1200;

        /// <summary>Chamado quando a partida acabou de carregar: se há sala, a partida entra nela.</summary>
        private void ComecarCoop()
        {
            _emCoop = false;
            if (!Rede.NaSala || _partida == null) return;
            _emCoop = true;
            _versaoEnviada = -1;
            _salaEnviada = null;
            _posicaoEnviada = null;
            _parceiroVestido = null;
            _estadoPendente = null;
            EsquecerADupla();
            _partida.EntrarEmSala(Rede.Conduzo);

            Rede.AoEstado += ChegouEstado;
            Rede.AoTempoReal += ChegouTempoReal;
            Rede.AoEntrar += EntreiNaSala;
            Rede.AoParceiroEntrar += ParceiroEntrou;
            Rede.AoParceiroSair += ParceiroSaiu;
            Rede.AoSala += MudouASala;

            if (_botaoReviver == null && _tela != null)
            {
                _botaoReviver = UnityEngine.UIElements.UQueryExtensions.Q<UnityEngine.UIElements.Button>(_tela, "botao-reviver");
                if (_botaoReviver != null) _botaoReviver.clicked += ReviverOParceiro;
            }
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
            if (_sala != null) _sala.Fantasma = false;
            MostrarBotaoReviver(false);
        }

        private void EsquecerADupla()
        {
            _parceiroNaLuta = null;
            _danosDeFora.Clear();
            _espelhoRecebido = null;
            _semParceiro = false;
            _inteiroDaVez = 0;
            _reviverPendente = 0;
        }

        /// <summary>Entrei (ou voltei depois de uma queda): o servidor não tem mais o meu perfil nem, talvez, o mapa.</summary>
        private void EntreiNaSala()
        {
            if (!_emCoop || _partida == null || !Rede.NaSala) return;
            _partida.EntrarEmSala(Rede.Conduzo);
            Rede.MandarPerfil(Coop.Perfil(_partida.Estado));
            if (Rede.Conduzo) AbrirAventura();
        }

        private void AbrirAventura()
        {
            _versaoEnviada = _partida.Versao;
            _salaEnviada = _partida.ChaveDaSala;
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
            _parceiroNaLuta = null;
            // Quem luta em dupla segue sozinho (e o fantasma, sem quem o levante, perde); fora da luta, ele se levanta.
            _semParceiro = true;
            _sala?.DefinirParceiro(null);
            _partida?.LevantarSozinho();
        }

        /// <summary>A sala mudou: o papel (quem conduz caiu e eu assumi) ou o perfil do parceiro.</summary>
        private void MudouASala()
        {
            if (!_emCoop || _partida == null) return;
            if (_partida.Conduzo != Rede.Conduzo)
            {
                _partida.EntrarEmSala(Rede.Conduzo);
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
            // No meio da luta o mundo é o dela: o estado espera ela acabar.
            if (_partida.Luta != null)
            {
                _estadoPendente = estado;
                return;
            }
            _estadoPendente = null;
            var antes = _partida.ChaveDaSala;
            _partida.AdotarRemoto(Coop.AplicarRemoto(_partida.Estado, estado));
            if (_partida == null) return;
            // Mudou de sala: a posição que eu tinha do parceiro era da outra.
            if (_partida.ChaveDaSala != antes)
            {
                _sala?.EsconderParceiro();
                _parceiroNaLuta = null;
            }
            // Quem conduz entrou numa sala de monstro: a luta daqui abre junto.
            _partida.LutarSeQuemConduzLuta();
        }

        private void ChegouTempoReal(int papel, JObject dados)
        {
            if (!_emCoop || _partida == null || papel != Rede.PapelDoParceiro) return;
            switch (Texto(dados["t"]))
            {
                case "oi":
                    if (Rede.Conduzo) AbrirAventura();
                    break;
                case "p":
                    // Só vale se ele está na mesma sala que eu (a chave dela vai junto).
                    if (Texto(dados["s"]) != ChaveDaSalaNaRede()) break;
                    if (!Numero(dados["x"], LimiteDaPosicao, out var x) || !Numero(dados["y"], LimiteDaPosicao, out var y)) break;
                    var olha = Texto(dados["f"]);
                    bool caido = dados["c"]?.Type == JTokenType.Boolean && (bool)dados["c"];
                    _parceiroNaLuta = new ParceiroNaEntrada { X = x, Y = y, Caido = caido ? true : (bool?)null };
                    _sala?.MoverParceiro(x, y, olha == "N" || olha == "E" || olha == "W" ? olha : "S", caido);
                    break;
                case "r":
                    // O parceiro gastou uma Poção de Reviver em mim.
                    if (!_partida.Fantasma || !Numero(dados["n"], 100, out var porcento) || porcento < 1) break;
                    if (_partida.Luta != null) _reviverPendente = Math.Truncate(porcento);
                    else _partida.Reviver(porcento);
                    break;
                case "d":
                    // O dano que o parceiro causou: só quem conduz o aplica.
                    if (!Rede.Conduzo || _partida.Luta == null || !(dados["d"] is JArray golpes)) break;
                    foreach (var g in golpes)
                    {
                        if (_danosDeFora.Count >= 64) break;
                        if (Numero(g["i"], 64, out var indice) && Numero(g["n"], LimiteDoDano, out var dano) && indice >= 0 && dano > 0)
                            _danosDeFora.Add(new DanoNoMonstro { Indice = Math.Truncate(indice), Dano = Math.Truncate(dano) });
                    }
                    break;
                case "e":
                    // O estado dos monstros de quem conduz: só quem acompanha o espelha.
                    if (Rede.Conduzo || !(dados["e"] is JObject espelho)) break;
                    try
                    {
                        var lido = JsSerializer.Read<Espelho>(espelho);
                        if (lido?.Monstros != null && lido.Tiros != null && lido.Monstros.Count <= 16 && lido.Tiros.Count <= 64) _espelhoRecebido = lido;
                    }
                    catch (Newtonsoft.Json.JsonException) { }
                    break;
            }
        }

        private static string Texto(JToken t) => t != null && t.Type == JTokenType.String ? (string)t : "";

        private static bool Numero(JToken t, double limite, out double valor)
        {
            valor = 0;
            if (t == null || (t.Type != JTokenType.Integer && t.Type != JTokenType.Float)) return false;
            valor = (double)t;
            return !double.IsNaN(valor) && Math.Abs(valor) <= limite;
        }

        /// <summary>A sala em que estou, pra o parceiro saber se a minha posição é da sala dele (a secreta conta como outra).</summary>
        private string ChaveDaSalaNaRede() => _partida.ChaveDaSala + (_partida.Secreta != null ? "#secreta" : "");

        // ---------- o que sai ----------

        /// <summary>Chamado a cada redesenho: quem conduz manda o estado quando ele mudou.</summary>
        private void SincronizarCoop()
        {
            if (!_emCoop || _partida == null || !Rede.NaSala || !Rede.Conduzo) return;
            if (_versaoEnviada == _partida.Versao) return;
            // Na luta o estado muda a cada golpe, e o que o parceiro precisa dela vai pelo espelho: o estado inteiro só
            // sai quando a sala muda (é o que abre a luta do outro) e quando a luta acaba.
            if (_partida.Luta != null && _salaEnviada == _partida.ChaveDaSala) return;
            _versaoEnviada = _partida.Versao;
            _salaEnviada = _partida.ChaveDaSala;
            Rede.MandarEstado(Coop.Instantaneo(_partida.Estado, Rede.Papel));
        }

        /// <summary>O que o parceiro mandou desde o último passo entra na entrada da luta (cada coisa uma vez).</summary>
        private void EntradaDaDupla(EntradaDaLuta entrada)
        {
            if (!_emCoop || _partida?.Luta?.Arena.Dupla == null) return;
            if (_semParceiro)
            {
                _semParceiro = false;
                entrada.SemParceiro = true;
                return;
            }
            if (_parceiroNaLuta != null) entrada.Parceiro = _parceiroNaLuta;
            if (_reviverPendente > 0)
            {
                entrada.Reviver = _reviverPendente;
                _reviverPendente = 0;
            }
            if (_danosDeFora.Count > 0)
            {
                entrada.DanoDeFora = new List<DanoNoMonstro>(_danosDeFora);
                _danosDeFora.Clear();
            }
            if (_espelhoRecebido != null)
            {
                entrada.Espelho = _espelhoRecebido;
                _espelhoRecebido = null;
            }
        }

        /// <summary>Chamado a cada quadro: diz onde o meu herói está e, na luta, manda o que é do meu papel.</summary>
        private void PassoDoCoop()
        {
            if (!_emCoop || _partida == null || _sala == null || !Rede.NaSala) return;
            var luta = _partida.Luta;

            // A luta acabou: quem conduz manda o último espelho (na vitória, todos caídos, pra ela chegar ao outro), e
            // quem acompanha adota o estado que ficou esperando.
            if (_lutando && luta == null)
            {
                if (Rede.Conduzo && _partida.UltimoFim == "vitoria" && _ultimoEspelho != null)
                {
                    foreach (var m in _ultimoEspelho.Monstros)
                    {
                        m.Hp = 0;
                        m.Monstro = null;
                    }
                    _ultimoEspelho.Tiros.Clear();
                    Rede.MandarTempoReal(new JObject { ["t"] = "e", ["e"] = JsSerializer.Write(_ultimoEspelho) });
                }
                _ultimoEspelho = null;
                EsquecerADupla();
                if (_estadoPendente != null) ChegouEstado(_estadoPendente, false);
                if (_partida == null) return;
                luta = _partida.Luta;
            }
            _lutando = luta != null;
            _sala.Fantasma = _partida.Fantasma;
            AtualizarBotaoReviver();
            if (!Rede.TemParceiro) return;

            if (luta != null)
            {
                // Quem acompanha: o dano que causou, assim que houver.
                if (!Rede.Conduzo && _partida.DanosPraMandar.Count > 0)
                {
                    var golpes = new JArray();
                    foreach (var d in _partida.DanosPraMandar) golpes.Add(new JObject { ["i"] = d.Indice, ["n"] = d.Dano });
                    _partida.DanosPraMandar.Clear();
                    Rede.MandarTempoReal(new JObject { ["t"] = "d", ["d"] = golpes });
                }
                // Quem conduz: o espelho dos monstros, com um deles inteiro por vez (é como a fúria e o escudo chegam).
                if (Rede.Conduzo && luta.Arena.Dupla != null && Time.unscaledTime >= _proximoEspelho)
                {
                    _proximoEspelho = Time.unscaledTime + IntervaloDaPosicao;
                    int quantos = luta.Arena.Monstros.Count;
                    var inteiros = quantos > 0 ? new List<double> { _inteiroDaVez++ % quantos } : null;
                    _ultimoEspelho = Arenas.EspelhoDaLuta(luta, inteiros);
                    Rede.MandarTempoReal(new JObject { ["t"] = "e", ["e"] = JsSerializer.Write(_ultimoEspelho) });
                }
            }

            if (Time.unscaledTime < _proximaPosicao) return;
            // Na luta o herói vai onde a arena diz; fora dela, onde a sala o pôs.
            var walker = luta != null ? luta.Arena.Heroi : _sala.Walker;
            if (walker == null) return;
            var sala = ChaveDaSalaNaRede();
            bool caido = luta?.Arena.Dupla?.Fantasma == true || (luta == null && _partida.Estado.Hero.Hp <= 0);
            var agora = sala + "|" + Math.Round(walker.X) + "|" + Math.Round(walker.Y) + "|" + walker.Facing + "|" + caido;
            // Parado, repete de vez em quando: é o que mostra o herói a quem acabou de chegar.
            bool parado = agora == _posicaoEnviada;
            if (parado && Time.unscaledTime < _proximaPosicao + 1f) return;
            _proximaPosicao = Time.unscaledTime + IntervaloDaPosicao;
            _posicaoEnviada = agora;
            var pacote = new JObject { ["t"] = "p", ["s"] = sala, ["x"] = Math.Round(walker.X), ["y"] = Math.Round(walker.Y), ["f"] = walker.Facing ?? "S" };
            if (caido) pacote["c"] = true;
            Rede.MandarTempoReal(pacote);
        }

        // ---------- o fantasma e a Poção de Reviver ----------

        /// <summary>Onde o parceiro está agora, se ele está na mesma sala (o "p" dele só vale na mesma sala).</summary>
        private ParceiroNaEntrada ParceiroAqui => _emCoop && Rede.TemParceiro ? _parceiroNaLuta : null;

        /// <summary>
        /// O fantasma segue o parceiro: o rumo até ele, enquanto estiver a mais de uma casa (o andar e a luta usam a
        /// mesma entrada). Sem o parceiro à vista, fica parado.
        /// </summary>
        private Vetor RumoDoFantasma()
        {
            var parceiro = ParceiroAqui;
            var eu = _partida?.Luta != null ? _partida.Luta.Arena.Heroi : _sala?.Walker;
            if (parceiro == null || eu == null) return new Vetor(0, 0);
            double dx = parceiro.X - eu.X;
            double dy = parceiro.Y - eu.Y;
            double distancia = Math.Sqrt(dx * dx + dy * dy);
            if (distancia <= FolgaDoFantasma) return new Vetor(0, 0);
            return new Vetor(dx / distancia, dy / distancia);
        }

        /// <summary>O REVIVER aparece quando o parceiro caiu na mesma sala, eu estou de pé e tenho a poção.</summary>
        private void AtualizarBotaoReviver()
        {
            var parceiro = ParceiroAqui;
            bool pode = parceiro?.Caido == true && !_partida.Fantasma && Duplas.PocaoDeReviver(_partida.Estado.Inventory) != null;
            MostrarBotaoReviver(pode);
        }

        private void MostrarBotaoReviver(bool mostrar)
        {
            if (_botaoReviver == null || mostrar == _botaoReviverVisivel) return;
            _botaoReviverVisivel = mostrar;
            _botaoReviver.style.display = mostrar ? UnityEngine.UIElements.DisplayStyle.Flex : UnityEngine.UIElements.DisplayStyle.None;
        }

        /// <summary>O REVIVER: gasta a poção daqui e manda a força dela pro parceiro, que se levanta no app dele.</summary>
        private void ReviverOParceiro()
        {
            if (!_emCoop || _partida == null || _partida.Fantasma || ParceiroAqui?.Caido != true) return;
            double porcento = _partida.GastarPocaoDeReviver();
            if (porcento <= 0) return;
            Rede.MandarTempoReal(new JObject { ["t"] = "r", ["n"] = porcento });
            Sons.Tocar("heal");
            // Até o "p" dele dizer que levantou, ele continua caído aqui: o botão some pra não gastar outra poção.
            _parceiroNaLuta = new ParceiroNaEntrada { X = _parceiroNaLuta.X, Y = _parceiroNaLuta.Y };
            MostrarBotaoReviver(false);
        }

        /// <summary>O último espelho que quem conduz mandou (pra fechar a luta do outro na vitória).</summary>
        private Espelho _ultimoEspelho;
    }
}
