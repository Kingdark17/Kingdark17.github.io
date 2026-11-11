using System;
using System.Globalization;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// A atualização do app de PC. O celular se atualiza pela loja dele; o PC não tem loja, então o próprio jogo
    /// olha, ao abrir, a última versão publicada (o "release" mais novo do repositório no GitHub, que guarda o
    /// instalador e um <c>versao-pc.txt</c> com a versão e o tamanho dele). Se for mais nova que a deste executável
    /// (<see cref="Application.version"/>, que o menu RPG Legend > Build do app (Windows) grava igual à do
    /// instalador), o menu oferece ATUALIZAR: baixa o instalador, roda ele em silêncio e fecha o jogo; o instalador
    /// troca os arquivos e abre o jogo de novo. Quem publica é <c>apps/unity/Instalador/publicar.mjs</c>.
    /// Para testar contra outro lugar, o executável aceita <c>-atualizacao http://127.0.0.1:8000/</c>.
    /// </summary>
    public static class Atualizacao
    {
        /// <summary>De onde saem os dois arquivos: o release mais novo do repositório.</summary>
        public const string Publicada = "https://github.com/Kingdark17/Kingdark17.github.io/releases/latest/download/";

        public const string ArquivoDaVersao = "versao-pc.txt";

        /// <summary>O instalador no release (sem acento nem espaço, que o GitHub troca por ponto).</summary>
        public const string ArquivoDoInstalador = "RPGLegend-Instalacao.exe";

        /// <summary>Só o executável do Windows se atualiza sozinho (no Editor e no celular não há o que trocar).</summary>
        public static bool Vale => Application.platform == RuntimePlatform.WindowsPlayer;

        public static string Origem
        {
            get
            {
                var args = Environment.GetCommandLineArgs();
                for (int i = 0; i < args.Length - 1; i++)
                    if (args[i] == "-atualizacao" && !string.IsNullOrWhiteSpace(args[i + 1])) return args[i + 1].TrimEnd('/') + "/";
                return Publicada;
            }
        }

        /// <summary>O que o versao-pc.txt diz: a versão na primeira linha e o tamanho do instalador na segunda.</summary>
        public sealed class Versao
        {
            public string Numero;
            public long Tamanho;
        }

        /// <summary>Lê o versao-pc.txt; null quando ele não diz uma versão.</summary>
        public static Versao Ler(string texto)
        {
            var linhas = (texto ?? "").Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            if (linhas.Length == 0 || Partes(linhas[0]) == null) return null;
            long tamanho = 0;
            if (linhas.Length > 1) long.TryParse(linhas[1].Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out tamanho);
            return new Versao { Numero = linhas[0].Trim(), Tamanho = tamanho };
        }

        /// <summary>"2026.11.11.1530" em números; null se não for uma versão de números separados por ponto.</summary>
        private static long[] Partes(string versao)
        {
            var pedacos = (versao ?? "").Trim().Split('.');
            if (pedacos.Length == 0 || pedacos.Length > 6) return null;
            var partes = new long[pedacos.Length];
            for (int i = 0; i < pedacos.Length; i++)
                if (!long.TryParse(pedacos[i], NumberStyles.None, CultureInfo.InvariantCulture, out partes[i])) return null;
            return partes;
        }

        /// <summary>A versão <paramref name="nova"/> é mais nova que a <paramref name="atual"/> (parte por parte, como números).</summary>
        public static bool MaisNova(string nova, string atual)
        {
            var a = Partes(nova);
            var b = Partes(atual);
            if (a == null) return false;
            if (b == null) return true;
            for (int i = 0; i < Math.Max(a.Length, b.Length); i++)
            {
                long x = i < a.Length ? a[i] : 0, y = i < b.Length ? b[i] : 0;
                if (x != y) return x > y;
            }
            return false;
        }

        /// <summary>A versão publicada, se for mais nova que a <paramref name="atual"/>; null se não for ou se não deu pra saber.</summary>
        public static async Awaitable<Versao> Procurar(string origem, string atual)
        {
            using var req = UnityWebRequest.Get(origem + ArquivoDaVersao);
            req.timeout = 15;
            await req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success) return null;
            var versao = Ler(req.downloadHandler.text);
            return versao != null && MaisNova(versao.Numero, atual) ? versao : null;
        }

        /// <summary>
        /// Baixa o instalador para <paramref name="destino"/>, dizendo o quanto já veio (0 a 1). Devolve false se a
        /// conexão falhar ou se o arquivo não for o esperado (um executável, do tamanho que o versao-pc.txt diz).
        /// </summary>
        public static async Awaitable<bool> Baixar(string origem, Versao versao, string destino, Action<float> progresso)
        {
            if (File.Exists(destino)) File.Delete(destino);
            using (var req = new UnityWebRequest(origem + ArquivoDoInstalador, UnityWebRequest.kHttpVerbGET))
            {
                req.downloadHandler = new DownloadHandlerFile(destino) { removeFileOnAbort = true };
                var envio = req.SendWebRequest();
                while (!envio.isDone)
                {
                    progresso?.Invoke(req.downloadProgress);
                    await Awaitable.NextFrameAsync();
                }
                if (req.result != UnityWebRequest.Result.Success) return false;
            }
            return Confere(destino, versao);
        }

        /// <summary>O arquivo baixado é um executável do Windows ("MZ") e tem o tamanho publicado (quando há um).</summary>
        public static bool Confere(string arquivo, Versao versao)
        {
            var info = new FileInfo(arquivo);
            if (!info.Exists || info.Length < 2) return false;
            if (versao != null && versao.Tamanho > 0 && info.Length != versao.Tamanho) return false;
            using var leitura = info.OpenRead();
            return leitura.ReadByte() == 'M' && leitura.ReadByte() == 'Z';
        }

        /// <summary>Onde o instalador baixado fica até rodar.</summary>
        public static string Destino => Path.Combine(Application.temporaryCachePath, ArquivoDoInstalador);

        /// <summary>
        /// Roda o instalador em silêncio (só a barrinha dele, sem pergunta) e fecha o jogo. Ele espera o jogo fechar,
        /// troca os arquivos e abre o jogo de novo (a linha "Check: WizardSilent" do RPGLegend.iss).
        /// </summary>
        public static void Instalar(string instalador)
        {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = instalador,
                Arguments = "/SILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS",
                UseShellExecute = true,
            });
            Application.Quit();
