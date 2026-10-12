/* 无头 Chrome CDP 冒烟测试：像素战斗整合到拼写关卡
 *  - 战斗 canvas 挂载
 *  - 答对：verdict 出现「击败它了」+ 顶部计数「已打倒 1 只怪」
 *  - 答错：verdict 出现「被打中了」+ 正确写法提示
 * 运行: node test/ui.battle.cdp.js  （先起 http 服务 8899）
 */
const { spawn } = require('child_process');
const http = require('http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9335;
const URL = 'http://127.0.0.1:8899/index.html';

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--user-data-dir=/tmp/wg-battle-' + Date.now(),
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
  await sleep(1800);

  /* 注入拼写驱动 */
  await ev(`window.__spell = function(){
    const m=document.querySelector('.zh')?.textContent.trim();
    if(!m) return 'nozh';
    const w=ALL_WORDS.find(x=>x.zh===m); if(!w) return 'nomatch:'+m;
    const ans=w.w.replace(/[\\s\\-']/g,'');
    const cur=[...document.querySelectorAll('#spell .slot')].map(s=>s.textContent.trim()).join('');
    if(cur.length>=ans.length){document.querySelector('#btn-ok').click(); return 'submit';}
    const b=[...document.querySelectorAll('#kb .key')].find(x=>x.textContent===ans[cur.length].toUpperCase());
    if(!b) return 'nokey:'+ans[cur.length].toUpperCase(); b.click(); return 'type';
  }`);

  check('首页单元数', await ev(`document.querySelectorAll('#units .unit-row').length`), 12);

  /* 进 Unit 1，跑完教学阶段 */
  await ev(`localStorage.removeItem('wordfarm_save_v1'); document.querySelectorAll('#units .unit-row')[0].click()`);
  await sleep(500);
  await ev(`var n=0; while(document.querySelector('#btn-next')&&n++<30) document.querySelector('#btn-next').click()`);
  await sleep(700);

  /* 像素战斗挂载 */
  check('battle-wrap 存在', await ev(`!!document.querySelector('#battle')`), true);
  check('battle canvas 存在', await ev(`!!document.querySelector('#battle canvas')`), true);
  check('canvas 有宽度', await ev(`(document.querySelector('#battle canvas')||{width:0}).width>0`), true);
  check('BATTLE 全局可用', await ev(`typeof BATTLE`), 'object');

  /* 第 1 词：逐字母输入（每字母触发 hit），提交应击杀 */
  const prog1 = await ev(`(function(){
    for(let i=0;i<60;i++){ const a=window.__spell(); if(a==='submit') return a; if(String(a).startsWith('nomatch')||String(a).startsWith('nokey')) return a; }
    return 'loop';
  })()`);
  check('逐字母输入到提交', prog1, 'submit');
  await sleep(250);
  check('答对 verdict=击败它了', await ev(`(document.querySelector('.verdict')?.textContent||'').indexOf('击败它了')>=0`), true);
  check('顶部计数已打倒 1 只怪', await ev(`(document.querySelector('.count')?.textContent||'').indexOf('已打倒 1 只怪')>=0`), true);

  /* 等切到下一词（错答等待 2200ms + 余量），填满长度但字母全错再提交 */
  await sleep(2600);
  const wrongResult = await ev(`(function(){
    const zh=document.querySelector('.zh')?.textContent.trim();
    const okBtn=document.querySelector('#btn-ok');
    if(!zh || !okBtn || okBtn.disabled) return 'not-ready';
    const all=ALL_WORDS.find(x=>x.zh===zh); if(!all) return 'nomatch:'+zh;
    const ans=all.w.replace(/[\\s\\-']/g,'');
    /* 单字母键里挑 ans 里没有的字母，全填成错的 */
    const need=new Set(ans.toUpperCase().split(''));
    const wrongKeys=[...document.querySelectorAll('#kb .key')]
      .filter(x=>x.textContent.length===1 && !need.has(x.textContent));
    const cur=[...document.querySelectorAll('#spell .slot')].map(s=>s.textContent.trim()).join('');
    if(cur.length>=ans.length){ document.querySelector('#btn-ok').click(); return 'submit-empty'; }
    for(let i=cur.length;i<ans.length&&i<wrongKeys.length;i++) wrongKeys[i % wrongKeys.length].click();
    document.querySelector('#btn-ok').click();
    return [...document.querySelectorAll('#spell .slot')].map(s=>s.textContent.trim()).join('');
  })()`);
  check('故意答错:提交完成', typeof wrongResult === 'string' && wrongResult.length > 0, true);
  await sleep(350);
  check('答错 verdict=被打中了', await ev(`(document.querySelector('.verdict')?.textContent||'').indexOf('被打中了')>=0`), true);
  check('答错显示正确写法', await ev(`(document.querySelector('.verdict .answer')?.textContent||'').length>0`), true);

  console.log(results.join('\n'));
  const f = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n===== ${results.length - f} passed, ${f} failed =====`);
  proc.kill(); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); try { proc.kill(); } catch (_) {} process.exit(2); });
