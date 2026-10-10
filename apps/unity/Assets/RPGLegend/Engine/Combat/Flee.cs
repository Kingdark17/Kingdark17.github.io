namespace RPGLegend.Engine
{
    /// <summary>TS: FleeAttemptResult — o julgamento do d20 da fuga (e da esquiva, que tem a mesma forma).</summary>
    public sealed class FleeAttemptResult
    {
        public double Roll;
        public double Bonus;
        public double Total;
        public bool Success;
    }

    /// <summary>
    /// Port de shared/src/combat/flee.ts: só o julgamento do d20; sair do combate (ou levar o turno do
    /// monstro na cara) é do orquestrador. A rolagem entra por parâmetro porque o dado é mostrado na tela
    /// antes do resultado, e o servidor precisa conferir a jogada com o mesmo número.
    /// </summary>
    public static class Flee
    {
        /// <summary>TS: FLEE_TARGET — total mínimo (d20 + bônus de velocidade) para escapar.</summary>
        public static double FleeTarget => GameData.FleeTable.FleeTarget;

        /// <summary>
        /// TS: attemptFlee — d20 + <see cref="Damage.FleeBonus"/> contra <see cref="FleeTarget"/>. A rolagem não
        /// é conferida (0 ou 25 passam direto, como no TS). Do monstro só a velocidade importa.
        /// </summary>
        public static FleeAttemptResult AttemptFlee(Hero hero, MonsterInstance monster, double roll)
        {
            double bonus = Damage.FleeBonus(hero, monster);
            double total = roll + bonus;
            return new FleeAttemptResult { Roll = roll, Bonus = bonus, Total = total, Success = total >= FleeTarget };
        }
    }
}
