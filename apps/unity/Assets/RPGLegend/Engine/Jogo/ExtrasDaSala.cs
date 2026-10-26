using System;
using System.Collections.Generic;
using System.Globalization;

namespace RPGLegend.Engine
{
    /// <summary>TS: ResultadoDoExtra — o estado depois de encostar no extra, o aviso e o som (quando há).</summary>
    public sealed class ResultadoDoExtra
    {
        public EstadoNaMasmorra Estado;
        public Aviso Aviso;
        /// <summary>TS: Efeito — o efeito sonoro a tocar; null quando não há.</summary>
        public string Som;
    }

    /// <summary>O retorno de passagemSecreta no TS: <c>{ lado, indice }</c>.</summary>
    public sealed class PassagemSecreta
    {
        public string Lado;
        public double Indice;
    }

    /// <summary>As tabelas de jogo/extras.ts (fixtures/data/jogo/extras.json).</summary>
    public sealed class ExtrasDaSalaData
    {
        /// <summary>Privada no TS: o começo do id de cada extra na planta.</summary>
        [JsName("PREFIXO")] public string Prefixo;
        [JsName("ID_DO_BAU_SECRETO")] public string IdDoBauSecreto;
    }

    public static partial class GameData
    {
        private static ExtrasDaSalaData _extrasDaSalaTable;

