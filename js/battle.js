/* ============================================================
 * 战斗舞台
 *  - 玩家（宠物）在左，单词怪物在右
 *  - 答对 = 玩家攻击，怪物扣血并抖动
 *  - 答错 = 怪物反击，玩家扣血、屏幕震动
 *  - 玩家血量归零 -> 战斗失败；怪物血量归零 -> 本词击败
 * 用法：Battle.mount(el, opts) / Battle.hitMonster(dmg) /
 *       Battle.hitPlayer(dmg, onDeath) / Battle.reset(word)
 * ============================================================ */

const Battle = (() => {
  let root = null, ui = null, st = null;

  const pct = (v, max) => Math.max(0, Math.min(100, (v / max) * 100));

  function mount(el, opts) {
    root = el;
    const startHp = (opts.initialHp != null) ? opts.initialHp : opts.monsterMax;
    st = {
      playerHp: 100, playerMax: 100,
      monsterHp: startHp, monsterMax: opts.monsterMax,
      monsterEmo: opts.monsterEmo, monsterName: opts.monsterName,
      playerEmo: opts.playerEmo, playerName: opts.playerName,
      monsterDead: startHp <= 0, playerDead: false,
    };

    root.innerHTML = `
      <div class="arena" id="arena">
        <div class="arena-sky"></div>

        <div class="fighter player" id="f-player">
          <div class="f-sprite">${opts.playerEmo}</div>
          <div class="f-tag">${opts.playerName}</div>
          <div class="hpbar"><i id="p-hp"></i></div>
          <div class="hpnum" id="p-num">100</div>
        </div>

        <div class="arena-mid">
          <div class="vs">VS</div>
        </div>

        <div class="fighter monster" id="f-monster">
          <div class="f-sprite">${opts.monsterEmo}</div>
          <div class="f-tag">${opts.monsterName}</div>
          <div class="hpbar monster"><i id="m-hp"></i></div>
          <div class="hpnum" id="m-num">${opts.monsterMax}</div>
        </div>

        <div class="arena-floor"></div>
        <div class="fx-layer" id="fx"></div>
      </div>
    `;

    ui = {
      arena: root.querySelector('#arena'),
      player: root.querySelector('#f-player'),
      monster: root.querySelector('#f-monster'),
      pHp: root.querySelector('#p-hp'),
      mHp: root.querySelector('#m-hp'),
      pNum: root.querySelector('#p-num'),
      mNum: root.querySelector('#m-num'),
      fx: root.querySelector('#fx'),
    };
    sync();
  }

  function sync() {
    ui.pHp.style.width = pct(st.playerHp, st.playerMax) + '%';
    ui.mHp.style.width = pct(st.monsterHp, st.monsterMax) + '%';
    ui.pNum.textContent = Math.max(0, st.playerHp);
    ui.mNum.textContent = Math.max(0, st.monsterHp);
    ui.pHp.parentElement.classList.toggle('low', st.playerHp <= 30);
    ui.mHp.parentElement.classList.toggle('low', st.monsterHp <= 30);
  }

  /* 伤害飘字：'good' 绿色在怪物头顶，'bad' 红色在玩家头顶 */
  function floatDmg(who, dmg, crit) {
    const d = document.createElement('div');
    d.className = 'dmg ' + (who === 'monster' ? 'dmg-good' : 'dmg-bad');
    d.textContent = '-' + dmg + (crit ? ' 会心!' : '');
    ui.fx.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  function playOnce(node, cls, ms) {
    node.classList.remove(cls);
    /* 强制回流以便重复触发同一动画 */
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  }

  function shake() {
    playOnce(ui.arena, 'shake', 500);
  }

  /* ---- 对外动作 ---- */

  /* 玩家攻击：怪物扣血，返回怪物是否被击败 */
  function hitMonster(dmg, crit) {
    if (st.monsterDead) return true;
    st.monsterHp = Math.max(0, st.monsterHp - dmg);
    floatDmg('monster', dmg, crit);
    playOnce(ui.player, 'lunge-r', 420);
    playOnce(ui.monster, 'hurt', 460);
    sync();
    if (st.monsterHp <= 0) {
      st.monsterDead = true;
      playOnce(ui.monster, 'die', 700);
    }
    return st.monsterHp <= 0;
  }

  /* 怪物攻击：玩家扣血，血量归零时回调 */
  function hitPlayer(dmg, onDeath) {
    if (st.playerDead) return;
    st.playerHp = Math.max(0, st.playerHp - dmg);
    floatDmg('player', dmg, false);
    playOnce(ui.monster, 'lunge-l', 420);
    playOnce(ui.player, 'hurt', 460);
    shake();
    sync();
    if (st.playerHp <= 0) {
      st.playerDead = true;
      playOnce(ui.player, 'die', 700);
      if (onDeath) setTimeout(onDeath, 700);
    }
  }

  /* 换一只新怪（每个单词一个） */
  function reset(newEmoji, newName, maxHp) {
    st.monsterHp = maxHp;
    st.monsterMax = maxHp;
    st.monsterDead = false;
    ui.monster.querySelector('.f-sprite').textContent = newEmoji;
    ui.monster.querySelector('.f-tag').textContent = newName;
    ui.mHp.parentElement.classList.remove('low');
    playOnce(ui.monster, 'enter', 420);
    sync();
  }

  /* 玩家形态变化（宠物进化时） */
  function setPlayer(emoji, name) {
    ui.player.querySelector('.f-sprite').textContent = emoji;
    ui.player.querySelector('.f-tag').textContent = name;
  }

  function state() { return st; }

  return { mount, hitMonster, hitPlayer, reset, setPlayer, state };
})();
