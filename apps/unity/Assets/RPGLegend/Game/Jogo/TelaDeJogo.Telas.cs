using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// As telas de sala pequenas, nos moldes das do site (apps/web/app/jogo/tela-*.tsx): a conversa, o evento, o
    /// totem, o quadro de missões, o mestre de classe e a guilda; e o guia e a ficha, que abrem por botão. Toda ação
    /// numa tela devolve o estado novo pela <see cref="Partida.Seguir"/>, que já agenda a gravação — fechar o app no
    /// meio não desfaz a compra nem o treino.
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        /// <summary>O tipo da tela desenhada por último: trocar de tela esquece as escolhas da anterior.</summary>
        private string _tipoDaTela;

        /// <summary>
        /// O que está escolhido na tela aberta, pelo id (e não pelo objeto): toda ação devolve itens e estado novos,
        /// e a referência antiga deixaria a ficha presa na versão anterior da peça.
        /// </summary>
        private string _selecionado, _aba = "todos", _paraReforjar, _aprender, _esquecer, _classe;

        private void EsquecerEscolhas()
        {
            _tipoDaTela = null;
            _selecionado = null;
            _aba = "todos";
            _paraReforjar = null;
            _aprender = null;
            _esquecer = null;
            _classe = null;
            _chaveDaJanela = null;
        }

        /// <summary>A redesenhada que as escolhas pedem: a seleção não muda o save, só a tela.</summary>
        private void Escolher(System.Action mudar)
        {
            mudar();
            Redesenhar();
        }

        /// <summary>O cabeçalho das telas de conversa (o da carta do inimigo no site): o ícone grande, o nome e a linha de baixo.</summary>
        private static VisualElement Retrato(string icone, string nome, string detalhe)
        {
            var retrato = PecasDaTela.Bloco("retrato-da-tela");
            retrato.Add(PecasDaTela.Texto(icone, "icone-da-tela"));
            var textos = PecasDaTela.Bloco("textos-do-retrato");
            textos.Add(PecasDaTela.Texto(nome, "nome-da-tela"));
            if (!string.IsNullOrEmpty(detalhe)) textos.Add(PecasDaTela.Texto(detalhe, "detalhe-da-tela"));
            retrato.Add(textos);
            return retrato;
        }

        private static string Ouro(Hero hero) => "💰 " + PecasDaTela.Inteiro(hero.Gold) + " ouro";

        private static string Ultima(List<string> log) => log != null && log.Count > 0 ? log[log.Count - 1] : null;

        // ---------- conversa ----------

        /// <summary>TS: TelaDialogo — as falas em sequência e o botão do serviço do NPC.</summary>
        private void TelaDoDialogo(Dialogo dialogo)
        {
            var npc = dialogo.Npc;
            _sairDaTela = () => _partida.Fechar(dialogo.Estado);
            var botoes = new List<(string, System.Action)>();
            if (Dialogos.TemMaisFalas(dialogo)) botoes.Add(("CONTINUAR CONVERSA", () => SeguirDialogo(Dialogos.ProximaFala(dialogo))));
            JanelaDeRetrato("dialogo", conteudo =>
            {
                conteudo.Add(Retrato(npc?.Icon ?? "🙂", npc?.Name ?? "", npc?.Role));
                conteudo.Add(PecasDaTela.Texto(Dialogos.FalaAtual(dialogo), "fala-da-tela"));
                var resposta = Ultima(dialogo.Log);
                if (resposta != null) conteudo.Add(PecasDaTela.Texto(resposta, "resposta-da-tela"));
                var servico = npc != null ? Dialogos.RotuloDoServico(npc) : null;
                if (!string.IsNullOrEmpty(servico))
                {
                    var linha = PecasDaTela.Bloco("opcoes-da-janela");
                    linha.Add(PecasDaTela.Botao(servico + (npc.ServiceUsed ? " (já usado)" : ""), () => SeguirDialogo(Dialogos.UsarServico(dialogo)),
                        habilitado: Dialogos.ServicoDisponivel(npc)));
                    conteudo.Add(linha);
                }
            }, Com(botoes, ("ENCERRAR CONVERSA", _sairDaTela)));
        }

        private void SeguirDialogo(Dialogo proximo) => _partida.Seguir(new TelaAberta { Tipo = "dialogo", Dialogo = proximo }, proximo.Estado);

        private static (string, System.Action)[] Com(List<(string, System.Action)> primeiros, params (string, System.Action)[] depois)
        {
            var todos = new List<(string, System.Action)>(primeiros);
            todos.AddRange(depois);
            return todos.ToArray();
        }

        // ---------- evento ----------

        /// <summary>TS: TelaEvento — o acontecimento e as escolhas; o resultado depende de um atributo do herói.</summary>
        private void TelaDoEvento(Evento evento)
        {
            var modelo = evento.Template;
            _sairDaTela = () => _partida.Fechar(evento.Estado);
            var botoes = new List<(string, System.Action)>();
            if (evento.Resolvido)
            {
                botoes.Add(("CONTINUAR", _sairDaTela));
            }
            else
            {
                foreach (var escolha in Eventos.Escolhas(evento))
                {
                    var id = escolha.Id;
                    botoes.Add((escolha.Label.ToUpperInvariant(), () =>
                    {
                        var proximo = Eventos.Escolher(evento, id);
                        _partida.Seguir(new TelaAberta { Tipo = "evento", Evento = proximo }, proximo.Estado);
                    }));
                }
                botoes.Add(("SAIR", _sairDaTela));
            }
            JanelaDeRetrato("evento", conteudo =>
            {
                conteudo.Add(Retrato(modelo?.Icon ?? "❔", modelo?.Title ?? "", "Escolha de Atributo"));
                conteudo.Add(PecasDaTela.Texto(Ultima(evento.Log) ?? modelo?.Text, "fala-da-tela"));
            }, botoes.ToArray());
        }

        // ---------- totem ----------

        /// <summary>TS: TelaTotem — o toque já marcou o andar no portão; a tela oferece a volta pra cidade na hora.</summary>
        private void TelaDoTotem(Totem totem)
        {
            _sairDaTela = () => _partida.Fechar(totem.Estado, new Aviso("🗿", "Totem Antigo", totem.Texto));
            JanelaDeRetrato("totem", conteudo =>
            {
                conteudo.Add(Retrato("🗿", "Totem Antigo", Dungeons.RunName(totem.Estado.Masmorra) + " · Andar " + PecasDaTela.Inteiro(totem.Estado.Floor)));
                conteudo.Add(PecasDaTela.Texto(totem.Texto, "fala-da-tela"));
            },
            ("VOLTAR À CIDADE", () =>
            {
                Sons.Tocar("door");
                _partida.Fechar(Totens.VoltarPeloTotem(totem), new Aviso("🗿", "Totem Antigo", "A luz do totem envolve você, e você reaparece na cidade."));
            }),
            ("CONTINUAR EXPLORANDO", _sairDaTela));
        }

        // ---------- quadro de missões ----------

        /// <summary>TS: TelaMissoes — as missões, o progresso de cada uma e o resgate. Resgatar sorteia outra no lugar.</summary>
        private void TelaDasMissoes(Quadro quadro)
        {
            _sairDaTela = () => _partida.Fechar(quadro.Estado);
            Janela("📜 Quadro de Missões", Ouro(quadro.Estado.Hero), Ultima(quadro.Log), conteudo =>
            {
                var missoes = QuadroDeMissoes.Missoes(quadro);
                if (missoes == null || missoes.Count == 0)
                {
                    conteudo.Add(PecasDaTela.Texto("Nenhum anúncio no quadro.", "vazio"));
                    return;
                }
                foreach (var missao in missoes)
                {
                    var bloco = PecasDaTela.Bloco("missao");
                    bloco.Add(PecasDaTela.Texto(missao.Title, "titulo-da-missao"));
                    bloco.Add(PecasDaTela.Texto(missao.Desc, "descricao-da-missao"));
                    bloco.Add(PecasDaTela.Barra(System.Math.Min(missao.Progress, missao.Target), missao.Target, "mana"));
                    bloco.Add(PecasDaTela.Texto(PecasDaTela.Inteiro(System.Math.Min(missao.Progress, missao.Target)) + "/" + PecasDaTela.Inteiro(missao.Target)
                        + " · recompensa " + PecasDaTela.Inteiro(missao.RewardGold) + " ouro e " + PecasDaTela.Inteiro(missao.RewardXp) + " XP", "meta-da-missao"));
                    var id = missao.Id;
                    var texto = missao.Claimed ? "RESGATADA" : missao.Done ? "RESGATAR RECOMPENSA" : "EM ANDAMENTO";
                    var botao = PecasDaTela.Botao(texto, () =>
                    {
                        var proximo = QuadroDeMissoes.Resgatar(quadro, id);
                        _partida.Seguir(new TelaAberta { Tipo = "missoes", Quadro = proximo }, proximo.Estado);
                    }, principal: missao.Done && !missao.Claimed, habilitado: missao.Done && !missao.Claimed);
                    bloco.Add(botao);
                    conteudo.Add(bloco);
                }
            }, ("SAIR", _sairDaTela));
        }

        // ---------- mestre de classe ----------

        /// <summary>
        /// TS: TelaProfessor — as cartas só selecionam, e quem decide é o botão de baixo, que diz o que vai acontecer:
        /// aprender ou trocar poder não tem volta.
        /// </summary>
        private void TelaDoProfessor(Professor professor)
        {
            _sairDaTela = () => _partida.Fechar(professor.Estado);
            var ofertas = Professores.Ofertas(professor);
            var trocaveis = Professores.Trocaveis(professor);
            var novo = ofertas.Find(poder => poder.Id == _aprender);
            var velho = trocaveis.Find(poder => poder.Id == _esquecer);
            bool ensinando = !professor.Concluido && professor.Modo != null;

            var botoes = new List<(string, System.Action)>();
            if (ensinando && professor.Modo == "learn")
            {
                if (novo != null) botoes.Add(("APRENDER " + novo.Name.ToUpperInvariant(), () => SeguirProfessor(Professores.Aprender(professor, novo.Id))));
            }
            else if (ensinando && novo != null && velho != null)
            {
                botoes.Add(("TROCAR " + velho.Name.ToUpperInvariant() + " POR " + novo.Name.ToUpperInvariant(),
                    () => SeguirProfessor(Professores.Trocar(professor, velho.Id, novo.Id))));
            }
            botoes.Add((professor.Concluido ? "CONTINUAR" : "AGORA NÃO", _sairDaTela));

            var classe = professor.Classe;
            Janela("🎓 Mestre " + ((classe?.Icon ?? "") + " " + (classe?.Name ?? "")).Trim(), conteudo =>
            {
                conteudo.Add(PecasDaTela.Texto(Ultima(professor.Log) ?? "", "fala-da-tela"));
                if (!ensinando) return;
                conteudo.Add(PecasDaTela.Secao("O mestre ensina"));
                var grade = PecasDaTela.Grade();
                foreach (var poder in ofertas) grade.Add(CartaDePoder(poder, poder.Id == _aprender, id => _aprender = id));
                conteudo.Add(grade);
                if (professor.Modo == "swap")
                {
                    conteudo.Add(PecasDaTela.Secao("Você esquece"));
                    var esquecer = PecasDaTela.Grade();
                    foreach (var poder in trocaveis) esquecer.Add(CartaDePoder(poder, poder.Id == _esquecer, id => _esquecer = id));
                    conteudo.Add(esquecer);
                }
                if (novo == null || (professor.Modo == "swap" && velho == null))
                    conteudo.Add(PecasDaTela.Texto(professor.Modo == "swap" ? "Escolha o que aprender e o que esquecer." : "Escolha um poder.", "vazio"));
            }, botoes.ToArray());
        }

        private VisualElement CartaDePoder(PowerDef poder, bool escolhida, System.Action<string> escolher)
        {
            var id = poder.Id;
            return PecasDaTela.CartaDeEscolha(poder.Icon, poder.Name + " (" + PecasDaTela.Inteiro(poder.Cost) + " MP)", poder.Desc, escolhida,
                () => Escolher(() => escolher(id)));
        }

        private void SeguirProfessor(Professor proximo) => _partida.Seguir(new TelaAberta { Tipo = "professor", Professor = proximo }, proximo.Estado);

        // ---------- guilda ----------

        /// <summary>
        /// TS: TelaGuilda — o Aprendiz escolhe a classe. A carta só seleciona; quem treina é o botão da ficha, que diz
        /// o nome da classe: é a decisão mais pesada do personagem e não tem volta.
        /// </summary>
        private void TelaDaGuilda(Guilda guilda)
        {
            var hero = guilda.Estado.Hero;
            bool treinado = Heroes.HasClass(hero);
            _sairDaTela = () => _partida.Fechar(guilda.Estado);
            var escolhida = treinado ? null : Catalog.Classes.Find(classe => classe.Id == _classe);
            var botoes = new List<(string, System.Action)>();
            if (escolhida != null)
            {
                botoes.Add(("TREINAR COMO " + escolhida.Name.ToUpperInvariant(), () =>
                {
                    var proxima = Guildas.Treinar(guilda, escolhida);
                    _partida.Seguir(new TelaAberta { Tipo = "guilda", Guilda = proxima }, proxima.Estado);
                    _partida.Recadar(proxima.Recado);
                }));
            }
            botoes.Add(("SAIR", _sairDaTela));

            // Quem já tem classe vê a dele e mais nada: a janela de sempre basta.
            if (treinado)
            {
                Janela("⚜️ Guilda dos Aventureiros", null, Ultima(guilda.Log), conteudo => conteudo.Add(PecasDaTela.Texto("Você é "
                    + ((hero.ClassIcon ?? "") + " " + hero.ClassName).Trim()
                    + ". A guilda segue de portas abertas, mas o treinamento de classe se faz uma vez só.", "fala-da-tela")), botoes.ToArray());
                return;
            }

            JanelaLarga("⚜️ Guilda dos Aventureiros", null, Ultima(guilda.Log), colunas =>
            {
                var lista = Coluna("rolagem-das-classes", "coluna-larga");
                lista.Add(PecasDaTela.Texto("Escolha sua classe. Ela dá sua arma inicial, soma atributos e ensina seu primeiro poder — e vale para sempre.", "fala-da-tela"));
                var grade = PecasDaTela.Grade();
                foreach (var classe in Catalog.Classes)
                {
                    var id = classe.Id;
                    grade.Add(PecasDaTela.CartaDeEscolha(classe.Icon, classe.Name, classe.Desc, id == _classe, () => Escolher(() => _classe = id)));
                }
                lista.Add(grade);
                colunas.Add(lista);

                var ficha = Coluna("rolagem-da-classe", "coluna-da-ficha");
                if (escolhida == null) ficha.Add(PecasDaTela.Texto("Escolha uma classe para ver o que a guilda ensina.", "ficha-vazia"));
                else ficha.Add(FichaDaClasse(escolhida));
                colunas.Add(ficha);
            }, botoes.ToArray());
        }

        /// <summary>TS: FichaDaClasse — a arma, os poderes que a classe dá e o que ela soma nos atributos.</summary>
        private static VisualElement FichaDaClasse(ClassDef classe)
        {
            var ficha = PecasDaTela.Bloco("ficha-da-peca");
            var cabecalho = PecasDaTela.Bloco("cabecalho-da-ficha");
            cabecalho.Add(PecasDaTela.Texto(classe.Icon, "icone-da-classe"));
            var titulos = PecasDaTela.Bloco("titulos-da-ficha");
            titulos.Add(PecasDaTela.Texto(classe.Name, "nome-da-ficha"));
            titulos.Add(PecasDaTela.Texto(classe.Desc, "descricao-da-ficha"));
            cabecalho.Add(titulos);
            ficha.Add(cabecalho);

            var ensina = PecasDaTela.Bloco("impacto");
            ensina.Add(PecasDaTela.Texto("O que a guilda ensina", "titulo-do-impacto"));
            var arma = ItemTemplates.ById(classe.WeaponTemplate);
            if (arma != null)
            {
                var linha = PecasDaTela.Bloco("linha-da-guilda");
                linha.Add(PecasDaTela.Texto("Arma", "rotulo-da-guilda"));
                var nome = PecasDaTela.Bloco("arma-da-guilda");
                nome.Add(PecasDaTela.Imagem(PecasDaTela.SpriteDoArquivo(arma.Sprite), 32));
                nome.Add(PecasDaTela.Texto(arma.Name, "texto-da-guilda"));
                linha.Add(nome);
                ensina.Add(linha);
            }
            foreach (var poder in PoderesDaClasse(classe))
            {
                var linha = PecasDaTela.Bloco("linha-da-guilda");
                linha.Add(PecasDaTela.Texto("Poder", "rotulo-da-guilda"));
                var texto = PecasDaTela.Bloco("textos-da-guilda");
                texto.Add(PecasDaTela.Rico(TextoDoJogo.ParaTela(poder.Icon + " " + poder.Name) + " <color=#b9ab86>(" + PecasDaTela.Inteiro(poder.Cost) + " MP)</color>", "texto-da-guilda"));
                texto.Add(PecasDaTela.Texto(poder.Desc, "descricao-do-poder"));
                linha.Add(texto);
                ensina.Add(linha);
            }
            var vies = new List<string>();
            foreach (var par in classe.Bias) vies.Add("+" + PecasDaTela.Inteiro(par.Value) + " " + (GameData.HeroCatalog.AttrLabels.Get(par.Key) ?? par.Key));
            var atributos = PecasDaTela.Bloco("linha-da-guilda");
            atributos.Add(PecasDaTela.Texto("Atributos", "rotulo-da-guilda"));
            atributos.Add(PecasDaTela.Texto(string.Join(" · ", vies), "texto-da-guilda"));
            ensina.Add(atributos);
            ficha.Add(ensina);
            return ficha;
        }

        /// <summary>Os poderes que a classe dá: o dela e os que só ela tem (a Canção de Batalha do bardo).</summary>
        private static List<PowerDef> PoderesDaClasse(ClassDef classe)
        {
            var poderes = new List<PowerDef>();
            var assinatura = Catalog.PowerById(classe.SignatureId);
            if (assinatura != null) poderes.Add(assinatura);
            foreach (var poder in Catalog.Powers)
                if (poder.SoDaClasse == classe.Id && poder.Id != classe.SignatureId) poderes.Add(poder);
            return poderes;
        }

        // ---------- guia e ficha ----------

        /// <summary>TS: TelaGuia — o progresso dos Primeiros Passos em cima, os textos do guia embaixo. Só mostra.</summary>
        private void AbrirGuia()
        {
            if (_partida == null || _janela != null) return;
            _janela = "guia";
            var tutorial = Tutoriais.TutorialDe(_partida.Estado);
            var passos = Tutoriais.Passos;
            Janela("📖 Guia do Aventureiro", PecasDaTela.Inteiro(Tutoriais.Concluidos(tutorial)) + "/" + passos.Count, null, conteudo =>
            {
                conteudo.Add(PecasDaTela.Secao("Primeiros Passos"));
                foreach (var passo in passos)
                {
                    bool feito = tutorial.Completed != null && tutorial.Completed.Get(passo.Id);
                    var linha = PecasDaTela.Bloco("passo-do-guia");
                    if (feito) linha.AddToClassList("passo-feito");
                    linha.Add(PecasDaTela.Texto(passo.Icone, "icone-do-passo"));
                    var textos = PecasDaTela.Bloco("textos-do-passo");
                    textos.Add(PecasDaTela.Texto(passo.Nome, "nome-do-passo"));
                    textos.Add(PecasDaTela.Texto(passo.Dica, "dica-do-passo"));
                    linha.Add(textos);
                    linha.Add(PecasDaTela.Texto(feito ? "✓" : "○", "marca-do-passo"));
                    conteudo.Add(linha);
                }
                conteudo.Add(PecasDaTela.Texto(tutorial.Rewarded ? "✓ Recompensa recebida: 40 de ouro e uma poção." : "Conclua tudo: 40 de ouro e uma poção.", "vazio"));
                conteudo.Add(PecasDaTela.Secao("Guia"));
                foreach (var guia in Tutoriais.Guias)
                {
                    var carta = PecasDaTela.Bloco("carta-do-guia");
                    carta.Add(PecasDaTela.Texto(guia.Titulo, "nome-do-passo"));
                    carta.Add(PecasDaTela.Texto(guia.Texto, "dica-do-passo"));
                    conteudo.Add(carta);
                }
            }, ("FECHAR", FecharJanela));
        }

        /// <summary>O cartão de guilda inteiro, com o retrato: o "Ficha" da faixa do site no celular.</summary>
        private void AbrirFicha()
        {
            if (_partida == null || _janela != null) return;
            _janela = "ficha";
            Janela("Ficha do herói", conteudo =>
            {
                var cartao = CartaoDeGuilda.Criar(_partida.Estado.Hero, true, null);
                // Como o max-width do site: esticado na janela, os atributos se espalhavam pelo papel.
                cartao.AddToClassList("cartao-sozinho");
                conteudo.Add(cartao);
            }, ("FECHAR", FecharJanela));
        }
    }
}
