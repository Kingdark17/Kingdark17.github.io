using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O boneco vestido com o que está equipado agora: port de apps/web/lib/paperdoll/camadas.ts (a ordem das
    /// camadas é a lista numerada do doc do Breno, e qualquer troca passa por ele) e do paperdoll.tsx, só que
    /// parado — a respiração e o golpe do site são CSS e ficam pra depois. A arte é a do site, copiada em
    /// Art/Jogo/Resources/Paperdoll com os mesmos nomes; peça sem arte simplesmente não desenha.
    /// </summary>
    public static class Paperdoll
    {
        private const string Raiz = "Paperdoll/";

        /// <summary>TS: TRACOS_DE_RACA — o que a raça não perde ao vestir armadura.</summary>
        private static readonly Dictionary<string, string> TracosDeRaca = new Dictionary<string, string>
        {
            ["felino"] = "traco/orelhas-de-gato",
            ["draconato"] = "traco/chifres-de-dragao",
            ["celestial"] = "traco/aureola",
        };

        /// <summary>TS: SEM_CABELO — corpos que já vêm com a cabeça resolvida.</summary>
        private static readonly HashSet<string> SemCabelo = new HashSet<string> { "felino", "morto_vivo" };

        /// <summary>TS: CABELO_PADRAO — o penteado de quem não escolheu.</summary>
        private const string CabeloPadrao = "curto";

        private static readonly Dictionary<string, Sprite> Artes = new Dictionary<string, Sprite>();

        private static Sprite Arte(string camada)
        {
            if (!Artes.TryGetValue(camada, out var sprite))
            {
                sprite = Resources.Load<Sprite>(Raiz + camada);
                Artes[camada] = sprite;
            }
            return sprite;
        }

        private static bool Existe(string camada) => Arte(camada) != null;

        /// <summary>
        /// TS: PENTEADOS — os que a criação oferece, do mais curto pro mais longo (a ordem em que a pessoa compara), só
        /// os que têm arte.
        /// </summary>
        public static List<(string Id, string Nome)> Penteados()
        {
            var penteados = new List<(string Id, string Nome)>();
            foreach (var (id, nome) in new[] { ("curto", "Curto"), ("medio", "Médio"), ("longo", "Longo") })
                if (Existe("cabelo/" + id)) penteados.Add((id, nome));
            return penteados;
        }

        /// <summary>A raça tem corpo desenhado (TS: CORPOS.has).</summary>
        public static bool TemCorpo(string raca) => !string.IsNullOrEmpty(raca) && Existe("corpo/" + raca);

        /// <summary>A raça leva cabelo desenhado: felino e morto-vivo têm a cabeça resolvida na própria arte.</summary>
        public static bool LevaCabelo(string raca) => !string.IsNullOrEmpty(raca) && !SemCabelo.Contains(raca);

        /// <summary>
        /// A amostra do penteado na carta de cabelo (.amostraDeCabelo do site): a cabeça do corpo com o cabelo por
        /// cima, a 2×, recortada em 80 × 68.
        /// </summary>
        public static VisualElement AmostraDeCabelo(string raca, string penteado)
        {
            var janela = new VisualElement { pickingMode = PickingMode.Ignore };
            janela.style.width = 80;
            janela.style.height = 68;
            janela.style.overflow = Overflow.Hidden;
            janela.style.flexShrink = 0;
            foreach (var camada in new[] { "corpo/" + raca, "cabelo/" + penteado })
            {
                var arte = Arte(camada);
                if (arte == null) continue;
                var imagem = new VisualElement { pickingMode = PickingMode.Ignore };
                imagem.style.position = Position.Absolute;
                imagem.style.left = -24;
                imagem.style.top = 0;
                imagem.style.width = 128;
                imagem.style.height = 128;
                imagem.style.backgroundImage = new StyleBackground(arte);
                janela.Add(imagem);
            }
            return janela;
        }

        /// <summary>TS: ehPequeno — anão, fada e goblin desenham a imagem final inteira a 3/4.</summary>
        public static bool EhPequeno(string raca) => !string.IsNullOrEmpty(raca) && Catalog.RaceById(raca)?.Porte == "pequeno";

        /// <summary>TS: cabeloDe — penteado válido, ou o padrão; raça sem cabelo desenhado, nada.</summary>
        public static string CabeloDe(string raca, string escolhido)
        {
            if (SemCabelo.Contains(raca)) return null;
            return !string.IsNullOrEmpty(escolhido) && Existe("cabelo/" + escolhido) ? escolhido : CabeloPadrao;
        }

        private static void Vestir(List<string> camadas, string pasta, Item peca)
        {
            var id = peca?.TemplateId;
            if (!string.IsNullOrEmpty(id) && Existe(pasta + "/" + id)) camadas.Add(pasta + "/" + id);
        }

        /// <summary>TS: montarCamadas — as camadas de trás pra frente. Vazia: sem raça, ou raça sem corpo desenhado.</summary>
        public static List<string> Camadas(Hero hero)
        {
            var camadas = new List<string>();
            var raca = Catalog.IdDaRaca(hero.RaceId, hero.Race);
            if (string.IsNullOrEmpty(raca) || !Existe("corpo/" + raca)) return camadas;
            Item Peca(string slot) => hero.Equip?.Get(slot);

            // 1-4: o que fica atrás do corpo (asa e cauda, e o verso das peças).
            if (Existe("back/" + raca)) camadas.Add("back/" + raca);
            Vestir(camadas, "hadd", Peca("elmo"));
            Vestir(camadas, "badd", Peca("armadura"));
            Vestir(camadas, "ladd", Peca("calca"));

            // 5: o corpo, com a roupa de baixo que todo mundo tem.
            camadas.Add("corpo/" + raca);
            camadas.Add("base/calca");
            camadas.Add("base/roupa");

            // 6-8: o que se veste, de baixo pra cima (a bota depois da perneira).
            Vestir(camadas, "calca", Peca("calca"));
            Vestir(camadas, "botas", Peca("botas"));
            Vestir(camadas, "armadura", Peca("armadura"));

            // 9-10: o cabelo por cima do peitoral, o elmo por cima do cabelo; o acessório logo depois.
            var penteado = CabeloDe(raca, hero.Hair);
            if (penteado != null) camadas.Add("cabelo/" + penteado);
            Vestir(camadas, "elmo", Peca("elmo"));
            Vestir(camadas, "acessorio", Peca("acessorio"));

            // 11: o traço da raça, que sobrevive à armadura.
            if (TracosDeRaca.TryGetValue(raca, out var traco) && Existe(traco)) camadas.Add(traco);

            // 12, 13: as mãos, a secundária na frente da principal.
            Vestir(camadas, "arma", Peca("arma"));
            Vestir(camadas, "secundaria", Peca("secundaria"));
            return camadas;
        }

        /// <summary>
        /// O boneco num quadrado de <paramref name="lado"/> px (a arte é 64×64; múltiplos de 64 saem mais nítidos).
        /// Sem corpo desenhado, o emoji da raça no lugar.
        /// </summary>
        public static VisualElement Criar(Hero hero, float lado)
        {
            var boneco = new VisualElement { pickingMode = PickingMode.Ignore };
            boneco.AddToClassList("boneco");
            boneco.style.width = lado;
            boneco.style.height = lado;

            var camadas = Camadas(hero);
            if (camadas.Count == 0)
            {
                var reserva = new Label(string.IsNullOrEmpty(hero.RaceIcon) ? "🙂" : hero.RaceIcon) { pickingMode = PickingMode.Ignore };
                reserva.AddToClassList("reserva-do-boneco");
                boneco.Add(reserva);
                return boneco;
            }

            var pilha = new VisualElement { pickingMode = PickingMode.Ignore };
            pilha.AddToClassList("pilha-do-boneco");
            if (EhPequeno(Catalog.IdDaRaca(hero.RaceId, hero.Race)))
            {
                // Com os pés no chão: a arte termina na linha 61, então a sola fica em 62/64 da altura.
                pilha.style.scale = new Scale(new Vector2(0.75f, 0.75f));
                pilha.style.transformOrigin = new TransformOrigin(Length.Percent(50), Length.Percent(96.875f));
            }
            foreach (var camada in camadas)
            {
                var imagem = new VisualElement { pickingMode = PickingMode.Ignore };
                imagem.AddToClassList("camada-do-boneco");
                imagem.style.backgroundImage = new StyleBackground(Arte(camada));
                pilha.Add(imagem);
            }
            boneco.Add(pilha);
            return boneco;
        }
    }
}
