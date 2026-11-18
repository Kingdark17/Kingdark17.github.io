using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: REGRAS_DO_TRATADOR — o preço de cada filhote, por nível do herói.</summary>
    public sealed class RegrasDoTratador
    {
        public double PrecoPorNivel;
    }

    /// <summary>As tabelas de jogo/tratador.ts (fixtures/data/jogo/tratador.json).</summary>
    public sealed class TratadorData
    {
        [JsName("REGRAS_DO_TRATADOR")] public RegrasDoTratador Regras;
        [JsName("FILHOTES")] public List<string> Filhotes = new List<string>();
    }

    public static partial class GameData
    {
        private static TratadorData _tratadorTable;

        /// <summary>jogo/tratador: o preço e os filhotes do tratador de animais.</summary>
        public static TratadorData TratadorTable
        {
            get => Require(_tratadorTable, "jogo/tratador");
            set => _tratadorTable = value;
        }
    }

    /// <summary>TS: FilhoteAVenda — um filhote no cercado: a espécie, o nome, o ícone, e a vida e o dano com que ele vem.</summary>
    public sealed class FilhoteAVenda
    {
        public string Especie;
        public string Nome;
        public string Icone;
        public double Vida;
        public double Dano;
    }

    /// <summary>TS: Tratador — a tela do tratador de animais.</summary>
    public sealed class Tratador
    {
        public EstadoNaCidade Estado;
        public double Preco;
        public List<FilhoteAVenda> Filhotes;
        /// <summary>O herói já tem os 4 animais: não compra mais.</summary>
        public bool Cheio;
        public List<string> Log;
        /// <summary>Acabou de comprar: o id do animal (o app abre a janela do nome). Null, não.</summary>
        public string Comprou;
    }

    /// <summary>
    /// O tratador de animais (port de shared/src/jogo/tratador.ts; o fim do Caçador): o prédio novo ao lado do
    /// ferreiro, só no app e só pro Caçador. Vende os três filhotes, sempre: nível 1, 70% de um bicho da espécie no
    /// andar de força do herói, por 50 de ouro por nível dele; respeita o limite de 4 animais.
    /// </summary>
    public static class Tratadores
    {
        private static TratadorData D => GameData.TratadorTable;

        public static List<string> Filhotes => D.Filhotes;

        /// <summary>TS: precoDoFilhote.</summary>
        public static double PrecoDoFilhote(Hero hero) => D.Regras.PrecoPorNivel * hero.Level;

        private static Companion Filhote(EstadoNaCidade estado, string especie, string id)
        {
            var status = Monsters.StatusDaEspecie(especie, Estados.AndarDeForca(estado), estado.Dificuldade);
            return Animais.Domado(especie, status.MaxHp, status.Dmg, id);
        }

        /// <summary>TS: filhotesDoTratador — os filhotes do cercado, como ficariam com este herói.</summary>
        public static List<FilhoteAVenda> FilhotesDoTratador(EstadoNaCidade estado)
        {
            var lista = new List<FilhoteAVenda>();
            foreach (var especie in D.Filhotes)
            {
                var animal = Filhote(estado, especie, "");
                lista.Add(new FilhoteAVenda { Especie = especie, Nome = animal.Name, Icone = animal.RaceIcon, Vida = animal.MaxHp, Dano = animal.Attack });
            }
            return lista;
        }

        /// <summary>TS: abrirTratador.</summary>
        public static Tratador Abrir(EstadoNaCidade estado) => new Tratador
        {
            Estado = estado,
            Preco = PrecoDoFilhote(estado.Hero),
            Filhotes = FilhotesDoTratador(estado),
            Cheio = Animais.Quantos(estado.Hero, estado.Party, estado.Inventory) >= Animais.Regras.Maximo,
            Log = new List<string> { "O tratador abre o cercado e mostra os bichinhos." },
        };

        private static Tratador ComLog(Tratador tratador, List<string> log) => new Tratador
        {
            Estado = tratador.Estado,
            Preco = tratador.Preco,
            Filhotes = tratador.Filhotes,
            Cheio = tratador.Cheio,
            Log = log,
            Comprou = tratador.Comprou,
        };

        /// <summary>TS: comprarFilhote — o ouro sai, e o filhote entra na equipe (se cabe) ou fica guardado.</summary>
        public static Tratador Comprar(Tratador tratador, string especie, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            var estado = tratador.Estado;
            if (!D.Filhotes.Contains(especie)) return ComLog(tratador, new List<string>());
            if (Animais.Quantos(estado.Hero, estado.Party, estado.Inventory) >= Animais.Regras.Maximo)
                return ComLog(tratador, new List<string> { "Você já tem " + Js.NumberToString(Animais.Regras.Maximo) + " animais." });
            double preco = PrecoDoFilhote(estado.Hero);
            if (estado.Hero.Gold < preco) return ComLog(tratador, new List<string> { "Faltam " + Js.NumberToString(preco - estado.Hero.Gold) + " de ouro." });
            double agora = (now ?? Js.DateNow)();
            string id = "animal_" + Js.NumberToString(Math.Truncate(agora)) + "_" + Js.NumberToString(Rng.RandomInt(100000, rng));
            var animal = Filhote(estado, especie, id);
            var pago = estado.Clone();
            pago.Hero = estado.Hero.Clone();
            pago.Hero.Gold = estado.Hero.Gold - preco;
            var comprado = Animais.Juntar(pago, animal);
            var aberto = Abrir(comprado);
            aberto.Log = new List<string> { "Você paga " + Js.NumberToString(preco) + " de ouro e leva o bichinho: " + Js.Str(animal.Name) + "." };
            aberto.Comprou = id;
            return aberto;
        }
    }
}
