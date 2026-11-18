using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace RPGLegend.Engine
{
    /// <summary>TS: REGRAS_DE_DOMAR — as regras de domar e dos animais do Caçador (rodada 7b).</summary>
    public sealed class RegrasDeDomar
    {
        public double Distancia;
        public double Vida;
        public double Chance;
        public double Aceites;
        public double Recusas;
        public double Status;
        public double Maximo;
        public double Ativos;
        public double Nome;
    }

    /// <summary>As tabelas de combat/animais.ts (fixtures/data/combat/animais.json).</summary>
    public sealed class AnimaisData
    {
        [JsName("COMIDA_DO_ANIMAL")] public OrderedMap<string> ComidaDoAnimal = new OrderedMap<string>();
        [JsName("COMIDAS_DOS_ANIMAIS")] public List<string> Comidas = new List<string>();
        [JsName("REGRAS_DE_DOMAR")] public RegrasDeDomar Regras;
    }

    public static partial class GameData
    {
        private static AnimaisData _animaisTable;

        /// <summary>combat/animais: as comidas dos bichos e as regras de domar.</summary>
        public static AnimaisData AnimaisTable
        {
            get => Require(_animaisTable, "combat/animais");
            set => _animaisTable = value;
        }
    }

    /// <summary>TS: AnimalDoCompanheiro — o que só o animal domado tem: o id que não muda, o nível e as batalhas.</summary>
    public sealed class AnimalDoCompanheiro
    {
        public string Id;
        public double Nivel;
        public double Batalhas;

        public AnimalDoCompanheiro Clone() => (AnimalDoCompanheiro)MemberwiseClone();
    }

    /// <summary>O herói e a equipe (o <c>{ hero, party }</c> que as funções dos animais recebem e devolvem no TS).</summary>
    public sealed class EquipeDoHeroi
    {
        public Hero Hero;
        public List<Companion> Party;
    }

    /// <summary>
    /// Os animais do Caçador (port de shared/src/combat/animais.ts; rodada 7b): só os bichos se domam (o lobo das
    /// sombras, a aranha e o morcego, cada um com a comida preferida); o domado é um companheiro com 70% da vida e do
    /// dano do bicho; até 4, os 2 primeiros na equipe e os outros guardados no herói; não ocupam vaga de recruta.
    /// </summary>
    public static class Animais
    {
        private static AnimaisData D => GameData.AnimaisTable;

        public static RegrasDeDomar Regras => D.Regras;
        public static List<string> Comidas => D.Comidas;

        /// <summary>TS: comidaPreferida — a comida preferida do bicho, ou null se ele não se doma.</summary>
        public static string ComidaPreferida(string speciesId) => speciesId != null && D.ComidaDoAnimal.TryGet(speciesId, out var comida) ? comida : null;

        /// <summary>TS: domavel — uma das espécies com comida preferida, e não é chefe.</summary>
        public static bool Domavel(string speciesId, bool isBoss) => !isBoss && ComidaPreferida(speciesId) != null;

        /// <summary>TS: animaisDaEquipe.</summary>
        public static List<Companion> DaEquipe(IReadOnlyList<Companion> party)
        {
            var lista = new List<Companion>();
            if (party != null)
                foreach (var membro in party)
                    if (membro.Animal != null) lista.Add(membro);
            return lista;
        }

        /// <summary>TS: quantosAnimais — os da equipe e os guardados.</summary>
        public static double Quantos(Hero hero, IReadOnlyList<Companion> party) => DaEquipe(party).Count + (hero.Animais?.Count ?? 0);

        /// <summary>TS: recrutas — a equipe sem os esqueletos e sem os animais: o que conta na vaga dos recrutas.</summary>
        public static List<Companion> Recrutas(IReadOnlyList<Companion> party)
        {
            var lista = new List<Companion>();
            if (party != null)
                foreach (var membro in party)
                    if (membro.Invocado != true && membro.Animal == null) lista.Add(membro);
            return lista;
        }

        /// <summary>TS: animalDomado — 70% da vida máxima e do dano do bicho, com o nome da espécie.</summary>
        public static Companion Domado(string speciesId, double maxHp, double dmg, string id)
        {
            var r = Regras;
            var especie = MonsterCatalog.SpeciesById(speciesId);
            string nome = especie?.Name ?? speciesId;
            double vida = Js.Max(1, Js.Round(maxHp * r.Status / 100));
            double ataque = Js.Max(1, Js.Round(dmg * r.Status / 100));
            return new Companion
            {
                Name = nome,
                RaceIcon = especie?.Icon ?? "🐾",
                Race = nome,
                ClassName = "Animal",
                ClassIcon = "🐾",
                Hp = vida,
                MaxHp = vida,
                Attack = ataque,
                Attrs = new Attributes(),
                Stance = CompanionStances.Agressiva,
                Ability = "Instinto",
                AbilityDesc = "Um animal domado pelo Caçador.",
                Especie = speciesId,
                Animal = new AnimalDoCompanheiro { Id = id, Nivel = 1, Batalhas = 0 },
            };
        }

        /// <summary>TS: juntarAnimal — entra na equipe se ainda cabe (2 seguem o herói); senão fica guardado com o herói.</summary>
        public static EquipeDoHeroi Juntar(Hero hero, List<Companion> party, Companion animal)
        {
            if (DaEquipe(party).Count < Regras.Ativos)
                return new EquipeDoHeroi { Hero = hero, Party = new List<Companion>(party) { animal } };
            var guardados = hero.Animais != null ? new List<Companion>(hero.Animais) : new List<Companion>();
            guardados.Add(animal);
            var novo = hero.Clone();
            novo.Animais = guardados;
            return new EquipeDoHeroi { Hero = novo, Party = party };
        }

        public static T Juntar<T>(T estado, Companion animal) where T : EstadoDoJogo
        {
            var junto = Juntar(estado.Hero, estado.Party, animal);
            var copia = (T)((EstadoDoJogo)estado).Clone();
            copia.Hero = junto.Hero;
            copia.Party = junto.Party;
            return copia;
        }

        /// <summary>O espaço que o <c>trim</c> do JS tira das pontas.</summary>
        private static bool EspacoDoJs(char c) =>
            c == '\t' || c == '\v' || c == '\f' || c == ' ' || c == '\u00A0' || c == '\uFEFF' || c == '\n' || c == '\r' || c == '\u2028' || c == '\u2029' ||
            CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.SpaceSeparator;

        private static string TrimDoJs(string s)
        {
            int ini = 0, fim = s.Length;
            while (ini < fim && EspacoDoJs(s[ini])) ini++;
            while (fim > ini && EspacoDoJs(s[fim - 1])) fim--;
            return s.Substring(ini, fim - ini);
        }

        /// <summary>As letras do texto como o <c>for...of</c> do JS: um par de surrogates é uma letra só.</summary>
        private static List<string> Letras(string s)
        {
            var letras = new List<string>();
            for (int i = 0; i < s.Length; i++)
            {
                if (char.IsHighSurrogate(s[i]) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
                {
                    letras.Add(s.Substring(i, 2));
                    i++;
                }
                else letras.Add(s[i].ToString());
            }
            return letras;
        }

        /// <summary>TS: nomeDoAnimal — sem caracteres de controle nem &lt; &gt;, sem espaço nas pontas, até 20 letras; vazio, o padrão.</summary>
        public static string NomeDoAnimal(string nome, string padrao)
        {
            var limpo = new StringBuilder();
            foreach (var letra in Letras(nome ?? ""))
            {
                if (letra.Length == 1)
                {
                    char c = letra[0];
                    if (c < 32 || c == 127 || c == '<' || c == '>') continue;
                }
                limpo.Append(letra);
            }
            string texto = TrimDoJs(limpo.ToString());
            var letras = Letras(texto);
            if (letras.Count > Regras.Nome) texto = TrimDoJs(string.Concat(letras.GetRange(0, (int)Regras.Nome)));
            return texto.Length > 0 ? texto : padrao;
        }

        /// <summary>TS: nomearAnimal — dá nome ao animal, esteja ele na equipe ou guardado.</summary>
        public static EquipeDoHeroi Nomear(Hero hero, List<Companion> party, string id, string nome)
        {
            Companion Trocar(Companion membro)
            {
                if (membro.Animal == null || membro.Animal.Id != id) return membro;
                var novo = membro.Clone();
                novo.Name = NomeDoAnimal(nome, membro.Race);
                return novo;
            }
            var equipe = party.ConvertAll(Trocar);
            if (hero.Animais == null) return new EquipeDoHeroi { Hero = hero, Party = equipe };
            var heroNovo = hero.Clone();
            heroNovo.Animais = hero.Animais.ConvertAll(Trocar);
            return new EquipeDoHeroi { Hero = heroNovo, Party = equipe };
        }

        public static T Nomear<T>(T estado, string id, string nome) where T : EstadoDoJogo
        {
            var nomeado = Nomear(estado.Hero, estado.Party, id, nome);
            var copia = (T)((EstadoDoJogo)estado).Clone();
            copia.Hero = nomeado.Hero;
            copia.Party = nomeado.Party;
            return copia;
        }
    }
}
