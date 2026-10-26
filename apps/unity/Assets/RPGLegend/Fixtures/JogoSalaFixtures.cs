using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/jogo.json de jogo/andar-na-sala.ts e jogo/extras.ts.</summary>
    internal sealed class JogoSalaFixtures : IFixtureModule
    {
        private const string M = "jogo";

        private static EstadoNaMasmorra Masmorra(JToken token) => (EstadoNaMasmorra)JogoJson.LerEstado(token);

        public void Register()
        {
            // ---------- andar na sala ----------

            Const(M, "MS_POR_PASSO", () => N(AndarNaSala.MsPorPasso));
            Const(M, "MAX_PASSOS_POR_QUADRO", () => N(AndarNaSala.MaxPassosPorQuadro));
            Const(M, "ID_DO_CONTEUDO", () => W(AndarNaSala.IdDoConteudo));
            Const(M, "PARADO", () => W(AndarNaSala.Parado));

            Fn(M, "plantaDaSala", (a, c) =>
            {
                var portas = R<DoorMap>(a["portas"]);
                var objetos = a["objetos"];
                var masmorra = Str(a["masmorra"]);
                return objetos.Type == JTokenType.Boolean
                    ? W(AndarNaSala.PlantaDaSala(portas, (bool)objetos, masmorra))
                    : W(AndarNaSala.PlantaDaSala(portas, R<List<RoomObject>>(objetos), masmorra));
            });
            Fn(M, "passosDoQuadro", (a, c) => W(AndarNaSala.PassosDoQuadro(Num(a["sobra"]), Num(a["decorridoMs"]))));
            Fn(M, "vetorDasTeclas", (a, c) => W(AndarNaSala.VetorDasTeclas(R<List<string>>(a["teclas"]))));
            Fn(M, "entradaCombinada", (a, c) => W(AndarNaSala.EntradaCombinada(R<List<string>>(a["teclas"]), R<Vetor>(a["joystick"]))));
            Fn(M, "andarNoQuadro", (a, c) => W(AndarNaSala.AndarNoQuadro(R<RoomLayout>(a["planta"]), R<Walker>(a["walker"]), R<Vetor>(a["entrada"]),
                Num(a["passos"]), Str(a["tocandoAntes"]))));

            // ---------- extras da sala ----------

            Const(M, "ID_DO_BAU_SECRETO", () => W(ExtrasDaSala.IdDoBauSecreto));
            Fn(M, "idDoExtra", (a, c) => W(ExtrasDaSala.IdDoExtra(Num(a["indice"]))));
            Fn(M, "indiceDoExtra", (a, c) => W(ExtrasDaSala.IndiceDoExtra(Str(a["id"]))));
            Fn(M, "extrasDe", (a, c) => W(ExtrasDaSala.ExtrasDe(R<DungeonCell>(a["celula"]))));
            Fn(M, "passagemSecreta", (a, c) => W(ExtrasDaSala.PassagemSecreta(R<DungeonCell>(a["celula"]))));
            Fn(M, "descricaoDosExtras", (a, c) => W(ExtrasDaSala.DescricaoDosExtras(R<DungeonCell>(a["celula"]))));
            Fn(M, "objetosDaSala", (a, c) => W(ExtrasDaSala.ObjetosDaSala(R<DungeonCell>(a["celula"]), (bool)a["temConteudo"], Str(a["masmorra"]))));
            Fn(M, "plantaDaSalaSecreta", (a, c) => W(ExtrasDaSala.PlantaDaSalaSecreta(Str(a["lado"]), Str(a["masmorra"]))));
            Fn(M, "textoDaSecreta", (a, c) => W(ExtrasDaSala.TextoDaSecreta(R<DungeonCell>(a["celula"]), Num(a["indice"]))));
            Fn(M, "tocarExtra", (a, c) => W(ExtrasDaSala.TocarExtra(Masmorra(a["estado"]), Num(a["indice"]), c.RngFn)));
            Fn(M, "abrirBauSecreto", (a, c) => W(ExtrasDaSala.AbrirBauSecreto(Masmorra(a["estado"]), Num(a["indice"]))));
        }
    }
}
