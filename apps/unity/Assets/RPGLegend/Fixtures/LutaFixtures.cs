using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/luta.json: a luta em tempo real do app (luta/eventos-de-arma.ts, luta/arena.ts e o resolverGolpe).</summary>
    internal sealed class LutaFixtures : IFixtureModule
    {
        private const string M = "luta";

        public void Register()
        {
            Fn(M, "eventoDaArma", (a, c) => W(EventosDeArma.EventoDaArma(Str(a["templateId"]), JsJson.Truthy(a["teclado"]))));
            Fn(M, "eventoDoPoder", (a, c) => W(EventosDeArma.EventoDoPoder(c.RngFn, JsJson.Truthy(a["teclado"]))));
            Fn(M, "eventoDoAtaque", (a, c) => W(EventosDeArma.EventoDoAtaque(R<Hero>(a["hero"]), Str(a["estilo"]), c.RngFn, JsJson.Truthy(a["teclado"]))));
            Fn(M, "lerEvento", (a, c) => W(EventosDeArma.LerEvento(R<EventoDeArma>(a["evento"]), R<JogadaDoEvento>(a["jogada"]))));
            Fn(M, "abrirLuta", (a, c) => W(Arenas.AbrirLuta(R<EstadoNaMasmorra>(a["estado"]), R<Walker>(a["chegada"]), Str(a["pet"]), JsJson.Truthy(a["teclado"]), Str(a["dupla"]),
                a["memoria"] != null && a["memoria"].Type != JTokenType.Null ? R<MemoriaDaLuta>(a["memoria"]) : null)));
            Fn(M, "extrasDaLuta", (a, c) =>
            {
                var luta = R<LutaEmTempoReal>(a["luta"]);
                return W(new ExtrasDaLutaDoCaso { Memoria = Arenas.MemoriaDaLuta(luta), Extras = Arenas.ExtrasDaLuta(luta), Dano = Arenas.DanoLevadoNaJanela(luta) });
            });
            Fn(M, "espelhoDaLuta", (a, c) => W(Arenas.EspelhoDaLuta(R<LutaEmTempoReal>(a["luta"]), R<System.Collections.Generic.List<double>>(a["inteiros"]))));
            Fn(M, "simularLuta", (a, c) => W(Arenas.SimularLuta(R<LutaEmTempoReal>(a["luta"]), R<System.Collections.Generic.List<EntradaDaLuta>>(a["entradas"]), c.RngFn, c.NowOrFail)));
            // O gerador chama resolverGolpe(hero, monster, dado, leitura, attackStyle, { ...args.options, rng }).
            Fn(M, "resolverGolpe", (a, c) =>
            {
                var options = new ResolveAttackOptions
                {
                    Rng = c.RngFn,
                    PetCriticoBonus = JsJson.ToOptionalNumber(JsJson.Prop(a["options"], "petCriticoBonus")),
                };
                return W(Attack.ResolverGolpe(R<Hero>(a["hero"]), R<CombatMonsterView>(a["monster"]), Num(a["dado"]), R<LeituraDaMira>(a["leitura"]),
                    Str(a["attackStyle"]), options));
            });
        }
    }

    /// <summary>O retorno do caso extrasDaLuta: a memória, os extras da linha da classe e o dano dos últimos 30 s.</summary>
    internal sealed class ExtrasDaLutaDoCaso
    {
        public MemoriaDaLuta Memoria;
        public ExtrasDaClasse Extras;
        public double Dano;
    }
}
