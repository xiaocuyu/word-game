/* ============================================================
 * 主程序：路由 + 各屏幕渲染
 *  首页(单元选择) / 关卡(教学·检索) / 结算 / 挑战 / 宠物 / 小镇
 * ============================================================ */

const $app = document.getElementById('app');

/* ---------------- 工具 ---------------- */

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function clear() { $app.innerHTML = ''; }

/* 本次游玩会话 */
const Session = {
  unit: null, steps: [], stepIdx: 0, words: [], wordIdx: 0,
  answer: '', hintLevel: 0, wrongInWord: 0,
  results: [], challenge: false, hearts: 3, wrongQueue: [],
  /* 挑战模式：已攻克的 wordId 集合 */
  cleared: {},
  /* 本轮已结算过星星的 wordId，防止同关重复刷星 */
  starred: {},
  keyHandler: null,
};

function setTab(name) {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.go === name));
}

/* ================= 首页 ================= */

function HomeScreen() {
  clear();
  setTab('home');
  const s = load();
  const all = SRS.stats(ALL_WORDS);
  const st = petStage();

  const card = el(`
    <div class="app">
      <div class="card pet-card">
        <div class="avatar">${st.emo}</div>
        <div style="flex:1">
          <div class="who">${esc(s.pet.name)} <span class="stg">· ${st.name}</span></div>
          <div class="sub" style="margin:2px 0 0">${st.desc}</div>
          <div class="sub" style="margin:4px 0 0">陪伴你练了 ${s.pet.sessions} 次</div>
        </div>
        <div style="text-align:right">
          <div class="pill gold">⭐ ${starBalance()}</div>
          <div class="pill green" style="margin-top:6px">牢记 ${all.mastered}/${all.total}</div>
        </div>
      </div>

      <div class="card">
        <h2>⚔️ 今日迷雾试炼</h2>
        <p class="sub">12 个单词的大挑战：答对前进，答错扣一颗心，三颗心用完就要重来。敢不敢试试？</p>
        <button class="btn block" id="btn-chal">⚔️ 进入挑战${s.bestChallenge ? `（最佳 ${s.bestChallenge} 连对）` : ''}</button>
      </div>

      <div class="book-title">📖 选一个单元开始学</div>
      <div id="units"></div>

      <div class="footnote">一关下来每个词会考你 3 次以上 —— 先自己想，实在不会再要提示<br>❌ 过的词过几天还会自动回来找你（间隔重复）</div>
    </div>
  `);

  const box = card.querySelector('#units');
  BOOKS.forEach((book) => {
    box.appendChild(el(`<div class="book-title">${book.emo || '📗'} ${book.name}</div>`));
    book.units.forEach((u) => {
      const st2 = SRS.stats(u.words);
      const due = u.words.filter((w) => !SRS.isMastered(w.id)).length;
      const done = st2.mastered === st2.total;
      const btn = el(`
        <button class="unit-row ${done ? 'done' : ''}">
          <span class="emo">${u.emo}</span>
          <span class="meta">
            <span class="name">${u.name}</span>
            <span class="en">${u.theme} · 牢记 ${st2.mastered}/${st2.total}${due && !done ? ` · ${due} 词待拿下` : ''}</span>
          </span>
          <span class="go ${done ? 'review' : ''}">${done ? '已通关' : st2.mastered ? '继续' : '开始'}</span>
        </button>
      `);
      btn.addEventListener('click', () => startUnit(u));
      box.appendChild(btn);
    });
  });

  card.querySelector('#btn-chal').addEventListener('click', () => startChallenge());
  $app.appendChild(card);
}

/* ================= 关卡流程 ================= */

function startUnit(unit) {
  Session.unit = unit;
  Session.steps = LEVEL.buildSteps(unit);
  Session.stepIdx = 0;
  Session.wordIdx = 0;
  Session.results = [];
  Session.challenge = false;
  Session.starred = {};
  Session.baseLen = 0;
  Session.baseWords = [];
  StepScreen();
}

