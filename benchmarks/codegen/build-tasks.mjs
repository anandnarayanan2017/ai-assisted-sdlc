// Source of tasks.jsonl. Edit here, then: node benchmarks/codegen/build-tasks.mjs > benchmarks/codegen/tasks.jsonl
const T = [];
const add = (id, entry, prompt, sol, test) => T.push({ task_id: `HarnessEval/${id}`, prompt, entry_point: entry, canonical_solution: sol, test });

add(0, "runLengthEncode", `/**
 * Run-length encode a string: each maximal run of one character becomes count + character.
 * Runs of length 1 still get the count. The empty string encodes to "".
 * runLengthEncode("aaabcc") === "3a1b2c"
 * runLengthEncode("") === ""
 * @param {string} s
 * @returns {string}
 */
function runLengthEncode(s) {
`, `  let out = "";
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += (j - i) + s[i];
    i = j;
  }
  return out;
}`, `function check(f) {
  assert.equal(f("aaabcc"), "3a1b2c");
  assert.equal(f(""), "");
  assert.equal(f("a"), "1a");
  assert.equal(f("aaaaaaaaaaaa"), "12a");
  assert.equal(f("abab"), "1a1b1a1b");
  assert.equal(f("  x"), "2 1x");
}`);

add(1, "isBalanced", `/**
 * Return true when every bracket in s is closed in the right order. Bracket pairs: (), [], {}.
 * All other characters are ignored.
 * isBalanced("a(b[c]{d})") === true
 * isBalanced("(]") === false
 * @param {string} s
 * @returns {boolean}
 */
function isBalanced(s) {
`, `  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (ch in pairs && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}`, `function check(f) {
  assert.equal(f("a(b[c]{d})"), true);
  assert.equal(f("(]"), false);
  assert.equal(f(""), true);
  assert.equal(f("((("), false);
  assert.equal(f("())("), false);
  assert.equal(f("}{"), false);
  assert.equal(f("x = [1, {a: (2)}]"), true);
}`);

add(2, "romanToInt", `/**
 * Convert a valid Roman numeral (1..3999, uppercase, subtractive notation) to an integer.
 * romanToInt("MCMXCIV") === 1994
 * @param {string} s
 * @returns {number}
 */
function romanToInt(s) {
`, `  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = v[s[i]], nxt = v[s[i + 1]] ?? 0;
    total += cur < nxt ? -cur : cur;
  }
  return total;
}`, `function check(f) {
  assert.equal(f("MCMXCIV"), 1994);
  assert.equal(f("III"), 3);
  assert.equal(f("IV"), 4);
  assert.equal(f("XLII"), 42);
  assert.equal(f("MMMCMXCIX"), 3999);
  assert.equal(f("CDXLIV"), 444);
}`);

add(3, "mergeIntervals", `/**
 * Merge overlapping or touching closed intervals [start, end] and return them sorted by start.
 * Intervals that share an endpoint touch and must be merged. The input may be unsorted; do not mutate it.
 * mergeIntervals([[1,3],[2,6],[8,10],[10,12]]) -> [[1,6],[8,12]]
 * @param {number[][]} intervals
 * @returns {number[][]}
 */
function mergeIntervals(intervals) {
`, `  const sorted = intervals.map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push(iv);
  }
  return out;
}`, `function check(f) {
  assert.deepEqual(f([[1,3],[2,6],[8,10],[10,12]]), [[1,6],[8,12]]);
  assert.deepEqual(f([]), []);
  assert.deepEqual(f([[5,7],[1,2]]), [[1,2],[5,7]]);
  assert.deepEqual(f([[1,10],[2,3],[4,5]]), [[1,10]]);
  assert.deepEqual(f([[-5,-1],[-1,0]]), [[-5,0]]);
  const input = [[3,4],[1,2]];
  f(input);
  assert.deepEqual(input, [[3,4],[1,2]], "input was mutated");
}`);

add(4, "topKFrequent", `/**
 * Return the k most frequent words, most frequent first. Ties are broken alphabetically (ascending).
 * Words are compared case-sensitively. If there are fewer than k distinct words, return them all.
 * topKFrequent(["b","a","b","c","a","d"], 2) -> ["a","b"]
 * @param {string[]} words
 * @param {number} k
 * @returns {string[]}
 */
function topKFrequent(words, k) {
`, `  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .slice(0, k)
    .map(([w]) => w);
}`, `function check(f) {
  assert.deepEqual(f(["b","a","b","c","a","d"], 2), ["a","b"]);
  assert.deepEqual(f(["x"], 3), ["x"]);
  assert.deepEqual(f([], 1), []);
  assert.deepEqual(f(["z","z","y","y","x"], 3), ["y","z","x"]);
  assert.deepEqual(f(["B","a","a","B","b"], 2), ["B","a"]);
}`);

