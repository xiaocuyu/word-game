/* ============================================================
 * 战斗 + SRS 逻辑验证（Node 环境，最小 DOM stub）
 * 被测模块与测试体运行在同一个 vm 上下文，才能共享 const 声明。
 * 运行: node test/logic.test.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- 最小 DOM stub ---------- */
function makeNode() {
  const n = {
    _children: [], _text: '', style: {}, classList: {
      _set: new Set(),
      add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); },
      toggle(c, on) { on ? this.add(c) : this.remove(c); },
      contains(c) { return this._set.has(c); },
    },
    set innerHTML(v) { this._children = []; this._text = String(v).replace(/<[^>]*>/g, ''); },
    get innerHTML() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get textContent() { return this._text; },
    appendChild(c) { this._children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this._children.indexOf(c); if (i >= 0) this._children.splice(i, 1); return c; },
    remove() {},
    setAttribute() {},
    querySelector() { return makeNode(); },
    querySelectorAll() { return []; },
    offsetWidth: 0,
  };
  /* battle.js 里会访问 hpbar.parentElement */
  n.parentElement = n;
  return n;
}

/* canvas 的 2d 上下文：所有方法 noop，属性可写 */
const noopCtx = new Proxy({}, {
  get: (t, k) => { if (k in t) return t[k]; return () => {}; },
  set: () => true,
});

const arenaEl = makeNode();
arenaEl.querySelector = () => makeNode();

const sandbox = {
  console, setTimeout, clearTimeout,
  document: {
    createElement: (tag) => {
      const node = makeNode();
      if (tag === 'canvas') {
        node.getContext = () => noopCtx;
        node.parentNode = null;
      }
      return node;
    },
    getElementById: () => makeNode(),
    querySelector: () => makeNode(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: makeNode(),
  },
  speechSynthesis: undefined,
  SpeechSynthesisUtterance: function () {},
  localStorage: (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  })(),
  Date, Math, JSON, parseInt, parseFloat, isNaN, Object, Array, String, Number, Boolean, Set, Map,
};
let rafSeq = 0; const rafMap = new Map();
sandbox.requestAnimationFrame = (fn) => { const id = ++rafSeq; rafMap.set(id, fn); return id; };
sandbox.cancelAnimationFrame = (id) => { rafMap.delete(id); };
sandbox.getComputedStyle = () => ({});
sandbox.location = { href: '', hash: '' };
sandbox.confirm = () => false;
sandbox.alert = () => {};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;
/* 测试用的 arena 节点 */
sandbox.$ARENA = arenaEl;

function load(f) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}

load('data/words.js');
load('js/srs.js');
load('js/save.js');
load('js/buildings.js');
load('js/battle.js');

