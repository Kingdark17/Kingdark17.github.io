using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: EventChoiceId — as escolhas de cada evento (ferido: ajudar/curar/ignorar; altar:
    /// estudar/rezar/sacrificar; porta: forcar/examinar/desistir). <c>estudar</c> e <c>examinar</c> são de
    /// eventos diferentes e têm a mesma fórmula de propósito (checagem de Intelecto), como no original.
    /// </summary>
    public static class EventChoices
    {
        public const string Ajudar = "ajudar";
        public const string Curar = "curar";
        public const string Ignorar = "ignorar";
        public const string Estudar = "estudar";
        public const string Rezar = "rezar";
        public const string Sacrificar = "sacrificar";
        public const string Forcar = "forcar";
        public const string Examinar = "examinar";
        public const string Desistir = "desistir";
    }

    /// <summary>
    /// TS: EventOutcome — o que aconteceu, sem a frase de narração (quem chama monta o texto pelo
    /// <see cref="Kind"/>). No TS é uma união pelo <c>kind</c>; aqui é uma classe só, como LockReason, e cada
    /// kind preenche só os seus campos (os outros ficam ausentes):
    /// "insufficient_gold"/"too_wounded" → Required; "healed_wounded" → Success, GoldGained;
    /// "studied" → Success, Item; "prayed" → Success; "sacrificed" → HpLost;
    /// "forced_door" → Success, GoldGained, HpLost; "declined", "helped_wounded" e "invalid_choice" → nada.
    /// </summary>
    public sealed class EventOutcome
    {
        public const string KindDeclined = "declined";
        public const string KindInsufficientGold = "insufficient_gold";
        public const string KindTooWounded = "too_wounded";
        public const string KindHelpedWounded = "helped_wounded";
        public const string KindHealedWounded = "healed_wounded";
        public const string KindStudied = "studied";
        public const string KindPrayed = "prayed";
        public const string KindSacrificed = "sacrificed";
        public const string KindForcedDoor = "forced_door";
        public const string KindInvalidChoice = "invalid_choice";

        public string Kind;
        /// <summary>insufficient_gold: o ouro que faltou ter; too_wounded: a vida que o sacrifício pede.</summary>
        public double? Required;
        public bool? Success;
        public double? GoldGained;
        public double? HpLost;

        private Item _item;

        /// <summary>
        /// Só no kind "studied": o item achado, ou null (presente no JSON) quando falhou — o <c>item: Item | null</c>
        /// do TS. Atribuir marca <see cref="ItemSpecified"/>; nos outros kinds o campo nem existe.
        /// </summary>
        [KeepNull]
        public Item Item
        {
            get => _item;
            set
            {
                _item = value;
                ItemSpecified = true;
            }
        }

        /// <summary>
        /// O campo <c>item</c> existe (mesmo valendo null). É a convenção "XxxSpecified" que a camada de JSON
        /// segue ao escrever e ao ler: false = campo ausente (undefined).
        /// </summary>
        [JsIgnore] public bool ItemSpecified;

        public static EventOutcome Declined() => new EventOutcome { Kind = KindDeclined };

        public static EventOutcome InsufficientGold(double required) => new EventOutcome { Kind = KindInsufficientGold, Required = required };

        public static EventOutcome TooWounded(double required) => new EventOutcome { Kind = KindTooWounded, Required = required };

        public static EventOutcome HelpedWounded() => new EventOutcome { Kind = KindHelpedWounded };

        public static EventOutcome HealedWounded(bool success, double goldGained) =>
            new EventOutcome { Kind = KindHealedWounded, Success = success, GoldGained = goldGained };

        public static EventOutcome Studied(bool success, Item item) => new EventOutcome { Kind = KindStudied, Success = success, Item = item };

        public static EventOutcome Prayed(bool success) => new EventOutcome { Kind = KindPrayed, Success = success };

        public static EventOutcome Sacrificed(double hpLost) => new EventOutcome { Kind = KindSacrificed, HpLost = hpLost };

        public static EventOutcome ForcedDoor(bool success, double goldGained, double hpLost) =>
            new EventOutcome { Kind = KindForcedDoor, Success = success, GoldGained = goldGained, HpLost = hpLost };

        public static EventOutcome InvalidChoice() => new EventOutcome { Kind = KindInvalidChoice };
    }

    /// <summary>TS: EventXp — o XP de ter resolvido o evento.</summary>
    public sealed class EventXp
    {
        public double Gained;
        public bool LeveledUp;
        public double Levels;
    }

    /// <summary>TS: EventResolveResult.</summary>
    public sealed class EventResolveResult
    {
        public Hero Hero;
        public EventOutcome Outcome;
        /// <summary>false quando a escolha foi rejeitada e nada mudou (ouro/vida insuficiente, escolha desconhecida): a sala continua sem resolver.</summary>
        public bool Resolved;
        /// <summary>null (presente no JSON) quando a escolha foi seguir em frente ou não resolveu nada.</summary>
        [KeepNull] public EventXp Xp;
    }

    /// <summary>TS: EventResolveOptions.</summary>
    public sealed class EventResolveOptions
    {
        public RngFn Rng;
        /// <summary>O relógio do uid do item de estudar/examinar (o InstantiateOptions.now). Ausente, Date.now.</summary>
        public Func<double> Now;
    }

    /// <summary>
    /// Eventos de masmorra (port de shared/src/events/events.ts): escolhas curtas com resultado influenciado
    /// pelos atributos do herói. Só regra: devolve dado estruturado (o que mudou no herói, sucesso ou falha,
    /// item ganho), sem montar a narração. Como no TS, nada aqui muta o herói recebido.
    /// </summary>
    public static class DungeonEvents
    {
        /// <summary>TS: EVENT_TEMPLATES.</summary>
        public static List<EventTemplate> Templates => GameData.EventsTable.EventTemplates;

        /// <summary>TS: eventTemplateById — o primeiro com o id, ou null.</summary>
        public static EventTemplate TemplateById(string id)
        {
            foreach (var t in Templates) if (t.Id == id) return t;
            return null;
        }

        /// <summary>TS: randomEventTemplate — um sorteio.</summary>
        public static EventTemplate RandomTemplate(RngFn rng = null) => Rng.Pick(Templates, rng ?? Rng.Default);

        /// <summary>
        /// TS: eventXp — o XP de resolver um evento: o de um monstro do andar (8 + 3 × andar). Andar que não é
        /// número finito positivo conta como 1; fração vai para baixo.
        /// </summary>
        public static double EventXp(double floor) => 8 + 3 * (Js.IsFinite(floor) && floor > 0 ? Math.Floor(floor) : 1);

        /// <summary>
        /// TS: resolveEvent — resolve uma escolha. Não confere se a escolha é do evento certo (o original também
        /// não confere). Toda escolha que resolve o evento, dê certo ou não, ganha o XP de <see cref="EventXp"/>;
        /// seguir em frente (ignorar, desistir) e o que não resolveu ficam com xp null.
        /// Só estudar/examinar com sucesso sorteiam (o randomItem, com o rng e o relógio das opções).
        /// </summary>
        public static EventResolveResult Resolve(Hero hero, double floor, string choice, EventResolveOptions options = null)
        {
            var result = ResolveChoice(hero, floor, choice, options ?? new EventResolveOptions());
            if (!result.Resolved || result.Outcome.Kind == EventOutcome.KindDeclined)
            {
                result.Xp = null;
                return result;
            }

            double gained = EventXp(floor);
            var xpResult = Heroes.GainXP(result.Hero, gained);
            result.Hero = xpResult.Hero;
            result.Xp = new EventXp { Gained = gained, LeveledUp = xpResult.LeveledUp, Levels = xpResult.Levels };
            return result;
        }

        private static EventResolveResult ResolveChoice(Hero hero, double floor, string choice, EventResolveOptions options)
        {
            var rng = options.Rng ?? Rng.Default;

            if (choice == EventChoices.Ignorar || choice == EventChoices.Desistir) return Choice(hero, EventOutcome.Declined(), true);
            if (choice == EventChoices.Ajudar) return ResolveAjudar(hero);
            if (choice == EventChoices.Curar) return ResolveCurar(hero);
            if (choice == EventChoices.Estudar || choice == EventChoices.Examinar) return ResolveEstudarOuExaminar(hero, floor, rng, options.Now);
            if (choice == EventChoices.Rezar) return ResolveRezar(hero);
            if (choice == EventChoices.Sacrificar) return ResolveSacrificar(hero);
            if (choice == EventChoices.Forcar) return ResolveForcar(hero, floor);

            return Choice(hero, EventOutcome.InvalidChoice(), false);
        }

        /// <summary>TS: resolveAjudar — paga 15 de ouro e cura 20 (até a vida máxima).</summary>
        private static EventResolveResult ResolveAjudar(Hero hero)
        {
            if (hero.Gold < 15) return Choice(hero, EventOutcome.InsufficientGold(15), false);
            var afterCost = hero.Clone();
            afterCost.Gold = hero.Gold - 15;
            afterCost.Hp = Js.Min(hero.MaxHp, hero.Hp + 20);
            return Choice(afterCost, EventOutcome.HelpedWounded(), true);
        }

        /// <summary>TS: resolveCurar — sabedoria 12 ou mais ganha 30 de ouro.</summary>
        private static EventResolveResult ResolveCurar(Hero hero)
        {
            bool success = hero.Attrs.Sabedoria >= 12;
            var nextHero = hero;
            if (success)
            {
                nextHero = hero.Clone();
                nextHero.Gold = hero.Gold + 30;
            }
            return Choice(nextHero, EventOutcome.HealedWounded(success, success ? 30 : 0), true);
        }

        /// <summary>
        /// TS: resolveEstudarOuExaminar — intelecto 13 ou mais acha um item do andar (o herói fica o mesmo);
        /// senão perde 8 de mana (até 0).
        /// </summary>
        private static EventResolveResult ResolveEstudarOuExaminar(Hero hero, double floor, RngFn rng, Func<double> now)
        {
            bool success = hero.Attrs.Intelecto >= 13;
            if (success)
            {
                var item = Items.RandomItem(new Items.RandomItemOptions { Floor = floor, Rng = rng, Now = now });
                return Choice(hero, EventOutcome.Studied(true, item), true);
            }
            var nextHero = hero.Clone();
            nextHero.Mp = Js.Max(0, hero.Mp - 8);
            return Choice(nextHero, EventOutcome.Studied(false, null), true);
        }

        /// <summary>TS: resolveRezar — sabedoria 13 ou mais enche vida e mana.</summary>
        private static EventResolveResult ResolveRezar(Hero hero)
        {
            bool success = hero.Attrs.Sabedoria >= 13;
            var nextHero = hero;
            if (success)
            {
                nextHero = hero.Clone();
                nextHero.Hp = hero.MaxHp;
                nextHero.Mp = hero.MaxMp;
            }
            return Choice(nextHero, EventOutcome.Prayed(success), true);
        }

        /// <summary>
        /// TS: resolveSacrificar — tira 20% da vida máxima (no mínimo 10) e dá 1 ponto de atributo. Quem não tem
        /// mais vida que isso não sacrifica (e nada muda).
        /// </summary>
        private static EventResolveResult ResolveSacrificar(Hero hero)
        {
            double amount = Js.Max(10, Math.Floor(hero.MaxHp * 0.2));
            if (hero.Hp <= amount) return Choice(hero, EventOutcome.TooWounded(amount), false);
            var nextHero = hero.Clone();
            nextHero.Hp = hero.Hp - amount;
            // (hero.attrPoints || 0) + 1
            nextHero.AttrPoints = (Js.Truthy(hero.AttrPoints) ? hero.AttrPoints.Value : 0) + 1;
            return Choice(nextHero, EventOutcome.Sacrificed(amount), true);
        }

        /// <summary>TS: resolveForcar — força 13 ou mais abre e dá 18 + 3 × andar de ouro; senão perde 10 de vida (fica com 1 no mínimo).</summary>
        private static EventResolveResult ResolveForcar(Hero hero, double floor)
        {
            bool success = hero.Attrs.Forca >= 13;
            var nextHero = hero.Clone();
            if (success)
            {
                double amount = 18 + floor * 3;
                nextHero.Gold = hero.Gold + amount;
                return Choice(nextHero, EventOutcome.ForcedDoor(true, amount, 0), true);
            }
            nextHero.Hp = Js.Max(1, hero.Hp - 10);
            return Choice(nextHero, EventOutcome.ForcedDoor(false, 0, 10), true);
        }

        /// <summary>O ChoiceResult do TS (o resultado sem o XP, que resolveEvent preenche).</summary>
        private static EventResolveResult Choice(Hero hero, EventOutcome outcome, bool resolved) =>
            new EventResolveResult { Hero = hero, Outcome = outcome, Resolved = resolved };
    }
}
