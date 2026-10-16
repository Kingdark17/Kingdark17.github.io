using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Tutorial — o progresso dos Primeiros Passos, que vive no save.</summary>
    public sealed class Tutorial
    {
        /// <summary>false desliga o acompanhamento sem apagar o que já foi feito.</summary>
        public bool Enabled;
        /// <summary>TS: <c>Partial&lt;Record&lt;PassoDoTutorial, boolean&gt;&gt;</c> — a etapa feita fica true.</summary>
        public OrderedMap<bool> Completed;
        public bool Rewarded;

        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...tutorial }</c> do TS.</summary>
        public Tutorial Clone()
        {
            var c = (Tutorial)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: Passo — uma etapa dos Primeiros Passos.</summary>
    public sealed class PassoDef
    {
        /// <summary>TS: PassoDoTutorial.</summary>
        public string Id;
        public string Icone;
        public string Nome;
        public string Dica;
    }

    /// <summary>Uma página do Guia do Aventureiro.</summary>
    public sealed class GuiaDef
    {
        public string Titulo;
        public string Texto;
    }

    /// <summary>TS: Recado — a caixinha que a tela mostra quando uma etapa fecha.</summary>
    public sealed class Recado
    {
        public string Titulo;
        public string Texto;
    }

    /// <summary>TS: ResultadoDoPasso.</summary>
    public sealed class ResultadoDoPasso
    {
        public EstadoDoJogo Estado;
        [KeepNull] public Recado Recado;
    }

    /// <summary>As tabelas de jogo/tutorial.ts (fixtures/data/jogo/tutorial.json).</summary>
    public sealed class TutorialData
    {
        [JsName("PASSOS")] public List<PassoDef> Passos = new List<PassoDef>();
        [JsName("GUIAS")] public List<GuiaDef> Guias = new List<GuiaDef>();
        /// <summary>Privada no TS: o ouro de fechar as etapas.</summary>
        [JsName("OURO_DA_RECOMPENSA")] public double OuroDaRecompensa;
    }

    public static partial class GameData
    {
        private static TutorialData _tutorialTable;

        /// <summary>jogo/tutorial: as etapas, o Guia e o prêmio.</summary>
        public static TutorialData TutorialTable
        {
            get => Require(_tutorialTable, "jogo/tutorial");
            set => _tutorialTable = value;
        }
    }

    /// <summary>
    /// Primeiros Passos e Guia do Aventureiro (port de shared/src/jogo/tutorial.ts): o guia de texto e a
    /// missãozinha de etapas, que dá ouro e uma poção ao completar.
    /// </summary>
    public static class Tutoriais
    {
        private static TutorialData D => GameData.TutorialTable;

        /// <summary>TS: PASSOS.</summary>
        public static List<PassoDef> Passos => D.Passos;

        /// <summary>TS: GUIAS.</summary>
        public static List<GuiaDef> Guias => D.Guias;

        /// <summary>TS: tutorialDe — save antigo sem tutorial começa ligado e vazio.</summary>
        public static Tutorial TutorialDe(EstadoDoJogo estado) =>
            estado.Tutorial ?? new Tutorial { Enabled = true, Completed = new OrderedMap<bool>(), Rewarded = false };

        private static bool Feito(Tutorial tutorial, string id) => tutorial.Completed != null && tutorial.Completed.TryGet(id, out var feito) && feito;

        /// <summary>TS: concluidos — quantas etapas da lista já foram feitas.</summary>
        public static double Concluidos(Tutorial tutorial)
        {
            double feitas = 0;
            foreach (var passo in Passos)
                if (Feito(tutorial, passo.Id))
                    feitas++;
            return feitas;
        }

        /// <summary>
        /// TS: marcar — marca uma etapa. Devolve o mesmo estado quando não há nada a fazer (etapa repetida ou
        /// tutorial desligado). Fechar a última dá o prêmio, uma vez só.
        /// </summary>
        public static ResultadoDoPasso Marcar(EstadoDoJogo estado, string id, RngFn rng = null, Func<double> now = null)
        {
            var tutorial = TutorialDe(estado);
            if (!tutorial.Enabled || Feito(tutorial, id)) return new ResultadoDoPasso { Estado = estado, Recado = null };

            var completed = new OrderedMap<bool>();
            tutorial.Completed?.CopyTo(completed);
            completed.Set(id, true);
            var marcado = tutorial.Clone();
            marcado.Completed = completed;

            var passo = Passos.Find(p => p.Id == id);
            var recado = passo != null ? new Recado { Titulo = passo.Icone + " Etapa concluída", Texto = passo.Dica } : null;

            bool faltando = Passos.Exists(p => !Feito(marcado, p.Id));
            if (faltando || marcado.Rewarded)
            {
                var comMarca = estado.Clone();
                comMarca.Tutorial = marcado;
                return new ResultadoDoPasso { Estado = comMarca, Recado = recado };
            }

            var premio = Items.RandomItem(new Items.RandomItemOptions { Category = "consumivel", Floor = 1, Rng = rng ?? Rng.Default, Now = now });
            var premiado = marcado.Clone();
            premiado.Rewarded = true;
            var hero = estado.Hero.Clone();
            hero.Gold = estado.Hero.Gold + D.OuroDaRecompensa;

            var novo = estado.Clone();
            novo.Tutorial = premiado;
            novo.Hero = hero;
            novo.Inventory = Inventory.AddItem(estado.Inventory, premio);
            return new ResultadoDoPasso
            {
                Estado = novo,
                Recado = new Recado
                {
                    Titulo = "🏆 Tutorial concluído",
                    Texto = "Você recebeu " + Js.NumberToString(D.OuroDaRecompensa) + " de ouro e uma poção. O Guia continua disponível.",
                },
            };
        }
    }
}
