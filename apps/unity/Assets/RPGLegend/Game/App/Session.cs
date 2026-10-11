using UnityEngine;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// A sessão guardada no aparelho, para quem já entrou não precisar digitar a senha de novo: o token e o nome
    /// de usuário, nas PlayerPrefs (no Android ficam na área privada do app; no Windows, no registro do usuário).
    /// Sair apaga. A senha nunca é guardada.
    /// </summary>
    public static class Session
    {
        private const string ChaveToken = "rpgLegend.token";
        private const string ChaveUsuario = "rpgLegend.usuario";

        public static string Token => PlayerPrefs.GetString(ChaveToken, "");

        public static string Username => PlayerPrefs.GetString(ChaveUsuario, "");

        public static bool Tem => !string.IsNullOrEmpty(Token);

        public static void Salvar(ApiSession sessao)
        {
            PlayerPrefs.SetString(ChaveToken, sessao.Token);
            PlayerPrefs.SetString(ChaveUsuario, sessao.User?.Username ?? "");
            PlayerPrefs.Save();
        }

        public static void AtualizarUsuario(ApiUser usuario)
        {
            PlayerPrefs.SetString(ChaveUsuario, usuario?.Username ?? "");
            PlayerPrefs.Save();
        }

        public static void Limpar()
        {
            PlayerPrefs.DeleteKey(ChaveToken);
            PlayerPrefs.DeleteKey(ChaveUsuario);
            PlayerPrefs.Save();
        }
    }
}