function startChallenge() {
  /* 组题只做一次，让 unit.words 与两端 step 完全一致 */
  const words = LEVEL.buildChallenge().words;
  Session.unit = { id: 'chal', name: '迷雾试炼', emo: '⚔️', theme: 'Boss', words };
  Session.steps = LEVEL.buildChallengeSteps(words);
  Session.stepIdx = 0;
  Session.wordIdx = 0;
  Session.results = [];
  Session.challenge = true;
  Session.hearts = 3;
  Session.wrongQueue = [];
  Session.cleared = {};
  Session.starred = {};
  StepScreen();
}

/* 阶段切换入口 */
function StepScreen() {
  const step = Session.steps[Session.stepIdx];
  if (!step) return FinishScreen();
  if (Session.wordIdx >= step.words.length) return nextStep();
  /* 固定本阶段的基准词表与进度口径（挑战模式会动态追加错词） */
  if (!Session.baseLen) {
    Session.baseLen = step.words.length;
    Session.baseWords = step.words.slice();
  }
  if (step.kind === 'show') return ShowScreen(step);
  return QuizScreen(step);
}

function nextStep() {
  Session.stepIdx += 1;
  Session.wordIdx = 0;
  Session.baseLen = 0;
  Session.baseWords = [];
  if (Session.stepIdx >= Session.steps.length) return FinishScreen();
  StepScreen();
}

/* ---------- 阶段一：看图学词（示范） ---------- */

function ShowScreen(step) {
  clear();
  setTab('home');
  const word = Session.unit.words.find((w) => w.id === step.words[Session.wordIdx]);
  const target = spellingTarget(word.w);
  const pct = Math.round((Session.wordIdx / Session.baseLen) * 100);

  const card = el(`
    <div class="app">
      <div class="topbar">
        <div class="title">${Session.unit.emo} ${esc(Session.unit.name)}</div>
        <div class="spacer"></div>
        <div class="pill">${Session.wordIdx + 1}/${Session.baseLen}</div>
        <button class="btn small ghost" id="btn-quit">退出</button>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>

      <div class="card stage">
        <div class="count">📖 ${step.name}</div>
        <div class="bigemo">${word.emo}</div>
        <div class="zh">${esc(word.zh)}</div>
        <div class="spell-box" style="margin-bottom:0">
          ${target.toUpperCase().split('').map((c) => `<div class="slot filled">${c}</div>`).join('')}
        </div>
        <p class="sub" style="margin:10px 0 0">音节：<b>${word.syl.join(' · ').toUpperCase()}</b></p>
        <p class="sub" style="margin:2px 0 0">${esc(word.tip)}</p>
        <button class="speak-btn" id="btn-say" style="margin-top:12px">🔊 跟读两遍</button>
        <button class="btn block green" id="btn-next" style="margin-top:14px">记住了 → 考考我</button>
      </div>
    </div>
  `);

  card.querySelector('#btn-say').addEventListener('click', () => {
    Audio.say(word.w);
    setTimeout(() => Audio.say(word.w, 0.6), 1700);
  });
  card.querySelector('#btn-next').addEventListener('click', () => {
    Session.wordIdx += 1;
    StepScreen();
  });
  card.querySelector('#btn-quit').addEventListener('click', quitConfirm);

  /* 自动读一遍 */
  setTimeout(() => Audio.say(word.w), 250);
  $app.appendChild(card);
}

/* ---------- 阶段二/三/四：检索拼写 ---------- */

