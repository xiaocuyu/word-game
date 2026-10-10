/* ============================================================
 * 存档：宠物 + 小镇 + SRS 进度 + 挑战记录
 * localStorage 单 key JSON，带完整性与兜底校验。
 * ============================================================ */

const SAVE_KEY = 'wordfarm_save_v1';

const DEFAULT_SAVE = () => ({
  v: 1,
  createdAt: Date.now(),
  /* ---- 宠物：成长度由「牢记词数」驱动，练习次数只是陪伴记录 ---- */
  pet: { sessions: 0, name: '小单词兽' },
  /* ---- 小镇建设 ---- */
  town: { placed: [null, null, null, null, null, null] },
  ownedBuildings: [],
  /* ---- 测验记录：wordId -> {right,wrong,streak,box,nextAt,lastAt} ---- */
  quizzes: {},
  bestChallenge: 0,
  totalStars: 0,
  totalRight: 0,
  /* ---- 单元通关记录：unitId -> {at, firstTry, total} ---- */
  clearedUnits: {},
});

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = { ...DEFAULT_SAVE(), ...parsed };
      cache.pet = { ...DEFAULT_SAVE().pet, ...(parsed.pet || {}) };
      cache.town = { ...DEFAULT_SAVE().town, ...(parsed.town || {}) };
      if (!Array.isArray(cache.clearedUnits)) cache.clearedUnits = {};
      if (!Array.isArray(cache.ownedBuildings)) cache.ownedBuildings = [];
      if (!Array.isArray(cache.town.placed)) cache.town.placed = [null, null, null, null, null, null];
      if (!cache.quizzes || typeof cache.quizzes !== 'object') cache.quizzes = {};
      return cache;
    }
  } catch (e) { /* 存档损坏则重置 */ }
  cache = DEFAULT_SAVE();
  return cache;
}

function save() {
  if (!cache) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(cache)); } catch (e) { /* 忽略（隐私模式等） */ }
}

/* 宠物形态：按「已牢记单词数」进化 */
const PET_STAGES = [
  { min: 0, name: '蛋', emo: '🥚', desc: '还没孵化的蛋，用单词唤醒它' },
  { min: 3, name: '幼宠', emo: '🐣', desc: '刚刚孵出的小家伙' },
  { min: 8, name: '小宠', emo: '🐥', desc: '会跟着你念单词啦' },
  { min: 15, name: '伙伴', emo: '🐤', desc: '你最好的单词伙伴' },
  { min: 25, name: '大将', emo: 'ᕙ(•̀ ᗜ •́)ᕗ', desc: '单词大将，无人能敌' },
];

/* 当前牢记词数（供宠物与统计共用） */
function masteredCount() {
  return SRS.masteredWords(ALL_WORDS).length;
}

function petStage() {
  const m = masteredCount();
  let st = PET_STAGES[0];
  for (const p of PET_STAGES) if (m >= p.min) st = p;
  return st;
}

/* 完成一次关卡：陪伴次数 +1，并返回是否触发进化 */
function finishSession() {
  const s = load();
  s.pet.sessions += 1;
  const before = masteredCount();
  save();
  return { before, after: masteredCount(), sessions: s.pet.sessions };
}
