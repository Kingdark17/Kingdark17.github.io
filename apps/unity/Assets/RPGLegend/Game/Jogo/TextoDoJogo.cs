using System.Text;
using System.Text.RegularExpressions;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// Os textos da engine vêm com <c>&lt;b&gt;</c> no meio (nome do monstro, nome do item), como no site
    /// (apps/web/app/jogo/texto-do-jogo.tsx). Aqui o negrito vira o negrito do texto rico da Unity e todo o resto
    /// fica dentro de <c>&lt;noparse&gt;</c>: o mapa e o save vêm da rede, e uma marcação solta (tamanho, cor, link)
    /// não pode mudar a tela.
    /// </summary>
    public static class TextoDoJogo
    {
        private static readonly Regex Negrito = new Regex("<b>(.*?)</b>", RegexOptions.Singleline);
        private static readonly Regex FimDoNoparse = new Regex("</?noparse>", RegexOptions.IgnoreCase);

        public static string ParaTela(string texto)
        {
            if (string.IsNullOrEmpty(texto)) return "";
            var saida = new StringBuilder();
            int fimAnterior = 0;
            foreach (Match achado in Negrito.Matches(texto))
            {
                if (achado.Index > fimAnterior) Literal(saida, texto.Substring(fimAnterior, achado.Index - fimAnterior));
                saida.Append("<b>");
                Literal(saida, achado.Groups[1].Value);
                saida.Append("</b>");
                fimAnterior = achado.Index + achado.Length;
            }
            if (fimAnterior < texto.Length) Literal(saida, texto.Substring(fimAnterior));
            return saida.ToString();
        }

        private static void Literal(StringBuilder saida, string parte)
        {
            if (parte.Length == 0) return;
            saida.Append("<noparse>").Append(FimDoNoparse.Replace(parte, "")).Append("</noparse>");
        }
    }
}
