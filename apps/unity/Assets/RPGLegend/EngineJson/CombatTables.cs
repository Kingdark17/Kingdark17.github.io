using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// Tabelas do combate: combat/resolve-attack, combat/party, combat/status-effects, combat/use-power,
    /// combat/flee e combat/dodge.
    /// </summary>
    [Preserve]
    internal sealed class CombatTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.ResolveAttackTable = JsSerializer.Parse<ResolveAttackData>(readTable("combat/resolve-attack"));
            GameData.PartyTable = JsSerializer.Parse<PartyData>(readTable("combat/party"));
            GameData.StatusEffectsTable = JsSerializer.Parse<StatusEffectsData>(readTable("combat/status-effects"));
            GameData.UsePowerTable = JsSerializer.Parse<UsePowerData>(readTable("combat/use-power"));
            GameData.FleeTable = JsSerializer.Parse<FleeData>(readTable("combat/flee"));
            GameData.DodgeTable = JsSerializer.Parse<DodgeData>(readTable("combat/dodge"));
        }
    }
}
