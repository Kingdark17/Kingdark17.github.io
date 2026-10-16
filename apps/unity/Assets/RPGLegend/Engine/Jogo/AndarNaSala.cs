using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Vetor — a entrada de quem joga, de -1 a 1 em cada eixo (teclas ou joystick).</summary>
    public sealed class Vetor
    {
        public double X;
        public double Y;

        public Vetor() { }

        public Vetor(double x, double y)
        {
            X = x;
            Y = y;
        }
    }

    /// <summary>O retorno de passosDoQuadro no TS: <c>{ passos, sobra }</c>.</summary>
    public sealed class PassosDoQuadro
    {
        public double Passos;
        public double Sobra;
    }

    /// <summary>TS: QuadroDoAndar — o que aconteceu nos passos de um quadro.</summary>
    public sealed class QuadroDoAndar
    {
        public Walker Walker;
        /// <summary>A porta atravessada neste quadro: o andar para nela.</summary>
        [KeepNull] public string Saida;
        /// <summary>O objeto em que o herói acabou de encostar (não estava antes): o andar para nele.</summary>
        [KeepNull] public string Encostou;
        /// <summary>Em que objeto ele está encostado no fim do quadro.</summary>
        [KeepNull] public string Tocando;
        /// <summary>Saiu do lugar neste quadro (pro desenho balançar o boneco).</summary>
        public bool Andou;
    }

    /// <summary>As tabelas de jogo/andar-na-sala.ts (fixtures/data/jogo/andar-na-sala.json).</summary>
    public sealed class AndarNaSalaData
    {
        [JsName("MAX_PASSOS_POR_QUADRO")] public double MaxPassosPorQuadro;
        [JsName("ID_DO_CONTEUDO")] public string IdDoConteudo;
        [JsName("PARADO")] public Vetor Parado;
    }

    public static partial class GameData
    {
        private static AndarNaSalaData _andarNaSalaTable;

        /// <summary>jogo/andar-na-sala: o teto de passos por quadro e o id do conteúdo.</summary>
        public static AndarNaSalaData AndarNaSalaTable
        {
            get => Require(_andarNaSalaTable, "jogo/andar-na-sala");
            set => _andarNaSalaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/andar-na-sala.ts: as duas pontas de quem joga em volta da regra de andar
    /// (<see cref="RoomWalk"/>) — o relógio em passos fixos e a entrada (teclas e joystick) —, e o quadro, que
    /// para na porta atravessada ou no objeto em que o herói acabou de encostar.
    /// </summary>
    public static class AndarNaSala
    {
        private static AndarNaSalaData D => GameData.AndarNaSalaTable;

        /// <summary>TS: MS_POR_PASSO — quanto tempo de tela vale um passo de simulação.</summary>
        public static double MsPorPasso => 1000 / GameData.RoomWalkTable.WalkTicksPerSecond;

        /// <summary>TS: MAX_PASSOS_POR_QUADRO — o atraso acima disso é jogado fora.</summary>
        public static double MaxPassosPorQuadro => D.MaxPassosPorQuadro;

        /// <summary>TS: ID_DO_CONTEUDO — o id do conteúdo da sala (baú, monstro, loja…) na planta.</summary>
        public static string IdDoConteudo => D.IdDoConteudo;

        /// <summary>TS: PARADO.</summary>
        public static Vetor Parado => D.Parado;

        /// <summary>O conteúdo no centro da sala, como objeto da planta.</summary>
        public static RoomObject Conteudo()
        {
            var centro = GameData.RoomWalkTable.ContentTile;
            return new RoomObject { Id = IdDoConteudo, Col = centro.Col, Row = centro.Row };
        }

        /// <summary>TS: plantaDaSala com <c>true</c>/<c>false</c> — só o conteúdo no centro, ou nada.</summary>
        public static RoomLayout PlantaDaSala(DoorMap portas, bool comConteudo) =>
            RoomWalk.Layout(portas, comConteudo ? new List<RoomObject> { Conteudo() } : new List<RoomObject>());

        /// <summary>TS: plantaDaSala com a lista — o conteúdo e os extras (ver <see cref="ExtrasDaSala.ObjetosDaSala"/>).</summary>
        public static RoomLayout PlantaDaSala(DoorMap portas, IReadOnlyList<RoomObject> objetos) => RoomWalk.Layout(portas, objetos);

        /// <summary>TS: passosDoQuadro — quantos passos cabem no tempo que passou, e o que sobra pro próximo quadro.</summary>
        public static PassosDoQuadro PassosDoQuadro(double sobra, double decorridoMs)
        {
            double total = sobra + Js.Max(0, decorridoMs);
            double cabem = Math.Floor(total / MsPorPasso);
            if (cabem > MaxPassosPorQuadro) return new PassosDoQuadro { Passos = MaxPassosPorQuadro, Sobra = 0 };
            return new PassosDoQuadro { Passos = cabem, Sobra = total - cabem * MsPorPasso };
        }

        /// <summary>TS: vetorDasTeclas — duas juntas são diagonal, opostas se anulam.</summary>
        public static Vetor VetorDasTeclas(IEnumerable<string> teclas)
        {
            double x = 0;
            double y = 0;
            foreach (var direcao in teclas)
            {
                var passo = Directions.Vectors.Get(direcao);
                x += passo.X;
                y += passo.Y;
            }
            return new Vetor(Js.Max(-1, Js.Min(1, x)), Js.Max(-1, Js.Min(1, y)));
        }

        /// <summary>TS: entradaCombinada — o joystick manda enquanto está sendo usado; parado, valem as teclas.</summary>
        public static Vetor EntradaCombinada(IEnumerable<string> teclas, Vetor joystick) =>
            joystick.X != 0 || joystick.Y != 0 ? joystick : VetorDasTeclas(teclas);

        /// <summary>
        /// TS: andarNoQuadro — os passos de um quadro. Para no primeiro que atravessar uma porta ou encostar num
        /// objeto novo. Encostar só conta na passagem de "não encostado" pra "encostado".
        /// </summary>
        public static QuadroDoAndar AndarNoQuadro(RoomLayout planta, Walker walker, Vetor entrada, double passos, string tocandoAntes)
        {
            var input = RoomWalk.StickInput(entrada.X, entrada.Y);
            var atual = walker;
            var tocando = tocandoAntes;
            bool andou = false;
            for (double i = 0; i < passos; i++)
            {
                var passo = RoomWalk.Tick(planta, atual, input);
                if (passo.Walker.X != atual.X || passo.Walker.Y != atual.Y) andou = true;
                atual = passo.Walker;
                if (Js.Truthy(passo.Exit)) return new QuadroDoAndar { Walker = atual, Saida = passo.Exit, Encostou = null, Tocando = passo.Touching, Andou = andou };
                var encostou = passo.Touching != null && passo.Touching != tocando ? passo.Touching : null;
                tocando = passo.Touching;
                if (Js.Truthy(encostou)) return new QuadroDoAndar { Walker = atual, Saida = null, Encostou = encostou, Tocando = tocando, Andou = andou };
            }
            return new QuadroDoAndar { Walker = atual, Saida = null, Encostou = null, Tocando = tocando, Andou = andou };
        }
    }
}
