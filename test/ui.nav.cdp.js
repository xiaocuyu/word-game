/* 无头 Chrome CDP 回归：底部导航切换 + 关卡会话清理
 * 运行: node test/ui.nav.cdp.js  （先起 http 服务 8899）
 *
 * 覆盖（对应「关卡中点学单词切不动」修复）：
 *  - 关卡中点「学单词」：取消确认 → 留在本关；确认 → 回主页且 inLevel=false
 *  - 关卡中点「试炼」：确认后进入新试炼（心数重置 3）
 *  - 关卡中点「小伙伴」/「小镇」：直接切走，且不再残留 inLevel（此前 tab 永久卡死）
 *  - 小伙伴页点「学单词」：正常回主页、无确认弹窗
 *  - 关卡「退出」按钮：只弹一次确认，确认后回主页
 *  - 物理键盘监听不随题目累积（连续三题各按一次 q 只追加 1 个字母）
 *  - 挑战三心用尽：出「试炼结束」结算（此前定格死屏）
 */
const { spawn } = require('child_process');
const http = require('http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9339;
const URL = 'http://127.0.0.1:8899/index.html';

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--user-data-dir=/tmp/wg-nav-' + Date.now(),
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
  if (!t || !t.length) throw new Error('CDP 未就绪');

  const ws = new globalThis.WebSocket(t[0].webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (evMsg) => {
    const m = JSON.parse(evMsg.data);
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
  await sleep(1500);

  /* 屏幕探针 + confirm 桩 */
  await ev(`
    window.__screen = function(){
      const txt = document.getElementById('app').textContent || '';
      if (document.querySelector('#units')) return 'home';
      if (document.querySelector('#kb')) return 'level-quiz';
      if (document.querySelector('#btn-next')) return 'level-show';
      if (document.querySelector('#btn-again') && txt.indexOf('完成啦') >= 0) return 'finish';
      if (txt.indexOf('我的小单词兽') >= 0) return 'pet';
      if (txt.indexOf('我的单词小镇') >= 0) return 'town';
      if (txt.indexOf('试炼结束') >= 0) return 'chal-lose';
      return 'unknown:' + txt.slice(0, 60);
    };
    window.__confirm = { calls: 0, answer: true, msgs: [] };
    window.confirm = (m) => { window.__confirm.calls++; window.__confirm.msgs.push(m); return window.__confirm.answer; };
  `);
  await ev(`localStorage.removeItem('wordfarm_save_v1')`);

  const tab = (i) => ev(`(function(){ document.querySelectorAll('.tabbar button')[${i}].click(); })()`);
  const startUnit = () => ev(`document.querySelectorAll('#units .unit-row')[0].click()`);
  const skipShows = () => ev(`(function(){ var n=0; while(document.querySelector('#btn-next')&&n++<40) document.querySelector('#btn-next').click(); })()`);
  const screen = () => ev(`window.__screen()`);
  const stub = (answer) => ev(`window.__confirm.answer=${answer}; window.__confirm.calls=0`);

  /* ---- 1. 关卡中点「学单词」 ---- */
  await startUnit(); await sleep(350);
  check('开始学习后进入关卡', await ev(`inLevel()`), true);
  check('关卡首屏为教学阶段', await screen(), 'level-show');

  await stub(false); await tab(0); await sleep(150);
  check('取消确认后仍留在本关', await screen(), 'level-show');
  check('取消后 inLevel 仍为 true', await ev(`inLevel()`), true);
  check('点学单词弹出确认', await ev(`window.__confirm.calls`), 1);

  await stub(true); await tab(0); await sleep(250);
  check('确认后回主页', await screen(), 'home');
  check('确认后 inLevel=false', await ev(`inLevel()`), false);
  check('只弹一次确认', await ev(`window.__confirm.calls`), 1);

  /* ---- 2. 关卡中点「试炼」 ---- */
  await startUnit(); await sleep(350);
  await stub(false); await tab(1); await sleep(150);
  check('取消后未进入试炼', await ev(`Session.challenge`), false);
  check('取消后仍在原关卡', await screen(), 'level-show');

  await stub(true); await tab(1); await sleep(250);
  check('确认后进入试炼', await ev(`Session.challenge && Session.hearts===3`), true);
  check('试炼在关卡中', await ev(`inLevel()`), true);

  /* ---- 3. 关卡中点「小伙伴」不再死锁 ---- */
  await tab(2); await sleep(200);
  check('关卡中点小伙伴直接切换', await screen(), 'pet');
  check('切走后 inLevel=false（不再死锁）', await ev(`inLevel()`), false);

  await stub(true); await tab(0); await sleep(200);
  check('小伙伴页点学单词回主页', await screen(), 'home');
  check('此时无需确认弹窗', await ev(`window.__confirm.calls`), 0);

  /* ---- 4. 关卡中点「小镇」 ---- */
  await startUnit(); await sleep(350);
  await stub(true); await tab(3); await sleep(200);
  check('关卡中点小镇直接切换', await screen(), 'town');
  check('切走后 inLevel=false', await ev(`inLevel()`), false);
  await tab(0); await sleep(200);
  check('小镇页点学单词回主页', await screen(), 'home');

  /* ---- 5. 「退出」按钮：只弹一次确认 ---- */
  await startUnit(); await sleep(350);
  await stub(true);
  await ev(`document.querySelector('#btn-quit').click()`); await sleep(250);
  check('退出后回主页', await screen(), 'home');
  check('退出只弹一次确认', await ev(`window.__confirm.calls`), 1);

  /* ---- 6. 物理键盘监听不累积 ---- */
  await startUnit(); await sleep(350);
  await skipShows(); await sleep(600);
  check('已进入拼写界面', await ev(`!!document.querySelector('#kb')`), true);

  const probe = `(function(){
    const before = Session.answer.length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true }));
    const added = Session.answer.length - before;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    return added;
  })()`;
  const solve = `(function(){
    const zh = document.querySelector('.zh').textContent.trim();
    const w = ALL_WORDS.find((x) => x.zh === zh);
    const ans = w.w.replace(/[\\s\\-']/g, '');
    for (const ch of ans) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }));
    document.querySelector('#btn-ok').click();
    return ans;
  })()`;

  check('第1题按一次 q 只加 1 个字母', await ev(probe), 1);
  await ev(solve); await sleep(2400);
  check('第2题按一次 q 只加 1 个字母', await ev(probe), 1);
  await ev(solve); await sleep(2400);
  check('第3题按一次 q 只加 1 个字母', await ev(probe), 1);

  /* ---- 7. 挑战三心用尽出结算 ---- */
  await stub(true); await tab(1); await sleep(300);
  check('再次进入试炼', await ev(`Session.challenge && Session.hearts===3 && inLevel()`), true);
  await skipShows(); await sleep(700);
  check('试炼到达拼写界面', await ev(`!!document.querySelector('#kb')`), true);

  for (let i = 0; i < 3; i++) {
    await ev(`(function(){
      const zh = document.querySelector('.zh').textContent.trim();
      const w = ALL_WORDS.find((x) => x.zh === zh);
      const ans = w.w.replace(/[\\s\\-']/g, '');
      const need = new Set(ans.toUpperCase().split(''));
      const wrongKeys = [...document.querySelectorAll('#kb .key')].filter((x) => x.textContent.length === 1 && !need.has(x.textContent));
      const slots = document.querySelectorAll('#spell .slot').length;
      for (let k = 0; k < slots; k++) wrongKeys[k % wrongKeys.length].click();
      document.querySelector('#btn-ok').click();
    })()`);
    await sleep(2700);
  }
  await sleep(1600);
  check('三心用尽出「试炼结束」', await screen(), 'chal-lose');
  check('失败结算后 inLevel=false', await ev(`inLevel()`), false);

  await stub(true);
  await ev(`document.querySelector('#btn-home').click()`); await sleep(250);
  check('失败页回主页', await screen(), 'home');
  check('失败页回主页无需确认', await ev(`window.__confirm.calls`), 0);

  console.log(results.join('\n'));
  const f = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n===== ${results.length - f} passed, ${f} failed =====`);
  proc.kill(); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); try { proc.kill(); } catch (_) {} process.exit(2); });
