using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using RPGLegend.Game.App;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Build do app (Windows)": builda o app de verdade (a cena Scenes/App.unity) para Windows 64
    /// em Mono (o IL2CPP do Windows não está instalado), apontando para a API de produção, como o do celular. A
    /// pasta Builds/AppWindows/RPG Legend é o jogo inteiro: é ela que se zipa e se manda. Depois do build, abre o
    /// executável numa janela de 1280 × 720 e confere se ele não jogou exceção ao abrir. O resultado vai para o
    /// Console e para Builds/AppWindows/build-report.txt (fora da pasta do jogo, junto com o log da conferência).
    /// </summary>
    public static class WindowsAppBuild
    {
        private const string ProductName = "RPG Legend";

        /// <summary>Quanto esperar depois de abrir o executável antes de ler o log (a chegada à porta leva uns 5 s).</summary>
        private const int LogWaitMs = 10000;

        [MenuItem("RPG Legend/Build do app (Windows)", priority = 310)]
        private static void BuildMenu() => BuildAndCheck();

        /// <summary>Builda e abre. Devolve true quando o executável abriu sem exceção no log.</summary>
        public static bool BuildAndCheck()
        {
            var projeto = Directory.GetParent(Application.dataPath).FullName;
            var pasta = Path.Combine(projeto, "Builds", "AppWindows");
            var relatorio = new StringBuilder();

            bool ok;
            try
            {
                ok = Run(pasta, relatorio);
            }
            catch (Exception e)
            {
                relatorio.AppendLine(e.GetType().Name + ": " + e.Message);
                ok = false;
            }

            Directory.CreateDirectory(pasta);
            File.WriteAllText(Path.Combine(pasta, "build-report.txt"), relatorio.ToString());
            var texto = "Build do app (Windows): " + (ok ? "OK" : "FALHOU") + "\n" + relatorio;
            if (ok) Debug.Log(texto);
            else Debug.LogError(texto);
            return ok;
        }

        private static bool Run(string pasta, StringBuilder relatorio)
        {
            var jogo = Path.Combine(pasta, ProductName);
            var exe = Path.Combine(jogo, ProductName + ".exe");
            var log = Path.Combine(pasta, "app.log");
            relatorio.AppendLine("servidor: " + ApiConfig.Producao);

            // 0. O que dá para conferir antes do build.
            if (!File.Exists(AppSceneBuilder.ScenePath))
            {
                relatorio.AppendLine("A cena " + AppSceneBuilder.ScenePath + " não existe: rode RPG Legend > Montar cena do app.");
                return false;
            }
            var backend = PlayerSettings.GetScriptingBackend(NamedBuildTarget.Standalone);
            if (backend != ScriptingImplementation.Mono2x)
            {
                relatorio.AppendLine("O build do Windows é Mono, e o Standalone está em " + backend + ". Troque em Project Settings > Player.");
                return false;
            }

            // 1. Build numa pasta limpa, com o nome do jogo (o da janela e o do executável) só durante o build.
            if (Directory.Exists(jogo)) Directory.Delete(jogo, true);
            var nomeAntes = PlayerSettings.productName;
            var inicio = DateTime.Now;
            BuildReport build;
            try
            {
                PlayerSettings.productName = ProductName;
                build = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    scenes = new[] { AppSceneBuilder.ScenePath },
                    locationPathName = exe,
                    target = BuildTarget.StandaloneWindows64,
                    targetGroup = BuildTargetGroup.Standalone,
                    options = BuildOptions.None,
                });
            }
            finally
            {
                PlayerSettings.productName = nomeAntes;
                // O build grava o ProjectSettings.asset com o nome do jogo; salvar de novo deixa no disco o de repouso.
                AssetDatabase.SaveAssets();
            }
            var resumo = build.summary;
            relatorio.AppendLine("build: " + resumo.result + " em " + (DateTime.Now - inicio).TotalSeconds.ToString("0") + " s, " +
                                 (resumo.totalSize / (1024 * 1024)) + " MB, " + resumo.totalErrors + " erro(s) -> " + exe);
            if (resumo.result != BuildResult.Succeeded) return false;

            // A informação de depuração do Burst sai ao lado do jogo e não vai junto ("DoNotShip", e na Unity 6
            // "BackUpThisFolder_ButDontShipItWithYourGame").
            foreach (var sobra in Directory.GetDirectories(jogo, "*_DoNotShip").Concat(Directory.GetDirectories(jogo, "*_ButDontShipItWithYourGame")))
                Directory.Delete(sobra, true);

            // 2. Abre numa janela e dá tempo de chegar à porta. A Unity grava o tamanho dessa janela nas preferências
            // do jogo (no registro) mesmo fechando à força, e ele abriria pequeno da próxima vez: a chave volta a
            // ser o que era antes (com a sessão de quem já entrou neste computador).
            if (File.Exists(log)) File.Delete(log);
            var chave = @"HKCU\Software\" + PlayerSettings.companyName + @"\" + ProductName;
            var copia = Path.Combine(pasta, "preferencias-antes.reg");
            var existia = Reg("query \"" + chave + "\"") == 0;
            if (existia && Reg("export \"" + chave + "\" \"" + copia + "\" /y") != 0)
            {
                relatorio.AppendLine("Não consegui guardar as preferências do jogo (" + chave + ") para a conferência: abra o executável à mão.");
                return true;
            }
            try
            {
                using (var processo = Process.Start(new ProcessStartInfo
                       {
                           FileName = exe,
                           Arguments = "-screen-fullscreen 0 -screen-width 1280 -screen-height 720 -logFile \"" + log + "\"",
                           UseShellExecute = false,
                           WorkingDirectory = jogo,
                       }))
                {
                    if (processo == null)
                    {
                        relatorio.AppendLine("Não consegui abrir " + exe);
                        return false;
                    }
                    Thread.Sleep(LogWaitMs);
                    var saiu = processo.HasExited;
                    if (!saiu) processo.Kill();
                    processo.WaitForExit(5000);
                    if (saiu)
                    {
                        relatorio.AppendLine("O executável fechou sozinho antes de " + LogWaitMs / 1000 + " s (código " + processo.ExitCode + "). Log: " + log);
                        return false;
                    }
                }
            }
            finally
            {
                Reg("delete \"" + chave + "\" /f");
                if (existia) Reg("import \"" + copia + "\"");
                if (File.Exists(copia)) File.Delete(copia);
            }

            // 3. O log da conferência.
            var linhas = File.Exists(log) ? File.ReadAllLines(log) : new string[0];
            var excecoes = linhas.Where(l => l.Contains("Exception")).Distinct().ToList();
            if (linhas.Count(l => l.Trim().Length > 0) == 0)
            {
                relatorio.AppendLine("O executável não escreveu nada no log em " + LogWaitMs / 1000 + " s. Log: " + log);
                return false;
            }
            if (excecoes.Count > 0)
            {
                relatorio.AppendLine("O executável jogou exceção ao abrir (log: " + log + "):");
                foreach (var l in excecoes.Take(10)) relatorio.AppendLine("  " + l);
                return false;
            }
            relatorio.AppendLine("executável: abriu, sem exceção no log nos primeiros " + LogWaitMs / 1000 + " s. Log: " + log);
            return true;
        }

        /// <summary>Roda o reg.exe do Windows sem janela e devolve o código de saída.</summary>
        private static int Reg(string argumentos)
        {
            using (var processo = Process.Start(new ProcessStartInfo
                   {
                       FileName = "reg.exe",
                       Arguments = argumentos,
                       UseShellExecute = false,
                       CreateNoWindow = true,
                       RedirectStandardOutput = true,
                       RedirectStandardError = true,
                   }))
            {
                if (processo == null) return -1;
                processo.StandardOutput.ReadToEnd();
                processo.StandardError.ReadToEnd();
                processo.WaitForExit(30000);
                return processo.ExitCode;
            }
        }
    }
}
