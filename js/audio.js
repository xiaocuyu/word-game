/* ============================================================
 * 音频：单词发音（浏览器 TTS）+ 音效（WebAudio）
 * TTS 不可用时静默降级，不影响游戏进行。
 * ============================================================ */

const Audio = (() => {
  let ctx = null;
  let voice = null;
  let ttsOk = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';

  function pickVoice() {
    if (!ttsOk) return;
    const vs = window.speechSynthesis.getVoices();
    if (!vs.length) return;
    voice =
      vs.find((v) => /en[-_]US/i.test(v.lang) && /google|samantha|natural|premium/i.test(v.name)) ||
      vs.find((v) => /en[-_]US/i.test(v.lang)) ||
      vs.find((v) => /^en/i.test(v.lang)) ||
      vs[0];
  }

  if (ttsOk) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  /* 读单词；repeat>1 时慢速跟读 */
  function say(text, rate) {
    if (!ttsOk) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate == null ? 0.85 : rate;
      u.pitch = 1.05;
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    } catch (e) { /* 忽略 */ }
  }

  function beep(freq, dur, type, gain) {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = gain == null ? 0.08 : gain;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime;
      o.start(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
      o.stop(t + (dur || 0.12) + 0.02);
    } catch (e) { /* 忽略 */ }
  }

  return {
    say,
    hasTTS: () => ttsOk,
    correct() { beep(660, 0.1, 'sine', 0.09); setTimeout(() => beep(880, 0.16, 'sine', 0.09), 90); },
    wrong() { beep(220, 0.18, 'triangle', 0.07); },
    hint() { beep(520, 0.08, 'sine', 0.06); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'sine', 0.09), i * 130)); },
    star() { beep(1180, 0.07, 'square', 0.045); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'triangle', 0.07), i * 150)); },
  };
})();
