using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading;
using RPGLegend.Game.App;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Build do app (Android)": builda o app de verdade (a cena Scenes/App.unity) em IL2CPP/ARM64,
    /// instala no celular ligado no cabo e abre. Aponta para a API de produção, como o site: é o que fica no
    /// celular para entrar com a conta de verdade.
    ///
    /// "RPG Legend > Build do app (Android, API local)": o mesmo app apontando para a API rodando neste
    /// computador (símbolo RPG_API_LOCAL), para testar o fluxo inteiro com a conta de teste do banco de
    /// desenvolvimento sem tocar em produção. O 127.0.0.1:3100 do celular chega ao computador pelo cabo
    /// (adb reverse) e o HTTP sem TLS fica liberado só nesse build. É outro app no celular (outro identificador
    /// e o nome "RPG Legend (local)"), para não misturar a sessão de um com a do outro.
    ///
    /// Os identificadores daqui são de teste e valem só durante o build: o definitivo (o da Play Store, que não
    /// muda depois de publicado) ainda não foi escolhido. O resultado vai para o Console e para
    /// Builds/AppAndroid/build-report.txt.
    /// </summary>
    public static class AndroidAppBuild
    {
        public const string Identifier = "br.com.rpglegend.teste";
        public const string LocalIdentifier = "br.com.rpglegend.teste.local";
        private const string ProductName = "RPG Legend";
        private const string LocalProductName = "RPG Legend (local)";
        private const string LocalDefine = "RPG_API_LOCAL";
        private const int LocalPort = 3100;

        /// <summary>Quanto esperar depois de abrir o app antes de ler o logcat (a chegada à porta leva uns 5 s).</summary>
        private const int LogWaitMs = 10000;

        [MenuItem("RPG Legend/Build do app (Android)", priority = 300)]
        private static void BuildProducao() => BuildAndInstall(false);

        [MenuItem("RPG Legend/Build do app (Android, API local)", priority = 301)]
        private static void BuildLocal() => BuildAndInstall(true);

        /// <summary>Builda, instala e abre. Devolve true quando o app abriu no celular sem exceção no log.</summary>
        public static bool BuildAndInstall(bool local)
        {
            var projeto = Directory.GetParent(Application.dataPath).FullName;
            var pasta = Path.Combine(projeto, "Builds", "AppAndroid");
            var relatorio = new StringBuilder();
            var alvoAntes = EditorUserBuildSettings.activeBuildTarget;

            bool ok;
            try
            {
                ok = Run(local, pasta, relatorio);
            }
            catch (Exception e)
            {
                relatorio.AppendLine(e.GetType().Name + ": " + e.Message);
                ok = false;
            }

            Directory.CreateDirectory(pasta);
            File.WriteAllText(Path.Combine(pasta, "build-report.txt"), relatorio.ToString());
            var texto = "Build do app (Android" + (local ? ", API local" : "") + "): " + (ok ? "OK" : "FALHOU") + "\n" + relatorio;
            if (ok) Debug.Log(texto);
            else Debug.LogError(texto);

            // O build troca a plataforma ativa do Editor para Android; volta para a de antes.
            if (EditorUserBuildSettings.activeBuildTarget != alvoAntes)
                EditorUserBuildSettings.SwitchActiveBuildTargetAsync(BuildPipeline.GetBuildTargetGroup(alvoAntes), alvoAntes);
            return ok;
        }

        private static bool Run(bool local, string pasta, StringBuilder relatorio)
        {
            var id = local ? LocalIdentifier : Identifier;
            var apk = Path.Combine(pasta, local ? "RPGLegend-local.apk" : "RPGLegend.apk");
            relatorio.AppendLine("servidor: " + (local ? ApiConfig.Local + " (pelo cabo)" : ApiConfig.Producao));

            // 0. O que dá para conferir antes do build demorado.
            if (!File.Exists(AppSceneBuilder.ScenePath))
            {
                relatorio.AppendLine("A cena " + AppSceneBuilder.ScenePath + " não existe: rode RPG Legend > Montar cena do app.");
                return false;
            }
            if (!AndroidDevice.Precheck(relatorio, out var adb, out var serial)) return false;
            if (local && !LocalApiUp())
                relatorio.AppendLine("Aviso: a API local não respondeu em " + ApiConfig.Local + "/health. O app abre, mas entrar vai dar " +
                                     "\"sem conexão\" até ela subir (receita no PORTING.md).");

            // 1. Build com o identificador e o nome de teste (e, no local, o símbolo e o HTTP liberado).
            Directory.CreateDirectory(pasta);
            if (File.Exists(apk)) File.Delete(apk);
            var idAntes = PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android);
            var nomeAntes = PlayerSettings.productName;
            var aabAntes = EditorUserBuildSettings.buildAppBundle;
            var exportAntes = EditorUserBuildSettings.exportAsGoogleAndroidProject;
            var httpAntes = PlayerSettings.insecureHttpOption;
            var inicio = DateTime.Now;
            BuildReport build;
            try
            {
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, id);
                PlayerSettings.productName = local ? LocalProductName : ProductName;
                EditorUserBuildSettings.buildAppBundle = false;
                EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
                if (local) PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
                build = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    scenes = new[] { AppSceneBuilder.ScenePath },
                    locationPathName = apk,
                    target = BuildTarget.Android,
                    targetGroup = BuildTargetGroup.Android,
                    options = BuildOptions.None,
                    extraScriptingDefines = local ? new[] { LocalDefine } : null,
                });
            }
            finally
            {
                PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, idAntes);
                PlayerSettings.productName = nomeAntes;
                EditorUserBuildSettings.buildAppBundle = aabAntes;
                EditorUserBuildSettings.exportAsGoogleAndroidProject = exportAntes;
                PlayerSettings.insecureHttpOption = httpAntes;
                // O build grava o ProjectSettings.asset com o identificador de teste; sem salvar de novo, o disco
                // ficaria com ele até a próxima vez que a Unity salvasse as configurações.
                AssetDatabase.SaveAssets();
            }
            var resumo = build.summary;
            relatorio.AppendLine("build: " + resumo.result + " em " + (DateTime.Now - inicio).TotalSeconds.ToString("0") + " s, " +
                                 AndroidDevice.ApkSize(apk) + ", " +
                                 resumo.totalErrors + " erro(s) -> " + apk);
            if (resumo.result != BuildResult.Succeeded) return false;
            if (!File.Exists(apk))
            {
                relatorio.AppendLine("O build terminou sem gerar o APK.");
                return false;
            }

            // 2. Instala, liga o cabo à API local se for o caso, e abre.
            if (!AndroidDevice.Install(adb, serial, apk, relatorio)) return false;
            relatorio.AppendLine("celular " + serial + ": instalado como " + id + ".");
            if (local)
            {
                var reverso = AndroidDevice.Tool(adb, "-s " + serial + " reverse tcp:" + LocalPort + " tcp:" + LocalPort, 30000);
                if (reverso.Exit != 0)
                {
                    relatorio.AppendLine("O adb reverse falhou: " + reverso.Output.Trim());
                    return false;
                }
                relatorio.AppendLine("cabo: o 127.0.0.1:" + LocalPort + " do celular chega neste computador (vale até desligar o cabo).");
            }
            AndroidDevice.Launch(adb, serial, id);

            // 3. Dá tempo de chegar à porta e confere se o app não jogou exceção.
            Thread.Sleep(LogWaitMs);
            var log = AndroidDevice.UnityLog(adb, serial);
            // Fora a sonda da própria Unity ao abrir, que procura a biblioteca de pacotes da Play Store (Play Asset
            // Delivery, que o app não usa) e loga o ClassNotFoundException quando não acha.
            var excecoes = log.Where(l => l.Contains("Exception") && !l.Contains("com.google.android.play.core")).Distinct().ToList();
            if (log.Count(l => l.Trim().Length > 0) == 0)
            {
                relatorio.AppendLine("O app não escreveu nada no logcat em " + LogWaitMs / 1000 + " s: confira se ele abriu no celular.");
                return false;
            }
            if (excecoes.Count > 0)
            {
                relatorio.AppendLine("O app jogou exceção ao abrir:");
                foreach (var l in excecoes.Take(10)) relatorio.AppendLine("  " + l);
                return false;
            }
            relatorio.AppendLine("celular: o app abriu, sem exceção no log nos primeiros " + LogWaitMs / 1000 + " s.");
            return true;
        }

        private static bool LocalApiUp()
        {
            try
            {
                using (var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) })
                    return http.GetAsync(ApiConfig.Local + "/health").Result.IsSuccessStatusCode;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
