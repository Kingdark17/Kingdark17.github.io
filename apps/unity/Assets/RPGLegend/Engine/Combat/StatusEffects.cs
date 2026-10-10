using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: DotTickResult.</summary>
    public sealed class DotTickResult
    {
        public CombatMonster Monster;
        /// <summary>Soma do dano de todos os status contínuos ativos neste turno — 0 se nenhum tiver disparado.</summary>
        public double Damage;
        public bool Defeated;
    }

    /// <summary>
    /// Port de shared/src/combat/status-effects.ts: o tick do dano contínuo no monstro e o status que um
    /// poder deixa nele.
    /// </summary>
    public static class StatusEffects
    {
        /// <summary>TS: DOT_KEYS (privada) — queimadura, sangramento e veneno, na ordem em que o tick os aplica.</summary>
        public static IReadOnlyList<string> DotKeys => GameData.StatusEffectsTable.DotKeys;

        /// <summary>
        /// TS: tickMonsterDot — no início do turno, aplica o dano de cada status contínuo com turnos e gasta um
        /// turno de cada (o status some no último). Sem campo status, devolve o mesmo monstro, sem cópia.
        /// Não muta o monstro.
        /// </summary>
        public static DotTickResult TickMonsterDot(CombatMonster monster)
        {
            if (monster.Status == null) return new DotTickResult { Monster = monster, Damage = 0, Defeated = monster.Hp <= 0 };

            var status = monster.Status;
            double hp = monster.Hp;
            double damage = 0;

            foreach (var key in DotKeys)
            {
                var s = status.GetDot(key);
                if (s != null && s.Turns > 0)
                {
                    hp -= s.Dmg;
                    damage += s.Dmg;
                    status = MonsterState.SetStatusField(status, key, MonsterState.DecrementField(s));
                }
            }

            // { ...monster, hp, status }
            var next = monster.Clone();
            next.Hp = hp;
            next.Status = status;
            next.ForgetExtras("status");
            return new DotTickResult { Monster = next, Damage = damage, Defeated = hp <= 0 };
        }

        /// <summary>
        /// TS: applyPowerStatus — aplica o status de um poder ao monstro. Atordoado soma turnos (padrão 1);
        /// veneno, sangramento e queimadura viram dano contínuo que escala pelo maior entre dano físico e
        /// mágico do herói, igual ao original — não pelo tipo do próprio poder (padrões: 3 turnos e 0,2 do
        /// dano, no mínimo 2); os outros (enfraquecido, vulnerável, lento) viram multiplicador (3 turnos, 0,2).
        ///
        /// Do poder só importam status, turns, dotRatio e amount (o <c>PowerStatusInput</c> do TS); do
        /// derivado, dmgFisico e dmgMagico. Poder sem status devolve o mesmo monstro; senão, uma cópia.
        /// </summary>
        public static CombatMonster ApplyPowerStatus(PowerDef power, CombatMonster monster, DerivedStats derived)
        {
            if (!Js.Truthy(power.Status)) return monster;

            var status = monster.Status ?? new MonsterStatus();
            if (power.Status == "atordoado")
            {
                status = MonsterState.SetStatusField(status, "atordoado", (status.Atordoado ?? 0) + (power.Turns ?? 1));
            }
            else if (power.Status == "veneno" || power.Status == "sangramento" || power.Status == "queimadura")
            {
                double dmg = Js.Max(2, Js.Round(Js.Max(derived.DmgMagico, derived.DmgFisico) * (power.DotRatio ?? 0.2)));
                status = MonsterState.SetStatusField(status, power.Status, new DotStatus { Turns = power.Turns ?? 3, Dmg = dmg });
            }
            else
            {
                status = MonsterState.SetStatusField(status, power.Status, new AmountStatus { Turns = power.Turns ?? 3, Amount = power.Amount ?? 0.2 });
            }

            // { ...monster, status }
            var next = monster.Clone();
            next.Status = status;
            next.ForgetExtras("status");
            return next;
        }
    }
}
