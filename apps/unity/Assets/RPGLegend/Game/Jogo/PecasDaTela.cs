using System;
using System.Collections.Generic;
using System.Globalization;
using RPGLegend.Engine;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// As peças que as telas de sala do app repetem, nos moldes das do site: a carta de item (carta-item.tsx), a
    /// ficha da peça com o que ela muda em você (ficha-item.tsx), a carta de poder e os textos de seção. A carta só
    /// seleciona; quem age é o botão da ficha — no site, um toque sem querer vendia a peça.
    /// </summary>
    public static class PecasDaTela
    {
        /// <summary>As cores de raridade do globals.css do site (--r-comum…).</summary>
        private static readonly Dictionary<string, Color> CoresDaRaridade = new Dictionary<string, Color>
        {
            ["--r-comum"] = Hex(0xb7b7b7),
            ["--r-incomum"] = Hex(0x4caf7d),
            ["--r-raro"] = Hex(0x3d8fd6),
            ["--r-epico"] = Hex(0xa15fd6),
            ["--r-lendario"] = Hex(0xe0a13a),
            ["--r-mitico"] = Hex(0xe0483a),
        };

        private static readonly Dictionary<string, Sprite> SpritesDeItem = new Dictionary<string, Sprite>();

        public static Color Hex(int rgb) => new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f);

        public static Color CorDaRaridade(string colorVar) => colorVar != null && CoresDaRaridade.TryGetValue(colorVar, out var cor) ? cor : CoresDaRaridade["--r-comum"];

        /// <summary>
        /// Vírgula decimal, ponto no milhar e até uma casa, como o site escreve número quebrado (toLocaleString pt-BR).
        /// Pela cultura invariante com os separadores trocados: a tabela de culturas do .NET pode não ir no build IL2CPP.
        /// </summary>
        public static string Numero(double valor)
        {
            var invariante = Math.Round(valor, 1, MidpointRounding.AwayFromZero).ToString("#,0.#", CultureInfo.InvariantCulture);
            return invariante.Replace(',', '\u0001').Replace('.', ',').Replace('\u0001', '.');
        }

        /// <summary>O número como o JS o escreve (o ouro, o preço): sem separador de milhar.</summary>
        public static string Inteiro(double valor) => Js.NumberToString(valor);

        /// <summary>A arte do item ("weapons/espada.png" no template), copiada do site em Art/Jogo/Resources/Itens.</summary>
        public static Sprite SpriteDoArquivo(string arquivo)
        {
            if (string.IsNullOrEmpty(arquivo)) return null;
            if (!SpritesDeItem.TryGetValue(arquivo, out var sprite))
            {
                var caminho = arquivo.EndsWith(".png", StringComparison.Ordinal) ? arquivo.Substring(0, arquivo.Length - 4) : arquivo;
                sprite = Resources.Load<Sprite>("Itens/" + caminho);
                SpritesDeItem[arquivo] = sprite;
            }
            return sprite;
        }

        public static Sprite SpriteDoItem(Item item) => SpriteDoArquivo(Items.View(item).Sprite);

        // ---------- elementos ----------

        /// <summary>Texto do jogo: o <c>&lt;b&gt;</c> vira negrito e o resto não é lido como marcação (TextoDoJogo).</summary>
        public static Label Texto(string texto, params string[] classes) => Rico(TextoDoJogo.ParaTela(texto ?? ""), classes);

        /// <summary>
        /// Texto com marcação do próprio app (itálico, cor) em volta de partes que já passaram por
        /// <see cref="TextoDoJogo.ParaTela"/>. Nunca com texto que veio do save ou da rede sem passar por lá.
        /// </summary>
        public static Label Rico(string marcado, params string[] classes)
        {
            var rotulo = new Label(marcado);
            foreach (var classe in classes) rotulo.AddToClassList(classe);
            return rotulo;
        }

        public static VisualElement Bloco(params string[] classes)
        {
            var bloco = new VisualElement();
            foreach (var classe in classes) bloco.AddToClassList(classe);
            return bloco;
        }

        public static VisualElement Imagem(Sprite sprite, float lado, string classe = "sprite-de-item")
        {
            var imagem = new VisualElement { pickingMode = PickingMode.Ignore };
            imagem.AddToClassList(classe);
            imagem.style.width = lado;
            imagem.style.height = lado;
            if (sprite != null) imagem.style.backgroundImage = new StyleBackground(sprite);
            return imagem;
        }

        /// <summary>O botão de pedra pequeno; o principal leva o dourado do botão forte.</summary>
        public static Button Botao(string texto, Action acao, bool principal = false, bool habilitado = true)
        {
            var botao = new Button(acao) { text = texto };
            botao.AddToClassList("botao");
            botao.AddToClassList("botao-pequeno");
            if (principal) botao.AddToClassList("botao-principal");
            botao.SetEnabled(habilitado);
            return botao;
        }

        /// <summary>O botão discreto do site (Descartar, Mão secundária): texto sublinhado, sem pedra.</summary>
        public static Button Discreto(string texto, Action acao)
        {
            var botao = new Button(acao) { text = texto };
            botao.AddToClassList("link");
            botao.AddToClassList("botao-discreto");
            return botao;
        }

        public static Label Secao(string texto) => Texto(texto, "titulo-da-secao");

        /// <summary>Elemento que seleciona ao toque (carta, espaço do boneco): o estado escolhido fica dourado.</summary>
        public static void Clicavel(VisualElement elemento, bool selecionado, Action aoEscolher)
        {
            elemento.AddToClassList("clicavel");
            if (selecionado) elemento.AddToClassList("selecionado");
            elemento.AddManipulator(new Clickable(aoEscolher));
        }

        /// <summary>As cartas, quebrando linha quando não cabem.</summary>
        public static VisualElement Grade() => Bloco("grade-de-cartas");

        /// <summary>TS: CartaItem — sprite, nome na cor da raridade, raridade e tier, atributos e o rodapé.</summary>
        public static VisualElement CartaDeItem(Item item, string rodape, bool selecionada, Action aoEscolher)
        {
            var visao = Items.View(item);
            var cor = CorDaRaridade(visao.RarityColorVar);
            var carta = Bloco("carta");
            carta.style.borderLeftColor = cor;
            carta.Add(Imagem(SpriteDoArquivo(visao.Sprite), 40));
            var nome = Texto(visao.Name, "nome-da-carta");
            nome.style.color = cor;
            carta.Add(nome);
            var tier = Tiers.TierFor(item);
            carta.Add(Texto(visao.RarityLabel + (string.IsNullOrEmpty(tier) ? "" : " · Tier " + tier), "meta-da-carta"));
            var tags = Items.StatTags(item);
            if (tags.Count > 0)
            {
                var textos = new List<string>();
                foreach (var tag in tags) textos.Add(tag.Text);
                carta.Add(Texto(string.Join(" · ", textos), "atributos-da-carta"));
            }
            if (!string.IsNullOrEmpty(rodape)) carta.Add(Texto(rodape, "rodape-da-carta"));
            if (aoEscolher != null) Clicavel(carta, selecionada, aoEscolher);
            return carta;
        }

        /// <summary>Uma carta de escolha sem item (classe, poder): ícone, nome e o texto miúdo.</summary>
        public static VisualElement CartaDeEscolha(string icone, string nome, string detalhe, bool selecionada, Action aoEscolher)
        {
            var carta = Bloco("carta");
            carta.Add(Texto(icone, "icone-da-carta"));
            carta.Add(Texto(nome, "nome-da-carta"));
            if (!string.IsNullOrEmpty(detalhe)) carta.Add(Texto(detalhe, "meta-da-carta"));
            Clicavel(carta, selecionada, aoEscolher);
            return carta;
        }

        /// <summary>
        /// TS: FichaItem — o que a peça é, o que ela dá e o que muda em você se vestir (ou guardar). Os números vêm
        /// de <see cref="Impactos.ImpactoDaPeca"/>, que mede com as mesmas contas do combate.
        /// </summary>
        public static VisualElement FichaDeItem(Item item, Hero hero, Action<VisualElement> acoes, string vazia)
        {
            var ficha = Bloco("ficha-da-peca");
            if (item == null)
            {
                ficha.Add(Texto(vazia, "ficha-vazia"));
                return ficha;
            }

            var visao = Items.View(item);
            var cor = CorDaRaridade(visao.RarityColorVar);
            var cabecalho = Bloco("cabecalho-da-ficha");
            cabecalho.Add(Imagem(SpriteDoArquivo(visao.Sprite), 56));
            var titulos = Bloco("titulos-da-ficha");
            var nome = Texto(visao.Name, "nome-da-ficha");
            nome.style.color = cor;
            titulos.Add(nome);
            var categoria = GameData.ItemTable.CategoryLabels.Get(visao.Category) ?? visao.Category;
            var tier = Tiers.TierFor(item);
            titulos.Add(Texto(categoria + " · " + visao.RarityLabel + (string.IsNullOrEmpty(tier) ? "" : " · Tier " + tier) + " · " + Inteiro(visao.Value) + " ouro", "meta-da-ficha"));
            cabecalho.Add(titulos);
            ficha.Add(cabecalho);

            if (!string.IsNullOrEmpty(visao.Desc)) ficha.Add(Texto(visao.Desc, "descricao-da-ficha"));

            var tags = Items.StatTags(item);
            if (tags.Count > 0)
            {
                var linha = Bloco("atributos-da-ficha");
                foreach (var tag in tags) linha.Add(Texto(tag.Text, tag.Positive ? "atributo-bom" : "atributo-ruim"));
                ficha.Add(linha);
            }

            if (visao.Proc != null)
                ficha.Add(Texto(visao.Proc.Label + " · " + Inteiro(Math.Round(visao.Proc.Chance * 100)) + "% por golpe", "proc-da-ficha"));

            var impacto = Impactos.ImpactoDaPeca(hero, item);
            if (impacto != null)
            {
                var secao = Bloco("impacto");
                secao.Add(Texto(impacto.Acao == "equipar" ? "Se você equipar" : "Se você guardar", "titulo-do-impacto"));
                if (impacto.Linhas.Count == 0) secao.Add(Texto("Não muda nenhum dos seus números.", "impacto-nulo"));
                foreach (var linha in impacto.Linhas)
                {
                    var fileira = Bloco("linha-do-impacto");
                    fileira.Add(Texto(linha.Rotulo, "rotulo-do-impacto"));
                    fileira.Add(Texto(Numero(linha.Antes) + " → " + Numero(linha.Depois), "numeros-do-impacto"));
                    // Os dois lados já chegam arredondados; arredondar a subtração evita o 0,30000000000000004.
                    double delta = Math.Round((linha.Depois - linha.Antes) * 10) / 10;
                    fileira.Add(Texto((delta > 0 ? "+" : "−") + Numero(Math.Abs(delta)), linha.Depois > linha.Antes ? "melhor" : "pior"));
                    secao.Add(fileira);
                }
                ficha.Add(secao);
            }

            var botoes = Bloco("acoes-da-ficha");
            acoes?.Invoke(botoes);
            ficha.Add(botoes);
            return ficha;
        }

        /// <summary>A barra de progresso (missão), no trilho fino das barras do herói.</summary>
        public static VisualElement Barra(double atual, double maximo, string classe)
        {
            var trilho = Bloco("trilho", "trilho-da-tela");
            var enchimento = Bloco("enchimento", classe);
            float parte = maximo > 0 ? Mathf.Clamp01((float)(atual / maximo)) : 0f;
            enchimento.style.width = Length.Percent(parte * 100f);
            trilho.Add(enchimento);
            return trilho;
        }
    }
}
