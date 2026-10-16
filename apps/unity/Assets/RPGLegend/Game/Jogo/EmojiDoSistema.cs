using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;
using UnityEngine.TextCore.Text;
using FontAsset = UnityEngine.TextCore.Text.FontAsset;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O emoji colorido do próprio aparelho, como o site usa o do navegador: o jogo escreve 🧰, ⚔️, 🧙 em avisos,
    /// salas e NPCs. No texto das telas (UI Toolkit) a Unity 6.6 já usa o emoji do sistema sozinha. A cena da sala
    /// é desenhada com sprites, e é pra ela que serve isto: a fonte de emoji do sistema (Noto ou Samsung no Android,
    /// Segoe UI Emoji no Windows) vira uma FontAsset colorida em tempo de execução, e cada emoji vira um sprite.
    /// Sem fonte de emoji no aparelho, a sala usa só as artes.
    /// </summary>
    public static class EmojiDoSistema
    {
        private static readonly string[] Familias = { "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", "Samsung Color Emoji" };

        private static readonly string[] ArquivosNoAndroid =
        {
            "/system/fonts/NotoColorEmoji.ttf", "/system/fonts/SamsungColorEmoji.ttf", "/system/fonts/NotoColorEmojiLegacy.ttf",
        };

        private static FontAsset _fonte;
        private static bool _tentou;
        private static readonly Dictionary<int, Sprite> Sprites = new Dictionary<int, Sprite>();

        /// <summary>A fonte de emoji do aparelho, ou null se ele não tem uma que a Unity consiga ler.</summary>
        public static FontAsset Fonte
        {
            get
            {
                if (!_tentou)
                {
                    _tentou = true;
                    _fonte = Criar();
                    if (_fonte == null) Debug.LogWarning("Emoji: nenhuma fonte de emoji do sistema foi encontrada.");
                }
                return _fonte;
            }
        }

        private static FontAsset Criar()
        {
            foreach (var familia in Familias)
            {
                var fonte = FontAsset.CreateFontAsset(familia, "Regular", 64, 4, GlyphRenderMode.COLOR);
                if (fonte != null) return fonte;
            }
            foreach (var arquivo in ArquivosNoAndroid)
            {
                if (!File.Exists(arquivo)) continue;
                var fonte = FontAsset.CreateFontAsset(arquivo, 0, 64, 4, GlyphRenderMode.COLOR, 1024, 1024);
                if (fonte != null) return fonte;
            }
            return null;
        }

        /// <summary>
        /// O emoji como sprite (o primeiro caractere dele, sem o seletor de variação), ancorado no pé. Null se não
        /// há fonte de emoji ou se ela não tem esse.
        /// </summary>
        public static Sprite Sprite(string emoji)
        {
            if (string.IsNullOrEmpty(emoji)) return null;
            int codigo = char.ConvertToUtf32(emoji, 0);
            if (Sprites.TryGetValue(codigo, out var pronto)) return pronto;

            var fonte = Fonte;
            if (fonte == null) return null;
            // A fonte do sistema vem no modo DynamicOS: a sobrecarga com uint[] recusa o caractere nesse modo (testado
            // no Unity 6.6), e a com string desenha o glifo no atlas. Ela não faz nada se ele já está lá.
            fonte.TryAddCharacters(char.ConvertFromUtf32(codigo), out string _);
            // A tabela de caracteres está marcada como obsoleta no Unity 6.6, mas é o único caminho até o retângulo
            // do glifo no atlas, que o sprite precisa (TryGetGlyphMetrics só dá as medidas). Quando a Unity a tirar,
            // isto deixa de compilar — não falha escondido.
#pragma warning disable CS0618
            if (!fonte.characterLookupTable.TryGetValue((uint)codigo, out var caractere)) return null;
#pragma warning restore CS0618

            var glifo = caractere.glyph;
            var atlas = fonte.atlasTextures[glifo.atlasIndex];
            var r = glifo.glyphRect;
            if (atlas == null || r.width <= 0 || r.height <= 0) return null;
            var sprite = UnityEngine.Sprite.Create(atlas, new Rect(r.x, r.y, r.width, r.height), new Vector2(0.5f, 0f), 1f);
            sprite.name = "emoji-" + codigo.ToString("X");
            Sprites[codigo] = sprite;
            return sprite;
        }
    }
}
