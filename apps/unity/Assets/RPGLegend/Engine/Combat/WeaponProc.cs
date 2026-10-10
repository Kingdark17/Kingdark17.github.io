namespace RPGLegend.Engine
{
    /// <summary>TS: WeaponProcResult.</summary>
    public sealed class WeaponProcResult
    {
        public Hero Hero;
        public CombatMonster Monster;
        /// <summary>
        /// O proc que disparou (o do template, com a chance do item), ou null se não ativou — sempre presente.
        /// Para a camada de narração.
        /// </summary>
        [KeepNull] public ProcTemplate Triggered;
    }

    /// <summary>Port de shared/src/combat/weapon-proc.ts.</summary>
    public static class WeaponProc
    {
        /// <summary>
        /// TS: applyWeaponProc — rola o proc da arma equipada (queimadura, atordoar, sangramento, mana grátis,
        /// cura no acerto). Sem arma, ou sem proc no item, não faz nada e não sorteia; senão tira um número
        /// do rng e dispara abaixo da chance. Não muta o herói nem o monstro.
        ///
        /// Quando dispara, o monstro sai sempre como cópia com o campo status (<c>{}</c> se não tinha), mesmo
        /// nos procs que só mexem no herói — como no TS.
        /// </summary>
        public static WeaponProcResult ApplyWeaponProc(Hero hero, CombatMonster monster, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var weapon = hero.Equip.Get("arma");
            if (weapon == null) return Nada(hero, monster);

            var view = Items.View(weapon);
            if (view.Proc == null) return Nada(hero, monster);
            if (rng() >= view.Proc.Chance) return Nada(hero, monster);

            var d = hero.Derived;
            var status = monster.Status ?? new MonsterStatus();
            var nextHero = hero;

            switch (view.Proc.Effect)
            {
                case "queimadura":
                    status = MonsterState.SetStatusField(status, "queimadura", new DotStatus { Turns = 3, Dmg = Js.Max(2, Js.Round(d.DmgFisico * 0.3)) });
                    break;
                case "sangramento":
                    status = MonsterState.SetStatusField(status, "sangramento", new DotStatus { Turns = 3, Dmg = Js.Max(2, Js.Round(d.DmgFisico * 0.25)) });
                    break;
                case "atordoar":
                    status = MonsterState.SetStatusField(status, "atordoado", (status.Atordoado ?? 0) + 1);
                    break;
                case "mana_gratis":
                    nextHero = hero.Clone();
                    nextHero.Mp = Js.Min(hero.MaxMp, hero.Mp + 6);
                    break;
                case "cura_no_acerto":
                    nextHero = hero.Clone();
                    nextHero.Hp = Js.Min(hero.MaxHp, hero.Hp + Js.Max(3, Js.Round(d.CuraBonus * 0.5) + 4));
                    break;
            }

            // { ...monster, status }
            var nextMonster = monster.Clone();
            nextMonster.Status = status;
            nextMonster.ForgetExtras("status");
            return new WeaponProcResult { Hero = nextHero, Monster = nextMonster, Triggered = view.Proc };
        }

        /// <summary>O <c>none</c> do TS: o herói e o monstro de entrada, sem proc.</summary>
        private static WeaponProcResult Nada(Hero hero, CombatMonster monster) =>
            new WeaponProcResult { Hero = hero, Monster = monster, Triggered = null };
    }
}
