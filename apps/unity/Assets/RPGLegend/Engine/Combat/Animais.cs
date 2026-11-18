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

    /// <summary>TS: REGRAS_DOS_ANIMAIS — o animal na luta e os níveis (rodada 7c).</summary>
    public sealed class RegrasDosAnimais
    {
        public double BatalhasPorNivel;
        public double NivelMaximo;
        public double PorNivel;
        public double Retaguarda;
        public double DanoNaRetaguarda;
        public double ResistenciaNoOfensivo;
        public double LadoDaGuarda;
    }

    /// <summary>As tabelas de combat/animais.ts (fixtures/data/combat/animais.json).</summary>
    public sealed class AnimaisData
    {
        [JsName("COMIDA_DO_ANIMAL")] public OrderedMap<string> ComidaDoAnimal = new OrderedMap<string>();
        [JsName("COMIDAS_DOS_ANIMAIS")] public List<string> Comidas = new List<string>();
        [JsName("REGRAS_DE_DOMAR")] public RegrasDeDomar Regras;
        [JsName("REGRAS_DOS_ANIMAIS")] public RegrasDosAnimais NaLuta;
        [JsName("REGRAS_DA_MONTARIA")] public RegrasDaMontaria Montaria;
        [JsName("REGRAS_DO_CRISTAL")] public RegrasDoCristal Cristal;
    }

    /// <summary>TS: REGRAS_DA_MONTARIA — o animal de nível 5+ que leva o herói (rodada 7d).</summary>
    public sealed class RegrasDaMontaria
    {
        public double Nivel;
        public double Velocidade;
        public double Alcance;
        public double NivelDaResistencia;
        public double Segura;
        public double NivelDoDano;
        public double Dano;
    }

    /// <summary>TS: REGRAS_DO_CRISTAL — o cristal do animal caído e a poção que o desfaz (rodada 7d).</summary>
    public sealed class RegrasDoCristal
    {
        public string Cristal;
        public string Pocao;
        public double VidaComPocao;
    }

    /// <summary>O herói, a equipe e a mochila (o <c>{ hero, party, inventory }</c> do TS nas funções do cristal).</summary>
    public sealed class HeroiEquipeMochila
    {
        public Hero Hero;
        public List<Companion> Party;
        public List<Item> Inventory;
    }

    /// <summary>TS: o retorno de cristalizarCaidos e de reviverComPocao.</summary>
    public sealed class AnimaisComLog
    {
        public HeroiEquipeMochila Estado;
        public List<string> Log;
    }

    /// <summary>TS: o retorno de reviverNaTaverna.</summary>
    public sealed class AnimaisNaTaverna
    {
        public HeroiEquipeMochila Estado;
        public double Voltaram;
    }

    /// <summary>TS: o retorno de contarBatalha — a equipe depois da batalha e os animais que subiram de nível.</summary>
    public sealed class BatalhaContada
    {
        public List<Companion> Party;
        public List<Companion> Subiram;
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
        /// <summary>A vida máxima e o dano de quando foi domado: o nível conta a partir deles (rodada 7c). Null, os de agora.</summary>
        public double? VidaBase;
        public double? AtaqueBase;

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

        /// <summary>TS: quantosAnimais — os da equipe, os guardados e os caídos em cristal na mochila (rodada 7d).</summary>
        public static double Quantos(Hero hero, IReadOnlyList<Companion> party, IReadOnlyList<Item> inventory = null)
        {
            double cristais = 0;
            if (inventory != null)
                foreach (var item in inventory)
                    if (item.Animal != null) cristais++;
            return DaEquipe(party).Count + (hero.Animais?.Count ?? 0) + cristais;
        }

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
                Animal = new AnimalDoCompanheiro { Id = id, Nivel = 1, Batalhas = 0, VidaBase = vida, AtaqueBase = ataque },
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

        public static T Nomear<T>(T estado, string id, string nome) where T : EstadoDoJogo => ComEquipe(estado, Nomear(estado.Hero, estado.Party, id, nome));

        private static T ComEquipe<T>(T estado, EquipeDoHeroi equipe) where T : EstadoDoJogo
        {
            if (ReferenceEquals(equipe.Hero, estado.Hero) && ReferenceEquals(equipe.Party, estado.Party)) return estado;
            var copia = (T)((EstadoDoJogo)estado).Clone();
            copia.Hero = equipe.Hero;
            copia.Party = equipe.Party;
            return copia;
        }

        // ---------- o animal na luta e os níveis (rodada 7c) ----------

        public static RegrasDosAnimais NaLuta => D.NaLuta;

        /// <summary>TS: estadoDoAnimal — o estado na arena (a retaguarda, se ainda não mudou).</summary>
        public static string EstadoDoAnimal(Companion membro) => membro.EstadoDoLacaio ?? "retaguarda";

        /// <summary>TS: statusNoNivel — o de quando foi domado, mais 20% dele por nível acima do 1.</summary>
        public static double StatusNoNivel(double baseDoStatus, double nivel) => Js.Max(1, Js.Round(baseDoStatus * (100 + NaLuta.PorNivel * (nivel - 1)) / 100));

        /// <summary>TS: contarBatalha — a luta vencida conta uma batalha pra cada animal; a cada 30, um nível (até o 10).</summary>
        public static BatalhaContada ContarBatalha(IReadOnlyList<Companion> party)
        {
            var r = NaLuta;
            var subiram = new List<Companion>();
            var nova = new List<Companion>();
            foreach (var membro in party)
            {
                if (membro.Animal == null)
                {
                    nova.Add(membro);
                    continue;
                }
                double batalhas = membro.Animal.Batalhas + 1;
                double vidaBase = membro.Animal.VidaBase ?? membro.MaxHp;
                double ataqueBase = membro.Animal.AtaqueBase ?? membro.Attack;
                var animal = membro.Animal.Clone();
                animal.Batalhas = batalhas;
                animal.VidaBase = vidaBase;
                animal.AtaqueBase = ataqueBase;
                var contado = membro.Clone();
                contado.Animal = animal;
                if (batalhas % r.BatalhasPorNivel != 0 || membro.Animal.Nivel >= r.NivelMaximo)
                {
                    nova.Add(contado);
                    continue;
                }
                animal.Nivel = membro.Animal.Nivel + 1;
                double maxHp = StatusNoNivel(vidaBase, animal.Nivel);
                contado.Attack = StatusNoNivel(ataqueBase, animal.Nivel);
                contado.Hp = membro.Hp > 0 ? Js.Min(maxHp, membro.Hp + (maxHp - membro.MaxHp)) : membro.Hp;
                contado.MaxHp = maxHp;
                subiram.Add(contado);
                nova.Add(contado);
            }
            return new BatalhaContada { Party = nova, Subiram = subiram };
        }

        /// <summary>TS: mudarEstadoDoAnimal — esteja ele na equipe ou guardado.</summary>
        public static EquipeDoHeroi MudarEstado(Hero hero, List<Companion> party, string id, string novo)
        {
            Companion Trocar(Companion membro)
            {
                if (membro.Animal == null || membro.Animal.Id != id) return membro;
                var c = membro.Clone();
                c.EstadoDoLacaio = novo;
                return c;
            }
            var equipe = party.ConvertAll(Trocar);
            if (hero.Animais == null) return new EquipeDoHeroi { Hero = hero, Party = equipe };
            var heroNovo = hero.Clone();
            heroNovo.Animais = hero.Animais.ConvertAll(Trocar);
            return new EquipeDoHeroi { Hero = heroNovo, Party = equipe };
        }

        public static T MudarEstado<T>(T estado, string id, string novo) where T : EstadoDoJogo => ComEquipe(estado, MudarEstado(estado.Hero, estado.Party, id, novo));

        /// <summary>TS: guardarAnimal — o da equipe vai pra junto dos guardados.</summary>
        public static EquipeDoHeroi Guardar(Hero hero, List<Companion> party, string id)
        {
            var animal = party.Find(m => m.Animal != null && m.Animal.Id == id);
            if (animal == null) return new EquipeDoHeroi { Hero = hero, Party = party };
            var heroNovo = hero.Clone();
            // Se era a montaria, o herói desmonta (rodada 7d).
            if (hero.Montaria == id) heroNovo.Montaria = null;
            heroNovo.Animais = hero.Animais != null ? new List<Companion>(hero.Animais) : new List<Companion>();
            heroNovo.Animais.Add(animal);
            return new EquipeDoHeroi { Hero = heroNovo, Party = party.FindAll(m => !ReferenceEquals(m, animal)) };
        }

        public static T Guardar<T>(T estado, string id) where T : EstadoDoJogo => ComEquipe(estado, Guardar(estado.Hero, estado.Party, id));

        /// <summary>TS: levarAnimal — o guardado volta a seguir o herói, se ainda cabe na equipe.</summary>
        public static EquipeDoHeroi Levar(Hero hero, List<Companion> party, string id)
        {
            var guardados = hero.Animais ?? new List<Companion>();
            var animal = guardados.Find(m => m.Animal != null && m.Animal.Id == id);
            if (animal == null || DaEquipe(party).Count >= Regras.Ativos) return new EquipeDoHeroi { Hero = hero, Party = party };
            var resto = guardados.FindAll(m => !ReferenceEquals(m, animal));
            var heroNovo = hero.Clone();
            heroNovo.Animais = resto.Count > 0 ? resto : null;
            return new EquipeDoHeroi { Hero = heroNovo, Party = new List<Companion>(party) { animal } };
        }

        public static T Levar<T>(T estado, string id) where T : EstadoDoJogo => ComEquipe(estado, Levar(estado.Hero, estado.Party, id));

        // ---------- a montaria, o cristal, reviver e soltar (rodada 7d) ----------

        public static RegrasDaMontaria Montaria => D.Montaria;
        public static RegrasDoCristal Cristal => D.Cristal;

        private static Hero SemMontaria(Hero hero)
        {
            var c = hero.Clone();
            c.Montaria = null;
            return c;
        }

        /// <summary>TS: podeMontar — de pé e do nível 5 em diante.</summary>
        public static bool PodeMontar(Companion animal) => animal.Animal != null && animal.Hp > 0 && animal.Animal.Nivel >= Montaria.Nivel;

        /// <summary>TS: montariaDe — o animal da equipe em que o herói está, se ainda pode ser montado; senão null.</summary>
        public static Companion MontariaDe(Hero hero, IReadOnlyList<Companion> party)
        {
            if (hero.Montaria == null || party == null) return null;
            foreach (var membro in party)
                if (membro.Animal != null && membro.Animal.Id == hero.Montaria) return PodeMontar(membro) ? membro : null;
            return null;
        }

        public static Companion MontariaDe(EstadoDoJogo estado) => MontariaDe(estado.Hero, estado.Party);

        /// <summary>TS: montarAnimal — no animal da equipe (nível 5+, de pé).</summary>
        public static EquipeDoHeroi Montar(Hero hero, List<Companion> party, string id)
        {
            var animal = party.Find(m => m.Animal != null && m.Animal.Id == id);
            if (animal == null || !PodeMontar(animal)) return new EquipeDoHeroi { Hero = hero, Party = party };
            var novo = hero.Clone();
            novo.Montaria = id;
            return new EquipeDoHeroi { Hero = novo, Party = party };
        }

        public static T Montar<T>(T estado, string id) where T : EstadoDoJogo => ComEquipe(estado, Montar(estado.Hero, estado.Party, id));

        /// <summary>TS: desmontar.</summary>
        public static EquipeDoHeroi Desmontar(Hero hero, List<Companion> party) =>
            new EquipeDoHeroi { Hero = hero.Montaria != null ? SemMontaria(hero) : hero, Party = party };

        public static T Desmontar<T>(T estado) where T : EstadoDoJogo => ComEquipe(estado, Desmontar(estado.Hero, estado.Party));

        /// <summary>TS: cristalDoAnimal — o modelo do cristal, com o animal dentro (a vida em 0).</summary>
        public static Item CristalDoAnimal(Companion animal, RngFn rng, System.Func<double> now = null)
        {
            var item = Items.Instantiate(ItemTemplates.ById(Cristal.Cristal), Rarities.All[0], rng, now);
            var dentro = animal.Clone();
            dentro.Hp = 0;
            item.Animal = dentro;
            return item;
        }

        /// <summary>TS: cristalizarCaidos — no fim da luta, o animal caído sai da equipe e vira o cristal dele (a montaria caída desmonta).</summary>
        public static AnimaisComLog CristalizarCaidos(HeroiEquipeMochila estado, RngFn rng, System.Func<double> now = null)
        {
            var caidos = estado.Party.FindAll(m => m.Animal != null && m.Hp <= 0);
            if (caidos.Count == 0) return new AnimaisComLog { Estado = estado, Log = new List<string>() };
            var inventory = estado.Inventory;
            var log = new List<string>();
            foreach (var animal in caidos)
            {
                inventory = Inventory.AddItem(inventory, CristalDoAnimal(animal, rng, now));
                log.Add("💠 " + Js.Str(animal.Name) + " caiu e virou um cristal.");
            }
            bool montadoCaiu = caidos.Exists(m => m.Animal.Id == estado.Hero.Montaria);
            return new AnimaisComLog
            {
                Estado = new HeroiEquipeMochila
                {
                    Hero = montadoCaiu ? SemMontaria(estado.Hero) : estado.Hero,
                    Party = estado.Party.FindAll(m => !caidos.Contains(m)),
                    Inventory = inventory,
                },
                Log = log,
            };
        }

        /// <summary>TS: reviverComPocao — o animal volta com metade da vida, e o cristal e a poção somem da mochila.</summary>
        public static AnimaisComLog ReviverComPocao(HeroiEquipeMochila estado, string uid)
        {
            var cristal = estado.Inventory.Find(i => i.Uid == uid && i.Animal != null);
            if (cristal == null) return new AnimaisComLog { Estado = estado, Log = new List<string>() };
            var pocao = estado.Inventory.Find(i => i.TemplateId == Cristal.Pocao);
            if (pocao == null) return new AnimaisComLog { Estado = estado, Log = new List<string> { "Falta uma Poção de Reviver pra trazer o animal de volta." } };
            var animal = cristal.Animal;
            var vivo = animal.Clone();
            vivo.Hp = Js.Max(1, Js.Round(animal.MaxHp * Cristal.VidaComPocao / 100));
            var inventory = estado.Inventory.FindAll(i => i.Uid != cristal.Uid && i.Uid != pocao.Uid);
            var junto = Juntar(estado.Hero, estado.Party, vivo);
            return new AnimaisComLog
            {
                Estado = new HeroiEquipeMochila { Hero = junto.Hero, Party = junto.Party, Inventory = inventory },
                Log = new List<string> { "Você usa a Poção de Reviver: " + Js.Str(animal.Name) + " volta com metade da vida." },
            };
        }

        /// <summary>TS: reviverNaTaverna — todos os animais em cristal voltam com a vida cheia.</summary>
        public static AnimaisNaTaverna ReviverNaTaverna(HeroiEquipeMochila estado)
        {
            var cristais = estado.Inventory.FindAll(i => i.Animal != null);
            if (cristais.Count == 0) return new AnimaisNaTaverna { Estado = estado, Voltaram = 0 };
            var hero = estado.Hero;
            var party = estado.Party;
            foreach (var cristal in cristais)
            {
                var vivo = cristal.Animal.Clone();
                vivo.Hp = cristal.Animal.MaxHp;
                var junto = Juntar(hero, party, vivo);
                hero = junto.Hero;
                party = junto.Party;
            }
            return new AnimaisNaTaverna
            {
                Estado = new HeroiEquipeMochila { Hero = hero, Party = party, Inventory = estado.Inventory.FindAll(i => i.Animal == null) },
                Voltaram = cristais.Count,
            };
        }

        /// <summary>TS: soltarAnimal — pra sempre: da equipe, dos guardados ou o cristal dele (a montaria solta desmonta).</summary>
        public static HeroiEquipeMochila Soltar(HeroiEquipeMochila estado, string id)
        {
            bool Dele(Companion m) => m.Animal != null && m.Animal.Id == id;
            bool naMochila = estado.Inventory.Exists(i => i.Animal != null && Dele(i.Animal));
            bool naEquipe = estado.Party.Exists(Dele);
            bool guardado = estado.Hero.Animais != null && estado.Hero.Animais.Exists(Dele);
            if (!naMochila && !naEquipe && !guardado) return estado;
            var hero = estado.Hero.Montaria == id ? SemMontaria(estado.Hero) : estado.Hero;
            if (guardado)
            {
                var resto = hero.Animais.FindAll(m => !Dele(m));
                hero = ReferenceEquals(hero, estado.Hero) ? hero.Clone() : hero;
                hero.Animais = resto.Count > 0 ? resto : null;
            }
            return new HeroiEquipeMochila
            {
                Hero = hero,
                Party = naEquipe ? estado.Party.FindAll(m => !Dele(m)) : estado.Party,
                Inventory = naMochila ? estado.Inventory.FindAll(i => !(i.Animal != null && Dele(i.Animal))) : estado.Inventory,
            };
        }

        /// <summary>O herói, a equipe e a mochila do estado; e de volta.</summary>
        public static HeroiEquipeMochila DoEstado(EstadoDoJogo estado) => new HeroiEquipeMochila { Hero = estado.Hero, Party = estado.Party, Inventory = estado.Inventory };

        public static T NoEstado<T>(T estado, HeroiEquipeMochila partes) where T : EstadoDoJogo
        {
            if (ReferenceEquals(partes.Hero, estado.Hero) && ReferenceEquals(partes.Party, estado.Party) && ReferenceEquals(partes.Inventory, estado.Inventory)) return estado;
            var copia = (T)((EstadoDoJogo)estado).Clone();
            copia.Hero = partes.Hero;
            copia.Party = partes.Party;
            copia.Inventory = partes.Inventory;
            return copia;
        }

        public static T Soltar<T>(T estado, string id) where T : EstadoDoJogo => NoEstado(estado, Soltar(DoEstado(estado), id));
    }
}
