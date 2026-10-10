using Newtonsoft.Json.Linq;
using NUnit.Framework;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Regressões fora dos fixtures: caminhos que o gerador do TS não cobre, mas que um save de verdade
    /// (antigo, incompleto ou gravado por uma versão mais nova do jogo web) pode trazer.
    /// </summary>
    public class PortRegressionTests
    {
        /// <summary>
        /// Um monstro guardado numa célula do mapa é lido como MonsterInstance. Se ele trouxer estado de combate
        /// (guardHits, poisonStrike…), o TS mantém essas chaves no spread do freshCombatMonster e o combate as lê.
        /// </summary>
        [Test]
        public void MonstroSalvoComEstadoDeCombateMantemOsCamposAoEntrarNoCombate()
        {
            var json = (JObject)JsJson.Parse(
                "{\"speciesId\":\"goblin\",\"enemyClassId\":\"brutamontes\",\"floor\":5,\"hp\":40,\"maxHp\":100," +
                "\"dmg\":5,\"speed\":8,\"xp\":10,\"gold\":10,\"isBoss\":false,\"guardHits\":2,\"poisonStrike\":true," +
                "\"rageTriggered\":true,\"status\":{\"veneno\":{\"turns\":2,\"dmg\":3}},\"attackCount\":4,\"marcaDoWeb\":\"x\"}");

            var instance = JsSerializer.Read<MonsterInstance>(json);
            var fresh = MonsterState.FreshCombatMonster(instance);

            Assert.AreEqual(2.0, fresh.GuardHits, "guardHits");
            Assert.AreEqual(true, fresh.PoisonStrike, "poisonStrike");
            Assert.AreEqual(true, fresh.RageTriggered, "rageTriggered");
            Assert.AreEqual(0.0, fresh.AttackCount, "attackCount zera");

            // TS: { ...monster, status: {}, attackCount: 0 } — o resto, inclusive a chave desconhecida, fica.
            var expected = (JObject)json.DeepClone();
            expected["status"] = new JObject();
            expected["attackCount"] = 0;
            JsonAssert.AreEqual(expected, JsSerializer.Write(fresh), "monstro");
        }

        /// <summary>
        /// Bênção sem a contagem de combates: no TS, <c>undefined &lt;= 0</c> é falso, então ela é aplicada; e
        /// <c>NaN &gt; 0</c> também é falso, então ela some depois do primeiro combate.
        /// </summary>
        [Test]
        public void BencaoSemContagemValeUmaVezESome()
        {
            var hero = JsSerializer.Read<Hero>(JsJson.Parse("{\"level\":1,\"buffs\":{},\"npcBlessing\":{\"dodge\":12}}"));

            var result = NpcServices.ApplyNpcBlessing(hero);

            Assert.IsTrue(result.Applied, "aplicada");
            Assert.IsTrue(result.Hero.NpcBlessing == null, "a bênção some");
            Assert.AreEqual(999.0, result.Hero.Buffs.EsquivaTurns, "esquivaTurns");
            Assert.AreEqual(12.0, result.Hero.Buffs.EsquivaAmount, "esquivaAmount");
        }
    }
}
