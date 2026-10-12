/* ============================================================
 * 打怪联动（我的世界像素风）
 *  拼写舞台顶部的小战场：拼对一个字母 = 挥剑砍一刀，
 *  提交正确 = 直接把怪打倒，答错 = 怪冲过来打你（掉心）。
 *  纯 Canvas 像素绘制，零依赖。
 *
 *  用法：
 *    const b = BATTLE.mount(容器, { theme:'day'|'night', challenge, hearts });
 *    b.spawn(word);   // 出一只怪，血量 = 字母数 + 2
 *    b.hit();         // 输入一个字母：砍一刀
 *    b.heal();        // 删掉一个字母：血条回涨
 *    b.defeat();      // 提交正确：怪倒地
 *    b.hurt();        // 提交错误：怪攻击玩家
 *    b.setHearts(n);  // 同步剩余心（挑战模式）
 *    b.destroy();     // 卸载（离开拼写界面必须调用）
 * ============================================================ */

const BATTLE = (() => {
  const W = 320, H = 120;      // 画布内部分辨率（CSS 放大 + pixelated 保持马赛克感）
  const GY = 92;               // 地面线（脚底 y）
  const P_X = 54;              // 玩家中心 x
  const M_X = 240;             // 怪物中心 x

  /* ---------------- 像素图（. 表示透明） ---------------- */

  /* 僵尸 16×18 */
  const ZOMBIE = {
    name: '僵尸', bar: '#62b34a',
    mat: [
      ".....gggggg.....",
      "....gggggggg....",
      "....gzzggzzg....",
      "....gzzggzzg....",
      "....gggggggg....",
      "....gzzzzzzg....",
      "....gggggggg....",
      "....gggggggg....",
      "...TTTTTTTTTT...",
      "..gTTTTTTTTTTg..",
      "..gTTTBBBBTTTg..",
      "..gTTTBBBBTTTg..",
      "..gTTTTTTTTTTg..",
      "...TTTTTTTTTT...",
      "...pppp..pppp...",
      "...pppp..pppp...",
      "...pppp..pppp...",
      "...kkkk..kkkk...",
    ],
    pal: { g: '#5b8c33', z: '#191919', T: '#00a2a2', B: '#007a7a', p: '#3a3ba0', k: '#23233f' },
  };

  /* 苦力怕 16×18 */
  const CREEPER = {
    name: '苦力怕', bar: '#7ed957',
    mat: [
      "......gggg......",
      "....gggggggg....",
      "...gggggggggg...",
      "...ggzzggzzgg...",
      "...ggzzggzzgg...",
      "...gggggggggg...",
      "...gggggggggg...",
      "...ggzzzzzzgg...",
      "...ggzggggzgg...",
      "...ggzggggzgg...",
      "...ggzzzzzzgg...",
      "....zzzzzzzz....",
      "..gGGggGGGGggg..",
      "...GggGGggGGG...",
      "...GgggGGGggg...",
      "..Ggg.gggg.ggG..",
      ".kk..........kk.",
      ".kk..........kk.",
    ],
    pal: { g: '#4e9c33', G: '#3d7a28', z: '#16230c', k: '#2c4a1e' },
  };

  /* 蜘蛛 16×13 */
  const SPIDER = {
    name: '蜘蛛', bar: '#c0453b',
    mat: [
      "................",
      "................",
      "..r..........r..",
      "..rr..bbbb..rr..",
      "..r.bbbbbbbb.r..",
      "..r.bbbbbbbb.r..",
      "vvv.bbbbbbbb.vvv",
      ".vv.bbbbbbbb.vv.",
      "vv..bbbbbbbb..vv",
      ".vv.bbbbbbbb.vv.",
      "..v.bbbbbbbb.v..",
      "....bbbbbbbb....",
      "...kk....kk.....",
    ],
    pal: { b: '#241d26', r: '#d63a2f', v: '#1a1420', k: '#14101a' },
  };

  /* 骷髅 16×16 */
  const SKELETON = {
    name: '骷髅', bar: '#d8d4c4',
    mat: [
      ".....WWWWWW.....",
      "....WWWWWWWW....",
      "....WkkWWkkW....",
      "....WkkWWkkW....",
      "....WWWWWWWW....",
      "....WkkkkkkW....",
      "....WWWWWWWW....",
      "....W.WW.WW.W...",
      "...WWWWWWWWWW...",
      "..WW.WWWWWW.WW..",
      "..WW.WWWWWW.WW..",
      "...WWWWWWWWWW...",
      "....WWWWWWWW....",
      ".....WW..WW.....",
      ".....WW..WW.....",
      ".....WW..WW.....",
    ],
    pal: { W: '#e8e6da', k: '#1c1c1c' },
  };

  /* 末影人 12×20 */
  const ENDERMAN = {
    name: '末影人', bar: '#b24bf3',
    mat: [
      "....AAAA....",
      "...AAAAAA...",
      "...AAAAAA...",
      "...AppppA...",
      "...AppppA...",
      "...AAAAAA...",
      "...AAAAAA...",
      "..AAAAAAAA..",
      "..AAAAAAAA..",
      "....AAAA....",
      "....AAAA....",
      "....AAAA....",
      "...A.AA.A...",
      "...A.AA.A...",
      "...A.AA.A...",
      "...A.AA.A...",
      "...A.AA.A...",
      "...A.AA.A...",
      "...AA..AA...",
      "...AA..AA...",
    ],
    pal: { A: '#16161e', p: '#b24bf3' },
  };

  /* 玩家（小史蒂夫风）14×20 */
  const PLAYER = {
    mat: [
      ".....HHHH.....",
      "....HHHHHH....",
      "....HHHHHH....",
      "....SSSSSS....",
      "...SkkSSkkS...",
      "....SSSSSS....",
      "....SSmmSS....",
      "....SSSSSS....",
      "..TTTTTTTTTT..",
      ".STTTTTTTTTTS.",
      ".STTTTTTTTTTS.",
      ".STTTBBBBTTTS.",
      ".STTTBBBBTTTS.",
      "..TTTTTTTTTT..",
      "..pppppppppp..",
      "..pppp..pppp..",
      "..pppp..pppp..",
      "..pppp..pppp..",
      "..kkkk..kkkk..",
      "..kkkk..kkkk..",
    ],
    pal: { H: '#4a3524', S: '#c89b6a', k: '#262626', m: '#8a5f3d', T: '#2f8f9d', B: '#1f6b78', p: '#3c4a8c' },
  };

  /* 心 7×6 */
  const HEART_FULL = [
    ".rr.rr.",
    "rrrrrrr",
    "rhrrrrr",
    ".rrrrr.",
    "..rrr..",
    "...r...",
  ];
  const HEART_EMPTY = [
    ".kk.kk.",
    "kkkkkkk",
    "kkkkkkk",
    ".kkkkk.",
    "..kkk..",
    "...k...",
  ];
  const HEART_PAL = { r: '#d64545', h: '#ff9a9a', k: '#565663' };

  /* 像素字样：KO! */
  const GLYPH = {
    K: ["#.#", "#.#", "##.", "#.#", "#.#"],
    O: ["###", "#.#", "#.#", "#.#", "###"],
    '!': [".#.", ".#.", ".#.", "...", ".#."],
  };

  /* 白天 / 夜晚（迷雾试炼）配色 */
  const DAY = {
    sky: '#79b8ff', sky2: '#a9d6ff',
    cloud: '#ffffff', cloudS: '#e2f1ff',
    hill: '#6fae4a', hillS: '#5d9a3c',
    grass: '#5f9e38', grassS: '#4c852c',
    dirt: '#7a5636', dirtS: '#654527',
    sun: true, stars: false,
  };
  const NIGHT = {
    sky: '#241d47', sky2: '#3a2f63',
    cloud: '#4a3f73', cloudS: '#3d3261',
    hill: '#22304a', hillS: '#1a2539',
    grass: '#2f5130', grassS: '#243f27',
    dirt: '#4a3524', dirtS: '#3b2a1c',
    sun: false, stars: true,
  };

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
    return h;
  }

  /* ---------------- 战斗实例 ---------------- */

  function mount(host, opts) {
    const o = Object.assign({ theme: 'day', challenge: false, hearts: 3 }, opts || {});
    const theme = o.theme === 'night' ? NIGHT : DAY;

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = false;

    /* 场景装饰（云 / 草皮杂点） */
    const clouds = [];
    for (let i = 0; i < 4; i++) {
      clouds.push({ x: (i * 97 + 30) % W, y: 12 + (i * 23) % 26, w: 26 + (i * 7) % 22, h: 7, v: 0.6 + (i % 3) * 0.35 });
    }
    const speck = [];
    for (let i = 0; i < 46; i++) {
      speck.push({ x: (i * 37 + 11) % W, y: GY + 6 + ((i * 13) % (H - GY - 8)), c: i % 2 });
    }

    const st = {
      t: 0, lastDt: 0.016, mob: null,
      hp: 1, hpMax: 1, hpShow: 1,
      flash: 0, shake: 0, pFlash: 0,
      swing: -1, spawnT: -1, dying: -1, attack: -1, gone: false,
      hearts: o.hearts, parts: [], texts: [], dead: false,
    };
    const anims = [];

    /* ---------- 绘制基元 ---------- */
    function px(x, y, w, h, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    }

    /* 按字符矩阵画像素画；tint 非空时整块染成该色（受击闪白） */
    function sprite(mat, pal, cx, bottom, s, tint) {
      const w = mat[0].length * s, h = mat.length * s;
      const x0 = Math.round(cx - w / 2), y0 = Math.round(bottom - h);
      for (let r = 0; r < mat.length; r++) {
        const row = mat[r];
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (ch === '.' || ch === ' ') continue;
          px(x0 + c * s, y0 + r * s, s, s, tint || pal[ch] || '#ff00ff');
        }
      }
    }

    function drawBg(dt) {
      px(0, 0, W, GY, theme.sky);
      if (theme.sun) {
        px(W - 46, 10, 12, 12, '#ffe066');
        px(W - 44, 8, 8, 16, '#ffe066');
        px(W - 48, 12, 16, 8, '#ffe066');
      }
      if (theme.stars) {
        px(40, 10, 10, 10, '#e8e4f5');
        px(34, 12, 22, 6, '#e8e4f5');
        px(37, 8, 14, 14, '#e8e4f5');
        for (let i = 0; i < 14; i++) {
          px((i * 53 + 7) % W, (i * 29) % 40, 1, 1, i % 3 ? '#ffffff' : '#cbbfe8');
        }
      }
      clouds.forEach((c) => {
        c.x -= c.v * dt * 30;
        if (c.x < -c.w) c.x = W + 4;
        px(c.x, c.y, c.w, c.h, theme.cloud);
        px(c.x + 5, c.y - 4, c.w - 12, 5, theme.cloud);
        px(c.x + c.w - 7, c.y, 7, 6, theme.cloudS);
      });
      /* 远处方块山 */
      px(0, GY - 20, 60, 20, theme.hillS);
      px(60, GY - 30, 46, 30, theme.hill);
      px(106, GY - 16, 52, 16, theme.hillS);
      px(158, GY - 26, 40, 26, theme.hill);
      px(198, GY - 14, 60, 14, theme.hillS);
      px(258, GY - 24, 62, 24, theme.hill);
      /* 地面：草皮 + 泥土 */
      px(0, GY, W, H - GY, theme.dirt);
      px(0, GY, W, 4, theme.grass);
      px(0, GY + 4, W, 2, theme.grassS);
      for (let x = 0; x < W; x += 8) px(x, GY + 2, 1, 2, theme.grassS);
      speck.forEach((p) => px(p.x, p.y, 3, 2, p.c ? theme.dirtS : theme.grassS));
    }

    /* 玩家的剑（绕手部旋转挥砍） */
    function drawSword() {
      const angle = st.swing >= 0 ? st.swing * 2.4 - 1.3 : -0.55;
      ctx.save();
      ctx.translate(P_X + 13, GY - 24);
      ctx.rotate(angle);
      px(1, -24, 4, 18, '#c3cad4');
      px(1, -26, 4, 2, '#eef2f7');
      px(0, -6, 6, 3, '#6b4a24');
      px(2, -3, 2, 6, '#3a2a18');
      ctx.restore();
    }

    function drawPlayer() {
      const bob = Math.abs(Math.sin(st.t * 2)) * 1;
      const flash = st.pFlash > 0 && (Math.floor(st.pFlash * 20) % 2 === 0);
      sprite(PLAYER.mat, PLAYER.pal, P_X, GY + bob, 2, flash ? '#ff8a7a' : null);
      drawSword();
      /* 挑战模式：头顶 3 颗心 */
      if (o.challenge) {
        for (let i = 0; i < 3; i++) {
          const m = i < st.hearts ? HEART_FULL : HEART_EMPTY;
          sprite(m, HEART_PAL, P_X + (i - 1) * 17, GY - 52, 2);
        }
      }
    }

    function drawMob() {
      if (!st.mob || st.gone) return;
      const m = st.mob;
      let s = 3, bob = Math.sin(st.t * 2.4) * 1.5, yOff = 0, xOff = 0, alpha = 1;

      if (st.spawnT >= 0) {
        s = 3 * (0.4 + 0.6 * Math.min(1, st.spawnT * 3));
        alpha = Math.min(1, st.spawnT * 3);
      }
      if (st.attack >= 0) {
        xOff = st.attack < 0.35 ? -(st.attack / 0.35) * 74
          : st.attack < 0.5 ? -74
            : -74 * (1 - (st.attack - 0.5) / 0.5);
      }
      ctx.globalAlpha = alpha;

      if (st.dying >= 0 && st.dying < 0.45) {
        /* 倒地前：闪白 */
        if (Math.floor(st.dying * 18) % 2 === 0) {
          sprite(m.mat, m.pal, M_X + xOff, GY + yOff + bob, s, '#ffffff');
        } else {
          sprite(m.mat, m.pal, M_X + xOff, GY + yOff + bob, s, st.flash > 0 ? '#ffffff' : null);
        }
      } else if (st.dying >= 0) {
        /* 倒地：翻出去 + 淡出 */
        const q = (st.dying - 0.45) / 0.55;
        sprite(m.mat, m.pal, M_X + xOff + q * 14, GY + yOff + q * 46, s, null);
      } else {
        sprite(m.mat, m.pal, M_X + xOff, GY + yOff + bob, s, st.flash > 0 ? '#ffffff' : null);
      }
      ctx.globalAlpha = 1;
    }

    /* Boss 血条 */
    function drawBar() {
      if (!st.mob || st.gone || st.dying >= 0) return;
      const bw = 120, bh = 10;
      const x = M_X - bw / 2, y = 8;
      px(x - 3, y - 3, bw + 6, bh + 6, '#2b2b38');
      px(x - 1, y - 1, bw + 2, bh + 2, '#1b1b24');
      const n = 10, seg = (bw - (n - 1) * 2) / n;
      for (let i = 0; i < n; i++) {
        px(x + i * (seg + 2), y, seg, bh, i / n < st.hpShow / st.hpMax ? st.mob.bar : '#3c3444');
      }
    }

    function drawGlyphs(text, x, y, a) {
      ctx.globalAlpha = a;
      let cx = x;
      for (const ch of text) {
        const g = GLYPH[ch];
        if (!g) { cx += 8; continue; }
        for (let r = 0; r < g.length; r++) {
          for (let c = 0; c < 3; c++) {
            if (g[r][c] === '#') px(cx + c * 2, y + r * 2, 2, 2, '#ffffff');
          }
        }
        cx += 9;
      }
      ctx.globalAlpha = 1;
    }

    function drawFx() {
      st.parts.forEach((p) => px(p.x, p.y, p.s, p.s, p.c));
      st.texts.forEach((t) => drawGlyphs(t.text, t.x, t.y, t.a));
    }

    /* ---------- 动画 ---------- */
    function anim(dur, fn) { const a = { t: 0, dur, fn }; anims.push(a); }
    function later(ms, fn) { setTimeout(() => { if (!st.dead) fn(); }, ms); }

    function burst(x, y, n, colors, spd, grav) {
      for (let i = 0; i < n; i++) {
        st.parts.push({
          x, y,
          vx: (Math.random() - 0.5) * spd,
          vy: -Math.random() * spd * 0.8 - 6,
          g: grav, s: Math.random() < 0.5 ? 2 : 3,
          life: 0.5 + Math.random() * 0.5,
          c: colors[i % colors.length],
        });
      }
    }

    function pickMob(word) {
      const list = o.challenge
        ? [SPIDER, SKELETON, ENDERMAN, CREEPER]
        : [ZOMBIE, CREEPER, SPIDER, SKELETON];
      return list[hash(String(word.id || word.w || word)) % list.length];
    }

    /* ---------- 对外动作 ---------- */
    function spawn(word) {
      st.mob = pickMob(word);
      st.hpMax = word.w.length + 2;
      st.hp = st.hpMax;
      st.hpShow = st.hpMax;
      st.dying = -1; st.gone = false; st.attack = -1; st.flash = 0;
      anim(0.32, (p) => { st.spawnT = p >= 1 ? -1 : p; });
      burst(M_X, GY - 24, 12, ['#ffffff', '#e8e8f0', '#c8c8d8'], 3.2, 2);
      if (typeof Audio !== 'undefined' && Audio.spawn) Audio.spawn();
    }

    function hit() {
      if (st.dying >= 0 || st.gone) return;
      st.swing = 0;
      st.flash = 0.14;
      st.shake = 0.16;
      st.hp = Math.max(1, st.hp - 1);
      burst(M_X - 18, GY - 40, 5, ['#ffffff', '#ffe066', '#ffd43d'], 2.6, 3);
      if (typeof Audio !== 'undefined' && Audio.swing) Audio.swing();
    }

    function heal() {
      if (st.dying >= 0 || st.gone) return;
      st.hp = Math.min(st.hpMax, st.hp + 1);
    }

    function defeat() {
      if (!st.mob || st.dying >= 0 || st.gone) return;
      st.dying = 0;
      anim(1, (p) => { st.dying = p; });
      burst(M_X, GY - 30, 10, [st.mob.bar, '#ffffff', '#ffe066'], 3.4, 3);
      burst(M_X, GY - 20, 8, ['#ffd43d', '#f4a300', '#fff3bf'], 2.6, 4);
      st.texts.push({ text: 'KO!', x: M_X - 15, y: 30, a: 1, vy: -0.3, life: 1.2 });
      if (typeof Audio !== 'undefined' && Audio.ko) Audio.ko();
    }

    function hurt() {
      if (st.dying >= 0 || st.gone || st.attack >= 0) return;
      st.attack = 0;
      st.shake = 0.3;
      st.pFlash = 0.4;
      anim(0.3, (p) => { st.attack = p >= 1 ? -1 : p; });
      later(240, () => burst(P_X + 14, GY - 44, 8, ['#ff8787', '#ffd43d', '#ffffff'], 3, 3));
      /* 满血复活 */
      later(640, () => { st.hp = st.hpMax; });
      if (typeof Audio !== 'undefined' && Audio.hurt) Audio.hurt();
    }

    function setHearts(n) { st.hearts = Math.max(0, Math.min(3, n)); }

    /* ---------- 主循环 ---------- */
    function update(dt) {
      st.t += dt;
      if (st.flash > 0) st.flash -= dt;
      if (st.shake > 0) st.shake -= dt;
      if (st.pFlash > 0) st.pFlash -= dt;
      if (st.swing >= 0) { st.swing += dt / 0.16; if (st.swing > 1) st.swing = -1; }
      /* 血条缓动 */
      st.hpShow += (st.hp - st.hpShow) * Math.min(1, dt * 10);

      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i];
        a.t += dt;
        const p = Math.min(1, a.t / a.dur);
        a.fn(p);
        if (p >= 1) anims.splice(i, 1);
      }

      st.parts = st.parts.filter((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= dt;
        return p.life > 0;
      });
      st.texts = st.texts.filter((t) => {
        t.y += t.vy; t.life -= dt; t.a = Math.max(0, t.life);
        return t.life > 0;
      });
    }

    function draw() {
      ctx.save();
      if (st.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      drawBg(st.lastDt);
      drawMob();
      drawPlayer();
      drawBar();
      drawFx();
      if (st.pFlash > 0) {
        ctx.globalAlpha = Math.min(0.4, st.pFlash);
        px(0, 0, W, H, '#ff4d4d');
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    let raf = 0, last = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      st.lastDt = dt;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function destroy() {
      cancelAnimationFrame(raf);
      anims.length = 0;
      st.parts.length = 0;
      st.texts.length = 0;
      st.dead = true;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    return { spawn, hit, heal, defeat, hurt, setHearts, destroy };
  }

  return { mount };
})();
