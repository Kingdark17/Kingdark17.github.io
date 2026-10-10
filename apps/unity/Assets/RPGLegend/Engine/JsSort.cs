using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// O <c>Array.prototype.sort</c> do V8 (o TimSort de <c>third_party/v8/builtins/array-sort.tq</c>),
    /// comparação por comparação.
    ///
    /// Por que existe: o TS embaralha com <c>sort(() =&gt; rng() - 0.5)</c> (o grafo da masmorra, o andar).
    /// Com um comparador assim, a ordem final — e QUANTOS números saem do rng — dependem do algoritmo de
    /// ordenação. O <c>List.Sort</c> do .NET (introsort) dá outra ordem, tira outra quantidade de números
    /// e não é estável. Aqui as comparações são as mesmas do V8, na mesma ordem e com os mesmos argumentos.
    ///
    /// Para listas de até 63 itens o TimSort do V8 é só um "run" inicial (crescente, ou estritamente
    /// decrescente e então invertido) seguido de inserção binária — exatamente a <c>ordenarComoV8</c> do
    /// gerador dos fixtures, que é a referência do porte. A partir de 64 itens entram os runs mínimos, as
    /// fusões e o "galope", portados linha a linha do mesmo arquivo do V8.
    ///
    /// Diferenças de propósito em relação ao JS:
    ///  - não há <c>undefined</c> nem buracos numa lista do C#: todo elemento passa pelo comparador
    ///    (o V8 manda os undefined para o fim sem compará-los);
    ///  - o comparador já devolve número; NaN vale 0, como no <c>SortCompareUserFn</c> do V8.
    /// </summary>
    public static class JsSort
    {
        /// <summary>
        /// Devolve uma lista nova com os itens de <paramref name="list"/> na ordem em que o
        /// <c>lista.slice().sort(compare)</c> do V8 os deixaria. A lista recebida não muda.
        /// </summary>
        public static List<T> SortLikeV8<T>(IReadOnlyList<T> list, Func<T, T, double> compare)
        {
            if (list == null) throw new ArgumentNullException(nameof(list));
            if (compare == null) throw new ArgumentNullException(nameof(compare));

            var work = new T[list.Count];
            for (int i = 0; i < work.Length; i++) work[i] = list[i];
            new TimSort<T>(work, compare).Sort();
            return new List<T>(work);
        }

        /// <summary>O estado do sort (o SortState do V8): a lista de trabalho, a pilha de runs e o minGallop.</summary>
        private sealed class TimSort<T>
        {
            /// <summary>kMinGallopWins.</summary>
            private const int MinGallopWins = 7;

            /// <summary>kMaxMergePending: o tamanho da pilha de runs pendentes.</summary>
            private const int MaxMergePending = 85;

            private readonly T[] _work;
            private readonly Func<T, T, double> _compare;
            private T[] _temp = new T[0];
            private int _minGallop = MinGallopWins;
            private readonly int[] _runBase = new int[MaxMergePending];
            private readonly int[] _runLength = new int[MaxMergePending];
            private int _pendingRuns;

            public TimSort(T[] work, Func<T, T, double> compare)
            {
                _work = work;
                _compare = compare;
            }

            /// <summary>SortCompareUserFn: o número do comparador, com NaN virando +0.</summary>
            private double Compare(T x, T y)
            {
                double v = _compare(x, y);
                return double.IsNaN(v) ? 0.0 : v;
            }

            /// <summary>ArrayTimSortImpl.</summary>
            public void Sort()
            {
                int length = _work.Length;
                if (length < 2) return;
                int remaining = length;

                // Percorre a lista uma vez, da esquerda para a direita, achando os runs naturais e
                // esticando os curtos até minRunLength.
                int low = 0;
                int minRunLength = ComputeMinRunLength(remaining);
                while (remaining != 0)
                {
                    int currentRunLength = CountAndMakeRun(low, low + remaining);

                    if (currentRunLength < minRunLength)
                    {
                        int forcedRunLength = Math.Min(minRunLength, remaining);
                        BinaryInsertionSort(low, low + currentRunLength, low + forcedRunLength);
                        currentRunLength = forcedRunLength;
                    }

                    PushRun(low, currentRunLength);
                    MergeCollapse();

                    low = low + currentRunLength;
                    remaining = remaining - currentRunLength;
                }

                MergeForceCollapse();
            }

            /// <summary>
            /// ComputeMinRunLength: abaixo de 64 é o próprio n (a lista inteira vira um run só); acima,
            /// um k entre 32 e 64 tal que n/k fique logo abaixo de uma potência de 2.
            /// </summary>
            private static int ComputeMinRunLength(int nArg)
            {
                int n = nArg;
                int r = 0; // vira 1 se algum bit 1 for descartado
                while (n >= 64)
                {
                    r = r | (n & 1);
                    n = n >> 1;
                }
                return n + r;
            }

            /// <summary>
            /// BinaryInsertionSort: [low, high) por inserção binária, sabendo que [low, startArg) já está
            /// em ordem. Estável: o pivô entra depois dos iguais a ele.
            /// </summary>
            private void BinaryInsertionSort(int low, int startArg, int high)
            {
                int start = low == startArg ? startArg + 1 : startArg;

                for (; start < high; ++start)
                {
                    int left = low;
                    int right = start;
                    T pivot = _work[right];

                    while (left < right)
                    {
                        int mid = left + ((right - left) >> 1);
                        double order = Compare(pivot, _work[mid]);
                        if (order < 0) right = mid;
                        else left = mid + 1;
                    }

                    for (int p = start; p > left; --p) _work[p] = _work[p - 1];
                    _work[left] = pivot;
                }
            }

            /// <summary>
            /// CountAndMakeRun: o tamanho do run que começa em lowArg — crescente (a[i] &lt;= a[i+1]) ou
            /// estritamente decrescente (a[i] &gt; a[i+1]), e nesse caso já invertido.
            /// </summary>
            private int CountAndMakeRun(int lowArg, int high)
            {
                int low = lowArg + 1;
                if (low == high) return 1;

                int runLength = 2;
                T elementLow = _work[low];
                T elementLowPred = _work[low - 1];
                double order = Compare(elementLow, elementLowPred);
                bool isDescending = order < 0;

                T previousElement = elementLow;
                for (int idx = low + 1; idx < high; ++idx)
                {
                    T currentElement = _work[idx];
                    order = Compare(currentElement, previousElement);

                    if (isDescending)
                    {
                        if (order >= 0) break;
                    }
                    else
                    {
                        if (order < 0) break;
                    }

                    previousElement = currentElement;
                    ++runLength;
                }

                if (isDescending) ReverseRange(_work, lowArg, lowArg + runLength);

                return runLength;
            }

            private static void ReverseRange(T[] array, int from, int to)
            {
                int low = from;
                int high = to - 1;
                while (low < high)
                {
                    T elementLow = array[low];
                    T elementHigh = array[high];
                    array[low++] = elementHigh;
                    array[high--] = elementLow;
                }
            }

            private void PushRun(int @base, int length)
            {
                _runBase[_pendingRuns] = @base;
                _runLength[_pendingRuns] = length;
                _pendingRuns++;
            }

            /// <summary>Garante o vetor temporário com pelo menos requestedSize posições (GetTempArray).</summary>
            private T[] GetTempArray(int requestedSize)
            {
                if (_temp.Length < requestedSize) _temp = new T[requestedSize];
                return _temp;
            }

            /// <summary>Copy do V8: cópia que aceita faixas sobrepostas na mesma lista (o Array.Copy também aceita).</summary>
            private static void Copy(T[] source, int srcPos, T[] target, int dstPos, int length)
            {
                Array.Copy(source, srcPos, target, dstPos, length);
            }

            /// <summary>RunInvariantEstablished: run(n - 2) &gt; run(n - 1) + run(n).</summary>
            private bool RunInvariantEstablished(int n)
            {
                if (n < 2) return true;
                return _runLength[n - 2] > _runLength[n - 1] + _runLength[n];
            }

            /// <summary>MergeCollapse: funde runs vizinhos até as invariantes da pilha valerem de novo.</summary>
            private void MergeCollapse()
            {
                while (_pendingRuns > 1)
                {
                    int n = _pendingRuns - 2;

                    if (!RunInvariantEstablished(n + 1) || !RunInvariantEstablished(n))
                    {
                        if (_runLength[n - 1] < _runLength[n + 1]) --n;
                        MergeAt(n);
                    }
                    else if (_runLength[n] <= _runLength[n + 1])
                    {
                        MergeAt(n);
                    }
                    else
                    {
                        break;
                    }
                }
            }

            /// <summary>MergeForceCollapse: no fim, funde tudo até sobrar um run.</summary>
            private void MergeForceCollapse()
            {
                while (_pendingRuns > 1)
                {
                    int n = _pendingRuns - 2;
                    if (n > 0 && _runLength[n - 1] < _runLength[n + 1]) --n;
                    MergeAt(n);
                }
            }

            /// <summary>MergeAt: funde os runs i e i + 1 da pilha.</summary>
            private void MergeAt(int i)
            {
                int stackSize = _pendingRuns;

                int baseA = _runBase[i];
                int lengthA = _runLength[i];
                int baseB = _runBase[i + 1];
                int lengthB = _runLength[i + 1];

                // Grava o tamanho do run fundido; se i é o antepenúltimo, o último desce uma posição.
                _runLength[i] = lengthA + lengthB;
                if (i == stackSize - 3)
                {
                    _runBase[i + 1] = _runBase[i + 2];
                    _runLength[i + 1] = _runLength[i + 2];
                }
                _pendingRuns = stackSize - 1;

                // Onde b começa dentro de a? O que vem antes já está no lugar.
                T keyRight = _work[baseB];
                int k = GallopRight(_work, keyRight, baseA, lengthA, 0);

                baseA = baseA + k;
                lengthA = lengthA - k;
                if (lengthA == 0) return;

                // Onde a termina dentro de b? O que vem depois já está no lugar.
                T keyLeft = _work[baseA + lengthA - 1];
                lengthB = GallopLeft(_work, keyLeft, baseB, lengthB, lengthB - 1);
                if (lengthB == 0) return;

                if (lengthA <= lengthB) MergeLow(baseA, lengthA, baseB, lengthB);
                else MergeHigh(baseA, lengthA, baseB, lengthB);
            }

            /// <summary>
            /// GallopLeft: a posição de key no trecho ordenado [base, base + length); havendo iguais,
            /// a posição logo à esquerda do primeiro deles. hint é onde a busca começa.
            /// </summary>
            private int GallopLeft(T[] array, T key, int @base, int length, int hint)
            {
                int lastOfs = 0;
                int offset = 1;

                T baseHintElement = array[@base + hint];
                double order = Compare(baseHintElement, key);

                if (order < 0)
                {
                    // a[base + hint] < key: galopa para a direita.
                    int maxOfs = length - hint;
                    while (offset < maxOfs)
                    {
                        T offsetElement = array[@base + hint + offset];
                        order = Compare(offsetElement, key);

                        if (order >= 0) break;

                        lastOfs = offset;
                        offset = (offset << 1) + 1;
                        if (offset <= 0) offset = maxOfs;
                    }

                    if (offset > maxOfs) offset = maxOfs;

                    lastOfs = lastOfs + hint;
                    offset = offset + hint;
                }
                else
                {
                    // key <= a[base + hint]: galopa para a esquerda.
                    int maxOfs = hint + 1;
                    while (offset < maxOfs)
                    {
                        T offsetElement = array[@base + hint - offset];
                        order = Compare(offsetElement, key);

                        if (order < 0) break;

                        lastOfs = offset;
                        offset = (offset << 1) + 1;
                        if (offset <= 0) offset = maxOfs;
                    }

                    if (offset > maxOfs) offset = maxOfs;

                    int tmp = lastOfs;
                    lastOfs = hint - offset;
                    offset = hint - tmp;
                }

                // Busca binária em (lastOfs, offset].
                lastOfs++;
                while (lastOfs < offset)
                {
                    int m = lastOfs + ((offset - lastOfs) >> 1);

                    order = Compare(array[@base + m], key);

                    if (order < 0) lastOfs = m + 1;
                    else offset = m;
                }
                return offset;
            }

            /// <summary>GallopRight: como GallopLeft, mas havendo iguais, a posição logo à direita do último deles.</summary>
            private int GallopRight(T[] array, T key, int @base, int length, int hint)
            {
                int lastOfs = 0;
                int offset = 1;

                T baseHintElement = array[@base + hint];
                double order = Compare(key, baseHintElement);

                if (order < 0)
                {
                    // key < a[base + hint]: galopa para a esquerda.
                    int maxOfs = hint + 1;
                    while (offset < maxOfs)
                    {
                        T offsetElement = array[@base + hint - offset];
                        order = Compare(key, offsetElement);

                        if (order >= 0) break;

                        lastOfs = offset;
                        offset = (offset << 1) + 1;
                        if (offset <= 0) offset = maxOfs;
                    }

                    if (offset > maxOfs) offset = maxOfs;

                    int tmp = lastOfs;
                    lastOfs = hint - offset;
                    offset = hint - tmp;
                }
                else
                {
                    // a[base + hint] <= key: galopa para a direita.
                    int maxOfs = length - hint;
                    while (offset < maxOfs)
                    {
                        T offsetElement = array[@base + hint + offset];
                        order = Compare(key, offsetElement);

                        if (order < 0) break;

                        lastOfs = offset;
                        offset = (offset << 1) + 1;
                        if (offset <= 0) offset = maxOfs;
                    }

                    if (offset > maxOfs) offset = maxOfs;

                    lastOfs = lastOfs + hint;
                    offset = offset + hint;
                }

                lastOfs++;
                while (lastOfs < offset)
                {
                    int m = lastOfs + ((offset - lastOfs) >> 1);

                    order = Compare(key, array[@base + m]);

                    if (order < 0) offset = m;
                    else lastOfs = m + 1;
                }
                return offset;
            }

            /// <summary>
            /// MergeLow: funde [baseA, baseA + lengthA) com [baseB, baseB + lengthB), estável, no lugar,
            /// copiando o run A (o menor) para o temporário e andando da esquerda para a direita.
            /// </summary>
            private void MergeLow(int baseA, int lengthAArg, int baseB, int lengthBArg)
            {
                int lengthA = lengthAArg;
                int lengthB = lengthBArg;

                T[] tempArray = GetTempArray(lengthA);
                Copy(_work, baseA, tempArray, 0, lengthA);

                int dest = baseA;
                int cursorTemp = 0;
                int cursorB = baseB;

                _work[dest++] = _work[cursorB++];

                if (--lengthB == 0) goto Succeed;
                if (lengthA == 1) goto CopyB;

                int minGallop = _minGallop;
                while (true)
                {
                    int nofWinsA = 0; // vezes seguidas que A ganhou
                    int nofWinsB = 0; // vezes seguidas que B ganhou

                    // O jeito direto, até (se acontecer) um dos runs ganhar sempre.
                    while (true)
                    {
                        double order = Compare(_work[cursorB], tempArray[cursorTemp]);

                        if (order < 0)
                        {
                            _work[dest++] = _work[cursorB++];

                            ++nofWinsB;
                            --lengthB;
                            nofWinsA = 0;

                            if (lengthB == 0) goto Succeed;
                            if (nofWinsB >= minGallop) break;
                        }
                        else
                        {
                            _work[dest++] = tempArray[cursorTemp++];

                            ++nofWinsA;
                            --lengthA;
                            nofWinsB = 0;

                            if (lengthA == 1) goto CopyB;
                            if (nofWinsA >= minGallop) break;
                        }
                    }

                    // Um run está ganhando sempre: galopa até nenhum dos dois ganhar com folga.
                    ++minGallop;
                    bool firstIteration = true;
                    while (nofWinsA >= MinGallopWins || nofWinsB >= MinGallopWins || firstIteration)
                    {
                        firstIteration = false;

                        minGallop = Math.Max(1, minGallop - 1);
                        _minGallop = minGallop;

                        nofWinsA = GallopRight(tempArray, _work[cursorB], cursorTemp, lengthA, 0);

                        if (nofWinsA > 0)
                        {
                            Copy(tempArray, cursorTemp, _work, dest, nofWinsA);
                            dest = dest + nofWinsA;
                            cursorTemp = cursorTemp + nofWinsA;
                            lengthA = lengthA - nofWinsA;

                            if (lengthA == 1) goto CopyB;

                            // lengthA == 0 só acontece com comparador inconsistente (rng() - 0.5, por exemplo).
                            if (lengthA == 0) goto Succeed;
                        }
                        _work[dest++] = _work[cursorB++];
                        if (--lengthB == 0) goto Succeed;

                        nofWinsB = GallopLeft(_work, tempArray[cursorTemp], cursorB, lengthB, 0);
                        if (nofWinsB > 0)
                        {
                            Copy(_work, cursorB, _work, dest, nofWinsB);

                            dest = dest + nofWinsB;
                            cursorB = cursorB + nofWinsB;
                            lengthB = lengthB - nofWinsB;

                            if (lengthB == 0) goto Succeed;
                        }
                        _work[dest++] = tempArray[cursorTemp++];
                        if (--lengthA == 1) goto CopyB;
                    }
                    ++minGallop; // penalidade por sair do galope
                    _minGallop = minGallop;
                }

            Succeed:
                if (lengthA > 0) Copy(tempArray, cursorTemp, _work, dest, lengthA);
                return;

            CopyB:
                // O último elemento do run A fica no fim da fusão.
                Copy(_work, cursorB, _work, dest, lengthB);
                _work[dest + lengthB] = tempArray[cursorTemp];
            }

            /// <summary>
            /// MergeHigh: como MergeLow, mas copiando o run B (o menor) para o temporário e andando da
            /// direita para a esquerda.
            /// </summary>
            private void MergeHigh(int baseA, int lengthAArg, int baseB, int lengthBArg)
            {
                int lengthA = lengthAArg;
                int lengthB = lengthBArg;

                T[] tempArray = GetTempArray(lengthB);
                Copy(_work, baseB, tempArray, 0, lengthB);

                int dest = baseB + lengthB - 1;
                int cursorTemp = lengthB - 1;
                int cursorA = baseA + lengthA - 1;

                _work[dest--] = _work[cursorA--];

                if (--lengthA == 0) goto Succeed;
                if (lengthB == 1) goto CopyA;

                int minGallop = _minGallop;
                while (true)
                {
                    int nofWinsA = 0;
                    int nofWinsB = 0;

                    while (true)
                    {
                        double order = Compare(tempArray[cursorTemp], _work[cursorA]);

                        if (order < 0)
                        {
                            _work[dest--] = _work[cursorA--];

                            ++nofWinsA;
                            --lengthA;
                            nofWinsB = 0;

                            if (lengthA == 0) goto Succeed;
                            if (nofWinsA >= minGallop) break;
                        }
                        else
                        {
                            _work[dest--] = tempArray[cursorTemp--];

                            ++nofWinsB;
                            --lengthB;
                            nofWinsA = 0;

                            if (lengthB == 1) goto CopyA;
                            if (nofWinsB >= minGallop) break;
                        }
                    }

                    ++minGallop;
                    bool firstIteration = true;
                    while (nofWinsA >= MinGallopWins || nofWinsB >= MinGallopWins || firstIteration)
                    {
                        firstIteration = false;

                        minGallop = Math.Max(1, minGallop - 1);
                        _minGallop = minGallop;

                        int k = GallopRight(_work, tempArray[cursorTemp], baseA, lengthA, lengthA - 1);
                        nofWinsA = lengthA - k;

                        if (nofWinsA > 0)
                        {
                            dest = dest - nofWinsA;
                            cursorA = cursorA - nofWinsA;
                            Copy(_work, cursorA + 1, _work, dest + 1, nofWinsA);

                            lengthA = lengthA - nofWinsA;
                            if (lengthA == 0) goto Succeed;
                        }
                        _work[dest--] = tempArray[cursorTemp--];
                        if (--lengthB == 1) goto CopyA;

                        k = GallopLeft(tempArray, _work[cursorA], 0, lengthB, lengthB - 1);
                        nofWinsB = lengthB - k;

                        if (nofWinsB > 0)
                        {
                            dest = dest - nofWinsB;
                            cursorTemp = cursorTemp - nofWinsB;
                            Copy(tempArray, cursorTemp + 1, _work, dest + 1, nofWinsB);

                            lengthB = lengthB - nofWinsB;
                            if (lengthB == 1) goto CopyA;

                            // lengthB == 0 só acontece com comparador inconsistente.
                            if (lengthB == 0) goto Succeed;
                        }
                        _work[dest--] = _work[cursorA--];
                        if (--lengthA == 0) goto Succeed;
                    }
                    ++minGallop;
                    _minGallop = minGallop;
                }

            Succeed:
                if (lengthB > 0) Copy(tempArray, 0, _work, dest - (lengthB - 1), lengthB);
                return;

            CopyA:
                // O primeiro elemento do run B fica no começo da fusão.
                dest = dest - lengthA;
                cursorA = cursorA - lengthA;
                Copy(_work, cursorA + 1, _work, dest + 1, lengthA);
                _work[dest] = tempArray[cursorTemp];
            }
        }
    }
}
