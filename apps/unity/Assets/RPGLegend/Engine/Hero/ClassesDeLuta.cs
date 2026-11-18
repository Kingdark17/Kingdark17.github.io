namespace RPGLegend.Engine
{
    /// <summary>TS: ClasseDeLuta — os números de uma classe na luta: o alcance em blocos, e a vida, o dano e a velocidade em %.</summary>
    public sealed class ClasseDeLuta
    {
        public double Alcance;
        public double Vida;
        public double Dano;
        public double Velocidade;
        /// <summary>A mana máxima, em % da de sempre: vale em todo lugar, como a vida (o Mago guarda +20%).</summary>
        public double Mana;
    }

    /// <summary>As tabelas de hero/classes-de-luta.ts (fixtures/data/hero/classes-de-luta.json).</summary>
    public sealed class ClassesDeLutaData
    {
        [JsName("CLASSE_PADRAO")] public ClasseDeLuta ClassePadrao;
        [JsName("CLASSES_DE_LUTA")] public OrderedMap<ClasseDeLuta> Classes;
        [JsName("ALCANCE_DO_BARBARO")] public OrderedMap<double> AlcanceDoBarbaro;
        [JsName("ALCANCE_SEM_CLASSE")] public OrderedMap<double> AlcanceSemClasse;
        [JsName("MAOS_DO_MONGE")] public MaosDoMonge MaosDoMonge;
        [JsName("CLASSES_REFEITAS")] public System.Collections.Generic.List<string> ClassesRefeitas = new System.Collections.Generic.List<string>();
        [JsName("REGRAS_DO_GUERREIRO")] public RegrasDoGuerreiro Guerreiro;
        [JsName("REGRAS_DO_LADINO")] public RegrasDoLadino Ladino;
        [JsName("REGRAS_DO_BARBARO")] public RegrasDoBarbaro Barbaro;
        [JsName("REGRAS_DO_PALADINO")] public RegrasDoPaladino Paladino;
        [JsName("REGRAS_DO_ARQUEIRO")] public RegrasDoArqueiro Arqueiro;
        [JsName("REGRAS_DO_BARDO")] public RegrasDoBardo Bardo;
        [JsName("REGRAS_DA_MORAL")] public RegrasDaMoral Moral;
        [JsName("REGRAS_DO_CLERIGO")] public RegrasDoClerigo Clerigo;
        [JsName("MORTOS_VIVOS")] public System.Collections.Generic.List<string> MortosVivos = new System.Collections.Generic.List<string>();
        [JsName("REGRAS_DO_DRUIDA")] public RegrasDoDruida Druida;
        [JsName("REGRAS_DE_CANALIZAR")] public RegrasDeCanalizar Canalizar;
        [JsName("REGRAS_DO_MONGE")] public RegrasDoMonge Monge;
        [JsName("REGRAS_DO_MAGO")] public RegrasDoMago Mago;
    }

    /// <summary>TS: REGRAS_DE_CANALIZAR — segurando K, a mana e o ki que entram por segundo.</summary>
    public sealed class RegrasDeCanalizar
    {
        public double ManaPorSegundo;
        public double KiPorSegundo;
    }

    /// <summary>TS: REGRAS_DO_MONGE — o ki, o revestimento e a explosão.</summary>
    public sealed class RegrasDoMonge
    {
        public double TetoDoKi;
        public double Revestir;
        public double DanoRevestido;
        public double EscudoRevestido;
        public double RaioDaExplosao;
        public double ForcaDaExplosao;
        public double EmpurraNaExplosao;
    }

    /// <summary>TS: REGRAS_DO_MAGO — o disparo mágico na luta do app.</summary>
    public sealed class RegrasDoMago
    {
        public double CustoDoDisparo;
    }

    /// <summary>TS: REGRAS_DO_ARQUEIRO — o dano de perto, o de longe parado e a mira maior.</summary>
    public sealed class RegrasDoArqueiro
    {
        public double Perto;
        public double DanoDePerto;
        public double PorBloco;
        public double Teto;
        public double Parado;
        public double Mira;
    }

    /// <summary>TS: REGRAS_DO_BARDO — a cura, o reforço e a moral.</summary>
    public sealed class RegrasDoBardo
    {
        public double Cura;
        public double Forca;
        public double TempoDaForca;
        public double CriticosDaMoral;
        public double TetoDaMoral;
    }

    /// <summary>TS: REGRAS_DA_MORAL — os degraus da moral do grupo.</summary>
    public sealed class RegrasDaMoral
    {
        public double NivelDaVelocidade;
        public double Velocidade;
        public double DanoNaVelocidade;
        public double NivelDaResistencia;
        public double Resistencia;
        public double DanoNaResistencia;
        public double NivelSemQuebrar;
        public double NivelDoCritico;
        public double Critico;
        public double DanoNoCritico;
        public double NivelDaFaixa;
        public double FaixaCritica;
    }

    /// <summary>TS: REGRAS_DO_CLERIGO — a cura, o golpe sagrado e o Poder da fé.</summary>
    public sealed class RegrasDoClerigo
    {
        public double Cura;
        public double MortoVivo;
        public double RecargaDaFe;
        public double CuraDaFe;
        public double PisoDaVida;
        public double Janela;
        public double TetoDaComunhao;
        public double TetoDoEgoista;
        public double DivisorDoEgoista;
    }

    /// <summary>TS: REGRAS_DO_DRUIDA — as vinhas, o lento e o veneno, a Purificação.</summary>
    public sealed class RegrasDoDruida
    {
        public double Vinhas;
        public double Lento;
        public double Veneno;
        public double Turnos;
        public double Purificacao;
        public double SemAtacar;
    }

    /// <summary>TS: EfeitosDaMoral — o que a moral dá ao grupo, somando os degraus.</summary>
    public sealed class EfeitosDaMoral
    {
        public double Velocidade;
        public double Dano;
        public double Resistencia;
        public bool SemQuebrar;
        public double Critico;
        public double FaixaCritica;
    }

    /// <summary>TS: Moral — a moral do grupo (o nível e os críticos no aliado desde o último). Ausente (null) é zero.</summary>
    public sealed class Moral
    {
        public double? Nivel;
        public double? Criticos;

        public Moral Clone() => (Moral)MemberwiseClone();
    }

    /// <summary>TS: o retorno de contarCriticoNoAliado — a moral nova e, se subiu, o nível novo.</summary>
    public sealed class CriticoNoAliado
    {
        public Moral Moral;
        public double? Subiu;
    }

    /// <summary>TS: ExtrasDaClasse — o que a linha da classe mostra além dos contadores (em passos).</summary>
    public sealed class ExtrasDaClasse
    {
        public double? Moral;
        public double? RecargaDaFe;
        public double? Fe;
        public double? SemAtacar;
        /// <summary>Druida: quantas flores do Florescimento estão no chão (rodada 5b).</summary>
        public double? Flores;
        /// <summary>Monge: o ki, e se está revestido.</summary>
        public double? Ki;
        public bool? Revestido;
        /// <summary>Segurando K neste passo.</summary>
        public bool? Canalizando;
        /// <summary>Necromante: quanto falta pra Magia Proibida voltar, e se ela está selada.</summary>
        public double? RecargaDaMagia;
        public bool? MagiaSelada;
    }

    /// <summary>TS: REGRAS_DO_GUERREIRO — colado no alvo, o combo e a resistência pela vida que falta.</summary>
    public sealed class RegrasDoGuerreiro
    {
        public double Colado;
        public double CriticosDoCombo;
        public double Combo;
        public double DegrauDaVida;
        public double ResistenciaPorDegrau;
    }

    /// <summary>TS: REGRAS_DO_LADINO — o crítico dele e a furtividade.</summary>
    public sealed class RegrasDoLadino
    {
        public double Critico;
        public double CriticosDaFurtividade;
        public double Esquiva;
        public double TetoDaEsquiva;
        public double Ataque;
        public double AtaqueDepoisDoTeto;
        public double ContraOChefe;
    }

    /// <summary>TS: REGRAS_DO_BARBARO — a fúria e as armas pesadas em área.</summary>
    public sealed class RegrasDoBarbaro
    {
        public double TetoDaFuria;
        public double DanoPorFuria;
        public double ResistenciaPorFuria;
        public double Calma;
        public double PerdeNaCalma;
        public double LadoDoTremor;
        public double Marreta;
        public double LadoDaBola;
        public double EmpurraNaMaca;
        public double LarguraDoCorte;
        public double AtordoaNoMachado;
        public double NosOutros;
    }

    /// <summary>TS: REGRAS_DO_PALADINO — o avanço, a devolução, a absorção e o foco.</summary>
    public sealed class RegrasDoPaladino
    {
        public double Empurrao;
        public double Devolve;
        public double DevolveNoTeto;
        public double AbsorvePorGolpe;
        public double TetoDaAbsorcao;
        public double AbsorcaoQueResiste;
        public double Resistencia;
        public double Foco;
    }

    /// <summary>TS: ContadoresDaClasse — o que a classe junta durante uma luta do app. Ausente (null) é zero.</summary>
    public sealed class ContadoresDaClasse
    {
        public double? Seguidos;
        public double? Combo;
        public double? Criticos;
        public double? Furtividade;
        public double? Furia;
        public double? Calmo;
        public double? Absorcao;
        public double? Parado;
        /// <summary>Os estilos (rodada 5a): a espera do avanço do Espadachim e a imunidade dele; as cargas da Concentração e os passos sem golpear.</summary>
        public double? RecargaDoEstilo;
        public double? Imune;
        public double? Cargas;
        public double? SemGolpe;
        /// <summary>Os estilos do Druida (rodada 5b): quantos ataques ele já deu nesta luta.</summary>
        public double? Golpes;
        /// <summary>O Vento do Mago (rodada 5c): os passos que ainda faltam do passo mais ligeiro.</summary>
        public double? Ventania;
        /// <summary>A aljava ao lado do arco (rodada 6b): as flechas que já acertaram nesta luta.</summary>
        public double? Flechadas;

        public ContadoresDaClasse Clone() => (ContadoresDaClasse)MemberwiseClone();
    }

    /// <summary>TS: AcertoDaClasse — os contadores depois do acerto e, se subiu, o combo (o total em %) ou a furtividade.</summary>
    public sealed class AcertoDaClasse
    {
        public ContadoresDaClasse Contadores;
        public double? Combo;
        public double? Furtividade;
    }

    /// <summary>TS: MAOS_DO_MONGE — o ataque das mãos do Monge: a base e mais 1 a cada tantos níveis.</summary>
    public sealed class MaosDoMonge
    {
        public double Base;
        public double ACadaNiveis;
    }

    public static partial class GameData
    {
        private static ClassesDeLutaData _classesDeLutaTable;

        /// <summary>hero/classes-de-luta: os números de cada classe na luta.</summary>
        public static ClassesDeLutaData ClassesDeLutaTable
        {
            get => Require(_classesDeLutaTable, "hero/classes-de-luta");
            set => _classesDeLutaTable = value;
        }
    }

    /// <summary>
    /// Os números de cada classe na luta (port de shared/src/hero/classes-de-luta.ts; doc do Breno de 2026-11-15): o
    /// alcance do ataque comum em blocos (só a arena usa), a vida em % (vale em todo lugar, dentro de
    /// <see cref="Derived.Compute"/>), e o dano e a velocidade de andar em % (só a arena).
    /// </summary>
    public static class ClassesDeLuta
    {
        private static ClassesDeLutaData D => GameData.ClassesDeLutaTable;

        /// <summary>TS: classeDeLuta — os números da classe; sem classe (ou uma que a tabela não traz), os do padrão.</summary>
        public static ClasseDeLuta De(string classId, string className)
        {
            var id = Catalog.IdDaClasse(classId, className);
            if (Js.Truthy(id) && D.Classes.TryGet(id, out var classe) && classe != null) return classe;
            return D.ClassePadrao;
        }

        public static ClasseDeLuta De(Hero hero) => De(hero.ClassId, hero.ClassName);

        /// <summary>
        /// TS: alcanceDoHeroi — em blocos: o da classe, o da arma pesada no Bárbaro, o da arma sem classe; e os
        /// estilos do Monge (o chute vai longe, a concentração dá +1). <paramref name="estilo"/> é o estilo ativo
        /// (<see cref="Estilos.IdDoEstilo(Hero)"/>).
        /// </summary>
        public static double AlcanceDoHeroi(string classId, string className, string arma, string estilo = null, string secundaria = null)
        {
            var id = Catalog.IdDaClasse(classId, className);
            arma = arma ?? "";
            if (id == "barbaro")
                return D.AlcanceDoBarbaro.TryGet(arma, out var pesada) ? pesada : D.Classes.Get("barbaro").Alcance;
            if (!Js.Truthy(id) || !D.Classes.TryGet(id, out var classe) || classe == null)
                return D.AlcanceSemClasse.TryGet(arma, out var semClasse) ? semClasse : D.ClassePadrao.Alcance;
            if (estilo == "chute") return Estilos.Chute.Alcance;
            if (estilo == "concentracao") return classe.Alcance + Estilos.Concentracao.Alcance;
            // Os do Druida (rodada 5b): a garra e a flor shuriken saem do herói.
            if (estilo == "metamorfose") return Estilos.Metamorfose.Alcance;
            if (estilo == "florescimento") return Estilos.Florescimento.Alcance;
            // A aljava ao lado do arco (rodada 6b) dá 1 bloco a mais.
            return classe.Alcance + (PecasSecretas.AljavaNoArco(arma, secundaria) != null ? PecasSecretas.RegrasDasAljavas.Alcance : 0);
        }

        public static double AlcanceDoHeroi(Hero hero) =>
            AlcanceDoHeroi(hero.ClassId, hero.ClassName, hero.Equip?.Get("arma")?.TemplateId, Estilos.IdDoEstilo(hero), hero.Equip?.Get("secundaria")?.TemplateId);

        /// <summary>
        /// TS: ataqueDasMaos — o ataque das mãos: só o Monge sem arma na mão principal; os outros, 0. Nível ausente
        /// (null) conta como 1.
        /// </summary>
        public static double AtaqueDasMaos(string classId, string className, double? level, bool temArma)
        {
            if (Catalog.IdDaClasse(classId, className) != "monge" || temArma) return 0;
            return D.MaosDoMonge.Base + System.Math.Floor(Js.Max(1, level ?? 1) / D.MaosDoMonge.ACadaNiveis);
        }

        /// <summary>TS: manaComAClasse — a mana de sempre vezes a % da classe, arredondada (o Mago guarda +20%).</summary>
        public static double ManaComAClasse(double mana, string classId, string className)
        {
            double pct = De(classId, className).Mana;
            return pct == 100 ? mana : Js.Round(mana * pct / 100);
        }

        /// <summary>TS: vidaComAClasse — a vida de sempre vezes a % da classe, arredondada.</summary>
        public static double VidaComAClasse(double vida, string classId, string className)
        {
            double pct = De(classId, className).Vida;
            return pct == 100 ? vida : Js.Round(vida * pct / 100);
        }

        // ---------- as classes refeitas na luta do app (rodada 3a, 2026-11-17) ----------

        private static double Z(double? valor) => valor ?? 0;

        /// <summary>TS: classeRefeita — o doc do Breno já refez a classe: na arena ela fica sem a passiva antiga do site.</summary>
        public static bool ClasseRefeita(string classId, string className)
        {
            var id = Catalog.IdDaClasse(classId, className);
            return Js.Truthy(id) && D.ClassesRefeitas.Contains(id);
        }

        public static bool ClasseRefeita(Hero hero) => ClasseRefeita(hero.ClassId, hero.ClassName);

        /// <summary>TS: criticoDaClasse — o multiplicador do crítico do Ladino na arena; nos outros, null (o de sempre).</summary>
        public static double? CriticoDaClasse(string classId, string className) =>
            Catalog.IdDaClasse(classId, className) == "ladino" ? D.Ladino.Critico : (double?)null;

        /// <summary>TS: furtividadeEm — a furtividade em esquiva e ataque (%), antes do corte contra o chefe.</summary>
        private static void FurtividadeEm(double n, out double esquiva, out double ataque)
        {
            var r = D.Ladino;
            double ateOTeto = Js.Min(n, System.Math.Truncate(r.TetoDaEsquiva / r.Esquiva));
            esquiva = ateOTeto * r.Esquiva;
            ataque = ateOTeto * r.Ataque + (n - ateOTeto) * r.AtaqueDepoisDoTeto;
        }

        private static double ContraOChefe(double valor, bool chefe) => chefe ? System.Math.Truncate(valor * D.Ladino.ContraOChefe / 100) : valor;

        /// <summary>TS: bonusDoAtaque — o dano a mais (%) do ataque comum na arena, somado ao da classe.</summary>
        public static double BonusDoAtaque(string classId, string className, string arma, ContadoresDaClasse c, bool colado, bool chefe, double blocos = 0, string estilo = null)
        {
            switch (Catalog.IdDaClasse(classId, className))
            {
                case "arqueiro":
                    return DanoDaDistancia(blocos, Z(c.Parado));
                case "guerreiro":
                    return (colado ? D.Guerreiro.Colado : 0) + Z(c.Combo);
                case "druida":
                    return DanoDoDruida(estilo, Z(c.Golpes));
                case "monge":
                    // Os estilos do Monge: o Empurrão bate mais; a Concentração gasta as cargas no golpe.
                    if (estilo == "empurrao") return Estilos.Empurrao.Dano;
                    if (estilo == "concentracao") return Z(c.Cargas) * Estilos.Concentracao.PorCarga;
                    return 0;
                case "ladino":
                    FurtividadeEm(Z(c.Furtividade), out _, out var ataque);
                    return ContraOChefe(ataque, chefe);
                case "barbaro":
                    return Z(c.Furia) * D.Barbaro.DanoPorFuria + (arma == "marreta" ? D.Barbaro.Marreta : 0);
                default:
                    return 0;
            }
        }

        /// <summary>TS: esquivaDaClasse — a esquiva a mais (%) contra o golpe de um monstro: a furtividade do Ladino e o desvio do Cavaleiro.</summary>
        public static double EsquivaDaClasse(string classId, string className, ContadoresDaClasse c, bool chefe, string estilo = null)
        {
            if (estilo == "cavaleiro") return Estilos.Cavaleiro.Desvio;
            if (Catalog.IdDaClasse(classId, className) != "ladino") return 0;
            FurtividadeEm(Z(c.Furtividade), out var esquiva, out _);
            return ContraOChefe(esquiva, chefe);
        }

        /// <summary>TS: resistenciaDaClasse — a % de dano a menos no golpe que o herói leva.</summary>
        public static double ResistenciaDaClasse(string classId, string className, double hp, double maxHp, ContadoresDaClasse c, string estilo = null)
        {
            switch (Catalog.IdDaClasse(classId, className))
            {
                case "druida":
                    // A aura de fera da Metamorfose (rodada 5b).
                    return estilo == "metamorfose" && AuraDeFera(Z(c.Golpes)) ? Estilos.Metamorfose.Resistencia : 0;
                case "mago":
                    // O revestimento de pedra da Terra (rodada 5c).
                    return estilo == "terra" && Z(c.Golpes) >= Estilos.Terra.GolpesDaPedra ? Estilos.Terra.Resistencia : 0;
                case "guerreiro":
                {
                    if (!(maxHp > 0)) return 0;
                    double falta = Js.Max(0, maxHp - hp);
                    return System.Math.Floor(falta * 100 / (maxHp * D.Guerreiro.DegrauDaVida)) * D.Guerreiro.ResistenciaPorDegrau;
                }
                case "barbaro":
                    return Z(c.Furia) * D.Barbaro.ResistenciaPorFuria;
                case "paladino":
                    return Z(c.Absorcao) >= D.Paladino.AbsorcaoQueResiste ? D.Paladino.Resistencia : 0;
                default:
                    return 0;
            }
        }

        /// <summary>TS: contarAcerto — o combo do Guerreiro e a furtividade do Ladino contam o acerto. null: a classe não conta.</summary>
        public static AcertoDaClasse ContarAcerto(string classId, string className, ContadoresDaClasse c, bool critico)
        {
            switch (Catalog.IdDaClasse(classId, className))
            {
                case "guerreiro":
                {
                    var novos = c.Clone();
                    if (!critico)
                    {
                        novos.Seguidos = 0;
                        return new AcertoDaClasse { Contadores = novos };
                    }
                    double seguidos = Z(c.Seguidos) + 1;
                    if (seguidos < D.Guerreiro.CriticosDoCombo)
                    {
                        novos.Seguidos = seguidos;
                        return new AcertoDaClasse { Contadores = novos };
                    }
                    double combo = Z(c.Combo) + D.Guerreiro.Combo;
                    novos.Seguidos = 0;
                    novos.Combo = combo;
                    return new AcertoDaClasse { Contadores = novos, Combo = combo };
                }
                case "ladino":
                {
                    if (!critico) return null;
                    var novos = c.Clone();
                    double criticos = Z(c.Criticos) + 1;
                    if (criticos < D.Ladino.CriticosDaFurtividade)
                    {
                        novos.Criticos = criticos;
                        return new AcertoDaClasse { Contadores = novos };
                    }
                    double furtividade = Z(c.Furtividade) + 1;
                    novos.Criticos = 0;
                    novos.Furtividade = furtividade;
                    return new AcertoDaClasse { Contadores = novos, Furtividade = furtividade };
                }
                default:
                    return null;
            }
        }

        /// <summary>TS: contarGolpeLevado — a fúria do Bárbaro sobe e a absorção do Paladino junta. null: a classe não conta.</summary>
        public static ContadoresDaClasse ContarGolpeLevado(string classId, string className, ContadoresDaClasse c)
        {
            switch (Catalog.IdDaClasse(classId, className))
            {
                case "barbaro":
                {
                    var novos = c.Clone();
                    novos.Furia = Js.Min(D.Barbaro.TetoDaFuria, Z(c.Furia) + 1);
                    novos.Calmo = 0;
                    return novos;
                }
                case "paladino":
                {
                    var novos = c.Clone();
                    novos.Absorcao = Js.Min(D.Paladino.TetoDaAbsorcao, Z(c.Absorcao) + D.Paladino.AbsorvePorGolpe);
                    return novos;
                }
                default:
                    return null;
            }
        }

        /// <summary>TS: esfriar — a fúria do Bárbaro esfria depois de um tempo sem levar golpe. null: nada muda.</summary>
        public static ContadoresDaClasse Esfriar(string classId, string className, ContadoresDaClasse c)
        {
            if (Catalog.IdDaClasse(classId, className) != "barbaro" || !(Z(c.Furia) != 0)) return null;
            var novos = c.Clone();
            double calmo = Z(c.Calmo) + 1;
            if (calmo < D.Barbaro.Calma)
            {
                novos.Calmo = calmo;
                return novos;
            }
            novos.Furia = Js.Max(0, Z(c.Furia) - D.Barbaro.PerdeNaCalma);
            novos.Calmo = 0;
            return novos;
        }

        /// <summary>TS: devolucaoDaClasse — o dano (%) que o Paladino devolve a quem bateu; os outros, 0.</summary>
        public static double DevolucaoDaClasse(string classId, string className, ContadoresDaClasse c)
        {
            if (Catalog.IdDaClasse(classId, className) != "paladino") return 0;
            return Z(c.Absorcao) >= D.Paladino.TetoDaAbsorcao ? D.Paladino.DevolveNoTeto : D.Paladino.Devolve;
        }

        /// <summary>TS: puxaOsMonstros — o Paladino atrai os monstros.</summary>
        public static bool PuxaOsMonstros(string classId, string className) => Catalog.IdDaClasse(classId, className) == "paladino";

        public static bool PuxaOsMonstros(Hero hero) => PuxaOsMonstros(hero.ClassId, hero.ClassName);

        /// <summary>TS: tempo — passos em segundos, arredondando pra cima; e em "m:ss" a partir de um minuto.</summary>
        private static string Tempo(double passos)
        {
            double s = System.Math.Ceiling(passos / 60);
            if (s >= 60) return Js.NumberToString(System.Math.Truncate(s / 60)) + ":" + Js.NumberToString(s % 60).PadLeft(2, '0');
            return Js.NumberToString(s) + " s";
        }

        /// <summary>
        /// TS: textosDaClasse — a linha da classe embaixo das barras, só na luta: os contadores, a mira firme do
        /// Arqueiro, o Poder da fé, a espera do Druida, e a moral do grupo de quem tiver. Sem nada a mostrar, vazia.
        /// </summary>
        public static System.Collections.Generic.List<string> TextosDaClasse(string classId, string className, double hp, double maxHp, ContadoresDaClasse c, ExtrasDaClasse extras = null, string estilo = null, string aljava = null)
        {
            extras = extras ?? new ExtrasDaClasse();
            var textos = new System.Collections.Generic.List<string>();
            switch (Catalog.IdDaClasse(classId, className))
            {
                case "arqueiro":
                {
                    textos.Add(Z(c.Parado) >= D.Arqueiro.Parado ? "🏹 Mira firme" : "🏹 Fique parado pra mirar");
                    // A aljava (rodada 6b): quanto falta pra flechada da vez. `aljava` é a de PecasSecretas.AljavaNoArco.
                    double flechadas = Z(c.Flechadas);
                    var r = PecasSecretas.RegrasDasAljavas;
                    if (aljava == "aljava_paralisante") textos.Add("🕸️ Paralisia em " + Js.NumberToString(FaltamPro(flechadas, r.ParalisiaACada)));
                    else if (aljava == "aljava_flamejante") textos.Add("🔥 Incêndio em " + Js.NumberToString(FaltamPro(flechadas, r.IncendioACada)));
                    else if (aljava == "aljava_explosiva") textos.Add("💥 Cadeia em " + Js.NumberToString(FaltamPro(flechadas, r.CadeiaACada)));
                    break;
                }
                case "clerigo":
                    if (Z(extras.Fe) > 0) textos.Add("✝️ Fé " + Tempo(extras.Fe.Value));
                    else textos.Add(Z(extras.RecargaDaFe) > 0 ? "✝️ Fé em " + Tempo(extras.RecargaDaFe.Value) : "✝️ Fé pronta");
                    break;
                case "druida":
                {
                    if (Z(extras.SemAtacar) > 0) textos.Add("🌿 Ataque em " + Tempo(extras.SemAtacar.Value));
                    // Os estilos (rodada 5b): a garra até a aura, as flores no chão, os golpes das Raízes.
                    double golpes = Z(c.Golpes);
                    if (estilo == "metamorfose")
                        textos.Add(AuraDeFera(golpes) ? "🐾 Aura de fera" : "🐾 Garra " + Js.NumberToString(golpes) + "/" + Js.NumberToString(Estilos.Metamorfose.GolpesDaAura));
                    else if (estilo == "florescimento")
                        textos.Add("🌸 Flores " + Js.NumberToString(Z(extras.Flores)) + "/" + Js.NumberToString(Estilos.Florescimento.Maximo));
                    else if (estilo == "raizes")
                        textos.Add("🌱 Raízes " + Js.NumberToString(golpes) + (RaizesFundas(golpes) ? " · veneno forte" : ""));
                    break;
                }
                case "monge":
                    textos.Add("☯️ Ki " + Js.NumberToString(Z(extras.Ki)) + "/" + Js.NumberToString(D.Monge.TetoDoKi) + (extras.Revestido == true ? " · Revestido" : ""));
                    if (estilo == "concentracao") textos.Add("🧘 Cargas " + Js.NumberToString(Z(c.Cargas)) + "/" + Js.NumberToString(Estilos.Concentracao.TetoDeCargas));
                    break;
                case "mago":
                {
                    // Os elementos (rodada 5c): quanto falta pro disparo da vez, e o que já acendeu.
                    double golpes = Z(c.Golpes);
                    switch (estilo)
                    {
                        case "fogo":
                            textos.Add("🔥 Bola de fogo em " + Js.NumberToString(FaltamPro(golpes, Estilos.Fogo.BolaACada)));
                            break;
                        case "terra":
                            textos.Add(golpes >= Estilos.Terra.GolpesDaPedra ? "🪨 Revestimento de pedra" : "🪨 Pedra " + Js.NumberToString(golpes) + "/" + Js.NumberToString(Estilos.Terra.GolpesDaPedra));
                            break;
                        case "vento":
                            textos.Add("🌀 Empurrão em " + Js.NumberToString(FaltamPro(golpes, Estilos.Vento.EmpurraACada)) + (Z(c.Ventania) > 0 ? " · ventania" : ""));
                            break;
                        case "agua":
                            textos.Add("💧 Redemoinho em " + Js.NumberToString(FaltamPro(golpes, Estilos.Agua.RedemoinhoACada)));
                            break;
                        case "arcano":
                        {
                            var r = Estilos.Arcano;
                            textos.Add(golpes >= r.GolpesDoArcano
                                ? "✨ Arcano +" + Js.NumberToString(Js.Max(0, golpes - r.GolpesDoArcano) * r.PorGolpe) + "%"
                                : "✨ Grilhões em " + Js.NumberToString(FaltamPro(golpes, r.GrilhoesACada)) + " · " + Js.NumberToString(golpes) + "/" + Js.NumberToString(r.GolpesDoArcano));
                            break;
                        }
                        case "escuridao":
                        {
                            var r = Estilos.Escuridao;
                            textos.Add(golpes >= r.GolpesDaFome
                                ? "🌑 Fome da escuridão"
                                : "🌑 Escuridão em " + Js.NumberToString(FaltamPro(golpes, r.AreaACada)) + " · " + Js.NumberToString(golpes) + "/" + Js.NumberToString(r.GolpesDaFome));
                            break;
                        }
                    }
                    break;
                }
                case "necromante":
                    if (extras.MagiaSelada == true) textos.Add("☠️ Magia selada");
                    else textos.Add(Z(extras.RecargaDaMagia) > 0 ? "☠️ Magia em " + Tempo(extras.RecargaDaMagia.Value) : "☠️ Magia pronta");
                    break;
                case "guerreiro":
                {
                    double resistencia = ResistenciaDaClasse(classId, className, hp, maxHp, c, estilo);
                    textos.Add("⚔️ Combo +" + Js.NumberToString(Z(c.Combo)) + "% · " + Js.NumberToString(Z(c.Seguidos)) + "/" + Js.NumberToString(D.Guerreiro.CriticosDoCombo));
                    if (resistencia > 0) textos.Add("🛡️ Resistência " + Js.NumberToString(resistencia) + "%");
                    // O Espadachim: o avanço e o ki do Corte Invernal.
                    if (estilo == "espadachim")
                    {
                        textos.Add(Z(c.RecargaDoEstilo) > 0 ? "🗡️ Avanço em " + Tempo(c.RecargaDoEstilo.Value) : "🗡️ Avanço pronto");
                        textos.Add("☯️ Ki " + Js.NumberToString(Z(extras.Ki)) + "/" + Js.NumberToString(Estilos.Espadachim.Corte));
                    }
                    break;
                }
                case "ladino":
                    textos.Add("🗡️ Furtividade " + Js.NumberToString(Z(c.Furtividade)) + " · " + Js.NumberToString(Z(c.Criticos)) + "/" + Js.NumberToString(D.Ladino.CriticosDaFurtividade));
                    break;
                case "barbaro":
                    textos.Add("🔥 Fúria " + Js.NumberToString(Z(c.Furia)) + "/" + Js.NumberToString(D.Barbaro.TetoDaFuria));
                    break;
                case "paladino":
                    textos.Add("🛡️ Absorção " + Js.NumberToString(Z(c.Absorcao)) + "/" + Js.NumberToString(D.Paladino.TetoDaAbsorcao));
                    break;
            }
            if (extras.Canalizando == true) textos.Add(OQueCanaliza(classId, className, estilo) == "ki" ? "🌀 Juntando ki" : "🌀 Puxando mana");
            if (Z(extras.Moral) > 0) textos.Add("🎵 Moral " + Js.NumberToString(extras.Moral.Value));
            return textos;
        }

        public static System.Collections.Generic.List<string> TextosDaClasse(Hero hero, ContadoresDaClasse c, ExtrasDaClasse extras = null) =>
            TextosDaClasse(hero.ClassId, hero.ClassName, hero.Hp, hero.MaxHp, c ?? new ContadoresDaClasse(), extras, Estilos.IdDoEstilo(hero), PecasSecretas.AljavaNoArco(hero));

        // ---------- rodada 3b (2026-11-17): Arqueiro, Bardo, Clérigo e Druida ----------

        // ---------- rodada 4a (2026-11-17): segurar K, o Mago e o Monge ----------

        /// <summary>TS: oQueCanaliza — segurando K: "mana" (o Mago e o Necromante), "ki" (o Monge e o Espadachim); null, nada.</summary>
        public static string OQueCanaliza(string classId, string className, string estilo = null)
        {
            var id = Catalog.IdDaClasse(classId, className);
            if (id == "mago" || id == "necromante") return "mana";
            if (id == "guerreiro" && estilo == "espadachim") return "ki";
            return id == "monge" ? "ki" : null;
        }

        public static string OQueCanaliza(Hero hero) => OQueCanaliza(hero.ClassId, hero.ClassName, Estilos.IdDoEstilo(hero));

        /// <summary>TS: passosDoCanal — quantos passos segurando K valem um ponto pra este herói: o Espadachim junta ki mais devagar (3/s).</summary>
        public static double PassosDoCanal(string classId, string className, string estilo = null)
        {
            string tipo = OQueCanaliza(classId, className, estilo);
            if (tipo == null) return 0;
            if (Catalog.IdDaClasse(classId, className) == "guerreiro") return System.Math.Truncate(60 / Estilos.Espadachim.KiPorSegundo);
            return PassosPorPonto(tipo);
        }

        public static double PassosDoCanal(Hero hero) => PassosDoCanal(hero.ClassId, hero.ClassName, Estilos.IdDoEstilo(hero));

        // ---------- os estilos do Druida (rodada 5b) ----------

        /// <summary>TS: danoDoDruida — o dano a mais (%) do Druida com estilo no golpe de número <paramref name="golpe"/> da luta.</summary>
        public static double DanoDoDruida(string estilo, double golpe)
        {
            switch (estilo)
            {
                case "metamorfose":
                    return Estilos.Metamorfose.Dano + (AuraDeFera(golpe) ? Estilos.Metamorfose.Aura : 0);
                case "florescimento":
                    return Estilos.Florescimento.Dano;
                case "raizes":
                    return GolpeForte(golpe) ? Estilos.Raizes.Dano : 0;
                default:
                    return 0;
            }
        }

        /// <summary>TS: aCadaGolpe — o golpe de número <paramref name="golpe"/> é o da vez de quem age a cada <paramref name="n"/>.</summary>
        public static bool ACadaGolpe(double golpe, double n) => golpe > 0 && golpe % n == 0;

        /// <summary>TS: danoDoMago — o dano a mais (%) do disparo do Mago com elemento (rodada 5c), no disparo de número <paramref name="golpe"/>.</summary>
        public static double DanoDoMago(string estilo, double golpe)
        {
            switch (estilo)
            {
                case "terra":
                    return Estilos.Terra.Dano;
                case "arcano":
                {
                    var r = Estilos.Arcano;
                    return r.Dano + (ACadaGolpe(golpe, r.GrilhoesACada) ? r.DanoDosGrilhoes : 0) + Js.Max(0, golpe - r.GolpesDoArcano) * r.PorGolpe;
                }
                case "escuridao":
                    return Estilos.Escuridao.Dano;
                default:
                    return 0;
            }
        }

        /// <summary>TS: faltamPro — quantos disparos faltam pro próximo múltiplo de <paramref name="n"/> (no múltiplo, n).</summary>
        private static double FaltamPro(double golpes, double n) => n - golpes % n;

        /// <summary>TS: auraDeFera — a aura da Metamorfose está acesa (do 15º golpe da luta em diante).</summary>
        public static bool AuraDeFera(double golpes) => golpes >= Estilos.Metamorfose.GolpesDaAura;

        /// <summary>TS: golpeForte — o golpe das Raízes é o forte (todo 3º).</summary>
        public static bool GolpeForte(double golpe) => golpe > 0 && golpe % Estilos.Raizes.ForteACada == 0;

        /// <summary>TS: golpeQuePrende — o golpe das Raízes prende o alvo (todo 9º).</summary>
        public static bool GolpeQuePrende(double golpe) => golpe > 0 && golpe % Estilos.Raizes.PrendeACada == 0;

        /// <summary>TS: raizesFundas — do 18º golpe da luta em diante: o veneno forte e o passo mais ligeiro.</summary>
        public static bool RaizesFundas(double golpes) => golpes >= Estilos.Raizes.GolpesDoVeneno;

        /// <summary>TS: criticoDoEstilo — o crítico a mais do estilo, em pontos de % (o Cavaleiro +30, o chute +40); os outros, 0.</summary>
        public static double CriticoDoEstilo(string estilo)
        {
            if (estilo == "cavaleiro") return Estilos.Cavaleiro.Critico;
            if (estilo == "chute") return Estilos.Chute.Critico;
            return 0;
        }

        public static double CriticoDoEstilo(Hero hero) => CriticoDoEstilo(Estilos.IdDoEstilo(hero));

        /// <summary>TS: passosPorPonto — quantos passos segurando K valem um ponto (de mana ou de ki).</summary>
        public static double PassosPorPonto(string tipo) =>
            System.Math.Truncate(60 / (tipo == "mana" ? D.Canalizar.ManaPorSegundo : D.Canalizar.KiPorSegundo));

        /// <summary>TS: custoDaMagia — o custo do disparo mágico na arena: o do Mago; nos outros, null.</summary>
        public static double? CustoDaMagia(string classId, string className) =>
            Catalog.IdDaClasse(classId, className) == "mago" ? D.Mago.CustoDoDisparo : (double?)null;

        public static double? CustoDaMagia(Hero hero) => CustoDaMagia(hero.ClassId, hero.ClassName);

        /// <summary>TS: forcaDaExplosao — a força da explosão de ki (de 0 a 1,5), pelo ki gasto.</summary>
        public static double ForcaDaExplosao(double ki)
        {
            var r = D.Monge;
            double ate = Js.Max(0, Js.Min(r.TetoDoKi, System.Math.Truncate(ki)));
            return Js.Round(ate * r.ForcaDaExplosao / r.TetoDoKi) / 100;
        }

        /// <summary>TS: apoiaAliado — a classe mira nos aliados (o Bardo, o Clérigo e o Druida).</summary>
        public static bool ApoiaAliado(string classId, string className)
        {
            var id = Catalog.IdDaClasse(classId, className);
            return id == "bardo" || id == "clerigo" || id == "druida";
        }

        public static bool ApoiaAliado(Hero hero) => ApoiaAliado(hero.ClassId, hero.ClassName);

        /// <summary>TS: mortoVivo — a espécie conta como morto-vivo.</summary>
        public static bool MortoVivo(string speciesId) => speciesId != null && D.MortosVivos.Contains(speciesId);

        /// <summary>TS: miraDaClasse — a área da mira do herói, em % da de todo mundo: a do Arqueiro é maior.</summary>
        public static double MiraDaClasse(string classId, string className) =>
            Catalog.IdDaClasse(classId, className) == "arqueiro" ? D.Arqueiro.Mira : 100;

        public static double MiraDaClasse(Hero hero) => MiraDaClasse(hero.ClassId, hero.ClassName);

        /// <summary>TS: danoDaDistancia — o dano a mais (%) do Arqueiro pela distância.</summary>
        public static double DanoDaDistancia(double blocos, double parado)
        {
            var r = D.Arqueiro;
            if (blocos <= r.Perto) return -r.DanoDePerto;
            if (parado < r.Parado) return 0;
            return Js.Min(r.Teto, blocos * r.PorBloco);
        }

        /// <summary>TS: efeitosDaMoral — o que a moral dá ao grupo, somando os degraus.</summary>
        public static EfeitosDaMoral EfeitosDaMoral(double nivel)
        {
            var r = D.Moral;
            var e = new EfeitosDaMoral();
            if (nivel >= r.NivelDaVelocidade)
            {
                e.Velocidade += r.Velocidade;
                e.Dano += r.DanoNaVelocidade;
            }
            if (nivel >= r.NivelDaResistencia)
            {
                e.Resistencia += r.Resistencia;
                e.Dano += r.DanoNaResistencia;
            }
            if (nivel >= r.NivelSemQuebrar) e.SemQuebrar = true;
            if (nivel >= r.NivelDoCritico)
            {
                e.Critico += r.Critico;
                e.Dano += r.DanoNoCritico;
            }
            if (nivel >= r.NivelDaFaixa) e.FaixaCritica += r.FaixaCritica;
            return e;
        }

        /// <summary>TS: contarCriticoNoAliado — um crítico do Bardo num aliado conta pra moral.</summary>
        public static CriticoNoAliado ContarCriticoNoAliado(Moral moral)
        {
            var r = D.Bardo;
            double nivel = Z(moral.Nivel);
            if (nivel >= r.TetoDaMoral) return new CriticoNoAliado { Moral = moral };
            double criticos = Z(moral.Criticos) + 1;
            if (criticos < r.CriticosDaMoral)
            {
                var novos = moral.Clone();
                novos.Criticos = criticos;
                return new CriticoNoAliado { Moral = novos };
            }
            return new CriticoNoAliado { Moral = new Moral { Nivel = nivel + 1, Criticos = 0 }, Subiu = nivel + 1 };
        }

        /// <summary>TS: curaDoApoio — a cura do apoio num herói com esta vida.</summary>
        public static double CuraDoApoio(string tipo, double hp, double maxHp, double mais = 0)
        {
            double falta = Js.Max(0, maxHp - hp);
            if (falta <= 0) return 0;
            // mais: os pontos de % a mais (a Purificação da Metamorfose, rodada 5b).
            double pct = (tipo == "bardo" ? D.Bardo.Cura : tipo == "clerigo" ? D.Clerigo.Cura : tipo == "purificar" ? D.Druida.Purificacao : D.Clerigo.CuraDaFe) + mais;
            double sobre = tipo == "bardo" ? falta : maxHp;
            return Js.Min(falta, Js.Max(1, System.Math.Truncate(sobre * pct / 100)));
        }

        /// <summary>TS: duracaoDaFe — a duração do Poder da fé, em passos, pelo dano levado nos últimos 30 s.</summary>
        public static double DuracaoDaFe(bool comunhao, double danoLevado, double quantos)
        {
            var r = D.Clerigo;
            double dano = Js.Max(0, System.Math.Truncate(danoLevado));
            if (comunhao) return Js.Min(r.TetoDaComunhao * 60, System.Math.Truncate(dano * 60 / (2 * Js.Max(1, quantos))));
            return Js.Min(r.TetoDoEgoista * 60, System.Math.Truncate(dano * 60 / r.DivisorDoEgoista));
        }

        /// <summary>TS: contarParado — o Arqueiro conta o tempo parado. null: nada muda.</summary>
        public static ContadoresDaClasse ContarParado(string classId, string className, ContadoresDaClasse c, bool andou)
        {
            if (Catalog.IdDaClasse(classId, className) != "arqueiro") return null;
            double antes = Z(c.Parado);
            double parado = andou ? 0 : Js.Min(D.Arqueiro.Parado, antes + 1);
            if (parado == antes && c.Parado != null) return null;
            var novos = c.Clone();
            novos.Parado = parado;
            return novos;
        }
    }
}
