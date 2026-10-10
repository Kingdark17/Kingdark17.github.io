namespace RPGLegend.Engine
{
    /// <summary>TS: HeroClassPassiveKind — qual passiva de classe disparou.</summary>
    public static class HeroClassPassiveKinds
    {
        public const string Ladino = "ladino";
        public const string Necromante = "necromante";
        public const string Druida = "druida";
        public const string Monge = "monge";
        public const string Bardo = "bardo";
        public const string Cacador = "cacador";
        public const string Paladino = "paladino";
        public const string Clerigo = "clerigo";
    }

    /// <summary>TS: HeroClassPassiveResult['triggered'] (quando não é null) — <c>{ kind, amount }</c>.</summary>
    public sealed class HeroClassPassiveTrigger
    {
        /// <summary>Um de <see cref="HeroClassPassiveKinds"/>.</summary>
        public string Kind;
        /// <summary>Dano extra, dano do status, cura, ou o multiplicador do status, conforme a passiva.</summary>
        public double Amount;
    }

    /// <summary>TS: HeroClassPassiveResult.</summary>
    public sealed class HeroClassPassiveResult
    {
        public Hero Hero;
        public CombatMonster Monster;
        /// <summary>null (sempre presente) quando a classe não tem passiva reativa ou o rolo não ativou.</summary>
        [KeepNull] public HeroClassPassiveTrigger Triggered;
    }

    /// <summary>O retorno de triggerEnemyClassPower no TS: <c>{ monster, hero, attackMult, triggered }</c>.</summary>
    public sealed class EnemyClassPowerResult
    {
        public CombatMonster Monster;
        public Hero Hero;
        public double AttackMult;
        /// <summary>O id da classe de inimigo cujo poder disparou, ou null (sempre presente).</summary>
        [KeepNull] public string Triggered;
    }

    /// <summary>Port de shared/src/combat/class-passives.ts.</summary>
    public static class ClassPassives
    {
        // Os nomes de tela comparados por applyHeroClassPassive, com escape para não depender da
        // normalização Unicode do arquivo (é a forma composta, a mesma do catálogo e do TS).
        private const string NomeCacador = "Caçador";
        private const string NomeClerigo = "Clérigo";

        /// <summary>
        /// TS: applyHeroClassPassive — a passiva única de cada classe, disparada ao acertar um golpe.
        /// Cada classe sorteia uma vez (só a que bate com o nome tira número do rng); só uma passiva pode
        /// disparar por ataque.
        ///
        /// Atenção, porte fiel: compara <c>hero.className</c> — o texto de tela —, não o id. Um save com
        /// "Clerigo" sem acento não dispara a passiva (e não sorteia); "Cacador" sem acento dispara, porque o
        /// TS aceita as duas grafias só para o Caçador.
        ///
        /// Não muta nada: o que muda sai em cópia; o que não muda é o mesmo objeto de entrada.
        /// </summary>
        public static HeroClassPassiveResult ApplyHeroClassPassive(Hero hero, CombatMonster monster, double dmg, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            string cls = hero.ClassName;

            if (cls == "Ladino" && rng() < 0.25)
            {
                double extra = Js.Max(1, Js.Round(dmg * 0.5));
                var m = monster.Clone();
                m.Hp = monster.Hp - extra;
                return Disparou(hero, m, HeroClassPassiveKinds.Ladino, extra);
            }
            if (cls == "Necromante" && rng() < 0.3)
            {
                var status = MonsterState.SetStatusField(monster.Status, "enfraquecido", new AmountStatus { Turns = 2, Amount = 0.2 });
                return Disparou(hero, ComStatus(monster, status), HeroClassPassiveKinds.Necromante, 0.2);
            }
            if (cls == "Druida" && rng() < 0.3)
            {
                var veneno = new DotStatus { Turns = 3, Dmg = Js.Max(2, Js.Round(dmg * 0.2)) };
                var status = MonsterState.SetStatusField(monster.Status, "veneno", veneno);
                return Disparou(hero, ComStatus(monster, status), HeroClassPassiveKinds.Druida, veneno.Dmg);
            }
            if (cls == "Monge" && rng() < 0.22)
            {
                var status = MonsterState.SetStatusField(monster.Status, "atordoado", (monster.Status?.Atordoado ?? 0) + 1);
                return Disparou(hero, ComStatus(monster, status), HeroClassPassiveKinds.Monge, 1);
            }
            if (cls == "Bardo" && rng() < 0.3)
            {
                var status = MonsterState.SetStatusField(monster.Status, "vulneravel", new AmountStatus { Turns = 2, Amount = 0.15 });
                return Disparou(hero, ComStatus(monster, status), HeroClassPassiveKinds.Bardo, 0.15);
            }
            if ((cls == NomeCacador || cls == "Cacador") && rng() < 0.3)
            {
                var sangramento = new DotStatus { Turns = 3, Dmg = Js.Max(2, Js.Round(dmg * 0.2)) };
                var status = MonsterState.SetStatusField(monster.Status, "sangramento", sangramento);
                return Disparou(hero, ComStatus(monster, status), HeroClassPassiveKinds.Cacador, sangramento.Dmg);
            }
            if (cls == "Paladino" && rng() < 0.25)
            {
                double heal = Js.Max(3, Js.Round(dmg * 0.2));
                return Disparou(Curado(hero, heal), monster, HeroClassPassiveKinds.Paladino, heal);
            }
            if (cls == NomeClerigo && rng() < 0.2)
            {
                double heal = Js.Max(2, Js.Round(dmg * 0.15));
                return Disparou(Curado(hero, heal), monster, HeroClassPassiveKinds.Clerigo, heal);
            }

            return new HeroClassPassiveResult { Hero = hero, Monster = monster, Triggered = null };
        }

        /// <summary>
        /// TS: triggerEnemyClassPower — o poder de classe de inimigo, a cada 3º ataque do monstro
        /// (<c>attackCount % 3 === 0</c>, com attackCount presente e diferente de 0). Quem chama incrementa
        /// attackCount ANTES (o original fazia <c>monster.attackCount++</c> e só depois checava o módulo), então
        /// o gatilho é no 3º, 6º, 9º ataque, nunca no primeiro. Não sorteia.
        ///
        /// Brutamontes ×1,7; Assassino ×1,4 e marca poisonStrike; Xamã cura 14% da vida máxima (no mínimo 4,
        /// sem passar do máximo); Guardião ergue a Muralha Sombria (guardHits = 2); Feiticeiro ×1,3 e drena
        /// 60% do dano em mana (no mínimo 4, no máximo a que o herói tem). Classe sem poder: nada.
        /// </summary>
        public static EnemyClassPowerResult TriggerEnemyClassPower(CombatMonster monster, Hero hero)
        {
            var none = new EnemyClassPowerResult { Monster = monster, Hero = hero, AttackMult = 1, Triggered = null };
            if (!Js.Truthy(monster.AttackCount) || monster.AttackCount.Value % 3 != 0) return none;

            switch (monster.EnemyClassId)
            {
                case "brutamontes":
                    return new EnemyClassPowerResult { Monster = monster, Hero = hero, AttackMult = 1.7, Triggered = "brutamontes" };
                case "assassino":
                {
                    var m = monster.Clone();
                    m.PoisonStrike = true;
                    m.ForgetExtras("poisonStrike");
                    return new EnemyClassPowerResult { Monster = m, Hero = hero, AttackMult = 1.4, Triggered = "assassino" };
                }
                case "xama":
                {
                    double heal = Js.Max(4, Js.Round(monster.MaxHp * 0.14));
                    var m = monster.Clone();
                    m.Hp = Js.Min(monster.MaxHp, monster.Hp + heal);
                    return new EnemyClassPowerResult { Monster = m, Hero = hero, AttackMult = 1, Triggered = "xama" };
                }
                case "guardiao":
                {
                    var m = monster.Clone();
                    m.GuardHits = 2;
                    m.ForgetExtras("guardHits");
                    return new EnemyClassPowerResult { Monster = m, Hero = hero, AttackMult = 1, Triggered = "guardiao" };
                }
                case "feiticeiro":
                {
                    double drain = Js.Min(hero.Mp, Js.Max(4, Js.Round(monster.Dmg * 0.6)));
                    var h = hero.Clone();
                    h.Mp = hero.Mp - drain;
                    return new EnemyClassPowerResult { Monster = monster, Hero = h, AttackMult = 1.3, Triggered = "feiticeiro" };
                }
                default:
                    return none;
            }
        }

        private static HeroClassPassiveResult Disparou(Hero hero, CombatMonster monster, string kind, double amount) =>
            new HeroClassPassiveResult { Hero = hero, Monster = monster, Triggered = new HeroClassPassiveTrigger { Kind = kind, Amount = amount } };

        /// <summary>O <c>{ ...monster, status }</c> do TS.</summary>
        private static CombatMonster ComStatus(CombatMonster monster, MonsterStatus status)
        {
            var m = monster.Clone();
            m.Status = status;
            m.ForgetExtras("status");
            return m;
        }

        /// <summary>O <c>{ ...hero, hp: Math.min(hero.maxHp, hero.hp + heal) }</c> do TS.</summary>
        private static Hero Curado(Hero hero, double heal)
        {
            var h = hero.Clone();
            h.Hp = Js.Min(hero.MaxHp, hero.Hp + heal);
            return h;
        }
    }
}
