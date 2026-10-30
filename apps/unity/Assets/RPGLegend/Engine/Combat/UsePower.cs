using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: UsePowerOutcome.</summary>
    public static class UsePowerOutcomes
    {
        public const string NoMana = "no_mana";
        public const string Damage = "damage";
        public const string Heal = "heal";
        public const string Buff = "buff";
        /// <summary>Ergueu um esqueleto (<see cref="UsePowerResult.Summoned"/>).</summary>
        public const string Summon = "summon";
        /// <summary>Já há o máximo de esqueletos de pé, e nada foi gasto.</summary>
        public const string SummonFull = "summon_full";
    }

    /// <summary>TS: UsePowerOptions.</summary>
    public sealed class UsePowerOptions
    {
        /// <summary>De onde saem os sorteios; ausente, <see cref="Rng.Default"/>.</summary>
        public RngFn Rng;
        /// <summary>Bônus percentual de cura vindo do sistema de pets — 0 se ausente.</summary>
        public double? PetCuraBonus;
        /// <summary>Chance de 0 a 100 do pet poupar a mana do poder — 0 se ausente (aí não sorteia).</summary>
        public double? PetManaSaveChance;
        /// <summary>A fração que a Coroa do Arquimago tira do custo (<see cref="AcessoriosUnicos"/>); só a arena passa.</summary>
        public double? DescontoDeMana;
    }

    /// <summary>TS: UsePowerResult. Campo opcional do TS é anulável aqui (null = ausente).</summary>
    public sealed class UsePowerResult
    {
        public Hero Hero;
        /// <summary>Lista nova: na cura, cópias de todos (os vivos curados); nos outros, os mesmos companheiros.</summary>
        public List<Companion> Party;
        public CombatMonsterView Monster;
        /// <summary>Um de <see cref="UsePowerOutcomes"/>.</summary>
        public string Outcome;
        /// <summary>Custo já com a penalidade de fraqueza aplicada — é o número que a tela mostra no botão.</summary>
        public double ManaCost;
        public bool SavedMana;
        public double? Damage;
        /// <summary>Vida devolvida ao herói: pela cura, ou pelo dreno de um poder com healRatio (ausente sem dreno).</summary>
        public double? Healed;
        public double? AllyHealed;
        /// <summary>O esqueleto que o poder ergueu (já no fim de Party).</summary>
        public Companion Summoned;
        public bool MonsterDefeated;
    }

    /// <summary>
    /// Port de shared/src/combat/use-power.ts: o uso de poder no combate, só a parte pura — custo de mana,
    /// dano/cura/buff e o status que o poder deixa no monstro. Como resolveAttack, não decide o que vem
    /// depois (turno da equipe, dano contínuo, turno do monstro) nem chama tickHeroStatus.
    /// </summary>
    public static class UsePower
    {
        /// <summary>TS: PENALIDADE_DE_MANA (privada) — o ×1,2 da Mana Instável.</summary>
        public static double PenalidadeDeMana => GameData.UsePowerTable.PenalidadeDeMana;

        /// <summary>
        /// TS: powerManaCost — o custo do poder, com a Mana Instável (×1,2, para cima). É o mesmo número que o
        /// botão do poder mostra antes do clique. Do poder só o custo importa.
        /// </summary>
        public static double PowerManaCost(Hero hero, PowerDef power, double desconto = 0) =>
            Math.Ceiling(power.Cost * (Heroes.HasDebuffEffect(hero, "manaCostPenalty") ? PenalidadeDeMana : 1) * (1 - desconto));

        /// <summary>
        /// TS: castPower (o <c>usePower()</c> do original; o prefixo use é reservado a hooks no lint do React).
        /// Sem mana para o custo, não gasta nada e não sorteia. Com o pet de mana, sorteia antes de tudo se a
        /// mana é poupada. Poder de dano: (dano base × power, arredondado, + d6) × maestria, arredondado, pelos
        /// modificadores do monstro, e então o status e o dreno; cura: no herói e (70%, no mínimo 1) nos
        /// companheiros vivos; o resto vira buff no herói. Não muta nada.
        /// </summary>
        public static UsePowerResult CastPower(Hero hero, IReadOnlyList<Companion> party, CombatMonsterView monster, PowerDef power, UsePowerOptions options = null)
        {
            options = options ?? new UsePowerOptions();
            var rng = options.Rng ?? Rng.Default;
            double manaCost = PowerManaCost(hero, power, options?.DescontoDeMana ?? 0);

            // O esqueleto do necromante: com o máximo de pé, avisa sem gastar a mana.
            if (power.Type == "invocar" && Invocacao.EsqueletosDePe(party) >= Invocacao.MaxEsqueletos)
            {
                return new UsePowerResult
                {
                    Hero = hero,
                    Party = new List<Companion>(party),
                    Monster = monster,
                    Outcome = UsePowerOutcomes.SummonFull,
                    ManaCost = manaCost,
                    SavedMana = false,
                    MonsterDefeated = false,
                };
            }

            if (hero.Mp < manaCost)
            {
                return new UsePowerResult
                {
                    Hero = hero,
                    Party = new List<Companion>(party),
                    Monster = monster,
                    Outcome = UsePowerOutcomes.NoMana,
                    ManaCost = manaCost,
                    SavedMana = false,
                    MonsterDefeated = false,
                };
            }

            bool savedMana = (options.PetManaSaveChance ?? 0) > 0 && rng() * 100 < (options.PetManaSaveChance ?? 0);
            var heroAfterCost = hero;
            if (!savedMana)
            {
                heroAfterCost = hero.Clone();
                heroAfterCost.Mp = hero.Mp - manaCost;
            }
            var d = heroAfterCost.Derived;

            if (power.Type == "invocar")
            {
                var esqueleto = Invocacao.CriarEsqueleto(heroAfterCost, party);
                var comEle = new List<Companion>(party) { esqueleto };
                return new UsePowerResult
                {
                    Hero = heroAfterCost,
                    Party = comEle,
                    Monster = monster,
                    Outcome = UsePowerOutcomes.Summon,
                    ManaCost = manaCost,
                    SavedMana = savedMana,
                    Summoned = esqueleto,
                    MonsterDefeated = false,
                };
            }

            if (power.Type == "dano_fisico" || power.Type == "dano_magico")
            {
                double baseDoPoder = power.Type == "dano_fisico" ? d.DmgFisico : d.DmgMagico;
                // Maestria: +2% por nível com a arma da classe na mão, como no golpe. Fica no golpe do poder;
                // o dano contínuo que ele deixa não muda.
                double bruto = Js.Round((Js.Round(baseDoPoder * (power.PowerValue ?? 1)) + Rng.RandomInt(6, rng)) * Mastery.DamageMult(heroAfterCost));
                var mod = Damage.ModifyDamageByAffinity(
                    monster,
                    monster.Species.Weakness,
                    monster.Species.Resistance,
                    bruto,
                    power.Type == "dano_magico" ? "magico" : "fisico",
                    false);

                // { ...monster, ...mod.monster, hp: monster.hp - mod.dmg }
                var atingido = ComoVisao(mod.Monster).Clone();
                atingido.Hp = monster.Hp - mod.Dmg;
                var comStatus = ComoVisao(StatusEffects.ApplyPowerStatus(power, atingido, d));

                // Dreno: parte do dano volta como vida. O Math.max(1, ...) é do original — um dreno nunca cura zero.
                double drenado = Js.Truthy(power.HealRatio) ? Js.Max(1, Js.Round(mod.Dmg * power.HealRatio.Value)) : 0;
                var comVida = heroAfterCost;
                if (Js.Truthy(drenado))
                {
                    comVida = heroAfterCost.Clone();
                    comVida.Hp = Js.Min(heroAfterCost.MaxHp, heroAfterCost.Hp + drenado);
                }

                return new UsePowerResult
                {
                    Hero = comVida,
                    Party = new List<Companion>(party),
                    Monster = comStatus,
                    Outcome = UsePowerOutcomes.Damage,
                    ManaCost = manaCost,
                    SavedMana = savedMana,
                    Damage = mod.Dmg,
                    Healed = Js.Truthy(drenado) ? drenado : (double?)null, // drenado || undefined
                    MonsterDefeated = comStatus.Hp <= 0,
                };
            }

            if (power.Type == "cura")
            {
                double penalidade = Heroes.HasDebuffEffect(heroAfterCost, "healingPenalty") ? 0.75 : 1;
                double heal = Js.Round((10 * (power.PowerValue ?? 1) + d.CuraBonus) * penalidade * (1 + (options.PetCuraBonus ?? 0) / 100));
                double allyHeal = Js.Max(1, Js.Round(heal * 0.7));

                var curado = heroAfterCost.Clone();
                curado.Hp = Js.Min(heroAfterCost.MaxHp, heroAfterCost.Hp + heal);

                // party.map((membro) => membro.hp > 0 ? { ...membro, hp: … } : { ...membro })
                var equipe = new List<Companion>(party.Count);
                foreach (var membro in party)
                {
                    var copia = membro.Clone();
                    if (membro.Hp > 0) copia.Hp = Js.Min(membro.MaxHp, membro.Hp + allyHeal);
                    equipe.Add(copia);
                }

                return new UsePowerResult
                {
                    Hero = curado,
                    Party = equipe,
                    Monster = monster,
                    Outcome = UsePowerOutcomes.Heal,
                    ManaCost = manaCost,
                    SavedMana = savedMana,
                    Healed = heal,
                    AllyHealed = allyHeal,
                    MonsterDefeated = false,
                };
            }

            var comBuff = heroAfterCost.Clone();
            comBuff.Buffs = ApplyBuff(heroAfterCost, power);
            return new UsePowerResult
            {
                Hero = comBuff,
                Party = new List<Companion>(party),
                Monster = monster,
                Outcome = UsePowerOutcomes.Buff,
                ManaCost = manaCost,
                SavedMana = savedMana,
                MonsterDefeated = false,
            };
        }

        /// <summary>
        /// TS: applyBuff (privada) — cópia dos buffs com o do poder. turns/amount ausentes no poder deixam o
        /// campo ausente (o <c>buffs.x = power.turns</c> com undefined). Tipo de poder sem buff: cópia igual.
        /// </summary>
        private static HeroBuffs ApplyBuff(Hero hero, PowerDef power)
        {
            var buffs = (hero.Buffs ?? new HeroBuffs()).Clone();
            switch (power.Type)
            {
                case "buff_crit":
                    buffs.CritNext = true;
                    break;
                case "buff_precisao":
                    buffs.PrecisaoTurns = power.Turns;
                    buffs.PrecisaoAmount = power.Amount;
                    break;
                case "buff_forca":
                    buffs.ForcaTurns = power.Turns;
                    buffs.ForcaAmount = power.Amount;
                    break;
                case "buff_esquiva":
                    buffs.EsquivaTurns = power.Turns;
                    buffs.EsquivaAmount = power.Amount;
                    break;
                case "escudo":
                    buffs.Shield = power.Amount;
                    break;
                case "buff_grupo":
                    // Mora no herói, mas vale para a equipe: applyPartyTurn lê daqui.
                    buffs.InspiracaoTurns = power.Turns;
                    buffs.InspiracaoAmount = power.Amount;
                    break;
            }
            return buffs;
        }

        /// <summary>As funções de combate copiam com Clone, que guarda o tipo: a partir de uma visão, sai visão.</summary>
        private static CombatMonsterView ComoVisao(CombatMonster monster) =>
            monster as CombatMonsterView ?? throw new InvalidOperationException("esperava a visão do monstro de volta");
    }
}