function QuizScreen(step) {
  clear();
  setTab('home');
  const word = Session.unit.words.find((w) => w.id === step.words[Session.wordIdx]);
  const target = spellingTarget(word.w);
  const pct = Math.round((Session.wordIdx / Session.baseLen) * 100);

  Session.answer = '';
  Session.hintLevel = 0;
  Session.wrongInWord = 0;
  Session.locked = false;

  const card = el(`
    <div class="app">
      <div class="topbar">
        <div class="title">${Session.unit.emo} ${esc(Session.unit.name)}</div>
        <div class="spacer"></div>
        ${Session.challenge ? `<div class="pill" id="hearts">${'❤'.repeat(Session.hearts)}</div>` : ''}
        <div class="pill">${Session.wordIdx + 1}/${Session.baseLen || step.words.length}</div>
        <button class="btn small ghost" id="btn-quit">退出</button>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>

      <div class="card stage">
        <div class="count">✍️ ${step.name}</div>
        <div class="bigemo">${word.emo}</div>
        <div class="zh">${esc(word.zh)}</div>
        <div class="hint-row" style="margin:6px 0 0">
          <button class="speak-btn" id="btn-say" style="margin:0">🔊 听发音</button>
        </div>

        <div class="spell-box" id="spell"></div>

        <div class="hint-row">
          <button class="btn small ghost" id="btn-hint">💡 要提示</button>
          <button class="btn small ghost" id="btn-del">⌫ 删一个</button>
          <button class="btn small green" id="btn-ok">✅ 提交</button>
        </div>

        <div class="keyboard" id="kb"></div>
        <div id="feedback"></div>
      </div>
    </div>
  `);

  const spellBox = card.querySelector('#spell');
  const fb = card.querySelector('#feedback');
  const kb = card.querySelector('#kb');
  /* 记录哪些位置是提示给的（用于金色高亮） */
  const hintedIdx = new Set();

  function renderSpell() {
    spellBox.innerHTML = '';
    for (let i = 0; i < target.length; i++) {
      const c = Session.answer[i];
      /* 提示给的字母用金色，自己打的用主色 */
      const cls = c ? (hintedIdx.has(i) ? 'filled hinted' : 'filled') : '';
      spellBox.appendChild(el(`<div class="slot ${cls}">${c ? esc(c.toUpperCase()) : ''}</div>`));
    }
  }

  function buildKeyboard() {
    const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const need = new Set(target.toUpperCase().split(''));
    const extra = base.filter((c) => !need.has(c)).sort(() => Math.random() - 0.5).slice(0, 3);
    LEVEL.shuffle(base.concat(extra)).forEach((k) => {
      const b = el(`<button class="key">${k}</button>`);
      b.addEventListener('click', () => typeKey(k.toLowerCase()));
      kb.appendChild(b);
    });
    const del = el(`<button class="key wide">⌫ 删</button>`);
    del.addEventListener('click', doDel);
    kb.appendChild(del);
  }

  function typeKey(ch) {
    if (Session.locked) return;
    if (Session.answer.length < target.length) {
      Session.answer += ch;
      renderSpell();
    }
  }

  function doDel() {
    if (Session.locked) return;
    Session.answer = Session.answer.slice(0, -1);
    renderSpell();
  }

  function giveHint() {
    if (Session.locked || Session.hintLevel >= 4) return;
    Session.hintLevel += 1;
    Audio.hint();
    /* 提示给出的字母直接计入已输入内容，孩子只需补剩下的空 */
    const revealed = HINT.reveal(word.w, Session.hintLevel).replace(/ /g, '');
    let merged = '';
    for (let i = 0; i < target.length; i++) {
      const mine = Session.answer[i];
      const hintCh = revealed[i];
      if (mine) merged += mine;
      else if (hintCh && hintCh !== '•') { merged += hintCh.toLowerCase(); hintedIdx.add(i); }
      else merged += '';
    }
    Session.answer = merged;

    if (Session.hintLevel === 1) {
      fb.innerHTML = tip(`首字母是 <b>${target[0].toUpperCase()}</b>，后面的自己想～`);
    } else if (Session.hintLevel === 2) {
      fb.innerHTML = tip(`按音节拆：<b>${word.syl.join(' · ').toUpperCase()}</b>`);
    } else if (Session.hintLevel === 3) {
      fb.innerHTML = tip(`给你一半：<b>${HINT.reveal(word.w, 3).toUpperCase().replace(/ /g, ' ')}</b><br>钩子：${esc(word.tip)}`);
    } else {
      fb.innerHTML = tip(`答案就是它，一起记住：<b>${target.toUpperCase()}</b>`);
    }
    renderSpell();
  }

  function tip(html) { return `<div class="tipbox">${html}</div>`; }

  function submit() {
    if (Session.locked) return;
    if (Session.answer.length < target.length) {
      fb.innerHTML = tip(`还差 <b>${target.length - Session.answer.length}</b> 个字母，补满再提交！`);
      return;
    }
    const ok = Session.answer === target;
    const hintFree = Session.hintLevel === 0 && Session.wrongInWord === 0;

    SRS.record(word.id, ok, hintFree);
    Session.results.push({ word, ok, hintFree, hints: Session.hintLevel });

    /* 挑战模式：每攻克一个新词就记录下来，集满即通关 */
    if (Session.challenge) {
      if (ok) Session.cleared[word.id] = (Session.cleared[word.id] || 0) + 1;
      else Session.wrongQueue.push(word);
    }

    if (ok) {
      Audio.correct();
      /* 星星：本轮首次拼对该词才发星，重复拼对不再刷 */
      if (!Session.starred[word.id]) {
        Session.starred[word.id] = true;
        const gain = hintFree ? 2 : 1;
        const s = load();
        s.totalStars = (s.totalStars || 0) + gain;
        s.totalRight += 1;
        save();
        if (hintFree) fb.innerHTML = `<div class="verdict ok">🎉 全对！不用提示就写出来了，<b>+2 星</b></div>`;
        else fb.innerHTML = `<div class="verdict ok">🎉 正确！用了提示也算掌握 <b>+1 星</b></div>`;
      } else {
        fb.innerHTML = `<div class="verdict ok">🎉 又对了！越练越牢</div>`;
      }
    } else {
      Audio.wrong();
      Session.wrongInWord += 1;
      if (Session.challenge) {
        Session.hearts -= 1;
        card.querySelector('#hearts').textContent = '❤'.repeat(Math.max(0, Session.hearts)) || '🖤';
      }
      fb.innerHTML = `<div class="verdict no">差一点点～ 正确写法：<span class="answer">${target.toUpperCase()}</span></div>`;
    }

    /* 挑战：三颗心用尽 -> 失败；12 词全部攻克 -> 通关 */
    if (Session.challenge) {
      const cleared = Object.keys(Session.cleared).length;
      const heartsEl = card.querySelector('#hearts');
      if (heartsEl) heartsEl.textContent = '❤'.repeat(Math.max(0, Session.hearts)) || '🖤';
      if (Session.hearts <= 0) { lock(true); setTimeout(ChallengeLoseScreen, 1200); return; }
      if (cleared >= Session.unit.words.length) { lock(true); setTimeout(ChallengeWinScreen, 900); return; }
    }

    lock(true);
    setTimeout(advance, ok ? 900 : 2200);
  }

  function lock(on) {
    Session.locked = on;
    kb.style.pointerEvents = on ? 'none' : '';
    kb.style.opacity = on ? '.45' : '';
    card.querySelector('#btn-ok').disabled = on;
    card.querySelector('#btn-hint').disabled = on;
  }

  function advance() {
    /* 挑战：失败/通关已在 submit 内判定；这里推进错词重练队列。
       不修改 step.words，只把错词插到 session 队列中，保持进度条口径稳定。 */
    if (Session.challenge) {
      const again = Session.wrongQueue.splice(0);
      const base = Session.baseWords;
      const next = base.slice(Session.wordIdx + 1);
      const queue = next.concat(again);
      step.words = base.slice(0, Session.wordIdx + 1).concat(queue);
      step.baseLen = base.length;
    }

    Session.wordIdx += 1;
    StepScreen();
  }

  renderSpell();
  buildKeyboard();

  card.querySelector('#btn-say').addEventListener('click', () => { Audio.say(word.w); setTimeout(() => Audio.say(word.w), 1600); });
  card.querySelector('#btn-hint').addEventListener('click', giveHint);
  card.querySelector('#btn-del').addEventListener('click', doDel);
  card.querySelector('#btn-ok').addEventListener('click', submit);
  card.querySelector('#btn-quit').addEventListener('click', quitConfirm);

  /* 物理键盘 */
  Session.keyHandler = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); doDel(); return; }
    if (/^[a-zA-Z]$/.test(e.key)) typeKey(e.key.toLowerCase());
  };
  document.addEventListener('keydown', Session.keyHandler);

  $app.appendChild(card);
}

