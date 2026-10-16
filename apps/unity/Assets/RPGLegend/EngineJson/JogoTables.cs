using System;

namespace RPGLegend.Engine.Json
{
    /// <summary>Tabelas do fluxo do jogo (shared/src/jogo), uma por módulo que tem constante de dado.</summary>
    [Preserve]
    internal sealed class JogoTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            GameData.EstadoTable = JsSerializer.Parse<EstadoData>(readTable("jogo/estado"));
            GameData.TutorialTable = JsSerializer.Parse<TutorialData>(readTable("jogo/tutorial"));
            GameData.ApresentacaoTable = JsSerializer.Parse<ApresentacaoData>(readTable("jogo/apresentacao"));
            GameData.NarradorTable = JsSerializer.Parse<NarradorData>(readTable("jogo/narrador"));
            GameData.DiarioTable = JsSerializer.Parse<DiarioData>(readTable("jogo/diario"));
            GameData.AndarNaSalaTable = JsSerializer.Parse<AndarNaSalaData>(readTable("jogo/andar-na-sala"));
            GameData.ExtrasDaSalaTable = JsSerializer.Parse<ExtrasDaSalaData>(readTable("jogo/extras"));
            GameData.ImpactoTable = JsSerializer.Parse<ImpactoData>(readTable("jogo/impacto"));
            GameData.EventoTable = JsSerializer.Parse<EventoData>(readTable("jogo/evento"));
        }
    }
}
