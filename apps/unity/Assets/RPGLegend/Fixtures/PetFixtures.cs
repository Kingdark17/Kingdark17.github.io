using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/pets.json.</summary>
    internal sealed class PetFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "pets";

            Const(M, "PET_ICONS", () => W(Pets.Icons));
            Const(M, "PET_BONUSES", () => W(Pets.Bonuses));

            // pet ausente, null ou que não é texto chegam como null: no TS todos caem no fallback.
            Fn(M, "petBonus", (a, c) => W(Pets.Bonus(Str(a["pet"]))));
            Fn(M, "petIcon", (a, c) => W(Pets.Icon(Str(a["pet"]))));
        }
    }
}
