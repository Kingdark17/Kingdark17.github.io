using Newtonsoft.Json.Linq;
using NUnit.Framework;
using RPGLegend.Game.App;

namespace RPGLegend.Tests
{
    /// <summary>A leitura das respostas da API que o app usa (RpgApi), com JSON no formato do servidor.</summary>
    public class RespostasDaApiTests
    {
        [Test]
        public void ListaTrazORetratoEAData()
        {
            var lista = RpgApi.LerPersonagens(JObject.Parse(@"{
                ""maxSlots"": 4,
                ""characters"": [{
                    ""slot"": 2, ""updatedAt"": ""2026-10-16T19:39:00.000Z"", ""name"": ""Tessa"", ""race"": ""Elfo"", ""raceId"": ""elfo"",
                    ""raceIcon"": ""🧝"", ""className"": ""Aprendiz"", ""classIcon"": ""🎒"", ""hair"": ""longo"", ""level"": 1, ""floor"": 1,
                    ""equip"": { ""arma"": ""cajado"", ""armadura"": null, ""elmo"": ""robe_chapeu"" }
                }]
            }"));

            var tessa = lista.Characters[0];
            Assert.AreEqual(2, tessa.Slot);
            Assert.AreEqual("elfo", tessa.RaceId);
            Assert.AreEqual("longo", tessa.Hair);
            // O JObject.Parse já lê a data ISO como data: o texto não pode sumir no caminho.
            Assert.IsNotEmpty(tessa.UpdatedAt);
            Assert.AreEqual("cajado", tessa.Equip["arma"]);
            Assert.AreEqual("robe_chapeu", tessa.Equip["elmo"]);
            Assert.IsFalse(tessa.Equip.ContainsKey("armadura"), "slot vazio não vira peça");
        }

        [Test]
        public void SaveAntigoSemOsCamposNovosLeVazio()
        {
            var lista = RpgApi.LerPersonagens(JObject.Parse(@"{ ""characters"": [{ ""slot"": 1, ""name"": ""Lyra"", ""race"": ""Elfo"", ""level"": 3 }] }"));
            var lyra = lista.Characters[0];
            Assert.AreEqual("", lyra.RaceId);
            Assert.AreEqual("", lyra.Hair);
            Assert.AreEqual(0, lyra.Equip.Count);
            Assert.AreEqual(1, lyra.Floor);
        }

        [Test]
        public void UsuarioTrazOPet()
        {
            Assert.AreEqual("slime", RpgApi.LerUsuario(JObject.Parse(@"{ ""username"": ""a"", ""pet"": ""slime"" }")).Pet);
            Assert.AreEqual("", RpgApi.LerUsuario(JObject.Parse(@"{ ""username"": ""a"" }")).Pet);
        }
    }
}
