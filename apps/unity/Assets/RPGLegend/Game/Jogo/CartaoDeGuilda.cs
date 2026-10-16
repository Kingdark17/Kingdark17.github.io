using System;
using RPGLegend.Engine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O cartão de guilda do herói (painel-heroi.tsx do site; arte e decisão do usuário, 2026-10-09): Vida, Mana,
    /// XP, a maestria, os atributos, os poderes e a fraqueza, em tinta sobre o pergaminho. O Aprendiz tem o cartão
    /// provisório, sem selo. Na mochila ele vem sem o retrato (o boneco já está no meio) e com um "+" ao lado de cada
    /// atributo enquanto houver ponto pra gastar.
    /// </summary>
    public static class CartaoDeGuilda
    {
        public static VisualElement Criar(Hero hero, bool comRetrato, Action<string> aoGastarPonto)
        {
            bool treinado = Heroes.HasClass(hero);
            double pontos = hero.AttrPoints ?? 0;
            bool comPontos = aoGastarPonto != null && pontos > 0;

            var cartao = PecasDaTela.Bloco("cartao-de-guilda");
            if (comRetrato)
            {
                var retrato = PecasDaTela.Bloco("retrato-do-cartao");
                retrato.Add(Paperdoll.Criar(hero, 128));
                cartao.Add(retrato);
            }

            var topo = PecasDaTela.Bloco("topo-do-cartao");
            topo.Add(PecasDaTela.Texto(hero.Name, "nome-no-cartao"));
            topo.Add(PecasDaTela.Texto("NÍVEL " + PecasDaTela.Inteiro(hero.Level), "rotulo-do-cartao"));
            cartao.Add(topo);

            var linha = ((hero.RaceIcon ?? "") + " " + (hero.Race ?? "")).Trim() + " · " + ((hero.ClassIcon ?? "") + " " + (hero.ClassName ?? "")).Trim();
            cartao.Add(PecasDaTela.Rico(TextoDoJogo.ParaTela(linha) + (treinado ? "" : " · <i>provisório</i>"), "linha-do-cartao"));

            var medidores = PecasDaTela.Bloco("medidores-do-cartao");
            medidores.Add(Medidor("Vida", hero.Hp, hero.MaxHp, "vida-no-cartao", null, null));
            medidores.Add(Medidor("Mana", hero.Mp, hero.MaxMp, "mana-no-cartao", null, null));
            medidores.Add(Medidor("XP", hero.Xp, hero.XpNext, "xp-no-cartao", null, null));
            var maestria = Maestria.MaestriaNoCartao(hero);
            if (maestria != null)
                medidores.Add(Medidor("Maestria " + PecasDaTela.Inteiro(maestria.Nivel), maestria.Atual, maestria.Maximo, "maestria-no-cartao", maestria.Contagem, maestria.Bonus));
            cartao.Add(medidores);

            if (comPontos)
                cartao.Add(PecasDaTela.Texto("Subiu de nível: " + PecasDaTela.Inteiro(pontos) + (pontos == 1 ? " ponto" : " pontos"), "pontos-do-cartao"));

            // Três por linha, cada número colado no rótulo dele.
            var atributos = PecasDaTela.Bloco("atributos-do-cartao");
            foreach (var chave in StatKeys.Attrs)
            {
                var atributo = PecasDaTela.Bloco("atributo-do-cartao");
                atributo.Add(PecasDaTela.Texto(GameData.HeroCatalog.AttrLabels.Get(chave) ?? chave, "rotulo-do-cartao"));
                atributo.Add(PecasDaTela.Texto(PecasDaTela.Inteiro(hero.Attrs[chave]), "valor-do-cartao"));
                if (comPontos)
                {
                    var esta = chave;
                    var mais = new Button(() => aoGastarPonto(esta)) { text = "+" };
                    mais.AddToClassList("mais-do-cartao");
                    atributo.Add(mais);
                }
                atributos.Add(atributo);
            }
            cartao.Add(atributos);

            var poderes = Cartao.PoderesNoCartao(hero);
            var secao = PecasDaTela.Bloco("secao-do-cartao");
            secao.Add(PecasDaTela.Texto(poderes.Count > 1 ? "PODERES" : "PODER", "rotulo-do-cartao"));
            foreach (var poder in poderes)
            {
                var nome = TextoDoJogo.ParaTela(((poder.Icone ?? "") + " " + poder.Nome).Trim());
                secao.Add(PecasDaTela.Rico(nome + " <color=#6e5137>· " + PecasDaTela.Inteiro(poder.Custo) + " MP</color>", "texto-do-cartao"));
            }
            if (poderes.Count == 0)
                secao.Add(PecasDaTela.Rico(treinado ? "<i>Nenhum.</i>" : "<i>Nenhum ainda: a Guilda ensina o primeiro.</i>", "texto-do-cartao"));
            cartao.Add(secao);

            var fraqueza = Cartao.FraquezaNoCartao(hero);
            if (fraqueza != null)
            {
                var daFraqueza = PecasDaTela.Bloco("secao-do-cartao");
                daFraqueza.Add(PecasDaTela.Texto("FRAQUEZA", "rotulo-do-cartao"));
                daFraqueza.Add(PecasDaTela.Texto(((fraqueza.Icone ?? "") + " " + fraqueza.Nome).Trim(), "texto-do-cartao"));
                daFraqueza.Add(PecasDaTela.Texto(fraqueza.Efeito, "efeito-do-cartao"));
                cartao.Add(daFraqueza);
            }

            // O selo é da Guilda: o Aprendiz ainda não treinou.
            if (treinado) cartao.Add(PecasDaTela.Bloco("selo-do-cartao"));
            return cartao;
        }

        private static VisualElement Medidor(string rotulo, double atual, double maximo, string cor, string contagem, string nota)
        {
            var medidor = PecasDaTela.Bloco("medidor-do-cartao");
            var cima = PecasDaTela.Bloco("cima-do-medidor");
            cima.Add(PecasDaTela.Texto(rotulo.ToUpperInvariant(), "rotulo-do-cartao"));
            cima.Add(PecasDaTela.Texto(contagem ?? PecasDaTela.Inteiro(atual) + "/" + PecasDaTela.Inteiro(maximo), "numero-do-cartao"));
            medidor.Add(cima);
            var trilho = PecasDaTela.Bloco("trilho-do-cartao");
            var enchimento = PecasDaTela.Bloco("enchimento-do-cartao", cor);
            float parte = maximo > 0 ? UnityEngine.Mathf.Clamp01((float)(atual / maximo)) : 0f;
            enchimento.style.width = Length.Percent(parte * 100f);
            trilho.Add(enchimento);
            medidor.Add(trilho);
            if (!string.IsNullOrEmpty(nota)) medidor.Add(PecasDaTela.Texto(nota, "nota-do-medidor"));
            return medidor;
        }
    }
}
