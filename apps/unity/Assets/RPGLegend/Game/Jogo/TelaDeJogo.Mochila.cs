using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A mochila (tela-mochila.tsx, equipamento.tsx e o arranjo "Assim" do usuário): o boneco com os espaços em
    /// volta e, logo embaixo, a ficha da peça escolhida; o guardado ao lado, com as abas em texto. O cartão de
    /// guilda fica à esquerda, sem o retrato e com o "+" dos pontos de atributo — no site é ali que o nível sobe.
    /// A grade seleciona, a ficha age.
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        /// <summary>TS: ROTULO_DO_SLOT.</summary>
        private static readonly Dictionary<string, string> RotuloDoSlot = new Dictionary<string, string>
        {
            ["arma"] = "Arma", ["secundaria"] = "Secundária", ["elmo"] = "Elmo", ["armadura"] = "Peitoral",
            ["calca"] = "Perneira", ["botas"] = "Botas", ["acessorio"] = "Acessório",
        };

        /// <summary>Pela esquerda, da cabeça aos pés; pela direita, o que vai nas mãos e o acessório.</summary>
        private static readonly string[] SlotsDaEsquerda = { "elmo", "armadura", "calca", "botas" };
        private static readonly string[] SlotsDaDireita = { "arma", "secundaria", "acessorio" };

        private static readonly string[] Abas = { "todos", "arma", "armadura", "acessorio", "consumivel", "material", "runa" };

        private void TelaDaMochila(Mochila mochila)
        {
            var estado = mochila.Estado;
            var hero = estado.Hero;
            _sairDaTela = () => _partida.Fechar(mochila.Estado);

            Item aberta = estado.Inventory.Find(item => item.Uid == _selecionado);
            if (aberta == null)
                foreach (var slot in StatKeys.EquipSlots)
                {
                    var peca = hero.Equip?.Get(slot);
                    if (peca != null && peca.Uid == _selecionado) aberta = peca;
                }

            JanelaLarga("🎒 Mochila", Ouro(hero), Ultima(mochila.Log), colunas =>
            {
                var cartao = Coluna("rolagem-do-cartao", "coluna-do-cartao");
                cartao.Add(CartaoDeGuilda.Criar(hero, false, chave =>
                {
                    var proxima = Mochilas.GastarPonto(mochila, chave);
                    SeguirMochila(proxima);
                }, Conquistas.TituloDoHeroi(mochila.Estado.Progresso)));
                colunas.Add(cartao);

                var equipado = Coluna("rolagem-do-equipado", "coluna-larga");
                equipado.Add(PecasDaTela.Secao("Equipado"));
                equipado.Add(Equipamento(hero));
                var ficha = PecasDaTela.FichaDeItem(aberta, hero, botoes => AcoesDaPeca(mochila, aberta, botoes),
                    "Escolha uma peça — equipada ou guardada — para ver o que ela faz e o que muda em você.");
                equipado.Add(ficha);
                // A ficha mora embaixo do boneco: escolher uma carta no guardado a deixaria fora da vista.
                if (_fichaPedida) _mostrarDepois = ficha;
                _fichaPedida = false;
                colunas.Add(equipado);

                var guardado = Coluna("rolagem-do-guardado", "coluna-larga");
                guardado.Add(PecasDaTela.Secao("Guardado"));
                var abas = PecasDaTela.Bloco("abas-de-texto");
                foreach (var aba in Abas)
                {
                    var esta = aba;
                    var botao = new Button(() => Escolher(() => _aba = esta))
                    {
                        text = aba == "todos" ? "Todos" : GameData.ItemTable.CategoryLabels.Get(aba) ?? aba,
                    };
                    botao.AddToClassList("aba-de-texto");
                    if (aba == _aba) botao.AddToClassList("aba-escolhida");
                    abas.Add(botao);
                }
                guardado.Add(abas);

                var guardados = estado.Inventory.FindAll(item => !item.Equipped && (_aba == "todos" || Items.CategoryOf(item) == _aba));
                if (guardados.Count == 0)
                {
                    guardado.Add(PecasDaTela.Texto("Nada aqui.", "vazio"));
                }
                else
                {
                    var grade = PecasDaTela.Grade();
                    foreach (var item in guardados)
                    {
                        var uid = item.Uid;
                        grade.Add(PecasDaTela.CartaDeItem(item, null, uid == _selecionado, () => EscolherPeca(uid)));
                    }
                    guardado.Add(grade);
                }
                colunas.Add(guardado);
            }, ("FECHAR", _sairDaTela));
        }

        private void SeguirMochila(Mochila proxima) => _partida.Seguir(new TelaAberta { Tipo = "mochila", Mochila = proxima }, proxima.Estado);

        /// <summary>TS: Equipamento — cada espaço ao lado da parte do corpo que veste; o espaço ocupado seleciona.</summary>
        private VisualElement Equipamento(Hero hero)
        {
            var equipamento = PecasDaTela.Bloco("equipamento");
            var esquerda = PecasDaTela.Bloco("espacos-do-equipamento");
            foreach (var slot in SlotsDaEsquerda) esquerda.Add(Espaco(slot, hero.Equip?.Get(slot)));
            equipamento.Add(esquerda);
            var boneco = PecasDaTela.Bloco("balao-do-boneco");
            boneco.Add(Paperdoll.Criar(hero, 192));
            equipamento.Add(boneco);
            var direita = PecasDaTela.Bloco("espacos-do-equipamento");
            foreach (var slot in SlotsDaDireita) direita.Add(Espaco(slot, hero.Equip?.Get(slot)));
            equipamento.Add(direita);
            return equipamento;
        }

        private VisualElement Espaco(string slot, Item peca)
        {
            var espaco = PecasDaTela.Bloco("espaco");
            espaco.Add(PecasDaTela.Texto(RotuloDoSlot[slot], "rotulo-do-espaco"));
            if (peca == null)
            {
                espaco.AddToClassList("espaco-vazio");
                espaco.Add(PecasDaTela.Bloco("moldura-do-sprite"));
                espaco.Add(PecasDaTela.Texto("vazio", "nome-do-espaco"));
                return espaco;
            }
            var visao = Items.View(peca);
            var cor = PecasDaTela.CorDaRaridade(visao.RarityColorVar);
            espaco.style.borderLeftColor = cor;
            espaco.Add(PecasDaTela.Imagem(PecasDaTela.SpriteDoArquivo(visao.Sprite), 36));
            var nome = PecasDaTela.Texto(visao.Name, "nome-do-espaco");
            nome.style.color = cor;
            espaco.Add(nome);
            var uid = peca.Uid;
            PecasDaTela.Clicavel(espaco, uid == _selecionado, () => EscolherPeca(uid));
            return espaco;
        }

        /// <summary>A ficha da peça escolhida aparece embaixo do boneco: a coluna rola até ela.</summary>
        private bool _fichaPedida;

        private void EscolherPeca(string uid)
        {
            _selecionado = uid;
            _fichaPedida = true;
            Redesenhar();
        }

        /// <summary>
        /// TS: AcoesDaPeca — os botões da peça aberta. Com uma arma de duas mãos na principal, a secundária está
        /// fechada: no lugar de um "Equipar" que só responderia com recusa vem o aviso dizendo qual arma ocupa, e um
        /// botão que diz o que vai acontecer. Descartar limpa a seleção porque a peça deixa de existir.
        /// </summary>
        private void AcoesDaPeca(Mochila mochila, Item item, VisualElement botoes)
        {
            if (item == null) return;
            var estado = mochila.Estado;
            var slot = Mochilas.SlotDoItem(estado, item);
            var armaOcupando = Mochilas.ArmaQueOcupaAsMaos(estado, item);
            bool temOutroSlot = Items.CategoryOf(item) == "arma";

            if (armaOcupando != null)
                botoes.Add(PecasDaTela.Texto(Items.DisplayName(armaOcupando) + " ocupa as duas mãos. Para usar " + Items.DisplayName(item)
                    + " na mão secundária, a arma vai para a mochila.", "aviso-da-ficha"));

            if (slot != null) botoes.Add(PecasDaTela.Botao("GUARDAR", () => SeguirMochila(Mochilas.Desequipar(mochila, slot))));
            else if (Mochilas.PodeEquipar(item) && (armaOcupando == null || temOutroSlot))
                botoes.Add(PecasDaTela.Botao("EQUIPAR", () => SeguirMochila(Mochilas.Equipar(mochila, item))));

            if (armaOcupando != null)
                botoes.Add(PecasDaTela.Botao("GUARDAR " + Items.DisplayName(armaOcupando).ToUpperInvariant() + " E EQUIPAR",
                    () => SeguirMochila(Mochilas.EquiparNoLugarDaArma(mochila, item)), principal: true));

            if (slot == null && armaOcupando == null && Mochilas.AceitaMaoSecundaria(item))
                botoes.Add(PecasDaTela.Discreto("Mão secundária", () => SeguirMochila(Mochilas.Equipar(mochila, item, "secundaria"))));

            if (Mochilas.PodeUsar(item)) botoes.Add(PecasDaTela.Botao("USAR", () => SeguirMochila(Mochilas.Usar(mochila, item))));

            AcoesDeRuna(mochila, item, botoes);
            EncantamentoNaFicha(item, botoes);

            botoes.Add(PecasDaTela.Discreto("Descartar", () =>
            {
                _selecionado = null;
                SeguirMochila(Mochilas.Descartar(mochila, item));
            }));
        }

        /// <summary>
        /// As runas na ficha (só o app): numa arma, os espaços e as runas engastadas, cada uma com o "Tirar" e a chance
        /// de quebrar; numa runa, o que ela faz e o engaste na arma que está na mão — cheia, a escolha de qual se desfaz.
        /// </summary>
        private void AcoesDeRuna(Mochila mochila, Item item, VisualElement botoes)
        {
            double espacos = Runas.EspacosDeRuna(item);
            if (espacos > 0)
            {
                var runas = Runas.RunasDaArma(item);
                botoes.Add(PecasDaTela.Texto("Runas: " + runas.Count + " de " + Js.NumberToString(espacos) + (espacos > 1 ? " espaços" : " espaço"), "titulo-das-runas"));
                for (int i = 0; i < runas.Count; i++)
                {
                    int indice = i;
                    var runa = runas[i];
                    botoes.Add(PecasDaTela.Texto(Runas.IconeDe(runa.Runa) + " " + Runas.NomeDaRuna(runa) + ": " + EfeitoDaRuna(runa.Runa, runa.Tier), "runa-da-ficha"));
                    string quebra = Pct(Mochilas.ChanceDeQuebrar(item, indice));
                    botoes.Add(PecasDaTela.Discreto("Tirar " + Runas.NomeDaRuna(runa) + " (" + quebra + " de quebrar)", () =>
                        SeguirMochila(Mochilas.TirarRuna(mochila, item, indice, Rng.Default))));
                }
                return;
            }

            string tipo = Runas.RunaDoItem(item);
            if (tipo == null) return;
            botoes.Add(PecasDaTela.Texto(Maiuscula(EfeitoDaRuna(tipo, Runas.TierDaRuna(item))), "runa-da-ficha"));
            var arma = mochila.Estado.Hero.Equip?.Get("arma");
            if (arma == null)
            {
                botoes.Add(PecasDaTela.Texto("Equipe uma arma para engastar a runa nela.", "aviso-da-ficha"));
                return;
            }
            var naArma = Runas.RunasDaArma(arma);
            if (naArma.Count < Runas.EspacosDeRuna(arma))
            {
                botoes.Add(PecasDaTela.Botao("ENGASTAR EM " + Items.DisplayName(arma).ToUpperInvariant(), () =>
                    SeguirMochila(Mochilas.EngastarRuna(mochila, arma, item)), principal: true));
                return;
            }
            botoes.Add(PecasDaTela.Texto(Items.DisplayName(arma) + " está com os espaços cheios: a runa nova toma o lugar de uma, e a antiga se desfaz.",
                "aviso-da-ficha"));
            for (int i = 0; i < naArma.Count; i++)
            {
                int indice = i;
                botoes.Add(PecasDaTela.Botao("NO LUGAR DA " + Runas.NomeDaRuna(naArma[i]).ToUpperInvariant(), () =>
                    SeguirMochila(Mochilas.EngastarRuna(mochila, arma, item, indice))));
            }
        }

        /// <summary>O que a runa faz, com os números do tier dela (a régua é a de items/runas.ts).</summary>
        private static string EfeitoDaRuna(string tipo, double tier)
        {
            var tabela = GameData.RunasTable;
            if (!tabela.Runas.TryGet(tipo, out var def) || def == null) return "";
            int t = (int)System.Math.Max(1, System.Math.Min(def.Chance.Count, System.Math.Truncate(tier))) - 1;
            string chance = Pct(def.Chance[t]);
            string forca = Pct(def.Forca[t]);
            string turnos = Js.NumberToString(tabela.TurnosDaRuna);
            switch (tipo)
            {
                case "eletrica": return "no acerto, " + chance + " de chance de um choque de " + forca + " do dano do golpe, e o monstro fica atordoado.";
                case "fogo": return "no acerto, " + chance + " de chance de queimar o monstro: " + forca + " do dano do golpe por turno, por " + turnos + " turnos.";
                case "gelo": return "no acerto, " + chance + " de chance de deixar o monstro lento por " + turnos + " turnos (" + forca + " de chance de ele hesitar).";
                case "vampirica": return "no acerto, " + chance + " de chance de curar " + forca + " do dano do golpe.";
                default: return "";
            }
        }

        private static string Pct(double fracao) => Js.NumberToString(System.Math.Round(fracao * 100)) + "%";

        private static string Maiuscula(string texto) => string.IsNullOrEmpty(texto) ? texto : char.ToUpperInvariant(texto[0]) + texto.Substring(1);
    }
}
