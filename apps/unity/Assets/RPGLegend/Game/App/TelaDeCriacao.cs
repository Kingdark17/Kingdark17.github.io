using System;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using RPGLegend.Game.Jogo;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// Novo personagem (formulario-criacao.tsx do site): nome, raça e cabelo, com o boneco ao lado das escolhas. O
    /// herói nasce Aprendiz — a classe e o primeiro poder vêm do Treinamento de Guilda, na cidade. Quem monta o save é
    /// a engine (<see cref="Criacoes.MontarSaveInicial"/>); aqui só tem tela e estado.
    /// </summary>
    public sealed class TelaDeCriacao
    {
        private readonly VisualElement _tela, _balao, _racas, _secaoDoCabelo, _cabelos;
        private readonly Label _slot, _legenda, _erro;
        private readonly TextField _nome;
        private readonly Button _comecar;
        private Criacao _criacao = Criacoes.CriacaoVazia("");
        private int _slotAtual;
        private bool _salvando;

        public event Action AoVoltar;
        /// <summary>O personagem foi gravado na nuvem: quem abriu volta pra lista, relida.</summary>
        public event Action AoCriado;

        public TelaDeCriacao(VisualElement raiz)
        {
            _tela = raiz.Q("criacao");
            _balao = raiz.Q("balao-da-criacao");
            _racas = raiz.Q("racas-da-criacao");
            _secaoDoCabelo = raiz.Q("secao-do-cabelo");
            _cabelos = raiz.Q("cabelos-da-criacao");
            _slot = raiz.Q<Label>("slot-da-criacao");
            _legenda = raiz.Q<Label>("legenda-da-criacao");
            _erro = raiz.Q<Label>("erro-da-criacao");
            _nome = raiz.Q<TextField>("nome-da-criacao");
            _comecar = raiz.Q<Button>("botao-comecar");

            _nome.maxLength = 20;
            _nome.RegisterValueChangedCallback(e =>
            {
                _criacao.Nome = e.newValue ?? "";
                Erro(null);
            });
            _comecar.clicked += Comecar;
            raiz.Q<Button>("botao-voltar-criacao").clicked += () =>
            {
                if (!_salvando) AoVoltar?.Invoke();
            };
        }

        public bool Aberta => !_tela.ClassListContains("oculto");

        /// <summary>A tela limpa, pro slot escolhido na lista.</summary>
        public void Abrir(int slot)
        {
            _slotAtual = slot;
            _criacao = Criacoes.CriacaoVazia("");
            _salvando = false;
            _slot.text = "Slot " + slot;
            _nome.SetValueWithoutNotify("");
            _comecar.text = "COMEÇAR AVENTURA";
            _comecar.SetEnabled(true);
            Erro(null);
            Desenhar();
            _tela.RemoveFromClassList("oculto");
        }

        public void Fechar() => _tela.AddToClassList("oculto");

        private void Desenhar()
        {
            var raca = _criacao.Raca;
            _balao.Clear();
            _balao.Add(Paperdoll.Criar(Boneco(raca, _criacao.Cabelo), 192));
            _legenda.text = raca == null ? "Escolha uma raça para ver seu herói."
                : Paperdoll.TemCorpo(raca.Id) ? raca.Name : raca.Name + " ainda não tem corpo desenhado.";

            _racas.Clear();
            foreach (var opcao in Catalog.Races)
            {
                var esta = opcao;
                var carta = PecasDaTela.Bloco("carta", "carta-de-raca");
                carta.Add(Paperdoll.Criar(Boneco(opcao, _criacao.Cabelo), 128));
                carta.Add(PecasDaTela.Texto(opcao.Name, "nome-da-carta"));
                carta.Add(PecasDaTela.Texto(opcao.Desc, "meta-da-carta"));
                PecasDaTela.Clicavel(carta, raca?.Id == opcao.Id, () =>
                {
                    _criacao.Raca = esta;
                    Erro(null);
                    Desenhar();
                });
                _racas.Add(carta);
            }

            // Só pra quem leva cabelo desenhado: oferecer penteado que não vai aparecer seria mentir pro jogador.
            bool comCabelo = raca != null && Paperdoll.LevaCabelo(raca.Id);
            _secaoDoCabelo.EnableInClassList("escondida", !comCabelo);
            _cabelos.Clear();
            if (!comCabelo) return;
            foreach (var (id, nome) in Paperdoll.Penteados())
            {
                var este = id;
                var carta = PecasDaTela.Bloco("carta", "carta-de-cabelo");
                carta.Add(Paperdoll.AmostraDeCabelo(raca.Id, id));
                carta.Add(PecasDaTela.Texto(nome, "nome-da-carta"));
                PecasDaTela.Clicavel(carta, (_criacao.Cabelo ?? "curto") == id, () =>
                {
                    _criacao.Cabelo = este;
                    Desenhar();
                });
                _cabelos.Add(carta);
            }
        }

        /// <summary>O herói que o boneco precisa: só a raça e o cabelo (sem raça, o ❔ no balão).</summary>
        private static Hero Boneco(RaceDef raca, string cabelo) =>
            new Hero { RaceId = raca?.Id, RaceIcon = raca?.Icon ?? "❔", Hair = cabelo, Equip = new Equipment() };

        private async void Comecar()
        {
            if (_salvando) return;
            var falta = Criacoes.FaltaParaComecar(_criacao);
            if (falta != null)
            {
                Erro(falta == "nome" ? "Dê um nome ao seu herói." : "Escolha uma raça.");
                return;
            }

            _salvando = true;
            _comecar.text = "SALVANDO…";
            _comecar.SetEnabled(false);
            try
            {
                // Slot vazio: sem save anterior, a gravação não pede assinatura. Num slot ocupado o servidor recusaria.
                await RpgApi.GravarSave(Session.Token, _slotAtual, JogoJson.ParaSaveInicial(Criacoes.MontarSaveInicial(_criacao)), null);
                AoCriado?.Invoke();
            }
            catch (ApiError e)
            {
                Erro(e.Message);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                Erro("Erro inesperado ao salvar o personagem.");
            }
            finally
            {
                _salvando = false;
                _comecar.text = "COMEÇAR AVENTURA";
                _comecar.SetEnabled(true);
            }
        }

        private void Erro(string mensagem)
        {
            _erro.text = mensagem ?? "";
            _erro.EnableInClassList("visivel", !string.IsNullOrEmpty(mensagem));
        }
    }
}
