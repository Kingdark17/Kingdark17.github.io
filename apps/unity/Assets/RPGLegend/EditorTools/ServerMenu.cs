using RPGLegend.Game.App;
using UnityEditor;
using UnityEngine;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Servidor do jogo": para onde o app aponta quando roda no Editor. Produção é a API do site
    /// (contas de verdade); local é a API rodando no computador, com o banco de desenvolvimento (PGlite), para
    /// testar sem tocar em produção. Fica nas preferências do Editor desta máquina, fora do git; os builds
    /// apontam para produção (menos o "Build do app (Android, API local)", ou o que vier em <c>-api</c>).
    /// </summary>
    public static class ServerMenu
    {
        private const string Local = ApiConfig.Local;
        private const string MenuProducao = "RPG Legend/Servidor do jogo/Produção (api.rpglegend.com.br)";
        private const string MenuLocal = "RPG Legend/Servidor do jogo/Local (127.0.0.1:3100)";

        [MenuItem(MenuProducao, priority = 200)]
        private static void UsarProducao()
        {
            EditorPrefs.DeleteKey(ApiConfig.EditorPrefsKey);
            Debug.Log("Servidor do jogo no Editor: produção (" + ApiConfig.Producao + ").");
        }

        [MenuItem(MenuLocal, priority = 201)]
        private static void UsarLocal()
        {
            EditorPrefs.SetString(ApiConfig.EditorPrefsKey, Local);
            Debug.Log("Servidor do jogo no Editor: local (" + Local + "). Suba a API com o banco de desenvolvimento antes de dar Play.");
        }

        [MenuItem(MenuProducao, true)]
        private static bool MarcarProducao()
        {
            Menu.SetChecked(MenuProducao, string.IsNullOrEmpty(EditorPrefs.GetString(ApiConfig.EditorPrefsKey, "")));
            return true;
        }

        [MenuItem(MenuLocal, true)]
        private static bool MarcarLocal()
        {
            Menu.SetChecked(MenuLocal, EditorPrefs.GetString(ApiConfig.EditorPrefsKey, "") == Local);
            return true;
        }
    }
}