#endif
        }
    }

    /// <summary>
    /// O aviso de versão nova (UI/App.uxml, "atualizacao"), no canto da porta e do menu: escondido até a procura
    /// achar uma, e então o texto e o ATUALIZAR, que vira a porcentagem enquanto baixa. Aparece já na porta, antes
    /// de entrar na conta, e some nas outras telas (personagens, jogo…). Se o download falhar, o botão volta pra
    /// tentar de novo; quem não quiser atualizar agora só não toca nele.
    /// </summary>
    public sealed class AvisoDeAtualizacao
    {
        private readonly VisualElement _caixa, _menu, _cartao, _toque;
        private readonly Label _texto;
        private readonly Button _botao;
        private readonly string _origem;
        private Atualizacao.Versao _versao;
        private bool _baixando;

        public AvisoDeAtualizacao(VisualElement raiz, string origem)
        {
            _caixa = raiz.Q("atualizacao");
            _texto = raiz.Q<Label>("texto-da-atualizacao");
            _botao = raiz.Q<Button>("botao-atualizar");
            _menu = raiz.Q("menu");
            _cartao = raiz.Q("cartao-entrada");
            _toque = raiz.Q("toque-para-entrar");
            _origem = origem;
            _botao.clicked += Atualizar;
            // Quem troca as telas é o AppFlow; o aviso só olha se a porta ou o menu estão à vista.
            raiz.schedule.Execute(Acertar).Every(150);
        }

        /// <summary>Procura a versão publicada e mostra o aviso se ela for mais nova que a <paramref name="atual"/>.</summary>
        public async Awaitable Procurar(string atual)
        {
            try
            {
                _versao = await Atualizacao.Procurar(_origem, atual);
                if (_versao == null) return;
                _texto.text = "Saiu uma versão nova do jogo.";
                _botao.text = "ATUALIZAR";
                Acertar();
            }
            catch (Exception e) { Debug.LogException(e); }
        }

        /// <summary>À vista quando há versão nova e a tela é a porta (o cartão ou o "toque para entrar") ou o menu.</summary>
        private void Acertar()
        {
            bool naTela = !_menu.ClassListContains("oculto") || !_cartao.ClassListContains("escondido") || !_toque.ClassListContains("escondido");
            _caixa.EnableInClassList("escondida", _versao == null || !(naTela || _baixando));
        }

        private async void Atualizar()
        {
            if (_baixando || _versao == null) return;
            _baixando = true;
            _botao.SetEnabled(false);
            _texto.text = "Baixando a versão nova…";
            bool veio = false;
            try
            {
                veio = await Atualizacao.Baixar(_origem, _versao, Atualizacao.Destino,
                    p => _botao.text = Mathf.RoundToInt(Mathf.Clamp01(p) * 100f).ToString(CultureInfo.InvariantCulture) + "%");
            }
            catch (Exception e) { Debug.LogException(e); }
            if (!veio)
            {
                _baixando = false;
                _texto.text = "Não deu pra baixar. Confira a internet e tente de novo.";
                _botao.text = "TENTAR DE NOVO";
                _botao.SetEnabled(true);
                return;
            }
            _texto.text = "Instalando… o jogo já volta.";
            _botao.text = "100%";
            Atualizacao.Instalar(Atualizacao.Destino);
        }
    }
}
