using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Atualizar tabelas do jogo": traz as tabelas que o TypeScript exporta
    /// (packages/shared/fixtures/data) para Assets/RPGLegend/Resources/GameData, nas mesmas pastas. É essa
    /// cópia que vai no build. Copia só o que mudou (ignorando \r\n contra \n, que o git troca no checkout) e
    /// apaga o que sumiu da origem. O teste GameDataCopyTests falha enquanto a cópia estiver diferente.
    /// </summary>
    public static class GameDataSync
    {
        /// <summary>A cópia, relativa à raiz do projeto Unity.</summary>
        public const string TargetFolder = "Assets/RPGLegend/Resources/GameData";

        public sealed class Result
        {
            public string Source;
            public readonly List<string> Copied = new List<string>();
            public readonly List<string> Deleted = new List<string>();
            public int Unchanged;

            public string Summary =>
                "Tabelas do jogo: " + Copied.Count + " copiada(s), " + Deleted.Count + " apagada(s), " + Unchanged + " igual(is). Origem: " + Source +
                (Copied.Count > 0 ? "\n  copiadas: " + string.Join(", ", Copied) : "") +
                (Deleted.Count > 0 ? "\n  apagadas: " + string.Join(", ", Deleted) : "");
        }

        [MenuItem("RPG Legend/Atualizar tabelas do jogo")]
        private static void SyncMenu() => Debug.Log(Sync().Summary);

        public static Result Sync()
        {
            var origem = SourceDir();
            var projeto = Directory.GetParent(Application.dataPath).FullName;
            var destino = Path.Combine(projeto, TargetFolder.Replace('/', Path.DirectorySeparatorChar));
            var result = new Result { Source = origem };

            var naOrigem = JsonFiles(origem);
            var naCopia = Directory.Exists(destino) ? JsonFiles(destino) : new List<string>();

            foreach (var rel in naOrigem)
            {
                var de = Path.Combine(origem, rel);
                var para = Path.Combine(destino, rel);
                if (File.Exists(para) && SameText(de, para))
                {
                    result.Unchanged++;
                    continue;
                }
                Directory.CreateDirectory(Path.GetDirectoryName(para));
                File.Copy(de, para, true);
                result.Copied.Add(rel);
            }

            foreach (var rel in naCopia.Except(naOrigem, StringComparer.Ordinal))
            {
                DeleteWithMeta(Path.Combine(destino, rel));
                result.Deleted.Add(rel);
            }
            if (Directory.Exists(destino)) DeleteEmptyFolders(destino);

            AssetDatabase.Refresh();
            return result;
        }

        /// <summary>
        /// packages/shared/fixtures/data: a variável RPG_FIXTURES_DIR (a pasta fixtures), ou subindo a partir
        /// da raiz do projeto — o projeto Unity mora em apps/unity, dentro do repositório do jogo.
        /// </summary>
        public static string SourceDir()
        {
            var env = Environment.GetEnvironmentVariable("RPG_FIXTURES_DIR");
            if (!string.IsNullOrEmpty(env)) return Path.Combine(env, "data");
            for (var dir = Directory.GetParent(Application.dataPath); dir != null; dir = dir.Parent)
            {
                var candidate = Path.Combine(dir.FullName, "packages", "shared", "fixtures", "data");
                if (Directory.Exists(candidate)) return candidate;
            }
            throw new DirectoryNotFoundException(
                "Não achei packages/shared/fixtures/data subindo a partir do projeto. Gere as tabelas no repositório " +
                "(cd packages/shared && pnpm dlx tsx scripts/gen-fixtures.ts) ou aponte a pasta fixtures com RPG_FIXTURES_DIR.");
        }

        /// <summary>Os .json da pasta, com caminho relativo em "/", em ordem.</summary>
        private static List<string> JsonFiles(string root) =>
            Directory.GetFiles(root, "*.json", SearchOption.AllDirectories)
                .Where(f => f.EndsWith(".json", StringComparison.Ordinal))
                .Select(f => f.Substring(root.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Replace('\\', '/'))
                .OrderBy(f => f, StringComparer.Ordinal)
                .ToList();

        private static bool SameText(string a, string b) =>
            File.ReadAllText(a).Replace("\r\n", "\n") == File.ReadAllText(b).Replace("\r\n", "\n");

        private static void DeleteWithMeta(string path)
        {
            File.Delete(path);
            if (File.Exists(path + ".meta")) File.Delete(path + ".meta");
        }

        private static void DeleteEmptyFolders(string root)
        {
            foreach (var dir in Directory.GetDirectories(root, "*", SearchOption.AllDirectories).OrderByDescending(d => d.Length))
            {
                if (Directory.EnumerateFileSystemEntries(dir).Any()) continue;
                Directory.Delete(dir);
                if (File.Exists(dir + ".meta")) File.Delete(dir + ".meta");
            }
        }
    }
}
