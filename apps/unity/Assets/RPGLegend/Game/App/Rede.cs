using System;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace RPGLegend.Game.App
{
    /// <summary>Uma mensagem de amigo que chegou com o app aberto.</summary>
    public sealed class MensagemRecebida
    {
        public string De, Id, Corpo;
    }

    /// <summary>
    /// A sessão de tempo real do app: o espelho de <c>apps/web/lib/rede/sala.ts</c>. Uma conexão só, que vive do
    /// menu até sair da conta e sobrevive à troca de telas; quem quer ouvir assina os eventos.
    ///
    /// A identidade vai no evento <c>auth</c> com o token da sessão (o site manda o cookie; o gateway aceita os
    /// dois). Se a conexão cai, tenta de novo sozinha a cada poucos segundos enquanto houver sessão.
    ///
    /// Por enquanto leva só o que os amigos precisam (mensagem nova, pedido e aceite de amizade); a sala do co-op
    /// entra aqui na parte seguinte.
    /// </summary>
    public static class Rede
    {
        /// <summary>De quanto em quanto tempo tenta voltar depois de cair.</summary>
        private const float EsperaParaVoltar = 4f;

        /// <summary>Chegou uma mensagem de um amigo.</summary>
        public static event Action<MensagemRecebida> AoMensagem;
        /// <summary>Alguém pediu amizade ou aceitou um pedido: as listas mudaram. O texto já vem pronto pra mostrar.</summary>
        public static event Action<string> AoAmizade;
        /// <summary>A conexão abriu e o servidor reconheceu a conta, ou caiu.</summary>
        public static event Action AoMudar;

        /// <summary>Conectado e com a conta reconhecida pelo servidor.</summary>
        public static bool Pronta { get; private set; }

        private static SocketIo _socket;
        private static Bomba _bomba;
        private static bool _querLigada;
        private static float _voltarEm;

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
            Fechar();
        }

        /// <summary>Manda um evento pro servidor; sem conexão pronta, é ignorado.</summary>
        public static void Emitir(string evento, JToken corpo = null)
        {
            if (Pronta) _socket.Emitir(evento, corpo);
        }

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
            AoMensagem = null;
            AoAmizade = null;
            AoMudar = null;
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
                if (_socket == socket) Receber(evento, corpo);
            };
            socket.Ligar(ApiConfig.BaseUrl);
        }

        private static void Fechar()
        {
            var socket = _socket;
            _socket = null;
            socket?.Desligar();
            if (!Pronta) return;
            Pronta = false;
            AoMudar?.Invoke();
        }

        private static void Receber(string evento, JToken corpo)
        {
            switch (evento)
            {
                case "authed":
                    Pronta = true;
                    AoMudar?.Invoke();
                    break;
                case "auth-error":
                    // A sessão não vale mais: não adianta insistir. A próxima chamada HTTP leva a pessoa à porta.
                    Desligar();
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
            }
        }

        private static string Texto(JToken t) => t != null && t.Type == JTokenType.String ? (string)t : "";

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