function tip_html() {}

function quitConfirm() {
  if (confirm('现在退出？这一关的进度会中断（已记住的词还是会记住）。')) go('home');
}

/* ================= 结算 ================= */

function FinishScreen() {
  document.removeEventListener('keydown', Session.keyHandler || (() => {}));
  clear();

  const res = Session.results;
  const total = res.length || 1;
  const perfect = res.filter((r) => r.ok && r.hintFree).length;
  const okCnt = res.filter((r) => r.ok).length;
  const wrong = res.filter((r) => !r.ok).length;
  const pct = Math.round((perfect / total) * 100);
  const medal = pct >= 80 ? '🏆' : pct >= 55 ? '🥇' : pct >= 30 ? '🥈' : '🥉';

  /* 按词聚合成一行（一个词这轮被考了几次就显示几次统计摘要） */
  const byWord = new Map();
  res.forEach((r) => {
    if (!byWord.has(r.word.id)) byWord.set(r.word.id, { word: r.word, times: 0, bad: 0, hint: false });
    const e = byWord.get(r.word.id);
    e.times += 1;
    if (!r.ok) e.bad += 1;
    if (!r.hintFree) e.hint = true;
  });
  const uniqueCount = byWord.size;

  const grew = finishSession();

  const card = el(`
    <div class="app">
      <div class="card">
        <div class="result-hero">
          <div class="big">${medal}</div>
          <div class="sc">${okCnt} / ${res.length}</div>
          <div class="star-row">${'⭐'.repeat(Math.min(5, Math.round((okCnt / total) * 5)))}</div>
          <p class="sub" style="margin-top:10px">${esc(Session.unit.name)} 完成啦！<br>这一轮的 <b>${uniqueCount}</b> 个词，一共考了你 <b>${res.length}</b> 次。<br>其中 <b>${perfect}</b> 次不用提示就写出来了。</p>
        </div>
        <div class="mini-stats">
          <div class="mini"><b>${perfect}</b><span>独立拼对</span></div>
          <div class="mini"><b>${okCnt - perfect}</b><span>提示后拼对</span></div>
          <div class="mini"><b>${wrong}</b><span>写错</span></div>
        </div>
        ${grew.after > grew.before ? `<p class="sub" style="text-align:center;color:var(--green);font-weight:800">🎊 小单词兽长大了！现在是「${petStage().name}」${petStage().emo}</p>` : ''}
        <button class="btn block green" id="btn-again">🔁 再练一轮</button>
        <button class="btn block ghost" id="btn-home" style="margin-top:10px">🏠 回主页</button>
      </div>

      <div class="card">
        <h2>📋 这一轮考过的词</h2>
        <div class="review-list">
          ${[...byWord.values()].map((e) => `
            <div class="review-item">
              <span class="mk">${e.bad === 0 ? (e.hint ? '🟡' : '✅') : '❌'}</span>
              <span class="wd"><b>${spellingTarget(e.word.w).toUpperCase()}</b>
                <span>${esc(e.word.zh)} · 考了 ${e.times} 次${e.bad ? ` · 错 ${e.bad} 次` : ' · 全对'}</span></span>
            </div>`).join('')}
        </div>
        <p class="sub" style="margin-top:12px">❌ 和 🟡 的词会在 1～7 天后自动再来找你，那时候就真记住了。</p>
      </div>
    </div>
  `);

  card.querySelector('#btn-again').addEventListener('click', () => {
    if (Session.challenge) startChallenge();
    else startUnit(Session.unit);
  });
  card.querySelector('#btn-home').addEventListener('click', () => go('home'));
  $app.appendChild(card);
}

