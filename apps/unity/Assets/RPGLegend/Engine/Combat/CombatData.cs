using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// As tabelas de combat/resolve-attack.ts (fixtures/data/combat/resolve-attack.json), inclusive as
    /// privadas (ZONA_DA_CLASSE, ZONA_COMUM, ZONA_MAXIMA, FATIA_POR_PONTO, ERROU, MAGIC_ATTACK_COST).
    /// </summary>
    public sealed class ResolveAttackData
    {
        [JsName("LADOS_DO_DANO")] public double LadosDoDano;
        /// <summary>2/3: a zona de acerto do ataque que combina com a classe.</summary>
        [JsName("ZONA_DA_CLASSE")] public double ZonaDaClasse;
        [JsName("ZONA_COMUM")] public double ZonaComum;
        /// <summary>O teto da Precisão.</summary>
        [JsName("ZONA_MAXIMA")] public double ZonaMaxima;
        /// <summary>Um ponto de d20 é 5% da barra.</summary>
        [JsName("FATIA_POR_PONTO")] public double FatiaPorPonto;
        [JsName("FAIXA_CRITICA")] public double FaixaCritica;
        [JsName("FORCA_NA_BORDA")] public double ForcaNaBorda;
        [JsName("FORCA_NO_CENTRO")] public double ForcaNoCentro;
        /// <summary>A leitura de um erro (o mesmo objeto, sempre, como no TS).</summary>
        [JsName("ERROU")] public LeituraDaMira Errou;
        [JsName("MAGIC_ATTACK_COST")] public double MagicAttackCost;
    }

    /// <summary>As tabelas de combat/party.ts (privada: HIT_CHANCE, a chance de acerto por postura).</summary>
    public sealed class PartyData
    {
        [JsName("HIT_CHANCE")] public OrderedMap<double> HitChance = new OrderedMap<double>();
    }

    /// <summary>As tabelas de combat/status-effects.ts (privada: DOT_KEYS, os status de dano contínuo, na ordem do tick).</summary>
    public sealed class StatusEffectsData
    {
        [JsName("DOT_KEYS")] public List<string> DotKeys = new List<string>();
    }

    /// <summary>As tabelas de combat/use-power.ts (privada: PENALIDADE_DE_MANA, o ×1,2 da Mana Instável).</summary>
    public sealed class UsePowerData
    {
        [JsName("PENALIDADE_DE_MANA")] public double PenalidadeDeMana;
    }

    /// <summary>As tabelas de combat/flee.ts.</summary>
    public sealed class FleeData
    {
        [JsName("FLEE_TARGET")] public double FleeTarget;
    }

    /// <summary>As tabelas de combat/dodge.ts.</summary>
    public sealed class DodgeData
    {
        [JsName("ESQUIVA_TARGET")] public double EsquivaTarget;
    }
}
