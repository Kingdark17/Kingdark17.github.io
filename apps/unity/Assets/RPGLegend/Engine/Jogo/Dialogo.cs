using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: Npc — <c>CityNpc | DungeonNpc</c>: a cidade e a masmorra guardam o mesmo formato de NPC, e no C# são
    /// duas classes. A conversa usa esta, e devolve à sala na classe dela (<see cref="ParaCidade"/>,
    /// <see cref="ParaMasmorra"/>).
    /// </summary>
    public sealed class Npc
    {
        public string Name;
        public string Role;
        /// <summary>TS: NpcService.</summary>
        public string Service;
        public string Icon;
        public List<string> Lines;
        public bool ServiceUsed;

        [JsExtra] public JsExtras Extra;

        public Npc Clone()
        {
            var c = (Npc)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }

        public static Npc De(CityNpc npc) => npc == null
            ? null
            : new Npc { Name = npc.Name, Role = npc.Role, Service = npc.Service, Icon = npc.Icon, Lines = npc.Lines, ServiceUsed = npc.ServiceUsed, Extra = npc.Extra?.Clone() };

        public static Npc De(DungeonNpc npc) => npc == null
            ? null
            : new Npc { Name = npc.Name, Role = npc.Role, Service = npc.Service, Icon = npc.Icon, Lines = npc.Lines, ServiceUsed = npc.ServiceUsed, Extra = npc.Extra?.Clone() };

        public CityNpc ParaCidade() =>
            new CityNpc { Name = Name, Role = Role, Service = Service, Icon = Icon, Lines = Lines, ServiceUsed = ServiceUsed, Extra = Extra?.Clone() };

        public DungeonNpc ParaMasmorra() =>
            new DungeonNpc { Name = Name, Role = Role, Service = Service, Icon = Icon, Lines = Lines, ServiceUsed = ServiceUsed, Extra = Extra?.Clone() };
    }

    /// <summary>TS: Dialogo — a conversa aberta com um NPC.</summary>
    public sealed class Dialogo
    {
        public EstadoDoJogo Estado;
        public Npc Npc;
        /// <summary>Qual fala está na tela.</summary>
        public double Linha;
        public List<string> Log;

        public Dialogo Clone() => (Dialogo)MemberwiseClone();
    }

    /// <summary>
    /// Port de shared/src/jogo/dialogo.ts: as falas em sequência e o serviço do NPC (curar, abençoar, trocar
    /// material, revelar o mapa, recrutar). As regras de cada serviço estão em <see cref="NpcServices"/>; o
    /// serviceUsed volta pra sala, porque faz parte do save.
    /// </summary>
    public static class Dialogos
    {
        private sealed class ResultadoDoServico
        {
            public EstadoDoJogo Estado;
            public bool Usado;
            public string Mensagem;
        }

        private static Dialogo ComLog(Dialogo dialogo, string linha)
        {
            var c = dialogo.Clone();
            c.Log = new List<string> { linha };
            return c;
        }

        /// <summary>TS: abrirDialogo — null quando a sala não tem NPC.</summary>
        public static Dialogo AbrirDialogo(EstadoDoJogo estado)
        {
            var sala = Estados.CelulaAtual(estado);
            var npc = sala is CityCell cidade ? Npc.De(cidade.Npc) : sala is DungeonCell masmorra ? Npc.De(masmorra.Npc) : null;
            if (npc == null) return null;
            return new Dialogo { Estado = estado, Npc = npc, Linha = 0, Log = new List<string>() };
        }

        /// <summary>TS: falaAtual.</summary>
        public static string FalaAtual(Dialogo dialogo)
        {
            var linhas = dialogo.Npc.Lines;
            double i = dialogo.Linha;
            if (linhas == null || !(i >= 0) || i >= linhas.Count || Math.Floor(i) != i) return "";
            return linhas[(int)i] ?? "";
        }

        /// <summary>TS: temMaisFalas.</summary>
        public static bool TemMaisFalas(Dialogo dialogo) => dialogo.Linha + 1 < dialogo.Npc.Lines.Count;

        /// <summary>TS: proximaFala — na última, fica onde está (o mesmo diálogo).</summary>
        public static Dialogo ProximaFala(Dialogo dialogo)
        {
            if (!TemMaisFalas(dialogo)) return dialogo;
            var c = dialogo.Clone();
            c.Linha = dialogo.Linha + 1;
            return c;
        }

        /// <summary>TS: rotuloDoServico — "ícone rótulo", ou null quando o serviço não existe.</summary>
        public static string RotuloDoServico(Npc npc)
        {
            var info = NpcServices.InfoOf(npc.Service);
            return info != null ? info.Icon + " " + info.Label : null;
        }

        /// <summary>TS: servicoDisponivel.</summary>
        public static bool ServicoDisponivel(Npc npc) => !npc.ServiceUsed && NpcServices.InfoOf(npc.Service) != null;

        /// <summary>
        /// TS: usarServico — cada serviço mexe numa parte do estado, e o serviceUsed só é marcado quando algo
        /// realmente aconteceu. <paramref name="now"/> é o relógio do item da troca.
        /// </summary>
        public static Dialogo UsarServico(Dialogo dialogo, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            if (dialogo.Npc.ServiceUsed) return ComLog(dialogo, "Este serviço já foi utilizado durante este encontro.");

            var resultado = Servir(dialogo.Npc.Service, dialogo.Estado, rng, now);
            if (resultado == null) return ComLog(dialogo, "Este NPC não possui um serviço disponível.");

            Npc npc = dialogo.Npc;
            if (resultado.Usado)
            {
                npc = dialogo.Npc.Clone();
                npc.ServiceUsed = true;
            }

            var c = ComLog(dialogo, resultado.Mensagem);
            c.Estado = resultado.Usado ? ComNpc(resultado.Estado, npc) : resultado.Estado;
            c.Npc = npc;
            return c;
        }

        /// <summary>TS: ACOES — o que cada serviço faz; null para serviço desconhecido.</summary>
        private static ResultadoDoServico Servir(string servico, EstadoDoJogo estado, RngFn rng, Func<double> now)
        {
            switch (servico)
            {
                case "heal":
                {
                    var cura = NpcServices.ResolveHeal(estado.Hero, Estados.AndarDeForca(estado));
                    if (cura.Outcome.Kind == HealOutcome.KindInsufficientGold)
                        return Sem(estado, "Você precisa de " + Js.NumberToString(cura.Outcome.Required ?? double.NaN) + " de ouro para ser tratado.");
                    if (cura.Outcome.Kind == HealOutcome.KindAlreadyFull) return Sem(estado, "Você já está em plena forma.");
                    var curado = estado.Clone();
                    curado.Hero = cura.Hero;
                    return Com(curado, "Por " + Js.NumberToString(cura.Outcome.GoldSpent ?? double.NaN) + " de ouro você recupera " +
                        Js.NumberToString(cura.Outcome.HpGained ?? double.NaN) + " de Vida e " + Js.NumberToString(cura.Outcome.MpGained ?? double.NaN) + " de Mana.");
                }
                case "blessing":
                {
                    var bencao = NpcServices.ResolveBlessing(estado.Hero);
                    var abencoado = estado.Clone();
                    abencoado.Hero = bencao.Hero;
                    return Com(abencoado, "Você recebe uma bênção: +" + Js.NumberToString(bencao.Outcome.Dodge) + "% de Esquiva pelos próximos " +
                        Js.NumberToString(bencao.Outcome.Combats) + " combates.");
                }
                case "barter":
                {
                    var troca = NpcServices.ResolveBarter(estado.Inventory, Estados.AndarDeForca(estado), new BarterOptions { Rng = rng, Now = now });
                    if (troca.Outcome.Kind == BarterOutcome.KindNoMaterial) return Sem(estado, "Você não tem nenhum material para trocar.");
                    var trocado = estado.Clone();
                    trocado.Inventory = troca.Inventory;
                    return Com(trocado, "Você troca " + Items.DisplayName(troca.Outcome.Given) + " por " + Items.DisplayName(troca.Outcome.Received) + ".");
                }
                case "reveal":
                {
                    // Só faz sentido na masmorra: o mapa da cidade é fixo e já conhecido.
                    if (!(estado is EstadoNaMasmorra masmorra)) return Sem(estado, "Não há nada de oculto na cidade.");
                    var revelacao = NpcServices.ResolveReveal(masmorra.Map, new GridPosition { X = masmorra.Pos.X, Y = masmorra.Pos.Y });
                    var revelado = masmorra.Clone();
                    revelado.Map = revelacao.Grid;
                    return Com(revelado, "A visão revela " + Js.NumberToString(revelacao.Outcome.Count) + " sala(s) ao redor.");
                }
                case "recruit":
                {
                    var recruta = NpcServices.ResolveRecruit(estado.Party, rng);
                    if (recruta.Outcome.Kind == RecruitOutcome.KindPartyFull) return Sem(estado, "Sua equipe já está completa.");
                    var comEquipe = estado.Clone();
                    comEquipe.Party = recruta.Party;
                    return Com(comEquipe, recruta.Outcome.Companion.Name + " se junta à equipe por 3 combates.");
                }
                default:
                    return null;
            }
        }

        private static ResultadoDoServico Sem(EstadoDoJogo estado, string mensagem) => new ResultadoDoServico { Estado = estado, Usado = false, Mensagem = mensagem };

        private static ResultadoDoServico Com(EstadoDoJogo estado, string mensagem) => new ResultadoDoServico { Estado = estado, Usado = true, Mensagem = mensagem };

        /// <summary>TS: comNpc — grava o NPC de volta na sala (serviceUsed faz parte do save).</summary>
        private static EstadoDoJogo ComNpc(EstadoDoJogo estado, Npc npc)
        {
            var sala = Estados.CelulaAtual(estado);
            if (sala == null) return estado;

            if (estado is EstadoNaCidade cidade)
            {
                var naCidade = ((CityCell)sala).Clone();
                naCidade.Npc = npc.ParaCidade();
                return Estados.SubstituirCelulaAtual(cidade, naCidade);
            }

            var naMasmorra = ((DungeonCell)sala).Clone();
            naMasmorra.Npc = npc.ParaMasmorra();
            return Estados.SubstituirCelulaAtual((EstadoNaMasmorra)estado, naMasmorra);
        }
    }
}
