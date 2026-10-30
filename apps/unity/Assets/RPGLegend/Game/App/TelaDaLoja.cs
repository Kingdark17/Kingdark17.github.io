using System;
using System.Collections.Generic;
using System.Globalization;
using RPGLegend.Game.Jogo;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// A loja (painel-loja.tsx do site): pets, molduras e cores de nome. Duas regras do servidor moldam a tela:
    /// a compra sai do ouro de um personagem, então ela pede o personagem antes (sem nenhum salvo na nuvem, não há de
    /// onde tirar ouro); e o que a conta já tem vem no mesmo catálogo, e decide entre "Comprar" e "já é seu".
    ///
    /// Como no site, a tela não mostra o ouro do personagem: a lista de personagens da API não traz ouro. E escolher
    /// qual pet, moldura ou cor usar continua no site, em Conta e perfil, que o app ainda não tem.
    /// </summary>
    public sealed class TelaDaLoja
    {
        /// <summary>As prateleiras, na ordem do site.</summary>
        private static readonly (string Tipo, string Nome)[] Prateleiras = { ("pet", "Pets"), ("frame", "Molduras"), ("color", "Cores de nome") };

        private readonly VisualElement _tela;
        private readonly ScrollView _corpo;
        private readonly Label _estado;
        private CatalogoDaLoja _catalogo;
        private List<CharacterSummary> _personagens = new List<CharacterSummary>();
        private int _slot;
        private string _recado, _erro;
        private bool _ocupado;
        /// <summary>Muda a cada abertura: a resposta que chega depois de a tela fechar (ou reabrir) não desenha nada.</summary>
        private int _vez;

        public event Action AoVoltar;
        /// <summary>O token venceu: quem abriu a loja leva de volta à porta.</summary>
        public event Action AoSessaoExpirada;

        public TelaDaLoja(VisualElement raiz)
        {
            _tela = raiz.Q("loja");
            _corpo = raiz.Q<ScrollView>("corpo-da-loja");
            _estado = raiz.Q<Label>("estado-da-loja");
            raiz.Q<Button>("botao-voltar-loja").clicked += () => AoVoltar?.Invoke();
        }

        public void Abrir()
        {
            int esta = ++_vez;
            _catalogo = null;
            _personagens = new List<CharacterSummary>();
            _slot = 0;
            _recado = null;
            _erro = null;
            _ocupado = false;
            _corpo.Clear();
            _corpo.scrollOffset = Vector2.zero;
            Estado("Carregando a loja…", false);
            _tela.RemoveFromClassList("oculto");
            Carregar(esta);
        }

        public void Fechar()
        {
            _vez++;
            _tela.AddToClassList("oculto");
        }

        private async void Carregar(int esta)
        {
            try
            {
                var catalogo = await RpgApi.Catalogo(Session.Token);
                if (esta != _vez) return;
                _catalogo = catalogo;
                // Sem a lista, a loja abre do mesmo jeito: só não deixa comprar (como no site).
                try
                {
                    var lista = await RpgApi.Personagens(Session.Token);
                    if (esta != _vez) return;
                    _personagens = lista.Characters;
                    _slot = _personagens.Count > 0 ? _personagens[0].Slot : 0;
                }
                catch (ApiError e) when (!e.SessaoInvalida) { }
                Estado(null, false);
                Desenhar();
            }
            catch (ApiError e) when (e.SessaoInvalida)
            {
                if (esta == _vez) AoSessaoExpirada?.Invoke();
            }
            catch (ApiError e)
            {
                if (esta == _vez) Estado(e.Message, true);
            }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (esta == _vez) Estado("Não foi possível abrir a loja.", true);
            }
        }

        private void Desenhar()
        {
            _corpo.Clear();
            if (_personagens.Count == 0)
            {
                _corpo.Add(PecasDaTela.Texto("Crie um personagem e salve na nuvem antes de comprar — o ouro sai dele, não da conta.", "aviso-da-loja"));
            }
            else
            {
                _corpo.Add(PecasDaTela.Secao("Comprar com o ouro de qual personagem?"));
                var grade = PecasDaTela.Grade();
                foreach (var personagem in _personagens)
                {
                    var este = personagem;
                    var nome = string.IsNullOrEmpty(este.Name) ? "Sem nome" : este.Name;
                    var carta = PecasDaTela.CartaDeEscolha(string.IsNullOrEmpty(este.ClassIcon) ? "🧑" : este.ClassIcon, nome,
                        "Slot " + este.Slot + " · nível " + este.Level, _slot == este.Slot, () =>
                        {
                            if (_ocupado) return;
                            _slot = este.Slot;
                            Desenhar();
                        });
                    carta.AddToClassList("carta-de-personagem");
                    grade.Add(carta);
                }
                _corpo.Add(grade);
                var escolhido = _personagens.Find(p => p.Slot == _slot);
                if (escolhido != null) _corpo.Add(PecasDaTela.Texto("Comprando com o ouro de " + (string.IsNullOrEmpty(escolhido.Name) ? "Sem nome" : escolhido.Name) + ".", "legenda-da-loja"));
            }

            if (!string.IsNullOrEmpty(_recado)) _corpo.Add(PecasDaTela.Texto(_recado, "aviso-da-loja"));
            if (!string.IsNullOrEmpty(_erro)) _corpo.Add(PecasDaTela.Texto(_erro, "erro-da-loja"));

            foreach (var (tipo, nomeDaPrateleira) in Prateleiras)
            {
                var itens = _catalogo.Itens.FindAll(i => i.Tipo == tipo);
                if (itens.Count == 0) continue;
                _corpo.Add(PecasDaTela.Secao(nomeDaPrateleira));
                var vitrine = PecasDaTela.Grade();
                foreach (var item in itens) vitrine.Add(Cosmetico(item));
                _corpo.Add(vitrine);
            }
        }

        private VisualElement Cosmetico(ItemDeCosmetico item)
        {
            bool jaTem = _catalogo.Possui(item);
            var carta = PecasDaTela.Bloco("carta", "carta-da-loja");
            carta.Add(PecasDaTela.Texto(item.Icone, "icone-da-carta"));
            carta.Add(PecasDaTela.Texto(item.Nome, "nome-da-carta"));
            carta.Add(PecasDaTela.Texto(item.SoDoAdm ? "exclusivo do ADM" : Preco(item) + " ouro", "meta-da-carta"));
            var este = item;
            carta.Add(PecasDaTela.Botao(jaTem ? "já é seu" : "Comprar", () => Comprar(este), false, !_ocupado && !jaTem && _personagens.Count > 0));
            return carta;
        }

        private static string Preco(ItemDeCosmetico item) => item.Preco.ToString(CultureInfo.InvariantCulture);

        private async void Comprar(ItemDeCosmetico item)
        {
            if (_ocupado) return;
            if (_slot == 0)
            {
                _erro = "Escolha um personagem antes de comprar.";
                Desenhar();
                return;
            }
            int esta = _vez;
            _ocupado = true;
            _erro = null;
            _recado = null;
            Desenhar();
            try
            {
                await RpgApi.ComprarCosmetico(Session.Token, item.Id, _slot);
                // O que a conta tem mudou no servidor: reler é o que faz o botão virar "já é seu" sem adivinhar.
                var catalogo = await RpgApi.Catalogo(Session.Token);
                if (esta != _vez) return;
                _catalogo = catalogo;
                _recado = item.Nome + " desbloqueado por " + Preco(item) + " de ouro. Pra usar, escolha no site, em Conta e perfil.";
            }
            catch (ApiError e) when (e.SessaoInvalida)
            {
                if (esta == _vez) AoSessaoExpirada?.Invoke();
                return;
            }
            catch (ApiError e)
            {
                _erro = e.Message;
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                _erro = "Erro inesperado.";
            }
            finally
            {
                if (esta == _vez) _ocupado = false;
            }
            if (esta == _vez) Desenhar();
        }

        private void Estado(string texto, bool falha)
        {
            _estado.text = texto ?? "";
            _estado.EnableInClassList("visivel", !string.IsNullOrEmpty(texto));
            _estado.EnableInClassList("falha", falha);
        }
    }
}
