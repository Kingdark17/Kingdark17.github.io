using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using RPGLegend.Game;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Build de teste (Android)": builda a cena EngineSmoke para Android (IL2CPP, ARM64) em
    /// apps/unity/Builds/SmokeAndroid, instala no celular ligado no cabo (depuração USB), abre o app e confere
    /// se as linhas "[smoke]" do logcat são idênticas às do SmokeRun rodado aqui no Editor. É a prova de que o
    /// IL2CPP e o processador do celular dão os mesmos números que o Editor (e, por tabela, que o TS).
    ///
    /// O app de teste usa um identificador próprio (<see cref="TestIdentifier"/>) só durante o build: o
    /// identificador definitivo do jogo (o da Play Store, que não muda depois de publicado) não é decidido aqui.
    /// O resultado vai para o Console e para Builds/SmokeAndroid/smoke-report.txt; o app fica aberto no celular.
    /// </summary>
    public static class AndroidSmokeBuild
    {
        public const string TestIdentifier = "br.com.rpglegend.smoke";
        private const string TestProductName = "RPG Legend Smoke";
        private const string ApkName = "RPGLegendSmoke.apk";
        private const int LogTimeoutMs = 120000;

        [MenuItem("RPG Legend/Build de teste (Android)")]
        private static void BuildMenu() => BuildAndCheck();

        /// <summary>Builda, instala, roda e compara. Devolve true quando o celular passou e as linhas bateram.</summary>
        public static bool BuildAndCheck()
        {
            var projeto = Directory.GetParent(Application.dataPath).FullName;
            var pasta = Path.Combine(projeto, "Builds", "SmokeAndroid");
            var relatorio = new StringBuilder();
            var alvoAntes = EditorUserBuildSettings.activeBuildTarget;

            bool ok;
            try
            {
                ok = Run(pasta, Path.Combine(pasta, ApkName), relatorio);
            }
            catch (Exception e)
            {
                relatorio.AppendLine(e.GetType().Name + ": " + e.Message);
                ok = false;
            }

            Directory.CreateDirectory(pasta);
            File.WriteAllText(Path.Combine(pasta, "smoke-report.txt"), relatorio.ToString());
            var texto = "Build de teste (Android): " + (ok ? "OK" : "FALHOU") + "\n" + relatorio;
            if (ok) Debug.Log(texto);
            else Debug.LogError(texto);

            // O build troca a plataforma ativa do Editor para Android; volta para a de antes.
            if (EditorUserBuildSettings.activeBuildTarget != alvoAntes)
                EditorUserBuildSettings.SwitchActiveBuildTargetAsync(BuildPipeline.GetBuildTargetGroup(alvoAntes), alvoAntes);
            return ok;
        }

        private static bool Run(string pasta, string apk, StringBuilder relatorio)
        {
            // 0. O que dá para conferir antes do build demorado.
            if (!File.Exists(SmokeBuild.ScenePath))
            {
                relatorio.AppendLine("A cena " + SmokeBuild.ScenePath + " não existe.");
                return false;
            }
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android, BuildTarget.Android))
            {
                relatorio.AppendLine("A Unity não tem o módulo Android: instale pelo Unity Hub (Installs > Add modules > " +
                                     "Android Build Support, com OpenJDK e SDK & NDK Tools) e reinicie a Unity.");
                return false;
            }
            // Com o módulo instalado com a Unity aberta, ela já diz que suporta Android, mas a extensão que faz o
            // IL2CPP e o Gradle só carrega quando a Unity abre: o build "dá certo" em poucos minutos e não sai APK.
            if (!AppDomain.CurrentDomain.GetAssemblies().Any(a => a.GetName().Name == "UnityEditor.Android.Extensions"))
            {
                relatorio.AppendLine("A extensão do Android não está carregada: feche e abra a Unity de novo (o módulo foi instalado com ela aberta).");
                return false;
            }
            var backend = PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android);
            if (backend != ScriptingImplementation.IL2CPP)
            {
                relatorio.AppendLine("O Android está em " + backend + "; a prova é do IL2CPP (o que a Play Store exige). Troque em Project Settings > Player > Android.");
                return false;
            }
            if ((PlayerSettings.Android.targetArchitectures & AndroidArchitecture.ARM64) == 0)
            {
                relatorio.AppendLine("O Android não está gerando ARM64 (" + PlayerSettings.Android.targetArchitectures + "). Marque ARM64 em Project Settings > Player > Android.");
                return false;
            }
            var adb = FindAdb();
            if (adb == null)
            {
                relatorio.AppendLine("Não achei o adb (vem com o módulo Android, em PlaybackEngines/AndroidPlayer/SDK/platform-tools).");
                return false;
            }
            var serial = FindDevice(adb, relatorio);
            if (serial == null) return false;

            // 1. Build, numa pasta limpa, com o identificador e o nome do app de teste.
            if (Directory.Exists(pasta)) Directory.Delete(pasta, true);
            var idAntes = PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android);
            var nomeAntes = PlayerSettings.productName;
            var aabAntes = EditorUserBuildSettings.buildAppBundle;
            var exportAntes = EditorUserBuildSettings.exportAsGoogleAndroidProject;
            var inicio = DateTime.Now;
            BuildReport build;
            try
            {
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, TestIdentifier);
                PlayerSettings.productName = TestProductName;
                EditorUserBuildSettings.buildAppBundle = false;
                EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
                build = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    scenes = new[] { SmokeBuild.ScenePath },
                    locationPathName = apk,
                    target = BuildTarget.Android,
                    targetGroup = BuildTargetGroup.Android,
                    options = BuildOptions.None,
                });
            }
            finally
            {
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, idAntes);
                PlayerSettings.productName = nomeAntes;
                EditorUserBuildSettings.buildAppBundle = aabAntes;
                EditorUserBuildSettings.exportAsGoogleAndroidProject = exportAntes;
                // O build grava o ProjectSettings.asset com o identificador de teste; sem salvar de novo, o disco
                // ficaria com ele até a próxima vez que a Unity salvasse as configurações.
                AssetDatabase.SaveAssets();
            }
            var resumo = build.summary;
            relatorio.AppendLine("build: " + resumo.result + " em " + (DateTime.Now - inicio).TotalSeconds.ToString("0") + " s, " +
                                 (resumo.totalSize / (1024 * 1024)) + " MB, " + resumo.totalErrors + " erro(s) -> " + apk);
            if (resumo.result != BuildResult.Succeeded) return false;
            if (!File.Exists(apk))
            {
                relatorio.AppendLine("O build terminou sem gerar o APK.");
                return false;
            }

            // 2. Instala e abre no celular, com o logcat limpo.
            var instalacao = Tool(adb, "-s " + serial + " install -r \"" + apk + "\"", 300000);
            if (!instalacao.Output.Contains("Success"))
            {
                relatorio.AppendLine("A instalação no celular falhou: " + instalacao.Output.Trim());
                return false;
            }
            relatorio.AppendLine("celular " + serial + ": instalado.");
            Tool(adb, "-s " + serial + " logcat -c", 30000);
            Tool(adb, "-s " + serial + " shell am force-stop " + TestIdentifier, 30000);
            Tool(adb, "-s " + serial + " shell monkey -p " + TestIdentifier + " -c android.intent.category.LAUNCHER 1", 30000);

            // 3. Espera o relatório terminar no logcat (tag Unity).
            var doCelular = new List<string>();
            var relogio = Stopwatch.StartNew();
            while (relogio.ElapsedMilliseconds < LogTimeoutMs)
            {
                Thread.Sleep(1000);
                var log = Tool(adb, "-s " + serial + " logcat -d -v raw -s Unity", 30000).Output;
                doCelular = SmokeBuild.SmokeLines(log.Split('\n').Select(l => l.TrimEnd('\r')));
                if (doCelular.Count > 0 && (SmokeRun.Passed(doCelular) || doCelular[doCelular.Count - 1].StartsWith(SmokeRun.FailPrefix, StringComparison.Ordinal)))
                    break;
            }
            if (relogio.ElapsedMilliseconds >= LogTimeoutMs)
                relatorio.AppendLine("O relatório não terminou no logcat em " + LogTimeoutMs / 1000 + " s (" + doCelular.Count + " linha(s) até ali).");

            // 4. As linhas do celular contra as do Editor.
            return SmokeBuild.CompareWithEditor(doCelular, "celular", relatorio);
        }

        private static string FindDevice(string adb, StringBuilder relatorio)
        {
            var linhas = Tool(adb, "devices", 60000).Output.Split('\n').Select(l => l.Trim()).Where(l => l.Contains("\t")).ToList();
            var prontos = linhas.Where(l => l.EndsWith("\tdevice", StringComparison.Ordinal)).Select(l => l.Split('\t')[0]).ToList();
            if (prontos.Count > 0)
            {
                if (prontos.Count > 1) relatorio.AppendLine("Há " + prontos.Count + " aparelhos; usando " + prontos[0] + ".");
                return prontos[0];
            }
            relatorio.AppendLine(linhas.Any(l => l.EndsWith("\tunauthorized", StringComparison.Ordinal))
                ? "O celular está no cabo mas não autorizou este computador: desbloqueie a tela e toque em Permitir na pergunta de depuração USB."
                : "Nenhum celular encontrado. No celular: Configurações > Sobre o telefone > toque 7 vezes em Número da versão; " +
                  "depois Opções do desenvolvedor > Depuração USB ligada; ligue no cabo e toque em Permitir.");
            return null;
        }

        /// <summary>O adb do módulo Android da Unity, ou o do SDK apontado por ANDROID_HOME / ANDROID_SDK_ROOT.</summary>
        private static string FindAdb()
        {
            var exe = Application.platform == RuntimePlatform.WindowsEditor ? "adb.exe" : "adb";
            var candidatos = new List<string>
            {
                Path.Combine(EditorApplication.applicationContentsPath, "PlaybackEngines", "AndroidPlayer", "SDK", "platform-tools", exe),
            };
            foreach (var env in new[] { "ANDROID_HOME", "ANDROID_SDK_ROOT" })
            {
                var raiz = Environment.GetEnvironmentVariable(env);
                if (!string.IsNullOrEmpty(raiz)) candidatos.Add(Path.Combine(raiz, "platform-tools", exe));
            }
            return candidatos.FirstOrDefault(File.Exists);
        }

        private struct ToolResult
        {
            public int Exit;
            public string Output;
        }

        /// <summary>Roda uma ferramenta sem janela e devolve a saída (stdout + stderr) em UTF-8.</summary>
        private static ToolResult Tool(string file, string args, int timeoutMs)
        {
            using (var p = Process.Start(new ProcessStartInfo
                   {
                       FileName = file,
                       Arguments = args,
                       UseShellExecute = false,
                       CreateNoWindow = true,
                       RedirectStandardOutput = true,
                       RedirectStandardError = true,
                       StandardOutputEncoding = Encoding.UTF8,
                       StandardErrorEncoding = Encoding.UTF8,
                   }))
            {
                var saida = p.StandardOutput.ReadToEndAsync();
                var erro = p.StandardError.ReadToEndAsync();
                if (!p.WaitForExit(timeoutMs))
                {
                    try { p.Kill(); } catch (InvalidOperationException) { }
                    return new ToolResult { Exit = -1, Output = file + " " + args + ": passou de " + timeoutMs / 1000 + " s" };
                }
                return new ToolResult { Exit = p.ExitCode, Output = saida.Result + erro.Result };
            }
        }
    }
}
