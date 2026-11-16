using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// Um cliente pequeno de socket.io (v4, só o transporte websocket, que é o que o site usa), escrito aqui em vez
    /// de vir num pacote (decisão do usuário, 2026-11-15): só o que o jogo usa — abrir, responder o ping do
    /// servidor, mandar e receber eventos com um corpo JSON. Sem sala, sem ack, sem binário.
    ///
    /// O protocolo, do jeito que vai no fio (cada mensagem de texto é um pacote):
    /// <c>0{…}</c> o servidor abre (traz o intervalo do ping); <c>40</c> pedimos o namespace e ele confirma com
    /// <c>40{…}</c>; <c>2</c> é o ping dele e <c>3</c> a nossa resposta; <c>42["evento",corpo]</c> é um evento, nos
    /// dois sentidos; <c>41</c> e <c>1</c> fecham.
    ///
    /// A leitura corre fora da thread da Unity: o que chega vai pra uma fila, e quem usa chama
    /// <see cref="Bombear"/> a cada quadro pra receber os eventos na thread principal.
    /// </summary>
    public sealed class SocketIo : IDisposable
    {
        /// <summary>O namespace abriu: já dá pra emitir.</summary>
        public event Action AoConectar;
        /// <summary>A conexão acabou (caiu, o servidor fechou, ou nem abriu). Não chega depois de <see cref="Desligar"/>.</summary>
        public event Action AoCair;
        /// <summary>O nome do evento e o corpo (null quando veio sem).</summary>
        public event Action<string, JToken> AoEvento;

        public bool Conectado { get; private set; }

        private readonly ConcurrentQueue<Action> _fila = new ConcurrentQueue<Action>();
        private readonly SemaphoreSlim _envio = new SemaphoreSlim(1, 1);
        private ClientWebSocket _ws;
        private CancellationTokenSource _fim;
        private volatile bool _desligado;

        /// <summary>Abre a conexão com a API (a mesma base das chamadas HTTP). Chamar uma vez por objeto.</summary>
        public void Ligar(string baseUrl)
        {
            if (_ws != null) throw new InvalidOperationException("SocketIo.Ligar: já ligado.");
            _ws = new ClientWebSocket();
            _fim = new CancellationTokenSource();
            var endereco = new Uri(Endereco(baseUrl));
            var ws = _ws;
            var fim = _fim.Token;
            Task.Run(() => Ler(ws, endereco, fim));
        }

        /// <summary>Manda um evento. Fora de conexão, não faz nada: quem precisa da resposta espera o evento dela.</summary>
        public void Emitir(string evento, JToken corpo = null)
        {
            if (!Conectado) return;
            Mandar(Pacote(evento, corpo));
        }

        /// <summary>Entrega na thread de quem chama o que chegou desde a última vez.</summary>
        public void Bombear()
        {
            while (_fila.TryDequeue(out var acao)) acao();
        }

        /// <summary>Fecha de propósito: nenhum evento chega depois, nem o <see cref="AoCair"/>.</summary>
        public void Desligar()
        {
            if (_desligado) return;
            _desligado = true;
            Conectado = false;
            try { _fim?.Cancel(); } catch (ObjectDisposedException) { }
            try { _ws?.Abort(); } catch (ObjectDisposedException) { }
        }

        public void Dispose() => Desligar();

        // ---------- o fio ----------

        private async Task Ler(ClientWebSocket ws, Uri endereco, CancellationToken fim)
        {
            try
            {
                await ws.ConnectAsync(endereco, fim).ConfigureAwait(false);
                var pedaco = new byte[16 * 1024];
                var texto = new StringBuilder();
                var sobra = Encoding.UTF8.GetDecoder();
                var letras = new char[16 * 1024];
                while (ws.State == WebSocketState.Open && !fim.IsCancellationRequested)
                {
                    var lido = await ws.ReceiveAsync(new ArraySegment<byte>(pedaco), fim).ConfigureAwait(false);
                    if (lido.MessageType == WebSocketMessageType.Close) break;
                    if (lido.MessageType != WebSocketMessageType.Text) continue;
                    // Um caractere pode vir cortado entre dois pedaços: o decodificador guarda a sobra.
                    int n = sobra.GetChars(pedaco, 0, lido.Count, letras, 0, lido.EndOfMessage);
                    texto.Append(letras, 0, n);
                    if (!lido.EndOfMessage) continue;
                    var pacote = texto.ToString();
                    texto.Clear();
                    Receber(ws, pacote);
                }
            }
            catch (OperationCanceledException) { }
            catch (WebSocketException) { }
            catch (ObjectDisposedException) { }
            catch (System.IO.IOException) { }
            catch (System.Net.Sockets.SocketException) { }
            catch (InvalidOperationException) { }
            finally
            {
                _fila.Enqueue(() =>
                {
                    Conectado = false;
                    if (!_desligado) AoCair?.Invoke();
                });
                try { ws.Dispose(); } catch (ObjectDisposedException) { }
            }
        }

        private void Receber(ClientWebSocket ws, string pacote)
        {
            if (pacote.Length == 0) return;
            switch (pacote[0])
            {
                case '0':
                    // O servidor abriu o transporte: pedimos o namespace padrão.
                    Mandar("40");
                    return;
                case '2':
                    Mandar("3");
                    return;
                case '1':
                    ws.Abort();
                    return;
                case '4':
                    break;
                default:
                    return;
            }
            if (pacote.Length < 2) return;
            if (pacote[1] == '0')
            {
                _fila.Enqueue(() =>
                {
                    if (_desligado) return;
                    Conectado = true;
                    AoConectar?.Invoke();
                });
                return;
            }
            if (pacote[1] == '1' || pacote[1] == '4')
            {
                // O servidor nos tirou do namespace, ou recusou a entrada.
                ws.Abort();
                return;
            }
            if (!LerEvento(pacote, out var evento, out var corpo)) return;
            _fila.Enqueue(() =>
            {
                if (!_desligado) AoEvento?.Invoke(evento, corpo);
            });
        }

        private void Mandar(string pacote)
        {
            var ws = _ws;
            var fim = _fim.Token;
            var bytes = Encoding.UTF8.GetBytes(pacote);
            Task.Run(async () =>
            {
                try
                {
                    // O websocket só aceita um envio por vez.
                    await _envio.WaitAsync(fim).ConfigureAwait(false);
                    try
                    {
                        if (ws.State == WebSocketState.Open)
                            await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, fim).ConfigureAwait(false);
                    }
                    finally { _envio.Release(); }
                }
                catch (OperationCanceledException) { }
                catch (WebSocketException) { }
                catch (ObjectDisposedException) { }
                catch (System.IO.IOException) { }
                catch (InvalidOperationException) { }
            });
        }

        // ---------- sem rede: dá pra testar ----------

        /// <summary>O endereço do websocket do socket.io a partir da base da API (http vira ws, https vira wss).</summary>
        public static string Endereco(string baseUrl)
        {
            var b = (baseUrl ?? "").TrimEnd('/');
            if (b.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) b = "wss://" + b.Substring(8);
            else if (b.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) b = "ws://" + b.Substring(7);
            return b + "/socket.io/?EIO=4&transport=websocket";
        }

        /// <summary>O pacote de um evento: <c>42["evento",corpo]</c> (sem corpo, só o nome).</summary>
        public static string Pacote(string evento, JToken corpo)
        {
            var lista = new JArray { evento };
            if (corpo != null) lista.Add(corpo);
            return "42" + lista.ToString(Formatting.None);
        }

        /// <summary>
        /// Lê um pacote de evento. Falso para o que não é evento do namespace padrão ou veio torto. As datas ficam
        /// como texto (o JSON.NET as converteria, e o jogo as repassa como vieram).
        /// </summary>
        public static bool LerEvento(string pacote, out string evento, out JToken corpo)
        {
            evento = null;
            corpo = null;
            if (pacote == null || pacote.Length < 3 || pacote[0] != '4' || pacote[1] != '2' || pacote[2] != '[') return false;
            try
            {
                using var leitor = new JsonTextReader(new System.IO.StringReader(pacote.Substring(2))) { DateParseHandling = DateParseHandling.None };
                if (!(JToken.ReadFrom(leitor) is JArray lista) || lista.Count == 0 || lista[0].Type != JTokenType.String) return false;
                evento = (string)lista[0];
                corpo = lista.Count > 1 ? lista[1] : null;
                return true;
            }
            catch (JsonException) { return false; }
        }
    }
}
