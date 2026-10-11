using UnityEditor;
using UnityEngine;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// Toda imagem em Assets/RPGLegend/Art e Assets/RPGLegend/UI/Imagens é pixel art: entra como sprite, sem
    /// suavizar (Point), sem compressão e sem mipmap, com 1 pixel = 1 unidade do mundo. Assim a arte nova (a
    /// definitiva do Breno, com os mesmos nomes) já chega certa, sem ninguém mexer no Inspector.
    /// </summary>
    public sealed class PixelArtImporter : AssetPostprocessor
    {
        private static readonly string[] Pastas = { "Assets/RPGLegend/Art/", "Assets/RPGLegend/UI/Imagens/" };

        private void OnPreprocessTexture()
        {
            if (!EhPixelArt(assetPath)) return;
            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = 1;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.maxTextureSize = 2048;
        }

        private static bool EhPixelArt(string caminho)
        {
            foreach (var pasta in Pastas)
                if (caminho.StartsWith(pasta, System.StringComparison.Ordinal)) return true;
            return false;
        }
    }
}
