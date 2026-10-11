using System;
using System.Collections;
using System.Collections.Generic;
using RPGLegend.Tests;
using UnityEngine;

namespace RPGLegend.DeviceTests
{
    /// <summary>
    /// Os casos de packages/shared/fixtures rodando no aparelho, depois do EngineSmoke. Só existe no build de
    /// teste do celular: o assembly só compila com UNITY_INCLUDE_TESTS (o Editor) ou RPG_DEVICE_TESTS (o
    /// build de teste), e só se cria sozinho com RPG_DEVICE_TESTS — no Play Mode do Editor não faz nada.
    ///
    /// Os casos vêm de Resources/Fixtures, uma cópia que o menu "Build de teste (Android)" põe no projeto só
    /// durante o build; as tabelas vêm de Resources/GameData, as mesmas do jogo. O relatório vai para o log
    /// (logcat, tag Unity) com o prefixo <see cref="LogPrefix"/>, e o menu o compara com o do Editor.
    /// </summary>
    public sealed class DeviceFixtures : MonoBehaviour
    {
        public const string LogPrefix = "[fixtures] ";

        /// <summary>A pasta dos casos dentro de Resources (a cópia temporária do build de teste).</summary>
        public const string ResourcesFolder = "Fixtures";

        private const int CasesPerFrame = 25;

        private string _status = "casos no aparelho: preparando";
        private GUIStyle _style;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Spawn()
        {
#if RPG_DEVICE_TESTS
            new GameObject("DeviceFixtures").AddComponent<DeviceFixtures>();
#endif
        }

        private IEnumerator Start()
        {
            // Um quadro de folga: o EngineSmoke roda e manda o relatório dele para o log primeiro.
            yield return null;

            Fixtures.ReadText = ReadFromResources;
            var lines = new List<string>();
            var passos = FixtureSuite.Steps(lines).GetEnumerator();
            while (true)
            {
                bool tem;
                try
                {
                    tem = passos.MoveNext();
                }
                catch (Exception e)
                {
                    lines.Add(FixtureSuite.FailPrefix + ": " + e.GetType().Name + ": " + e.Message);
                    break;
                }
                if (!tem) break;
                if (passos.Current % CasesPerFrame == 0)
                {
                    _status = "casos no aparelho: " + passos.Current;
                    yield return null;
                }
            }

            var pilha = Application.GetStackTraceLogType(LogType.Log);
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            foreach (var line in lines) Debug.Log(LogPrefix + line);
            Application.SetStackTraceLogType(LogType.Log, pilha);

            _status = lines.Count >= 2 ? lines[lines.Count - 2] + " — " + lines[lines.Count - 1] : string.Join(" — ", lines);
        }

        /// <summary>"combat.json" vem de Resources/Fixtures; "data/hero/catalog.json", de Resources/GameData.</summary>
        private static string ReadFromResources(string relative)
        {
            var semExtensao = relative.EndsWith(".json", StringComparison.Ordinal) ? relative.Substring(0, relative.Length - 5) : relative;
            var caminho = semExtensao.StartsWith("data/", StringComparison.Ordinal)
                ? "GameData/" + semExtensao.Substring(5)
                : ResourcesFolder + "/" + semExtensao;
            var asset = Resources.Load<TextAsset>(caminho);
            return asset == null ? null : asset.text;
        }

        private void OnGUI()
        {
            if (_style == null) _style = new GUIStyle(GUI.skin.box) { fontSize = 16, wordWrap = true, alignment = TextAnchor.MiddleLeft };
            var escala = Screen.dpi > 0 ? Mathf.Max(1f, Screen.dpi / 160f) : 1f;
            GUI.matrix = Matrix4x4.Scale(new Vector3(escala, escala, 1f));
            var seguro = Screen.safeArea;
            float largura = seguro.width / escala - 32, altura = 64;
            float y = (Screen.height - seguro.y) / escala - altura - 16;
            GUI.Box(new Rect(seguro.x / escala + 16, y, largura, altura), _status, _style);
        }
    }
}
