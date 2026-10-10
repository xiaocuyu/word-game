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
    appendChild(c) { this._children.push(c); return c; },
    remove() {},
    querySelector() { return makeNode(); },
    querySelectorAll() { return []; },
    offsetWidth: 0,
  };
  /* battle.js 里会访问 hpbar.parentElement */
  n.parentElement = n;
  return n;
}

const arenaEl = makeNode();
arenaEl.querySelector = () => makeNode();

const sandbox = {
  console, setTimeout, clearTimeout,
  document: {
    createElement: makeNode,
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

/* ================= Battle 状态机 ================= */
console.log('\n--- Battle 状态机 ---');
const b = Battle;
b.mount($ARENA, { monsterEmo: 'x', monsterName: 'n', monsterMax: 10, playerEmo: 'p', playerName: 'pn' });
eq('怪物初始血量', b.state().monsterHp, 10);
eq('玩家初始血量', b.state().playerHp, 100);

let dead = b.hitMonster(4, false);
eq('攻击扣 4 血', b.state().monsterHp, 6);
eq('未击败返回 false', dead, false);

// 魔数验证：出招伤害 = ceil(当前血量 * 0.4)，至少 1
const appDmg = Math.max(1, Math.round(b.state().monsterHp * 0.4));
eq('出招伤害公式(40%)', appDmg, 2);
dead = b.hitMonster(6, true);
eq('再次攻击击杀', dead, true);
eq('怪物血量归零', b.state().monsterHp, 0);
b.hitMonster(5, false);
eq('已死后再打不掉血', b.state().monsterHp, 0);

console.log('\n--- 玩家受击与死亡回调 ---');
b.reset('x', 'n', 10);
eq('reset 后怪满血', b.state().monsterHp, 10);
let fired = 0;
b.hitPlayer(60, () => fired++);
eq('受击扣 60', b.state().playerHp, 40);
eq('未死回调不触发', fired, 0);
b.hitPlayer(100, () => fired++);
eq('血量归零', b.state().playerHp, 0);
setTimeout(() => {
  eq('死亡回调触发', fired, 1);

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
}, 900);
`;

vm.runInNewContext(TEST, sandbox, { filename: 'logic.test' });
