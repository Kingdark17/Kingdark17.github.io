using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: PartyPassiveKind — a passiva de classe que o golpe do companheiro disparou.</summary>
    public static class PartyPassiveKinds
    {
        public const string Ladino = "ladino";
        public const string Barbaro = "barbaro";
        public const string Arqueiro = "arqueiro";
        public const string Necromante = "necromante";
        public const string Druida = "druida";
        public const string Monge = "monge";
        public const string Bardo = "bardo";
        public const string Cacador = "cacador";
        public const string Paladino = "paladino";
    }

    /// <summary>TS: PartyMemberOutcome['kind'].</summary>
    public static class PartyOutcomeKinds
    {
        public const string HealedHero = "healed_hero";
        public const string Miss = "miss";
        public const string Hit = "hit";
    }

    /// <summary>
    /// TS: PartyMemberOutcome — o que um companheiro fez na rodada. A união do TS numa classe só:
    /// <c>{ member, kind: 'healed_hero', amount }</c>, <c>{ member, kind: 'miss' }</c> (sem amount) ou
    /// <c>{ member, kind: 'hit', amount, passive? }</c>.
    /// </summary>
    public sealed class PartyMemberOutcome
    {
        /// <summary>O próprio companheiro da lista de entrada (o mesmo objeto, sem cópia).</summary>
        public Companion Member;
        /// <summary>Um de <see cref="PartyOutcomeKinds"/>.</summary>
        public string Kind;
        /// <summary>A cura (healed_hero) ou o dano (hit); ausente no miss.</summary>
        public double? Amount;
        /// <summary>Só no hit, quando uma passiva disparou: um de <see cref="PartyPassiveKinds"/>.</summary>
        public string Passive;
    }

    /// <summary>TS: PartyTurnResult.</summary>
    public sealed class PartyTurnResult
    {
        public Hero Hero;
        public CombatMonster Monster;
        public List<PartyMemberOutcome> Outcomes;
        public double TotalDamage;
        public bool Defeated;
    }

    /// <summary>Port de shared/src/combat/party.ts: o turno automático dos companheiros e a Canção de Batalha.</summary>
    public static class Party
    {
        /// <summary>TS: HIT_CHANCE (privada) — chance de acerto por postura (suporte só chega aqui se não curou).</summary>
        public static OrderedMap<double> HitChance => GameData.PartyTable.HitChance;

        /// <summary>
        /// TS: applyPartyTurn — os companheiros agem em sequência logo depois do herói. Quem está em "suporte"
        /// tenta curar o herói antes de atacar (Clérigo com chance maior); os demais atacam com bônus por
        /// postura e uma chance de passiva de classe — a lista de applyHeroClassPassive, rolada para o
        /// companheiro (pelo id da classe, não pelo nome).
        ///
        /// Membro morto, ou monstro já derrotado, pula a vez sem sortear (o <c>continue</c> do TS, que espelha o
        /// <c>forEach</c> do original). No fim, desconta uma rodada da Canção de Batalha
        /// (<see cref="PassarRodadaDaCancao"/>), com ou sem equipe.
        ///
        /// Ordem dos sorteios por membro: cura (só em suporte), acerto, o dano (0 a 4 somado ao ataque), e a
        /// passiva da classe — cada classe sorteia só a sua, e o bárbaro não sorteia. Postura desconhecida não
        /// tem chance na tabela: a comparação com undefined dá falso, e o golpe acerta (como no TS). Não muta nada.
        /// </summary>
        public static PartyTurnResult ApplyPartyTurn(Hero hero, IReadOnlyList<Companion> party, CombatMonster monster, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var nextHero = hero;
            var nextMonster = monster;
            var outcomes = new List<PartyMemberOutcome>();
            double totalDamage = 0;

            // A Canção de Batalha do herói bardo chega aqui: é o único buff de herói que a equipe sente.
            var buffs = hero.Buffs ?? new HeroBuffs();
            double inspiracao = Js.Truthy(buffs.InspiracaoTurns) && buffs.InspiracaoTurns.Value > 0 ? 1 + (buffs.InspiracaoAmount ?? 0) : 1;

            foreach (var member in party)
            {
                if (member.Hp <= 0 || nextMonster.Hp <= 0) continue;

                string stance = Js.Truthy(member.Stance) ? member.Stance : CompanionStances.Equilibrada;
                string classe = Catalog.IdDaClasse(member.ClassId, member.ClassName);
                bool isCleric = classe == "clerigo";

                if (stance == CompanionStances.Suporte && rng() < (isCleric ? 0.65 : 0.4))
                {
                    double heal = Js.Max(4, Js.Round((member.Attrs != null ? member.Attrs.Sabedoria : 8) * 0.7));
                    nextHero = ComVida(nextHero, Js.Min(nextHero.MaxHp, nextHero.Hp + heal));
                    outcomes.Add(new PartyMemberOutcome { Member = member, Kind = PartyOutcomeKinds.HealedHero, Amount = heal });
                    continue;
                }

                // HIT_CHANCE[stance]: postura fora da tabela é undefined, e rng() >= undefined é falso.
                double hitChance = HitChance.TryGet(stance, out var chance) ? chance : double.NaN;
                if (rng() >= hitChance)
                {
                    outcomes.Add(new PartyMemberOutcome { Member = member, Kind = PartyOutcomeKinds.Miss });
                    continue;
                }

                double dmg = Js.Max(2, (Js.Truthy(member.Attack) ? member.Attack : 5) + Rng.RandomInt(5, rng));
                if (stance == CompanionStances.Agressiva) dmg = Js.Round(dmg * 1.3);
                if (stance == CompanionStances.Defensiva || stance == CompanionStances.Suporte) dmg = Js.Round(dmg * 0.8);
                if (classe == "mago") dmg = Js.Round(dmg * 1.2);
                if (inspiracao > 1) dmg = Js.Round(dmg * inspiracao);

                string passive = null;
                if (classe == "ladino" && rng() < 0.25)
                {
                    dmg = Js.Round(dmg * 1.65);
                    passive = PartyPassiveKinds.Ladino;
                }
                if (classe == "barbaro" && member.Hp < member.MaxHp / 2)
                {
                    dmg = Js.Round(dmg * 1.35);
                    passive = PartyPassiveKinds.Barbaro;
                }
                if (classe == "arqueiro" && rng() < 0.25)
                {
                    dmg = Js.Round(dmg * 1.5);
                    passive = PartyPassiveKinds.Arqueiro;
                }

                var status = nextMonster.Status;
                if (classe == "necromante" && rng() < 0.3)
                {
                    status = MonsterState.SetStatusField(status, "enfraquecido", new AmountStatus { Turns = 2, Amount = 0.2 });
                    passive = PartyPassiveKinds.Necromante;
                }
                if (classe == "druida" && rng() < 0.3)
                {
                    status = MonsterState.SetStatusField(status, "veneno", new DotStatus { Turns = 3, Dmg = Js.Max(2, Js.Round(dmg * 0.2)) });
                    passive = PartyPassiveKinds.Druida;
                }
                if (classe == "monge" && rng() < 0.22)
                {
                    status = MonsterState.SetStatusField(status, "atordoado", (status?.Atordoado ?? 0) + 1);
                    passive = PartyPassiveKinds.Monge;
                }
                if (classe == "bardo" && rng() < 0.3)
                {
                    status = MonsterState.SetStatusField(status, "vulneravel", new AmountStatus { Turns = 2, Amount = 0.15 });
                    passive = PartyPassiveKinds.Bardo;
                }
                if (classe == "cacador" && rng() < 0.3)
                {
                    status = MonsterState.SetStatusField(status, "sangramento", new DotStatus { Turns = 3, Dmg = Js.Max(2, Js.Round(dmg * 0.2)) });
                    passive = PartyPassiveKinds.Cacador;
                }
                if (classe == "paladino" && rng() < 0.25)
                {
                    double paladinHeal = Js.Max(3, Js.Round(dmg * 0.2));
                    nextHero = ComVida(nextHero, Js.Min(nextHero.MaxHp, nextHero.Hp + paladinHeal));
                    passive = PartyPassiveKinds.Paladino;
                }

                // { ...nextMonster, status, hp: nextMonster.hp - dmg }
                var atingido = nextMonster.Clone();
                atingido.Status = status;
                atingido.Hp = nextMonster.Hp - dmg;
                atingido.ForgetExtras("status");
                nextMonster = atingido;

                totalDamage += dmg;
                outcomes.Add(new PartyMemberOutcome { Member = member, Kind = PartyOutcomeKinds.Hit, Amount = dmg, Passive = passive });
            }

            nextHero = PassarRodadaDaCancao(nextHero);

            return new PartyTurnResult { Hero = nextHero, Monster = nextMonster, Outcomes = outcomes, TotalDamage = totalDamage, Defeated = nextMonster.Hp <= 0 };
        }

        /// <summary>
        /// TS: passarRodadaDaCancao — desconta uma rodada da Canção de Batalha. A canção dura rodadas, não
        /// golpes: o turno da equipe chama isto sozinho, porque toda rodada que continua passa por ele. A
        /// rodada em que o herói mata não passa pela equipe; aí quem orquestra chama isto.
        /// Sem canção ativa, devolve o mesmo herói; senão, uma cópia.
        /// </summary>
        public static Hero PassarRodadaDaCancao(Hero hero)
        {
            var buffs = hero.Buffs;
            if (buffs == null || !Js.Truthy(buffs.InspiracaoTurns) || buffs.InspiracaoTurns.Value <= 0) return hero;

            var nextBuffs = buffs.Clone();
            nextBuffs.InspiracaoTurns = buffs.InspiracaoTurns.Value - 1;
            var next = hero.Clone();
            next.Buffs = nextBuffs;
            return next;
        }

        /// <summary>O <c>{ ...hero, hp }</c> do TS.</summary>
        private static Hero ComVida(Hero hero, double hp)
        {
            var next = hero.Clone();
            next.Hp = hp;
            return next;
        }
    }
}
