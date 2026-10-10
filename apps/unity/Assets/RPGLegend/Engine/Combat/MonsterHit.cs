using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: MonsterHitOptions.</summary>
    public sealed class MonsterHitOptions
    {
        /// <summary>De onde saem os sorteios; ausente, <see cref="Rng.Default"/>.</summary>
        public RngFn Rng;
        /// <summary>Bônus de esquiva vindo do sistema de pets — 0 se ausente.</summary>
        public double? PetEsquivaBonus;
        /// <summary>
        /// O herói rolou "Esquivar" com sucesso nesta rodada (<see cref="Dodge.AttemptDodge"/>): se o golpe for
        /// nele, erra. Vale só esta rodada — se o monstro estiver atordoado, lento demais ou mirar um
        /// companheiro, a esquiva se perde. Opção, e não buff no herói, por causa do campo único de esquiva
        /// em HeroBuffs (ver dodge.ts).
        /// </summary>
        public bool? EsquivaCerta;
    }

    /// <summary>TS: MonsterHitOutcome.</summary>
    public static class MonsterHitOutcomes
    {
        public const string Stunned = "stunned";
        public const string LentoSkip = "lento_skip";
        public const string HitParty = "hit_party";
        public const string Dodged = "dodged";
        public const string HitHero = "hit_hero";
    }

    /// <summary>
    /// TS: MonsterHitResult. Campo opcional do TS é anulável aqui (null = ausente), salvo
    /// <see cref="EnemyClassPowerTriggered"/>, que é <c>string | null</c> e opcional ao mesmo tempo.
    /// </summary>
    public sealed class MonsterHitResult
    {
        public CombatMonsterView Monster;
        public Hero Hero;
        /// <summary>Lista nova; os companheiros são os de entrada, salvo o atingido (cópia) no hit_party.</summary>
        public List<Companion> Party;
        /// <summary>Um de <see cref="MonsterHitOutcomes"/>.</summary>
        public string Outcome;
        public double? Damage;
        /// <summary>Índice do companheiro atingido, quando o desfecho é hit_party.</summary>
        public double? TargetIndex;
        public bool HeroDefeated;
        public bool? PartyMemberDefeated;

        /// <summary>
        /// O poder de classe de inimigo que disparou nesta rodada, ou null quando nenhum disparou. É o
        /// <c>enemyClassPowerTriggered?: string | null</c> do TS: null presente em hit_party, dodged e
        /// hit_hero; ausente em stunned e lento_skip. Quem diz se está presente é
        /// <see cref="EnemyClassPowerTriggeredSpecified"/>.
        /// </summary>
        [KeepNull] public string EnemyClassPowerTriggered;

        /// <summary>
        /// Se <see cref="EnemyClassPowerTriggered"/> existe no resultado. É a convenção <c>XxxSpecified</c> do
        /// Newtonsoft (o JsContractResolver a herda do DefaultContractResolver): com false, o campo some do
        /// JSON mesmo com [KeepNull].
        /// </summary>
        [JsIgnore] public bool EnemyClassPowerTriggeredSpecified;

        /// <summary>O enrage de mini-chefe (abaixo de 50% de vida) disparou NESTA rodada. Ausente só no stunned.</summary>
        public bool? RageTriggered;
        public bool? PoisonApplied;
        public double? ManaDrained;
        public bool? DefensivePassiveTriggered;
        public bool? ShieldConsumed;
    }

    /// <summary>Port de shared/src/combat/monster-hit.ts: o turno de ataque do monstro.</summary>
    public static class MonsterHit
    {
        /// <summary>TS: AttackMultiplierResult (privado).</summary>
        private sealed class AttackMultiplierResult
        {
            public CombatMonsterView Monster;
            public Hero Hero;
            public double AttackMult;
            /// <summary>O status "lento" fez o monstro perder o turno inteiro.</summary>
            public bool Skip;
            public bool RageTriggered;
            public string EnemyClassPowerTriggered;
        }

        /// <summary>TS: HeroDamageResult (privado).</summary>
        private sealed class HeroDamageResult
        {
            public Hero Hero;
            public bool Dodged;
            public double Damage;
            public bool PoisonApplied;
            public double ManaDrained;
            public bool DefensivePassiveTriggered;
            public bool ShieldConsumed;
        }

        /// <summary>
        /// TS: applyMonsterHit — o turno de ataque do monstro: atordoamento (pula e gasta um turno, sem
        /// sortear), enrage de mini-chefe, multiplicadores de comportamento e de classe de inimigo, escolha de
        /// alvo (companheiro defensor, companheiro qualquer ou o próprio herói), esquiva, dano final e os
        /// efeitos que o golpe aplica de volta (veneno, dreno de mana). Não decide o que vem depois (derrota,
        /// próximo turno). Não muta nada.
        ///
        /// Ordem dos sorteios: lento (se ativo), agressivo (se for), defensor (se houver), companheiro
        /// qualquer (se houver vivo), e então ou o alvo e o d6 do companheiro, ou — no herói — a esquiva, o
        /// d6, a passiva do guerreiro, o veneno do venenoso e o dreno do mágico, cada um só quando se aplica.
        /// </summary>
        public static MonsterHitResult ApplyMonsterHit(Hero hero, IReadOnlyList<Companion> party, CombatMonsterView monster, MonsterHitOptions options = null)
        {
            options = options ?? new MonsterHitOptions();
            var rng = options.Rng ?? Rng.Default;
            double petEsquiva = options.PetEsquivaBonus ?? 0;

            if (Js.Truthy(monster.Status?.Atordoado) && monster.Status.Atordoado.Value > 0)
            {
                var status = MonsterState.SetStatusField(monster.Status, "atordoado", monster.Status.Atordoado.Value - 1);
                return new MonsterHitResult
                {
                    Monster = ComStatus(monster, status),
                    Hero = hero,
                    Party = new List<Companion>(party),
                    Outcome = MonsterHitOutcomes.Stunned,
                    HeroDefeated = false,
                };
            }

            var mult = ResolveAttackMultiplier(monster, hero, rng);
            if (mult.Skip)
            {
                return new MonsterHitResult
                {
                    Monster = mult.Monster,
                    Hero = mult.Hero,
                    Party = new List<Companion>(party),
                    Outcome = MonsterHitOutcomes.LentoSkip,
                    HeroDefeated = false,
                    RageTriggered = mult.RageTriggered,
                };
            }

            var targetPool = SelectTargetPool(party, rng);
            if (targetPool != null)
            {
                var target = targetPool[(int)Rng.RandomInt(targetPool.Count, rng)];
                int targetIndex = IndexOf(party, target);
                double partyDmg = Js.Max(1, Js.Round((1 + Rng.RandomInt(6, rng) + mult.Monster.Dmg - 1) * mult.AttackMult));
                var updatedTarget = target.Clone();
                updatedTarget.Hp = Js.Max(0, target.Hp - partyDmg);
                var nextParty = new List<Companion>(party.Count);
                for (int i = 0; i < party.Count; i++) nextParty.Add(i == targetIndex ? updatedTarget : party[i]);

                return new MonsterHitResult
                {
                    Monster = mult.Monster,
                    Hero = mult.Hero,
                    Party = nextParty,
                    Outcome = MonsterHitOutcomes.HitParty,
                    Damage = partyDmg,
                    TargetIndex = targetIndex,
                    HeroDefeated = false,
                    PartyMemberDefeated = updatedTarget.Hp <= 0,
                    EnemyClassPowerTriggered = mult.EnemyClassPowerTriggered,
                    EnemyClassPowerTriggeredSpecified = true,
                    RageTriggered = mult.RageTriggered,
                };
            }

            // A esquiva rolada pula o cálculo inteiro: não gasta o turno de Passo Veloz nem o escudo, que
            // ficam para o próximo golpe — não foram eles que salvaram o herói.
            if (options.EsquivaCerta == true)
            {
                return new MonsterHitResult
                {
                    Monster = mult.Monster,
                    Hero = mult.Hero,
                    Party = new List<Companion>(party),
                    Outcome = MonsterHitOutcomes.Dodged,
                    HeroDefeated = false,
                    EnemyClassPowerTriggered = mult.EnemyClassPowerTriggered,
                    EnemyClassPowerTriggeredSpecified = true,
                    RageTriggered = mult.RageTriggered,
                };
            }

            var heroHit = ResolveHeroDamage(mult.Hero, mult.Monster, mult.AttackMult, rng, petEsquiva);
            if (heroHit.Dodged)
            {
                return new MonsterHitResult
                {
                    Monster = mult.Monster,
                    Hero = heroHit.Hero,
                    Party = new List<Companion>(party),
                    Outcome = MonsterHitOutcomes.Dodged,
                    HeroDefeated = false,
                    EnemyClassPowerTriggered = mult.EnemyClassPowerTriggered,
                    EnemyClassPowerTriggeredSpecified = true,
                    RageTriggered = mult.RageTriggered,
                };
            }

            var finalMonster = mult.Monster;
            if (mult.Monster.PoisonStrike == true)
            {
                finalMonster = mult.Monster.Clone();
                finalMonster.PoisonStrike = false;
                finalMonster.ForgetExtras("poisonStrike");
            }

            return new MonsterHitResult
            {
                Monster = finalMonster,
                Hero = heroHit.Hero,
                Party = new List<Companion>(party),
                Outcome = MonsterHitOutcomes.HitHero,
                Damage = heroHit.Damage,
                HeroDefeated = heroHit.Hero.Hp <= 0,
                EnemyClassPowerTriggered = mult.EnemyClassPowerTriggered,
                EnemyClassPowerTriggeredSpecified = true,
                RageTriggered = mult.RageTriggered,
                PoisonApplied = heroHit.PoisonApplied,
                ManaDrained = heroHit.ManaDrained,
                DefensivePassiveTriggered = heroHit.DefensivePassiveTriggered,
                ShieldConsumed = heroHit.ShieldConsumed,
            };
        }

        /// <summary>
        /// TS: resolveAttackMultiplier — soma um ataque ao attackCount, dispara o enrage de mini-chefe
        /// (permanente, +3 de dano, uma vez só) na primeira vez abaixo de 50% de vida, aplica o enfraquecido
        /// (e gasta um turno), rola o lento (que pode fazer o monstro perder o turno), e então os
        /// multiplicadores de comportamento e o poder de classe de inimigo.
        ///
        /// Porte fiel: o agressivo (×1,45), o lento no 3º ataque (×1,7) e o chefe principal no 3º ataque
        /// (×1,9) SUBSTITUEM o multiplicador — o corte do enfraquecido se perde quando um deles vale.
        /// </summary>
        private static AttackMultiplierResult ResolveAttackMultiplier(CombatMonsterView monster, Hero hero, RngFn rng)
        {
            var nextMonster = monster.Clone();
            nextMonster.AttackCount = (monster.AttackCount ?? 0) + 1;
            nextMonster.ForgetExtras("attackCount");

            bool rageTriggered = false;
            if (nextMonster.IsBoss && nextMonster.IsMainBoss != true && nextMonster.Hp <= nextMonster.MaxHp / 2 && nextMonster.RageTriggered != true)
            {
                var enraivecido = nextMonster.Clone();
                enraivecido.RageTriggered = true;
                enraivecido.Dmg = nextMonster.Dmg + 3;
                enraivecido.ForgetExtras("rageTriggered");
                nextMonster = enraivecido;
                rageTriggered = true;
            }

            double attackMult = 1;
            var status = nextMonster.Status;

            var enfraquecido = status?.Enfraquecido;
            if (enfraquecido != null && enfraquecido.Turns > 0)
            {
                attackMult *= 1 - (Js.Truthy(enfraquecido.Amount) ? enfraquecido.Amount.Value : 0.25);
                status = MonsterState.SetStatusField(status, "enfraquecido", MonsterState.DecrementField(enfraquecido));
            }

            var lentoStatus = status?.Lento;
            if (lentoStatus != null && lentoStatus.Turns > 0)
            {
                bool skip = rng() < (Js.Truthy(lentoStatus.Amount) ? lentoStatus.Amount.Value : 0.2);
                status = MonsterState.SetStatusField(status, "lento", MonsterState.DecrementField(lentoStatus));
                nextMonster = ComStatus(nextMonster, status);
                if (skip)
                {
                    return new AttackMultiplierResult
                    {
                        Monster = nextMonster,
                        Hero = hero,
                        AttackMult = attackMult,
                        Skip = true,
                        RageTriggered = rageTriggered,
                        EnemyClassPowerTriggered = null,
                    };
                }
            }
            nextMonster = ComStatus(nextMonster, status);

            if (monster.Behavior == "agressivo" && rng() < 0.25) attackMult = 1.45;
            if (monster.Behavior == "lento" && (nextMonster.AttackCount ?? 0) % 3 == 0) attackMult = 1.7;
            if (nextMonster.IsMainBoss == true && (nextMonster.AttackCount ?? 0) % 3 == 0) attackMult = 1.9;

            var classPower = ClassPassives.TriggerEnemyClassPower(nextMonster, hero);
            // { ...nextMonster, ...classPower.monster }: o monstro do poder saiu de nextMonster (ou é ele).
            nextMonster = ComoVisao(classPower.Monster).Clone();
            attackMult *= classPower.AttackMult;

            return new AttackMultiplierResult
            {
                Monster = nextMonster,
                Hero = classPower.Hero,
                AttackMult = attackMult,
                Skip = false,
                RageTriggered = rageTriggered,
                EnemyClassPowerTriggered = classPower.Triggered,
            };
        }

        /// <summary>
        /// TS: selectTargetPool — sorteia se o monstro mira os companheiros defensores (postura defensiva ou
        /// guerreiro), um companheiro vivo qualquer, ou o herói (null). Cada pergunta só sorteia se houver
        /// a quem mirar.
        /// </summary>
        private static List<Companion> SelectTargetPool(IReadOnlyList<Companion> party, RngFn rng)
        {
            var livingParty = new List<Companion>();
            foreach (var m in party)
                if (m.Hp > 0) livingParty.Add(m);

            var defenders = new List<Companion>();
            foreach (var m in livingParty)
            {
                string stance = Js.Truthy(m.Stance) ? m.Stance : CompanionStances.Equilibrada;
                if (stance == CompanionStances.Defensiva || Catalog.IdDaClasse(m.ClassId, m.ClassName) == "guerreiro") defenders.Add(m);
            }

            if (defenders.Count > 0 && rng() < 0.55) return defenders;
            if (livingParty.Count > 0 && rng() < 0.3) return livingParty;
            return null;
        }

        /// <summary>
        /// TS: resolveHeroDamage — o golpe no próprio herói: esquiva (derivada + pet + Passo Veloz, que gasta um
        /// turno mesmo quando o golpe acerta), d6 + dano do monstro menos defesa/3 e resistência mágica/4,
        /// vezes o multiplicador; Medo do Fogo (contra mágico ou "Fogo" no nome do monstro), Corpo Frágil,
        /// a passiva do guerreiro (−40%), o escudo (some ao absorver), e os efeitos de volta: poisonStrike
        /// do Assassino, veneno do venenoso (com Sangue Tóxico ×1,5) e dreno de mana do mágico.
        ///
        /// O buffs do herói sai sempre como objeto novo (<c>{}</c> se ele não tinha), como no TS.
        /// </summary>
        private static HeroDamageResult ResolveHeroDamage(Hero hero, CombatMonsterView monster, double attackMult, RngFn rng, double petEsquiva)
        {
            var d = hero.Derived;
            var buffs = hero.Buffs ?? new HeroBuffs();
            bool passoVeloz = Js.Truthy(buffs.EsquivaTurns) && buffs.EsquivaTurns.Value > 0;
            double dodge = d.Esquiva + petEsquiva + (passoVeloz ? (Js.Truthy(buffs.EsquivaAmount) ? buffs.EsquivaAmount.Value : 0) : 0);

            // { ...hero, buffs: { ...buffs, esquivaTurns: … } }
            var buffsDepois = buffs.Clone();
            buffsDepois.EsquivaTurns = passoVeloz ? buffs.EsquivaTurns.Value - 1 : buffs.EsquivaTurns;
            var nextHero = hero.Clone();
            nextHero.Buffs = buffsDepois;

            if (rng() * 100 < dodge)
            {
                return new HeroDamageResult { Hero = nextHero, Dodged = true, Damage = 0, PoisonApplied = false, ManaDrained = 0, DefensivePassiveTriggered = false, ShieldConsumed = false };
            }

            var bonus = Derived.EquipmentBonus(nextHero.Equip);
            double defesa = bonus["defesa"];
            double dmg = Js.Max(
                1,
                Js.Round((1 + Rng.RandomInt(6, rng) + monster.Dmg - Math.Floor((Js.Truthy(defesa) ? defesa : 0) / 3) - Math.Floor(d.ResistMagica / 4)) * attackMult));

            // Medo do Fogo: contra mágico, ou "Fogo" em qualquer lugar do nome do monstro (o includes do TS).
            if (Heroes.HasDebuffEffect(nextHero, "fireVulnerability") && (monster.Behavior == "magico" || monster.Name.IndexOf("Fogo", StringComparison.Ordinal) >= 0))
                dmg = Js.Max(1, Js.Round(dmg * 1.25));
            if (Heroes.HasDebuffEffect(nextHero, "physicalVulnerability")) dmg = Js.Max(1, Js.Round(dmg * 1.2));

            bool defensivePassiveTriggered = false;
            if (Catalog.IdDaClasse(nextHero.ClassId, nextHero.ClassName) == "guerreiro" && rng() < 0.2)
            {
                dmg = Js.Max(1, Js.Round(dmg * 0.6));
                defensivePassiveTriggered = true;
            }

            bool shieldConsumed = false;
            var shieldBuffs = nextHero.Buffs ?? new HeroBuffs();
            if (Js.Truthy(shieldBuffs.Shield) && shieldBuffs.Shield.Value > 0)
            {
                dmg = Js.Max(1, Js.Round(dmg * (1 - shieldBuffs.Shield.Value)));
                var semEscudo = shieldBuffs.Clone();
                semEscudo.Shield = 0;
                nextHero = ComBuffs(nextHero, semEscudo);
                shieldConsumed = true;
            }

            var ferido = nextHero.Clone();
            ferido.Hp = Js.Max(0, nextHero.Hp - dmg);
            nextHero = ferido;

            bool poisonApplied = false;
            if (monster.PoisonStrike == true)
            {
                var buffsNow = (nextHero.Buffs ?? new HeroBuffs()).Clone();
                buffsNow.PoisonTurns = 3;
                buffsNow.PoisonDmg = Js.Max(2, Js.Round(monster.Dmg * 0.35));
                nextHero = ComBuffs(nextHero, buffsNow);
                poisonApplied = true;
            }
            if (monster.Behavior == "venenoso" && rng() < 0.35)
            {
                var buffsNow = (nextHero.Buffs ?? new HeroBuffs()).Clone();
                double poisonDmg = Js.Max(2, Js.Round(Math.Floor(monster.Dmg / 3) * (Heroes.HasDebuffEffect(nextHero, "poisonVulnerability") ? 1.5 : 1)));
                buffsNow.PoisonTurns = 3;
                buffsNow.PoisonDmg = poisonDmg;
                nextHero = ComBuffs(nextHero, buffsNow);
                poisonApplied = true;
            }

            double manaDrained = 0;
            if (monster.Behavior == "magico" && rng() < 0.35)
            {
                manaDrained = Js.Min(nextHero.Mp, 3 + Math.Floor(monster.Dmg / 3));
                var drenado = nextHero.Clone();
                drenado.Mp = nextHero.Mp - manaDrained;
                nextHero = drenado;
            }

            return new HeroDamageResult
            {
                Hero = nextHero,
                Dodged = false,
                Damage = dmg,
                PoisonApplied = poisonApplied,
                ManaDrained = manaDrained,
                DefensivePassiveTriggered = defensivePassiveTriggered,
                ShieldConsumed = shieldConsumed,
            };
        }

        /// <summary>O <c>party.indexOf(target)</c> do TS: pela referência.</summary>
        private static int IndexOf(IReadOnlyList<Companion> party, Companion target)
        {
            for (int i = 0; i < party.Count; i++)
                if (ReferenceEquals(party[i], target)) return i;
            return -1;
        }

        /// <summary>O <c>{ ...monster, status }</c> do TS.</summary>
        private static CombatMonsterView ComStatus(CombatMonsterView monster, MonsterStatus status)
        {
            var m = monster.Clone();
            m.Status = status;
            m.ForgetExtras("status");
            return m;
        }

        /// <summary>O <c>{ ...hero, buffs }</c> do TS.</summary>
        private static Hero ComBuffs(Hero hero, HeroBuffs buffs)
        {
            var h = hero.Clone();
            h.Buffs = buffs;
            return h;
        }

        /// <summary>
        /// O monstro que as funções de combate devolvem a partir de uma visão: elas copiam com Clone, que guarda
        /// o tipo, então continua visão.
        /// </summary>
        private static CombatMonsterView ComoVisao(CombatMonster monster) =>
            monster as CombatMonsterView ?? throw new InvalidOperationException("esperava a visão do monstro de volta");
    }
}
