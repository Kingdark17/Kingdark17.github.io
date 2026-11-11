using System.IO;
using NUnit.Framework;
using RPGLegend.Game.App;

namespace RPGLegend.Tests
{
    /// <summary>A atualização do app de PC: comparar versões, ler o versao-pc.txt e conferir o instalador baixado.</summary>
    public class AtualizacaoTests
    {
        [TestCase("2026.11.11.1530", "2026.11.6.1920", true)]
        [TestCase("2026.11.6.1920", "2026.11.11.1530", false)]
        [TestCase("2026.11.11.1530", "2026.11.11.1530", false)]
        [TestCase("2026.11.11.905", "2026.11.11.1530", false)]
        [TestCase("2026.12.1.0", "2026.11.30.2359", true)]
        [TestCase("2026.11.11.1530", "1.0", true)]
        [TestCase("1.0.1", "1.0", true)]
        [TestCase("2026.11.11.1530", "", true)]
        [TestCase("<html>", "1.0", false)]
        [TestCase("", "1.0", false)]
        public void AVersaoMaisNovaGanhaParteAParte(string nova, string atual, bool esperado) =>
            Assert.AreEqual(esperado, Atualizacao.MaisNova(nova, atual));

        [Test]
        public void OArquivoDaVersaoDizAVersaoEOTamanho()
        {
            var versao = Atualizacao.Ler("2026.11.11.1530\r\n39091275\r\n");
            Assert.AreEqual("2026.11.11.1530", versao.Numero);
            Assert.AreEqual(39091275, versao.Tamanho);
            Assert.AreEqual(0, Atualizacao.Ler("2026.11.11.1530").Tamanho);
            Assert.IsNull(Atualizacao.Ler("<!DOCTYPE html>\nNot Found"));
            Assert.IsNull(Atualizacao.Ler(""));
            Assert.IsNull(Atualizacao.Ler(null));
        }

        [Test]
        public void OInstaladorBaixadoPrecisaSerExecutavelEDoTamanhoPublicado()
        {
            var arquivo = Path.Combine(Path.GetTempPath(), "rpglegend-teste-de-atualizacao.bin");
            try
            {
                File.WriteAllBytes(arquivo, new byte[] { (byte)'M', (byte)'Z', 1, 2, 3 });
                Assert.IsTrue(Atualizacao.Confere(arquivo, new Atualizacao.Versao { Numero = "1.0", Tamanho = 5 }));
                Assert.IsTrue(Atualizacao.Confere(arquivo, new Atualizacao.Versao { Numero = "1.0", Tamanho = 0 }));
                Assert.IsFalse(Atualizacao.Confere(arquivo, new Atualizacao.Versao { Numero = "1.0", Tamanho = 6 }));
                File.WriteAllText(arquivo, "<html>erro</html>");
                Assert.IsFalse(Atualizacao.Confere(arquivo, null));
                File.Delete(arquivo);
                Assert.IsFalse(Atualizacao.Confere(arquivo, null));
            }
            finally
            {
                if (File.Exists(arquivo)) File.Delete(arquivo);
            }
        }
    }
}
