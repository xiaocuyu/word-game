/* 用 Chrome 无头 + CDP 驱动页面，验证战斗界面与攻受击 */
const { spawn } = require('child_process');
const http = require('http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const URL = 'http://127.0.0.1:8899/index.html';

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--user-data-dir=/tmp/wg-chrome-' + Date.now(),
  `--remote-debugging-port=${PORT}`,
  '--window-size=900,1400',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

(async () => {
  let targets = null;
  for (let i = 0; i < 30; i++) {
    try { targets = (await get('/json/list')).filter((t) => t.type === 'page'); if (targets.length) break; } catch (e) {}
    await sleep(300);
  }
  if (!targets || !targets.length) throw new Error('CDP 未就绪');

  /* Node 22 内置全局 WebSocket */
  const WebSocket = globalThis.WebSocket;
  if (!WebSocket) throw new Error('NO_WS');

  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  await send('Page.navigate', { url: URL });
  await sleep(1800);

  const results = [];
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  };

  /* ---- 首页 ---- */
  check('单元数', await evalJs(`document.querySelectorAll('#units .unit-row').length`), 12);

  /* ---- 进入 Unit 1，跑完教学阶段 ---- */
  await evalJs(`localStorage.removeItem('wordfarm_save_v1'); document.querySelectorAll('#units .unit-row')[0].click()`);
  await sleep(500);
  await evalJs(`var n=0; while(document.querySelector('#btn-next') && n++<30) document.querySelector('#btn-next').click()`);
  await sleep(600);

  /* ---- 战斗舞台渲染 ---- */
  check('arena 存在', await evalJs(`!!document.querySelector('.arena')`), true);
  check('玩家精灵非空', await evalJs(`(document.querySelector('.fighter.player .f-sprite')||{}).textContent?.length>0`), true);
  check('怪物精灵非空', await evalJs(`(document.querySelector('.fighter.monster .f-sprite')||{}).textContent?.length>0`), true);
  check('怪物标签=中文词义', await evalJs(`document.querySelector('.fighter.monster .f-tag').textContent`), await evalJs(`(function(){const zh=document.querySelector('.zh,.count').textContent.match(/「(.+)」/);return zh?zh[1]:''})()`));
  const mMax = await evalJs(`Number(document.querySelector('#m-num').textContent)`);
  check('怪物血量>0', mMax > 0, true);
  check('玩家满血100', await evalJs(`Number(document.querySelector('#p-num').textContent)`), 100);
  check('出招按钮文案', await evalJs(`document.querySelector('#btn-ok').textContent`), '⚔️ 出招');

  /* ---- 答对 -> 怪物掉血（立即读反馈，勿等自动切题） ---- */
  const hpBefore = await evalJs(`Number(document.querySelector('#m-num').textContent)`);
  await evalJs(`(function(){
    const zh=(document.querySelector('.count').textContent.match(/「(.+)」/)||[])[1];
    const w=ALL_WORDS.find(x=>x.zh===zh); if(!w) return 'nomatch';
    const ans=w.w.replace(/[\\s\\-']/g,'');
    for(const ch of ans){const n=ch.toUpperCase();const b=[...document.querySelectorAll('#kb .key')].find(x=>x.textContent===n); if(b)b.click();}
    document.querySelector('#btn-ok').click(); return ans;
  })()`);
  /* 立刻读：此时 verdict / combo / 飘字都在 */
  await sleep(250);
  check('答对立即出现命中反馈', await evalJs(`(document.querySelector('.verdict')?.textContent||'').match(/命中|击败/)?true:false`), true);
  check('答对立即有连对标记', await evalJs(`/连对/.test(document.querySelector('#combo')?.textContent||'')`), true);
  check('答对立即有伤害飘字', await evalJs(`!!document.querySelector('.dmg-good')`), true);
  /* 等自动切题后再验证血条 */
  await sleep(1000);
  const hpAfter = await evalJs(`Number(document.querySelector('#m-num').textContent)`);
  check('答对后怪物掉血/换新怪', hpAfter !== hpBefore, true);
  check('答对后玩家不掉血', await evalJs(`Number(document.querySelector('#p-num').textContent)`), 100);

  /* ---- 答错 -> 玩家掉血（立即读，飘字 900ms 后消失） ---- */
  await sleep(300);
  const pHpBefore = await evalJs(`Number(document.querySelector('#p-num').textContent)`);
  await evalJs(`(function(){
    const zh=(document.querySelector('.count').textContent.match(/「(.+)」/)||[])[1];
    const w=ALL_WORDS.find(x=>x.zh===zh); if(!w) return;
    const ans=w.w.replace(/[\\s\\-']/g,'');
    let bad='z'.repeat(ans.length);
    for(const ch of bad){const n=ch.toUpperCase();const b=[...document.querySelectorAll('#kb .key')].find(x=>x.textContent===n); if(b)b.click(); else {const a=[...document.querySelectorAll('#kb .key')].filter(x=>x.textContent.length===1);a[0].click();}}
    document.querySelector('#btn-ok').click();
  })()`);
  await sleep(250);
  check('答错立即出现受击飘字', await evalJs(`!!document.querySelector('.dmg-bad')`), true);
  await sleep(900);
  check('答错后玩家掉血', await evalJs(`Number(document.querySelector('#p-num').textContent)`) < pHpBefore, true);
  check('答错显示正确拼写', await evalJs(`document.querySelector('.verdict .answer')?.textContent?.length>0`), true);
  check('连对被清空', await evalJs(`document.querySelector('#combo')?.textContent`), '');

  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n===== ${results.length - failed} passed, ${failed} failed =====`);

  proc.kill();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); proc.kill(); process.exit(2); });
