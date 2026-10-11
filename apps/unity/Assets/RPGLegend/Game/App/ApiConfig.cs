using System;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// Para onde o app manda as chamadas. O padrão é a API de produção, a mesma do site (mesma conta, mesmos
    /// personagens). Para desenvolver contra a API rodando no computador:
    /// - no Editor, o menu "RPG Legend > Servidor do jogo" (fica nas preferências do Editor, fora do git);
    /// - num executável, o argumento de linha de comando <c>-api http://127.0.0.1:3100</c>.
    /// </summary>
    public static class ApiConfig
    {
        public const string Producao = "https://api.rpglegend.com.br";

        /// <summary>O site, para o que o app ainda não faz (esqueci a senha).</summary>
        public const string Site = "https://rpglegend.com.br";

        /// <summary>Chave das preferências do Editor com o servidor escolhido no menu (vazia = produção).</summary>
        public const string EditorPrefsKey = "RPGLegend.ApiUrl";

        public static string BaseUrl
        {
            get
            {
                var args = Environment.GetCommandLineArgs();
                for (int i = 0; i < args.Length - 1; i++)
                    if (args[i] == "-api" && !string.IsNullOrWhiteSpace(args[i + 1])) return args[i + 1].TrimEnd('/');
#if UNITY_EDITOR
                var escolhido = UnityEditor.EditorPrefs.GetString(EditorPrefsKey, "");
                if (!string.IsNullOrWhiteSpace(escolhido)) return escolhido.TrimEnd('/');
#endif
                return Producao;
            }
        }
    }
}
