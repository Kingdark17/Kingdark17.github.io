using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: QuestType.</summary>
    public static class QuestTypes
    {
        /// <summary>Derrotar monstros.</summary>
        public const string Kill = "kill";
        /// <summary>Alcançar um andar.</summary>
        public const string Floor = "floor";
        /// <summary>Coletar itens.</summary>
        public const string Collect = "collect";
    }

    /// <summary>TS: Quest — uma missão do quadro. Vai no save.</summary>
    public sealed class Quest
    {
        public string Id;
        /// <summary>Um de <see cref="QuestTypes"/>.</summary>
        public string Type;
        public double Target;
        public double Progress;
        public string Title;
        public string Desc;
        public double RewardXp;
        public double RewardGold;
        public bool Done;
        public bool Claimed;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...quest }</c> do TS.</summary>
        public Quest Clone()
        {
            var c = (Quest)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: GenerateQuestOptions.</summary>
    public sealed class GenerateQuestOptions
    {
        public RngFn Rng;
        /// <summary>O relógio do id da missão. Ausente, Date.now.</summary>
        public Func<double> Now;
    }

    /// <summary>TS: ClaimQuestResult.</summary>
    public sealed class ClaimQuestResult
    {
        public Hero Hero;
        public List<Quest> Quests;
        public bool Claimed;
        public bool LeveledUp;
        public double Levels;
    }

    /// <summary>
    /// O quadro de missões (port de shared/src/quests/quests.ts): matar monstros, alcançar andar, coletar
    /// itens. Cada função cobre só a fórmula; quem orquestra decide quando chamá-las (a geração do andar não
    /// sabe nada de missões). Nada aqui muta as listas ou as missões recebidas.
    /// </summary>
    public static class Quests
    {
        /// <summary>TS: QUEST_TYPES (privada).</summary>
        public static List<string> Types => GameData.QuestsTable.QuestTypes;

        /// <summary>
        /// TS: generateQuest — sorteia o tipo e depois a missão: quantidade (ou andar alvo) e o número do id,
        /// nessa ordem (três números do rng).
        /// </summary>
        public static Quest Generate(double floor, GenerateQuestOptions options = null)
        {
            var o = options ?? new GenerateQuestOptions();
            var rng = o.Rng ?? Rng.Default;
            var now = o.Now ?? Js.DateNow;
            // QUEST_TYPES[randomInt(QUEST_TYPES.length, rng)]
            string type = Types[(int)Rng.RandomInt(Types.Count, rng)];
            if (type == QuestTypes.Kill) return GenerateKillQuest(rng, now);
            if (type == QuestTypes.Floor) return GenerateFloorQuest(floor, rng, now);
            return GenerateCollectQuest(rng, now);
        }

        /// <summary>
        /// TS: ensureQuestBoard — quadro vazio ganha 2 missões iniciais; com alguma coisa, devolve uma cópia da
        /// lista sem sortear.
        /// </summary>
        public static List<Quest> EnsureBoard(IReadOnlyList<Quest> quests, double floor, GenerateQuestOptions options = null)
        {
            if (quests.Count > 0) return new List<Quest>(quests);
            var first = Generate(floor, options);
            var second = Generate(floor, options);
            return new List<Quest> { first, second };
        }

        /// <summary>TS: onMonsterKilled — +1 nas missões de matar ainda abertas.</summary>
        public static List<Quest> OnMonsterKilled(IReadOnlyList<Quest> quests) =>
            BumpProgress(quests, QuestTypes.Kill, q => q.Progress + 1);

        /// <summary>TS: onFloorReached — o andar vira o progresso das missões de andar ainda abertas.</summary>
        public static List<Quest> OnFloorReached(IReadOnlyList<Quest> quests, double floor) =>
            BumpProgress(quests, QuestTypes.Floor, q => floor);

        /// <summary>TS: onItemCollected — +1 nas missões de coleta ainda abertas.</summary>
        public static List<Quest> OnItemCollected(IReadOnlyList<Quest> quests) =>
            BumpProgress(quests, QuestTypes.Collect, q => q.Progress + 1);

        /// <summary>
        /// TS: claimQuest — resgata uma missão pronta: ouro e XP para o herói, a missão sai do quadro e outra é
        /// sorteada no fim, no lugar dela. Sem efeito (claimed false, sem sortear) se a missão não existe, ainda
        /// não está pronta ou já foi resgatada.
        /// </summary>
        public static ClaimQuestResult Claim(Hero hero, IReadOnlyList<Quest> quests, string targetId, double floor, GenerateQuestOptions options = null)
        {
            Quest quest = null;
            foreach (var q in quests)
            {
                if (q.Id == targetId)
                {
                    quest = q;
                    break;
                }
            }
            if (quest == null || !quest.Done || quest.Claimed)
                return new ClaimQuestResult { Hero = hero, Quests = new List<Quest>(quests), Claimed = false, LeveledUp = false, Levels = 0 };

            var paid = hero.Clone();
            paid.Gold = hero.Gold + quest.RewardGold;
            var xpResult = Heroes.GainXP(paid, quest.RewardXp);

            var nextQuests = new List<Quest>();
            foreach (var q in quests) if (q.Id != targetId) nextQuests.Add(q);
            nextQuests.Add(Generate(floor, options));

            return new ClaimQuestResult { Hero = xpResult.Hero, Quests = nextQuests, Claimed = true, LeveledUp = xpResult.LeveledUp, Levels = xpResult.Levels };
        }

        // ---------- apoio ----------

        /// <summary>TS: questId — "q_agora_sorteio" (o relógio é lido antes do sorteio).</summary>
        private static string QuestId(RngFn rng, Func<double> now)
        {
            string agora = Js.NumberToString(now());
            return "q_" + agora + "_" + Js.NumberToString(Rng.RandomInt(9999, rng));
        }

        /// <summary>TS: generateKillQuest — 3 a 6 monstros.</summary>
        private static Quest GenerateKillQuest(RngFn rng, Func<double> now)
        {
            double amount = 3 + Rng.RandomInt(4, rng);
            return new Quest
            {
                Id = QuestId(rng, now),
                Type = QuestTypes.Kill,
                Target = amount,
                Progress = 0,
                Title = "Caçador de Monstros",
                Desc = "Derrote " + Js.NumberToString(amount) + " monstros na masmorra.",
                RewardXp = 20 + amount * 5,
                RewardGold = 15 + amount * 4,
                Done = false,
                Claimed = false,
            };
        }

        /// <summary>TS: generateFloorQuest — 2 a 4 andares abaixo do atual; o progresso começa no andar atual.</summary>
        private static Quest GenerateFloorQuest(double floor, RngFn rng, Func<double> now)
        {
            double floorTarget = floor + 2 + Rng.RandomInt(3, rng);
            return new Quest
            {
                Id = QuestId(rng, now),
                Type = QuestTypes.Floor,
                Target = floorTarget,
                Progress = floor,
                Title = "Exploradora das Profundezas",
                Desc = "Alcance o andar " + Js.NumberToString(floorTarget) + " da masmorra.",
                RewardXp = 30 + floorTarget * 4,
                RewardGold = 20 + floorTarget * 5,
                Done = false,
                Claimed = false,
            };
        }

        /// <summary>TS: generateCollectQuest — 2 a 4 itens.</summary>
        private static Quest GenerateCollectQuest(RngFn rng, Func<double> now)
        {
            double amount = 2 + Rng.RandomInt(3, rng);
            return new Quest
            {
                Id = QuestId(rng, now),
                Type = QuestTypes.Collect,
                Target = amount,
                Progress = 0,
                Title = "Coletora de Materiais",
                Desc = "Colete " + Js.NumberToString(amount) + " itens de qualquer tipo.",
                RewardXp = 15 + amount * 5,
                RewardGold = 10 + amount * 4,
                Done = false,
                Claimed = false,
            };
        }

        /// <summary>
        /// TS: bumpProgress — nas missões do tipo ainda abertas, o progresso novo (cópia da missão, com done
        /// recalculado); as outras continuam sendo os mesmos objetos.
        /// </summary>
        private static List<Quest> BumpProgress(IReadOnlyList<Quest> quests, string type, Func<Quest, double> nextProgress)
        {
            var result = new List<Quest>(quests.Count);
            foreach (var q in quests)
            {
                if (q.Type != type || q.Done)
                {
                    result.Add(q);
                    continue;
                }
                double progress = nextProgress(q);
                var next = q.Clone();
                next.Progress = progress;
                next.Done = progress >= q.Target;
                result.Add(next);
            }
            return result;
        }
    }
}
