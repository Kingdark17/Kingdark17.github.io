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
        public void CatalogoTrazOsItensEOQueAContaJaTem()
        {
            var catalogo = RpgApi.LerCatalogo(JObject.Parse(@"{
                ""catalog"": [
                    { ""id"": ""frame_gold"", ""type"": ""frame"", ""value"": ""gold"", ""name"": ""Moldura Dourada"", ""icon"": ""🟡"", ""price"": 600 },
                    { ""id"": ""color_blue"", ""type"": ""color"", ""value"": ""#6ee7ff"", ""name"": ""Nome Azul"", ""icon"": ""🔵"", ""price"": 150 },
                    { ""id"": ""pet_fox"", ""type"": ""pet"", ""value"": ""fox"", ""name"": ""Raposa Astuta"", ""icon"": ""🦊"", ""price"": 900 },
                    { ""id"": ""pet_dragon"", ""type"": ""pet"", ""value"": ""dragon"", ""name"": ""Dragão"", ""icon"": ""🐉"", ""price"": 0, ""adminOnly"": true }
                ],
                ""owned"": { ""frames"": [""gold""], ""colors"": [], ""pets"": [""dragon""] }
            }"));

            Assert.AreEqual(4, catalogo.Itens.Count);
            var raposa = catalogo.Itens[2];
            Assert.AreEqual("pet", raposa.Tipo);
            Assert.AreEqual(900, raposa.Preco);
            Assert.IsFalse(raposa.SoDoAdm);
            Assert.IsTrue(catalogo.Itens[3].SoDoAdm);
            // O que a conta tem é pelo valor e pelo tipo: a cor "gold" não seria a moldura "gold".
            Assert.IsTrue(catalogo.Possui(catalogo.Itens[0]));
            Assert.IsFalse(catalogo.Possui(catalogo.Itens[1]));
            Assert.IsFalse(catalogo.Possui(raposa));
            Assert.IsTrue(catalogo.Possui(catalogo.Itens[3]));
        }

        [Test]
        public void CatalogoSemOwnedLeVazio()
        {
            var catalogo = RpgApi.LerCatalogo(JObject.Parse(@"{ ""catalog"": [{ ""id"": ""pet_cat"", ""type"": ""pet"", ""value"": ""cat"", ""name"": ""Gato"", ""icon"": ""🐈"", ""price"": 650 }] }"));
            Assert.AreEqual(1, catalogo.Itens.Count);
            Assert.IsFalse(catalogo.Possui(catalogo.Itens[0]));
        }

        [Test]
        public void UsuarioTrazOPet()
        {
            Assert.AreEqual("slime", RpgApi.LerUsuario(JObject.Parse(@"{ ""username"": ""a"", ""pet"": ""slime"" }")).Pet);
            Assert.AreEqual("", RpgApi.LerUsuario(JObject.Parse(@"{ ""username"": ""a"" }")).Pet);
        }
    }
}
