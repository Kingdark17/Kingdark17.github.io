using System;

namespace RPGLegend.Engine
{
    /// <summary>
    /// O que DotStatus e AmountStatus têm em comum: os turnos que faltam. É a restrição de
    /// <see cref="MonsterState.DecrementField{T}"/> (o <c>T extends DotStatus | AmountStatus</c> do TS).
    /// </summary>
    public abstract class TurnStatus
    {
        public double Turns;

        /// <summary>Campos que o C# não conhece; voltam intactos (o spread do TS também os leva).</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...status }</c> do TS: cópia rasa e do mesmo tipo.</summary>
        public TurnStatus CloneStatus()
        {
            var c = (TurnStatus)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: DotStatus — status contínuo: dano fixo por turno até os turnos zerarem.</summary>
    public sealed class DotStatus : TurnStatus
    {
        public double Dmg;

        public DotStatus Clone() => (DotStatus)CloneStatus();
    }

    /// <summary>TS: AmountStatus — status que aplica um multiplicador enquanto dura.</summary>
    public sealed class AmountStatus : TurnStatus
    {
        /// <summary>
        /// Obrigatório no tipo do TS, mas o combate trata a ausência (<c>amount || 0.2</c>, save antigo) e
        /// os fixtures trazem <c>{ turns }</c> sem amount: por isso anulável — null é o campo ausente, que
        /// precisa continuar ausente quando o status é copiado.
        /// </summary>
        public double? Amount;

        public AmountStatus Clone() => (AmountStatus)CloneStatus();
    }

    /// <summary>
    /// TS: MonsterStatus — os status ativos num monstro durante o combate. Todos opcionais: null é a chave
    /// ausente. <see cref="Atordoado"/> é só um contador de turnos perdidos (um número solto, não
    /// <c>{ turns }</c>), porque zera no mesmo turno em que consome.
    ///
    /// O TS também lê e escreve por chave (<c>status[key]</c>, <c>setStatusField(status, key, …)</c>):
    /// <see cref="Get"/> e <see cref="Set"/> fazem isso. Chave desconhecida mora no <see cref="Extra"/>.
    /// </summary>
    public sealed class MonsterStatus
    {
        public DotStatus Queimadura;
        public DotStatus Sangramento;
        public DotStatus Veneno;
        public double? Atordoado;
        public AmountStatus Enfraquecido;
        public AmountStatus Vulneravel;
        public AmountStatus Lento;

        /// <summary>Chaves que o C# não conhece; voltam intactas ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...status }</c> do TS: cópia rasa (os DotStatus/AmountStatus são os mesmos objetos).</summary>
        public MonsterStatus Clone()
        {
            var c = (MonsterStatus)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }

        /// <summary>
        /// O <c>status[key]</c> do TS: um DotStatus, um AmountStatus, o número de atordoado (double), o valor
        /// guardado de uma chave desconhecida, ou null quando a chave está ausente.
        /// </summary>
        public object Get(string key)
        {
            switch (key)
            {
                case "queimadura": return Queimadura;
                case "sangramento": return Sangramento;
                case "veneno": return Veneno;
                case "atordoado": return Atordoado;
                case "enfraquecido": return Enfraquecido;
                case "vulneravel": return Vulneravel;
                case "lento": return Lento;
                default: return Extra != null && Extra.TryGet(key, out var v) ? v : null;
            }
        }

        /// <summary>O <c>status[key]</c> de uma chave de dano contínuo (queimadura, sangramento, veneno).</summary>
        public DotStatus GetDot(string key) => Get(key) as DotStatus;

        /// <summary>O <c>status[key]</c> de uma chave de multiplicador (enfraquecido, vulneravel, lento).</summary>
        public AmountStatus GetAmount(string key) => Get(key) as AmountStatus;

        /// <summary>
        /// O <c>status[key] = value</c> do TS, mutando este objeto; null é o <c>delete status[key]</c>.
        /// O tipo do valor tem de ser o da chave (DotStatus, AmountStatus ou número) — o TS garante isso pelo
        /// tipo; aqui, valor do tipo errado numa chave conhecida é erro de quem chamou. Chave desconhecida
        /// aceita qualquer valor e vai para o Extra.
        /// </summary>
        public void Set(string key, object value)
        {
            switch (key)
            {
                case "queimadura": Queimadura = As<DotStatus>(key, value); return;
                case "sangramento": Sangramento = As<DotStatus>(key, value); return;
                case "veneno": Veneno = As<DotStatus>(key, value); return;
                case "atordoado": Atordoado = AsNumber(key, value); return;
                case "enfraquecido": Enfraquecido = As<AmountStatus>(key, value); return;
                case "vulneravel": Vulneravel = As<AmountStatus>(key, value); return;
                case "lento": Lento = As<AmountStatus>(key, value); return;
                default:
                    if (value == null)
                    {
                        Extra?.Remove(key);
                        return;
                    }
                    if (Extra == null) Extra = new JsExtras();
                    Extra.Set(key, value);
                    return;
            }
        }

        private static T As<T>(string key, object value) where T : TurnStatus
        {
            if (value == null || value is T) return (T)value;
            throw new ArgumentException("status." + key + " espera " + typeof(T).Name + ", recebeu " + value.GetType().Name);
        }

        private static double? AsNumber(string key, object value)
        {
            switch (value)
            {
                case null: return null;
                case double d: return d;
                case int i: return i;
                default: throw new ArgumentException("status." + key + " espera um número, recebeu " + value.GetType().Name);
            }
        }
    }

    /// <summary>
    /// TS: CombatMonster — a instância gerada mais o estado que só existe enquanto a luta dura. Nenhum
    /// destes campos é escrito por generate/generateBoss: nascem quando o combate começa
    /// (<see cref="MonsterState.FreshCombatMonster"/>) e não sobrevivem a ele. Todos opcionais (null = ausente).
    /// </summary>
    public class CombatMonster : MonsterInstance
    {
        public MonsterStatus Status;
        public double? AttackCount;
        /// <summary>Golpes restantes que a Muralha Sombria do Guardião ainda vai reduzir.</summary>
        public double? GuardHits;
        /// <summary>Marca que o próximo golpe do monstro no herói envenena — proc do Assassino.</summary>
        public bool? PoisonStrike;
        /// <summary>Já disparou o enrage de mini-chefe abaixo de 50% de vida (dispara uma vez só).</summary>
        public bool? RageTriggered;

        /// <summary>O <c>{ ...monster }</c> do TS: cópia rasa e do mesmo tipo (uma visão continua visão).</summary>
        public new CombatMonster Clone() => (CombatMonster)base.Clone();

        /// <summary>
        /// O <c>{ ...monster }</c> de qualquer monstro, como CombatMonster: se já é um (ou uma visão), é o
        /// <see cref="Clone"/>; se é uma instância simples, copia os campos dela num CombatMonster novo.
        /// </summary>
        public static CombatMonster From(MonsterInstance monster)
        {
            if (monster is CombatMonster combat) return combat.Clone();
            var c = new CombatMonster();
            monster.CopyInstanceFieldsTo(c);
            c.PromoteCombatExtras();
            return c;
        }

        /// <summary>
        /// Passa para os campos as chaves de combate que vieram como desconhecidas — o monstro tinha sido lido
        /// como MonsterInstance (ex.: dentro de uma célula do mapa salvo). No TS o spread mantém essas chaves e o
        /// combate as lê; sem isto, guardHits/poisonStrike/rageTriggered ficariam presos no Extra.
        /// </summary>
        internal void PromoteCombatExtras()
        {
            if (Extra == null) return;
            if (Extra.TryTake("status", out MonsterStatus status)) Status = status;
            if (Extra.TryTake("attackCount", out double? attackCount)) AttackCount = attackCount;
            if (Extra.TryTake("guardHits", out double? guardHits)) GuardHits = guardHits;
            if (Extra.TryTake("poisonStrike", out bool? poisonStrike)) PoisonStrike = poisonStrike;
            if (Extra.TryTake("rageTriggered", out bool? rageTriggered)) RageTriggered = rageTriggered;
            if (Extra.Count == 0) Extra = null;
        }

        /// <summary>Copia os campos de combate (raso) para outro objeto.</summary>
        internal void CopyCombatFieldsTo(CombatMonster target)
        {
            target.Status = Status;
            target.AttackCount = AttackCount;
            target.GuardHits = GuardHits;
            target.PoisonStrike = PoisonStrike;
            target.RageTriggered = RageTriggered;
        }
    }

    /// <summary>
    /// TS: CombatMonsterView (<c>CombatMonster &amp; MonsterViewFields</c>) — o monstro com nome, ícone,
    /// comportamento e textos já resolvidos por <see cref="Monsters.View"/>. É o formato que as funções de
    /// resolução de ataque recebem: o estado bruto (status, guardHits) e os campos da espécie
    /// (fraqueza e resistência ficam dentro de <see cref="Species"/>; behavior já vem raso).
    ///
    /// A MonsterView do TS (<c>MonsterInstance &amp; MonsterViewFields</c>) é esta mesma classe com os
    /// campos de combate ausentes.
    /// </summary>
    public sealed class CombatMonsterView : CombatMonster
    {
        public SpeciesDef Species;
        public EnemyClassDef EnemyClass;
        public string Name;
        public string Icon;
        public string Behavior;
        public string Ability;
        public string AbilityDesc;
        /// <summary>"Chefe Brutamontes" para chefe, "Brutamontes" para monstro comum.</summary>
        public string EnemyClassLabel;

        /// <summary>As chaves que a visão escreve (TS: as de MonsterViewFields).</summary>
        internal static readonly string[] ViewKeys =
            { "species", "enemyClass", "name", "icon", "behavior", "ability", "abilityDesc", "enemyClassLabel" };

        /// <summary>O <c>{ ...monster }</c> do TS: cópia rasa.</summary>
        public new CombatMonsterView Clone() => (CombatMonsterView)base.Clone();

        /// <summary>
        /// O <c>{ ...monster }</c> de qualquer monstro, como visão: se já é uma, é o <see cref="Clone"/>;
        /// senão copia os campos que o monstro tem (os de combate, se for CombatMonster) numa visão nova,
        /// com os campos da visão ainda vazios.
        /// </summary>
        public new static CombatMonsterView From(MonsterInstance monster)
        {
            if (monster is CombatMonsterView view) return view.Clone();
            var c = new CombatMonsterView();
            monster.CopyInstanceFieldsTo(c);
            if (monster is CombatMonster combat) combat.CopyCombatFieldsTo(c);
            else c.PromoteCombatExtras();
            return c;
        }
    }

    /// <summary>Port de shared/src/combat/monster-state.ts.</summary>
    public static class MonsterState
    {
        /// <summary>
        /// TS: freshCombatMonster — <c>{ ...monster, status: {}, attackCount: 0 }</c>: o monstro de sempre
        /// (cópia, do mesmo tipo se já for de combate) com o estado de combate zerado. Os outros campos de
        /// combate que ele já tivesse (guardHits…) continuam, como no spread.
        /// </summary>
        public static CombatMonster FreshCombatMonster(MonsterInstance monster)
        {
            var next = CombatMonster.From(monster);
            next.Status = new MonsterStatus();
            next.AttackCount = 0;
            next.ForgetExtras("status", "attackCount");
            return next;
        }

        /// <summary>
        /// TS: setStatusField — escreve (ou remove, se value for null — o undefined do TS) um campo de status
        /// sem mutar o original: devolve uma cópia rasa. status null vale como <c>{}</c>.
        /// </summary>
        public static MonsterStatus SetStatusField(MonsterStatus status, string key, object value)
        {
            var next = status != null ? status.Clone() : new MonsterStatus();
            next.Set(key, value);
            return next;
        }

        /// <summary>TS: setStatusField com DotStatus/AmountStatus (null remove a chave).</summary>
        public static MonsterStatus SetStatusField(MonsterStatus status, string key, TurnStatus value) =>
            SetStatusField(status, key, (object)value);

        /// <summary>TS: setStatusField com número — o atordoado (null remove a chave).</summary>
        public static MonsterStatus SetStatusField(MonsterStatus status, string key, double? value) =>
            SetStatusField(status, key, value.HasValue ? (object)value.Value : null);

        /// <summary>
        /// TS: decrementField — tira 1 de turns e devolve uma cópia; devolve null (o undefined do TS) quando
        /// chega a zero, ou se o status já era ausente.
        /// </summary>
        public static T DecrementField<T>(T status) where T : TurnStatus
        {
            if (status == null) return null;
            double turns = status.Turns - 1;
            if (!(turns > 0)) return null;
            var next = (T)status.CloneStatus();
            next.Turns = turns;
            return next;
        }
    }
}
