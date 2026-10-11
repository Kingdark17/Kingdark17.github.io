using System;
using RPGLegend.Engine.Json;
using UnityEngine;

namespace RPGLegend.Game
{
    /// <summary>
    /// Carrega as tabelas do jogo (GameData) antes da primeira cena, da cópia em Resources/GameData: a mesma
    /// pasta packages/shared/fixtures/data do TypeScript, trazida para dentro do projeto pelo menu
    /// "RPG Legend > Atualizar tabelas do jogo". É ela que vai no build.
    /// </summary>
    public static class GameBootstrap
    {
        /// <summary>A pasta das tabelas dentro de Resources. Os nomes vão sem extensão, como o Resources.Load pede.</summary>
        public const string ResourcesFolder = "GameData";

        private static bool _loaded;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void LoadBeforeFirstScene() => EnsureLoaded();

        /// <summary>Carrega as tabelas, uma vez. Lança, com o nome da tabela, se alguma faltar.</summary>
        public static void EnsureLoaded()
        {
            if (_loaded) return;
            GameDataLoader.Load(ReadTable);
            _loaded = true;
        }

        /// <summary>
        /// Carrega de novo, mesmo já carregadas. Para o Editor, que pode ter atualizado a cópia depois da
        /// última carga (e, sem recarga de domínio ao entrar no Play, a carga antiga continuaria valendo).
        /// </summary>
        public static void Reload()
        {
            _loaded = false;
            EnsureLoaded();
        }

        private static string ReadTable(string table)
        {
            var asset = Resources.Load<TextAsset>(ResourcesFolder + "/" + table);
            if (asset == null)
                throw new InvalidOperationException(
                    "Tabela do jogo não encontrada: Resources/" + ResourcesFolder + "/" + table + ".json. " +
                    "Rode o menu RPG Legend > Atualizar tabelas do jogo e faça o build de novo.");
            return asset.text;
        }
    }
}
