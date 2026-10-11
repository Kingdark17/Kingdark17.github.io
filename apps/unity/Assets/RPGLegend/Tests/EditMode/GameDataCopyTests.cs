using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;

namespace RPGLegend.Tests
{
    /// <summary>
    /// A cópia das tabelas dentro do projeto (Assets/RPGLegend/Resources/GameData, que é a que vai no build)
    /// tem que ser igual à origem do TypeScript (packages/shared/fixtures/data): mesmos arquivos, mesmo texto,
    /// ignorando \r\n contra \n. Divergiu → rode o menu "RPG Legend > Atualizar tabelas do jogo".
    ///
    /// Sem UnityEngine: este arquivo também compila no executor de fora da Unity (Tools~/run-tests).
    /// </summary>
    public class GameDataCopyTests
    {
        private const string CopyFolder = "Assets/RPGLegend/Resources/GameData";

        [Test]
        public void CopiaDasTabelasDoJogoIgualAOrigemDoTypeScript()
        {
            var origem = Path.Combine(Fixtures.Dir, "data");
            var copia = FindCopy();
            if (copia == null)
                Assert.Fail("Não achei " + CopyFolder + " subindo a partir de " + Directory.GetCurrentDirectory() +
                            ". Rode o menu RPG Legend > Atualizar tabelas do jogo.");

            var naOrigem = JsonFiles(origem);
            var naCopia = JsonFiles(copia);
            var problemas = new List<string>();
            foreach (var rel in naOrigem.Except(naCopia, StringComparer.Ordinal)) problemas.Add("falta na cópia: " + rel);
            foreach (var rel in naCopia.Except(naOrigem, StringComparer.Ordinal)) problemas.Add("sumiu da origem, sobrou na cópia: " + rel);
            foreach (var rel in naOrigem.Intersect(naCopia, StringComparer.Ordinal))
                if (Normalized(Path.Combine(origem, rel)) != Normalized(Path.Combine(copia, rel))) problemas.Add("diferente: " + rel);

            if (problemas.Count > 0)
                Assert.Fail("A cópia das tabelas (" + CopyFolder + ") divergiu da origem (" + origem + "). " +
                            "Rode o menu RPG Legend > Atualizar tabelas do jogo.\n  " + string.Join("\n  ", problemas));
        }

        /// <summary>Sobe a partir da pasta atual (na Unity, a raiz do projeto) e, se não der, da pasta do executável.</summary>
        private static string FindCopy() => FindUp(Directory.GetCurrentDirectory()) ?? FindUp(AppDomain.CurrentDomain.BaseDirectory);

        private static string FindUp(string start)
        {
            if (string.IsNullOrEmpty(start)) return null;
            for (var dir = new DirectoryInfo(start); dir != null; dir = dir.Parent)
            {
                var candidate = Path.Combine(dir.FullName, CopyFolder.Replace('/', Path.DirectorySeparatorChar));
                if (Directory.Exists(candidate)) return candidate;
            }
            return null;
        }

        /// <summary>Os .json da pasta (sem os .meta da Unity), com caminho relativo em "/", em ordem.</summary>
        private static List<string> JsonFiles(string root) =>
            Directory.GetFiles(root, "*.json", SearchOption.AllDirectories)
                .Where(f => f.EndsWith(".json", StringComparison.Ordinal))
                .Select(f => f.Substring(root.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Replace('\\', '/'))
                .OrderBy(f => f, StringComparer.Ordinal)
                .ToList();

        private static string Normalized(string file) => File.ReadAllText(file).Replace("\r\n", "\n");
    }
}
