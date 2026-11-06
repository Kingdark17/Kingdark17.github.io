using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Atualizar ícone do app": o ícone do app é o brasão do menu (UI/Imagens/logo.png, o mesmo da aba
    /// do site). Gera a partir dele, em Assets/RPGLegend/Icone:
    /// - icone.png, 1024 × 1024 e fundo transparente: o ícone padrão, que vira o do executável do PC (e o do
    ///   celular antigo, sem ícone adaptável);
    /// - icone-frente.png e icone-fundo.png, 432 × 432: o ícone adaptável do Android (8 em diante), o brasão em
    ///   cima do fundo escuro das telas, inteiro dentro do círculo que nenhuma máscara de aparelho corta;
    /// e Instalador/icone.ico, o do instalador do PC. Depois põe os ícones nas configurações do projeto. Logo nova
    /// (a do Breno, com o mesmo nome) → rodar de novo.
    /// </summary>
    public static class IconeDoApp
    {
        private const string Logo = "Assets/RPGLegend/UI/Imagens/logo.png";
        private const string Pasta = "Assets/RPGLegend/Icone";

        /// <summary>O --ink do Tema.uss, o fundo das telas do app.</summary>
        private static readonly Color Fundo = new Color32(0x10, 0x12, 0x1a, 0xff);

        /// <summary>Quanto do lado o brasão ocupa no ícone padrão e no do instalador.</summary>
        private const float OcupaNoPadrao = 0.94f;

        /// <summary>O círculo seguro do ícone adaptável: 66 dp de diâmetro num quadrado de 108 dp.</summary>
        private const float CirculoSeguro = 66f / 108f;

        private static readonly int[] LadosDoIco = { 16, 24, 32, 48, 64, 128, 256 };

        [MenuItem("RPG Legend/Atualizar ícone do app", priority = 200)]
        public static void Atualizar()
        {
            var logo = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            logo.LoadImage(File.ReadAllBytes(Logo));
            var pixels = logo.GetPixels();
            var recorte = Recorte(pixels, logo.width, logo.height);

            // O brasão inteiro dentro do círculo seguro: o pixel mais longe do meio do recorte fica na borda dele.
            var raio = RaioDoDesenho(pixels, logo.width, recorte);

            Directory.CreateDirectory(Pasta);
            var padrao = Gravar("icone.png", Desenhar(pixels, logo.width, recorte, 1024, OcupaNoPadrao * 1024 / Math.Max(recorte.width, recorte.height), Color.clear));
            var frente = Gravar("icone-frente.png", Desenhar(pixels, logo.width, recorte, 432, CirculoSeguro * 432 / 2 / raio, Color.clear));
            var fundo = Gravar("icone-fundo.png", Desenhar(pixels, logo.width, recorte, 432, 0, Fundo));

            var ico = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Instalador", "icone.ico");
            GravarIco(ico, LadosDoIco.Select(lado => Desenhar(pixels, logo.width, recorte, lado, OcupaNoPadrao * lado / Math.Max(recorte.width, recorte.height), Color.clear)).ToList());

            PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { padrao }, IconKind.Any);
            var adaptavel = PlayerSettings.GetSupportedIconKinds(NamedBuildTarget.Android).First(k => k.ToString().Contains("Adaptive"));
            var icones = PlayerSettings.GetPlatformIcons(NamedBuildTarget.Android, adaptavel);
            foreach (var icone in icones) icone.SetTextures(fundo, frente);
            PlayerSettings.SetPlatformIcons(NamedBuildTarget.Android, adaptavel, icones);
            AssetDatabase.SaveAssets();
            Debug.Log("Ícone do app: " + Pasta + " (padrão, frente e fundo do adaptável) e " + ico + " (instalador).");
        }

        /// <summary>O retângulo que tem desenho (alfa acima de zero).</summary>
        private static RectInt Recorte(Color[] pixels, int largura, int altura)
        {
            int x0 = largura, y0 = altura, x1 = -1, y1 = -1;
            for (int y = 0; y < altura; y++)
            for (int x = 0; x < largura; x++)
            {
                if (pixels[y * largura + x].a <= 0) continue;
                x0 = Math.Min(x0, x);
                y0 = Math.Min(y0, y);
                x1 = Math.Max(x1, x);
                y1 = Math.Max(y1, y);
            }
            return new RectInt(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        }

        /// <summary>A distância do meio do recorte até o canto mais longe de um pixel com desenho.</summary>
        private static float RaioDoDesenho(Color[] pixels, int largura, RectInt recorte)
        {
            var meio = recorte.center;
            float maior = 0;
            for (int y = recorte.yMin; y < recorte.yMax; y++)
            for (int x = recorte.xMin; x < recorte.xMax; x++)
            {
                if (pixels[y * largura + x].a <= 0) continue;
                var dx = Math.Max(Math.Abs(x - meio.x), Math.Abs(x + 1 - meio.x));
                var dy = Math.Max(Math.Abs(y - meio.y), Math.Abs(y + 1 - meio.y));
                maior = Math.Max(maior, dx * dx + dy * dy);
            }
            return Mathf.Sqrt(maior);
        }

        /// <summary>
        /// O recorte numa imagem de lado × lado, centrado, com <paramref name="escala"/> pixels de saída por pixel do
        /// brasão (0: só o fundo), sobre <paramref name="fundo"/>. Crescer repete o pixel (é pixel art); encolher tira a
        /// média da área coberta, pesada pelo alfa, para o ícone pequeno não ficar picotado.
        /// </summary>
        private static Texture2D Desenhar(Color[] pixels, int largura, RectInt recorte, int lado, float escala, Color fundo)
        {
            var saida = new Color[lado * lado];
            var ox = (lado - recorte.width * escala) / 2;
            var oy = (lado - recorte.height * escala) / 2;
            for (int y = 0; y < lado; y++)
            for (int x = 0; x < lado; x++)
            {
                var cor = escala > 0 ? Amostra(pixels, largura, recorte, (x - ox) / escala, (x + 1 - ox) / escala, (y - oy) / escala, (y + 1 - oy) / escala) : Color.clear;
                var alfa = cor.a + fundo.a * (1 - cor.a);
                var rgb = alfa > 0 ? ((Vector4)cor * cor.a + (Vector4)fundo * fundo.a * (1 - cor.a)) / alfa : Vector4.zero;
                saida[y * lado + x] = new Color(rgb.x, rgb.y, rgb.z, alfa);
            }
            var textura = new Texture2D(lado, lado, TextureFormat.RGBA32, false);
            textura.SetPixels(saida);
            textura.Apply();
            return textura;
        }

        /// <summary>A cor do trecho [x0, x1) × [y0, y1) do recorte, em pixels do brasão a partir do canto dele.</summary>
        private static Color Amostra(Color[] pixels, int largura, RectInt recorte, float x0, float x1, float y0, float y1)
        {
            if (x1 - x0 <= 1)
            {
                // Crescendo: o pixel do meio do trecho.
                int px = Mathf.FloorToInt((x0 + x1) / 2), py = Mathf.FloorToInt((y0 + y1) / 2);
                return Pixel(pixels, largura, recorte, px, py);
            }
            float peso = 0, alfa = 0;
            var soma = Vector4.zero;
            for (int py = Mathf.FloorToInt(y0); py < Mathf.CeilToInt(y1); py++)
            for (int px = Mathf.FloorToInt(x0); px < Mathf.CeilToInt(x1); px++)
            {
                var w = (Math.Min(px + 1, x1) - Math.Max(px, x0)) * (Math.Min(py + 1, y1) - Math.Max(py, y0));
                var c = Pixel(pixels, largura, recorte, px, py);
                soma += (Vector4)c * c.a * w;
                alfa += c.a * w;
                peso += w;
            }
            if (alfa <= 0) return Color.clear;
            var rgb = soma / alfa;
            return new Color(rgb.x, rgb.y, rgb.z, alfa / peso);
        }

        private static Color Pixel(Color[] pixels, int largura, RectInt recorte, int x, int y) =>
            x < 0 || y < 0 || x >= recorte.width || y >= recorte.height ? Color.clear : pixels[(recorte.y + y) * largura + recorte.x + x];

        /// <summary>Grava a imagem em Assets/RPGLegend/Icone e a importa como textura comum, sem suavizar nem comprimir.</summary>
        private static Texture2D Gravar(string nome, Texture2D imagem)
        {
            var caminho = Pasta + "/" + nome;
            File.WriteAllBytes(caminho, imagem.EncodeToPNG());
            AssetDatabase.ImportAsset(caminho, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(caminho);
            importer.textureType = TextureImporterType.Default;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.maxTextureSize = 2048;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(caminho);
        }

        /// <summary>
        /// Um .ico com uma imagem por tamanho: a de 256 em PNG, e as menores em bitmap, que todo programa lê (o PNG
        /// nelas vira ruído em quem só conhece o formato antigo).
        /// </summary>
        private static void GravarIco(string caminho, IList<Texture2D> imagens)
        {
            var pngs = imagens.Select(t => t.width >= 256 ? t.EncodeToPNG() : Bitmap(t)).ToList();
            Directory.CreateDirectory(Path.GetDirectoryName(caminho));
            using (var w = new BinaryWriter(File.Create(caminho)))
            {
                w.Write((ushort)0);
                w.Write((ushort)1);
                w.Write((ushort)pngs.Count);
                var deslocamento = 6 + 16 * pngs.Count;
                for (int i = 0; i < pngs.Count; i++)
                {
                    var lado = imagens[i].width;
                    w.Write((byte)(lado >= 256 ? 0 : lado));
                    w.Write((byte)(lado >= 256 ? 0 : lado));
                    w.Write((byte)0);
                    w.Write((byte)0);
                    w.Write((ushort)1);
                    w.Write((ushort)32);
                    w.Write(pngs[i].Length);
                    w.Write(deslocamento);
                    deslocamento += pngs[i].Length;
                }
                foreach (var png in pngs) w.Write(png);
            }
        }

        /// <summary>
        /// A imagem como entrada de bitmap do .ico: o cabeçalho, as cores em BGRA de baixo pra cima (a ordem do
        /// GetPixels32) e a máscara de 1 bit (1 = transparente), cada linha completada até 32 bits.
        /// </summary>
        private static byte[] Bitmap(Texture2D imagem)
        {
            int lado = imagem.width;
            var cores = imagem.GetPixels32();
            var linhaDaMascara = (lado + 31) / 32 * 4;
            using (var memoria = new MemoryStream())
            using (var w = new BinaryWriter(memoria))
            {
                w.Write(40);
                w.Write(lado);
                w.Write(lado * 2);
                w.Write((ushort)1);
                w.Write((ushort)32);
                w.Write(0);
                w.Write(lado * lado * 4 + linhaDaMascara * lado);
                w.Write(0);
                w.Write(0);
                w.Write(0);
                w.Write(0);
                foreach (var c in cores)
                {
                    w.Write(c.b);
                    w.Write(c.g);
                    w.Write(c.r);
                    w.Write(c.a);
                }
                for (int y = 0; y < lado; y++)
                {
                    var linha = new byte[linhaDaMascara];
                    for (int x = 0; x < lado; x++)
                        if (cores[y * lado + x].a == 0) linha[x / 8] |= (byte)(0x80 >> (x % 8));
                    w.Write(linha);
                }
                return memoria.ToArray();
            }
        }
    }
}
