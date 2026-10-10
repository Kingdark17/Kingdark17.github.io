using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: NpcService — os serviços que um NPC oferece.</summary>
    public static class NpcServiceIds
    {
        public const string Heal = "heal";
        public const string Blessing = "blessing";
        public const string Barter = "barter";
        public const string Reveal = "reveal";
        public const string Recruit = "recruit";
    }

    /// <summary>
    /// TS: HealOutcome — "insufficient_gold" → Required; "already_full" → nada; "healed" → GoldSpent, HpGained,
    /// MpGained. Os campos de outro kind ficam ausentes.
    /// </summary>
    public sealed class HealOutcome
    {
        public const string KindInsufficientGold = "insufficient_gold";
        public const string KindAlreadyFull = "already_full";
        public const string KindHealed = "healed";

        public string Kind;
        public double? Required;
        public double? GoldSpent;
        public double? HpGained;
        public double? MpGained;

        public static HealOutcome InsufficientGold(double required) => new HealOutcome { Kind = KindInsufficientGold, Required = required };

        public static HealOutcome AlreadyFull() => new HealOutcome { Kind = KindAlreadyFull };

        public static HealOutcome Healed(double goldSpent, double hpGained, double mpGained) =>
            new HealOutcome { Kind = KindHealed, GoldSpent = goldSpent, HpGained = hpGained, MpGained = mpGained };
    }

    /// <summary>TS: HealResult.</summary>
    public sealed class HealResult
    {
        public Hero Hero;
        public HealOutcome Outcome;
        /// <summary>O serviço foi usado (quem chama marca a sala e salva).</summary>
        public bool Used;
    }

    /// <summary>TS: BlessingOutcome — sempre "blessed".</summary>
    public sealed class BlessingOutcome
    {
        public const string KindBlessed = "blessed";

        public string Kind = KindBlessed;
        public double Combats;
        public double Dodge;
    }

    /// <summary>TS: BlessingResult.</summary>
    public sealed class BlessingResult
    {
        public Hero Hero;
        public BlessingOutcome Outcome;
        public bool Used;
    }

    /// <summary>TS: ApplyBlessingResult.</summary>
    public sealed class ApplyBlessingResult
    {
        public Hero Hero;
        public bool Applied;
    }

    /// <summary>TS: BarterOutcome — "no_material" → nada; "bartered" → Given, Received.</summary>
    public sealed class BarterOutcome
    {
        public const string KindNoMaterial = "no_material";
        public const string KindBartered = "bartered";

        public string Kind;
        public Item Given;
        public Item Received;

        public static BarterOutcome NoMaterial() => new BarterOutcome { Kind = KindNoMaterial };

        public static BarterOutcome Bartered(Item given, Item received) => new BarterOutcome { Kind = KindBartered, Given = given, Received = received };
    }

    /// <summary>TS: BarterResult.</summary>
    public sealed class BarterResult
    {
        public List<Item> Inventory;
        public BarterOutcome Outcome;
        public bool Used;
    }

    /// <summary>TS: BarterOptions.</summary>
    public sealed class BarterOptions
    {
        public RngFn Rng;
        /// <summary>O relógio do uid da poção. Ausente, Date.now.</summary>
        public Func<double> Now;
    }

    /// <summary>TS: RevealOutcome — sempre "revealed", com quantas salas foram reveladas agora.</summary>
    public sealed class RevealOutcome
    {
        public const string KindRevealed = "revealed";

        public string Kind = KindRevealed;
        public double Count;
    }

    /// <summary>TS: RevealResult.</summary>
    public sealed class RevealResult
    {
        public List<List<DungeonCell>> Grid;
        public RevealOutcome Outcome;
        public bool Used;
    }

    /// <summary>TS: GridPosition — uma posição na grade.</summary>
    public sealed class GridPosition
    {
        public double X;
        public double Y;
    }

    /// <summary>TS: RecruitOutcome — "party_full" → nada; "recruited" → Companion.</summary>
    public sealed class RecruitOutcome
    {
        public const string KindPartyFull = "party_full";
        public const string KindRecruited = "recruited";

        public string Kind;
        public Companion Companion;

        public static RecruitOutcome PartyFull() => new RecruitOutcome { Kind = KindPartyFull };

        public static RecruitOutcome Recruited(Companion companion) => new RecruitOutcome { Kind = KindRecruited, Companion = companion };
    }

    /// <summary>TS: RecruitResult.</summary>
    public sealed class RecruitResult
    {
        public List<Companion> Party;
        public RecruitOutcome Outcome;
        public bool Used;
    }

    /// <summary>
    /// Os serviços dos NPCs do mapa (port de shared/src/npc/npc-services.ts): tratamento, bênção, troca de
    /// material, informações e recruta. Só regra: cada resolve devolve <c>used</c>, e quem chama decide o que
    /// fazer com isso (marcar a sala, salvar). Nada aqui muta o que recebe.
    /// </summary>
    public static class NpcServices
    {
        private static NpcServicesData D => GameData.NpcServicesTable;

        /// <summary>TS: NPC_SERVICE_INFO.</summary>
        public static OrderedMap<NpcServiceInfo> Info => D.ServiceInfo;

        /// <summary>TS: MAX_PARTY_SIZE (privada).</summary>
        public static double MaxPartySize => D.MaxPartySize;

        /// <summary>TS: TEMPORARY_RECRUIT_COMBATS (privada).</summary>
        public static double TemporaryRecruitCombats => D.TemporaryRecruitCombats;

        /// <summary>TS: npcServiceInfo — o ícone e o rótulo do serviço, ou null.</summary>
        public static NpcServiceInfo InfoOf(string service) => Info.TryGet(service, out var info) ? info : null;

        // ---------- heal ----------

        /// <summary>
        /// TS: resolveHeal — cura 45% da vida e 35% da mana máximas (até o máximo), por 14 + 2 × andar de ouro.
        /// O desconto da loja (carisma) baixa o preço, até 40%; o preço nunca fica abaixo de 5. Sem ouro, ou
        /// já cheio, nada muda.
        /// </summary>
        public static HealResult ResolveHeal(Hero hero, double floor)
        {
            if (hero.Derived == null) throw new EngineError("Cannot read properties of undefined (reading 'descontoLoja')", "TypeError");
            // (hero.derived.descontoLoja || 0) / 100
            double desconto = hero.Derived.DescontoLoja;
            double discount = Js.Min(0.4, (Js.Truthy(desconto) ? desconto : 0) / 100);
            double price = Js.Max(5, Js.Round((14 + floor * 2) * (1 - discount)));

            if (hero.Gold < price) return new HealResult { Hero = hero, Outcome = HealOutcome.InsufficientGold(price), Used = false };
            if (hero.Hp == hero.MaxHp && hero.Mp == hero.MaxMp) return new HealResult { Hero = hero, Outcome = HealOutcome.AlreadyFull(), Used = false };

            double hpGained = Js.Min(hero.MaxHp, hero.Hp + Js.Round(hero.MaxHp * 0.45)) - hero.Hp;
            double mpGained = Js.Min(hero.MaxMp, hero.Mp + Js.Round(hero.MaxMp * 0.35)) - hero.Mp;
            var nextHero = hero.Clone();
            nextHero.Gold = hero.Gold - price;
            nextHero.Hp = hero.Hp + hpGained;
            nextHero.Mp = hero.Mp + mpGained;
            return new HealResult { Hero = nextHero, Outcome = HealOutcome.Healed(price, hpGained, mpGained), Used = true };
        }

        // ---------- blessing ----------

        /// <summary>TS: resolveBlessing — sempre concede: +12 de esquiva pelos próximos 3 combates (consumida por <see cref="ApplyNpcBlessing"/>).</summary>
        public static BlessingResult ResolveBlessing(Hero hero)
        {
            const double combats = 3;
            const double dodge = 12;
            var nextHero = hero.Clone();
            nextHero.NpcBlessing = new NpcBlessing { Combats = combats, Dodge = dodge };
            return new BlessingResult
            {
                Hero = nextHero,
                Outcome = new BlessingOutcome { Combats = combats, Dodge = dodge },
                Used = true,
            };
        }

        /// <summary>
        /// TS: applyNpcBlessing — consome um combate da bênção ativa, virando esquiva válida só neste combate
        /// (esquivaTurns 999 dura o combate inteiro). O último combate tira a bênção (fica ausente). Sem bênção
        /// (ou com 0 combates), nada muda. Assume que quem chama já zerou os buffs para o combate novo.
        /// </summary>
        public static ApplyBlessingResult ApplyNpcBlessing(Hero hero)
        {
            if (hero.NpcBlessing == null || hero.NpcBlessing.Combats <= 0) return new ApplyBlessingResult { Hero = hero, Applied = false };

            // undefined - 1 é NaN no TS: a bênção sem contagem vale uma vez e some.
            double combatsLeft = Js.Num(hero.NpcBlessing.Combats) - 1;
            // { ...hero.buffs, esquivaTurns: 999, esquivaAmount: hero.npcBlessing.dodge }
            var buffs = hero.Buffs != null ? hero.Buffs.Clone() : new HeroBuffs();
            buffs.EsquivaTurns = 999;
            buffs.EsquivaAmount = hero.NpcBlessing.Dodge;

            var nextHero = hero.Clone();
            nextHero.Buffs = buffs;
            if (combatsLeft > 0)
            {
                var blessing = hero.NpcBlessing.Clone();
                blessing.Combats = combatsLeft;
                nextHero.NpcBlessing = blessing;
            }
            else
            {
                nextHero.NpcBlessing = null;
            }
            return new ApplyBlessingResult { Hero = nextHero, Applied = true };
        }

        // ---------- barter ----------

        /// <summary>
        /// TS: resolveBarter — troca o primeiro material não equipado da mochila por uma poção aleatória do andar
        /// (o material sai, a poção entra no fim). Sem material, devolve uma cópia da mochila, sem sortear.
        /// Lança, como o TS, se encontrar antes do material um item de template desconhecido.
        /// </summary>
        public static BarterResult ResolveBarter(IReadOnlyList<Item> inventory, double floor, BarterOptions options = null)
        {
            var o = options ?? new BarterOptions();
            var rng = o.Rng ?? Rng.Default;

            Item material = null;
            foreach (var item in inventory)
            {
                if (Items.CategoryOf(item) == "material" && !item.Equipped)
                {
                    material = item;
                    break;
                }
            }
            if (material == null)
                return new BarterResult { Inventory = new List<Item>(inventory), Outcome = BarterOutcome.NoMaterial(), Used = false };

            var potion = Items.RandomItem(new Items.RandomItemOptions { Category = "consumivel", Floor = floor, Rng = rng, Now = o.Now });
            var nextInventory = new List<Item>();
            foreach (var item in inventory) if (item.Uid != material.Uid) nextInventory.Add(item);
            nextInventory.Add(potion);
            return new BarterResult { Inventory = nextInventory, Outcome = BarterOutcome.Bartered(material, potion), Used = true };
        }

        // ---------- reveal ----------

        /// <summary>
        /// TS: resolveReveal — marca revealed em toda sala (não void) a até 2 casas (Manhattan) da posição, sem
        /// depender de porta ou visita. Devolve uma grade nova; as salas reveladas agora são cópias, as outras
        /// continuam as mesmas. Count conta só as que ainda não estavam reveladas.
        /// </summary>
        public static RevealResult ResolveReveal(IReadOnlyList<IReadOnlyList<DungeonCell>> grid, GridPosition pos)
        {
            double count = 0;
            var nextGrid = new List<List<DungeonCell>>(grid.Count);
            foreach (var row in grid)
            {
                var nextRow = new List<DungeonCell>(row.Count);
                foreach (var cell in row)
                {
                    double distance = Math.Abs(cell.X - pos.X) + Math.Abs(cell.Y - pos.Y);
                    if (cell.Type != DungeonRoomTypes.Void && distance <= 2 && cell.Revealed != true)
                    {
                        count++;
                        var revealed = cell.Clone();
                        revealed.Revealed = true;
                        nextRow.Add(revealed);
                    }
                    else
                    {
                        nextRow.Add(cell);
                    }
                }
                nextGrid.Add(nextRow);
            }
            return new RevealResult { Grid = nextGrid, Outcome = new RevealOutcome { Count = count }, Used = true };
        }

        // ---------- recruit ----------

        /// <summary>
        /// TS: resolveRecruit — um companheiro sorteado (generateCompanion), temporário por
        /// TEMPORARY_RECRUIT_COMBATS combates, entra no fim da equipe. Equipe cheia: cópia da equipe, sem sortear.
        /// </summary>
        public static RecruitResult ResolveRecruit(IReadOnlyList<Companion> party, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            if (party.Count >= MaxPartySize)
                return new RecruitResult { Party = new List<Companion>(party), Outcome = RecruitOutcome.PartyFull(), Used = false };

            // { ...generateCompanion(rng), temporary: true, combatsLeft: TEMPORARY_RECRUIT_COMBATS }
            var companion = Heroes.GenerateCompanion(rng).Clone();
            companion.Temporary = true;
            companion.CombatsLeft = TemporaryRecruitCombats;
            var nextParty = new List<Companion>(party) { companion };
            return new RecruitResult { Party = nextParty, Outcome = RecruitOutcome.Recruited(companion), Used = true };
        }
    }
}
