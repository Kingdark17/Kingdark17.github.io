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
        /// <summary>O pet da conta (id da loja de cosméticos), ou "none".</summary>
        public string Pet;
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
        /// <summary>Só os saves novos têm; os antigos gravaram a raça pelo nome (<see cref="Race"/>).</summary>
        public string RaceId;
        public string RaceIcon;
        public string ClassName;
        public string ClassIcon;
        public string Hair;
        public int Level;
        public int Floor;
        /// <summary>O templateId do que está em cada slot (arma, armadura…), pro boneco do retrato.</summary>
        public Dictionary<string, string> Equip = new Dictionary<string, string>();
    }

    public sealed class CharacterList
    {
        public List<CharacterSummary> Characters = new List<CharacterSummary>();
        public int MaxSlots = 4;
    }

    /// <summary>O save de um slot na nuvem (GET /api/save). <see cref="Save"/> é null quando o slot está vazio.</summary>
    public sealed class SaveNaNuvem
    {
        public JToken Save;
        /// <summary>A assinatura oficial: vira a baseSignature da próxima gravação.</summary>
        public string Signature;
    }

    /// <summary>Um item da loja de cosméticos (GET /api/account/profile/catalog).</summary>
    public sealed class ItemDeCosmetico
    {
        public string Id;
        /// <summary>"pet", "frame" ou "color".</summary>
        public string Tipo;
        /// <summary>O que a conta guarda quando tem o item: o id do pet, da moldura, ou a cor.</summary>
        public string Valor;
        public string Nome;
        public string Icone;
        public int Preco;
        public bool SoDoAdm;
    }

    /// <summary>A vitrine e o que a conta já tem (owned), que decide entre "Comprar" e "já é seu".</summary>
    public sealed class CatalogoDaLoja
    {
        public List<ItemDeCosmetico> Itens = new List<ItemDeCosmetico>();
        public List<string> Molduras = new List<string>();
        public List<string> Cores = new List<string>();
        public List<string> Pets = new List<string>();

        public bool Possui(ItemDeCosmetico item) =>
            (item.Tipo == "frame" ? Molduras : item.Tipo == "color" ? Cores : Pets).Contains(item.Valor);
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

        /// <summary>O save do slot, como o site carrega (GET /api/save?slot=N).</summary>
        public static async Awaitable<SaveNaNuvem> CarregarSave(string token, int slot)
        {
            var json = await Enviar("GET", "/api/save?slot=" + slot, null, token);
            var save = json["save"];
            return new SaveNaNuvem { Save = save == null || save.Type == JTokenType.Null ? null : save, Signature = (string)json["signature"] ?? "" };
        }

        /// <summary>
        /// Grava o save do slot (PUT /api/save), como o site: <paramref name="baseSignature"/> é a assinatura do save
        /// carregado por último, e o servidor recusa (409) se ela não for a atual. Devolve a assinatura nova.
        /// </summary>
        public static async Awaitable<string> GravarSave(string token, int slot, JToken save, string baseSignature)
        {
            var corpo = new JObject { ["slot"] = slot, ["save"] = save, ["source"] = "game", ["baseSignature"] = baseSignature ?? "" };
            var json = await Enviar("PUT", "/api/save", corpo, token);
            var assinatura = (string)json["signature"];
            if (string.IsNullOrEmpty(assinatura)) throw new ApiError(500, "O servidor não devolveu a assinatura do save. Tente de novo.");
            return assinatura;
        }

        /// <summary>Apaga o personagem do slot (POST /api/save/reset), como o "Sim, apagar" do site.</summary>
        public static async Awaitable ApagarPersonagem(string token, int slot)
        {
            await Enviar("POST", "/api/save/reset", new JObject { ["slot"] = slot }, token);
        }

        /// <summary>A loja de cosméticos, com o que a conta já tem (GET /api/account/profile/catalog).</summary>
        public static async Awaitable<CatalogoDaLoja> Catalogo(string token) =>
            LerCatalogo(await Enviar("GET", "/api/account/profile/catalog", null, token));

        /// <summary>
        /// Compra o item com o ouro do personagem do slot (POST /api/account/profile/purchase). O servidor desconta o ouro
        /// daquele save e devolve o save novo e a assinatura: quem tivesse a partida aberta precisaria adotar os dois, mas
        /// a loja do app só abre pelo menu, com nenhuma partida aberta.
        /// </summary>
        public static async Awaitable ComprarCosmetico(string token, string id, int slot)
        {
            await Enviar("POST", "/api/account/profile/purchase", new JObject { ["id"] = id, ["slot"] = slot }, token);
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
            Pet = Texto(user?["pet"]),
        };

        public static CharacterList LerPersonagens(JObject json)
        {
            var lista = new CharacterList();
            if (json["maxSlots"]?.Type == JTokenType.Integer) lista.MaxSlots = (int)json["maxSlots"];
            if (json["characters"] is JArray personagens)
                foreach (var p in personagens)
                {
                    var resumo = new CharacterSummary
                    {
                        Slot = Inteiro(p["slot"], 0),
                        // O JObject.Parse já transforma a data ISO em data: o cast devolve o texto.
                        UpdatedAt = (string)p["updatedAt"] ?? "",
                        Name = Texto(p["name"]),
                        Race = Texto(p["race"]),
                        RaceId = Texto(p["raceId"]),
                        RaceIcon = Texto(p["raceIcon"]),
                        ClassName = Texto(p["className"]),
                        ClassIcon = Texto(p["classIcon"]),
                        Hair = Texto(p["hair"]),
                        Level = Inteiro(p["level"], 1),
                        Floor = Inteiro(p["floor"], 1),
                    };
                    if (p["equip"] is JObject equip)
                        foreach (var slot in equip.Properties())
                            if (slot.Value.Type == JTokenType.String) resumo.Equip[slot.Name] = (string)slot.Value;
                    lista.Characters.Add(resumo);
                }
            return lista;
        }

        public static CatalogoDaLoja LerCatalogo(JObject json)
        {
            var catalogo = new CatalogoDaLoja();
            if (json["catalog"] is JArray itens)
                foreach (var i in itens)
                    catalogo.Itens.Add(new ItemDeCosmetico
                    {
                        Id = Texto(i["id"]),
                        Tipo = Texto(i["type"]),
                        Valor = Texto(i["value"]),
                        Nome = Texto(i["name"]),
                        Icone = Texto(i["icon"]),
                        Preco = Inteiro(i["price"], 0),
                        SoDoAdm = i["adminOnly"]?.Type == JTokenType.Boolean && (bool)i["adminOnly"],
                    });
            var dono = json["owned"];
            Textos(dono?["frames"], catalogo.Molduras);
            Textos(dono?["colors"], catalogo.Cores);
            Textos(dono?["pets"], catalogo.Pets);
            return catalogo;
        }

        private static void Textos(JToken lista, List<string> destino)
        {
            if (!(lista is JArray itens)) return;
            foreach (var t in itens)
                if (t.Type == JTokenType.String) destino.Add((string)t);
        }

        private static string Texto(JToken t) => t != null && t.Type == JTokenType.String ? (string)t : "";

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
