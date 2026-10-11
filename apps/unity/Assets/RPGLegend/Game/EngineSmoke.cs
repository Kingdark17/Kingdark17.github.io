using System;
using System.Collections.Generic;
using UnityEngine;

namespace RPGLegend.Game
{
    /// <summary>
    /// A cena de prova da engine: roda o <see cref="SmokeRun"/> ao abrir, mostra o relatório na tela e manda
    /// cada linha para o log com o prefixo <see cref="LogPrefix"/>. Com -batchmode sai sozinho, com código 0
    /// (passou) ou 1 — é assim que o menu "RPG Legend > Build de teste (Windows)" roda o executável.
    /// </summary>
    public sealed class EngineSmoke : MonoBehaviour
    {
        public const string LogPrefix = "[smoke] ";

        private List<string> _lines = new List<string>();
        private Vector2 _scroll;
        private GUIStyle _style;

        private void Start()
        {
            try
            {
                GameBootstrap.EnsureLoaded();
                _lines = SmokeRun.Run();
            }
            catch (Exception e)
            {
                _lines = new List<string> { SmokeRun.FailPrefix + e.GetType().Name + ": " + e.Message };
            }

            // Sem a pilha depois de cada linha: o log fica legível e as linhas "[smoke]" saem uma por linha.
            var pilha = Application.GetStackTraceLogType(LogType.Log);
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            foreach (var line in _lines) Debug.Log(LogPrefix + line);
            Application.SetStackTraceLogType(LogType.Log, pilha);

            if (Application.isBatchMode) Application.Quit(SmokeRun.Passed(_lines) ? 0 : 1);
        }

        private void OnGUI()
        {
            if (_style == null) _style = new GUIStyle(GUI.skin.label) { fontSize = 16, wordWrap = true };
            GUILayout.BeginArea(new Rect(16, 16, Screen.width - 32, Screen.height - 32));
            _scroll = GUILayout.BeginScrollView(_scroll);
            foreach (var line in _lines) GUILayout.Label(line, _style);
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }
    }
}
