using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace RPGLegend.Game.App
{
    /// <summary>Uma mensagem de amigo que chegou com o app aberto.</summary>
    public sealed class MensagemRecebida
    {
        public string De, Id, Corpo;
    }

    /// <summary>Um amigo chamando pra sala dele.</summary>
    public sealed class Convite
    {
        public string De, Codigo, NomeDoAnfitriao;
    }

    /// <summary>Onde a pessoa está em relação à sala do co-op.</summary>
    public enum FaseDaSala
    {
        /// <summary>Sem sala.</summary>
        Fora,
        /// <summary>Pediu pra criar ou entrar, e o servidor ainda não respondeu.</summary>
        Entrando,
        /// <summary>Na sala, antes de a aventura abrir.</summary>
        Esperando,
        /// <summary>Com a aventura aberta (chegou ou saiu um estado do jogo).</summary>
        Jogando,
    }

    /// <summary>
    /// A sessão de tempo real do app: o espelho de <c>apps/web/lib/rede/sala.ts</c>. Uma conexão só, que vive do
    /// menu até sair da conta e sobrevive à troca de telas; quem quer ouvir assina os eventos.
    ///
    /// A identidade vai no evento <c>auth</c> com o token da sessão (o site manda o cookie; o gateway aceita os
    /// dois). Se a conexão cai, tenta de novo sozinha a cada poucos segundos enquanto houver sessão, e volta pra
    /// sala em que estava (<c>rejoin</c>).
    ///
    /// A sala do co-op: o papel 1 cria e conduz, o 2 acompanha; se o 1 cai, o servidor promove quem ficou
    /// (<c>role-changed</c>). Toda sala aberta aqui vai marcada como do app (<c>app: true</c>): o co-op do app é em
    /// tempo real e o do site por turnos, e o servidor não deixa os dois se misturarem.
    ///
    /// O que chega da rede é de outro jogador: fica em JSON, e quem usa lê campo a campo.
    /// </summary>
    public static class Rede
    {
        public const int Anfitriao = 1;
        public const int Convidado = 2;

        /// <summary>De quanto em quanto tempo tenta voltar depois de cair.</summary>
        private const float EsperaParaVoltar = 4f;

        /// <summary>Chegou uma mensagem de um amigo.</summary>
        public static event Action<MensagemRecebida> AoMensagem;
        /// <summary>Alguém pediu amizade ou aceitou um pedido: as listas mudaram. O texto já vem pronto pra mostrar.</summary>
        public static event Action<string> AoAmizade;
        /// <summary>A conexão abriu e o servidor reconheceu a conta, ou caiu.</summary>
        public static event Action AoMudar;
        /// <summary>Mudou algo da sala: a fase, o código, o papel, o recado, o erro ou um perfil.</summary>
        public static event Action AoSala;
        /// <summary>
        /// Entrei na sala (criando, entrando ou voltando depois de uma queda): o servidor não tem mais o meu perfil,
        /// e quem está jogando o manda de novo.
        /// </summary>
        public static event Action AoEntrar;
        /// <summary>O parceiro entrou na sala (o nome dele).</summary>
        public static event Action<string> AoParceiroEntrar;
        /// <summary>O parceiro saiu.</summary>
        public static event Action AoParceiroSair;
        /// <summary>
        /// Chegou um estado do jogo: o do parceiro (<c>welcome</c>, <c>state</c>) ou o eco do meu, já saneado
        /// (<c>authoritative</c>). O segundo valor diz se é o eco.
        /// </summary>
        public static event Action<JObject, bool> AoEstado;
        /// <summary>Um pacote do tempo real do parceiro: o papel dele e os dados.</summary>
        public static event Action<int, JObject> AoTempoReal;
        /// <summary>Um amigo chamou pra sala dele.</summary>
        public static event Action<Convite> AoConvite;

        /// <summary>Conectado e com a conta reconhecida pelo servidor.</summary>
        public static bool Pronta { get; private set; }

        public static FaseDaSala Fase { get; private set; }
        public static string Codigo { get; private set; } = "";
        /// <summary>1 conduz, 2 acompanha; 0 fora de sala.</summary>
        public static int Papel { get; private set; }
        /// <summary>O último recado e o último erro da sala ("" = nenhum).</summary>
        public static string Recado { get; private set; } = "";
        public static string Erro { get; private set; } = "";
        /// <summary>O convite esperando resposta, ou null.</summary>
        public static Convite ConvitePendente { get; private set; }

        /// <summary>Estou numa sala (esperando ou jogando).</summary>
        public static bool NaSala => Fase == FaseDaSala.Esperando || Fase == FaseDaSala.Jogando;
        public static bool Conduzo => Papel == Anfitriao;
        public static int PapelDoParceiro => Papel == Anfitriao ? Convidado : Anfitriao;

        private static SocketIo _socket;
        private static Bomba _bomba;
        private static bool _querLigada;
        private static float _voltarEm;
        private static readonly Dictionary<int, JObject> _perfis = new Dictionary<int, JObject>();
        /// <summary>A sala pra onde voltar depois de uma queda (null = nenhuma).</summary>
        private static string _voltarPara, _meuNome;
        private static bool _publica;

        /// <summary>O perfil que o servidor guarda de um papel (o meu inteiro; o do parceiro sem mochila), ou null.</summary>
        public static JObject Perfil(int papel) => _perfis.TryGetValue(papel, out var perfil) ? perfil : null;

        /// <summary>Liga (se já não estiver) com a sessão guardada. Sem sessão, não faz nada.</summary>
        public static void Ligar()
        {
            if (!Session.Tem) return;
            _querLigada = true;
            if (_bomba == null)
            {
                // Sem HideAndDontSave: assim o objeto some quando o Play do Editor acaba, e leva a conexão junto.
                var objeto = new GameObject("Rede");
                UnityEngine.Object.DontDestroyOnLoad(objeto);
                _bomba = objeto.AddComponent<Bomba>();
            }
            if (_socket == null) Abrir();
        }

        /// <summary>Desliga de vez (sair da conta, sessão vencida, fechar o jogo).</summary>
        public static void Desligar()
        {
            _querLigada = false;
            EsquecerASala();
            Fechar();
        }

        /// <summary>Manda um evento pro servidor; sem conexão pronta, é ignorado.</summary>
        public static void Emitir(string evento, JToken corpo = null)
        {
            if (Pronta) _socket.Emitir(evento, corpo);
        }

        // ---------- a sala ----------

        public static void CriarSala(string codigo, string nome, bool publica)
        {
            if (!Pronta) return;
            Pedir(codigo, nome, publica);
            _socket.Emitir("create", new JObject { ["room"] = codigo, ["name"] = nome, ["public"] = publica, ["app"] = true });
        }

        public static void EntrarNaSala(string codigo, string nome)
        {
            if (!Pronta) return;
            Pedir(codigo, nome, false);
            _socket.Emitir("join", new JObject { ["room"] = codigo, ["name"] = nome, ["app"] = true });
        }

        private static void Pedir(string codigo, string nome, bool publica)
        {
            _voltarPara = codigo;
            _meuNome = nome;
            _publica = publica;
            _perfis.Clear();
            Fase = FaseDaSala.Entrando;
            Codigo = codigo;
            Papel = 0;
            Recado = "";
            Erro = "";
            AoSala?.Invoke();
        }

        /// <summary>Sai da sala e continua conectado (o servidor só tira da sala quem desconecta, como no site).</summary>
        public static void SairDaSala()
        {
            bool estava = Fase != FaseDaSala.Fora;
            EsquecerASala();
            if (!estava) return;
            Fechar();
            _voltarEm = 0f;
            AoSala?.Invoke();
        }

        private static void EsquecerASala()
        {
            _voltarPara = null;
            _perfis.Clear();
            Fase = FaseDaSala.Fora;
            Codigo = "";
            Papel = 0;
            Recado = "";
            Erro = "";
        }

        public static void MandarPerfil(JObject perfil)
        {
            if (NaSala) Emitir("profile", new JObject { ["room"] = Codigo, ["profile"] = perfil });
        }

        /// <summary>Só o papel 1: abre a aventura pro parceiro com o estado atual (a sincronização cheia).</summary>
        public static void AbrirAventura(JObject estado)
        {
            if (!NaSala) return;
            Emitir("welcome", new JObject { ["room"] = Codigo, ["state"] = estado, ["turn"] = 1 });
            if (Fase == FaseDaSala.Jogando) return;
            Fase = FaseDaSala.Jogando;
            AoSala?.Invoke();
        }

        public static void MandarEstado(JObject estado)
        {
            if (NaSala) Emitir("state", new JObject { ["room"] = Codigo, ["state"] = estado, ["turn"] = 1 });
        }

        /// <summary>O tempo real da sala (onde o herói está, a luta): o servidor só repassa pro parceiro.</summary>
        public static void MandarTempoReal(JObject dados)
        {
            if (NaSala) Emitir("tempo-real", new JObject { ["room"] = Codigo, ["d"] = dados });
        }

        public static void Convidar(string usuario, string nomeDoAnfitriao)
        {
            if (NaSala) Emitir("room-invite", new JObject { ["to"] = usuario, ["code"] = Codigo, ["hostName"] = nomeDoAnfitriao });
        }

        public static void ResponderConvite(bool aceito)
        {
            var convite = ConvitePendente;
            if (convite == null) return;
            ConvitePendente = null;
            Emitir("room-invite-response", new JObject { ["to"] = convite.De, ["code"] = convite.Codigo, ["accepted"] = aceito });
            AoSala?.Invoke();
        }

        public static void LimparRecados()
        {
            if (Recado.Length == 0 && Erro.Length == 0) return;
            Recado = "";
            Erro = "";
            AoSala?.Invoke();
        }

        // ---------- a conexão ----------

        /// <summary>
        /// O Editor entra no Play sem recarregar o domínio (os estáticos ficam): começa cada Play do zero, sem a
        /// conexão e sem os ouvintes das telas do Play anterior.
        /// </summary>
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void Zerar()
        {
            _querLigada = false;
            var socket = _socket;
            _socket = null;
            socket?.Desligar();
            Pronta = false;
            _bomba = null;
            _voltarEm = 0f;
            EsquecerASala();
            ConvitePendente = null;
            AoMensagem = null;
            AoAmizade = null;
            AoMudar = null;
            AoSala = null;
            AoEntrar = null;
            AoParceiroEntrar = null;
            AoParceiroSair = null;
            AoEstado = null;
            AoTempoReal = null;
            AoConvite = null;
        }

        private static void Abrir()
        {
            var socket = new SocketIo();
            _socket = socket;
            socket.AoConectar += () => socket.Emitir("auth", new JObject { ["token"] = Session.Token });
            socket.AoCair += () =>
            {
                if (_socket != socket) return;
                Fechar();
                _voltarEm = Time.realtimeSinceStartup + EsperaParaVoltar;
            };
            socket.AoEvento += (evento, corpo) =>
            {
                if (_socket == socket) Receber(evento, corpo as JObject);
            };
            socket.Ligar(ApiConfig.BaseUrl);
        }

        private static void Fechar()
        {
            var socket = _socket;
            _socket = null;
            socket?.Desligar();
            bool estava = Pronta;
            Pronta = false;
            // A queda não apaga a sala: os perfis saem (o servidor não os guarda), e o código fica pra voltar.
            if (_voltarPara != null && Fase != FaseDaSala.Fora)
            {
                _perfis.Clear();
                Papel = 0;
                Fase = FaseDaSala.Entrando;
                Recado = "Conexão caiu. Voltando para a sala…";
                AoSala?.Invoke();
            }
            if (estava) AoMudar?.Invoke();
        }

        private static void Receber(string evento, JObject corpo)
        {
            switch (evento)
            {
                case "authed":
                    Pronta = true;
                    AoMudar?.Invoke();
                    // Uma mensagem só: quem decide entre entrar e recriar é o servidor (handleRejoin).
                    if (_voltarPara != null)
                        _socket.Emitir("rejoin", new JObject { ["room"] = _voltarPara, ["name"] = _meuNome, ["public"] = _publica, ["app"] = true });
                    break;
                case "auth-error":
                    // A sessão não vale mais: não adianta insistir. A próxima chamada HTTP leva a pessoa à porta.
                    Desligar();
                    AoSala?.Invoke();
                    break;
                case "chat":
                    var de = Texto(corpo?["from"]);
                    if (de.Length > 0) AoMensagem?.Invoke(new MensagemRecebida { De = de, Id = corpo["id"] == null ? "" : corpo["id"].ToString(), Corpo = Texto(corpo["body"]) });
                    break;
                case "friend-request":
                    AoAmizade?.Invoke(Texto(corpo?["username"]) + " quer ser seu amigo.");
                    break;
                case "friend-accept":
                    AoAmizade?.Invoke(Texto(corpo?["username"]) + " agora é seu amigo.");
                    break;

                case "created":
                    Entrei(Texto(corpo?["room"]), Anfitriao, "");
                    break;
                case "hello":
                    // Chega pra quem já estava quando alguém entra, e pra quem entrou, com o papel dele.
                    if (Papel == 0)
                    {
                        Entrei(Texto(corpo?["room"]), Inteiro(corpo?["role"], Convidado) == Anfitriao ? Anfitriao : Convidado, "Você entrou na sala.");
                    }
                    else
                    {
                        var nome = Texto(corpo?["name"]);
                        Recado = (nome.Length > 0 ? nome : "Alguém") + " entrou na sala.";
                        Erro = "";
                        AoSala?.Invoke();
                        AoParceiroEntrar?.Invoke(nome);
                    }
                    break;
                case "profile":
                case "profile-accepted":
                    if (GuardarPerfil(Inteiro(corpo?["role"], 0), corpo?["profile"] as JObject)) AoSala?.Invoke();
                    break;
                case "welcome":
                case "state":
                case "authoritative":
                    Adotar(corpo, evento == "authoritative");
                    break;
                case "tempo-real":
                    if (NaSala && corpo?["d"] is JObject dados) AoTempoReal?.Invoke(Inteiro(corpo["role"], 0), dados);
                    break;
                case "peer-left":
                    if (!NaSala) break;
                    _perfis.Remove(PapelDoParceiro);
                    Fase = FaseDaSala.Esperando;
                    Recado = "Seu parceiro saiu da sala.";
                    AoSala?.Invoke();
                    AoParceiroSair?.Invoke();
                    break;
                case "role-changed":
                    if (!NaSala) break;
                    Papel = Inteiro(corpo?["role"], Anfitriao) == Convidado ? Convidado : Anfitriao;
                    Recado = "Você assumiu a condução da aventura.";
                    AoSala?.Invoke();
                    break;
                case "room-invite":
                    var convite = new Convite { De = Texto(corpo?["from"]), Codigo = Texto(corpo?["code"]), NomeDoAnfitriao = Texto(corpo?["hostName"]) };
                    if (convite.De.Length == 0 || convite.Codigo.Length == 0) break;
                    ConvitePendente = convite;
                    AoSala?.Invoke();
                    AoConvite?.Invoke(convite);
                    break;
                case "room-invite-sent":
                    Recado = "Convite enviado para " + Texto(corpo?["to"]) + ".";
                    AoSala?.Invoke();
                    break;
                case "room-invite-error":
                    Erro = TextoOu(corpo?["message"], "Não deu para convidar.");
                    AoSala?.Invoke();
                    break;
                case "room-invite-response":
                    var quem = TextoOu(corpo?["from"], "O convidado");
                    Recado = corpo?["accepted"]?.Type == JTokenType.Boolean && (bool)corpo["accepted"] ? quem + " aceitou o convite." : quem + " recusou o convite.";
                    AoSala?.Invoke();
                    break;
                case "error":
                    Erro = TextoOu(corpo?["message"], "Erro no servidor.");
                    // O pedido de criar ou entrar foi recusado: não há sala pra onde voltar.
                    if (Fase == FaseDaSala.Entrando) EsquecerSoASala();
                    AoSala?.Invoke();
                    break;
            }
        }

        private static void EsquecerSoASala()
        {
            var erro = Erro;
            EsquecerASala();
            Erro = erro;
        }

        private static void Entrei(string codigo, int papel, string recado)
        {
            if (codigo.Length > 0) Codigo = codigo;
            Papel = papel;
            Fase = FaseDaSala.Esperando;
            Recado = recado;
            Erro = "";
            AoSala?.Invoke();
            AoEntrar?.Invoke();
        }

        /// <summary>
        /// Guarda o perfil de um papel. Mochila ausente quer dizer "não mudou": fica a que já estava
        /// (<c>preservarMochila</c> do site).
        /// </summary>
        private static bool GuardarPerfil(int papel, JObject perfil)
        {
            if (perfil == null || (papel != Anfitriao && papel != Convidado)) return false;
            if (perfil["inventory"] == null && _perfis.TryGetValue(papel, out var anterior) && anterior["inventory"] != null)
            {
                perfil = (JObject)perfil.DeepClone();
                perfil["inventory"] = anterior["inventory"];
            }
            _perfis[papel] = perfil;
            return true;
        }

        private static void Adotar(JObject corpo, bool eco)
        {
            if (!NaSala || !(corpo?["state"] is JObject estado)) return;
            var perfis = (estado["profiles"] ?? corpo["profiles"]) as JObject;
            if (perfis != null)
                foreach (var p in perfis.Properties())
                    if (int.TryParse(p.Name, out var papel)) GuardarPerfil(papel, p.Value as JObject);
            // O eco não abre a aventura: quem abre é o estado do parceiro.
            if (!eco && Fase != FaseDaSala.Jogando)
            {
                Fase = FaseDaSala.Jogando;
                AoSala?.Invoke();
            }
            AoEstado?.Invoke(estado, eco);
        }

        private static string Texto(JToken t) => t != null && t.Type == JTokenType.String ? (string)t : "";

        private static string TextoOu(JToken t, string padrao)
        {
            var texto = Texto(t);
            return texto.Length > 0 ? texto : padrao;
        }

        private static int Inteiro(JToken t, int padrao) =>
            t != null && (t.Type == JTokenType.Integer || t.Type == JTokenType.Float) ? (int)(double)t : padrao;

        /// <summary>Entrega os eventos na thread da Unity e cuida de voltar depois de uma queda.</summary>
        private sealed class Bomba : MonoBehaviour
        {
            private void Update()
            {
                _socket?.Bombear();
                if (_socket == null && _querLigada && Time.realtimeSinceStartup >= _voltarEm)
                {
                    if (Session.Tem) Abrir();
                    else _querLigada = false;
                }
            }

            private void OnDestroy()
            {
                if (_bomba != this) return;
                _bomba = null;
                Desligar();
            }
        }
    }
}
