using NUnit.Framework;
using RPGLegend.Game.Jogo;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Os efeitos da luta: toda folha que o jogo pede existe, tem os quadros do índice e cabe neles. Os nomes são
    /// os que a TelaDeJogo toca; o índice e as folhas saem de apps/unity/Efeitos~/exporta.mjs.
    /// </summary>
    public class EfeitosTests
    {
        /// <summary>Os nomes que a TelaDeJogo e o PalcoDaLuta tocam.</summary>
        private static readonly string[] Nomes =
        {
            "golpe",
            "golpe-critico",
            "golpe-no-heroi",
            "poder-fisico",
            "fogo",
            "fogo-pequeno",
            "gelo",
            "gelo-pequeno",
            "luz",
            "sombra",
            "veneno",
            "raio",
            "som",
            "sangue",
            "estouro",
            "reforco-forca",
            "reforco-precisao",
            "reforco-esquiva",
            "reforco-escudo",
            "reforco-critico",
            "reforco-grupo",
            "atordoado",
            "lento",
            "desvio",
            "escudo",
            "vampiro",
            "cura",
            "esqueleto",
            "queda",
            "poeira",
            "poeira-grande",
            "onda",
        };

        [TestCaseSource(nameof(Nomes))]
        public void AFolhaExisteEOsQuadrosCabemNela(string nome)
        {
            var folha = Efeitos.Pegar(nome);
            Assert.IsNotNull(folha, nome + " não está no efeitos.json ou não tem a folha");
            Assert.AreEqual(folha.Dados.quadros, folha.Quadros.Length);
            Assert.Greater(folha.Dados.fps, 0f);
            var textura = folha.Quadros[0].texture;
            int linhas = (folha.Dados.quadros + folha.Dados.colunas - 1) / folha.Dados.colunas;
            Assert.LessOrEqual(folha.Dados.colunas * folha.Dados.largura, textura.width);
            Assert.LessOrEqual(linhas * folha.Dados.altura, textura.height);
        }

        [Test]
        public void EfeitoQueNaoExisteNaoQuebra() => Assert.IsNull(Efeitos.Pegar("nao-existe"));
    }
}
