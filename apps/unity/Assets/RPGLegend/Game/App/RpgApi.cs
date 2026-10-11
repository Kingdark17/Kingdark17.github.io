using System;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace RPGLegend.Game.App
{
    /// <summary>Erro que a pessoa pode ler: a mensagem é a da API (as mesmas do site) ou uma nossa, em português.</summary>
    public sealed class ApiError : Exception
    {
        /// <summary>Código HTTP; 0 quando nem chegou no servidor.</summary>
        public readonly long Status;

        public ApiError(long status, string message) : base(message) { Status = status; }

        public bool SessaoInvalida => Status == 401;
    }

    public sealed class ApiUser
    {
        public string Username;
        public bool EmailVerified;
    }

    public sealed class ApiSession
    {
        public string Token;
        public ApiUser User;
    }

    /// <summary>O resumo de um personagem que a API tira do save (GET /api/characters).</summary>
    public sealed class CharacterSummary
    {
        public int Slot;
        public string UpdatedAt;
        public string Name;
        public string Race;
        public string ClassName;
        public int Level;
        public int Floor;
    }

    public sealed class CharacterList
    {
        public List<CharacterSummary> Characters = new List<CharacterSummary>();
        public int MaxSlots = 4;
    }

    /// <summary>
    /// As rotas da API que o app usa, as mesmas do site (<c>/api/account/*</c> e <c>/api/characters</c>). O app
    /// não é navegador: em vez do cookie, manda o token no cabeçalho <c>Authorization: Bearer</c>, que a API
    /// aceita (é o que ela devolve no corpo do login justamente para clientes assim).
    /// </summary>
    public static class RpgApi
    {
        private const int TimeoutSegundos = 20;

        public static async Awaitable<ApiSession> Entrar(string usuario, string senha)
        {
            var json = await Enviar("POST", "/api/account/login", new JObject { ["username"] = usuario, ["password"] = senha }, null);
            return LerSessao(json);
        }

        public static async Awaitable<ApiSession> Cadastrar(string usuario, string email, string senha)
        {
            var json = await Enviar("POST", "/api/account/register", new JObject { ["username"] = usuario, ["email"] = email, ["password"] = senha }, null);
            return LerSessao(json);
        }

        /// <summary>Quem é o dono do token (GET /api/account/me). Token vencido dá ApiError com SessaoInvalida.</summary>
        public static async Awaitable<ApiUser> Eu(string token)
        {
            var json = await Enviar("GET", "/api/account/me", null, token);
            return LerUsuario(json["user"]);
        }

        public static async Awaitable Sair(string token)
        {
            await Enviar("POST", "/api/account/logout", new JObject(), token);
        }

        public static async Awaitable<CharacterList> Personagens(string token)
        {
            var json = await Enviar("GET", "/api/characters", null, token);
            return LerPersonagens(json);
        }

        // ---------- leitura das respostas (sem Unity: dá para testar com JSON de exemplo) ----------

        public static ApiSession LerSessao(JObject json)
        {
            var token = (string)json["token"];
            if (string.IsNullOrEmpty(token)) throw new ApiError(500, "O servidor não devolveu a sessão. Tente de novo.");
            return new ApiSession { Token = token, User = LerUsuario(json["user"]) };
        }

        public static ApiUser LerUsuario(JToken user) => new ApiUser
        {
            Username = (string)user?["username"] ?? "",
            EmailVerified = user?["emailVerified"]?.Type == JTokenType.Boolean && (bool)user["emailVerified"],
        };

        public static CharacterList LerPersonagens(JObject json)
        {
            var lista = new CharacterList();
            if (json["maxSlots"]?.Type == JTokenType.Integer) lista.MaxSlots = (int)json["maxSlots"];
            if (json["characters"] is JArray personagens)
                foreach (var p in personagens)
                    lista.Characters.Add(new CharacterSummary
                    {
                        Slot = Inteiro(p["slot"], 0),
                        UpdatedAt = (string)p["updatedAt"] ?? "",
                        Name = (string)p["name"] ?? "",
                        Race = (string)p["race"] ?? "",
                        ClassName = (string)p["className"] ?? "",
                        Level = Inteiro(p["level"], 1),
                        Floor = Inteiro(p["floor"], 1),
                    });
            return lista;
        }

        private static int Inteiro(JToken t, int padrao) =>
            t != null && (t.Type == JTokenType.Integer || t.Type == JTokenType.Float) ? (int)(double)t : padrao;

        // ---------- HTTP ----------

        private static async Awaitable<JObject> Enviar(string metodo, string caminho, JObject corpo, string token)
        {
            using var req = new UnityWebRequest(ApiConfig.BaseUrl + caminho, metodo);
            req.downloadHandler = new DownloadHandlerBuffer();
            if (corpo != null)
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(corpo.ToString(Formatting.None)));
                req.SetRequestHeader("Content-Type", "application/json");
            }
            if (!string.IsNullOrEmpty(token)) req.SetRequestHeader("Authorization", "Bearer " + token);
            req.timeout = TimeoutSegundos;

            await req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.ConnectionError)
                throw new ApiError(0, "Sem conexão com o servidor. Confira a internet e tente de novo.");

            JObject json = null;
            var texto = req.downloadHandler.text;
            if (!string.IsNullOrWhiteSpace(texto))
            {
                try { json = JObject.Parse(texto); }
                catch (JsonException) { json = null; }
            }

            if (req.responseCode >= 400 || req.result != UnityWebRequest.Result.Success)
            {
                var mensagem = (string)json?["error"];
                throw new ApiError(req.responseCode, string.IsNullOrEmpty(mensagem) ? "O servidor respondeu com erro " + req.responseCode + ". Tente de novo." : mensagem);
            }
            return json ?? new JObject();
        }
    }
}
