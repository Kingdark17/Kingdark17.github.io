using NUnit.Framework;
using RPGLegend.Engine;
using RPGLegend.Game.Jogo;

namespace RPGLegend.Tests
{
    /// <summary>
    /// As peças das telas de sala do app que não têm par na engine: o número no jeito do site e a pilha de camadas
    /// do boneco (port de apps/web/lib/paperdoll/camadas.ts, a ordem do doc do Breno — camadas.test.ts confere o
    /// mesmo do lado do site).
    /// </summary>
    public class TelasDoAppTests
    {
        [OneTimeSetUp]
        public void CarregarTabelas() => RPGLegend.Game.GameBootstrap.EnsureLoaded();

        [TestCase(0.3, "0,3")]
        [TestCase(11, "11")]
        [TestCase(1234.5, "1.234,5")]
        [TestCase(2.25, "2,3")]
        [TestCase(-2, "-2")]
        [TestCase(0.30000000000000004, "0,3")]
        public void NumeroComVirgulaDecimalEPontoNoMilhar(double valor, string esperado) =>
            Assert.AreEqual(esperado, PecasDaTela.Numero(valor));

        private static Hero Heroi(string raca, string hair = null, params (string slot, string templateId)[] pecas)
        {
            var equip = new Equipment();
            foreach (var (slot, templateId) in pecas) equip.Set(slot, new Item { TemplateId = templateId });
            return new Hero { RaceId = raca, Hair = hair, Equip = equip };
        }

        [Test]
        public void AsPecasDividemOCorpoComoNoDocDoBreno()
        {
            var camadas = Paperdoll.Camadas(Heroi("humano", null, ("armadura", "robe"), ("elmo", "robe_chapeu"), ("arma", "cajado")));
            CollectionAssert.AreEqual(new[]
            {
                "hadd/robe_chapeu", "badd/robe", "corpo/humano", "base/calca", "base/roupa", "armadura/robe",
                "cabelo/curto", "elmo/robe_chapeu", "arma/cajado",
            }, camadas);
        }

        [Test]
        public void FelinoSemCabeloComCaudaEOrelhasPorCimaDoElmo()
        {
            var camadas = Paperdoll.Camadas(Heroi("felino", "longo", ("elmo", "placas_elmo")));
            CollectionAssert.AreEqual(new[]
            {
                "back/felino", "corpo/felino", "base/calca", "base/roupa", "elmo/placas_elmo", "traco/orelhas-de-gato",
            }, camadas);
        }

        [Test]
        public void PecaSemArteNaoDesenhaECabeloInvalidoVoltaAoPadrao()
        {
            // A marreta não tem arte de boneco (é o caso da maioria das armas no site também).
            var camadas = Paperdoll.Camadas(Heroi("orc", "moicano", ("arma", "marreta")));
            CollectionAssert.AreEqual(new[] { "corpo/orc", "base/calca", "base/roupa", "cabelo/curto" }, camadas);
        }

        [Test]
        public void RacaSemCorpoDesenhadoNaoTemCamada() =>
            Assert.IsEmpty(Paperdoll.Camadas(Heroi("anao")));
    }
}
