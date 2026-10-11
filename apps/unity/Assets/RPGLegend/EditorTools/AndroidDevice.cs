using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// O que os builds de Android (o de teste e o do app) têm em comum: conferir antes do build demorado se dá
    /// para buildar e instalar (módulo, extensão carregada, IL2CPP/ARM64, adb, celular no cabo) e rodar o adb.
    /// </summary>
    internal static class AndroidDevice
    {
        /// <summary>
        /// Confere tudo o que dá para conferir antes do build. Devolve false (com o motivo no relatório) quando
        /// falta algo; com true, <paramref name="adb"/> e <paramref name="serial"/> apontam para o celular.
        /// </summary>
        public static bool Precheck(StringBuilder relatorio, out string adb, out string serial)
        {
            adb = null;
            serial = null;
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android, BuildTarget.Android))
            {
                relatorio.AppendLine("A Unity não tem o módulo Android: instale pelo Unity Hub (Installs > Add modules > " +
                                     "Android Build Support, com OpenJDK e SDK & NDK Tools) e reinicie a Unity.");
                return false;
            }
            // Com o módulo instalado com a Unity aberta, ela já diz que suporta Android, mas a extensão que faz o
            // IL2CPP e o Gradle só carrega quando a Unity abre: o build "dá certo" em poucos minutos e não sai APK.
            // (UAC0005 avisa que a lista pode trazer assemblies já descarregados; aqui só se lê o nome deles.)
#pragma warning disable UAC0005
            var extensaoAndroid = AppDomain.CurrentDomain.GetAssemblies().Any(a => a.GetName().Name == "UnityEditor.Android.Extensions");
#pragma warning restore UAC0005
            if (!extensaoAndroid)
            {
                relatorio.AppendLine("A extensão do Android não está carregada: feche e abra a Unity de novo (o módulo foi instalado com ela aberta).");
                return false;
            }
            var backend = PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android);
            if (backend != ScriptingImplementation.IL2CPP)
            {
                relatorio.AppendLine("O Android está em " + backend + "; o celular exige IL2CPP (é o que a Play Store aceita). Troque em Project Settings > Player > Android.");
                return false;
            }
            if ((PlayerSettings.Android.targetArchitectures & AndroidArchitecture.ARM64) == 0)
            {
                relatorio.AppendLine("O Android não está gerando ARM64 (" + PlayerSettings.Android.targetArchitectures + "). Marque ARM64 em Project Settings > Player > Android.");
                return false;
            }
            adb = FindAdb();
            if (adb == null)
            {
                relatorio.AppendLine("Não achei o adb (vem com o módulo Android, em PlaybackEngines/AndroidPlayer/SDK/platform-tools).");
                return false;
            }
            serial = FindDevice(adb, relatorio);
            return serial != null;
        }

        /// <summary>Instala o APK por cima do que houver (mantém os dados do app). Devolve false com o motivo no relatório.</summary>
        public static bool Install(string adb, string serial, string apk, StringBuilder relatorio)
        {
            var instalacao = Tool(adb, "-s " + serial + " install -r \"" + apk + "\"", 300000);
            if (instalacao.Output.Contains("Success")) return true;
            relatorio.AppendLine("A instalação no celular falhou: " + instalacao.Output.Trim());
            return false;
        }

        /// <summary>Fecha o app se estiver aberto, limpa o logcat e abre o app pelo ícone.</summary>
        public static void Launch(string adb, string serial, string id)
        {
            Tool(adb, "-s " + serial + " logcat -c", 30000);
            Tool(adb, "-s " + serial + " shell am force-stop " + id, 30000);
            Tool(adb, "-s " + serial + " shell monkey -p " + id + " -c android.intent.category.LAUNCHER 1", 30000);
        }

        /// <summary>As linhas do logcat com a tag Unity desde o último <see cref="Launch"/>.</summary>
        public static List<string> UnityLog(string adb, string serial) =>
            Tool(adb, "-s " + serial + " logcat -d -v raw -s Unity", 30000).Output.Split('\n').Select(l => l.TrimEnd('\r')).ToList();

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

        public struct ToolResult
        {
            public int Exit;
            public string Output;
        }

        /// <summary>Roda uma ferramenta sem janela e devolve a saída (stdout + stderr) em UTF-8.</summary>
        public static ToolResult Tool(string file, string args, int timeoutMs)
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
