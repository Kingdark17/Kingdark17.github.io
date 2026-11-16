using Newtonsoft.Json.Linq;
using NUnit.Framework;
using RPGLegend.Engine;
using RPGLegend.Game.Jogo;

namespace RPGLegend.Tests
{
    /// <summary>A costura entre a partida do app e a sala do co-op (Game/Jogo/Coop.cs): o que viaja e o que fica.</summary>
    public class CoopTests
    {
        [OneTimeSetUp]
        public void CarregarTabelas() => RPGLegend.Game.GameBootstrap.EnsureLoaded();

        private static EstadoNaCidade Cidade(string nome, double semente)
        {
            var raca = Catalog.RaceById("humano");
            var inicial = Criacoes.MontarSaveInicial(new Criacao { Nome = nome, Raca = raca }, Rng.SeededRng(semente), () => 1000);
            return (EstadoNaCidade)Estados.RetomarSave(new SaveCarregado
            {
                Hero = inicial.Hero,
                Inventory = inicial.Inventory,
                Party = inicial.Party,
                Quests = inicial.Quests,
                Floor = 1,
            }, Rng.SeededRng(semente + 1), () => 1000);
        }

        [Test]
        public void OInstantaneoLevaOMapaEOPerfilSoDoMeuPapel()
        {
            var andar = Estados.EntrarNaMasmorra(Cidade("Aria", 1), Rng.SeededRng(5));
            var pacote = Coop.Instantaneo(andar, 1);

            Assert.AreEqual("dungeon", (string)pacote["mapMode"]);
            Assert.IsInstanceOf<JArray>(pacote["map"]);
            Assert.IsInstanceOf<JObject>(pacote["pos"]);
            Assert.IsNotNull(pacote["masmorra"]);
            Assert.IsNull(pacote["hero"], "o herói só viaja dentro do perfil");
            var perfis = (JObject)pacote["profiles"];
            Assert.AreEqual(1, perfis.Count);
            Assert.AreEqual("Aria", (string)perfis["1"]["name"]);
            Assert.IsInstanceOf<JObject>(perfis["1"]["hero"]);
        }

        [Test]
        public void QuemAcompanhaAdotaOMapaEContinuaComOProprioHeroi()
        {
            var anfitriao = Estados.EntrarNaMasmorra(Cidade("Aria", 1), Rng.SeededRng(5));
            var convidado = Cidade("Bree", 9);

            var depois = Coop.AplicarRemoto(convidado, Coop.Instantaneo(anfitriao, 1));

            Assert.IsInstanceOf<EstadoNaMasmorra>(depois);
            Assert.AreEqual("Bree", depois.Hero.Name);
            Assert.AreEqual(anfitriao.Pos.X, depois.Pos.X);
            Assert.AreEqual(anfitriao.Pos.Y, depois.Pos.Y);
            Assert.AreEqual(anfitriao.Masmorra.Dungeon, depois.Masmorra.Dungeon);
            Assert.AreEqual(anfitriao.Map.Count, ((EstadoNaMasmorra)depois).Map.Count);
            Assert.AreEqual(convidado.Inventory.Count, depois.Inventory.Count);
        }

        [Test]
        public void PacoteSemMapaMantemOMapaLocalEAplicaOResto()
        {
            var anfitriao = Estados.EntrarNaMasmorra(Cidade("Aria", 1), Rng.SeededRng(5));
            var convidado = (EstadoNaMasmorra)Coop.AplicarRemoto(Cidade("Bree", 9), Coop.Instantaneo(anfitriao, 1));

            var pacote = Coop.Instantaneo(anfitriao, 1);
            pacote.Remove("map");
            pacote["floor"] = 3;
            var depois = Coop.AplicarRemoto(convidado, pacote);

            Assert.AreEqual(3, depois.Floor);
            Assert.AreEqual(convidado.Map.Count, ((EstadoNaMasmorra)depois).Map.Count);
        }

        [Test]
        public void PacoteQueNaoDaPraAplicarDevolveOLocal()
        {
            var anfitriao = Estados.EntrarNaMasmorra(Cidade("Aria", 1), Rng.SeededRng(5));
            var convidado = Cidade("Bree", 9);

            var semPosicao = Coop.Instantaneo(anfitriao, 1);
            semPosicao.Remove("pos");
            Assert.AreSame(convidado, Coop.AplicarRemoto(convidado, semPosicao));

            // Trocar de modo sem trazer o mapa: a cidade não vira masmorra com as casas da cidade.
            var semMapa = Coop.Instantaneo(anfitriao, 1);
            semMapa.Remove("map");
            Assert.AreSame(convidado, Coop.AplicarRemoto(convidado, semMapa));

            var modoTorto = Coop.Instantaneo(anfitriao, 1);
            modoTorto["mapMode"] = "lua";
            Assert.AreSame(convidado, Coop.AplicarRemoto(convidado, modoTorto));
            Assert.AreSame(convidado, Coop.AplicarRemoto(convidado, null));
        }

        [Test]
        public void OPerfilTemNomeHeroiMochilaEEquipe()
        {
            var perfil = Coop.Perfil(Cidade("Bree", 9));
            Assert.AreEqual("Bree", (string)perfil["name"]);
            Assert.IsInstanceOf<JObject>(perfil["hero"]);
            Assert.IsInstanceOf<JArray>(perfil["inventory"]);
            Assert.IsInstanceOf<JArray>(perfil["party"]);
        }

        [Test]
        public void QuemAcompanhaGravaOHeroiDeAgoraNoMapaComQueEntrou()
        {
            var anfitriao = Estados.EntrarNaMasmorra(Cidade("Aria", 1), Rng.SeededRng(5));
            var casa = Cidade("Bree", 9);
            var partida = new Partida(1, casa, "a");
            partida.EntrarEmSala(false);
            partida.AdotarRemoto(Coop.AplicarRemoto(partida.Estado, Coop.Instantaneo(anfitriao, 1)));
            Assert.IsInstanceOf<EstadoNaMasmorra>(partida.Estado);
            Assert.IsFalse(partida.Mover("N"), "quem acompanha nao passa por porta");

            var gravar = partida.ParaGravar();
            Assert.IsInstanceOf<EstadoNaCidade>(gravar, "o mapa gravado e o meu, nao o de quem conduz");
            Assert.AreSame(partida.Estado.Hero, gravar.Hero);
            Assert.AreSame(partida.Estado.Inventory, gravar.Inventory);
        }

        [Test]
        public void QuemConduzGravaTudo()
        {
            var partida = new Partida(1, Cidade("Aria", 1), "a");
            partida.EntrarEmSala(true);
            Assert.AreSame(partida.Estado, partida.ParaGravar());
        }
    }
}