add(5, "parseDuration", `/**
 * Parse a duration like "1h30m15s" into total seconds. Units h, m, s each appear at most once, in that
 * order, each with a non-negative integer; at least one unit is required. Return null for anything else
 * (empty string, unknown unit, wrong order, repeated unit, missing number, whitespace, decimals).
 * parseDuration("1h30m15s") === 5415
 * parseDuration("90s") === 90
 * parseDuration("1m1h") === null
 * @param {string} s
 * @returns {number | null}
 */
function parseDuration(s) {
`, `  const m = /^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s)?$/.exec(s);
  if (!m || s === "") return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}`, `function check(f) {
  assert.equal(f("1h30m15s"), 5415);
  assert.equal(f("90s"), 90);
  assert.equal(f("2h"), 7200);
  assert.equal(f("0m"), 0);
  assert.equal(f("1h5s"), 3605);
  assert.equal(f("1m1h"), null);
  assert.equal(f(""), null);
  assert.equal(f("5"), null);
  assert.equal(f("1h1h"), null);
  assert.equal(f("1.5h"), null);
  assert.equal(f(" 1h"), null);
  assert.equal(f("h"), null);
  assert.equal(f("3d"), null);
}`);

add(6, "lruMisses", `/**
 * Simulate an LRU cache with the given capacity over a sequence of key accesses and return the number
 * of misses. On a miss the key is inserted, evicting the least recently used key when full.
 * A hit makes the key most recently used. Capacity 0 means every access misses.
 * lruMisses(2, [1, 2, 1, 3, 2]) === 4
 * @param {number} capacity
 * @param {number[]} accesses
 * @returns {number}
 */
function lruMisses(capacity, accesses) {
`, `  const cache = new Map();
  let misses = 0;
  for (const k of accesses) {
    if (cache.has(k)) { cache.delete(k); cache.set(k, true); continue; }
    misses++;
    if (capacity === 0) continue;
    if (cache.size >= capacity) cache.delete(cache.keys().next().value);
    cache.set(k, true);
  }
  return misses;
}`, `function check(f) {
  assert.equal(f(2, [1, 2, 1, 3, 2]), 4);
  assert.equal(f(0, [1, 1, 1]), 3);
  assert.equal(f(1, [1, 1, 2, 2, 1]), 3);
  assert.equal(f(3, []), 0);
  assert.equal(f(2, [1, 2, 3, 1, 2, 3]), 6);
  assert.equal(f(3, [1, 2, 3, 1, 4, 1, 2]), 5);
}`);

add(7, "compareSemver", `/**
 * Compare two Semantic Versioning 2.0.0 strings: return -1 if a < b, 0 if equal precedence, 1 if a > b.
 * Rules: compare MAJOR.MINOR.PATCH numerically; a version with a pre-release (after "-") has lower
 * precedence than the same version without one; pre-release identifiers are compared left to right,
 * numeric identifiers numerically, alphanumeric ones lexically (ASCII), numeric < alphanumeric, and a
 * shorter set of identifiers is lower when all preceding ones are equal. Build metadata (after "+") is ignored.
 * compareSemver("1.0.0-alpha", "1.0.0") === -1
 * compareSemver("1.0.0-alpha.1", "1.0.0-alpha.beta") === -1
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
function compareSemver(a, b) {
`, `  const parse = (v) => {
    const [core, pre] = v.split("+")[0].split(/-(.*)/s);
    return { core: core.split(".").map(Number), pre: pre ? pre.split(".") : [] };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  const num = (s) => /^\\d+$/.test(s);
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (num(p) && num(q)) return Number(p) < Number(q) ? -1 : 1;
    if (num(p) !== num(q)) return num(p) ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}`, `function check(f) {
  const order = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2",
    "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "1.0.1", "1.2.0", "1.10.0", "2.0.0"];
  for (let i = 0; i < order.length; i++)
    for (let j = 0; j < order.length; j++)
      assert.equal(f(order[i], order[j]), Math.sign(i - j), order[i] + " vs " + order[j]);
  assert.equal(f("1.0.0+build.1", "1.0.0+build.2"), 0);
  assert.equal(f("1.0.0-rc.1+x", "1.0.0-rc.1"), 0);
  assert.equal(f("1.0.0-x-y", "1.0.0-x"), 1);
}`);

add(8, "wordWrap", `/**
 * Greedy word wrap: split text on runs of whitespace into words and pack them into lines of at most
 * width characters, joining words on a line with one space. A word longer than width is split into
 * chunks of exactly width characters (the last chunk may be shorter), each chunk starting a new line;
 * the final chunk may be followed by further words on the same line if they fit. Empty or blank text
 * gives [].
 * wordWrap("the quick brown fox", 10) -> ["the quick", "brown fox"]
 * wordWrap("abcdefghij k", 4) -> ["abcd", "efgh", "ij k"]
 * @param {string} text
 * @param {number} width
 * @returns {string[]}
 */
function wordWrap(text, width) {
`, `  const lines = [];
  let line = "";
  for (let word of text.split(/\\s+/).filter(Boolean)) {
    while (word.length > width) {
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}`, `function check(f) {
  assert.deepEqual(f("the quick brown fox", 10), ["the quick", "brown fox"]);
  assert.deepEqual(f("abcdefghij k", 4), ["abcd", "efgh", "ij k"]);
  assert.deepEqual(f("", 5), []);
  assert.deepEqual(f("   \\n  ", 5), []);
  assert.deepEqual(f("a b c", 1), ["a", "b", "c"]);
  assert.deepEqual(f("hi  there\\nyou", 8), ["hi there", "you"]);
  assert.deepEqual(f("x abcdefgh", 4), ["x", "abcd", "efgh"]);
  assert.deepEqual(f("exactly", 7), ["exactly"]);
}`);

