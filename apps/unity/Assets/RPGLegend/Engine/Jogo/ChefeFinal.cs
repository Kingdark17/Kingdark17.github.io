using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de jogo/chefe-final.ts (fixtures/data/jogo/chefe-final.json).</summary>
    public sealed class ChefeFinalData
    {
        [JsName("LACAIOS_DO_CHEFE")] public double LacaiosDoChefe;
        [JsName("PODER_A_CADA")] public double PoderACada;
        [JsName("PODER_A_CADA_NA_FURIA")] public double PoderACadaNaFuria;
        [JsName("VELOCIDADE_NA_FURIA")] public double VelocidadeNaFuria;
        [JsName("FORCA_DO_DEVASTADOR")] public double ForcaDoDevastador;
        [JsName("PODERES_DO_CHEFE")] public OrderedMap<PoderDoChefeDef> PoderesDoChefe = new OrderedMap<PoderDoChefeDef>();
    }

    /// <summary>TS: PoderDoChefeDef — o nome e o ícone de um poder do chefe final.</summary>
    public sealed class PoderDoChefeDef
    {
        public string Nome;
        public string Icone;
    }

    public static partial class GameData
    {
        private static ChefeFinalData _chefeFinalTable;

        /// <summary>jogo/chefe-final: os lacaios, a cadência dos poderes e a fúria do chefe do andar 100.</summary>
        public static ChefeFinalData ChefeFinalTable
        {
            get => Require(_chefeFinalTable, "jogo/chefe-final");
            set => _chefeFinalTable = value;
        }
    }

    /// <summary>TS: Ferida — como o monstro ficou depois de um golpe nele, com a regra do chefe final.</summary>
    public sealed class Ferida
    {
        public EstadoNaMasmorra Estado;
        /// <summary>O monstro como ficou gravado na sala.</summary>
        public CombatMonster Monstro;
        /// <summary>Caiu de verdade: o protegido não cai, e o que chamou os lacaios parou na metade.</summary>
        public bool Caiu;
        /// <summary>Era o chefe protegido pelos lacaios: o golpe não fez nada.</summary>
        public bool Protegido;
        /// <summary>Os índices, na sala, dos lacaios que ele acabou de chamar (quase sempre vazio).</summary>
        public List<double> Lacaios = new List<double>();
        /// <summary>O que as mecânicas do chefe de andar 5 disseram neste golpe, pro diário.</summary>
        public List<string> Textos = new List<string>();
    }

    /// <summary>
    /// O chefe final: o do andar 100 de cada masmorra, em cada dificuldade (port de shared/src/jogo/chefe-final.ts;
    /// decisão do usuário, 2026-10-25). Duas fases: sozinho, um poder a cada 3 golpes; com metade da vida chama 4
    /// lacaios (comuns da masmorra, da força do andar, sem ouro) e não toma dano até todos caírem; aí fica furioso,
    /// mais rápido, um poder a cada 2 golpes. Os poderes: o Golpe Devastador (o dobro, sempre no herói) e o Rugido
    /// (pega o herói e todos os companheiros), alternando. O golpe que o levaria além da metade para nela.
    /// </summary>
    public static class ChefeFinal
    {
        private static ChefeFinalData D => GameData.ChefeFinalTable;

        public const string Devastador = "devastador";
        public const string Rugido = "rugido";

        public static double LacaiosDoChefe => D.LacaiosDoChefe;
        public static double ForcaDoDevastador => D.ForcaDoDevastador;

        /// <summary>TS: PODERES_DO_CHEFE[poder].</summary>
        public static PoderDoChefeDef Poder(string poder) => D.PoderesDoChefe.TryGet(poder, out var def) ? def : null;

        private static MonsterInstance MonstroEm(DungeonCell sala, double indice)
        {
            var lista = sala?.Monsters;
            if (lista == null || !(indice >= 0) || indice >= lista.Count || Math.Floor(indice) != indice) return null;
            return lista[(int)indice];
        }

        /// <summary>TS: lacaiosDePe — os índices dos lacaios de pé nesta sala.</summary>
        public static List<double> LacaiosDePe(DungeonCell sala)
        {
            var dePe = new List<double>();
            for (int i = 0; i < (sala.Monsters?.Count ?? 0); i++)
                if (sala.Monsters[i]?.Lacaio == true && FimDaLuta.VivoNaSala(sala, i)) dePe.Add(i);
            return dePe;
        }

        /// <summary>TS: protegido — o monstro é o chefe final com lacaios de pé: golpe nenhum o fere.</summary>
        public static bool Protegido(DungeonCell sala, double indice) =>
            MonstroEm(sala, indice)?.ChefeFinal == true && LacaiosDePe(sala).Count > 0;

        /// <summary>
        /// TS: poderDaVez — o poder que o próximo golpe do chefe final solta, ou null (golpe comum, ou não é o chefe
        /// final). Conta pelos golpes da luta (attackCount) e alterna pelos poderes que ele já soltou.
        /// </summary>
        public static string PoderDaVez(MonsterInstance monstro)
        {
            if (monstro == null) return null;
            if (monstro.ChefeFinal != true)
            {
                // O chefe de andar 5 com o golpe carregado: o Devastador, com aviso, a cada quatro golpes.
                if (monstro.Mecanicas == null || !monstro.Mecanicas.Contains("carregado")) return null;
                double seguinte = (CombatMonster.From(monstro).AttackCount ?? 0) + 1;
                return seguinte % MecanicasDoChefe.CargaACada == 0 ? Devastador : null;
            }
            var combate = CombatMonster.From(monstro);
            double proximo = (combate.AttackCount ?? 0) + 1;
            double cada = monstro.Furia == true ? D.PoderACadaNaFuria : D.PoderACada;
            if (proximo % cada != 0) return null;
            return (monstro.Poderes ?? 0) % 2 == 0 ? Devastador : Rugido;
        }

        /// <summary>
        /// TS: ferirMonstro — grava o monstro depois de um golpe (do herói, de um poder, da equipe, do dano contínuo,
        /// de uma runa), com a regra do chefe final: protegido, a vida volta ao que era; chegando à metade pela
        /// primeira vez, ela para ali e os lacaios entram no fim da sala. Pra qualquer outro monstro é só
        /// <see cref="FimDaLuta.GravarMonstro"/>. O rng só anda quando os lacaios nascem.
        /// </summary>
        public static Ferida FerirMonstro(EstadoNaMasmorra estado, double indice, CombatMonster depois, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var sala = (DungeonCell)Estados.CelulaAtual(estado);
            var bruto = MonstroEm(sala, indice);
            var antes = bruto == null ? null : CombatMonster.From(bruto);
            // Sem dano (o dano contínuo que não correu, um golpe que só pôs status), não há o que proteger nem metade a cruzar.
            if (antes == null || depois.Hp >= antes.Hp) return Comum(estado, indice, depois);
            if (antes.IsBoss && antes.ChefeFinal != true) return FerirChefe(estado, indice, antes, depois, rng);
            if (antes.ChefeFinal != true) return Comum(estado, indice, depois);

            if (LacaiosDePe(sala).Count > 0)
            {
                var intacto = depois.Clone();
                intacto.Hp = antes.Hp;
                var ferida = Comum(estado, indice, intacto);
                ferida.Protegido = true;
                return ferida;
            }

            double metade = Js.Max(1, Math.Floor(antes.MaxHp / 2));
            if (antes.Chamou == true || depois.Hp > metade) return Comum(estado, indice, depois);

            var parado = depois.Clone();
            parado.Hp = metade;
            parado.Chamou = true;
            var comChefe = FimDaLuta.GravarMonstro(estado, indice, parado);
            var especies = Dungeons.ById(estado.Masmorra.Dungeon)?.Species ?? new List<string>();
            var novos = new List<CombatMonster>();
            for (int i = 0; i < D.LacaiosDoChefe; i++)
            {
                var lacaio = Monsters.Generate(antes.Floor, new Monsters.GenerateOptions { Rng = rng, Species = especies, Dificuldade = estado.Masmorra.Difficulty });
                lacaio.Gold = 0;
                lacaio.Lacaio = true;
                novos.Add(MonsterState.FreshCombatMonster(lacaio));
            }
            var salaDoChefe = (DungeonCell)Estados.CelulaAtual(comChefe);
            var monsters = new List<MonsterInstance>(salaDoChefe.Monsters ?? new List<MonsterInstance>());
            int primeiro = monsters.Count;
            monsters.AddRange(novos);
            var comLacaios = salaDoChefe.Clone();
            comLacaios.Monsters = monsters;
            var resultado = new Ferida { Estado = Estados.SubstituirCelulaAtual(comChefe, comLacaios), Monstro = parado, Caiu = false, Protegido = false };
            for (int i = 0; i < novos.Count; i++) resultado.Lacaios.Add(primeiro + i);
            return resultado;
        }

        /// <summary>
        /// TS: ferirChefe — o golpe num chefe de andar 5: a barreira segura o dano primeiro; na metade da vida entra a
        /// segunda fase (a mecânica da masmorra, e os ajudantes do invocar), e o golpe que a pularia de cima para nela;
        /// com 30%, a cura (uma vez) e a fúria. O rng só anda quando nascem ajudantes.
        /// </summary>
        private static Ferida FerirChefe(EstadoNaMasmorra estado, double indice, CombatMonster antes, CombatMonster depois, RngFn rng)
        {
            string nome = Js.Str(Monsters.View(antes).Name);
            var textos = new List<string>();
            var monstro = depois.Clone();

            if (Js.Truthy(antes.Barreira))
            {
                double absorve = Js.Min(antes.Hp - depois.Hp, antes.Barreira.Value);
                double sobra = antes.Barreira.Value - absorve;
                monstro.Hp = depois.Hp + absorve;
                monstro.Barreira = sobra > 0 ? sobra : (double?)null;
                textos.Add(sobra > 0 ? "A barreira de " + nome + " segura o golpe." : "A barreira de " + nome + " se quebra!");
            }

            double metade = Js.Max(1, Math.Floor(antes.MaxHp / 2));
            int ajudantes = 0;
            bool lobos = false;
            if (antes.Fase2 != true && monstro.Hp <= metade && (monstro.Hp > 0 || antes.Hp > metade))
            {
                if (monstro.Hp <= 0) monstro.Hp = metade;
                monstro.Fase2 = true;
                string masmorra = estado.Masmorra.Dungeon;
                if (masmorra == "floresta")
                {
                    ajudantes += (int)MecanicasDoChefe.AjudantesDoChefe;
                    lobos = true;
                    textos.Add(nome + " uiva, e " + Js.NumberToString(MecanicasDoChefe.AjudantesDoChefe) + " lobos saem do mato!");
                }
                else if (masmorra == "caverna")
                {
                    monstro.Escuro = true;
                    textos.Add(nome + " apaga as tochas: no escuro, a mira some.");
                }
                else if (masmorra == "torre")
                {
                    monstro.EscudoElemental = true;
                    textos.Add(nome + " ergue um escudo elemental, que muda de cor a cada dois golpes dele.");
                }
                if (antes.Mecanicas != null && antes.Mecanicas.Contains("invocar"))
                {
                    ajudantes += (int)MecanicasDoChefe.AjudantesDoChefe;
                    textos.Add(nome + " chama " + Js.NumberToString(MecanicasDoChefe.AjudantesDoChefe) + " ajudantes!");
                }
            }

            double limite = Math.Floor(antes.MaxHp * MecanicasDoChefe.LimiteDoDesespero);
            if (monstro.Hp > 0 && monstro.Hp <= limite)
            {
                if (antes.Mecanicas != null && antes.Mecanicas.Contains("cura") && antes.Curou != true)
                {
                    monstro.Hp = Js.Min(antes.MaxHp, monstro.Hp + Js.Round(antes.MaxHp * MecanicasDoChefe.CuraDoChefe));
                    monstro.Curou = true;
                    textos.Add(nome + " se cura com o que resta das forças!");
                }
                if (antes.Mecanicas != null && antes.Mecanicas.Contains("furia") && antes.Furia != true)
                {
                    monstro.Furia = true;
                    monstro.Dmg = Js.Round(monstro.Dmg * MecanicasDoChefe.ForcaNaFuria);
                    monstro.Speed = Js.Round(monstro.Speed * MecanicasDoChefe.VelocidadeNaFuriaDoChefe);
                    textos.Add(nome + " fica furioso: bate mais forte e mais rápido!");
                }
            }

            var comChefe = FimDaLuta.GravarMonstro(estado, indice, monstro);
            if (ajudantes == 0) return new Ferida { Estado = comChefe, Monstro = monstro, Caiu = monstro.Hp <= 0, Protegido = false, Textos = textos };

            // Os lobos da Floresta são lobos; o invocar chama monstros da masmorra. Não dão ouro.
            var daMasmorra = Dungeons.ById(estado.Masmorra.Dungeon)?.Species ?? new List<string>();
            var soLobos = new List<string> { "lobo_sombras" };
            var novos = new List<CombatMonster>();
            for (int i = 0; i < ajudantes; i++)
            {
                IReadOnlyList<string> daVez = lobos && i < MecanicasDoChefe.AjudantesDoChefe ? soLobos : daMasmorra;
                var ajudante = Monsters.Generate(antes.Floor, new Monsters.GenerateOptions { Rng = rng, Species = daVez, Dificuldade = estado.Masmorra.Difficulty });
                ajudante.Gold = 0;
                ajudante.Lacaio = true;
                novos.Add(MonsterState.FreshCombatMonster(ajudante));
            }
            var sala = (DungeonCell)Estados.CelulaAtual(comChefe);
            var monsters = new List<MonsterInstance>(sala.Monsters ?? new List<MonsterInstance>());
            int primeiro = monsters.Count;
            monsters.AddRange(novos);
            var comAjudantes = sala.Clone();
            comAjudantes.Monsters = monsters;
            var resultado = new Ferida { Estado = Estados.SubstituirCelulaAtual(comChefe, comAjudantes), Monstro = monstro, Caiu = false, Protegido = false, Textos = textos };
            for (int i = 0; i < novos.Count; i++) resultado.Lacaios.Add(primeiro + i);
            return resultado;
        }

        /// <summary>TS: escuroNaLuta — a luz da sala está apagada: um chefe de pé com a escuridão da Caverna.</summary>
        public static bool EscuroNaLuta(DungeonCell sala)
        {
            if (sala?.Monsters == null) return false;
            for (int i = 0; i < sala.Monsters.Count; i++)
                if (sala.Monsters[i]?.Escuro == true && FimDaLuta.VivoNaSala(sala, i)) return true;
            return false;
        }

        private static Ferida Comum(EstadoNaMasmorra estado, double indice, CombatMonster monstro) =>
            new Ferida { Estado = FimDaLuta.GravarMonstro(estado, indice, monstro), Monstro = monstro, Caiu = monstro.Hp <= 0, Protegido = false };

        /// <summary>
        /// TS: enfurecer — depois de um abate: se caiu o último lacaio e o chefe final ainda está de pé, ele fica
        /// furioso, mais rápido e com um poder a cada 2 golpes. Sem nada a mudar, o mesmo estado e o diário vazio.
        /// </summary>
        public static PassoDaLuta<EstadoNaMasmorra> Enfurecer(EstadoNaMasmorra estado)
        {
            var sala = (DungeonCell)Estados.CelulaAtual(estado);
            int indice = -1;
            for (int i = 0; i < (sala.Monsters?.Count ?? 0); i++)
            {
                if (sala.Monsters[i]?.ChefeFinal == true && FimDaLuta.VivoNaSala(sala, i))
                {
                    indice = i;
                    break;
                }
            }
            var nada = new PassoDaLuta<EstadoNaMasmorra> { Estado = estado, Log = new List<string>() };
            if (indice < 0) return nada;
            var chefe = CombatMonster.From(sala.Monsters[indice]);
            if (chefe.Chamou != true || chefe.Furia == true || LacaiosDePe(sala).Count > 0) return nada;
            var furioso = chefe.Clone();
            furioso.Furia = true;
            furioso.Speed = Js.Round(chefe.Speed * D.VelocidadeNaFuria);
            return new PassoDaLuta<EstadoNaMasmorra>
            {
                Estado = FimDaLuta.GravarMonstro(estado, indice, furioso),
                Log = new List<string> { TextoDaFuria(Js.Str(Monsters.View(chefe).Name)) },
            };
        }

        // ---------- o que o diário diz ----------

        public static string TextoDosLacaios(string nome) =>
            nome + " chama " + Js.NumberToString(D.LacaiosDoChefe) + " lacaios! Enquanto eles estiverem de pé, nenhum golpe o fere.";

        public static string TextoProtegido(string nome) => nome + " está protegido pelos lacaios: o golpe não faz efeito.";

        public static string TextoDaFuria(string nome) => nome + " fica furioso! Agora ele é mais rápido e solta poderes com mais frequência.";
    }
}
