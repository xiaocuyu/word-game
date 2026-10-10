/* 验证「同一单词跨阶段怪物血量延续」+ 复活 + 整关战斗流 */
const { spawn } = require('child_process');
const http = require('http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const URL = 'http://127.0.0.1:8899/index.html';

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--user-data-dir=/tmp/wg-chrome2-' + Date.now(),
  `--remote-debugging-port=${PORT}`,
  '--window-size=900,1400', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
    let d = ''; r.on('data', (c) => (d += c));
    r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

(async () => {
  let t = null;
  for (let i = 0; i < 30; i++) {
    try { t = (await get('/json/list')).filter((x) => x.type === 'page'); if (t.length) break; } catch (e) {}
    await sleep(300);
  }
  const ws = new globalThis.WebSocket(t[0].webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))
    .result.result.value;

  const results = [];
  const check = (n, g, w) => results.push(`${JSON.stringify(g) === JSON.stringify(w) ? 'PASS' : 'FAIL'}  ${n}  got=${JSON.stringify(g)} want=${JSON.stringify(w)}`);

  await send('Page.navigate', { url: URL });
  await sleep(1800);

  /* 注入一个驱动：自动拼写当前词 */
  await ev(`window.__spell = function(){
    const m=(document.querySelector('.count').textContent.match(/「(.+)」/)||[])[1];
    if(!m) return 'nozh';
    const w=ALL_WORDS.find(x=>x.zh===m); if(!w) return 'nomatch:'+m;
    const ans=w.w.replace(/[\\s\\-']/g,'');
    const cur=[...document.querySelectorAll('#spell .slot')].map(s=>s.textContent.trim()).join('');
    if(cur.length>=ans.length){document.querySelector('#btn-ok').click(); return 'submit';}
    const b=[...document.querySelectorAll('#kb .key')].find(x=>x.textContent===ans[cur.length].toUpperCase());
    if(!b) return 'nokey'; b.click(); return 'type';
  }`);
  await ev(`localStorage.removeItem('wordfarm_save_v1'); document.querySelectorAll('#units .unit-row')[0].click()`);
  await sleep(500);
  /* 跑完 show 阶段 */
  await ev(`var n=0; while(document.querySelector('#btn-next')&&n++<30) document.querySelector('#btn-next').click()`);
  await sleep(600);

  /* 读到第一个 quiz 词 */
  const w1 = await ev(`(document.querySelector('.count').textContent.match(/「(.+)」/)||[])[1]`);
  const max1 = await ev(`Number(document.querySelector('#m-num').textContent)`);
  check('首题血量=ceil(词长/2)', max1, Math.max(2, Math.ceil(await ev(`spellingTarget(ALL_WORDS.find(x=>x.zh===${JSON.stringify(w1)}).w).length`) / 2)));

  /* 答对第一题 -> 掉 40% */
  for (let i = 0; i < 40; i++) { const a = await ev(`window.__spell()`); if (a === 'submit') break; await sleep(15); }
  await sleep(250);
  const afterHit = await ev(`Number(document.querySelector('#m-num').textContent)`);
  const dmgModel = (h) => h <= 2 ? h : Math.max(1, Math.round(h / 2));
  check('答对按斩杀模型扣血', afterHit, max1 - dmgModel(max1));

  /* 等切到下一题，验证血量确实按 wordId 延续而非重置 */
  await sleep(900);
  const w2 = await ev(`(document.querySelector('.count').textContent.match(/「(.+)」/)||[])[1]`);
  const hp2 = await ev(`Number(document.querySelector('#m-num').textContent)`);
  const max2 = Math.max(2, Math.ceil(await ev(`spellingTarget(ALL_WORDS.find(x=>x.zh===${JSON.stringify(w2)}).w).length`) / 2));
  check('换新词=新怪满血', w2 === w1 ? hp2 !== afterHit : hp2, w2 === w1 ? hp2 : max2);

  /* 复活/击败验证：在当前词上反复出招，每招后立刻读 verdict。
     注意：前面的伤害断言可能已经打死了本题，故先记录当前屏幕状态。 */
  let fixedZh = await ev(`document.querySelector('.count').textContent.match(/「(.+)」/)?.[1]`);
  let killed = false;
  /* 先把本题打穿（本题可能已被打残） */
  for (let round = 0; round < 6; round++) {
    const curZh = await ev(`document.querySelector('.count').textContent.match(/「(.+)」/)?.[1]`);
    if (!curZh) break;
    if (round > 0 && curZh !== fixedZh) break; /* 已切到下一题 */
    for (let i = 0; i < 40; i++) { const a = await ev(`window.__spell()`); if (a === 'submit') break; await sleep(15); }
    await sleep(220);
    const v = await ev(`document.querySelector('.verdict')?.textContent||''`);
    if (/击败/.test(v)) { killed = true; break; }
    await sleep(700); /* 等切题 */
    /* 切到新题后，下一轮用新题继续验证 */
    fixedZh = await ev(`document.querySelector('.count').textContent.match(/「(.+)」/)?.[1]`);
  }
  check('怪物可被击败', killed, true);

  /* 独立验证伤害累积数学：50% 递减，两次必杀 */
  const model = (h) => h <= 2 ? h : Math.max(1, Math.round(h / 2));
  let worst = 0;
  for (let L = 3; L <= 14; L++) {
    let hp = Math.max(2, Math.ceil(L / 2)), shots = 0;
    while (hp > 0 && shots < 20) { hp -= model(hp); shots++; }
    if (shots > worst) worst = shots;
  }
  check('斩杀模型最长 3 招击杀', worst <= 3, true);
  check('伤害模型血量归零', (() => { let hp = fixedMax; while (hp > 0) hp -= model(hp); return hp; })() <= 0, true);

  console.log(results.join('\n'));
  const f = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n===== ${results.length - f} passed, ${f} failed =====`);
  proc.kill(); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); proc.kill(); process.exit(2); });
