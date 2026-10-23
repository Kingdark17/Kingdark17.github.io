using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A Encantadora (só no app): as armaduras vestidas e as da mochila; a ficha da escolhida diz o encantamento que ela
    /// tem e deixa escolher a fortificação e o nível, com o botão que diz o preço. A carta seleciona; quem encanta é o
    /// botão. As regras moram na engine (Encantadoras, Encantamentos).
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        /// <summary>A fortificação e o nível escolhidos na ficha da Encantadora.</summary>
        private string _fortificacao = "robustez";
        private double _nivelDoEncanto = 1;

        private void TelaDaEncantadora(Encantadora encantadora)
        {
            var hero = encantadora.Estado.Hero;
            _sairDaTela = () => _partida.Fechar(encantadora.Estado);
            // A peça aberta é lida a cada desenho pelo id: encantar devolve a peça nova, e a ficha segue com ela.
            var pecas = Encantadoras.PecasParaEncantar(encantadora.Estado);
            var aberta = pecas.Find(item => item.Uid == _selecionado);

            JanelaLarga("✨ Encantadora", Ouro(hero), Ultima(encantadora.Log), colunas =>
            {
                var lista = Coluna("rolagem-da-loja", "coluna-larga");
                lista.Add(PecasDaTela.Texto("A Encantadora fortifica armaduras: uma fortificação por peça, e encantar de novo troca a que havia.",
                    "fala-da-tela"));
                if (pecas.Count == 0) lista.Add(PecasDaTela.Texto("Você não tem armadura para fortificar.", "vazio"));
                // Onde a peça está vira a seção, e o rodapé fica só com o encantamento: os dois juntos não cabiam na carta.
                GradeDaEncantadora(lista, "Vestidas", pecas.FindAll(item => item.Equipped));
                GradeDaEncantadora(lista, "Na mochila", pecas.FindAll(item => !item.Equipped));
                colunas.Add(lista);

                var ficha = Coluna("rolagem-da-ficha", "coluna-da-ficha");
                ficha.Add(PecasDaTela.FichaDeItem(aberta, hero, botoes => AcoesDaEncantadora(encantadora, aberta, botoes),
                    "Escolha uma armadura para ver o encantamento dela e fortificar."));
                colunas.Add(ficha);
            }, ("SAIR", _sairDaTela));
        }

        private void GradeDaEncantadora(VisualElement lista, string titulo, List<Item> pecas)
        {
            if (pecas.Count == 0) return;
            lista.Add(PecasDaTela.Secao(titulo));
            var grade = PecasDaTela.Grade();
            foreach (var item in pecas)
            {
                var uid = item.Uid;
                string rodape = item.Encantamento != null ? Encantamentos.NomeDoEncantamento(item.Encantamento) : "sem encantamento";
                grade.Add(PecasDaTela.CartaDeItem(item, rodape, uid == _selecionado, () => Escolher(() => _selecionado = uid)));
            }
            lista.Add(grade);
        }

        private void SeguirEncantadora(Encantadora proxima) => _partida.Seguir(new TelaAberta { Tipo = "encantadora", Encantadora = proxima }, proxima.Estado);

        /// <summary>
        /// A ficha da peça na Encantadora: o encantamento de agora, as fortificações e os níveis em abas, o que a escolhida
        /// faz e o botão com o preço. Sem ouro, ou com a mesma fortificação que a peça já tem, o botão fica desligado e
        /// diz por quê.
        /// </summary>
        private void AcoesDaEncantadora(Encantadora encantadora, Item peca, VisualElement botoes)
        {
            if (peca == null) return;
            var atual = peca.Encantamento;
            botoes.Add(PecasDaTela.Texto(atual == null
                ? "Sem encantamento."
                : "Encantamento: " + IconeDaFortificacao(atual.Tipo) + " " + Encantamentos.NomeDoEncantamento(atual) + ": "
                    + Encantamentos.EfeitoDoEncantamento(atual.Tipo, atual.Nivel), "runa-da-ficha"));

            botoes.Add(PecasDaTela.Texto("Fortificar com", "titulo-das-runas"));
            var tipos = PecasDaTela.Bloco("abas-de-texto", "abas-da-ficha");
            foreach (var tipo in GameData.EncantamentosTable.TiposDeEncantamento)
            {
                var este = tipo;
                tipos.Add(Aba(IconeDaFortificacao(tipo) + " " + NomeDaFortificacao(tipo), tipo == _fortificacao, () => _fortificacao = este));
            }
            botoes.Add(tipos);

            var niveis = PecasDaTela.Bloco("abas-de-texto", "abas-da-ficha");
            for (int n = 1; n <= GameData.ItemTable.Romanos.Count; n++)
            {
                double nivel = n;
                niveis.Add(Aba(GameData.ItemTable.Romanos[n - 1] + " · " + PecasDaTela.Inteiro(Encantamentos.CustoDoEncantamento(nivel)) + " ouro",
                    nivel == _nivelDoEncanto, () => _nivelDoEncanto = nivel));
            }
            botoes.Add(niveis);

            var escolhido = new EncantamentoNaPeca { Tipo = _fortificacao, Nivel = _nivelDoEncanto };
            botoes.Add(PecasDaTela.Texto(Encantamentos.NomeDoEncantamento(escolhido) + ": " + Encantamentos.EfeitoDoEncantamento(_fortificacao, _nivelDoEncanto),
                "runa-da-ficha"));

            double custo = Encantamentos.CustoDoEncantamento(_nivelDoEncanto);
            double falta = custo - encantadora.Estado.Hero.Gold;
            bool igual = atual != null && atual.Tipo == _fortificacao && atual.Nivel == _nivelDoEncanto;
            if (igual) botoes.Add(PecasDaTela.Texto("A peça já tem essa fortificação.", "aviso-da-ficha"));
            else if (falta > 0) botoes.Add(PecasDaTela.Texto("Faltam " + PecasDaTela.Inteiro(falta) + " de ouro.", "aviso-da-ficha"));
            else if (atual != null) botoes.Add(PecasDaTela.Texto(Encantamentos.NomeDoEncantamento(atual) + " se desfaz.", "aviso-da-ficha"));
            botoes.Add(PecasDaTela.Botao("ENCANTAR POR " + PecasDaTela.Inteiro(custo) + " OURO",
                () => SeguirEncantadora(Encantadoras.Encantar(encantadora, peca, _fortificacao, _nivelDoEncanto)), principal: true, habilitado: !igual && falta <= 0));
        }

        /// <summary>Uma aba de texto (as da mochila): a escolhida sublinhada em ouro.</summary>
        private Button Aba(string texto, bool escolhida, System.Action escolher)
        {
            var botao = new Button(() => Escolher(escolher)) { text = texto };
            botao.AddToClassList("aba-de-texto");
            if (escolhida) botao.AddToClassList("aba-escolhida");
            return botao;
        }

        private static string IconeDaFortificacao(string tipo) =>
            GameData.EncantamentosTable.Encantamentos.TryGet(tipo, out var def) && def != null ? def.Icone : "";

        private static string NomeDaFortificacao(string tipo) =>
            GameData.EncantamentosTable.Encantamentos.TryGet(tipo, out var def) && def != null ? def.Nome : tipo;

        /// <summary>Na ficha da mochila: o encantamento da armadura, se ela tiver um.</summary>
        private static void EncantamentoNaFicha(Item item, VisualElement botoes)
        {
            var encantamento = item.Encantamento;
            if (encantamento == null || !Encantamentos.PodeEncantar(item)) return;
            botoes.Add(PecasDaTela.Texto("Encantamento: " + IconeDaFortificacao(encantamento.Tipo) + " " + Encantamentos.NomeDoEncantamento(encantamento) + ": "
                + Encantamentos.EfeitoDoEncantamento(encantamento.Tipo, encantamento.Nivel), "runa-da-ficha"));
        }
    }
}