/* ================= 挑战：胜负画面 ================= */

function ChallengeLoseScreen() {
  document.removeEventListener('keydown', Session.keyHandler || (() => {}));
  clear();
  Audio.fail();
  const n = Session.results.filter((r) => r.ok).length;
  const card = el(`
    <div class="app">
      <div class="card" style="text-align:center">
        <div class="result-hero">
          <div class="big">🌫️</div>
          <h2>试炼结束</h2>
          <p class="sub">三颗心用完了，你连对了 <b>${n}</b> 个词。</p>
          <div class="review-list" style="text-align:left;margin-top:12px">
            ${Session.results.map((r) => `
              <div class="review-item">
                <span class="mk">${r.ok ? '✅' : '❌'}</span>
                <span class="wd"><b>${spellingTarget(r.word.w).toUpperCase()}</b><span>${esc(r.word.zh)}</span></span>
              </div>`).join('')}
          </div>
        </div>
        <button class="btn block" id="btn-again" style="margin-top:12px">⚔️ 再试一次</button>
        <button class="btn block ghost" id="btn-home" style="margin-top:10px">🏠 回主页</button>
      </div>
    </div>
  `);
  card.querySelector('#btn-again').addEventListener('click', startChallenge);
  card.querySelector('#btn-home').addEventListener('click', () => go('home'));
  $app.appendChild(card);
}

