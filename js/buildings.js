/* ============================================================
 * 小镇建设：用星星解锁建筑、摆放进小镇
 * 星星结算规则（在 app.js 统一发放）：
 *   首次无提示独立拼对 = 2 星；用提示拼对 = 1 星；本轮内重复拼对 = 0 星
 * ============================================================ */

const BUILDINGS = [
  { id: 'house', emo: '🏠', name: '小房子', cost: 2 },
  { id: 'tree', emo: '🌳', name: '大树', cost: 3 },
  { id: 'flower', emo: '🌷', name: '花坛', cost: 4 },
  { id: 'school', emo: '🏫', name: '学校', cost: 6 },
  { id: 'shop', emo: '🏪', name: '商店', cost: 8 },
  { id: 'park', emo: '🎠', name: '公园', cost: 10 },
  { id: 'windmill', emo: '🌬️', name: '风车', cost: 14 },
  { id: 'fountain', emo: '⛲', name: '喷泉', cost: 18 },
];

const SLOT_COUNT = 6;

/* 星星余额 = 累计获得 - 已花费 */
function starBalance() {
  const s = load();
  const spent = s.ownedBuildings.reduce((sum, id) => {
    const b = BUILDINGS.find((x) => x.id === id);
    return sum + (b ? b.cost : 0);
  }, 0);
  return Math.max(0, (s.totalStars || 0) - spent);
}

function ownedCount(id) {
  return load().ownedBuildings.filter((x) => x === id).length;
}

function buyBuilding(id) {
  const b = BUILDINGS.find((x) => x.id === id);
  if (!b) return { ok: false, msg: '没有这个建筑' };
  if (starBalance() < b.cost) return { ok: false, msg: '星星不够啦，去关卡里多赚点！' };
  const s = load();
  s.ownedBuildings.push(id);
  save();
  return { ok: true, msg: '买下啦：' + b.name };
}

function placeBuilding(slotIndex, id) {
  const s = load();
  if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return { ok: false, msg: '位置不对' };
  /* 已在小镇里的同名建筑要占用份额，避免一屋多放 */
  const used = s.town.placed.filter((x) => x === id).length;
  if (used >= ownedCount(id)) return { ok: false, msg: '这个建筑都在小镇里啦' };
  s.town.placed[slotIndex] = id;
  save();
  return { ok: true, msg: '摆好啦' };
}

function clearSlot(slotIndex) {
  const s = load();
  if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return { ok: false, msg: '位置不对' };
  s.town.placed[slotIndex] = null;
  save();
  return { ok: true };
}

/* 已买但还没摆进小镇的建筑 */
function availablePlaceable() {
  const s = load();
  const pool = [];
  [...new Set(s.ownedBuildings)].forEach((id) => {
    const used = s.town.placed.filter((x) => x === id).length;
    for (let i = 0; i < ownedCount(id) - used; i++) pool.push(id);
  });
  return pool;
}

function buildingEmoji(id) {
  const b = BUILDINGS.find((x) => x.id === id);
  return b ? b.emo : '❔';
}

function buildingName(id) {
  const b = BUILDINGS.find((x) => x.id === id);
  return b ? b.name : '';
}
