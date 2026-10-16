using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Quadro — o quadro de missões aberto.</summary>
    public sealed class Quadro
    {
        public EstadoNaCidade Estado;
        public List<string> Log;
    }

    /// <summary>
    /// Port de shared/src/jogo/missoes.ts: o quadro de missões da cidade. As regras estão em <see cref="Quests"/>;
    /// o progresso das missões é contado no combate, no baú e na geração do andar.
    /// </summary>
    public static class QuadroDeMissoes
    {
        private static GenerateQuestOptions Opcoes(RngFn rng, Func<double> now) => new GenerateQuestOptions { Rng = rng ?? Rng.Default, Now = now };

        /// <summary>TS: abrirQuadro.</summary>
        public static Quadro AbrirQuadro(EstadoNaCidade estado, RngFn rng = null, Func<double> now = null)
        {
            var quests = Quests.EnsureBoard(estado.Quests, estado.Floor, Opcoes(rng, now));
            var comQuadro = estado;
            if (!ReferenceEquals(quests, estado.Quests))
            {
                comQuadro = estado.Clone();
                comQuadro.Quests = quests;
            }
            return new Quadro { Estado = comQuadro, Log = new List<string> { "Você lê os anúncios afixados no quadro." } };
        }

        /// <summary>TS: missoes.</summary>
        public static List<Quest> Missoes(Quadro quadro) => quadro.Estado.Quests;

        /// <summary>TS: resgatar — resgatar uma missão sorteia outra no lugar.</summary>
        public static Quadro Resgatar(Quadro quadro, string questId, RngFn rng = null, Func<double> now = null)
        {
            var alvo = quadro.Estado.Quests.Find(q => q.Id == questId);
            var resgate = Quests.Claim(quadro.Estado.Hero, quadro.Estado.Quests, questId, quadro.Estado.Floor, Opcoes(rng, now));

            if (!resgate.Claimed) return new Quadro { Estado = quadro.Estado, Log = new List<string> { "Esta missão ainda não pode ser resgatada." } };

            var log = new List<string>
            {
                "Missão concluída: " + (alvo?.Title ?? "recompensa") + " rendeu " + Js.NumberToString(alvo?.RewardGold ?? 0) + " de ouro e " +
                Js.NumberToString(alvo?.RewardXp ?? 0) + " XP.",
            };
            if (resgate.LeveledUp) log.Add("Você subiu " + Js.NumberToString(resgate.Levels) + " nível(is)!");

            var estado = quadro.Estado.Clone();
            estado.Hero = resgate.Hero;
            estado.Quests = resgate.Quests;
            return new Quadro { Estado = estado, Log = log };
        }
    }
}
