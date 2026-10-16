using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Escolha — um botão do evento.</summary>
    public sealed class Escolha
    {
        /// <summary>TS: EventChoiceId.</summary>
        public string Id;
        public string Label;
    }

    /// <summary>TS: Evento — o evento aberto na sala.</summary>
    public sealed class Evento
    {
        public EstadoNaMasmorra Estado;
        public EventTemplate Template;
        public bool Resolvido;
        public List<string> Log;

        public Evento Clone() => (Evento)MemberwiseClone();
    }

    /// <summary>As tabelas de jogo/evento.ts (fixtures/data/jogo/evento.json).</summary>
    public sealed class EventoData
    {
        /// <summary>TS: ESCOLHAS — os rótulos e a ordem dos botões de cada evento.</summary>
        [JsName("ESCOLHAS")] public OrderedMap<List<Escolha>> Escolhas = new OrderedMap<List<Escolha>>();
    }

    public static partial class GameData
    {
        private static EventoData _eventoTable;

        /// <summary>jogo/evento: os botões dos eventos.</summary>
        public static EventoData EventoTable
        {
            get => Require(_eventoTable, "jogo/evento");
            set => _eventoTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/evento.ts: aventureiro ferido, altar antigo, porta lacrada. A conta é de
    /// <see cref="DungeonEvents.Resolve"/>; aqui ficam os botões e o resolved que volta pra sala.
    /// </summary>
    public static class Eventos
    {
        /// <summary>TS: ESCOLHAS.</summary>
        public static OrderedMap<List<Escolha>> TodasAsEscolhas => GameData.EventoTable.Escolhas;

        /// <summary>TS: abrirEvento — null quando a sala não tem evento conhecido.</summary>
        public static Evento AbrirEvento(EstadoNaMasmorra estado)
        {
            var sala = Estados.CelulaAtual(estado) as DungeonCell;
            var template = sala?.Event != null ? DungeonEvents.TemplateById(sala.Event.TemplateId) : null;
            if (sala == null || template == null) return null;

            bool resolvido = sala.Resolved ?? false;
            return new Evento
            {
                Estado = estado,
                Template = template,
                Resolvido = resolvido,
                Log = new List<string> { resolvido ? "Este evento já foi resolvido." : template.Text },
            };
        }

        /// <summary>TS: escolhas.</summary>
        public static List<Escolha> Escolhas(Evento evento) => TodasAsEscolhas.Get(evento.Template.Id);

        /// <summary>TS: escolher — escolha recusada (falta ouro ou vida) deixa a sala aberta.</summary>
        public static Evento Escolher(Evento evento, string escolha, RngFn rng = null, Func<double> now = null)
        {
            if (evento.Resolvido) return evento;

            var resultado = DungeonEvents.Resolve(evento.Estado.Hero, Estados.AndarDeForca(evento.Estado), escolha,
                new EventResolveOptions { Rng = rng ?? Rng.Default, Now = now });
            var mensagem = Narrar(resultado.Outcome) + NarrarXp(resultado.Xp);

            var comHeroi = evento.Estado.Clone();
            comHeroi.Hero = resultado.Hero;
            var novo = evento.Clone();
            novo.Log = new List<string> { mensagem };

            if (!resultado.Resolved)
            {
                novo.Estado = comHeroi;
                return novo;
            }

            var sala = ((DungeonCell)Estados.CelulaAtual(evento.Estado)).Clone();
            sala.Resolved = true;
            novo.Estado = Estados.SubstituirCelulaAtual(comHeroi, sala);
            novo.Resolvido = true;
            return novo;
        }

        private static string Narrar(EventOutcome outcome)
        {
            bool deuCerto = outcome.Success ?? false;
            switch (outcome.Kind)
            {
                case EventOutcome.KindDeclined:
                    return "Você segue seu caminho sem se envolver.";
                case EventOutcome.KindInsufficientGold:
                    return "Você precisaria de " + Num(outcome.Required) + " de ouro para isso.";
                case EventOutcome.KindTooWounded:
                    return "Você está ferido demais: precisaria de " + Num(outcome.Required) + " de Vida.";
                case EventOutcome.KindHelpedWounded:
                    return "Você ajuda o aventureiro.";
                case EventOutcome.KindHealedWounded:
                    return deuCerto
                        ? "Seus cuidados funcionam. O aventureiro deixa " + Num(outcome.GoldGained) + " de ouro em agradecimento."
                        : "Você tenta ajudar, mas não sabe o que fazer. O aventureiro se afasta.";
                case EventOutcome.KindStudied:
                    return deuCerto && outcome.Item != null
                        ? "Você decifra as runas e encontra " + Items.DisplayName(outcome.Item) + "."
                        : "As runas não fazem sentido para você.";
                case EventOutcome.KindPrayed:
                    return deuCerto ? "Uma calma quente percorre seu corpo." : "Nada responde à sua prece.";
                case EventOutcome.KindSacrificed:
                    return "Você oferece " + Num(outcome.HpLost) + " de Vida ao altar.";
                case EventOutcome.KindForcedDoor:
                    return deuCerto
                        ? "A porta cede e revela " + Num(outcome.GoldGained) + " de ouro."
                        : "A porta não cede e você se machuca em " + Num(outcome.HpLost) + " de Vida.";
                default:
                    return "Nada acontece.";
            }
        }

        /// <summary>O <c>${x}</c> de um número que pode faltar.</summary>
        private static string Num(double? x) => x.HasValue ? Js.NumberToString(x.Value) : "undefined";

        /// <summary>TS: narrarXp — resolver um evento dá XP, tenha dado certo ou não.</summary>
        private static string NarrarXp(EventXp xp)
        {
            if (xp == null) return "";
            var nivel = xp.LeveledUp ? " Subiu " + Js.NumberToString(xp.Levels) + " nível(is)!" : "";
            return " +" + Js.NumberToString(xp.Gained) + " XP." + nivel;
        }
    }
}
