using Newtonsoft.Json.Linq;
using NUnit.Framework;
using RPGLegend.Game.App;

namespace RPGLegend.Tests
{
    /// <summary>O que o tempo real e os amigos do app leem e escrevem, sem rede: os pacotes do socket.io e as respostas da API.</summary>
    public class RedeTests
    {
        [Test]
        public void OEnderecoTrocaHttpPorWs()
        {
            Assert.AreEqual("wss://api.rpglegend.com.br/socket.io/?EIO=4&transport=websocket", SocketIo.Endereco("https://api.rpglegend.com.br"));
            Assert.AreEqual("ws://127.0.0.1:3100/socket.io/?EIO=4&transport=websocket", SocketIo.Endereco("http://127.0.0.1:3100/"));
        }

        [Test]
        public void OPacoteDeEventoLevaONomeEOCorpo()
        {
            Assert.AreEqual("42[\"auth\",{\"token\":\"abc\"}]", SocketIo.Pacote("auth", new JObject { ["token"] = "abc" }));
            Assert.AreEqual("42[\"sair\"]", SocketIo.Pacote("sair", null));
        }

        [Test]
        public void LeOEventoQueChega()
        {
            Assert.IsTrue(SocketIo.LerEvento("42[\"chat\",{\"from\":\"Tessa\",\"id\":\"17\",\"body\":\"oi, tudo bem?\",\"createdAt\":\"2026-11-15T21:04:00.000Z\"}]", out var evento, out var corpo));
            Assert.AreEqual("chat", evento);
            Assert.AreEqual("Tessa", (string)corpo["from"]);
            Assert.AreEqual("oi, tudo bem?", (string)corpo["body"]);
            // A data não vira data no caminho: fica o texto que o servidor mandou.
            Assert.AreEqual(JTokenType.String, corpo["createdAt"].Type);
            Assert.AreEqual("2026-11-15T21:04:00.000Z", (string)corpo["createdAt"]);
        }

        [Test]
        public void EventoSemCorpoETextoTortoNaoQuebram()
        {
            Assert.IsTrue(SocketIo.LerEvento("42[\"auth-error\"]", out var evento, out var corpo));
            Assert.AreEqual("auth-error", evento);
            Assert.IsNull(corpo);

            Assert.IsFalse(SocketIo.LerEvento("42[", out _, out _));
            Assert.IsFalse(SocketIo.LerEvento("42[17,{}]", out _, out _));
            Assert.IsFalse(SocketIo.LerEvento("40{\"sid\":\"x\"}", out _, out _));
            Assert.IsFalse(SocketIo.LerEvento("2", out _, out _));
            Assert.IsFalse(SocketIo.LerEvento(null, out _, out _));
        }

        [Test]
        public void AsListasDeAmizadeVemSeparadas()
        {
            var relacoes = RpgApi.LerRelacoes(JObject.Parse(@"{
                ""friends"": [{ ""username"": ""Tessa"", ""avatarUrl"": """", ""frame"": ""none"", ""nameColor"": ""#7fc4ff"", ""pet"": ""none"", ""online"": true }],
                ""incoming"": [{ ""username"": ""Lyra"", ""online"": false }, { ""online"": true }],
                ""outgoing"": []
            }"));

            Assert.AreEqual(1, relacoes.Amigos.Count);
            Assert.AreEqual("Tessa", relacoes.Amigos[0].Username);
            Assert.AreEqual("#7fc4ff", relacoes.Amigos[0].CorDoNome);
            Assert.IsTrue(relacoes.Amigos[0].Online);
            Assert.AreEqual(1, relacoes.Recebidos.Count, "pessoa sem nome não entra");
            Assert.AreEqual("", relacoes.Recebidos[0].CorDoNome);
            Assert.AreEqual(0, relacoes.Enviados.Count);
        }

        [Test]
        public void AConversaVemNaOrdemDoServidor()
        {
            var conversa = RpgApi.LerConversa(JObject.Parse(@"{ ""messages"": [
                { ""id"": ""41"", ""fromMe"": false, ""body"": ""bora masmorra?"", ""createdAt"": ""2026-11-15T21:04:00.000Z"" },
                { ""id"": ""42"", ""fromMe"": true, ""body"": ""bora"", ""createdAt"": ""2026-11-15T21:05:00.000Z"" }
            ] }"));

            Assert.AreEqual(2, conversa.Count);
            Assert.AreEqual("41", conversa[0].Id);
            Assert.IsFalse(conversa[0].Minha);
            Assert.AreEqual("bora masmorra?", conversa[0].Corpo);
            Assert.IsTrue(conversa[1].Minha);
            Assert.IsTrue(conversa[1].Quando.HasValue);
            Assert.AreEqual(0, RpgApi.LerConversa(new JObject()).Count);
        }
    }
}
