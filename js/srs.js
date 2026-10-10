/* ============================================================
 * 记忆引擎（SRS + 检索练习调度）
 *  - 盒子调度：答对进高级盒子、答错退回；盒子决定下次出现间隔
 *  - 到期判定、过关复习队列、挑战组题都在这里
 * ============================================================ */

const SRS = (() => {
  const BOXES = [
    { name: '新词', ivlMs: 10 * 60 * 1000, label: '10分钟后' },
    { name: '初识', ivlMs: 60 * 60 * 1000, label: '1小时后' },
    { name: '眼熟', ivlMs: 24 * 60 * 60 * 1000, label: '1天后' },
    { name: '记得', ivlMs: 3 * 24 * 60 * 60 * 1000, label: '3天后' },
    { name: '牢记', ivlMs: 7 * 24 * 60 * 60 * 1000, label: '7天后' },
  ];

  function rec(wordId) {
    const s = load();
    if (!s.quizzes[wordId]) {
      s.quizzes[wordId] = { right: 0, wrong: 0, streak: 0, box: -1, nextAt: 0, lastAt: 0, hintFree: 0 };
      save();
    }
    return s.quizzes[wordId];
  }

  function record(wordId, ok, hintFree) {
    const s = load();
    const r = rec(wordId);
    const now = Date.now();
    r.lastAt = now;
    if (ok) {
      r.right += 1;
      r.streak += 1;
      if (hintFree) r.hintFree += 1;
      if (r.box < BOXES.length - 1) r.box += 1;
    } else {
      r.wrong += 1;
      r.streak = 0;
      r.box = Math.max(0, r.box - 1);
    }
    r.nextAt = now + BOXES[Math.max(0, r.box)].ivlMs;
    save();
    return r;
  }

  /* 有学习记录 */
  function known(wordId) {
    return rec(wordId).box >= 0;
  }

  /* 到期应复习 */
  function isDue(wordId) {
    const r = load().quizzes[wordId];
    return !!r && r.nextAt <= Date.now();
  }

  function dueWords(pool) {
    const now = Date.now();
    return pool.filter((w) => {
      const r = load().quizzes[w.id];
      return !r || r.nextAt <= now;
    });
  }

  /* 牢记：进入最难的盒子且「无提示连续答对」达到 3 次 */
  function isMastered(wordId) {
    const r = rec(wordId);
    return r.box >= BOXES.length - 1 && r.streak >= 3 && r.hintFree >= 3;
  }

  function masteredWords(pool) {
    return pool.filter((w) => isMastered(w.id));
  }

  function stats(pool) {
    let m = 0, learning = 0, fresh = 0;
    pool.forEach((w) => {
      const r = load().quizzes[w.id];
      if (!r || r.box < 0) fresh += 1;
      else if (isMastered(w.id)) m += 1;
      else learning += 1;
    });
    return { mastered: m, learning, fresh, total: pool.length };
  }

  function boxLabel(wordId) {
    const r = rec(wordId);
    return r.box < 0 ? '未学' : BOXES[r.box].name;
  }

  return { BOXES, rec, record, known, isDue, dueWords, isMastered, masteredWords, stats, boxLabel };
})();

/* ---------------- 渐变提示 ---------------- */

const HINT = (() => {
  function lettersOf(word) {
    return spellingTarget(word).split('');
  }

  /* level 1=首字母 2=首尾 3=一半 4=全部（=等于给答案） */
  function reveal(word, level) {
    const t = lettersOf(word);
    const n = t.length;
    const keep = new Set();
    if (level >= 1) keep.add(0);
    if (level >= 2) keep.add(n - 1);
    if (level >= 3) for (let i = 0; i < n; i++) if (i % 2 === 0) keep.add(i);
    if (level >= 4) for (let i = 0; i < n; i++) keep.add(i);
    return t.map((c, i) => (keep.has(i) ? c : '•')).join(' ');
  }

  return { reveal, lettersOf };
})();
