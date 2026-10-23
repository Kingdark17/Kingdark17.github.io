using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de jogo/cidade.ts (fixtures/data/jogo/cidade.json; as duas são privadas no TS).</summary>
    public sealed class CidadeData
    {
        /// <summary>A sala de cada porta do mapa. A vidente é a sala do NPC que abençoa (a Erma).</summary>
        [JsName("SALA_DO_PONTO")] public OrderedMap<string> SalaDoPonto = new OrderedMap<string>();
        /// <summary>As três entradas de masmorra: o ponto tem o id da masmorra.</summary>
        [JsName("ENTRADAS")] public OrderedMap<string> Entradas = new OrderedMap<string>();
        /// <summary>A narração da cidade desenhada, no lugar da narração da sala.</summary>
        [JsName("TEXTO_DA_CIDADE")] public string TextoDaCidade;
    }

    public static partial class GameData
    {
        private static CidadeData _cidadeTable;

        /// <summary>jogo/cidade: o que cada porta da cidade desenhada abre.</summary>
        public static CidadeData CidadeTable
        {
            get => Require(_cidadeTable, "jogo/cidade");
            set => _cidadeTable = value;
        }
    }

    /// <summary>
    /// A cidade desenhada do lado do jogo (port de shared/src/jogo/cidade.ts): o que cada porta faz, onde o herói
    /// aparece e quando os troncos saem do caminho. A grade de salas da cidade continua sendo a do save; encostar numa
    /// porta leva o jogador pra sala dela e a aciona com <see cref="Salas.Interagir"/>.
    /// </summary>
    public static class Cidades
    {
        private static CidadeData D => GameData.CidadeTable;

        /// <summary>TS: troncosNoCaminho — a masmorra que a Caverna pede (a Floresta) ainda não foi zerada no Normal.</summary>
        public static bool TroncosNoCaminho(EstadoDoJogo estado)
        {
            string requer = Dungeons.ById("caverna")?.Requires;
            return requer != null && !Dungeons.IsCleared(estado.Progresso, new DungeonRun { Dungeon = requer, Difficulty = "normal" });
        }

        /// <summary>TS: TEXTO_DA_CIDADE — o que há em volta da praça.</summary>
        public static string TextoDaCidade => D.TextoDaCidade;

        /// <summary>TS: pistasDaCidade — como entrar e por onde vão as masmorras; com os troncos, avisa da Caverna fechada.</summary>
        public static string PistasDaCidade(EstadoDoJogo estado)
        {
            const string pistas = "Encoste numa porta para entrar. A Floresta fica pelo caminho do sul, a Caverna ao norte e a Torre pela estrada do leste.";
            return TroncosNoCaminho(estado) ? pistas + " Troncos caídos fecham o caminho da Caverna." : pistas;
        }

        /// <summary>TS: plantaDaCidadeAgora — a planta como ela está pra este jogador: com ou sem os troncos.</summary>
        public static RoomLayout PlantaDaCidadeAgora(EstadoDoJogo estado) => MapaDaCidade.PlantaDaCidade(TroncosNoCaminho(estado));

        /// <summary>
        /// TS: chegadaNaCidade — quem volta da masmorra aparece na entrada dela; quem carrega o jogo ou sai de uma
        /// tela, diante da porta da sala em que está (o portão, na entrada da última masmorra).
        /// </summary>
        public static Walker ChegadaNaCidade(EstadoNaCidade estado, bool daMasmorra = false)
        {
            var celula = Estados.CelulaAtual(estado) as CityCell;
            if (daMasmorra || celula?.Type == "gate") return MapaDaCidade.ChegadaNoPonto(estado.Masmorra.Dungeon);
            return MapaDaCidade.ChegadaNoPonto(celula != null ? MapaDaCidade.PontoDaSala(celula) : "arvore");
        }

        private static string Entrada(string ponto) => ponto != null && D.Entradas.TryGet(ponto, out var masmorra) ? masmorra : null;

        /// <summary>TS: salaDoPonto — onde fica a sala deste ponto na grade, ou null (o poço, os troncos).</summary>
        private static Posicao SalaDoPonto(EstadoNaCidade estado, string ponto)
        {
            string tipo = Entrada(ponto) != null ? "gate" : D.SalaDoPonto.TryGet(ponto, out var sala) ? sala : null;
            if (tipo == null) return null;
            foreach (var linha in estado.Map)
            {
                foreach (var celula in linha)
                {
                    if (celula.Type != tipo) continue;
                    if (tipo == "npc" && celula.Npc?.Service != "blessing") continue;
                    return new Posicao(celula.X, celula.Y);
                }
            }
            return null;
        }

        private static ResultadoDaInteracao Nada(EstadoNaCidade estado) => new ResultadoDaInteracao { Estado = estado };

        private static EstadoNaCidade Em(EstadoNaCidade estado, Posicao pos)
        {
            var c = estado.Clone();
            c.Pos = pos;
            return c;
        }

        /// <summary>
        /// TS: entrarNoPonto — o herói encostou num ponto da cidade. Fecha "Dê o primeiro passo" e faz o que a porta
        /// faz: vai pra sala dela e a aciona.
        /// </summary>
        public static ResultadoDaInteracao EntrarNoPonto(EstadoNaCidade estado, string ponto, RngFn rng = null, string pet = null, Func<double> now = null, bool app = false)
        {
            rng = rng ?? Rng.Default;
            var passo = Tutoriais.Marcar(estado, "move", rng, now);
            var resultado = Acionar((EstadoNaCidade)passo.Estado, ponto, rng, pet, now, app);
            resultado.Recado = resultado.Recado ?? passo.Recado;
            return resultado;
        }

        private static ResultadoDaInteracao Acionar(EstadoNaCidade estado, string ponto, RngFn rng, string pet, Func<double> now, bool app)
        {
            if (ponto == "troncos")
            {
                return new ResultadoDaInteracao
                {
                    Estado = estado,
                    Aviso = new Aviso("🪵", "Troncos no Caminho", "Troncos caídos fecham o caminho da Caverna. Zere a Floresta no Normal para abrir a passagem."),
                };
            }

            var sala = SalaDoPonto(estado, ponto);
            if (sala == null) return Nada(estado);
            var naSala = Em(estado, sala);

            string masmorra = Entrada(ponto);
            // O Aprendiz é barrado pelo guarda do portão, em qualquer entrada.
            if (masmorra == null || !Heroes.HasClass(naSala.Hero)) return Salas.Interagir(naSala, rng, pet, now, app);

            var fechada = Dungeons.LockReasonOf(naSala.Progresso, naSala.Hero.Level, new DungeonRun { Dungeon = masmorra, Difficulty = "normal" });
            if (fechada != null)
            {
                var def = Dungeons.ById(masmorra);
                string nome = def?.Name ?? masmorra;
                return new ResultadoDaInteracao
                {
                    Estado = naSala,
                    Aviso = new Aviso(def?.Icon ?? "🌟", nome, "A entrada da " + nome + " ainda não abre. Para entrar: " + Portoes.Motivo(fechada) + "."),
                };
            }
            return new ResultadoDaInteracao
            {
                Estado = naSala,
                Tela = new TelaAberta { Tipo = "portao", Portao = Portoes.AbrirPortao(naSala, app, masmorra) },
            };
        }

        /// <summary>
        /// TS: falarComOBram — o Bram, o ferreiro que troca, atende dentro do ferreiro: a conversa com ele é a sala do
        /// NPC de troca. Fechar a conversa devolve o herói à porta do ferreiro.
        /// </summary>
        public static ResultadoDaInteracao FalarComOBram(EstadoNaCidade estado, RngFn rng = null, Func<double> now = null, bool app = false)
        {
            foreach (var linha in estado.Map)
            {
                foreach (var celula in linha)
                {
                    if (celula.Type == "npc" && celula.Npc?.Service == "barter")
                        return Salas.Interagir(Em(estado, new Posicao(celula.X, celula.Y)), rng, null, now, app);
                }
            }
            return Nada(estado);
        }
    }
}
