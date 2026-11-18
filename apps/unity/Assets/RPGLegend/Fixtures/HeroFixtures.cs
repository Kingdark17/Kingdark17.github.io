using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/hero.json: stats, derived e catalog (hero.ts, mastery e teachers vêm depois).</summary>
    internal sealed class HeroFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "hero";

            // ---------- stats ----------
            Const(M, "ATTR_KEYS", () => W(StatKeys.Attrs));
            Const(M, "EQUIP_SLOTS", () => W(StatKeys.EquipSlots));
            Const(M, "ITEM_STAT_KEYS", () => W(StatKeys.ItemStats));
            Fn(M, "emptyAttributes", (a, c) => W(Attributes.Empty()));

            // ---------- derived ----------
            Const(M, "CRIT_PENALTY", () => N(Derived.CritPenalty));
            Fn(M, "equipmentCap", (a, c) => N(Derived.EquipmentCap(Num(a["level"]))));
            Fn(M, "equipmentStat", (a, c) =>
                N(Derived.EquipmentStat(R<Equipment>(a["equip"]), Str(a["key"]), JsJson.ToOptionalNumber(a["cap"]))));
            Fn(M, "equipmentBonus", (a, c) => W(Derived.EquipmentBonus(R<Equipment>(a["equip"]))));
            Fn(M, "xpForLevel", (a, c) => N(Derived.XpForLevel(Num(a["level"]))));
            Fn(M, "attrModifier", (a, c) => N(Derived.AttrModifier(Num(a["value"]))));
            Fn(M, "totalAttributePoints", (a, c) => N(Derived.TotalAttributePoints(R<Attributes>(a["attrs"]))));
            Fn(M, "derivedStats", (a, c) =>
                W(Derived.Compute(R<HeroCore>(a["hero"]), JsJson.Truthy(JsJson.Prop(a["options"], "critPenalty")))));

            // ---------- classes-de-luta ----------
            Fn(M, "classeDeLuta", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.De(quem.ClassId, quem.ClassName));
            });
            Fn(M, "alcanceDoHeroi", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.AlcanceDoHeroi(quem.ClassId, quem.ClassName, quem.Equip?.Get("arma")?.TemplateId, quem.Ativo));
            });
            Fn(M, "ataqueDasMaos", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.AtaqueDasMaos(quem.ClassId, quem.ClassName, quem.Level, quem.Equip?.Get("arma") != null));
            });
            Fn(M, "vidaComAClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.VidaComAClasse(Num(a["vida"]), quem.ClassId, quem.ClassName));
            });
            Fn(M, "classeRefeita", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ClasseRefeita(quem.ClassId, quem.ClassName));
            });
            Fn(M, "criticoDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.CriticoDaClasse(quem.ClassId, quem.ClassName));
            });
            Fn(M, "puxaOsMonstros", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.PuxaOsMonstros(quem.ClassId, quem.ClassName));
            });
            Fn(M, "bonusDoAtaque", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.BonusDoAtaque(quem.ClassId, quem.ClassName, quem.Equip?.Get("arma")?.TemplateId, R<ContadoresDaClasse>(a["c"]),
                    JsJson.Truthy(JsJson.Prop(a["alvo"], "colado")), JsJson.Truthy(JsJson.Prop(a["alvo"], "chefe")),
                    JsJson.ToOptionalNumber(JsJson.Prop(a["alvo"], "blocos")) ?? 0, quem.Ativo));
            });
            Fn(M, "esquivaDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.EsquivaDaClasse(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"]), JsJson.Truthy(a["chefe"]), quem.Ativo));
            });
            Fn(M, "resistenciaDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.ResistenciaDaClasse(quem.ClassId, quem.ClassName, quem.Hp ?? 0, quem.MaxHp ?? 0, R<ContadoresDaClasse>(a["c"]), quem.Ativo));
            });
            Fn(M, "textosDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                var extras = a["extras"] != null && a["extras"].Type != JTokenType.Null ? R<ExtrasDaClasse>(a["extras"]) : null;
                return W(ClassesDeLuta.TextosDaClasse(quem.ClassId, quem.ClassName, quem.Hp ?? 0, quem.MaxHp ?? 0, R<ContadoresDaClasse>(a["c"]), extras, quem.Ativo));
            });
            Fn(M, "apoiaAliado", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ApoiaAliado(quem.ClassId, quem.ClassName));
            });
            Fn(M, "miraDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.MiraDaClasse(quem.ClassId, quem.ClassName));
            });
            Fn(M, "mortoVivo", (a, c) => W(ClassesDeLuta.MortoVivo(Str(a["especie"]))));
            Fn(M, "danoDaDistancia", (a, c) => N(ClassesDeLuta.DanoDaDistancia(Num(a["blocos"]), Num(a["parado"]))));
            Fn(M, "efeitosDaMoral", (a, c) => W(ClassesDeLuta.EfeitosDaMoral(Num(a["nivel"]))));
            Fn(M, "contarCriticoNoAliado", (a, c) => W(ClassesDeLuta.ContarCriticoNoAliado(R<Moral>(a["moral"]))));
            Fn(M, "curaDoApoio", (a, c) =>
                N(ClassesDeLuta.CuraDoApoio(Str(a["tipo"]), Num(JsJson.Prop(a["vida"], "hp")), Num(JsJson.Prop(a["vida"], "maxHp")), JsJson.ToOptionalNumber(a["mais"]) ?? 0)));
            Fn(M, "danoDoDruida", (a, c) => N(ClassesDeLuta.DanoDoDruida(R<QuemLutaDoCaso>(a["quem"]).Ativo, Num(a["golpe"]))));
            Fn(M, "auraDeFera", (a, c) => W(ClassesDeLuta.AuraDeFera(Num(a["golpes"]))));
            Fn(M, "golpeForte", (a, c) => W(ClassesDeLuta.GolpeForte(Num(a["golpe"]))));
            Fn(M, "golpeQuePrende", (a, c) => W(ClassesDeLuta.GolpeQuePrende(Num(a["golpe"]))));
            Fn(M, "raizesFundas", (a, c) => W(ClassesDeLuta.RaizesFundas(Num(a["golpes"]))));
            Fn(M, "quemEnsina", (a, c) => W(Estilos.QuemEnsina(a["estilo"] == null || a["estilo"].Type == JTokenType.Null ? null : Str(a["estilo"]))));
            Fn(M, "duracaoDaFe", (a, c) => N(ClassesDeLuta.DuracaoDaFe(JsJson.Truthy(a["comunhao"]), Num(a["dano"]), Num(a["quantos"]))));
            Fn(M, "oQueCanaliza", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.OQueCanaliza(quem.ClassId, quem.ClassName, quem.Ativo));
            });
            Fn(M, "passosDoCanal", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.PassosDoCanal(quem.ClassId, quem.ClassName, quem.Ativo));
            });
            Fn(M, "criticoDoEstilo", (a, c) => N(ClassesDeLuta.CriticoDoEstilo(R<QuemLutaDoCaso>(a["quem"]).Ativo)));

            // ---------- estilos (rodada 5a) ----------
            Const(M, "ESTILOS", () => W(GameData.EstilosTable.Estilos));
            Const(M, "CHANCE_DO_MESTRE", () => W(GameData.EstilosTable.ChanceDoMestre));
            Fn(M, "estiloAtivo", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(Estilos.Ativo(quem.ClassId, quem.ClassName, quem.Estilos, quem.Estilo));
            });
            Fn(M, "estilosQueFaltam", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(Estilos.QueFaltam(quem.ClassId, quem.ClassName, quem.Estilos));
            });
            Fn(M, "chanceDoMestre", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(Estilos.ChanceDoMestre(quem.ClassId, quem.ClassName, quem.Estilos));
            });
            Fn(M, "vidaComOEstilo", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(Estilos.VidaComOEstilo(Num(a["vida"]), quem.ClassId, quem.ClassName, quem.Estilos, quem.Estilo));
            });
            Fn(M, "sortearEstilo", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(Estilos.Sortear(quem.ClassId, quem.ClassName, quem.Estilos, c.RngFn));
            });
            Fn(M, "estiloUnico", (a, c) => { var quem = R<QuemLutaDoCaso>(a["quem"]); return W(Estilos.EstiloUnico(quem.ClassId, quem.ClassName)); });
            Fn(M, "aCadaGolpe", (a, c) => W(ClassesDeLuta.ACadaGolpe(Num(a["golpe"]), Num(a["n"]))));
            Fn(M, "danoDoMago", (a, c) => N(ClassesDeLuta.DanoDoMago(R<QuemLutaDoCaso>(a["quem"]).Ativo, Num(a["golpe"]))));
            // ---------- as peças secretas (rodada 6a) ----------
            Fn(M, "pecasDaClasse", (a, c) => { var quem = R<QuemLutaDoCaso>(a["quem"]); return W(PecasSecretas.DaClasse(quem.ClassId, quem.ClassName)); });
            Fn(M, "chanceDoNegociante", (a, c) => { var quem = R<QuemLutaDoCaso>(a["quem"]); return N(PecasSecretas.ChanceDoNegociante(quem.ClassId, quem.ClassName)); });
            Fn(M, "sortearPecaSecreta", (a, c) => { var quem = R<QuemLutaDoCaso>(a["quem"]); return W(PecasSecretas.Sortear(quem.ClassId, quem.ClassName, c.RngFn)); });
            Fn(M, "pecaSecreta", (a, c) => W(PecasSecretas.PorId(Str(a["id"]))));
            Fn(M, "vidaComAArma", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(PecasSecretas.VidaComAArma(Num(a["vida"]), quem.ClassId, quem.ClassName,
                    Str(JsJson.Prop(JsJson.Prop(a["quem"]["equip"], "arma"), "templateId")), Str(JsJson.Prop(JsJson.Prop(a["quem"]["equip"], "secundaria"), "templateId"))));
            });
            Fn(M, "aprenderEstilo", (a, c) => AprenderOuTrocar(a, true));
            Fn(M, "trocarEstilo", (a, c) => AprenderOuTrocar(a, false));
            Fn(M, "custoDaMagia", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.CustoDaMagia(quem.ClassId, quem.ClassName));
            });
            Fn(M, "manaComAClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.ManaComAClasse(Num(a["mana"]), quem.ClassId, quem.ClassName));
            });
            Fn(M, "passosPorPonto", (a, c) => N(ClassesDeLuta.PassosPorPonto(Str(a["tipo"]))));
            Fn(M, "forcaDaExplosao", (a, c) => N(ClassesDeLuta.ForcaDaExplosao(Num(a["ki"]))));
            Fn(M, "criarLacaio", (a, c) =>
                W(Invocacao.CriarLacaio(R<Hero>(a["hero"]), R<System.Collections.Generic.List<Companion>>(a["party"]), a["especie"] != null && a["especie"].Type != JTokenType.Null ? Str(a["especie"]) : null)));
            Fn(M, "custoDoLacaio", (a, c) => N(Invocacao.CustoDoLacaio(R<Hero>(a["hero"]))));
            Fn(M, "trocarPeloCristal", (a, c) =>
                W(Invocacao.TrocarPeloCristal(R<Hero>(a["hero"]), R<System.Collections.Generic.List<Companion>>(a["party"]), (int)Num(a["indice"]), R<CristalDoInimigo>(a["cristal"]), c.RngFn)));
            Fn(M, "mudarEstadoDoLacaio", (a, c) =>
                W(Invocacao.MudarEstadoDoLacaio(R<System.Collections.Generic.List<Companion>>(a["party"]), (int)Num(a["indice"]), Str(a["estado"]))));
            Fn(M, "liberarMagia", (a, c) => W(Invocacao.LiberarMagia(R<Hero>(a["hero"]), Str(a["masmorra"]))));
            Fn(M, "lugarAoLado", (a, c) =>
            {
                var lugar = Arenas.LugarAoLado(Num(JsJson.Prop(a["centro"], "x")), Num(JsJson.Prop(a["centro"], "y")), (int)Num(a["k"]), R<GeometriaDaSala>(a["geometria"]), R<System.Collections.Generic.List<TileRef>>(a["paredes"]));
                return W(new PontoNaSala { X = lugar.X, Y = lugar.Y });
            });
            Fn(M, "contarParado", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ContarParado(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"]), JsJson.Truthy(a["andou"])));
            });
            Fn(M, "contarAcerto", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ContarAcerto(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"]), JsJson.Truthy(a["critico"])));
            });
            Fn(M, "contarGolpeLevado", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.ContarGolpeLevado(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"])));
            });
            Fn(M, "esfriar", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return W(ClassesDeLuta.Esfriar(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"])));
            });
            Fn(M, "devolucaoDaClasse", (a, c) =>
            {
                var quem = R<QuemLutaDoCaso>(a["quem"]);
                return N(ClassesDeLuta.DevolucaoDaClasse(quem.ClassId, quem.ClassName, R<ContadoresDaClasse>(a["c"])));
            });

            // ---------- catalog ----------
            Const(M, "RACES", () => W(Catalog.Races));
            Const(M, "CLASSES", () => W(Catalog.Classes));
            Const(M, "POWERS", () => W(Catalog.Powers));
            Const(M, "DEBUFFS", () => W(Catalog.Debuffs));
            Const(M, "LEGACY_DEBUFF_EFFECTS", () => W(GameData.HeroCatalog.LegacyDebuffEffects));
            Const(M, "CLASS_PASSIVES", () => W(GameData.HeroCatalog.ClassPassives));
            Fn(M, "classById", (a, c) => W(Catalog.ClassById(Str(a["id"]))));
            Fn(M, "classByName", (a, c) => W(Catalog.ClassByName(Str(a["name"]))));
            Fn(M, "raceByName", (a, c) => W(Catalog.RaceByName(Str(a["name"]))));
            Fn(M, "powerById", (a, c) => W(Catalog.PowerById(Str(a["id"]))));
            Fn(M, "powerByName", (a, c) => W(Catalog.PowerByName(Str(a["name"]))));
            Fn(M, "debuffById", (a, c) => W(Catalog.DebuffById(Str(a["id"]))));
            Fn(M, "classPassive", (a, c) => W(Catalog.ClassPassive(Str(a["classId"]))));
            Fn(M, "idDaClasse", (a, c) =>
                W(Catalog.IdDaClasse(Str(JsJson.Prop(a["quem"], "classId")), Str(JsJson.Prop(a["quem"], "className")))));
            Fn(M, "idDaRaca", (a, c) =>
                W(Catalog.IdDaRaca(Str(JsJson.Prop(a["quem"], "raceId")), Str(JsJson.Prop(a["quem"], "race")))));
        }

        /// <summary>
        /// aprenderEstilo / trocarEstilo do TS: devolvem o próprio `quem` com os estilos novos (ou intacto). Mexe no
        /// JSON do caso, pra manter os outros campos como vieram.
        /// </summary>
        private static JToken AprenderOuTrocar(JToken a, bool aprender)
        {
            var quemJson = (JObject)a["quem"].DeepClone();
            var quem = R<QuemLutaDoCaso>(a["quem"]);
            string id = a["id"] == null || a["id"].Type == JTokenType.Null ? null : Str(a["id"]);
            if (aprender)
            {
                var novos = Estilos.ComOAprendido(quem.ClassId, quem.ClassName, quem.Estilos, id);
                if (novos == null) return quemJson;
                quemJson["estilos"] = new JArray(novos);
                quemJson["estilo"] = id;
                return quemJson;
            }
            // O do Mago é pra sempre (rodada 5c).
            if (Estilos.EstiloUnico(quem.ClassId, quem.ClassName)) return quemJson;
            if (id == null)
            {
                quemJson.Remove("estilo");
                return quemJson;
            }
            bool tem = quem.Estilos != null && quem.Estilos.Contains(id);
            if (!tem || Estilos.PorId(id)?.Classe != Catalog.IdDaClasse(quem.ClassId, quem.ClassName)) return quemJson;
            quemJson["estilo"] = id;
            return quemJson;
        }
    }

    /// <summary>O `quem` dos casos de classes-de-luta: a classe, a arma na mão e os estilos.</summary>
    internal sealed class QuemLutaDoCaso
    {
        public string ClassId;
        public string ClassName;
        public double? Level;
        public Equipment Equip;
        public double? Hp;
        public double? MaxHp;
        public System.Collections.Generic.List<string> Estilos;
        public string Estilo;

        /// <summary>O estilo ativo (o idDoEstilo do TS).</summary>
        public string Ativo => RPGLegend.Engine.Estilos.IdDoEstilo(ClassId, ClassName, Estilos, Estilo);
    }
}
