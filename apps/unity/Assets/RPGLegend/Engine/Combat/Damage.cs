namespace RPGLegend.Engine
{
    /// <summary>TS: DamageModifierResult.</summary>
    public sealed class DamageModifierResult
    {
        public double Dmg;
        /// <summary>Cópia do monstro (do mesmo tipo: uma visão continua visão) com status e guardHits atualizados.</summary>
        public CombatMonster Monster;
        /// <summary>Para a camada de narração: a Muralha Sombria do Guardião absorveu este golpe.</summary>
        public bool GuardConsumed;
    }

    /// <summary>
    /// Port de shared/src/combat/damage.ts: bônus de fuga pela velocidade, o ataque que o equipamento
    /// soma ao golpe e os modificadores de dano do lado do monstro (afinidade, vulnerável, Muralha Sombria).
    /// </summary>
    public static class Damage
    {
        /// <summary>Os slots que <see cref="OtherEquipAtk"/> soma, na ordem do TS.</summary>
        private static readonly string[] OutrosSlots = { "secundaria", "armadura", "acessorio" };

        /// <summary>
        /// TS: fleeBonus — bônus da rolagem de fuga (e de esquiva) pela diferença de velocidade herói/monstro:
        /// +2 com 5 ou mais, +1 com qualquer vantagem, e −2 do Teimoso (pode ficar negativo).
        /// Do monstro só a velocidade importa (o <c>Pick&lt;CombatMonster, 'speed'&gt;</c> do TS).
        /// </summary>
        public static double FleeBonus(Hero hero, MonsterInstance monster)
        {
            double diff = hero.Derived.Velocidade - monster.Speed;
            double bonus = diff >= 5 ? 2 : diff > 0 ? 1 : 0;
            if (Heroes.HasDebuffEffect(hero, "fleePenalty")) bonus -= 2;
            return bonus;
        }

        /// <summary>
        /// TS: weaponAtkContribution — quanto do ataque da arma equipada entra no dano, escalado pela
        /// afinidade da classe (<c>Math.round(ataque * pct / 100)</c>, nessa ordem). Sem arma, 0.
        /// Do herói só o equipamento importa.
        /// </summary>
        public static double WeaponAtkContribution(Hero hero, double affinityPct)
        {
            var weapon = hero.Equip.Get("arma");
            return weapon != null ? Js.Round((weapon.Stats.OrZero("ataque") * affinityPct) / 100) : 0;
        }

        /// <summary>
        /// TS: otherEquipAtk — ataque somado dos outros três slots (secundária, armadura, acessório). Só a
        /// secundária sofre afinidade de classe (ela pode carregar uma arma leve); armadura e acessório
        /// contribuem cheio. Peça sem ataque (ausente, 0 ou NaN) é pulada.
        /// </summary>
        public static double OtherEquipAtk(Hero hero)
        {
            double sum = 0;
            foreach (var slot in OutrosSlots)
            {
                var item = hero.Equip.Get(slot);
                if (item == null || !item.Stats.Truthy("ataque")) continue;
                double pct = 100;
                if (slot == "secundaria")
                {
                    var cls = Catalog.ClassById(Catalog.IdDaClasse(hero.ClassId, hero.ClassName) ?? "");
                    if (cls != null && cls.Affinity.TryGet(item.TemplateId, out var affinity)) pct = affinity;
                }
                sum += Js.Round((item.Stats.OrZero("ataque") * pct) / 100);
            }
            return sum;
        }

        /// <summary>
        /// TS: modifyDamageByAffinity — fraqueza (×1,25) e resistência (×0,8; ×0,9 com
        /// <paramref name="halfResist"/>), cada uma arredondada; o status "vulnerável" (soma o amount, 0,2
        /// quando falta ou é 0 — o <c>||</c> do original — e gasta um turno); a Muralha Sombria (×0,65, no
        /// mínimo 1, e gasta um guardHits). O dano nunca sai abaixo de 1.
        ///
        /// Não muta o monstro: devolve uma cópia (do mesmo tipo) com status e guardHits — que passa a
        /// existir, com 0, mesmo quando o monstro não o tinha.
        /// </summary>
        public static DamageModifierResult ModifyDamageByAffinity(
            CombatMonster monster,
            string weakness,
            string resistance,
            double dmg,
            string type,
            bool halfResist)
        {
            double next = dmg;
            if (weakness == type) next = Js.Round(next * 1.25);
            if (resistance == type) next = Js.Round(next * (halfResist ? 0.9 : 0.8));

            var status = monster.Status;
            var vulneravel = status?.Vulneravel;
            if (vulneravel != null && vulneravel.Turns > 0)
            {
                next = Js.Round(next * (1 + (Js.Truthy(vulneravel.Amount) ? vulneravel.Amount.Value : 0.2)));
                status = MonsterState.SetStatusField(status, "vulneravel", MonsterState.DecrementField(vulneravel));
            }

            double guardHits = monster.GuardHits ?? 0;
            bool guardConsumed = false;
            if (guardHits > 0)
            {
                next = Js.Max(1, Js.Round(next * 0.65));
                guardHits -= 1;
                guardConsumed = true;
            }

            // { ...monster, status, guardHits }
            var nextMonster = monster.Clone();
            nextMonster.Status = status;
            nextMonster.GuardHits = guardHits;
            nextMonster.ForgetExtras("status", "guardHits");

            return new DamageModifierResult { Dmg = Js.Max(1, next), Monster = nextMonster, GuardConsumed = guardConsumed };
        }
    }
}