add(9, "spiralOrder", `/**
 * Return the elements of a rectangular matrix in clockwise spiral order, starting at the top-left.
 * spiralOrder([[1,2,3],[4,5,6],[7,8,9]]) -> [1,2,3,6,9,8,7,4,5]
 * @param {number[][]} m
 * @returns {number[]}
 */
function spiralOrder(m) {
`, `  const out = [];
  if (!m.length || !m[0].length) return out;
  let top = 0, bottom = m.length - 1, left = 0, right = m[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let j = left; j <= right; j++) out.push(m[top][j]);
    for (let i = top + 1; i <= bottom; i++) out.push(m[i][right]);
    if (top < bottom) for (let j = right - 1; j >= left; j--) out.push(m[bottom][j]);
    if (left < right) for (let i = bottom - 1; i > top; i--) out.push(m[i][left]);
    top++; bottom--; left++; right--;
  }
  return out;
}`, `function check(f) {
  assert.deepEqual(f([[1,2,3],[4,5,6],[7,8,9]]), [1,2,3,6,9,8,7,4,5]);
  assert.deepEqual(f([]), []);
  assert.deepEqual(f([[1]]), [1]);
  assert.deepEqual(f([[1,2,3,4]]), [1,2,3,4]);
  assert.deepEqual(f([[1],[2],[3]]), [1,2,3]);
  assert.deepEqual(f([[1,2,3,4],[5,6,7,8],[9,10,11,12]]), [1,2,3,4,8,12,11,10,9,5,6,7]);
  assert.deepEqual(f([[1,2],[3,4],[5,6]]), [1,2,4,6,5,3]);
}`);

add(10, "lisLength", `/**
 * Length of the longest strictly increasing subsequence (not necessarily contiguous).
 * Must handle arrays of 100000 elements within a second.
 * lisLength([10,9,2,5,3,7,101,18]) === 4
 * @param {number[]} nums
 * @returns {number}
 */
function lisLength(nums) {
`, `  const tails = [];
  for (const x of nums) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
    tails[lo] = x;
  }
  return tails.length;
}`, `function check(f) {
  assert.equal(f([10,9,2,5,3,7,101,18]), 4);
  assert.equal(f([]), 0);
  assert.equal(f([7,7,7]), 1);
  assert.equal(f([0,1,0,3,2,3]), 4);
  assert.equal(f([-2,-1]), 2);
  const big = Array.from({ length: 100000 }, (_, i) => (i * 7919) % 100003);
  const t0 = Date.now();
  const r = f(big);
  assert.ok(Date.now() - t0 < 1000, "too slow: needs O(n log n)");
  assert.equal(typeof r, "number");
  assert.equal(f(Array.from({ length: 100000 }, (_, i) => i)), 100000);
}`);

add(11, "evalRPN", `/**
 * Evaluate an expression in Reverse Polish Notation given as tokens. Operators: + - * /.
 * Operands are integers (possibly negative, e.g. "-3"). Division truncates toward zero.
 * Throw an Error if the expression is malformed (too few operands, leftover operands, unknown token)
 * or divides by zero.
 * evalRPN(["2","1","+","3","*"]) === 9
 * evalRPN(["7","-2","/"]) === -3
 * @param {string[]} tokens
 * @returns {number}
 */
function evalRPN(tokens) {
`, `  const st = [];
  for (const t of tokens) {
    if (/^-?\\d+$/.test(t)) { st.push(Number(t)); continue; }
    if (!["+", "-", "*", "/"].includes(t)) throw new Error("unknown token " + t);
    if (st.length < 2) throw new Error("too few operands");
    const b = st.pop(), a = st.pop();
    if (t === "/" && b === 0) throw new Error("division by zero");
    st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : Math.trunc(a / b));
  }
  if (st.length !== 1) throw new Error("malformed expression");
  return st[0];
}`, `function check(f) {
  assert.equal(f(["2","1","+","3","*"]), 9);
  assert.equal(f(["7","-2","/"]), -3);
  assert.equal(f(["-7","2","/"]), -3);
  assert.equal(f(["4","13","5","/","+"]), 6);
  assert.equal(f(["42"]), 42);
  assert.equal(f(["3","-4","-"]), 7);
  assert.throws(() => f(["1","+"]));
  assert.throws(() => f(["1","2"]));
  assert.throws(() => f(["1","0","/"]));
  assert.throws(() => f(["1","2","^"]));
  assert.throws(() => f([]));
}`);

process.stdout.write(T.map((t) => JSON.stringify(t)).join("\n") + "\n");
