using System;
using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O Necromante fora da luta (rodada 4b do doc do Breno, só no app): os cristais dos inimigos que caíram ficam no
    /// chão da sala, e encostar num abre a troca de um lacaio por aquele inimigo; e a janela LACAIOS (a tecla K no PC,
    /// o botão de cima no celular) muda o estado de cada lacaio: a retaguarda ou o ofensivo.
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        /// <summary>A distância (em unidades da sala) em que encostar num cristal abre a troca.</summary>
        private const double PertoDoCristal = 600;

        private Button _botaoLacaios;
        private bool _botaoLacaiosVisivel;
        /// <summary>O cristal em que o herói está encostado agora (a troca abre uma vez por encostada); -1, nenhum.</summary>
        private int _cristalPerto = -1;

        /// <summary>A cada quadro: os cristais no chão, a troca ao encostar, o botão LACAIOS e a tecla K fora da luta.</summary>
        private void AtualizarNecromante()
        {
            if (_partida == null) return;
            var cristais = _partida.CristaisAqui;
            _sala?.DefinirCristais(cristais);

            var hero = _partida.Estado.Hero;
            bool necro = Catalog.IdDaClasse(hero.ClassId, hero.ClassName) == "necromante";
            bool temLacaio = false;
            foreach (var membro in _partida.Estado.Party ?? new List<Companion>())
                if (membro.Invocado == true && membro.Hp > 0) temLacaio = true;
            MostrarBotaoLacaios(necro && temLacaio && _partida.Luta == null);

            if (!Andando || _partida.Luta != null)
            {
                return;
            }
            var teclado = Keyboard.current;
            if (necro && temLacaio && teclado != null && !DigitandoNoChat && teclado.kKey.wasPressedThisFrame)
            {
                AbrirLacaios();
                return;
            }

            // Encostou num cristal: a troca abre (uma vez, até ele sair de perto).
            var walker = _sala?.Walker;
            int perto = -1;
            if (walker != null)
            {
                for (int i = 0; i < cristais.Count; i++)
                {
                    double dx = cristais[i].X - walker.X, dy = cristais[i].Y - walker.Y;
                    if (dx * dx + dy * dy <= PertoDoCristal * PertoDoCristal)
                    {
                        perto = i;
                        break;
                    }
                }
            }
            if (perto >= 0 && perto != _cristalPerto) AbrirCristal(perto);
            _cristalPerto = perto;
        }

        private void MostrarBotaoLacaios(bool mostrar)
        {
            if (_botaoLacaios == null && _tela != null)
            {
                var vizinho = _tela.Q<Button>("botao-chat");
                if (vizinho?.parent == null) return;
                _botaoLacaios = new Button(AbrirLacaios) { text = "LACAIOS" };
                _botaoLacaios.AddToClassList("botao");
                _botaoLacaios.AddToClassList("botao-pequeno");
                _botaoLacaios.style.display = DisplayStyle.None;
                vizinho.parent.Add(_botaoLacaios);
            }
            if (_botaoLacaios == null || mostrar == _botaoLacaiosVisivel) return;
            _botaoLacaiosVisivel = mostrar;
            _botaoLacaios.style.display = mostrar ? DisplayStyle.Flex : DisplayStyle.None;
        }

        /// <summary>A troca do cristal: escolher um lacaio de pé pra virar aquele inimigo (o do chefe avisa a regra).</summary>
        private void AbrirCristal(int indice)
        {
            if (_partida == null || _janela != null) return;
            var cristais = _partida.CristaisAqui;
            if (indice < 0 || indice >= cristais.Count) return;
            var cristal = cristais[indice];
            var especie = MonsterCatalog.SpeciesById(cristal.Especie);
            string nome = especie?.Name ?? cristal.Especie;
            _janela = "cristal";
            Janela("💠 Cristal de " + nome, conteudo =>
            {
                conteudo.Add(Paragrafo("A alma de " + (especie?.Icon ?? "") + " " + nome + " está presa no cristal. Escolha um lacaio pra virar ele: a vida e o dano continuam os mesmos, e ele passa a lutar como " + nome + "."));
                if (cristal.Chefe == true)
                    conteudo.Add(Paragrafo("É a alma de um chefe: só funciona acima do nível " + Js.NumberToString(cristal.Nivel) + ", e falha 65% das vezes (aí o cristal se parte)."));
                var equipe = _partida.Estado.Party ?? new List<Companion>();
                bool algum = false;
                for (int i = 0; i < equipe.Count; i++)
                {
                    var membro = equipe[i];
                    if (membro.Invocado != true || membro.Hp <= 0) continue;
                    algum = true;
                    int escolhido = i;
                    conteudo.Add(Botao((membro.ClassIcon ?? "💀") + " " + membro.Name, () => TrocarPeloCristal(indice, escolhido)));
                }
                if (!algum) conteudo.Add(Paragrafo("Nenhum lacaio de pé pra trocar."));
            }, ("DEIXAR", FecharJanela));
        }

        private void TrocarPeloCristal(int cristal, int lacaio)
        {
            // O resultado vai no aviso da sala (o da Partida).
            _partida?.UsarCristal(cristal, lacaio);
            _janela = null;
            _sobre.AddToClassList("oculto");
            Redesenhar();
        }

        private Button _botaoAnimais;
        private bool _botaoAnimaisVisivel;
        /// <summary>O animal que o jogador apertou pra soltar: o segundo aperto confirma (rodada 7d).</summary>
        private string _soltando;

        /// <summary>
        /// Depois da luta, o animal que o Caçador domou ganha nome (rodada 7b); fora da luta, a tecla K e o botão de
        /// cima abrem a janela ANIMAIS (rodada 7c).
        /// </summary>
        private void AtualizarAnimais()
        {
            if (_partida == null) return;
            var hero = _partida.Estado.Hero;
            bool cacador = Catalog.IdDaClasse(hero.ClassId, hero.ClassName) == "cacador";
            bool temAnimal = cacador && Animais.Quantos(hero, _partida.Estado.Party ?? new List<Companion>(), _partida.Estado.Inventory) > 0;
            MostrarBotaoAnimais(temAnimal && _partida.Luta == null);
            if (temAnimal && _partida.Luta == null && _janela == null && Andando)
            {
                var teclado = Keyboard.current;
                if (teclado != null && !DigitandoNoChat && teclado.kKey.wasPressedThisFrame)
                {
                    AbrirAnimais();
                    return;
                }
            }
            if (_partida.Luta != null || _janela != null || _partida.AnimaisPorNomear.Count == 0) return;
            string id = _partida.AnimaisPorNomear[0];
            // Sai da fila já: fechar a janela sem nome deixa o da espécie.
            _partida.AnimaisPorNomear.RemoveAt(0);
            AbrirNomeDoAnimal(id);
        }

        private void MostrarBotaoAnimais(bool mostrar)
        {
            if (_botaoAnimais == null && _tela != null)
            {
                var vizinho = _tela.Q<Button>("botao-chat");
                if (vizinho?.parent == null) return;
                _botaoAnimais = new Button(AbrirAnimais) { text = "ANIMAIS" };
                _botaoAnimais.AddToClassList("botao");
                _botaoAnimais.AddToClassList("botao-pequeno");
                _botaoAnimais.style.display = DisplayStyle.None;
                vizinho.parent.Add(_botaoAnimais);
            }
            if (_botaoAnimais == null || mostrar == _botaoAnimaisVisivel) return;
            _botaoAnimaisVisivel = mostrar;
            _botaoAnimais.style.display = mostrar ? DisplayStyle.Flex : DisplayStyle.None;
        }

        private static string NomeDoEstado(string estado) => estado == "ofensivo" ? "Ofensivo" : estado == "estrategico" ? "Estratégico" : "Retaguarda";

        /// <summary>
        /// A janela ANIMAIS (rodada 7c): os que seguem o herói e os guardados, com o nível, as lutas, a vida e o estado;
        /// troca o estado, dá nome, guarda e leva de volta (seguem até 2).
        /// </summary>
        private void AbrirAnimais()
        {
            if (_partida == null || _janela != null || _partida.Luta != null) return;
            _janela = "animais";
            var estado = _partida.Estado;
            var equipe = estado.Party ?? new List<Companion>();
            var naEquipe = Animais.DaEquipe(equipe);
            var guardados = estado.Hero.Animais ?? new List<Companion>();
            var r = Animais.NaLuta;
            Janela("🐾 Animais", conteudo =>
            {
                conteudo.Add(Paragrafo("<b>Retaguarda</b>: anda perto de você e ataca quem chegar a 3 blocos (+20% de dano). <b>Ofensivo</b>: vai atrás de qualquer inimigo (+20% de resistência). <b>Estratégico</b>: guarda a área que você marca na luta (no PC, o botão direito no chão; no celular, segure o dedo parado no chão) e bate em todos dentro dela; sem área, vira retaguarda. Até 2 seguem você, e cada 30 lutas vencidas sobem um nível. Do nível 5 em diante dá pra montar: +20% de velocidade e alcance 6; no 8 ele segura 15% dos golpes, e no 10 você bate 20% mais forte. O animal que cai vira cristal: a Poção de Reviver (na mochila) ou uma noite na taverna o traz de volta."));
                void Linha(Companion animal, bool seguindo)
                {
                    string id = animal.Animal.Id;
                    string atual = Animais.EstadoDoAnimal(animal);
                    var linha = PecasDaTela.Bloco("passo-do-guia");
                    linha.Add(PecasDaTela.Texto(animal.RaceIcon ?? "🐾", "icone-do-passo"));
                    var textos = PecasDaTela.Bloco("textos-do-passo");
                    textos.Add(PecasDaTela.Texto(animal.Name + (seguindo ? "" : " (guardado)"), "nome-do-passo"));
                    string lutas = animal.Animal.Nivel >= r.NivelMaximo ? "nível máximo" : Js.NumberToString(animal.Animal.Batalhas % r.BatalhasPorNivel) + "/" + Js.NumberToString(r.BatalhasPorNivel) + " lutas";
                    textos.Add(PecasDaTela.Texto("Nv " + Js.NumberToString(animal.Animal.Nivel) + " · " + lutas + " · Vida " + Js.NumberToString(Math.Floor(animal.Hp)) + "/" + Js.NumberToString(animal.MaxHp) + " · " + NomeDoEstado(atual), "dica-do-passo"));
                    // Os botões vão embaixo dos textos, quebrando linha: numa fila só (até oito) eles espremiam o nome
                    // até uma letra por linha e saíam pela borda da janela.
                    var botoes = PecasDaTela.Bloco("opcoes-da-janela");
                    textos.Add(botoes);
                    linha.Add(textos);
                    foreach (var opcao in new[] { "retaguarda", "ofensivo", "estrategico" })
                    {
                        string escolhido = opcao;
                        botoes.Add(PecasDaTela.Botao(NomeDoEstado(opcao).ToUpperInvariant(), () => MexerNosAnimais(() => _partida.MudarEstadoDoAnimal(id, escolhido)), escolhido == atual, escolhido != atual));
                    }
                    botoes.Add(PecasDaTela.Botao("NOME", () =>
                    {
                        FecharJanela();
                        AbrirNomeDoAnimal(id);
                    }));
                    if (seguindo) botoes.Add(PecasDaTela.Botao("GUARDAR", () => MexerNosAnimais(() => _partida.GuardarAnimal(id))));
                    else botoes.Add(PecasDaTela.Botao("LEVAR", () => MexerNosAnimais(() => _partida.LevarAnimal(id)), false, naEquipe.Count < Animais.Regras.Ativos));
                    // A montaria (rodada 7d): do nível 5 em diante, quem segue o herói.
                    if (seguindo && estado.Hero.Montaria == id) botoes.Add(PecasDaTela.Botao("DESMONTAR", () => MexerNosAnimais(() => _partida.Desmontar()), true));
                    else if (seguindo) botoes.Add(PecasDaTela.Botao("MONTAR", () => MexerNosAnimais(() => _partida.MontarAnimal(id)), false, Animais.PodeMontar(animal)));
                    BotaoDeSoltar(botoes, id);
                    conteudo.Add(linha);
                }
                foreach (var animal in naEquipe) Linha(animal, true);
                foreach (var animal in guardados) if (animal.Animal != null) Linha(animal, false);
                // Os caídos em cristal (rodada 7d).
                foreach (var item in estado.Inventory ?? new List<Item>())
                {
                    if (item.Animal?.Animal == null) continue;
                    var linha = PecasDaTela.Bloco("passo-do-guia");
                    linha.Add(PecasDaTela.Texto("💠", "icone-do-passo"));
                    var textos = PecasDaTela.Bloco("textos-do-passo");
                    textos.Add(PecasDaTela.Texto(Items.DisplayName(item), "nome-do-passo"));
                    textos.Add(PecasDaTela.Texto("Caído · Nv " + Js.NumberToString(item.Animal.Animal.Nivel) + " · a Poção de Reviver ou a taverna o trazem de volta", "dica-do-passo"));
                    linha.Add(textos);
                    BotaoDeSoltar(linha, item.Animal.Animal.Id);
                    conteudo.Add(linha);
                }
            }, ("FECHAR", FecharJanela));
        }

        /// <summary>O SOLTAR: o primeiro aperto pede a confirmação, o segundo solta pra sempre.</summary>
        private void BotaoDeSoltar(VisualElement linha, string id)
        {
            if (_soltando == id) linha.Add(PecasDaTela.Botao("SOLTAR PRA SEMPRE?", () => MexerNosAnimais(() => _partida.SoltarAnimal(id)), true));
            else linha.Add(PecasDaTela.Botao("SOLTAR", () => { _soltando = id; _janela = null; AbrirAnimais(); }));
        }

        /// <summary>Faz a mudança e redesenha a janela com o que mudou.</summary>
        private void MexerNosAnimais(Action mudanca)
        {
            _soltando = null;
            mudanca();
            _janela = null;
            AbrirAnimais();
        }

        /// <summary>A janela do nome do animal domado: o campo vem com o nome do bicho, e o PRONTO grava o que estiver nele.</summary>
        private void AbrirNomeDoAnimal(string id)
        {
            var estado = _partida.Estado;
            Companion animal = (estado.Party ?? new List<Companion>()).Find(m => m.Animal != null && m.Animal.Id == id)
                ?? (estado.Hero.Animais ?? new List<Companion>()).Find(m => m.Animal != null && m.Animal.Id == id);
            if (animal == null) return;
            _janela = "nome-do-animal";
            var campo = new TextField { maxLength = 40, value = animal.Name };
            campo.AddToClassList("campo-do-nome");
            bool naEquipe = (estado.Party ?? new List<Companion>()).Contains(animal);
            Janela("🐾 Novo companheiro", conteudo =>
            {
                conteudo.Add(Paragrafo((animal.RaceIcon ?? "🐾") + " " + animal.Race + (naEquipe ? " agora segue você." : " ficou guardado: na equipe já seguem dois animais.") + " Dê um nome ao seu novo companheiro:"));
                conteudo.Add(campo);
            }, ("PRONTO", () =>
            {
                _partida.NomearAnimal(id, campo.value ?? "");
                FecharJanela();
            }));
            campo.Focus();
        }

        /// <summary>A janela LACAIOS: cada lacaio de pé, com a vida, a espécie e o estado (a retaguarda ou o ofensivo).</summary>
        private void AbrirLacaios()
        {
            if (_partida == null || _janela != null || _partida.Luta != null) return;
            _janela = "lacaios";
            Janela("💀 Lacaios", conteudo =>
            {
                conteudo.Add(Paragrafo("<b>Retaguarda</b>: anda perto de você e ataca quem chegar a 3 blocos (+10% de dano). <b>Ofensivo</b>: vai atrás de qualquer inimigo à vista (+10% de resistência)."));
                var equipe = _partida.Estado.Party ?? new List<Companion>();
                for (int i = 0; i < equipe.Count; i++)
                {
                    var membro = equipe[i];
                    if (membro.Invocado != true || membro.Hp <= 0) continue;
                    string estado = Invocacao.EstadoDoLacaio(membro);
                    var linha = PecasDaTela.Bloco("passo-do-guia");
                    linha.Add(PecasDaTela.Texto(membro.ClassIcon ?? "💀", "icone-do-passo"));
                    var textos = PecasDaTela.Bloco("textos-do-passo");
                    textos.Add(PecasDaTela.Texto(membro.Name, "nome-do-passo"));
                    textos.Add(PecasDaTela.Texto("Vida " + Js.NumberToString(Math.Floor(membro.Hp)) + "/" + Js.NumberToString(membro.MaxHp) + " · " + (estado == "ofensivo" ? "Ofensivo" : "Retaguarda"), "dica-do-passo"));
                    linha.Add(textos);
                    int qual = i;
                    var outro = estado == "ofensivo" ? "retaguarda" : "ofensivo";
                    linha.Add(Botao(outro == "ofensivo" ? "OFENSIVO" : "RETAGUARDA", () => MudarEstadoDoLacaio(qual, outro)));
                    conteudo.Add(linha);
                }
            }, ("FECHAR", FecharJanela));
        }

        private void MudarEstadoDoLacaio(int indice, string estado)
        {
            _partida?.MudarEstadoDoLacaio(indice, estado);
            // Redesenha a janela com o estado novo.
            _janela = null;
            AbrirLacaios();
        }
    }
}
