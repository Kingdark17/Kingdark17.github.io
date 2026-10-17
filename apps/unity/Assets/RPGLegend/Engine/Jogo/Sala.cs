using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Aviso — a caixinha de diálogo que a tela mostra depois de algo acontecer na sala.</summary>
    public sealed class Aviso
    {
        public string Icone;
        public string Titulo;
        public string Texto;

        public Aviso() { }

        public Aviso(string icone, string titulo, string texto)
        {
            Icone = icone;
            Titulo = titulo;
            Texto = texto;
        }
    }

    /// <summary>
    /// TS: TelaAberta — o que troca a tela de exploração por outra. A união do TS vira <see cref="Tipo"/> e o campo
    /// daquele tipo preenchido (os outros ficam null e não vão pro JSON). O painel ADM fica fora do porte.
    /// </summary>
    public sealed class TelaAberta
    {
        /// <summary>"combate", "loja", "dialogo", "missoes", "evento", "mochila", "guilda", "portao", "totem" ou "professor".</summary>
        public string Tipo;
        public Combate Combate;
        public Loja Loja;
        public Dialogo Dialogo;
        public Quadro Quadro;
        public Evento Evento;
        public Mochila Mochila;
        public Guilda Guilda;
        public Portao Portao;
        public Totem Totem;
        public Professor Professor;
    }

    /// <summary>TS: ResultadoDaInteracao.</summary>
    public sealed class ResultadoDaInteracao
    {
        public EstadoDoJogo Estado;
        [KeepNull] public Aviso Aviso;
        [KeepNull] public TelaAberta Tela;
        /// <summary>TS: Efeito — o som da sala; null quando ela não tem um.</summary>
        public string Som;
        /// <summary>A etapa dos Primeiros Passos concluída agora.</summary>
        [KeepNull] public Recado Recado;
    }

    /// <summary>As tabelas de jogo/sala.ts (fixtures/data/jogo/sala.json; PASSO_DA_SALA é privada).</summary>
    public sealed class SalaData
    {
        /// <summary>Qual etapa dos Primeiros Passos cada tipo de sala fecha.</summary>
        [JsName("PASSO_DA_SALA")] public OrderedMap<string> PassoDaSala = new OrderedMap<string>();
    }

    public static partial class GameData
    {
        private static SalaData _salaTable;

        /// <summary>jogo/sala: as etapas do tutorial por sala.</summary>
        public static SalaData SalaTable
        {
            get => Require(_salaTable, "jogo/sala");
            set => _salaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/sala.ts: o que acontece numa sala. Desde o andar solto o herói encosta no conteúdo
    /// (baú, NPC, loja, escada…); a sala de monstro começa a luta assim que se entra (<see cref="LutaAoEntrar"/>),
    /// e a escada e a saída perguntam antes (<see cref="ConfirmaAoTocar"/>), porque não têm volta.
    /// </summary>
    public static class Salas
    {
        private static SalaData D => GameData.SalaTable;

        /// <summary>TS: lutaAoEntrar — sala de monstro ainda não batida.</summary>
        public static bool LutaAoEntrar(RoomCell celula) =>
            celula != null && (celula.Type == DungeonRoomTypes.Monster || celula.Type == DungeonRoomTypes.Boss) &&
            !((celula as DungeonCell)?.Beaten ?? false);

        /// <summary>TS: confirmaAoTocar — só o que não tem volta: a escada e a saída.</summary>
        public static bool ConfirmaAoTocar(RoomCell celula) =>
            celula != null && (celula.Type == DungeonRoomTypes.Stairs || celula.Type == DungeonRoomTypes.Exit);

        private static ResultadoDaInteracao Nada(EstadoDoJogo estado) => new ResultadoDaInteracao { Estado = estado, Aviso = null, Tela = null };

        private static ResultadoDaInteracao ComAviso(EstadoDoJogo estado, string icone, string titulo, string texto, string som = null) =>
            new ResultadoDaInteracao { Estado = estado, Aviso = new Aviso(icone, titulo, texto), Tela = null, Som = som };

        private static ResultadoDaInteracao ComTela(EstadoDoJogo estado, TelaAberta tela, string som = null) =>
            new ResultadoDaInteracao { Estado = estado, Aviso = null, Tela = tela, Som = som };

        /// <summary>
        /// TS: interagir — resolve a sala em que o jogador está. A etapa do tutorial é marcada antes de montar a
        /// tela da sala. <paramref name="pet"/> é o cosmético da conta (só a luta usa); <paramref name="now"/> é o
        /// relógio do estoque, das missões, do andar de baixo e do prêmio do tutorial. <paramref name="app"/>: quem
        /// joga é o app, e o que a sala faz nascer (o estoque do ferreiro, o andar de baixo, o item do evento, o andar
        /// do portão) pode vir com material.
        /// </summary>
        public static ResultadoDaInteracao Interagir(EstadoDoJogo estado, RngFn rng = null, string pet = null, Func<double> now = null, bool app = false)
        {
            rng = rng ?? Rng.Default;
            var antes = ComEtapaDaSala(estado, rng, now);
            var resultado = antes.Estado.MapMode == "city" ? NaCidade((EstadoNaCidade)antes.Estado, rng, now, app) : NaMasmorra(antes.Estado, rng, pet, now, app);
            resultado.Recado = antes.Recado;
            return resultado;
        }

        /// <summary>TS: comEtapaDaSala — a sala de monstro já limpa e a guilda do Aprendiz não marcam nada.</summary>
        private static ResultadoDoPasso ComEtapaDaSala(EstadoDoJogo estado, RngFn rng, Func<double> now)
        {
            var celula = Estados.CelulaAtual(estado);
            var passo = celula != null ? D.PassoDaSala.Get(celula.Type) : null;
            if (passo == null) return new ResultadoDoPasso { Estado = estado, Recado = null };

            bool jaBatida = passo == "combat" && ((celula as DungeonCell)?.Beaten ?? false);
            bool aprendiz = passo == "guild" && !Heroes.HasClass(estado.Hero);
            return jaBatida || aprendiz ? new ResultadoDoPasso { Estado = estado, Recado = null } : Tutoriais.Marcar(estado, passo, rng, now);
        }

        private static ResultadoDaInteracao NaCidade(EstadoNaCidade estado, RngFn rng, Func<double> now, bool app)
        {
            var celula = Estados.CelulaAtual(estado);
            if (celula == null) return Nada(estado);

            switch (celula.Type)
            {
                case "gate":
                    // O Aprendiz não desce: sem classe ele não tem arma nem poder.
                    if (!Heroes.HasClass(estado.Hero))
                        return ComAviso(estado, "🌟", "Portão da Masmorra",
                            "O guarda barra a passagem: a masmorra é só para quem já treinou na Guilda dos Aventureiros, ao lado do caminho até aqui.");
                    return ComTela(estado, new TelaAberta { Tipo = "portao", Portao = Portoes.AbrirPortao(estado, app) });
                case "tavern":
                {
                    var descanso = City.RestAtTavern(estado.Hero, estado.Party);
                    var descansado = estado.Clone();
                    descansado.Hero = descanso.Hero;
                    descansado.Party = descanso.Party;
                    return ComAviso(descansado, "🍺", "Taverna", "Você descansa por uma noite. Vida e mana totalmente restauradas.", "door");
                }
                case "shop":
                    return ComTela(estado, new TelaAberta { Tipo = "loja", Loja = Lojas.AbrirLoja(estado, ShopKinds.Shop, rng, now, app) }, "door");
                case "blacksmith":
                    return ComTela(estado, new TelaAberta { Tipo = "loja", Loja = Lojas.AbrirLoja(estado, ShopKinds.Blacksmith, rng, now, app) }, "door");
                case "questboard":
                    return ComTela(estado, new TelaAberta { Tipo = "missoes", Quadro = QuadroDeMissoes.AbrirQuadro(estado, rng, now) });
                case "guild":
                    return ComTela(estado, new TelaAberta { Tipo = "guilda", Guilda = Guildas.AbrirGuilda(estado) }, "door");
                case "npc":
                    return AbrirConversa(estado);
                case "start":
                    return ComAviso(estado, "🚀", "Ponto de Partida", "Foi aqui que sua jornada começou.");
                default:
                    return Nada(estado);
            }
        }

        private static ResultadoDaInteracao NaMasmorra(EstadoDoJogo qualquer, RngFn rng, string pet, Func<double> now, bool app)
        {
            var celula = Estados.CelulaAtual(qualquer) as DungeonCell;
            if (celula == null || qualquer.MapMode != "dungeon" || !(qualquer is EstadoNaMasmorra estado)) return Nada(qualquer);

            switch (celula.Type)
            {
                case DungeonRoomTypes.Treasure:
                    return AbrirBau(estado, celula, rng, pet);
                case DungeonRoomTypes.Monster:
                case DungeonRoomTypes.Boss:
                    if (celula.Beaten ?? false) return ComAviso(estado, "👾", "Sala Vazia", "Não há mais nada aqui.");
                    return ComTela(estado, new TelaAberta { Tipo = "combate", Combate = Combates.IniciarEncontro(estado, pet) });
                case DungeonRoomTypes.Stairs:
                    return Descer(estado, rng, now, app);
                case DungeonRoomTypes.Exit:
                    return ComAviso(Estados.VoltarParaCidade(estado), "🚪", "De Volta à Cidade", "Você sobe o caminho iluminado e retorna à cidade.", "door");
                case DungeonRoomTypes.Npc:
                    return AbrirConversa(estado);
                case DungeonRoomTypes.Totem:
                {
                    // O toque vale já, e não ao fechar a tela.
                    var totem = Totens.TocarTotem(estado);
                    return ComTela(totem.Estado, new TelaAberta { Tipo = "totem", Totem = totem });
                }
                case DungeonRoomTypes.Teacher:
                {
                    if (celula.Teacher?.Taught ?? false)
                        return ComAviso(estado, "🎓", "Sala do Mestre", "O mestre já seguiu caminho. Ficaram as marcas do treino no chão.");
                    var professor = Professores.AbrirProfessor(estado);
                    return professor != null ? ComTela(estado, new TelaAberta { Tipo = "professor", Professor = professor }) : Nada(estado);
                }
                case DungeonRoomTypes.Event:
                {
                    var evento = Eventos.AbrirEvento(estado, app);
                    if (evento == null) return Nada(estado);
                    // Já resolvido vira aviso, com o ícone e o título do próprio evento.
                    if (evento.Resolvido) return ComAviso(estado, evento.Template.Icon, evento.Template.Title, "Você já resolveu o que havia aqui.");
                    return ComTela(estado, new TelaAberta { Tipo = "evento", Evento = evento });
                }
                case DungeonRoomTypes.Start:
                    return ComAviso(estado, "🚀", "Ponto de Partida", "Foi aqui que você chegou neste andar.");
                default:
                    return Nada(estado);
            }
        }

        private static ResultadoDaInteracao Descer(EstadoNaMasmorra estado, RngFn rng, Func<double> now, bool app)
        {
            var resultado = Estados.DescerEscada(estado, rng, now, app);
            if (resultado.Kind == "selado")
                return ComAviso(estado, "👑", "Caminho Selado", "O poder do chefe bloqueia as escadas. Derrote-o para avançar.");
            if (resultado.Kind == "fundo")
                return ComAviso(estado, "🕳️", "O Fundo", "Não há mais escadas: este é o último andar da masmorra.");
            return ComAviso(resultado.Estado, "⬇️", "Escadas",
                "Você desce mais fundo na masmorra. Andar " + Js.NumberToString(resultado.Estado.Floor) + ". O ar fica mais pesado…", "door");
        }

        /// <summary>
        /// TS: abrirBau — pode ser mímico: a sala vira sala de monstro com o mímico dentro e o prêmio vira o bônus
        /// dele. Ouro, mímico e prêmio sobem com o andar de força.
        /// </summary>
        private static ResultadoDaInteracao AbrirBau(EstadoNaMasmorra estado, DungeonCell celula, RngFn rng, string pet)
        {
            if (celula.Collected ?? false) return ComAviso(estado, "🧰", "Baú Vazio", "Este baú já foi revistado.");

            double forca = Estados.AndarDeForca(estado);

            if (celula.IsMimic ?? false)
            {
                var bonus = PremioDoBau(celula, forca, rng);
                var revelado = celula.Clone();
                revelado.Type = DungeonRoomTypes.Monster;
                revelado.Monsters = new List<MonsterInstance>
                {
                    Monsters.GenerateMimic(forca, new Monsters.GenerateOptions { Rng = rng, Species = Dungeons.ById(estado.Masmorra.Dungeon)?.Species }),
                };
                revelado.MonsterIndex = 0;
                revelado.Beaten = false;
                revelado.BonusTreasure = bonus;
                revelado.IsMimic = false;
                var emboscada = Estados.SubstituirCelulaAtual(estado, revelado);
                return new ResultadoDaInteracao
                {
                    Estado = emboscada,
                    Aviso = new Aviso("🧰", "Mímico!", "O baú cria dentes e revela ser um <b>Mímico</b>!"),
                    Tela = new TelaAberta { Tipo = "combate", Combate = Combates.IniciarEncontro(emboscada, pet) },
                };
            }

            var aberto = celula.Clone();
            aberto.Collected = true;

            if ((celula.GiveGold ?? false) || celula.Item == null)
            {
                double ouro = 8 + Rng.RandomInt(18, rng) + forca * 2;
                var hero = estado.Hero.Clone();
                hero.Gold = estado.Hero.Gold + ouro;
                var comOuro = estado.Clone();
                comOuro.Hero = hero;
                return ComAviso(Estados.SubstituirCelulaAtual(comOuro, aberto), "🧰", "Baú Encontrado",
                    "Você encontra " + Js.NumberToString(ouro) + " moedas de ouro dentro do baú.", "gold");
            }

            var item = celula.Item;
            var comItem = estado.Clone();
            comItem.Inventory = Inventory.AddItem(estado.Inventory, item);
            comItem.Quests = Quests.OnItemCollected(estado.Quests);
            return ComAviso(Estados.SubstituirCelulaAtual(comItem, aberto), "🧰", "Baú Encontrado",
                "<b>" + Items.DisplayName(item) + "</b> " +
                Items.Concordar(item, new[] { "foi adicionado", "foi adicionada", "foram adicionados", "foram adicionadas" }) + " à sua mochila.", "buy");
        }

        private static DungeonTreasureBonus PremioDoBau(DungeonCell celula, double floor, RngFn rng) =>
            (celula.GiveGold ?? false) || celula.Item == null
                ? new DungeonTreasureBonus { Gold = 10 + floor * 3 + Rng.RandomInt(15, rng) }
                : new DungeonTreasureBonus { Item = celula.Item };

        /// <summary>TS: abrirConversa — NPC existe nos dois mapas, com o mesmo formato.</summary>
        private static ResultadoDaInteracao AbrirConversa(EstadoDoJogo estado)
        {
            var dialogo = Dialogos.AbrirDialogo(estado);
            return dialogo == null ? Nada(estado) : ComTela(estado, new TelaAberta { Tipo = "dialogo", Dialogo = dialogo });
        }
    }
}