/* ---------- 测试体（同一个上下文，故可直接引用上面的 const） ---------- */
const TEST = String.raw`
let pass = 0, fail = 0;
const eq = (d, got, want) => { const ok = got === want; ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + d + '   got=' + got + ' want=' + want); };
const truthy = (d, got) => { const ok = !!got; ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + d + '   got=' + JSON.stringify(got)); };

const done = () => { console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
  if (typeof process !== 'undefined' && process.exit) process.exit(fail ? 1 : 0); };

/* ================= 词库 ================= */
console.log('\n--- 词库 ---');
truthy('词库加载', ALL_WORDS.length > 100);
eq('词条数', ALL_WORDS.length, 107);
truthy('id 就地写入', /^a1:/.test(ALL_WORDS[0].id));
eq('拼写目标去空格(撇号)', spellingTarget("o'clock"), 'oclock');
eq('拼写目标去空格(短语)', spellingTarget('green beans'), 'greenbeans');

/* ================= Battle 挂载冒烟（canvas stub） =================
 * 真实渲染行为由 test/ui.battle.cdp.js 在无头 Chrome 里验证。
 * 这里只验证：mount 能建立、常用动作不会抛错、destroy 可停。 */
console.log('\n--- Battle 挂载冒烟 ---');
const babel = BATTLE;
const api = babel.mount($ARENA, { theme: 'day', challenge: false, hearts: 3 });
truthy('mount 返回 spawn', typeof api.spawn === 'function');
truthy('mount 返回 hit', typeof api.hit === 'function');
truthy('mount 返回 heal', typeof api.heal === 'function');
truthy('mount 返回 defeat', typeof api.defeat === 'function');
truthy('mount 返回 hurt', typeof api.hurt === 'function');
truthy('mount 返回 setHearts', typeof api.setHearts === 'function');
truthy('mount 返回 destroy', typeof api.destroy === 'function');

let threw = [];
['spawn', 'hit', 'heal', 'defeat', 'hurt'].forEach((m) => {
  try { api[m].return || api[m](ALL_WORDS[0]); } catch (e) { threw.push(m + ':' + e.message); }
});
/* hit/heal/defeat/hurt 无参调用 */
try { api.hit(); api.heal(); api.defeat(); api.hurt(); api.setHearts(2); } catch (e) { threw.push('bare:' + e.message); }
eq('全部动作调用不抛错', threw.join('|').slice(0, 120), '');
let derr = '';
try { api.destroy(); } catch (e) { derr = e.message; }
eq('destroy 不抛错', derr, '');

/* ================= SRS 记忆调度 ================= */
  console.log('\n--- SRS：渐变晋升与退步 ---');
  const w = ALL_WORDS[0];
  eq('初始 box=-1', SRS.rec(w.id).box, -1);
  eq('初始未学', SRS.known(w.id), false);
  SRS.record(w.id, true, true);
  eq('无提示答对 -> box0', SRS.rec(w.id).box, 0);
  eq('hintFree 累计', SRS.rec(w.id).hintFree, 1);
  eq('known 转 true', SRS.known(w.id), true);
  SRS.record(w.id, true, true); SRS.record(w.id, true, true);
  eq('三次后 box=2', SRS.rec(w.id).box, 2);
  eq('streak=3', SRS.rec(w.id).streak, 3);
  eq('未到顶不算牢记', SRS.isMastered(w.id), false);
  const before = SRS.rec(w.id).box;
  SRS.record(w.id, false, false);
  eq('答错退一级', SRS.rec(w.id).box, before - 1);
  eq('答错 streak 清零', SRS.rec(w.id).streak, 0);
  eq('wrong +1', SRS.rec(w.id).wrong, 1);

  console.log('\n--- SRS：复习间隔(艾宾浩斯) ---');
  const bx = SRS.BOXES;
  eq('5 档', bx.length, 5);
  eq('box0 = 10分钟', bx[0].ivlMs, 10 * 60 * 1000);
  eq('box2 = 1天', bx[2].ivlMs, 24 * 3600 * 1000);
  eq('box4 = 7天', bx[4].ivlMs, 7 * 24 * 3600 * 1000);
  for (let i = 0; i < 6; i++) SRS.record(w.id, true, true);
  eq('满档 box=4', SRS.rec(w.id).box, 4);
  truthy('box4+streak3+hintFree3 => 牢记', SRS.isMastered(w.id));

  /* ================= 小镇星星经济 ================= */
  console.log('\n--- 小镇星星经济 ---');
  const s = load();
  s.totalStars = 20; s.ownedBuildings = [];
  s.town = { placed: [null, null, null, null, null, null] };
  save();
  eq('初始余额', starBalance(), 20);
  eq('买喷泉(18星)', buyBuilding('fountain').ok, true);
  eq('买后余额 2', starBalance(), 2);
  const r2 = buyBuilding('windmill');
  eq('风车(14星)买不起', r2.ok, false);
  truthy('余额不足给提示', r2.msg.indexOf('星星') >= 0);
  eq('摆进空地 0', placeBuilding(0, 'fountain').ok, true);
  eq('同名不能重复摆', placeBuilding(1, 'fountain').ok, false);
  /* 余额 2 星，house 只要 2 星，应可买并摆到别处 */
  eq('买小房子(2星)', buyBuilding('house').ok, true);
  eq('可摆小房子到 1 号地', placeBuilding(1, 'house').ok, true);
  eq('余额归零', starBalance(), 0);

  /* ================= 宠物进化 ================= */
  console.log('\n--- 宠物进化(按牢记词数) ---');
  s.quizzes = {}; save();
  eq('无牢记 -> 蛋', petStage().name, '蛋');
  for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) SRS.record(ALL_WORDS[i].id, true, true);
  eq('3 词牢记 -> 幼宠', petStage().name, '幼宠');
  for (let i = 3; i < 8; i++) for (let k = 0; k < 8; k++) SRS.record(ALL_WORDS[i].id, true, true);
  eq('8 词牢记 -> 小宠', petStage().name, '小宠');

  done();
`;

vm.runInNewContext(TEST, sandbox, { filename: 'logic.test' });
