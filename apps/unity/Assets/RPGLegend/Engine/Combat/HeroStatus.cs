namespace RPGLegend.Engine
{
    /// <summary>TS: HeroStatusTickResult.</summary>
    public sealed class HeroStatusTickResult
    {
        public Hero Hero;
        public double Damage;
        public bool Defeated;
    }

    /// <summary>Port de shared/src/combat/hero-status.ts.</summary>
    public static class HeroStatus
    {
        /// <summary>
        /// TS: tickHeroStatus — aplica o veneno ativo no herói (de um monstro venenoso ou do Assassino) no
        /// início do turno: tira poisonDmg (2 quando falta) da vida, sem passar de 0, e gasta um turno.
        /// Sem veneno (ausente, 0 ou negativo), devolve o mesmo herói. Não muta o herói.
        /// </summary>
        public static HeroStatusTickResult TickHeroStatus(Hero hero)
        {
            var buffs = hero.Buffs ?? new HeroBuffs();
            if (!Js.Truthy(buffs.PoisonTurns) || buffs.PoisonTurns.Value <= 0)
                return new HeroStatusTickResult { Hero = hero, Damage = 0, Defeated = false };

            double dmg = buffs.PoisonDmg ?? 2;
            double hp = Js.Max(0, hero.Hp - dmg);

            // { ...hero, hp, buffs: { ...buffs, poisonTurns: buffs.poisonTurns - 1 } }
            var nextBuffs = buffs.Clone();
            nextBuffs.PoisonTurns = buffs.PoisonTurns.Value - 1;
            var nextHero = hero.Clone();
            nextHero.Hp = hp;
            nextHero.Buffs = nextBuffs;

            return new HeroStatusTickResult { Hero = nextHero, Damage = dmg, Defeated = hp <= 0 };
        }
    }
}
