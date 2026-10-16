using NUnit.Framework;
using RPGLegend.Engine;
using RPGLegend.Game.Jogo;

namespace RPGLegend.Tests
{
    /// <summary>
    /// A partida do app (Game/Jogo/Partida.cs): quando grava, o que fazer quando a gravação falha e a porta da
    /// sala de monstro trancada até a luta em tempo real. É o que protege o save de verdade de quem joga pelo app,
    /// então vale teste mesmo sem par no TypeScript.
    /// </summary>
    public class PartidaTests
    {
        /// <summary>As tabelas que vão no build (Resources/GameData), como o app carrega.</summary>
        [OneTimeSetUp]
        public void CarregarTabelas() => RPGLegend.Game.GameBootstrap.EnsureLoaded();

        private static EstadoNaCidade Cidade()
        {
            var raca = Catalog.RaceById("humano");
            var inicial = Criacoes.MontarSaveInicial(new Criacao { Nome = "Teste", Raca = raca }, Rng.SeededRng(1), () => 1000);
            var estado = Estados.RetomarSave(new SaveCarregado
            {
                Hero = inicial.Hero,
                Inventory = inicial.Inventory,
                Party = inicial.Party,
                Quests = inicial.Quests,
                Floor = 1,
            }, Rng.SeededRng(2), () => 1000);
            Assert.IsInstanceOf<EstadoNaCidade>(estado);
            return (EstadoNaCidade)estado;
        }

        /// <summary>Um andar em que a sala de partida tem porta pra uma sala de monstro (e a direção dela).</summary>
        private static (EstadoNaMasmorra estado, string direcao) MasmorraComMonstroAoLado()
        {
            var cidade = Cidade();
            for (int semente = 1; semente < 300; semente++)
            {
                var andar = Estados.EntrarNaMasmorra(cidade, Rng.SeededRng(semente));
                foreach (var direcao in Directions.Order)
                {
                    var vizinha = Estados.VizinhaEm(andar, direcao);
                    if (vizinha != null && Salas.LutaAoEntrar(Estados.CelulaEm(andar, vizinha))) return (andar, direcao);
                }
            }
            Assert.Fail("nenhuma semente deu sala de monstro ao lado da partida");
            return (null, null);
        }

        // ---------- quando grava ----------

        [Test]
        public void GravaDuasSegundosEMeioDepoisDaUltimaMudanca()
        {
            var partida = new Partida(1, Cidade(), "a") { Agora = 1000 };
            Assert.IsFalse(partida.HoraDeGravar(1000), "sem mudança não há o que gravar");

            partida.Fechar(partida.Estado);
            Assert.IsTrue(partida.TemMudancaPorGravar);
            Assert.IsFalse(partida.HoraDeGravar(3499));
            Assert.IsTrue(partida.HoraDeGravar(3500));
        }

        [Test]
        public void QuemNaoParaDeJogarGravaAosDezSegundos()
        {
            var partida = new Partida(1, Cidade(), "a");
            for (double t = 1000; t <= 10000; t += 1000)
            {
                partida.Agora = t;
                partida.Fechar(partida.Estado);
                Assert.IsFalse(partida.HoraDeGravar(t + 999), "ainda adiando em t=" + t);
            }
            partida.Agora = 11000;
            partida.Fechar(partida.Estado);
            Assert.IsTrue(partida.HoraDeGravar(11000), "o teto conta desde a primeira mudança não gravada");
        }

        [Test]
        public void GravouLimpaAFilaEGuardaAAssinatura()
        {
            var partida = new Partida(1, Cidade(), "a") { Agora = 1000 };
            partida.Fechar(partida.Estado);
            var mandado = partida.ComecarAGravar();
            Assert.AreSame(partida.Estado, mandado);
            Assert.IsTrue(partida.Gravando);
            Assert.IsFalse(partida.HoraDeGravar(99999), "uma gravação de cada vez");

            partida.Gravou("b");
            Assert.IsFalse(partida.Gravando);
            Assert.IsFalse(partida.TemMudancaPorGravar);
            Assert.AreEqual("b", partida.Assinatura);
        }

