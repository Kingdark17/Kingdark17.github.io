using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using RPGLegend.Game;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Build de teste (Windows)": builda só a cena EngineSmoke (Windows 64, Mono) em
    /// apps/unity/Builds/Smoke, roda o executável com -batchmode -nographics e confere se as linhas "[smoke]"
    /// do log dele são idênticas às do SmokeRun rodado aqui no Editor. O resultado vai para o Console e para
    /// Builds/Smoke/smoke-report.txt — sem janela modal, para o menu também poder ser chamado de fora.
    /// </summary>
    public static class SmokeBuild
    {
        public const string ScenePath = "Assets/RPGLegend/Scenes/EngineSmoke.unity";
        private const string ExeName = "RPGLegendSmoke.exe";
        private const int ExitTimeoutMs = 120000;

        [MenuItem("RPG Legend/Build de teste (Windows)")]
        private static void BuildMenu() => BuildAndCheck();

        /// <summary>Builda, roda e compara. Devolve true quando o executável passou e as linhas bateram.</summary>
        public static bool BuildAndCheck()
        {
            var projeto = Directory.GetParent(Application.dataPath).FullName;
            var pasta = Path.Combine(projeto, "Builds", "Smoke");
            var exe = Path.Combine(pasta, ExeName);
            var log = Path.Combine(pasta, "smoke.log");
            var relatorio = new StringBuilder();

            bool ok = Run(pasta, exe, log, relatorio);

            Directory.CreateDirectory(pasta);
            File.WriteAllText(Path.Combine(pasta, "smoke-report.txt"), relatorio.ToString());
            var texto = "Build de teste (Windows): " + (ok ? "OK" : "FALHOU") + "\n" + relatorio;
            if (ok) Debug.Log(texto);
            else Debug.LogError(texto);
            return ok;
        }

        private static bool Run(string pasta, string exe, string log, StringBuilder relatorio)
        {
            if (!File.Exists(ScenePath))
            {
                relatorio.AppendLine("A cena " + ScenePath + " não existe.");
                return false;
            }
            var backend = PlayerSettings.GetScriptingBackend(NamedBuildTarget.Standalone);
            if (backend != ScriptingImplementation.Mono2x)
            {
                relatorio.AppendLine("O build de teste é Mono, e o Standalone está em " + backend + ". Troque em Project Settings > Player.");
                return false;
            }

            // 1. Build, numa pasta limpa.
            if (Directory.Exists(pasta)) Directory.Delete(pasta, true);
            var inicio = DateTime.Now;
            var build = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = exe,
                target = BuildTarget.StandaloneWindows64,
                targetGroup = BuildTargetGroup.Standalone,
                options = BuildOptions.None,
            });
            // O build grava o ProjectSettings.asset no meio do caminho (com o que o Input System põe só durante o
            // build); salvar de novo deixa no disco o estado de repouso e o git não acusa mudança à toa.
            AssetDatabase.SaveAssets();
            var resumo = build.summary;
            relatorio.AppendLine("build: " + resumo.result + " em " + (DateTime.Now - inicio).TotalSeconds.ToString("0") + " s, " +
                                 (resumo.totalSize / (1024 * 1024)) + " MB, " + resumo.totalErrors + " erro(s) -> " + exe);
            if (resumo.result != BuildResult.Succeeded) return false;

            // 2. O executável, sem janela, até ele sair sozinho.
            int codigo;
            using (var processo = Process.Start(new ProcessStartInfo
                   {
                       FileName = exe,
                       Arguments = "-batchmode -nographics -logFile \"" + log + "\"",
                       UseShellExecute = false,
                       CreateNoWindow = true,
                       WorkingDirectory = pasta,
                   }))
            {
                if (processo == null)
                {
                    relatorio.AppendLine("Não consegui abrir " + exe);
                    return false;
                }
                if (!processo.WaitForExit(ExitTimeoutMs))
                {
                    processo.Kill();
                    relatorio.AppendLine("O executável não saiu em " + ExitTimeoutMs / 1000 + " s (matei o processo). Log: " + log);
                    return false;
                }
                codigo = processo.ExitCode;
            }
            relatorio.AppendLine("executável: saiu com código " + codigo + ". Log: " + log);

            // 3. As linhas do executável contra as do Editor.
            var doExe = File.Exists(log) ? SmokeLines(File.ReadAllLines(log)) : new List<string>();
            return CompareWithEditor(doExe, "executável", relatorio) && codigo == 0;
        }

        /// <summary>As linhas "[smoke]" de um log, sem o prefixo.</summary>
        internal static List<string> SmokeLines(IEnumerable<string> log) => PrefixedLines(log, EngineSmoke.LogPrefix);

        /// <summary>As linhas de um log que começam com <paramref name="prefix"/>, sem ele.</summary>
        internal static List<string> PrefixedLines(IEnumerable<string> log, string prefix) =>
            log.Where(l => l.StartsWith(prefix, StringComparison.Ordinal)).Select(l => l.Substring(prefix.Length)).ToList();

        /// <summary>
        /// Roda o SmokeRun aqui no Editor e compara linha a linha com o que veio do build (<paramref name="quem"/>:
        /// "executável", "celular"). Escreve as diferenças e o relatório do build. True quando são idênticas e
        /// terminam em SMOKE OK.
        /// </summary>
        internal static bool CompareWithEditor(List<string> doBuild, string quem, StringBuilder relatorio)
        {
            GameBootstrap.Reload();
            return CompareLines(SmokeRun.Run(), doBuild, "[smoke]", quem, relatorio) && SmokeRun.Passed(doBuild);
        }

        /// <summary>
        /// Compara linha a linha o relatório do Editor com o do build e escreve as diferenças (até 10) e o relatório
        /// do build. True quando são idênticos e não vazios.
        /// </summary>
        internal static bool CompareLines(List<string> doEditor, List<string> doBuild, string oQue, string quem, StringBuilder relatorio)
        {
            int diferentes = 0;
            for (int i = 0; i < Math.Max(doBuild.Count, doEditor.Count); i++)
            {
                var e = i < doEditor.Count ? doEditor[i] : "(nada)";
                var x = i < doBuild.Count ? doBuild[i] : "(nada)";
                if (e == x) continue;
                if (diferentes++ == 0) relatorio.AppendLine("linhas " + oQue + " diferentes (Editor | " + quem + "):");
                if (diferentes <= 10) relatorio.AppendLine("  " + (i + 1) + ": " + e + "  |  " + x);
            }
            relatorio.AppendLine(diferentes == 0
                ? "linhas " + oQue + ": as " + doBuild.Count + " linhas do " + quem + " são idênticas às do Editor."
                : "linhas " + oQue + ": " + diferentes + " diferente(s) — Editor " + doEditor.Count + ", " + quem + " " + doBuild.Count + ".");
            relatorio.AppendLine("relatório " + oQue + " do " + quem + ":");
            foreach (var l in doBuild) relatorio.AppendLine("  " + l);

            return diferentes == 0 && doBuild.Count > 0;
        }
    }
}
