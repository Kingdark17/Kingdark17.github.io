using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using RPGLegend.Game;
using RPGLegend.Tests;
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
    /// se as linhas "[smoke]" do logcat são idênticas às do SmokeRun rodado aqui no Editor. O mesmo app roda
    /// também todos os casos de packages/shared/fixtures (RPGLegend.DeviceTests), e as linhas "[fixtures]"
    /// têm que bater com as do FixtureSuite rodado aqui. É a prova de que o IL2CPP e o processador do celular
    /// dão os mesmos números que o Editor (e, por tabela, que o TS).
    ///
    /// Os casos entram no build como uma cópia temporária em DeviceTests/Resources/Fixtures (fora do git), com
    /// o símbolo RPG_DEVICE_TESTS só nesse build: o jogo de verdade não leva nem os casos nem o código deles.
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
        private const string DeviceTestsDefine = "RPG_DEVICE_TESTS";
        private const string TempResources = "Assets/RPGLegend/DeviceTests/Resources";
        private const int LogTimeoutMs = 300000;

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
            if (!AndroidDevice.Precheck(relatorio, out var adb, out var serial)) return false;

            // 1. Build, numa pasta limpa, com o identificador e o nome do app de teste e os casos de fixtures.
            if (Directory.Exists(pasta)) Directory.Delete(pasta, true);
            var idAntes = PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android);
            var nomeAntes = PlayerSettings.productName;
            var aabAntes = EditorUserBuildSettings.buildAppBundle;
            var exportAntes = EditorUserBuildSettings.exportAsGoogleAndroidProject;
            var inicio = DateTime.Now;
            BuildReport build;
            try
            {
                int casos = CopyFixturesIntoProject();
                relatorio.AppendLine("casos de fixtures no build: " + casos + " arquivo(s).");
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
                    extraScriptingDefines = new[] { DeviceTestsDefine },
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
                DeleteFixturesCopy();
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
            if (!AndroidDevice.Install(adb, serial, apk, relatorio)) return false;
            relatorio.AppendLine("celular " + serial + ": instalado.");
            AndroidDevice.Launch(adb, serial, TestIdentifier);

            // 3. Espera os dois relatórios terminarem no logcat (tag Unity): o smoke e, depois dele, os fixtures.
            var smokeCelular = new List<string>();
            var fixturesCelular = new List<string>();
            var relogio = Stopwatch.StartNew();
            while (relogio.ElapsedMilliseconds < LogTimeoutMs)
            {
                Thread.Sleep(2000);
                var log = AndroidDevice.UnityLog(adb, serial);
                smokeCelular = SmokeBuild.SmokeLines(log);
                fixturesCelular = SmokeBuild.PrefixedLines(log, DeviceTestsPrefix);
                if (Finished(smokeCelular, SmokeRun.Ok, SmokeRun.FailPrefix) && Finished(fixturesCelular, FixtureSuite.Ok, FixtureSuite.FailPrefix))
                    break;
            }
            relatorio.AppendLine("celular: relatórios em " + (relogio.ElapsedMilliseconds / 1000) + " s.");
            if (relogio.ElapsedMilliseconds >= LogTimeoutMs)
                relatorio.AppendLine("Os relatórios não terminaram no logcat em " + LogTimeoutMs / 1000 + " s (smoke " + smokeCelular.Count +
                                     " linha(s), fixtures " + fixturesCelular.Count + ").");

            // 4. As linhas do celular contra as do Editor.
            bool smokeOk = SmokeBuild.CompareWithEditor(smokeCelular, "celular", relatorio);
            bool fixturesOk = SmokeBuild.CompareLines(FixtureSuite.Run(), fixturesCelular, "[fixtures]", "celular", relatorio) && FixtureSuite.Passed(fixturesCelular);
            return smokeOk && fixturesOk;
        }

        /// <summary>O prefixo das linhas dos fixtures no log (o mesmo do DeviceFixtures, que não é referenciado daqui).</summary>
        private const string DeviceTestsPrefix = "[fixtures] ";

        private static bool Finished(List<string> lines, string ok, string failPrefix) =>
            lines.Count > 0 && (lines[lines.Count - 1] == ok || lines[lines.Count - 1].StartsWith(failPrefix, StringComparison.Ordinal));

        /// <summary>
        /// Copia os casos (packages/shared/fixtures/*.json, sem a pasta data, que o jogo já tem em
        /// Resources/GameData) para DeviceTests/Resources/Fixtures e importa. Devolve quantos arquivos.
        /// </summary>
        private static int CopyFixturesIntoProject()
        {
            var origem = Directory.GetParent(GameDataSync.SourceDir()).FullName;
            var projeto = Directory.GetParent(Application.dataPath).FullName;
            var destino = Path.Combine(projeto, TempResources.Replace('/', Path.DirectorySeparatorChar), "Fixtures");
            DeleteFixturesCopy();
            Directory.CreateDirectory(destino);
            var arquivos = Directory.GetFiles(origem, "*.json", SearchOption.TopDirectoryOnly);
            foreach (var f in arquivos) File.Copy(f, Path.Combine(destino, Path.GetFileName(f)), true);
            AssetDatabase.Refresh();
            return arquivos.Length;
        }

        /// <summary>Apaga a cópia temporária dos casos (com os .meta que a Unity criou) e reimporta.</summary>
        private static void DeleteFixturesCopy()
        {
            var projeto = Directory.GetParent(Application.dataPath).FullName;
            var pasta = Path.Combine(projeto, TempResources.Replace('/', Path.DirectorySeparatorChar));
            if (!Directory.Exists(pasta)) return;
            Directory.Delete(pasta, true);
            if (File.Exists(pasta + ".meta")) File.Delete(pasta + ".meta");
            AssetDatabase.Refresh();
        }
    }
}