        [Test]
        public void MudancaDuranteAGravacaoContinuaNaFila()
        {
            var partida = new Partida(1, Cidade(), "a") { Agora = 1000 };
            partida.Fechar(partida.Estado);
            partida.ComecarAGravar();

            partida.Agora = 2000;
            partida.Fechar(partida.Estado);
            partida.Gravou("b");

            Assert.IsTrue(partida.TemMudancaPorGravar, "a mudança de t=2000 não foi na gravação que terminou");
            Assert.IsTrue(partida.HoraDeGravar(4500));
        }

        [Test]
        public void FalhaNaoTentaDeNovoSozinhaMasNaoPerdeAMudanca()
        {
            var partida = new Partida(1, Cidade(), "a") { Agora = 1000 };
            partida.Fechar(partida.Estado);
            partida.ComecarAGravar();
            partida.NaoGravou();

            Assert.IsFalse(partida.Gravando);
            Assert.IsTrue(partida.TemMudancaPorGravar, "sair depois disto precisa tentar gravar de novo");
            Assert.IsFalse(partida.HoraDeGravar(99999), "sem mudança nova, a automática não insiste");
            Assert.AreEqual("a", partida.Assinatura);

            partida.Agora = 100000;
            partida.Fechar(partida.Estado);
            Assert.IsTrue(partida.HoraDeGravar(102500), "a próxima mudança volta a agendar");
            partida.ComecarAGravar();
            partida.Gravou("b");
            Assert.IsFalse(partida.TemMudancaPorGravar);
        }

        // ---------- a porta da sala de monstro ----------

        [Test]
        public void PortaDaSalaDeMonstroFicaTrancadaComUmAvisoSoNoDiario()
        {
            var (estado, direcao) = MasmorraComMonstroAoLado();
            var partida = new Partida(1, estado, "a");

            for (int vez = 0; vez < 3; vez++) Assert.IsFalse(partida.Mover(direcao), "a sala não muda");

            Assert.AreSame(estado, partida.Estado, "nem o estado");
            Assert.AreSame(Partida.LutaEmBreve, partida.Aviso);
            Assert.AreEqual(1, partida.Diario.Count, "empurrar a porta a cada quadro não enche o diário");
            Assert.IsFalse(partida.TemMudancaPorGravar, "não há o que gravar");
        }

        [Test]
        public void SemPortaNaoAnda()
        {
            var cidade = Cidade();
            for (int semente = 1; semente < 300; semente++)
            {
                var andar = Estados.EntrarNaMasmorra(cidade, Rng.SeededRng(semente));
                foreach (var direcao in Directions.Order)
                {
                    if (Estados.VizinhaEm(andar, direcao) != null) continue;
                    var partida = new Partida(1, andar, "a");
                    Assert.IsFalse(partida.Mover(direcao));
                    Assert.AreSame(andar, partida.Estado);
                    Assert.IsNull(partida.Aviso);
                    Assert.AreEqual(0, partida.Diario.Count);
                    return;
                }
            }
            Assert.Fail("nenhuma semente deu sala de partida sem alguma porta");
        }

        [Test]
        public void PortaComumMudaDeSalaEMarcaOPrimeiroPasso()
        {
            var cidade = Cidade();
            for (int semente = 1; semente < 300; semente++)
            {
                var andar = Estados.EntrarNaMasmorra(cidade, Rng.SeededRng(semente));
                foreach (var direcao in Directions.Order)
                {
                    var vizinha = Estados.VizinhaEm(andar, direcao);
                    if (vizinha == null || Salas.LutaAoEntrar(Estados.CelulaEm(andar, vizinha))) continue;
                    var partida = new Partida(1, andar, "a") { Agora = 1000 };
                    Assert.IsTrue(partida.Mover(direcao));
                    Assert.AreEqual(vizinha.X, partida.Estado.Pos.X);
                    Assert.AreEqual(vizinha.Y, partida.Estado.Pos.Y);
                    Assert.IsTrue(Tutoriais.TutorialDe(partida.Estado).Completed.Get("move"), "a etapa \"Dê o primeiro passo\"");
                    Assert.IsTrue(partida.TemMudancaPorGravar);
                    return;
                }
            }
            Assert.Fail("nenhuma semente deu sala comum ao lado da partida");
        }
    }
}
