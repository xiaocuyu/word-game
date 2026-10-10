/* ============================================================
 * 关卡编排
 *  1) show  看图学词（可看拼写 + 跟读）——建立编码
 *  2) quiz  检索练习（只看中文，独立拼写）——提取强化
 *  3) mix   交错二测（错词优先，打乱顺序）——间隔化
 *  4) flash 闪电复习（全单元快过）——巩固
 *  同一轮内每词检索至少 3 次，远超被动观看次数。
 * ============================================================ */

const LEVEL = (() => {
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* 需求分：错得多/新词优先排前面 */
  function needScore(w) {
    const r = SRS.rec(w.id);
    return r.wrong * 2 + (r.box < 0 ? 3 : 0) - r.box * 0.8;
  }

  function buildSteps(unit) {
    const words = unit.words.slice();
    const steps = [];

    /* 未学过的词才需要教学；全学过则跳过 */
    const fresh = words.filter((w) => !SRS.known(w.id));
    if (fresh.length) {
      steps.push({ kind: 'show', name: '认识新朋友', words: shuffle(fresh).map((w) => w.id) });
    }

    /* 检索 1：全部词（含复习词） */
    steps.push({ kind: 'quiz', name: '我来写写看', words: shuffle(words).map((w) => w.id) });

    /* 检索 2：按需求插空的交错练习 */
    steps.push({ kind: 'mix', name: '交错练习', words: shuffle(words.slice().sort((a, b) => needScore(b) - needScore(a))).map((w) => w.id) });

    /* 闪电复习 */
    steps.push({ kind: 'flash', name: '闪电复习', words: shuffle(words).map((w) => w.id) });

    return steps;
  }

  function buildUnit(unit) {
    return { unit, steps: buildSteps(unit) };
  }

  /* 挑战：优先待复习词 + 未熟练掌握词，取 12 个 */
  function buildChallenge() {
    const pool = ALL_WORDS.slice();
    const weak = pool.filter((w) => !SRS.isMastered(w.id)).sort((a, b) => needScore(b) - needScore(a));
    const head = weak.slice(0, 9);
    const fill = pool.filter((w) => !head.includes(w)).sort(() => Math.random() - 0.5).slice(0, 3);
    const pick = shuffle(head.concat(fill)).slice(0, 12);
    return { words: pick };
  }

  function buildChallengeSteps(words) {
    return [
      { kind: 'show', name: '热身记忆', words: words.map((w) => w.id) },
      { kind: 'flash', name: '迷雾试炼', words: words.map((w) => w.id) },
    ];
  }

  return { shuffle, needScore, buildSteps, buildUnit, buildChallenge, buildChallengeSteps };
})();
