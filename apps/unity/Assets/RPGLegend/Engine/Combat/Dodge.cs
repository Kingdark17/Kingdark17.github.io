using System;

namespace RPGLegend.Engine
{
    /// <summary>
    /// Port de shared/src/combat/dodge.ts: a ação "Esquivar" rola o d20, como a fuga; com 12 ou mais, somado
    /// ao bônus de velocidade, o golpe que o monstro der no herói nesta rodada erra. Só o julgamento mora
    /// aqui: quem faz a esquiva valer é <see cref="MonsterHit.ApplyMonsterHit"/>, pela opção
    /// <c>EsquivaCerta</c>, e só na rodada em que ela foi rolada (não vira buff guardado no herói).
    /// </summary>
    public static class Dodge
    {
        /// <summary>TS: ESQUIVA_TARGET — total mínimo (d20 + bônus de velocidade) para se preparar a tempo. O mesmo da fuga.</summary>
        public static double EsquivaTarget => GameData.DodgeTable.EsquivaTarget;

        /// <summary>
        /// TS: attemptDodge — a mesma conta de <see cref="Flee.AttemptFlee"/>, mas a rolagem é conferida: fora de
        /// 1..20, ou não inteira (NaN incluído), lança RangeError.
        /// </summary>
        public static FleeAttemptResult AttemptDodge(Hero hero, MonsterInstance monster, double roll)
        {
            if (!EhInteiro(roll) || roll < 1 || roll > 20)
                throw new EngineError("rolagem " + Js.NumberToString(roll) + " não existe num d20 (esquiva)", "RangeError");

            double bonus = Damage.FleeBonus(hero, monster);
            double total = roll + bonus;
            return new FleeAttemptResult { Roll = roll, Bonus = bonus, Total = total, Success = total >= EsquivaTarget };
        }

        /// <summary>Number.isInteger do JS: finito e sem parte fracionária.</summary>
        internal static bool EhInteiro(double x) => Js.IsFinite(x) && Math.Floor(x) == x;
    }
}