        /// <summary>jogo/extras: os ids dos extras na planta.</summary>
        public static ExtrasDaSalaData ExtrasDaSalaTable
        {
            get => Require(_extrasDaSalaTable, "jogo/extras");
            set => _extrasDaSalaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/extras.ts: os extras das salas do lado do jogo — o que aparece na sala e o que
    /// acontece quando o herói encosta em cada um. Onde ficam e o que guardam sai de <see cref="RoomExtras"/>, na
    /// geração do andar. Regras do usuário que moram aqui: na sala de monstro nada se pega antes de vencer, e a
    /// parede rachada aberta leva a uma sala secreta fora do mapa.
    /// </summary>
    public static class ExtrasDaSala
    {
        private static ExtrasDaSalaData D => GameData.ExtrasDaSalaTable;

        /// <summary>TS: ID_DO_BAU_SECRETO — o baú da sala secreta na planta dela.</summary>
        public static string IdDoBauSecreto => D.IdDoBauSecreto;

        /// <summary>TS: idDoExtra.</summary>
        public static string IdDoExtra(double indice) => D.Prefixo + Js.NumberToString(indice);

        /// <summary>TS: indiceDoExtra — o índice do extra pelo id do objeto na planta; null se não é extra.</summary>
        public static double? IndiceDoExtra(string id)
        {
            if (!id.StartsWith(D.Prefixo, StringComparison.Ordinal)) return null;
            double indice = NumeroDoTexto(id.Substring(D.Prefixo.Length));
            return EInteiro(indice) ? indice : (double?)null;
        }

        /// <summary>O <c>Number(texto)</c> do JS para o que pode vir depois do prefixo: vazio é 0, espaço nas pontas some.</summary>
        private static double NumeroDoTexto(string texto)
        {
            var limpo = texto.Trim();
            if (limpo.Length == 0) return 0;
            if (limpo == "Infinity" || limpo == "+Infinity") return double.PositiveInfinity;
            if (limpo == "-Infinity") return double.NegativeInfinity;
            return double.TryParse(limpo, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint | NumberStyles.AllowExponent,
                CultureInfo.InvariantCulture, out var numero)
                ? numero
                : double.NaN;
        }

        /// <summary>O <c>Number.isInteger</c> do JS.</summary>
        private static bool EInteiro(double x) => !double.IsNaN(x) && !double.IsInfinity(x) && Math.Floor(x) == x;

        /// <summary>TS: extrasDe — os extras da sala (a cidade e os andares de antes deles não têm).</summary>
        public static List<DungeonExtra> ExtrasDe(RoomCell celula) => (celula as DungeonCell)?.Extras ?? new List<DungeonExtra>();

        /// <summary>O <c>lista[indice]</c> do JS: fora da lista, negativo ou quebrado é undefined (null).</summary>
        private static DungeonExtra ExtraEm(List<DungeonExtra> extras, double indice)
        {
            if (extras == null || !(indice >= 0) || indice >= extras.Count || Math.Floor(indice) != indice) return null;
            return extras[(int)indice];
        }

        /// <summary>TS: passagemSecreta — o lado da parede rachada já aberta, que agora é passagem pra sala secreta.</summary>
        public static PassagemSecreta PassagemSecreta(RoomCell celula)
        {
            var extras = ExtrasDe(celula);
            int indice = extras.FindIndex(e => e.Kind == "crack" && (e.Used ?? false) && Js.Truthy(e.Side));
            return indice < 0 ? null : new PassagemSecreta { Lado = extras[indice].Side, Indice = indice };
        }

        /// <summary>
        /// TS: objetosDaSala — o conteúdo no centro (quando há) e os extras que ainda ocupam lugar. Vaso quebrado
        /// some; parede aberta deixa de ser objeto e vira vão. O extra que caiu numa casa que a arte da masmorra faz de
        /// parede (os cantos da Caverna) ou enfeita (as tochas dela) anda rumo ao meio da sala até sair dela.
        /// </summary>
        public static List<RoomObject> ObjetosDaSala(RoomCell celula, bool temConteudo, string masmorra = null)
        {
            var objetos = temConteudo ? new List<RoomObject> { AndarNaSala.Conteudo() } : new List<RoomObject>();
            var paredes = ArteDaSala.ParedesDaSala(masmorra);
            paredes.AddRange(ArteDaSala.EnfeitesDaSala(masmorra));
            var meio = GameData.RoomWalkTable.ContentTile.Row;
            var extras = ExtrasDe(celula);
            for (int indice = 0; indice < extras.Count; indice++)
            {
                var extra = extras[indice];
                if (extra.Kind == "pot" && (extra.Used ?? false)) continue;
                if (extra.Kind == "crack" && (extra.Used ?? false)) continue;
                // A parede rachada fica no vão do lado dela, e não na casa gravada: o andar gravado quando a sala era
                // 9 × 7 a guardou no vão de lá.
                var vao = extra.Kind == "crack" && !string.IsNullOrEmpty(extra.Side) ? RoomWalk.DoorTile[extra.Side] : null;
                double col = vao?.Col ?? extra.Col;
                double row = vao?.Row ?? extra.Row;
                int rumo = Math.Sign(meio - row);
                while (rumo != 0 && NaParede(paredes, col, row)) row += rumo;
                objetos.Add(new RoomObject { Id = IdDoExtra(indice), Col = col, Row = row });
            }
            return objetos;
        }

        private static bool NaParede(List<TileRef> paredes, double col, double row)
        {
            foreach (var parede in paredes)
                if (parede.Col == col && parede.Row == row) return true;
            return false;
        }

        /// <summary>TS: plantaDaSalaSecreta — uma porta só, de volta pra sala da parede, e o baú no centro.</summary>
        public static RoomLayout PlantaDaSalaSecreta(string ladoDaParede, string masmorra = null)
        {
            var portas = new DoorMap();
            portas.Set(Directions.Opposite.Get(ladoDaParede), true);
            var centro = GameData.RoomWalkTable.ContentTile;
            return RoomWalk.Layout(portas, new List<RoomObject> { new RoomObject { Id = IdDoBauSecreto, Col = centro.Col, Row = centro.Row } },
                ArteDaSala.ParedesDaSala(masmorra));
        }

        private static ResultadoDoExtra Resultado(EstadoNaMasmorra estado, string icone, string titulo, string texto, string som = null) =>
            new ResultadoDoExtra { Estado = estado, Aviso = new Aviso(icone, titulo, texto), Som = som };

        /// <summary>TS: trocarExtra — a sala atual com o extra <paramref name="indice"/> mudado (cópia).</summary>
        private static EstadoNaMasmorra TrocarExtra(EstadoNaMasmorra estado, DungeonCell celula, int indice, Action<DungeonExtra> mudanca)
        {
            var extras = new List<DungeonExtra>();
            var originais = celula.Extras ?? new List<DungeonExtra>();
            for (int i = 0; i < originais.Count; i++)
            {
                if (i != indice)
                {
                    extras.Add(originais[i]);
                    continue;
                }
                var mudado = originais[i].Clone();
                mudanca(mudado);
                extras.Add(mudado);
            }
            var nova = celula.Clone();
            nova.Extras = extras;
            return Estados.SubstituirCelulaAtual(estado, nova);
        }

        private static string Adicionado(Item item) =>
            "<b>" + Items.DisplayName(item) + "</b> " +
            Items.Concordar(item, new[] { "foi adicionado", "foi adicionada", "foram adicionados", "foram adicionadas" }) + " à sua mochila.";

        /// <summary>O <c>{ ...estado, inventory: addItem(…), quests: onItemCollected(…) }</c> do TS.</summary>
        private static EstadoNaMasmorra ComItem(EstadoNaMasmorra estado, Item item)
        {
            var comItem = estado.Clone();
            comItem.Inventory = Inventory.AddItem(estado.Inventory, item);
            comItem.Quests = Quests.OnItemCollected(estado.Quests);
            return comItem;
        }

        private static EstadoNaMasmorra ComOuro(EstadoNaMasmorra estado, double ouro)
        {
            var hero = estado.Hero.Clone();
            hero.Gold = estado.Hero.Gold + ouro;
            var comOuro = estado.Clone();
            comOuro.Hero = hero;
            return comOuro;
        }

        /// <summary>TS: tocarExtra — o herói encostou no extra <paramref name="indice"/> da sala em que está.</summary>
        public static ResultadoDoExtra TocarExtra(EstadoNaMasmorra estado, double indice, RngFn rng)
        {
            var celula = Estados.CelulaAtual(estado) as DungeonCell;
            var extra = celula == null ? null : ExtraEm(celula.Extras, indice);
            if (celula == null || extra == null) return Resultado(estado, "❔", "Nada aqui", "Não há nada aqui.");

            // Decisão do usuário: na sala de monstro, nada se pega antes de vencer.
            if ((celula.Type == DungeonRoomTypes.Monster || celula.Type == DungeonRoomTypes.Boss) && !(celula.Beaten ?? false) && extra.Kind != "sign")
                return Resultado(estado, "⚔️", "Ainda não", "As criaturas não deixam você mexer em nada enquanto estiverem de pé.");

            int i = (int)indice;
            switch (extra.Kind)
            {
                case "chest":
                {
                    if (extra.Used ?? false) return Resultado(estado, "🧰", "Baú Vazio", "Este baú pequeno já foi aberto.");
                    if (extra.Item != null)
                        return Resultado(TrocarExtra(ComItem(estado, extra.Item), celula, i, e => e.Used = true), "🧰", "Baú Pequeno", Adicionado(extra.Item), "buy");
                    double ouro = RoomExtras.ExtraChestGold(Estados.AndarDeForca(estado), rng);
                    return Resultado(TrocarExtra(ComOuro(estado, ouro), celula, i, e => e.Used = true), "🧰", "Baú Pequeno",
                        "Você encontra " + Js.NumberToString(ouro) + " moedas de ouro no baú pequeno.", "gold");
                }
                case "pot":
                {
                    if (extra.Used ?? false) return Resultado(estado, "🏺", "Cacos", "Só sobraram cacos.");
                    double moedas = RoomExtras.PotCoins(rng);
                    return Resultado(TrocarExtra(ComOuro(estado, moedas), celula, i, e => e.Used = true), "🏺", "Vaso",
                        "O vaso se quebra e " + Js.NumberToString(moedas) + " " + (moedas == 1 ? "moeda rola" : "moedas rolam") + " pelo chão.", "gold");
                }
                case "sign":
                    return Resultado(estado, "🪧", "Placa", RoomExtras.SignHint(estado.Map, celula));
                case "crack":
                    if (extra.Used ?? false) return Resultado(estado, "🧱", "Passagem", "A passagem continua aberta.");
                    return Resultado(TrocarExtra(estado, celula, i, e => e.Used = true), "🧱", "Parede Rachada",
                        "A parede rachada cede com um empurrão e revela uma passagem estreita.", "door");
                default:
                    // O switch do TS não tem default: tipo desconhecido devolve undefined.
                    return null;
            }
        }

        /// <summary>TS: abrirBauSecreto — o herói encostou no baú da sala secreta, atrás da parede <paramref name="indice"/>.</summary>
        public static ResultadoDoExtra AbrirBauSecreto(EstadoNaMasmorra estado, double indice)
        {
            var celula = Estados.CelulaAtual(estado) as DungeonCell;
            var extra = celula == null ? null : ExtraEm(celula.Extras, indice);
            if (celula == null || extra?.Kind != "crack" || extra.SecretItem == null) return Resultado(estado, "❔", "Nada aqui", "Não há nada aqui.");
            if (extra.SecretCollected ?? false) return Resultado(estado, "🧰", "Baú Vazio", "O baú escondido já está vazio.");

            return Resultado(TrocarExtra(ComItem(estado, extra.SecretItem), celula, (int)indice, e => e.SecretCollected = true), "💎", "Baú Escondido",
                Adicionado(extra.SecretItem), "buy");
        }

        /// <summary>TS: textoDaSecreta — a narração da sala secreta atrás da parede <paramref name="indice"/>.</summary>
        public static string TextoDaSecreta(RoomCell celula, double indice) =>
            ExtraEm(ExtrasDe(celula), indice)?.SecretCollected ?? false
                ? "Uma câmara escondida atrás da parede. O baú já está vazio."
                : "Uma câmara escondida atrás da parede, coberta de poeira. Um baú esquecido espera no centro.";

        /// <summary>TS: fraseDoExtra — a frase de um extra, sozinho e em par (a sala pode sortear dois iguais).</summary>
        private static (string Uma, string Duas)? FraseDoExtra(DungeonExtra extra)
        {
            bool usado = extra.Used ?? false;
            switch (extra.Kind)
            {
                case "chest":
                    return usado
                        ? ("Num canto, um baú pequeno aberto.", "Dois baús pequenos abertos, cada um num canto.")
                        : ("Num canto, um baú pequeno.", "Dois baús pequenos, cada um num canto.");
                case "pot":
                    return usado
                        ? ("Cacos de um vaso pelo chão.", "Cacos de dois vasos pelo chão.")
                        : ("Um vaso de barro encostado na parede.", "Dois vasos de barro encostados na parede.");
                case "sign":
                    return ("Uma placa de madeira presa à parede.", "Duas placas de madeira presas à parede.");
                case "crack":
                    return usado
                        ? ("Uma passagem estreita se abre numa das paredes.", "Duas passagens estreitas se abrem nas paredes.")
                        : ("Uma das paredes tem uma rachadura funda.", "Duas das paredes têm rachaduras fundas.");
                default:
                    return null;
            }
        }

        /// <summary>
        /// TS: descricaoDosExtras — uma linha pra narração, na ordem em que os extras aparecem. Dois iguais no mesmo
        /// estado viram uma frase só, no plural; estados diferentes continuam separados.
        /// </summary>
        public static string DescricaoDosExtras(RoomCell celula)
        {
            var ordem = new List<string>();
            var frases = new Dictionary<string, (string Duas, int Vezes)>();
            foreach (var extra in ExtrasDe(celula))
            {
                var frase = FraseDoExtra(extra);
                if (frase == null) continue;
                var (uma, duas) = frase.Value;
                if (frases.TryGetValue(uma, out var ja)) frases[uma] = (ja.Duas, ja.Vezes + 1);
                else
                {
                    frases[uma] = (duas, 1);
                    ordem.Add(uma);
                }
            }
            var linha = new List<string>();
            foreach (var uma in ordem) linha.Add(frases[uma].Vezes > 1 ? frases[uma].Duas : uma);
            return string.Join(" ", linha);
        }
    }
}
