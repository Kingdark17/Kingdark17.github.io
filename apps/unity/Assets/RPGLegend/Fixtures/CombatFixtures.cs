using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/combat.json, menos os de monster-state.ts (freshCombatMonster, setStatusField,
    /// decrementField), que estão em MonsterFixtures. Cada handler reproduz o executor do gerador
    /// (scripts/gen-fixtures.ts, seção modulo('combat')).
    ///
    /// Todo monstro de entrada é lido como <see cref="CombatMonsterView"/>, o tipo mais rico: assim nenhum
    /// campo conhecido cai no Extra, e as cópias que a engine devolve continuam visões (o Clone guarda o
    /// tipo). Monstro de combate sem os campos da visão sai igual: os campos ausentes continuam ausentes.
    /// </summary>
    internal sealed class CombatFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "combat";

            // ---------- damage ----------
            Fn(M, "fleeBonus", (a, c) => N(Damage.FleeBonus(R<Hero>(a["hero"]), R<MonsterInstance>(a["monster"]))));
            Fn(M, "weaponAtkContribution", (a, c) => N(Damage.WeaponAtkContribution(R<Hero>(a["hero"]), Num(a["affinityPct"]))));
            Fn(M, "otherEquipAtk", (a, c) => N(Damage.OtherEquipAtk(R<Hero>(a["hero"]))));
            Fn(M, "modifyDamageByAffinity", (a, c) => W(Damage.ModifyDamageByAffinity(
                Monstro(a["monster"]), Str(a["weakness"]), Str(a["resistance"]), Num(a["dmg"]), Str(a["type"]), JsJson.Truthy(a["halfResist"]))));

            // ---------- status-effects ----------
            Fn(M, "tickMonsterDot", (a, c) => W(StatusEffects.TickMonsterDot(Monstro(a["monster"]))));
            // power é um Power inteiro do catálogo ou só { status }: o PowerDef lê os dois.
            Fn(M, "applyPowerStatus", (a, c) =>
                W(StatusEffects.ApplyPowerStatus(R<PowerDef>(a["power"]), Monstro(a["monster"]), R<DerivedStats>(a["derived"]))));

            // ---------- weapon-proc ----------
            Fn(M, "applyWeaponProc", (a, c) => W(WeaponProc.ApplyWeaponProc(R<Hero>(a["hero"]), Monstro(a["monster"]), c.RngFn)));

            // ---------- hero-status ----------
            Fn(M, "tickHeroStatus", (a, c) => W(HeroStatus.TickHeroStatus(R<Hero>(a["hero"]))));

            // ---------- class-passives ----------
            Fn(M, "applyHeroClassPassive", (a, c) =>
                W(ClassPassives.ApplyHeroClassPassive(R<Hero>(a["hero"]), Monstro(a["monster"]), Num(a["dmg"]), c.RngFn)));
            Fn(M, "triggerEnemyClassPower", (a, c) => W(ClassPassives.TriggerEnemyClassPower(Monstro(a["monster"]), R<Hero>(a["hero"]))));

            // ---------- party ----------
            Fn(M, "applyPartyTurn", (a, c) =>
                W(Party.ApplyPartyTurn(R<Hero>(a["hero"]), Equipe(a["party"]), Monstro(a["monster"]), c.RngFn)));
            Fn(M, "passarRodadaDaCancao", (a, c) => W(Party.PassarRodadaDaCancao(R<Hero>(a["hero"]))));
            Fn(M, "partyMemberAct", (a, c) => W(Party.PartyMemberAct(R<Hero>(a["hero"]), R<Companion>(a["member"]), Monstro(a["monster"]), c.RngFn)));

            // As três partes do golpe do monstro, que a luta em tempo real chama em momentos diferentes.
            Fn(M, "startMonsterAttack", (a, c) => W(MonsterHit.StartMonsterAttack(Monstro(a["monster"]), R<Hero>(a["hero"]), c.RngFn)));
            Fn(M, "landHitOnHero", (a, c) => W(MonsterHit.LandHitOnHero(R<Hero>(a["hero"]), Monstro(a["monster"]), Num(a["attackMult"]), c.RngFn,
                JsJson.ToOptionalNumber(a["petEsquiva"]) ?? 0, R<DefesasDoHeroi>(a["defesas"]))));
            // O esqueleto do necromante.
            Fn(M, "criarEsqueleto", (a, c) => W(Invocacao.CriarEsqueleto(R<Hero>(a["hero"]), Equipe(a["party"]))));
            Fn(M, "esqueletosDePe", (a, c) => N(Invocacao.EsqueletosDePe(Equipe(a["party"]))));
            Fn(M, "semInvocados", (a, c) => W(Invocacao.SemInvocados(Equipe(a["party"]))));
            Fn(M, "hitPartyMember", (a, c) => W(MonsterHit.HitPartyMember(R<Companion>(a["member"]), Monstro(a["monster"]), Num(a["attackMult"]), c.RngFn)));
            Fn(M, "pickMonsterTarget", (a, c) => W(MonsterHit.PickMonsterTarget(Equipe(a["party"]), c.RngFn)));

            // ---------- flee e dodge ----------
            Const(M, "FLEE_TARGET", () => N(Flee.FleeTarget));
            Const(M, "ESQUIVA_TARGET", () => N(Dodge.EsquivaTarget));
            Fn(M, "attemptFlee", (a, c) => W(Flee.AttemptFlee(R<Hero>(a["hero"]), R<MonsterInstance>(a["monster"]), Num(a["roll"]))));
            Fn(M, "attemptDodge", (a, c) => W(Dodge.AttemptDodge(R<Hero>(a["hero"]), R<MonsterInstance>(a["monster"]), Num(a["roll"]))));

            // ---------- monster-hit ----------
            // O gerador chama applyMonsterHit(hero, party, monster, { ...args.options, rng }).
            Fn(M, "applyMonsterHit", (a, c) =>
            {
                var o = a["options"];
                var options = new MonsterHitOptions
                {
                    Rng = c.RngFn,
                    PetEsquivaBonus = JsJson.ToOptionalNumber(JsJson.Prop(o, "petEsquivaBonus")),
                    EsquivaCerta = JsJson.Truthy(JsJson.Prop(o, "esquivaCerta")),
                };
                return W(MonsterHit.ApplyMonsterHit(R<Hero>(a["hero"]), Equipe(a["party"]), Monstro(a["monster"]), options));
            });

            // ---------- use-power ----------
            Fn(M, "powerManaCost", (a, c) => N(UsePower.PowerManaCost(R<Hero>(a["hero"]), R<PowerDef>(a["power"]))));
            // O gerador chama castPower(hero, party, monster, power, { ...args.options, rng }).
            Fn(M, "castPower", (a, c) =>
            {
                var o = a["options"];
                var options = new UsePowerOptions
                {
                    Rng = c.RngFn,
                    PetCuraBonus = JsJson.ToOptionalNumber(JsJson.Prop(o, "petCuraBonus")),
                    PetManaSaveChance = JsJson.ToOptionalNumber(JsJson.Prop(o, "petManaSaveChance")),
                };
                return W(UsePower.CastPower(R<Hero>(a["hero"]), Equipe(a["party"]), Monstro(a["monster"]), R<PowerDef>(a["power"]), options));
            });

            // ---------- resolve-attack ----------
            Const(M, "LADOS_DO_DANO", () => N(Attack.LadosDoDano));
            Const(M, "FAIXA_CRITICA", () => N(Attack.FaixaCritica));
            Const(M, "FORCA_NA_BORDA", () => N(Attack.ForcaNaBorda));
            Const(M, "FORCA_NO_CENTRO", () => N(Attack.ForcaNoCentro));
            Fn(M, "ehAtaqueDaClasse", (a, c) => W(Attack.EhAtaqueDaClasse(R<Hero>(a["hero"]), Str(a["estilo"]))));
            Fn(M, "zonaDoAtaque", (a, c) => N(Attack.ZonaDoAtaque(R<Hero>(a["hero"]), Str(a["estilo"]))));
            Fn(M, "ataquesDisponiveis", (a, c) => W(Attack.AtaquesDisponiveis(R<Hero>(a["hero"]))));
            // mira null é o "passou do fim sem toque"; ausente seria o undefined (NaN numa conta).
            Fn(M, "lerMira", (a, c) => W(Attack.LerMira(Num(a["zona"]), JsJson.IsNull(a["mira"]) ? (double?)null : Num(a["mira"]))));
            // O gerador chama resolveAttack(hero, monster, jogada, attackStyle, { ...args.options, rng }).
            Fn(M, "resolveAttack", (a, c) =>
            {
                var options = new ResolveAttackOptions
                {
                    Rng = c.RngFn,
                    PetCriticoBonus = JsJson.ToOptionalNumber(JsJson.Prop(a["options"], "petCriticoBonus")),
                };
                return W(Attack.ResolveAttack(R<Hero>(a["hero"]), Monstro(a["monster"]), R<JogadaDeAtaque>(a["jogada"]), Str(a["attackStyle"]), options));
            });
        }

        /// <summary>A equipe de um argumento (lista vazia quando ausente).</summary>
        private static List<Companion> Equipe(JToken token) => R<List<Companion>>(token) ?? new List<Companion>();

        /// <summary>O monstro de um argumento, no tipo mais rico (ver o resumo da classe).</summary>
        private static CombatMonsterView Monstro(JToken token) => R<CombatMonsterView>(token);
    }
}
