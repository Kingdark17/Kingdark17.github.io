using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: TipoDeEvento — o jeito de mirar de cada arma.</summary>
    public static class TiposDeEvento
    {
        public const string Barra = "barra";
        public const string Circulo = "circulo";
        public const string Carga = "carga";
        public const string Desenho = "desenho";
        public const string Ritmo = "ritmo";
        public const string ToqueDuplo = "toque_duplo";
    }

    /// <summary>TS: EventoDeArma — o que o app precisa para desenhar o evento, e o que a leitura confere.</summary>
    public sealed class EventoDeArma
    {
        /// <summary>Um de <see cref="TiposDeEvento"/>.</summary>
        public string Tipo;
        /// <summary>O quanto o evento perdoa (<see cref="Attack.ZonaDoAtaque"/>), em fração da régua.</summary>
        public double Zona;
        /// <summary>O máximo que o evento dura, em passos: a câmera lenta dura isso.</summary>
        public double Duracao;
        /// <summary>Ritmo e toque duplo: em que passo cada nota bate.</summary>
        public List<double> Notas;
        /// <summary>Ritmo e toque duplo: a meia janela de cada nota, em passos.</summary>
        public double? Janela;
        /// <summary>Desenho: o símbolo sorteado, uma chave de SIMBOLOS.</summary>
        public string Simbolo;
    }

    /// <summary>TS: PontoDoTraco — um ponto do traço do dedo: onde, na caixa do desenho, e em que passo.</summary>
    public sealed class PontoDoTraco
    {
        public double X;
        public double Y;
        public double T;
    }

    /// <summary>
    /// TS: JogadaDoEvento — o que a pessoa fez no evento. Só o campo do tipo do evento conta; ausente (null) é
    /// não ter feito.
    /// </summary>
    public sealed class JogadaDoEvento
    {
        /// <summary>Barra e bolinha: o passo do toque.</summary>
        public double? Toque;
        /// <summary>Carga: o passo em que soltou.</summary>
        public double? Soltou;
        /// <summary>Ritmo e toque duplo: os passos de cada toque, em ordem.</summary>
        public List<double> Toques;
        /// <summary>Desenho: os pontos do traço, em ordem.</summary>
        public List<PontoDoTraco> Traco;
    }

    /// <summary>As tabelas de luta/eventos-de-arma.ts (fixtures/data/luta/eventos-de-arma.json).</summary>
    public sealed class EventosDeArmaData
    {
        [JsName("EVENTO_POR_ARMA")] public OrderedMap<string> EventoPorArma = new OrderedMap<string>();
        [JsName("EVENTO_SEM_ARMA")] public string EventoSemArma;
        [JsName("DURACAO_DA_BARRA")] public double DuracaoDaBarra;
        [JsName("DURACAO_DO_CIRCULO")] public double DuracaoDoCirculo;
        [JsName("DURACAO_DA_CARGA")] public double DuracaoDaCarga;
        [JsName("NOTAS_DO_RITMO")] public List<double> NotasDoRitmo;
        [JsName("JANELA_DO_RITMO")] public double JanelaDoRitmo;
        [JsName("NOTAS_DO_TOQUE_DUPLO")] public List<double> NotasDoToqueDuplo;
        [JsName("JANELA_DO_TOQUE_DUPLO")] public double JanelaDoToqueDuplo;
        [JsName("DURACAO_DO_DESENHO")] public double DuracaoDoDesenho;
        [JsName("TAMANHO_DO_DESENHO")] public double TamanhoDoDesenho;
        [JsName("TEMPO_LIVRE_DO_DESENHO")] public double TempoLivreDoDesenho;
        [JsName("ERRO_POR_PASSO")] public double ErroPorPasso;
        [JsName("ERRO_NA_PONTA")] public double ErroNaPonta;
        [JsName("PASSO_DO_TRACO")] public double PassoDoTraco;
        [JsName("PONTOS_MAXIMOS_DO_TRACO")] public double PontosMaximosDoTraco;
        /// <summary>Os símbolos do cajado: cada um, os pontos [x, y] do traço, na caixa de 0 a 1000.</summary>
        [JsName("SIMBOLOS")] public OrderedMap<List<List<double>>> Simbolos = new OrderedMap<List<List<double>>>();
    }

    public static partial class GameData
    {
        private static EventosDeArmaData _eventosDeArmaTable;

        /// <summary>luta/eventos-de-arma: o evento de cada arma, os tempos e os símbolos do cajado.</summary>
        public static EventosDeArmaData EventosDeArmaTable
        {
            get => Require(_eventosDeArmaTable, "luta/eventos-de-arma");
            set => _eventosDeArmaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/luta/eventos-de-arma.ts: o evento de mira de cada arma na luta em tempo real do app
    /// (espada e maça: a barra; arco: a bolinha que encolhe; machado e marreta: segurar e soltar na faixa;
    /// cajado: passar o dedo pelo símbolo; violão: o ritmo; adaga: dois toques). Todo evento termina numa
    /// <see cref="LeituraDaMira"/> pela mesma <see cref="Attack.LerMira"/>, e o golpe segue em
    /// <see cref="Attack.ResolverGolpe"/>. Tempo em passos (60 por segundo) e desenho em inteiros.
    /// </summary>
    public static class EventosDeArma
    {
        private static EventosDeArmaData D => GameData.EventosDeArmaTable;

        /// <summary>TS: eventoDaArma — o evento da arma pelo id do modelo; sem arma, ou arma sem evento, a barra.</summary>
        public static string EventoDaArma(string templateId)
        {
            if (Js.Truthy(templateId) && D.EventoPorArma.TryGet(templateId, out var tipo)) return tipo;
            return D.EventoSemArma;
        }

        /// <summary>
        /// TS: eventoDoAtaque — o evento que abre quando o herói aperta o ataque: o da arma na mão, com a zona
        /// deste estilo de ataque. Só o desenho sorteia (o símbolo, um número).
        /// </summary>
        public static EventoDeArma EventoDoAtaque(Hero hero, string estilo, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            string tipo = EventoDaArma(hero.Equip.Get("arma")?.TemplateId);
            double zona = Attack.ZonaDoAtaque(hero, estilo);
            switch (tipo)
            {
                case TiposDeEvento.Circulo:
                    return new EventoDeArma { Tipo = tipo, Zona = zona, Duracao = D.DuracaoDoCirculo };
                case TiposDeEvento.Carga:
                    return new EventoDeArma { Tipo = tipo, Zona = zona, Duracao = D.DuracaoDaCarga };
                case TiposDeEvento.Ritmo:
                    return Notas(tipo, zona, D.NotasDoRitmo, D.JanelaDoRitmo);
                case TiposDeEvento.ToqueDuplo:
                    return Notas(tipo, zona, D.NotasDoToqueDuplo, D.JanelaDoToqueDuplo);
                case TiposDeEvento.Desenho:
                {
                    var nomes = D.Simbolos.Keys;
                    return new EventoDeArma { Tipo = tipo, Zona = zona, Duracao = D.DuracaoDoDesenho, Simbolo = nomes[(int)Rng.RandomInt(nomes.Count, rng)] };
                }
                default:
                    return new EventoDeArma { Tipo = tipo, Zona = zona, Duracao = D.DuracaoDaBarra };
            }
        }

        private static EventoDeArma Notas(string tipo, double zona, List<double> batidas, double janela) =>
            new EventoDeArma { Tipo = tipo, Zona = zona, Duracao = batidas[batidas.Count - 1] + janela, Notas = new List<double>(batidas), Janela = janela };

        /// <summary>
        /// TS: lerEvento — lê o que a pessoa fez no evento. Número fora do evento (passo negativo, quebrado, depois
        /// do fim; ponto fora da caixa; traço voltando no tempo) lança RangeError, como a mira fora da barra.
        /// </summary>
        public static LeituraDaMira LerEvento(EventoDeArma evento, JogadaDoEvento jogada)
        {
            switch (evento.Tipo)
            {
                case TiposDeEvento.Barra:
                case TiposDeEvento.Circulo:
                    return LerNoTempo(evento.Zona, evento.Duracao, jogada.Toque, "toque", evento.Tipo);
                case TiposDeEvento.Carga:
                    return LerNoTempo(evento.Zona, evento.Duracao, jogada.Soltou, "soltou", evento.Tipo);
                case TiposDeEvento.Ritmo:
                case TiposDeEvento.ToqueDuplo:
                    return LerNotas(evento, jogada.Toques ?? new List<double>());
                case TiposDeEvento.Desenho:
                    return LerDesenho(evento, jogada.Traco ?? new List<PontoDoTraco>());
                default:
                    throw new EngineError("evento desconhecido: " + Js.Str(evento.Tipo), "RangeError");
            }
        }

        private static bool EhInteiro(double x) => Js.IsFinite(x) && Math.Floor(x) == x;

        private static void ConferirPasso(double valor, double duracao, string oQue, string tipo)
        {
            if (!EhInteiro(valor) || valor < 0 || valor > duracao)
            {
                throw new EngineError(
                    oQue + " " + Js.NumberToString(valor) + " fora do evento (" + tipo + ", " + Js.NumberToString(duracao) + " passos)", "RangeError");
            }
        }

        /// <summary>
        /// Barra, bolinha e carga: o passo do gesto dividido pela duração é onde o cursor parou. Nenhum gesto, ou
        /// o gesto no último passo, é erro.
        /// </summary>
        private static LeituraDaMira LerNoTempo(double zona, double duracao, double? passo, string oQue, string tipo)
        {
            if (passo == null) return Attack.LerMira(zona, null);
            ConferirPasso(passo.Value, duracao, oQue, tipo);
            return Attack.LerMira(zona, passo.Value >= duracao ? (double?)null : passo.Value / duracao);
        }

        /// <summary>
        /// Ritmo e toque duplo: cada nota fica com o primeiro toque da janela dela que ainda não foi de outra; a
        /// força é a média das notas (nota perdida vale zero), nunca abaixo da borda se alguma acertou; crita quem
        /// crita todas.
        /// </summary>
        private static LeituraDaMira LerNotas(EventoDeArma evento, List<double> toques)
        {
            string tipo = evento.Tipo;
            double zona = evento.Zona;
            var batidas = evento.Notas ?? new List<double>();
            double janela = evento.Janela ?? 0;
            double anterior = 0;
            foreach (var toque in toques)
            {
                ConferirPasso(toque, evento.Duracao, "toque", tipo);
                if (toque < anterior) throw new EngineError("toque " + Js.NumberToString(toque) + " antes do anterior (" + tipo + ")", "RangeError");
                anterior = toque;
            }

            var usados = new bool[toques.Count];
            var leituras = new List<LeituraDaMira>(batidas.Count);
            foreach (var batida in batidas)
            {
                int achou = -1;
                for (int k = 0; k < toques.Count; k++)
                {
                    if (!usados[k] && toques[k] >= batida - janela && toques[k] <= batida + janela)
                    {
                        achou = k;
                        break;
                    }
                }
                if (achou < 0)
                {
                    leituras.Add(Attack.LerMira(zona, null));
                    continue;
                }
                usados[achou] = true;
                leituras.Add(Attack.LerMira(zona, 0.5 + (toques[achou] - batida) / (2 * janela)));
            }

            bool algum = false, todosCriticos = true;
            double soma = 0;
            foreach (var l in leituras)
            {
                if (l.Acerto) algum = true;
                if (!l.Critico) todosCriticos = false;
                soma += l.Forca;
            }
            if (!algum) return Attack.LerMira(zona, null);
            return new LeituraDaMira
            {
                Acerto = true,
                Forca = Js.Max(Attack.ForcaNaBorda, Js.Round(soma / batidas.Count * 100) / 100),
                Critico = todosCriticos,
            };
        }

        /// <summary>
        /// Desenho: o erro é a distância média entre o traço e o símbolo, nos dois sentidos, e vale o pior dos
        /// dois; a demora além do tempo livre soma erro; o erro vira posição na régua (zero no centro,
        /// ERRO_NA_PONTA na ponta).
        /// </summary>
        private static LeituraDaMira LerDesenho(EventoDeArma evento, List<PontoDoTraco> traco)
        {
            double zona = evento.Zona;
            if (!D.Simbolos.TryGet(evento.Simbolo ?? "", out var simbolo) || simbolo == null)
                throw new EngineError("símbolo desconhecido: " + Js.Str(evento.Simbolo), "RangeError");
            if (traco.Count > D.PontosMaximosDoTraco)
            {
                throw new EngineError(
                    "traço com " + Js.NumberToString(traco.Count) + " pontos (máximo " + Js.NumberToString(D.PontosMaximosDoTraco) + ")", "RangeError");
            }
            double anterior = 0;
            foreach (var ponto in traco)
            {
                foreach (var eixo in new[] { ponto.X, ponto.Y })
                {
                    if (!EhInteiro(eixo) || eixo < 0 || eixo > D.TamanhoDoDesenho)
                    {
                        throw new EngineError(
                            "ponto (" + Js.NumberToString(ponto.X) + ", " + Js.NumberToString(ponto.Y) + ") fora da caixa do desenho", "RangeError");
                    }
                }
                ConferirPasso(ponto.T, evento.Duracao, "ponto no passo", TiposDeEvento.Desenho);
                if (ponto.T < anterior) throw new EngineError("ponto no passo " + Js.NumberToString(ponto.T) + " antes do anterior (desenho)", "RangeError");
                anterior = ponto.T;
            }
            if (traco.Count < 2) return Attack.LerMira(zona, null);

            var linha = new List<double[]>(traco.Count);
            foreach (var p in traco) linha.Add(new[] { p.X, p.Y });
            double erro = Js.Max(DistanciaMedia(simbolo, linha), DistanciaMedia(Densificar(traco), simbolo));
            double tempo = traco[traco.Count - 1].T - traco[0].T;
            double total = erro + Js.Max(0, tempo - D.TempoLivreDoDesenho) * D.ErroPorPasso;
            return Attack.LerMira(zona, Js.Min(1, 0.5 + total / (2 * D.ErroNaPonta)));
        }

        /// <summary>O traço com os buracos preenchidos: entre dois pontos, um a cada PASSO_DO_TRACO.</summary>
        private static List<double[]> Densificar(List<PontoDoTraco> traco)
        {
            var pontos = new List<double[]> { new[] { traco[0].X, traco[0].Y } };
            for (int i = 1; i < traco.Count; i++)
            {
                var a = traco[i - 1];
                var b = traco[i];
                double dx = b.X - a.X;
                double dy = b.Y - a.Y;
                double pedacos = Js.Max(1, Math.Ceiling(Math.Sqrt(dx * dx + dy * dy) / D.PassoDoTraco));
                for (double k = 1; k <= pedacos; k++)
                {
                    pontos.Add(new[] { a.X + Math.Floor(dx * k / pedacos), a.Y + Math.Floor(dy * k / pedacos) });
                }
            }
            return pontos;
        }

        /// <summary>
        /// A média, sobre os pontos, da distância até a linha (o trecho mais perto dela), cada distância e a média
        /// arredondadas para baixo. Uma linha de um ponto só é um trecho de comprimento zero.
        /// </summary>
        private static double DistanciaMedia(IReadOnlyList<IReadOnlyList<double>> pontos, IReadOnlyList<IReadOnlyList<double>> linha)
        {
            int trechos = Math.Max(1, linha.Count - 1);
            double soma = 0;
            foreach (var p in pontos)
            {
                double menor = double.PositiveInfinity;
                for (int i = 0; i < trechos; i++)
                {
                    var a = linha[i];
                    var b = linha[Math.Min(i + 1, linha.Count - 1)];
                    double d = DistanciaAoTrecho(p[0], p[1], a[0], a[1], b[0], b[1]);
                    if (d < menor) menor = d;
                }
                soma += Math.Floor(menor);
            }
            return Math.Floor(soma / pontos.Count);
        }

        /// <summary>A distância do ponto P ao trecho AB: até a ponta mais perto, ou na perpendicular quando ela cai dentro.</summary>
        private static double DistanciaAoTrecho(double px, double py, double ax, double ay, double bx, double by)
        {
            double abx = bx - ax;
            double aby = by - ay;
            double apx = px - ax;
            double apy = py - ay;
            double comprimento2 = abx * abx + aby * aby;
            double projecao = apx * abx + apy * aby;
            if (comprimento2 == 0 || projecao <= 0) return Math.Sqrt(apx * apx + apy * apy);
            if (projecao >= comprimento2) return Math.Sqrt((px - bx) * (px - bx) + (py - by) * (py - by));
            return Math.Abs(apx * aby - apy * abx) / Math.Sqrt(comprimento2);
        }
    }
}
