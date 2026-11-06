using System.Collections.Generic;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/jogo.json das salas com serviço: jogo/loja.ts, missoes.ts, dialogo.ts, evento.ts,
    /// professor.ts, portao.ts, guilda.ts e totem.ts.
    /// </summary>
    internal sealed class JogoServicosFixtures : IFixtureModule
    {
        private const string M = "jogo";

        public void Register()
        {
            // ---------- loja ----------

            Fn(M, "abrirLoja", (a, c) => W(Lojas.AbrirLoja(R<EstadoNaCidade>(a["estado"]), Str(a["kind"]), c.RngFn, c.NowOrFail, JsJson.Truthy(a["app"]))));
            Fn(M, "estoque", (a, c) => W(Lojas.Estoque(R<Loja>(a["loja"]))));
            Fn(M, "vendaveis", (a, c) => W(Lojas.Vendaveis(R<Loja>(a["loja"]))));
            Fn(M, "precoDeCompra", (a, c) => N(Lojas.PrecoDeCompra(R<Loja>(a["loja"]), R<Item>(a["item"]))));
            Fn(M, "precoDeVenda", (a, c) => N(Lojas.PrecoDeVenda(R<Item>(a["item"]))));
            Fn(M, "precoDaRenovacao", (a, c) => N(Lojas.PrecoDaRenovacao(R<Loja>(a["loja"]))));
            Fn(M, "pechinchar", (a, c) => W(Lojas.Pechinchar(R<Loja>(a["loja"]), Num(a["roll"]))));
            Fn(M, "comprar", (a, c) => W(Lojas.Comprar(R<Loja>(a["loja"]), R<Item>(a["item"]))));
            Fn(M, "vender", (a, c) => W(Lojas.Vender(R<Loja>(a["loja"]), R<Item>(a["item"]))));
            Fn(M, "renovarEstoque", (a, c) => W(Lojas.RenovarEstoque(R<Loja>(a["loja"]), c.RngFn, c.NowOrFail)));
            Fn(M, "reforjar", (a, c) => W(Lojas.Reforjar(R<Loja>(a["loja"]), R<Item>(a["item"]), Str(a["materialId"]), c.RngFn)));

            // ---------- quadro de missões ----------

            Fn(M, "abrirQuadro", (a, c) => W(QuadroDeMissoes.AbrirQuadro(R<EstadoNaCidade>(a["estado"]), c.RngFn, c.NowOrFail)));
            Fn(M, "missoes", (a, c) => W(QuadroDeMissoes.Missoes(R<Quadro>(a["quadro"]))));
            Fn(M, "resgatar", (a, c) => W(QuadroDeMissoes.Resgatar(R<Quadro>(a["quadro"]), Str(a["questId"]), c.RngFn, c.NowOrFail)));

            // ---------- conversa com NPC ----------

            Fn(M, "abrirDialogo", (a, c) => W(Dialogos.AbrirDialogo(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "falaAtual", (a, c) => W(Dialogos.FalaAtual(R<Dialogo>(a["dialogo"]))));
            Fn(M, "temMaisFalas", (a, c) => W(Dialogos.TemMaisFalas(R<Dialogo>(a["dialogo"]))));
            Fn(M, "proximaFala", (a, c) => W(Dialogos.ProximaFala(R<Dialogo>(a["dialogo"]))));
            Fn(M, "proximaFala (na última fica)", (a, c) =>
            {
                var dialogo = R<Dialogo>(a["dialogo"]);
                return W(ReferenceEquals(Dialogos.ProximaFala(dialogo), dialogo));
            });
            Fn(M, "rotuloDoServico", (a, c) => W(Dialogos.RotuloDoServico(R<Npc>(a["npc"]))));
            Fn(M, "servicoDisponivel", (a, c) => W(Dialogos.ServicoDisponivel(R<Npc>(a["npc"]))));
            Fn(M, "usarServico", (a, c) => W(Dialogos.UsarServico(R<Dialogo>(a["dialogo"]), c.RngFn, c.NowOrFail)));

            // ---------- evento ----------

            Const(M, "ESCOLHAS", () => W(Eventos.TodasAsEscolhas));
            Fn(M, "abrirEvento", (a, c) => W(Eventos.AbrirEvento(R<EstadoNaMasmorra>(a["estado"]), JsJson.Truthy(a["app"]))));
            Fn(M, "escolhas", (a, c) => W(Eventos.Escolhas(R<Evento>(a["evento"]))));
            Fn(M, "escolher", (a, c) => W(Eventos.Escolher(R<Evento>(a["evento"]), Str(a["escolha"]), c.RngFn, c.NowOrFail)));

            // ---------- professor ----------

            Fn(M, "abrirProfessor", (a, c) => W(Professores.AbrirProfessor(R<EstadoNaMasmorra>(a["estado"]))));
            Fn(M, "ofertas", (a, c) => W(Professores.Ofertas(R<Professor>(a["professor"]))));
            Fn(M, "trocaveis", (a, c) => W(Professores.Trocaveis(R<Professor>(a["professor"]))));
            Fn(M, "aprender", (a, c) => W(Professores.Aprender(R<Professor>(a["professor"]), Str(a["powerId"]))));
            Fn(M, "aprender (fora da lista devolve o mesmo)", (a, c) =>
            {
                var professor = R<Professor>(a["professor"]);
                return W(ReferenceEquals(Professores.Aprender(professor, Str(a["powerId"])), professor));
            });
            Fn(M, "trocar", (a, c) => W(Professores.Trocar(R<Professor>(a["professor"]), Str(a["esquecer"]), Str(a["aprenderId"]))));
            Fn(M, "trocar (inválida devolve o mesmo)", (a, c) =>
            {
                var professor = R<Professor>(a["professor"]);
                return W(ReferenceEquals(Professores.Trocar(professor, Str(a["esquecer"]), Str(a["aprenderId"])), professor));
            });

            // ---------- portão ----------

            Fn(M, "motivo", (a, c) => W(Portoes.Motivo(R<LockReason>(a["bloqueio"]))));
            Fn(M, "abrirPortao", (a, c) => W(Portoes.AbrirPortao(R<EstadoNaCidade>(a["estado"]), JsJson.Truthy(a["app"]), Str(a["masmorra"]))));

            // A cidade desenhada.
            Fn(M, "plantaDaCidade", (a, c) => W(MapaDaCidade.PlantaDaCidade(JsJson.Truthy(a["troncosNoCaminho"]))));
            Fn(M, "chegadaNoPonto", (a, c) => W(MapaDaCidade.ChegadaNoPonto(Str(a["ponto"]))));
            Fn(M, "cobreOHeroi", (a, c) => W(MapaDaCidade.CobreOHeroi(R<CamadaDaCidade>(a["camada"]), R<Walker>(a["walker"]))));
            Fn(M, "camadasDaSala", (a, c) => W(ArteDaSala.CamadasDaSala(Str(a["dungeon"]), R<List<string>>(a["portas"]))));

            // As mecânicas dos chefes de andar 5 (2026-11-06); generateBoss e modifyDamageByAffinity também moram em
            // outros módulos, e os casos daqui são do bloco do chefe.
            Fn(M, "sortearMecanicas", (a, c) => W(MecanicasDoChefe.SortearMecanicas(Str(a["masmorra"]), c.RngFn)));
            Fn(M, "escudoDoChefe", (a, c) => W(MecanicasDoChefe.EscudoDoChefe(R<CombatMonster>(a["monstro"]))));
            Fn(M, "marcasDoChefe", (a, c) => W(MecanicasDoChefe.MarcasDoChefe(R<CombatMonster>(a["monstro"]))));
            Fn(M, "generateBoss", (a, c) => W(Monsters.GenerateBoss(Num(a["floor"]), new Monsters.GenerateOptions { Rng = c.RngFn, Masmorra = R<string>(JsJson.Prop(a["options"], "masmorra")) })));
            Fn(M, "modifyDamageByAffinity", (a, c) => W(Damage.ModifyDamageByAffinity(
                R<CombatMonster>(a["monster"]), Str(a["weakness"]), Str(a["resistance"]), Num(a["dmg"]), Str(a["type"]), JsJson.Truthy(a["halfResist"]))));
            Fn(M, "escuroNaLuta", (a, c) => W(ChefeFinal.EscuroNaLuta(R<DungeonCell>(a["sala"]))));

            // Armadilhas e ferimentos (2026-11-06).
            Fn(M, "chanceDeVer", (a, c) => W(Armadilhas.ChanceDeVer(Num(a["sabedoria"]))));
            Fn(M, "armadilhaSob", (a, c) => W(Armadilhas.ArmadilhaSob(R<DungeonCell>(a["celula"]), R<Walker>(a["walker"]))));
            Fn(M, "marcasDasArmadilhas", (a, c) => W(Armadilhas.MarcasDasArmadilhas(R<DungeonCell>(a["celula"]))));
            Fn(M, "colocarArmadilhas", (a, c) =>
            {
                var salas = R<List<DungeonCell>>(a["rooms"]);
                Armadilhas.ColocarArmadilhas(salas, Str(a["dungeon"]), Num(a["sabedoria"]), c.RngFn);
                var lista = new List<List<Armadilha>>();
                foreach (var sala in salas) lista.Add(sala.Armadilhas);
                return W(lista);
            });
            Fn(M, "passarDeSala", (a, c) => W(FerimentosDoHeroi.PassarDeSala(R<Hero>(a["hero"]))));
            Fn(M, "curarMembros", (a, c) => W(FerimentosDoHeroi.CurarMembros(R<Hero>(a["hero"]))));
            Fn(M, "curarTudo", (a, c) => W(FerimentosDoHeroi.CurarTudo(R<Hero>(a["hero"]))));
            Fn(M, "textosDosFerimentos", (a, c) => W(FerimentosDoHeroi.TextosDosFerimentos(R<Hero>(a["hero"]))));
            Fn(M, "forcaDoBraco", (a, c) => W(FerimentosDoHeroi.ForcaDoBraco(R<Hero>(a["hero"]))));
            Fn(M, "attemptFlee", (a, c) => W(Flee.AttemptFlee(R<Hero>(a["hero"]), R<MonsterInstance>(a["monster"]), Num(a["roll"]))));
            Fn(M, "ritmoDoAndar", (a, c) => W(FerimentosDoHeroi.RitmoDoAndar(R<Hero>(a["hero"]))));
            Fn(M, "quebrarMembro", (a, c) => W(FerimentosDoHeroi.QuebrarMembro(R<Hero>(a["hero"]), c.RngFn)));
            Fn(M, "pisarNaArmadilha", (a, c) => W(ArmadilhasDoJogo.PisarNaArmadilha(R<EstadoNaMasmorra>(a["estado"]), (int)Num(a["indice"]), c.RngFn)));
            Fn(M, "cobreOHeroiNaSala", (a, c) => W(ArteDaSala.CobreOHeroiNaSala(R<CamadaDaSala>(a["camada"]), R<Walker>(a["walker"]))));
            Fn(M, "paredesDaSala", (a, c) => W(ArteDaSala.ParedesDaSala(Str(a["dungeon"]))));
            Fn(M, "enfeitesDaSala", (a, c) => W(ArteDaSala.EnfeitesDaSala(Str(a["dungeon"]))));
            Fn(M, "geometriaDaSala", (a, c) => W(ArteDaSala.GeometriaDaSala(a["dungeon"].Type == Newtonsoft.Json.Linq.JTokenType.Null ? null : Str(a["dungeon"]))));
            Fn(M, "pontoDaSala", (a, c) => W(MapaDaCidade.PontoDaSala(R<CityCell>(a["celula"]))));
            Fn(M, "pistasDaCidade", (a, c) => W(Cidades.PistasDaCidade(R<EstadoNaCidade>(a["estado"]))));
            Const(M, "TEXTO_DA_CIDADE", () => W(Cidades.TextoDaCidade));
            Fn(M, "troncosNoCaminho", (a, c) => W(Cidades.TroncosNoCaminho(R<EstadoNaCidade>(a["estado"]))));
            Fn(M, "plantaDaCidadeAgora", (a, c) => W(Cidades.PlantaDaCidadeAgora(R<EstadoNaCidade>(a["estado"]))));
            Fn(M, "chegadaNaCidade", (a, c) => W(Cidades.ChegadaNaCidade(R<EstadoNaCidade>(a["estado"]), JsJson.Truthy(a["daMasmorra"]))));
            Fn(M, "entrarNoPonto", (a, c) => W(Cidades.EntrarNoPonto(R<EstadoNaCidade>(a["estado"]), Str(a["ponto"]), c.RngFn, Str(a["pet"]), c.NowOrFail, JsJson.Truthy(a["app"]))));
            Fn(M, "falarComOBram", (a, c) => W(Cidades.FalarComOBram(R<EstadoNaCidade>(a["estado"]), c.RngFn, c.NowOrFail, JsJson.Truthy(a["app"]))));
            Fn(M, "masmorras", (a, c) => W(Portoes.Masmorras(R<Portao>(a["portao"]))));
            Fn(M, "dificuldadeDoPortao", (a, c) => W(Portoes.DificuldadeDoPortao(R<Portao>(a["portao"]))));
            Fn(M, "andares", (a, c) => W(Portoes.Andares(R<Portao>(a["portao"]))));
            Fn(M, "escolherMasmorra", (a, c) => W(Portoes.EscolherMasmorra(R<Portao>(a["portao"]), Str(a["dungeon"]))));
            Fn(M, "escolherMasmorra (fechada devolve o mesmo)", (a, c) =>
            {
                var portao = R<Portao>(a["portao"]);
                return W(ReferenceEquals(Portoes.EscolherMasmorra(portao, Str(a["dungeon"])), portao));
            });
            Fn(M, "escolherAndar", (a, c) => W(Portoes.EscolherAndar(R<Portao>(a["portao"]), Num(a["andar"]))));
            Fn(M, "escolherAndar (andar sem totem devolve o mesmo)", (a, c) =>
            {
                var portao = R<Portao>(a["portao"]);
                return W(ReferenceEquals(Portoes.EscolherAndar(portao, Num(a["andar"])), portao));
            });
            Fn(M, "entrar", (a, c) => W(Portoes.Entrar(R<Portao>(a["portao"]), c.RngFn, c.NowOrFail)));

            // ---------- guilda e totem ----------

            Fn(M, "abrirGuilda", (a, c) => W(Guildas.AbrirGuilda(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "treinar", (a, c) => W(Guildas.Treinar(R<Guilda>(a["guilda"]), R<ClassDef>(a["classe"]), c.RngFn, c.NowOrFail)));

            // ---------- a Encantadora ----------

            Fn(M, "abrirEncantadora", (a, c) => W(Encantadoras.AbrirEncantadora(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "pecasParaEncantar", (a, c) => W(Encantadoras.PecasParaEncantar(JogoJson.LerEstado(a["estado"]))));
            Fn(M, "encantar", (a, c) => W(Encantadoras.Encantar(R<Encantadora>(a["encantadora"]), R<Item>(a["peca"]), Str(a["tipo"]), Num(a["nivel"]))));
            Fn(M, "tocarTotem", (a, c) => W(Totens.TocarTotem(R<EstadoNaMasmorra>(a["estado"]))));
            Fn(M, "voltarPeloTotem", (a, c) => W(Totens.VoltarPeloTotem(R<Totem>(a["totem"]))));
        }
    }
}
