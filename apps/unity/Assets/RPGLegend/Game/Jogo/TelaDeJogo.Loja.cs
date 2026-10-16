using System;
using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A loja e o ferreiro (tela-loja.tsx): o que está à venda e a sua mochila, a ficha ao lado com o botão que diz o
    /// preço, a pechincha no dado e a renovação do estoque; no ferreiro, a reforja. Clicar na carta seleciona — no
    /// site, um toque sem querer vendia a peça, sem volta. As regras moram na engine (Lojas, Shop).
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        private void TelaDaLoja(Loja loja)
        {
            var hero = loja.Estado.Hero;
            bool ferreiro = loja.Kind == ShopKinds.Blacksmith;
            _sairDaTela = () => _partida.Fechar(loja.Estado);

            // A peça aberta é lida a cada desenho, nunca guardada no toque: renovar o estoque ou a pechincha mudam o
            // preço, e a peça pode até sumir (aí a ficha esvazia).
            var aVenda = Lojas.Estoque(loja);
            var paraVender = Lojas.Vendaveis(loja);
            var aComprar = aVenda.Find(item => item.Uid == _selecionado);
            var aVender = aComprar == null ? paraVender.Find(item => item.Uid == _selecionado) : null;
            var aberta = aComprar ?? aVender;
            double renovacao = Lojas.PrecoDaRenovacao(loja);

            JanelaLarga(ferreiro ? "🔨 Ferreiro" : "🏵 Vendedor Itinerante", Ouro(hero), Ultima(loja.Log), colunas =>
            {
                var lista = Coluna("rolagem-da-loja", "coluna-larga");

                var acoes = PecasDaTela.Bloco("opcoes-da-janela");
                if (loja.DescontoRolado)
                {
                    var dado = loja.Dado.HasValue ? "🎲 " + PecasDaTela.Inteiro(loja.Dado.Value) + " · " : "";
                    acoes.Add(PecasDaTela.Texto(dado + (loja.Desconto > 0 ? "Desconto de " + PecasDaTela.Inteiro(Math.Round(loja.Desconto * 100)) + "%" : "Sem desconto nesta visita"), "resultado-da-pechincha"));
                }
                else
                {
                    acoes.Add(PecasDaTela.Botao("🎲 ROLAR DADO POR DESCONTO", () => SeguirLoja(Lojas.Pechinchar(loja, UnityEngine.Random.Range(1, 21)))));
                }
                acoes.Add(PecasDaTela.Botao("RENOVAR ESTOQUE (" + PecasDaTela.Inteiro(renovacao) + " OURO)", () => SeguirLoja(Lojas.RenovarEstoque(loja)),
                    habilitado: hero.Gold >= renovacao));
                lista.Add(acoes);

                lista.Add(PecasDaTela.Secao("À venda"));
                if (aVenda.Count == 0)
                {
                    lista.Add(PecasDaTela.Texto("O estoque acabou. Renove para ver mercadoria nova.", "vazio"));
                }
                else
                {
                    // Toda carta é clicável, inclusive a que você não pode pagar: ver o que ela faz é de graça.
                    var grade = PecasDaTela.Grade();
                    foreach (var item in aVenda)
                    {
                        var uid = item.Uid;
                        grade.Add(PecasDaTela.CartaDeItem(item, PecasDaTela.Inteiro(Lojas.PrecoDeCompra(loja, item)) + " ouro", uid == _selecionado,
                            () => Escolher(() => _selecionado = uid)));
                    }
                    lista.Add(grade);
                }

                lista.Add(PecasDaTela.Secao("Sua mochila"));
                if (paraVender.Count == 0)
                {
                    lista.Add(PecasDaTela.Texto("Nada para vender.", "vazio"));
                }
                else
                {
                    var grade = PecasDaTela.Grade();
                    foreach (var item in paraVender)
                    {
                        var uid = item.Uid;
                        grade.Add(PecasDaTela.CartaDeItem(item, "vende por " + PecasDaTela.Inteiro(Lojas.PrecoDeVenda(item)) + " ouro", uid == _selecionado,
                            () => Escolher(() => _selecionado = uid)));
                    }
                    lista.Add(grade);
                }

                if (ferreiro) Reforja(loja, lista);
                colunas.Add(lista);

                var ficha = Coluna("rolagem-da-ficha", "coluna-da-ficha");
                ficha.Add(PecasDaTela.FichaDeItem(aberta, hero, botoes =>
                {
                    if (aComprar != null) BotaoDeCompra(loja, aComprar, botoes);
                    else if (aVender != null)
                        botoes.Add(PecasDaTela.Botao("VENDER POR " + PecasDaTela.Inteiro(Lojas.PrecoDeVenda(aVender)) + " OURO", () => Agir(Lojas.Vender(loja, aVender))));
                }, "Escolha uma peça à venda ou da sua mochila para ver o preço e o que ela muda em você."));
                colunas.Add(ficha);
            }, ("SAIR", _sairDaTela));
        }

        private void SeguirLoja(Loja proxima) => _partida.Seguir(new TelaAberta { Tipo = "loja", Loja = proxima }, proxima.Estado);

        /// <summary>
        /// Toda compra e venda fecha a ficha: comprar leva a peça pra mochila, e com ela ainda aberta o mesmo botão
        /// viraria "Vender" embaixo do dedo — um toque duplo compraria e venderia de uma vez.
        /// </summary>
        private void Agir(Loja proxima)
        {
            _selecionado = null;
            SeguirLoja(proxima);
        }

        /// <summary>Sem ouro, o botão fica desabilitado e diz quanto falta: botão cinza sem explicação faz procurar defeito na tela.</summary>
        private void BotaoDeCompra(Loja loja, Item item, VisualElement botoes)
        {
            double preco = Lojas.PrecoDeCompra(loja, item);
            double falta = preco - loja.Estado.Hero.Gold;
            if (falta > 0) botoes.Add(PecasDaTela.Texto("Faltam " + PecasDaTela.Inteiro(falta) + " de ouro.", "aviso-da-ficha"));
            botoes.Add(PecasDaTela.Botao("COMPRAR POR " + PecasDaTela.Inteiro(preco) + " OURO", () => Agir(Lojas.Comprar(loja, item)), principal: true, habilitado: falta <= 0));
        }

        /// <summary>Só dá pra reforjar equipamento que esteja na mochila e tenha tier.</summary>
        private void Reforja(Loja loja, VisualElement lista)
        {
            lista.Add(PecasDaTela.Secao("⚒️ Reforja"));
            var daForja = loja.Estado.Inventory.FindAll(item => !item.Equipped && !string.IsNullOrEmpty(Tiers.TierFor(item)));
            if (daForja.Count == 0)
            {
                lista.Add(PecasDaTela.Texto("Desequipe uma arma, armadura ou acessório para reforjar.", "vazio"));
                return;
            }
            var grade = PecasDaTela.Grade();
            foreach (var item in daForja)
            {
                var uid = item.Uid;
                grade.Add(PecasDaTela.CartaDeItem(item, "selecionar", uid == _paraReforjar, () => Escolher(() => _paraReforjar = uid)));
            }
            lista.Add(grade);
            var naForja = daForja.Find(item => item.Uid == _paraReforjar);
            if (naForja != null) lista.Add(PainelDaForja(loja, naForja));
        }

        private VisualElement PainelDaForja(Loja loja, Item item)
        {
            var visao = Items.View(item);
            if (Tiers.RankOf(item) == Tiers.Order.Count - 1)
            {
                var alcancou = Items.Concordar(item, new[] { "alcançou", "alcançou", "alcançaram", "alcançaram" });
                return PecasDaTela.Texto("🏆 " + visao.Name + " já " + alcancou + " o tier MAX.", "vazio");
            }

            double pity = item.ReforgeFails ?? 0;
            var painel = PecasDaTela.Bloco("painel", "painel-da-forja");
            painel.Add(PecasDaTela.Texto("Reforjar " + visao.Name, "titulo-da-caixa"));
            painel.Add(PecasDaTela.Texto("O resultado pode piorar, manter ou melhorar o tier. Garantia de melhoria: "
                + PecasDaTela.Inteiro(Math.Min(4, pity)) + "/4 tentativas sem sucesso.", "texto-da-caixa"));
            var materiais = PecasDaTela.Bloco("opcoes-da-janela");
            foreach (var par in Shop.ForgeMaterials)
            {
                var id = par.Key;
                var custo = par.Value.Cost;
                int disponiveis = loja.Estado.Inventory.FindAll(peca => peca.TemplateId == id).Count;
                bool pode = disponiveis > 0 && loja.Estado.Hero.Gold >= custo;
                // Nome do material pelo catálogo de itens: a engine só guarda custo e probabilidades por templateId.
                var nome = ItemTemplates.ById(id)?.Name ?? id;
                materiais.Add(PecasDaTela.Botao(nome.ToUpperInvariant() + " (" + PecasDaTela.Inteiro(custo) + " OURO · VOCÊ TEM " + disponiveis + ")",
                    () => SeguirLoja(Lojas.Reforjar(loja, item, id)), habilitado: pode));
            }
            painel.Add(materiais);
            return painel;
        }
    }
}
