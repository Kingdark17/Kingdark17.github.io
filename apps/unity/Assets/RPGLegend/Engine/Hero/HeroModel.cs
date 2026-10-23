using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: Hero — o herói jogável, como vai para o save (port de shared/src/hero/hero.ts).
    ///
    /// Regras do modelo (ver PORTING.md):
    ///  - campo opcional no TS (<c>x?: T</c>) é anulável aqui, e null = ausente (some do JSON);
    ///  - nenhum campo tem inicializador: o que não veio do save continua ausente na saída, como no TS;
    ///  - <see cref="AttrPoints"/> é a exceção dos obrigatórios: o TS o declara obrigatório, mas o save
    ///    antigo chega sem ele (o <c>saveAntigo</c> do gerador). Em conta, use <c>Js.Num(AttrPoints)</c>
    ///    (ausente vira NaN, como o undefined do JS) ou <c>Js.Truthy(AttrPoints)</c>;
    ///  - os outros números obrigatórios são <c>double</c>: ausentes no JSON, chegam como 0;
    ///  - <c>{ ...hero }</c> do TS é <see cref="Clone"/> (raso: atributos, equipamento, listas, debuff,
    ///    derived e buffs continuam sendo os mesmos objetos).
    ///
    /// Implementa <see cref="IHeroCore"/> para ir direto em <c>Derived.Compute</c>.
    /// </summary>
    public sealed class Hero : IHeroCore
    {
        // --- HeroCore ---
        public double Level;
        public Attributes Attrs;
        /// <summary>TS: HeroEquipment — slot ausente = undefined; slot com null = vazio de propósito.</summary>
        public Equipment Equip;

        // --- identidade e aparência ---
        public string Name;
        public string Race;
        public string RaceIcon;
        public string ClassName;
        public string ClassIcon;
        /// <summary>Opcional: save antigo só tem o nome (ver <see cref="Catalog.IdDaClasse"/>).</summary>
        public string ClassId;
        /// <summary>Opcional, pelo mesmo motivo de <see cref="ClassId"/>.</summary>
        public string RaceId;
        /// <summary>Penteado — só aparência. Opcional.</summary>
        public string Hair;

        // --- progressão ---
        public double Xp;
        public double XpNext;
        /// <summary>
        /// Obrigatório no TS, mas ausente no save antigo: por isso anulável. <c>hydrateSavedHero</c> o
        /// preenche com <c>attrPoints || 0</c>; as outras funções o deixam como veio.
        /// </summary>
        public double? AttrPoints;
        public double Gold;
        /// <summary>Nomes de exibição dos poderes; o save antigo só tem estes.</summary>
        public List<string> PowerNames;
        /// <summary>Opcional: o id é o que vale; save antigo não tem.</summary>
        public List<string> PowerIds;
        public DebuffDef Debuff;
        public double KillCount;
        /// <summary>Salas vencidas, a conta da maestria. Opcional (save de antes da maestria).</summary>
        public double? MasteryBattles;
        /// <summary>Professores de classe já encontrados: 0, 1 ou 2. Ausente = 0.</summary>
        public double? TeachersMet;

        // --- vida e mana ---
        public double Hp;
        public double Mp;
        public double MaxHp;
        public double MaxMp;
        public DerivedStats Derived;

        // --- estado temporário ---
        /// <summary>Buffs de combate. Opcional.</summary>
        public HeroBuffs Buffs;
        /// <summary>Bênção de NPC: esquiva extra por N combates inteiros. Opcional.</summary>
        public NpcBlessing NpcBlessing;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        double IHeroCore.Level => Level;
        Attributes IHeroCore.Attrs => Attrs;
        Equipment IHeroCore.Equip => Equip;

        /// <summary>O <c>{ ...hero }</c> do TS: cópia rasa (os objetos de dentro são os mesmos).</summary>
        public Hero Clone()
        {
            var c = (Hero)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>
    /// TS: HeroBuffs — buffs temporários de combate. Todos opcionais: null = ausente.
    /// </summary>
    public sealed class HeroBuffs
    {
        public bool? CritNext;
        public double? PrecisaoTurns;
        public double? PrecisaoAmount;
        public double? ForcaTurns;
        public double? ForcaAmount;
        public double? EsquivaTurns;
        public double? EsquivaAmount;
        public double? Shield;
        public double? PoisonTurns;
        public double? PoisonDmg;
        /// <summary>Canção de Batalha: multiplica o dano do herói e dos companheiros; cai uma vez por rodada.</summary>
        public double? InspiracaoTurns;
        public double? InspiracaoAmount;

        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...buffs }</c> do TS.</summary>
        public HeroBuffs Clone()
        {
            var c = (HeroBuffs)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: Hero['npcBlessing'] — <c>{ combats, dodge }</c>.</summary>
    public sealed class NpcBlessing
    {
        /// <summary>
        /// Anulável de propósito: com o campo ausente, o TS faz <c>undefined &lt;= 0</c> (falso) e aplica a
        /// bênção, que então some (<c>NaN &gt; 0</c> é falso). Ver NpcServices.ApplyNpcBlessing.
        /// </summary>
        public double? Combats;
        public double? Dodge;

        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...npcBlessing }</c> do TS.</summary>
        public NpcBlessing Clone()
        {
            var c = (NpcBlessing)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: CompanionStance — a postura escolhida no gerenciar equipe.</summary>
    public static class CompanionStances
    {
        public const string Equilibrada = "equilibrada";
        public const string Agressiva = "agressiva";
        public const string Defensiva = "defensiva";
        public const string Suporte = "suporte";
    }

    /// <summary>TS: Companion — companheiro de equipe (vai para o save).</summary>
    public sealed class Companion
    {
        public string Name;
        public string RaceIcon;
        public string Race;
        public string ClassName;
        public string ClassIcon;
        /// <summary>Opcional; igual ao herói, é o id que as regras de combate olham.</summary>
        public string ClassId;
        public double Hp;
        public double MaxHp;
        public double Attack;
        public Attributes Attrs;
        /// <summary>Um de <see cref="CompanionStances"/>.</summary>
        public string Stance;
        public string Ability;
        public string AbilityDesc;
        /// <summary>Recrutado por tempo limitado (serviço de NPC). Opcional.</summary>
        public bool? Temporary;
        public double? CombatsLeft;
        /// <summary>O esqueleto do necromante (<see cref="Invocacao"/>): é da luta, não ocupa vaga e some no fim dela.</summary>
        public bool? Invocado;

        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...companion }</c> do TS (atributos compartilhados).</summary>
        public Companion Clone()
        {
            var c = (Companion)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }
}