function ChallengeWinScreen() {
  document.removeEventListener('keydown', Session.keyHandler || (() => {}));
  clear();
  Audio.win();
  const n = Session.results.filter((r) => r.ok).length;
  const s = load();
  s.bestChallenge = Math.max(s.bestChallenge || 0, n);
  save();
  const card = el(`
    <div class="app">
      <div class="card" style="text-align:center">
        <div class="result-hero">
          <div class="big">🏆</div>
          <div class="sc">${n} 连对</div>
          <p class="sub">迷雾试炼通关！你是单词小英雄。</p>
        </div>
        <button class="btn block green" id="btn-home" style="margin-top:12px">🏠 回主页</button>
      </div>
    </div>
  `);
  card.querySelector('#btn-home').addEventListener('click', () => go('home'));
  $app.appendChild(card);
}

function ChallengeScreen() {
  startChallenge();
}

/* ================= 宠物页 ================= */

function PetScreen() {
  clear();
  setTab('pet');
  const s = load();
  const st = petStage();
  const next = PET_STAGES.find((p) => p.min > st.min);
  const all = SRS.stats(ALL_WORDS);
  const masteredNow = all.mastered;

  const card = el(`
    <div class="app">
      <div class="topbar"><div class="title">🐣 我的小单词兽</div><div class="spacer"></div><div class="pill gold">⭐ ${starBalance()}</div></div>
      <div class="card" style="text-align:center">
        <div class="result-hero"><div class="big">${st.emo}</div></div>
        <h2>${esc(s.pet.name)} · ${st.name}</h2>
        <p class="sub">${st.desc}</p>
        ${next
          ? `<div class="mini-stats"><div class="mini"><b>${masteredNow}</b><span>已牢记</span></div><div class="mini"><b>${next.min}</b><span>升级需要</span></div></div>
             <p class="sub">再牢记 <b>${next.min - masteredNow}</b> 个词，就能长成「${next.name}」${next.emo}！</p>`
          : '<p class="sub">已经是最强形态啦，太厉害了！</p>'}
        <div class="mini-stats">
          <div class="mini"><b>${all.mastered}</b><span>牢记</span></div>
          <div class="mini"><b>${all.learning}</b><span>学习中</span></div>
          <div class="mini"><b>${all.fresh}</b><span>没见过</span></div>
          <div class="mini"><b>${s.bestChallenge || 0}</b><span>挑战最佳</span></div>
        </div>
        <p class="sub">陪伴你练了 ${s.pet.sessions} 次</p>
      </div>
      <div class="card">
        <h2>🧠 怎么才算「牢记」？</h2>
        <p class="sub">需要满足三个条件：复习间隔拉到 <b>7 天以上</b>、<b>连续 3 次</b>拼对、而且 <b>没有看过提示</b>。<br>所以每关要连着练几天才有效哦。</p>
      </div>
    </div>
  `);
  $app.appendChild(card);
}

