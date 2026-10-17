using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Runa — o ícone de um tipo de runa, e a chance e a força por tier (I, II, III).</summary>
    public sealed class RunaDef
    {
        public string Icone;
        public List<double> Chance = new List<double>();
        public List<double> Forca = new List<double>();
    }

    /// <summary>As tabelas de items/runas.ts (fixtures/data/items/runas.json).</summary>
    public sealed class RunasData
    {
        [JsName("RUNAS")] public OrderedMap<RunaDef> Runas = new OrderedMap<RunaDef>();
        [JsName("TIPOS_DE_RUNA")] public List<string> TiposDeRuna = new List<string>();
        [JsName("ANDAR_DO_TIER")] public List<double> AndarDoTier = new List<double>();
        [JsName("CHANCE_DA_RUNA_NO_CHEFE")] public double ChanceDaRunaNoChefe;
        [JsName("CHANCE_DA_RUNA_NO_BAU")] public double ChanceDaRunaNoBau;
        [JsName("QUEBRA_AO_TIRAR")] public List<double> QuebraAoTirar = new List<double>();
        [JsName("VALOR_DO_TIER")] public List<double> ValorDoTier = new List<double>();
        [JsName("ESPACOS_MAXIMOS")] public double EspacosMaximos;
        [JsName("RARIDADE_COM_ESPACO")] public string RaridadeComEspaco;
        [JsName("TIER_COM_ESPACO")] public string TierComEspaco;
        [JsName("CHANCE_MAXIMA_DA_RUNA")] public double ChanceMaximaDaRuna;
        [JsName("TURNOS_DA_RUNA")] public double TurnosDaRuna;
    }

    public static partial class GameData
    {
        private static RunasData _runasTable;

        /// <summary>items/runas: os tipos de runa, os tiers, os espaços da arma e as chances.</summary>
        public static RunasData RunasTable
        {
            get => Require(_runasTable, "items/runas");
            set => _runasTable = value;
        }
    }

    /// <summary>TS: ResultadoDoEngaste. Kind: "engastou", "substituiu", "cheia", "nao_e_arma" ou "nao_e_runa".</summary>
    public sealed class ResultadoDoEngaste
    {
        public string Kind;
        public Item Arma;
        /// <summary>"substituiu": a runa que estava no espaço e se desfez.</summary>
        public RunaNaArma Destruida;
    }

    /// <summary>TS: ResultadoDaRetirada. Kind: "voltou" (com a runa como item), "quebrou" ou "sem_runa".</summary>
    public sealed class ResultadoDaRetirada
    {
        public string Kind;
        public Item Arma;
        public Item Runa;
        public RunaNaArma Quebrada;
    }

    /// <summary>O que aposMudarDeTier devolve: a arma com as runas que cabem, e as que voltaram como itens.</summary>
    public sealed class AjusteDasRunas
    {
        public Item Arma;
        public List<Item> Devolvidas;
    }

    /// <summary>TS: EfeitoDeRuna — o efeito de um tipo de runa na arma, com as iguais já somadas.</summary>
    public sealed class EfeitoDeRuna
    {
        public string Runa;
        public double Chance;
        public double Forca;
    }

    /// <summary>TS: DisparoDeRuna — uma runa que disparou no golpe, e o número que a tela mostra.</summary>
    public sealed class DisparoDeRuna
    {
        public string Runa;
        public double Valor;
    }

    /// <summary>O que aplicarRunas devolve: o herói (a cura), o monstro (o choque, os status) e o que disparou.</summary>
    public sealed class ResultadoDasRunas
    {
        public Hero Hero;
        public CombatMonsterView Monster;
        public List<DisparoDeRuna> Disparos;
    }

    /// <summary>
    /// Port de shared/src/items/runas.ts: as runas, só do app (decisões do usuário, 2026-10-17). Pedras raras de
    /// baú e de chefe, em quatro tipos (elétrica, fogo, gelo, vampírica) e três tiers, que dão uma habilidade à arma
    /// em que são engastadas. A arma tem de um a quatro espaços (mítica, último degrau do material, tier A ou
    /// acima); a mesma runa pode ir duas vezes, e elas somam. Tirar pode quebrar a runa (pelo tier). Só a arena
    /// aplica as runas; no site a arma vale só pelos atributos.
    /// </summary>
    public static class Runas
    {
        private static RunasData D => GameData.RunasTable;

        /// <summary>O ícone do tipo de runa.</summary>
        public static string IconeDe(string runa) => D.Runas.TryGet(runa, out var def) && def != null ? def.Icone : "";

        private static double TierValido(double? tier) =>
            Js.Min(GameData.ItemTable.Romanos.Count, Js.Max(1, Math.Truncate(tier ?? 1)));

        private static ItemTemplate TemplateDaRuna(string runa)
        {
            var template = ItemTemplates.ByCategory("runa").Find(t => t.Runa == runa);
            if (template == null) throw new EngineError("runa sem modelo no catálogo: " + Js.Str(runa), "Error");
            return template;
        }

        /// <summary>TS: runaDoItem — o tipo da runa deste item, ou null se ele não é runa.</summary>
        public static string RunaDoItem(Item item) => ItemTemplates.ByCategory("runa").Find(t => t.Id == item.TemplateId)?.Runa;

        /// <summary>TS: tierDaRuna — o tier da runa deste item, de 1 a 3.</summary>
        public static double TierDaRuna(Item item) => TierValido(item.TierDaRuna);

        /// <summary>TS: nomeDaRuna — o nome de uma runa engastada: "Runa de Fogo II".</summary>
        public static string NomeDaRuna(RunaNaArma runa) =>
            TemplateDaRuna(runa.Runa).Name + " " + GameData.ItemTable.Romanos[(int)TierValido(runa.Tier) - 1];

        /// <summary>TS: runasDaArma — as runas engastadas, em ordem.</summary>
        public static List<RunaNaArma> RunasDaArma(Item item) => item.Runas ?? new List<RunaNaArma>();

        /// <summary>
        /// TS: espacosDeRuna — nenhum fora das armas; numa arma, um, mais um se for mítica, mais um se for do último
        /// degrau do material e mais um se for tier A ou acima, até o teto.
        /// </summary>
        public static double EspacosDeRuna(Item item)
        {
            if (Items.CategoryOf(item) != "arma") return 0;
            double espacos = 1;
            var raridades = GameData.RarityTable.RarityIds;
            if (raridades.IndexOf(item.Rarity) >= raridades.IndexOf(D.RaridadeComEspaco)) espacos += 1;
            if ((item.Degrau ?? 1) >= Materiais.UltimoDegrau) espacos += 1;
            if (Tiers.RankOf(item) >= Tiers.Order.IndexOf(D.TierComEspaco)) espacos += 1;
            return Js.Min(D.EspacosMaximos, espacos);
        }

        /// <summary>TS: criarRuna — o item de uma runa: comum, com o tier no nome e no valor. Um número do rng, o do uid.</summary>
        public static Item CriarRuna(string runa, double tier, RngFn rng = null, Func<double> now = null)
        {
            var template = TemplateDaRuna(runa);
            double t = TierValido(tier);
            var item = Items.Instantiate(template, Rarities.All[0], rng, now);
            item.Value = Js.Round(template.Value * D.ValorDoTier[(int)t - 1]);
            item.TierDaRuna = t;
            return item;
        }

        /// <summary>TS: tierMaximoNoAndar — o tier mais alto que cai neste andar, sem contar o do chefe.</summary>
        public static double TierMaximoNoAndar(double andar)
        {
            double liberados = 0;
            foreach (var desde in D.AndarDoTier)
                if (andar >= desde) liberados += 1;
            return Js.Max(1, liberados);
        }

        /// <summary>TS: sortearRuna — o tipo, o tier (até o do andar; o chefe um acima, até o III) e o uid.</summary>
        public static Item SortearRuna(double andar, bool chefe = false, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            var tipos = D.TiposDeRuna;
            string runa = tipos[(int)Rng.RandomInt(tipos.Count, rng)];
            double tier = 1 + Rng.RandomInt(TierMaximoNoAndar(andar), rng) + (chefe ? 1 : 0);
            return CriarRuna(runa, tier, rng, now);
        }

        /// <summary>A arma com estas runas, e sem o campo quando não sobra nenhuma.</summary>
        private static Item ComRunas(Item arma, List<RunaNaArma> runas)
        {
            var copia = arma.Clone();
            copia.Runas = runas.Count > 0 ? runas : null;
            return copia;
        }

        private static bool EhIndice(double? indice, int tamanho) =>
            indice != null && indice.Value == Math.Floor(indice.Value) && indice.Value >= 0 && indice.Value < tamanho;

        /// <summary>
        /// TS: engastar — no primeiro espaço livre, ou, com a arma cheia, no espaço <paramref name="indice"/>,
        /// destruindo a runa que estava lá. Cheia e sem índice válido, não engasta.
        /// </summary>
        public static ResultadoDoEngaste Engastar(Item arma, Item runa, double? indice = null)
        {
            double espacos = EspacosDeRuna(arma);
            if (espacos == 0) return new ResultadoDoEngaste { Kind = "nao_e_arma" };
            string tipo = RunaDoItem(runa);
            if (tipo == null) return new ResultadoDoEngaste { Kind = "nao_e_runa" };

            var nova = new RunaNaArma { Runa = tipo, Tier = TierDaRuna(runa) };
            var runas = RunasDaArma(arma);
            if (runas.Count < espacos)
            {
                var comANova = new List<RunaNaArma>(runas) { nova };
                return new ResultadoDoEngaste { Kind = "engastou", Arma = ComRunas(arma, comANova) };
            }
            if (!EhIndice(indice, runas.Count)) return new ResultadoDoEngaste { Kind = "cheia" };
            int i = (int)indice.Value;
            var trocadas = new List<RunaNaArma>(runas);
            trocadas[i] = nova;
            return new ResultadoDoEngaste { Kind = "substituiu", Arma = ComRunas(arma, trocadas), Destruida = runas[i] };
        }

        /// <summary>
        /// TS: tirar — um número do rng decide se a runa quebra (pelo tier); se não quebrou, ela volta como item (mais
        /// um número, o do uid).
        /// </summary>
        public static ResultadoDaRetirada Tirar(Item arma, double indice, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            var runas = RunasDaArma(arma);
            if (!EhIndice(indice, runas.Count)) return new ResultadoDaRetirada { Kind = "sem_runa" };
            int i = (int)indice;
            var alvo = runas[i];
            var resto = new List<RunaNaArma>(runas);
            resto.RemoveAt(i);
            var semEla = ComRunas(arma, resto);
            if (rng() < D.QuebraAoTirar[(int)TierValido(alvo.Tier) - 1])
                return new ResultadoDaRetirada { Kind = "quebrou", Arma = semEla, Quebrada = alvo };
            return new ResultadoDaRetirada { Kind = "voltou", Arma = semEla, Runa = CriarRuna(alvo.Runa, alvo.Tier, rng, now) };
        }

        /// <summary>
        /// TS: aposMudarDeTier — as runas além dos espaços da arma saem, as últimas primeiro, e voltam inteiras como
        /// itens. Sem sobra, não gasta o rng.
        /// </summary>
        public static AjusteDasRunas AposMudarDeTier(Item arma, RngFn rng = null, Func<double> now = null)
        {
            var runas = RunasDaArma(arma);
            double espacos = EspacosDeRuna(arma);
            if (runas.Count <= espacos) return new AjusteDasRunas { Arma = arma, Devolvidas = new List<Item>() };
            int cabem = (int)espacos;
            var devolvidas = new List<Item>();
            for (int i = cabem; i < runas.Count; i++) devolvidas.Add(CriarRuna(runas[i].Runa, runas[i].Tier, rng ?? Rng.Default, now));
            return new AjusteDasRunas { Arma = ComRunas(arma, runas.GetRange(0, cabem)), Devolvidas = devolvidas };
        }

        /// <summary>TS: efeitosDaArma — as runas juntas por tipo, na ordem de TIPOS_DE_RUNA: as iguais somam a chance (com teto) e a força.</summary>
        public static List<EfeitoDeRuna> EfeitosDaArma(Item arma)
        {
            var runas = arma != null ? RunasDaArma(arma) : new List<RunaNaArma>();
            var efeitos = new List<EfeitoDeRuna>();
            foreach (var tipo in D.TiposDeRuna)
            {
                double chance = 0, forca = 0;
                int quantas = 0;
                var def = D.Runas.Get(tipo);
                foreach (var r in runas)
                {
                    if (r.Runa != tipo) continue;
                    int t = (int)TierValido(r.Tier) - 1;
                    chance += def.Chance[t];
                    forca += def.Forca[t];
                    quantas += 1;
                }
                if (quantas > 0) efeitos.Add(new EfeitoDeRuna { Runa = tipo, Chance = Js.Min(D.ChanceMaximaDaRuna, chance), Forca = forca });
            }
            return efeitos;
        }

        /// <summary>
        /// TS: aplicarRunas — o acerto do herói passa pelas runas da arma (só a arena chama). Cada tipo sorteia uma
        /// vez: a elétrica tira a mais (e atordoa), o fogo queima, o gelo deixa lento, a vampírica cura quem bate.
        /// </summary>
        public static ResultadoDasRunas AplicarRunas(Hero hero, CombatMonsterView monster, double dano, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var heroi = hero;
            var monstro = monster;
            var disparos = new List<DisparoDeRuna>();
            foreach (var efeito in EfeitosDaArma(hero.Equip.Get("arma")))
            {
                if (rng() >= efeito.Chance) continue;
                switch (efeito.Runa)
                {
                    case "eletrica":
                    {
                        double choque = Js.Max(1, Js.Round(dano * efeito.Forca));
                        var status = MonsterState.SetStatusField(monstro.Status, "atordoado", (double?)((monstro.Status?.Atordoado ?? 0) + 1));
                        var proximo = monstro.Clone();
                        proximo.Hp = Js.Max(0, monstro.Hp - choque);
                        proximo.Status = status;
                        monstro = proximo;
                        disparos.Add(new DisparoDeRuna { Runa = "eletrica", Valor = choque });
                        break;
                    }
                    case "fogo":
                    {
                        double queima = Js.Max(2, Js.Round(dano * efeito.Forca));
                        var proximo = monstro.Clone();
                        proximo.Status = MonsterState.SetStatusField(monstro.Status, "queimadura", new DotStatus { Turns = D.TurnosDaRuna, Dmg = queima });
                        monstro = proximo;
                        disparos.Add(new DisparoDeRuna { Runa = "fogo", Valor = queima });
                        break;
                    }
                    case "gelo":
                    {
                        var proximo = monstro.Clone();
                        proximo.Status = MonsterState.SetStatusField(monstro.Status, "lento", new AmountStatus { Turns = D.TurnosDaRuna, Amount = efeito.Forca });
                        monstro = proximo;
                        disparos.Add(new DisparoDeRuna { Runa = "gelo", Valor = efeito.Forca });
                        break;
                    }
                    case "vampirica":
                    {
                        double cura = Js.Max(0, Js.Min(heroi.MaxHp - heroi.Hp, Js.Max(1, Js.Round(dano * efeito.Forca))));
                        var curado = heroi.Clone();
                        curado.Hp = heroi.Hp + cura;
                        heroi = curado;
                        disparos.Add(new DisparoDeRuna { Runa = "vampirica", Valor = cura });
                        break;
                    }
                }
            }
            return new ResultadoDasRunas { Hero = heroi, Monster = monstro, Disparos = disparos };
        }
    }
}
