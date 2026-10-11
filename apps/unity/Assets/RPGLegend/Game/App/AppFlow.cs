using System;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// O roteiro do app, da porta ao menu:
    /// 1. a câmera se aproxima da porta trancada, saindo do preto;
    /// 2. quem já tem sessão salva vê "Toque para entrar"; quem não tem vê o cartão de entrada (entrar ou criar
    ///    conta, como no site);
    /// 3. com a sessão, o cadeado cai, a porta abre e a câmera mergulha na luz até o menu;
    /// 4. o menu leva à lista de personagens (lida da nuvem, só leitura); sair da conta volta à porta trancada.
    /// </summary>
    public sealed class AppFlow : MonoBehaviour
    {
        [SerializeField] private UIDocument documento;
        [SerializeField] private DoorScene cena;

        private static readonly Color Preto = Color.black;
        private static readonly Color Ouro = new Color(1f, 0.93f, 0.7f);

        private enum Estado { Chegando, Porta, Entrando, Menu, Personagens, Trocando }

        private AppScreens _telas;
        private Estado _estado = Estado.Chegando;
        private bool _tocou;

        private async void Start()
        {
            try
            {
                Application.targetFrameRate = 60;
                _telas = new AppScreens(documento.rootVisualElement);
                _telas.AoEnviar += Enviar;
                _telas.AoEsqueci += () => Application.OpenURL(ApiConfig.Site + "/esqueci-senha");
                _telas.AoTocar += () => _tocou = true;
                _telas.AoJogar += Jogar;
                _telas.AoVoltar += Voltar;
                _telas.AoSair += Sair;
                _telas.AoEmBreve += _telas.Aviso;

                // 1. Do preto para o castelo inteiro, um instante parado, e então a caminhada até a porta.
                _telas.Veu(Preto, 1f);
                cena.PassoAproximar(0f);
                await Tween.Durante(0.9f, t => _telas.Veu(Preto, 1f - t), destroyCancellationToken);
                await Awaitable.WaitForSecondsAsync(0.5f, destroyCancellationToken);
                await Tween.Durante(3.2f, cena.PassoAproximar, destroyCancellationToken);

                // 2. Sessão salva ou cartão de entrada.
                if (Session.Tem) await ConferirSessaoSalva();
                else await MostrarEntrada(null);
            }
            catch (OperationCanceledException) { }
            catch (Exception e) { Debug.LogException(e); }
        }

        private void Update()
        {
            // Botão "voltar" do Android (no Input System ele chega como Esc).
            if (Keyboard.current != null && Keyboard.current.escapeKey.wasPressedThisFrame && _estado == Estado.Personagens) Voltar();
        }

        // ---------- porta ----------

        private async Awaitable ConferirSessaoSalva()
        {
            while (true)
            {
                try
                {
                    Session.AtualizarUsuario(await RpgApi.Eu(Session.Token));
                    break;
                }
                catch (ApiError e) when (e.SessaoInvalida)
                {
                    Session.Limpar();
                    await MostrarEntrada("Sua sessão expirou. Entre de novo.");
                    return;
                }
                catch (ApiError e)
                {
                    await EsperarToque(e.Message + " Toque para tentar de novo.");
                }
            }
            await EsperarToque("Toque para entrar");
            await Destrancar();
        }

        private async Awaitable EsperarToque(string texto)
        {
            _estado = Estado.Porta;
            _tocou = false;
            _telas.MostrarToque(true, texto);
            while (!_tocou) await Awaitable.NextFrameAsync(destroyCancellationToken);
            _telas.MostrarToque(false);
        }

        private async Awaitable MostrarEntrada(string erro)
        {
            _estado = Estado.Porta;
            _telas.ModoCadastro = false;
            _telas.MostrarCartao(true);
            _telas.Erro(erro);
            await cena.AbrirEspacoParaOCartao(true);
        }

        private async void Enviar(string usuario, string email, string senha, bool cadastro)
        {
            if (_estado != Estado.Porta) return;
            if (usuario.Length == 0 || senha.Length == 0)
            {
                _telas.Erro("Preencha o usuário e a senha.");
                return;
            }
            if (cadastro && email.Length == 0)
            {
                _telas.Erro("Preencha o e-mail.");
                return;
            }
            _telas.Erro(null);
            _telas.Ocupado(true);
            try
            {
                var sessao = cadastro ? await RpgApi.Cadastrar(usuario, email, senha) : await RpgApi.Entrar(usuario, senha);
                Session.Salvar(sessao);
                _telas.LimparSenha();
                _telas.Ocupado(false);
                _telas.MostrarCartao(false);
                await cena.AbrirEspacoParaOCartao(false);
                await Destrancar();
            }
            catch (ApiError e)
            {
                _telas.Erro(e.Message);
                _telas.Ocupado(false);
            }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Debug.LogException(e);
                _telas.Erro("Erro inesperado. Tente de novo.");
                _telas.Ocupado(false);
            }
        }

        /// <summary>O cadeado cai, a porta abre, a câmera mergulha na luz e o menu aparece.</summary>
        private async Awaitable Destrancar()
        {
            _estado = Estado.Entrando;
            await cena.Destrancar();
            await cena.Abrir();
            cena.ComecarEntrada();
            await Tween.Durante(0.9f, t =>
            {
                cena.PassoEntrar(t);
                _telas.Veu(Ouro, Mathf.Clamp01((t - 0.35f) / 0.65f));
            }, destroyCancellationToken);

            _telas.Ola(Session.Username);
            _telas.MostrarMenu(true);
            cena.Mostrar(false);
            await Tween.Durante(0.6f, t => _telas.Veu(Ouro, 1f - t), destroyCancellationToken);
            _estado = Estado.Menu;
        }

        // ---------- menu e personagens ----------

        private async void Jogar()
        {
            if (_estado != Estado.Menu) return;
            try
            {
                await Trocar(() =>
                {
                    _telas.MostrarMenu(false);
                    _telas.MostrarPersonagens(true);
                    _telas.PersonagensCarregando();
                });
                _estado = Estado.Personagens;
                await CarregarPersonagens();
            }
            catch (OperationCanceledException) { }
            catch (Exception e) { Debug.LogException(e); }
        }

        private async Awaitable CarregarPersonagens()
        {
            try
            {
                _telas.PersonagensLista(await RpgApi.Personagens(Session.Token));
            }
            catch (ApiError e) when (e.SessaoInvalida)
            {
                Session.Limpar();
                await VoltarParaAPorta("Sua sessão expirou. Entre de novo.");
            }
            catch (ApiError e)
            {
                _telas.PersonagensErro(e.Message);
            }
        }

        private async void Voltar()
        {
            if (_estado != Estado.Personagens) return;
            try
            {
                await Trocar(() =>
                {
                    _telas.MostrarPersonagens(false);
                    _telas.MostrarMenu(true);
                });
                _estado = Estado.Menu;
            }
            catch (OperationCanceledException) { }
            catch (Exception e) { Debug.LogException(e); }
        }

        private async void Sair()
        {
            if (_estado != Estado.Menu) return;
            try
            {
                var token = Session.Token;
                Session.Limpar();
                try { await RpgApi.Sair(token); }
                catch (ApiError) { /* a sessão já saiu do aparelho; o servidor a descarta quando vencer */ }
                await VoltarParaAPorta(null);
            }
            catch (OperationCanceledException) { }
            catch (Exception e) { Debug.LogException(e); }
        }

        private async Awaitable VoltarParaAPorta(string erro)
        {
            await Trocar(() =>
            {
                _telas.MostrarMenu(false);
                _telas.MostrarPersonagens(false);
                cena.Mostrar(true);
                cena.Resetar();
            });
            await MostrarEntrada(erro);
        }

        /// <summary>Escurece, troca o que aparece e clareia de novo.</summary>
        private async Awaitable Trocar(Action troca)
        {
            var anterior = _estado;
            _estado = Estado.Trocando;
            await Tween.Durante(0.22f, t => _telas.Veu(Preto, t), destroyCancellationToken);
            troca();
            await Tween.Durante(0.3f, t => _telas.Veu(Preto, 1f - t), destroyCancellationToken);
            if (_estado == Estado.Trocando) _estado = anterior;
        }
    }
}
