using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Portao — o portão aberto: a masmorra, a dificuldade e o andar escolhidos.</summary>
    public sealed class Portao
    {
        public EstadoNaCidade Estado;
        public DungeonRun Escolha;
        public double Andar;
        /// <summary>O portão é o do app: o andar de entrada pode ter item com material. Só aparece quando é true.</summary>
        public bool? App;
        /// <summary>Aberto por uma entrada da cidade desenhada (<see cref="Cidades"/>): a masmorra é a dela. Só aparece quando é true.</summary>
        public bool? Fixa;

        public Portao Clone() => (Portao)MemberwiseClone();
    }

    /// <summary>TS: OpcaoDoPortao — um botão de masmorra ou de dificuldade.</summary>
    public sealed class OpcaoDoPortao
    {
        public string Id;
        public string Nome;
        public string Icone;
        /// <summary>null quando abre; senão, o que falta, pra escrever no botão.</summary>
        [KeepNull] public string Falta;
    }

    /// <summary>TS: Entrada — o que atravessar o portão devolve.</summary>
    public sealed class Entrada
    {
        public EstadoNaMasmorra Estado;
        /// <summary>"Entre na masmorra" do tutorial, quando fecha agora.</summary>
        [KeepNull] public Recado Recado;
        public string Texto;
    }

    /// <summary>
    /// Port de shared/src/jogo/portao.ts: escolher a masmorra, a dificuldade e o andar de entrada (o 1 ou um
    /// totem já tocado). As regras moram em <see cref="Dungeons"/>.
    /// </summary>
    public static class Portoes
    {
        /// <summary>TS: motivo — o que falta, pra escrever no botão fechado.</summary>
        public static string Motivo(LockReason bloqueio)
        {
            switch (bloqueio.Kind)
            {
                case LockReason.KindLevel:
                    return "Nível " + Js.NumberToString(bloqueio.MinLevel ?? double.NaN);
                case LockReason.KindPreviousDungeon:
                    return "Zere a " + (Dungeons.ById(bloqueio.Dungeon)?.Name ?? Js.Str(bloqueio.Dungeon));
                default:
                    // O switch do TS não tem default: motivo desconhecido devolve undefined.
                    return null;
            }
        }

        private static LockReason Bloqueio(EstadoNaCidade estado, DungeonRun escolha) => Dungeons.LockReasonOf(estado.Progresso, estado.Hero.Level, escolha);

        private static DungeonRun Run(string dungeon, string difficulty) => new DungeonRun { Dungeon = dungeon, Difficulty = difficulty };

        /// <summary>TS: andarMaisFundo — o totem mais fundo já tocado.</summary>
        private static double AndarMaisFundo(EstadoNaCidade estado, DungeonRun escolha)
        {
            var andares = Dungeons.EntryFloors(estado.Progresso, escolha);
            return andares.Count > 0 ? andares[andares.Count - 1] : 1;
        }

        /// <summary>
        /// TS: abrirPortao — abre na última masmorra em que se desceu, se ainda estiver aberta; senão, na Floresta.
        /// Sempre na dificuldade do personagem. Com <paramref name="masmorra"/> (a entrada da cidade desenhada), ela
        /// fica fixa.
        /// </summary>
        public static Portao AbrirPortao(EstadoNaCidade estado, bool app = false, string masmorra = null)
        {
            if (masmorra != null)
            {
                var fixa = Run(masmorra, estado.Dificuldade);
                return new Portao { Estado = estado, Escolha = fixa, Andar = AndarMaisFundo(estado, fixa), App = app ? true : (bool?)null, Fixa = true };
            }
            var ultima = Run(estado.Masmorra.Dungeon, estado.Dificuldade);
            var escolha = Bloqueio(estado, ultima) != null ? Run("floresta", estado.Dificuldade) : ultima;
            return new Portao { Estado = estado, Escolha = escolha, Andar = AndarMaisFundo(estado, escolha), App = app ? true : (bool?)null };
        }

        /// <summary>TS: masmorras.</summary>
        public static List<OpcaoDoPortao> Masmorras(Portao portao)
        {
            var opcoes = new List<OpcaoDoPortao>();
            foreach (var masmorra in Dungeons.All)
            {
                var fechada = Bloqueio(portao.Estado, Run(masmorra.Id, portao.Estado.Dificuldade));
                opcoes.Add(new OpcaoDoPortao { Id = masmorra.Id, Nome = masmorra.Name, Icone = masmorra.Icon, Falta = fechada != null ? Motivo(fechada) : null });
            }
            return opcoes;
        }

        /// <summary>TS: dificuldadeDoPortao — a dificuldade do personagem, que o portão mostra (não se escolhe ali).</summary>
        public static DifficultyDef DificuldadeDoPortao(Portao portao) => Dungeons.DifficultyById(portao.Estado.Dificuldade) ?? Dungeons.Difficulties[0];

        /// <summary>TS: andares — o 1 e os totens tocados desta escolha.</summary>
        public static List<double> Andares(Portao portao) => Dungeons.EntryFloors(portao.Estado.Progresso, portao.Escolha);

        /// <summary>TS: escolherMasmorra — leva junto o totem mais fundo dela. Fechada: a mesma.</summary>
        public static Portao EscolherMasmorra(Portao portao, string dungeon)
        {
            var escolha = Run(dungeon, portao.Estado.Dificuldade);
            if (portao.Fixa == true || Bloqueio(portao.Estado, escolha) != null) return portao;
            var c = portao.Clone();
            c.Escolha = escolha;
            c.Andar = AndarMaisFundo(portao.Estado, c.Escolha);
            return c;
        }

        /// <summary>TS: escolherAndar — andar que não abre devolve o mesmo portão.</summary>
        public static Portao EscolherAndar(Portao portao, double andar)
        {
            if (!Andares(portao).Contains(andar)) return portao;
            var c = portao.Clone();
            c.Andar = andar;
            return c;
        }

        /// <summary>
        /// TS: entrar — atravessa o portão; null se a escolha estiver fechada. É aqui que fecha "Entre na
        /// masmorra" do tutorial. <paramref name="now"/> é o relógio dos itens do andar e do prêmio.
        /// </summary>
        public static Entrada Entrar(Portao portao, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            if (Bloqueio(portao.Estado, portao.Escolha) != null || !Andares(portao).Contains(portao.Andar)) return null;

            var dentro = Estados.EntrarNaMasmorra(portao.Estado, rng, portao.Escolha, portao.Andar, now, portao.App == true);
            var etapa = Tutoriais.Marcar(dentro, "dungeon", rng, now);
            var pelo = portao.Andar == 1 ? "Andar 1" : "Andar " + Js.NumberToString(portao.Andar) + ", pelo totem";
            return new Entrada
            {
                Estado = (EstadoNaMasmorra)etapa.Estado,
                Recado = etapa.Recado,
                Texto = "Você atravessa o portão: " + Dungeons.RunName(portao.Escolha) + ". " + pelo + ".",
            };
        }
    }
}
