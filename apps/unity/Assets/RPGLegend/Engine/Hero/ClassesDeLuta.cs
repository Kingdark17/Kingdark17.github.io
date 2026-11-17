namespace RPGLegend.Engine
{
    /// <summary>TS: ClasseDeLuta — os números de uma classe na luta: o alcance em blocos, e a vida, o dano e a velocidade em %.</summary>
    public sealed class ClasseDeLuta
    {
        public double Alcance;
        public double Vida;
        public double Dano;
        public double Velocidade;
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

        /// <summary>TS: alcanceDoHeroi — em blocos: o da classe, o da arma pesada no Bárbaro, o da arma sem classe.</summary>
        public static double AlcanceDoHeroi(string classId, string className, string arma)
        {
            var id = Catalog.IdDaClasse(classId, className);
            arma = arma ?? "";
            if (id == "barbaro")
                return D.AlcanceDoBarbaro.TryGet(arma, out var pesada) ? pesada : D.Classes.Get("barbaro").Alcance;
            if (!Js.Truthy(id) || !D.Classes.TryGet(id, out var classe) || classe == null)
                return D.AlcanceSemClasse.TryGet(arma, out var semClasse) ? semClasse : D.ClassePadrao.Alcance;
            return classe.Alcance;
        }

        public static double AlcanceDoHeroi(Hero hero) => AlcanceDoHeroi(hero.ClassId, hero.ClassName, hero.Equip?.Get("arma")?.TemplateId);

        /// <summary>
        /// TS: ataqueDasMaos — o ataque das mãos: só o Monge sem arma na mão principal; os outros, 0. Nível ausente
        /// (null) conta como 1.
        /// </summary>
        public static double AtaqueDasMaos(string classId, string className, double? level, bool temArma)
        {
            if (Catalog.IdDaClasse(classId, className) != "monge" || temArma) return 0;
            return D.MaosDoMonge.Base + System.Math.Floor(Js.Max(1, level ?? 1) / D.MaosDoMonge.ACadaNiveis);
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
        public static double BonusDoAtaque(string classId, string className, string arma, ContadoresDaClasse c, bool colado, bool chefe)
        {
            switch (Catalog.IdDaClasse(classId, className))
            {
                case "guerreiro":
                    return (colado ? D.Guerreiro.Colado : 0) + Z(c.Combo);
                case "ladino":
                    FurtividadeEm(Z(c.Furtividade), out _, out var ataque);
                    return ContraOChefe(ataque, chefe);
                case "barbaro":
                    return Z(c.Furia) * D.Barbaro.DanoPorFuria + (arma == "marreta" ? D.Barbaro.Marreta : 0);
                default:
                    return 0;
            }
        }

        /// <summary>TS: esquivaDaClasse — a esquiva a mais (%) contra o golpe de um monstro: a furtividade do Ladino.</summary>
        public static double EsquivaDaClasse(string classId, string className, ContadoresDaClasse c, bool chefe)
        {
            if (Catalog.IdDaClasse(classId, className) != "ladino") return 0;
            FurtividadeEm(Z(c.Furtividade), out var esquiva, out _);
            return ContraOChefe(esquiva, chefe);
        }

        /// <summary>TS: resistenciaDaClasse — a % de dano a menos no golpe que o herói leva.</summary>
        public static double ResistenciaDaClasse(string classId, string className, double hp, double maxHp, ContadoresDaClasse c)
        {
            switch (Catalog.IdDaClasse(classId, className))
            {
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

        /// <summary>TS: textosDaClasse — a linha da classe embaixo das barras, só na luta. Sem nada a mostrar, vazia.</summary>
        public static System.Collections.Generic.List<string> TextosDaClasse(string classId, string className, double hp, double maxHp, ContadoresDaClasse c)
        {
            var textos = new System.Collections.Generic.List<string>();
            switch (Catalog.IdDaClasse(classId, className))
            {
                case "guerreiro":
                {
                    double resistencia = ResistenciaDaClasse(classId, className, hp, maxHp, c);
                    textos.Add("⚔️ Combo +" + Js.NumberToString(Z(c.Combo)) + "% · " + Js.NumberToString(Z(c.Seguidos)) + "/" + Js.NumberToString(D.Guerreiro.CriticosDoCombo));
                    if (resistencia > 0) textos.Add("🛡️ Resistência " + Js.NumberToString(resistencia) + "%");
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
            return textos;
        }

        public static System.Collections.Generic.List<string> TextosDaClasse(Hero hero, ContadoresDaClasse c) =>
            TextosDaClasse(hero.ClassId, hero.ClassName, hero.Hp, hero.MaxHp, c ?? new ContadoresDaClasse());
    }
}
