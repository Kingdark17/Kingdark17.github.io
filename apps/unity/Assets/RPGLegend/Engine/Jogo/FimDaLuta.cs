using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: PassoDaLuta — o estado depois do passo, e o que ele escreveu no diário da luta, em ordem.</summary>
    public class PassoDaLuta<E> where E : EstadoDoJogo
    {
        public E Estado;
        public List<string> Log;
    }

    /// <summary>TS: SalaLimpa — o estado (que pode já ser o andar seguinte ou a cidade), o diário e o item achado.</summary>
    public sealed class SalaLimpa : PassoDaLuta<EstadoDoJogo>
    {
        [KeepNull] public Item Loot;
    }

    /// <summary>As tabelas de jogo/fim-da-luta.ts (todas privadas no TS).</summary>
    public sealed class FimDaLutaData
    {
        [JsName("CHANCE_DE_LOOT_NORMAL")] public double ChanceDeLootNormal;
        [JsName("CHANCE_DE_LOOT_CHEFE")] public double ChanceDeLootChefe;
        /// <summary>Abaixo deste nível a derrota não cobra nada (a proteção de iniciante).</summary>
        [JsName("NIVEL_SEM_PENALIDADE")] public double NivelSemPenalidade;
    }

    public static partial class GameData
    {
        private static FimDaLutaData _fimDaLutaTable;

        /// <summary>jogo/fim-da-luta: as chances de item ao limpar a sala e a proteção de iniciante.</summary>
        public static FimDaLutaData FimDaLutaTable
        {
            get => Require(_fimDaLutaTable, "jogo/fim-da-luta");
            set => _fimDaLutaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/fim-da-luta.ts: o começo e o fim de uma luta, e o monstro que cai no meio dela —
    /// a bênção do NPC, o XP e o ouro de cada abate, a sala limpa (item, tesouro bônus, maestria, o chefe que leva
    /// ao andar seguinte ou zera a masmorra) e a derrota. É o que a luta por turnos do site e a luta em tempo real
    /// do app pagam igual. Tudo sobre a sala atual, onde os monstros moram com a vida que têm.
    /// </summary>
    public static class FimDaLuta
    {
        private static FimDaLutaData D => GameData.FimDaLutaTable;

        /// <summary>O <c>lista[indice]</c> do JS: fora da lista, negativo ou quebrado é undefined (null).</summary>
        private static MonsterInstance MonstroEm(List<MonsterInstance> lista, double indice)
        {
            if (lista == null || !(indice >= 0) || indice >= lista.Count || Math.Floor(indice) != indice) return null;
            return lista[(int)indice];
        }

        /// <summary>TS: vivoNaSala — com vida e não atrás do monsterIndex (nos saves da fila, quem ficou pra trás caiu).</summary>
        public static bool VivoNaSala(DungeonCell sala, double indice)
        {
            var bruto = MonstroEm(sala.Monsters, indice);
            return bruto != null && indice >= (sala.MonsterIndex ?? 0) && bruto.Hp > 0;
        }

        /// <summary>TS: indicesDePe — os índices de quem está de pé, na ordem da sala.</summary>
        public static List<double> IndicesDePe(DungeonCell sala)
        {
            var dePe = new List<double>();
            for (int i = 0; i < (sala.Monsters?.Count ?? 0); i++)
                if (VivoNaSala(sala, i)) dePe.Add(i);
            return dePe;
        }

        /// <summary>
        /// TS: gravarMonstro — grava o monstro <paramref name="indice"/> de volta na sala atual, sem os campos que a
        /// visão (<see cref="Monsters.View"/>) acrescenta: nome, ícone e espécie iriam parar dentro do save.
        /// </summary>
        public static EstadoNaMasmorra GravarMonstro(EstadoNaMasmorra estado, double indice, CombatMonster monstro)
        {
            var sala = (DungeonCell)Estados.CelulaAtual(estado);
            var cru = new CombatMonster();
            monstro.CopyInstanceFieldsTo(cru);
            monstro.CopyCombatFieldsTo(cru);
            foreach (var chave in CombatMonsterView.ViewKeys) cru.ForgetExtras(chave);
            var origem = sala.Monsters ?? new List<MonsterInstance>();
            var monsters = new List<MonsterInstance>(origem.Count);
            for (int i = 0; i < origem.Count; i++) monsters.Add(i == indice ? cru : origem[i]);
            var nova = sala.Clone();
            nova.Monsters = monsters;
            return Estados.SubstituirCelulaAtual(estado, nova);
        }

        /// <summary>
        /// TS: prepararLuta — zera os buffs da luta anterior, consome uma bênção de NPC se houver e deixa cada
        /// criatura de pé pronta pra receber status.
        /// </summary>
        public static PassoDaLuta<EstadoNaMasmorra> PrepararLuta(EstadoNaMasmorra estado)
        {
            var sala = (DungeonCell)Estados.CelulaAtual(estado);
            var log = new List<string>();

            double dodge = estado.Hero.NpcBlessing?.Dodge ?? 0;
            var semBuffs = estado.Hero.Clone();
            semBuffs.Buffs = new HeroBuffs();
            var bencao = NpcServices.ApplyNpcBlessing(semBuffs);
            if (bencao.Applied) log.Add("A bênção recebida concede +" + Js.NumberToString(dodge) + "% de Esquiva neste combate.");

            var origem = sala.Monsters ?? new List<MonsterInstance>();
            var monsters = new List<MonsterInstance>(origem.Count);
            for (int i = 0; i < origem.Count; i++)
                monsters.Add(VivoNaSala(sala, i) ? MonsterState.FreshCombatMonster(origem[i]) : origem[i]);

            var comHeroi = estado.Clone();
            comHeroi.Hero = bencao.Hero;
            var preparada = sala.Clone();
            preparada.Monsters = monsters;
            return new PassoDaLuta<EstadoNaMasmorra> { Estado = Estados.SubstituirCelulaAtual(comHeroi, preparada), Log = log };
        }

        /// <summary>
        /// TS: pagarAbate — paga o monstro que caiu (XP, ouro, a conta de abates e a missão) e faz o monsterIndex
        /// voltar a apontar o primeiro de pé. A luta não acaba aqui.
        /// </summary>
        public static PassoDaLuta<EstadoNaMasmorra> PagarAbate(EstadoNaMasmorra estado, CombatMonsterView abatido)
        {
            var log = new List<string>();

            var pago = estado.Hero.Clone();
            pago.KillCount = estado.Hero.KillCount + 1;
            pago.Gold = estado.Hero.Gold + abatido.Gold;
            var xp = Heroes.GainXP(pago, abatido.Xp);
            log.Add("Você derrotou " + Js.Str(abatido.Name) + "! +" + Js.NumberToString(abatido.Xp) + " XP e +" + Js.NumberToString(abatido.Gold) + " ouro.");
            if (xp.LeveledUp) log.Add("Você subiu " + Js.NumberToString(xp.Levels) + " nível(is)!");

            var comRecompensa = estado.Clone();
            comRecompensa.Hero = xp.Hero;
            comRecompensa.Quests = Quests.OnMonsterKilled(estado.Quests);
            var sala = (DungeonCell)Estados.CelulaAtual(comRecompensa);
            var dePe = IndicesDePe(sala);
            // Ninguém de pé: o índice fica onde estava, como na fila — quem lê a sala vencida olha beaten.
            if (dePe.Count == 0) return new PassoDaLuta<EstadoNaMasmorra> { Estado = comRecompensa, Log = log };

            var comIndice = sala.Clone();
            comIndice.MonsterIndex = dePe[0];
            return new PassoDaLuta<EstadoNaMasmorra> { Estado = Estados.SubstituirCelulaAtual(comRecompensa, comIndice), Log = log };
        }

        /// <summary>
        /// TS: limparSala — o último inimigo caiu: a sala fica marcada, os companheiros temporários se despedem e
        /// vem a recompensa (a chance de item, o tesouro bônus e a maestria). O chefe leva ao andar seguinte; o do
        /// último andar zera a masmorra e devolve o grupo à cidade. Ordem dos sorteios: a chance de item, o item (se
        /// caiu) e o andar novo (se foi chefe de andar). <paramref name="now"/> é o relógio do uid do item e do andar.
        /// </summary>
        public static SalaLimpa LimparSala(EstadoNaMasmorra estado, CombatMonsterView abatido, RngFn rng = null, Func<double> now = null, bool app = false)
        {
            rng = rng ?? Rng.Default;
            var sala = (DungeonCell)Estados.CelulaAtual(estado);
            var log = new List<string>();

            var party = new List<Companion>();
            var saindo = new List<Companion>();
            foreach (var membro in estado.Party ?? new List<Companion>())
            {
                var depois = membro;
                if (membro.Temporary == true)
                {
                    depois = membro.Clone();
                    depois.CombatsLeft = (membro.CombatsLeft ?? 0) - 1;
                }
                if (depois.Temporary != true || (depois.CombatsLeft ?? 0) > 0) party.Add(depois);
                if (depois.Temporary == true && (depois.CombatsLeft ?? 0) <= 0) saindo.Add(depois);
            }
            foreach (var membro in saindo) log.Add(Js.Str(membro.Name) + " se despede da equipe após cumprir sua promessa.");

            var hero = estado.Hero;
            var inventory = estado.Inventory;
            var quests = estado.Quests;
            Item loot = null;

            if (rng() < (sala.Type == DungeonRoomTypes.Boss ? D.ChanceDeLootChefe : D.ChanceDeLootNormal))
            {
                loot = Items.RandomItem(new Items.RandomItemOptions
                {
                    Floor = Estados.AndarDeForca(estado),
                    Rng = rng,
                    Now = now,
                    App = app,
                    Chefe = app && sala.Type == DungeonRoomTypes.Boss,
                });
                inventory = Inventory.AddItem(inventory, loot);
                quests = Quests.OnItemCollected(quests);
                log.Add("Encontrou " + Items.DisplayName(loot) + " após a batalha.");
            }

            // No app, o chefe pode deixar uma runa, um tier acima do andar.
            if (app && sala.Type == DungeonRoomTypes.Boss && rng() < GameData.RunasTable.ChanceDaRunaNoChefe)
            {
                var runa = Runas.SortearRuna(Estados.AndarDeForca(estado), true, rng, now);
                inventory = Inventory.AddItem(inventory, runa);
                log.Add("O chefe deixa cair " + Items.DisplayName(runa) + ".");
            }

            var bonus = sala.BonusTreasure;
            if (bonus != null && bonus.Gold != null)
            {
                var comOuro = hero.Clone();
                comOuro.Gold = hero.Gold + bonus.Gold.Value;
                hero = comOuro;
                log.Add("Com a sala livre de perigo, você encontra mais " + Js.NumberToString(bonus.Gold.Value) + " de ouro escondido.");
            }
            else if (bonus != null && bonus.Item != null)
            {
                inventory = Inventory.AddItem(inventory, bonus.Item);
                string escondido = Items.Concordar(bonus.Item, new[] { "escondido", "escondida", "escondidos", "escondidas" });
                log.Add("Com a sala livre de perigo, você encontra " + Items.DisplayName(bonus.Item) + " " + escondido + ".");
            }

            // Maestria: a sala inteira é uma batalha e conta aqui, quando o último inimigo cai.
            var vitoria = Mastery.WinBattle(hero);
            hero = vitoria.Hero;
            if (vitoria.LeveledUp) log.Add(Maestria.MaestriaSubiu(hero, vitoria.Level));

            var semBuffs = hero.Clone();
            semBuffs.Buffs = new HeroBuffs();
            var comTudo = estado.Clone();
            comTudo.Hero = semBuffs;
            comTudo.Party = party;
            comTudo.Inventory = inventory;
            comTudo.Quests = quests;
            var vencida = sala.Clone();
            vencida.Beaten = true;
            vencida.BonusTreasure = null;
            var limpo = Estados.SubstituirCelulaAtual(comTudo, vencida);

            if (sala.Type == DungeonRoomTypes.Boss && estado.Floor >= Dungeons.Floors)
            {
                // O chefe do último andar: a masmorra está zerada nesta dificuldade.
                var progresso = Dungeons.MarkCleared(limpo.Progresso, limpo.Masmorra);
                log.Add("Você venceu " + Js.Str(abatido.Name) + " e zerou " + Dungeons.RunName(limpo.Masmorra) + "!");
                log.AddRange(AbertosAoZerar(limpo, progresso));
                log.Add("O caminho de volta se abre, e o grupo retorna à cidade.");
                var comProgresso = limpo.Clone();
                comProgresso.Progresso = progresso;
                return new SalaLimpa { Estado = Estados.VoltarParaCidade(comProgresso), Log = log, Loot = loot };
            }

            if (sala.Type == DungeonRoomTypes.Boss)
            {
                var proximo = Estados.AvancarAndar(limpo, rng, now, app);
                log.Add("Após vencer " + Js.Str(abatido.Name) + ", o grupo avança automaticamente para o Andar " + Js.NumberToString(proximo.Floor) + ".");
                return new SalaLimpa { Estado = proximo, Log = log, Loot = loot };
            }

            return new SalaLimpa { Estado = limpo, Log = log, Loot = loot };
        }

        /// <summary>O que a masmorra zerada abre no portão: a dificuldade seguinte e, no Normal, a próxima masmorra.</summary>
        private static List<string> AbertosAoZerar(EstadoNaMasmorra estado, DungeonProgress progresso)
        {
            var linhas = new List<string>();
            var dificuldades = Dungeons.Difficulties;
            int indice = dificuldades.FindIndex(d => d.Id == estado.Masmorra.Difficulty);
            var seguinte = indice + 1 < dificuldades.Count ? dificuldades[indice + 1] : null;
            var masmorra = Dungeons.ById(estado.Masmorra.Dungeon);
            if (seguinte != null && masmorra != null) linhas.Add(masmorra.Name + " no " + seguinte.Name + " está aberta no portão.");

            DungeonDef proxima = null;
            foreach (var d in Dungeons.All)
            {
                if (d.Requires == estado.Masmorra.Dungeon)
                {
                    proxima = d;
                    break;
                }
            }
            if (proxima != null && estado.Masmorra.Difficulty == "normal")
            {
                var falta = Dungeons.LockReasonOf(progresso, estado.Hero.Level, new DungeonRun { Dungeon = proxima.Id, Difficulty = "normal" });
                linhas.Add(falta?.Kind == LockReason.KindLevel
                    ? "A " + proxima.Name + " abre a partir do nível " + Js.NumberToString(falta.MinLevel ?? double.NaN) + "."
                    : "A " + proxima.Name + " está aberta no portão.");
            }
            return linhas;
        }

        /// <summary>
        /// TS: perderLuta — até o nível 5 não custa nada; depois leva 10% do ouro (no máximo 500) e um item comum ou
        /// incomum que não esteja equipado (o sorteio sai sempre, mesmo sem item). O grupo volta pra cidade com 30%
        /// da vida.
        /// </summary>
        public static PassoDaLuta<EstadoNaCidade> PerderLuta(EstadoNaMasmorra estado, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var log = new List<string>();

            var hero = estado.Hero;
            var inventory = estado.Inventory;

            if (hero.Level > D.NivelSemPenalidade)
            {
                double perdido = Js.Min(500, Math.Floor(hero.Gold * 0.1));
                var semOuro = hero.Clone();
                semOuro.Gold = Js.Max(0, hero.Gold - perdido);
                hero = semOuro;

                var descartavel = new List<Item>();
                foreach (var item in inventory)
                    if (!item.Equipped && (item.Rarity == "comum" || item.Rarity == "incomum")) descartavel.Add(item);
                double sorteio = Math.Floor(rng() * descartavel.Count);
                var perdeu = sorteio < descartavel.Count ? descartavel[(int)sorteio] : null;
                if (perdeu != null)
                {
                    var restante = new List<Item>();
                    foreach (var atual in inventory)
                        if (atual.Uid != perdeu.Uid) restante.Add(atual);
                    inventory = restante;
                }

                log.Add("Você perdeu " + Js.NumberToString(perdido) + " de ouro" + (perdeu != null ? " e o item " + Items.DisplayName(perdeu) + "." : "."));
            }
            else
            {
                log.Add("A proteção de iniciante preservou seus itens e seu ouro.");
            }

            var revivido = hero.Clone();
            revivido.Hp = Js.Max(1, Math.Floor(hero.MaxHp * 0.3));
            revivido.Buffs = new HeroBuffs();
            var equipe = new List<Companion>();
            foreach (var membro in estado.Party ?? new List<Companion>())
            {
                var voltou = membro.Clone();
                voltou.Hp = Js.Max(1, Math.Floor(membro.MaxHp * 0.3));
                equipe.Add(voltou);
            }
            log.Add("Você foi derrotado! O grupo retorna à cidade inicial.");

            var derrotado = estado.Clone();
            derrotado.Hero = revivido;
            derrotado.Party = equipe;
            derrotado.Inventory = inventory;
            return new PassoDaLuta<EstadoNaCidade> { Estado = Estados.VoltarParaCidade(derrotado), Log = log };
        }
    }
}