/* ================= 小镇页 ================= */

let selectedBuilding = null;

function TownScreen() {
  clear();
  setTab('town');
  const s = load();

  const card = el(`
    <div class="app">
      <div class="topbar">
        <div class="title">🏡 我的单词小镇</div>
        <div class="spacer"></div>
        <div class="pill gold">⭐ ${starBalance()}</div>
      </div>

      <div class="card">
        <h2>小镇空地</h2>
        <p class="sub">${selectedBuilding ? `已选中 <b>${esc(buildingName(selectedBuilding))}</b>，点空地放进去。` : '先在商店买建筑，再点空地摆放。（点已有建筑可收回）'}</p>
        <div class="town-grid" id="grid"></div>
      </div>

      <div class="card">
        <h2>🛒 建筑商店</h2>
        <div id="shop"></div>
      </div>
    </div>
  `);

  const grid = card.querySelector('#grid');
  s.town.placed.forEach((id, i) => {
    const b = id ? BUILDINGS.find((x) => x.id === id) : null;
    const plot = el(`<button class="plot ${b ? 'filled' : ''}">
      <span class="pemo">${b ? esc(b.emo) : '＋'}</span>${b ? esc(b.name) : '空地'}</button>`);
    plot.addEventListener('click', () => {
      if (selectedBuilding) {
        const r = placeBuilding(i, selectedBuilding);
        if (r.ok) { selectedBuilding = null; Audio.correct(); } else { Audio.wrong(); alert(r.msg); }
      } else if (id) {
        clearSlot(i);
        Audio.hint();
      }
      TownScreen();
    });
    grid.appendChild(plot);
  });

  const shop = card.querySelector('#shop');
  BUILDINGS.forEach((b) => {
    const own = ownedCount(b.id);
    const canBuy = starBalance() >= b.cost;
    const row = el(`<div class="shop-row">
      <span class="e">${b.emo}</span>
      <span class="n">${b.name}<span class="own">拥有 ${own} 个</span></span>
      <button class="btn small ${canBuy ? '' : 'ghost'}" ${canBuy ? '' : 'disabled'}>⭐ ${b.cost}</button>
    </div>`);
    row.querySelector('button').addEventListener('click', () => {
      const r = buyBuilding(b.id);
      if (r.ok) { selectedBuilding = b.id; Audio.correct(); } else { Audio.wrong(); alert(r.msg); }
      TownScreen();
    });
    shop.appendChild(row);
  });

  $app.appendChild(card);
}

/* ================= 路由与启动 ================= */

/* 底部导航在 index.html 静态节点上，绑定一次即可 */
document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => go(b.dataset.go));
});

/* 关卡进行中（已开始且未出结算） */
function inLevel() {
  return Session.steps.length > 0 && Session.stepIdx < Session.steps.length;
}

function go(name) {
  /* 关卡进行中时，学单词/试炼两个 tab 只切换选中态，不冲掉进度 */
  if (inLevel() && (name === 'home' || name === 'challenge')) {
    setTab(name);
    return;
  }
  const map = { home: HomeScreen, challenge: ChallengeScreen, pet: PetScreen, town: TownScreen };
  (map[name] || HomeScreen)();
}

/* 解锁音频（需用户手势） */
document.addEventListener('pointerdown', function once() {
  try { Audio.say(' '); } catch (e) {}
  document.removeEventListener('pointerdown', once);
});

HomeScreen();
