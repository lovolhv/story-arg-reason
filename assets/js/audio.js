/* ========== 生成式背景音乐引擎 ==========
   五声音阶(宫商角徵羽)氛围音乐，类"千里之外"的舒缓纯音乐。
   全部由 Web Audio API 实时合成，无需音频文件。 */
const MusicBox = (() => {
  let ctx = null, master = null, reverb = null, delaySend = null;
  let playing = false, timer = null, step = 0;

  // A 羽调五声音阶：A C D E G（多八度展开）
  const SCALE = [
    110.00, 130.81, 146.83, 164.81, 196.00,          // A2 C3 D3 E3 G3
    220.00, 261.63, 293.66, 329.63, 392.00,          // A3 C4 D4 E4 G4
    440.00, 523.25, 587.33, 659.25, 783.99,          // A4 C5 D5 E5 G5
  ];
  // 和弦进行（根音 + 五声内色彩音），缓慢流转
  const PROGRESSION = [
    [110.00, 164.81, 220.00],  // Am 色彩
    [ 87.31, 130.81, 174.61],  // F  色彩
    [ 98.00, 146.83, 196.00],  // G  色彩
    [ 82.41, 123.47, 164.81],  // Em 色彩
  ];

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = rate * seconds;
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);

    // 混响
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(3.2, 2.6);
    const revGain = ctx.createGain(); revGain.gain.value = 0.5;
    reverb.connect(revGain); revGain.connect(master);

    // 回声（附点八分感觉）
    delaySend = ctx.createGain(); delaySend.gain.value = 0.28;
    const delay = ctx.createDelay(2); delay.delayTime.value = 0.46;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    delay.connect(fb); fb.connect(delay);
    delaySend.connect(delay); delay.connect(reverb);
    delaySend.connect(reverb);
  }

  // 琴音：基音 + 泛音，指数衰减
  function pluck(freq, when, vol, dur = 3.5, pan = 0) {
    const out = ctx.createGain();
    out.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; out.connect(p); p.connect(master); p.connect(delaySend); }
    else { out.connect(master); out.connect(delaySend); }

    [[1, 1], [2, 0.32], [3, 0.1]].forEach(([mult, amt]) => {
      const osc = ctx.createOscillator();
      osc.type = mult === 1 ? "sine" : "triangle";
      osc.frequency.value = freq * mult;
      const g = ctx.createGain(); g.gain.value = amt;
      osc.connect(g); g.connect(out);
      osc.start(when); osc.stop(when + dur + 0.1);
    });

    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vol, when + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  }

  // 低音长垫
  function pad(freq, when, dur, vol = 0.05) {
    const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(reverb); g.connect(master);
    osc.start(when); osc.stop(when + dur + 0.1);
  }

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 每小节 3.2s：低音垫 + 稀疏琶音
  function scheduleBar() {
    const t = ctx.currentTime + 0.08;
    const chord = PROGRESSION[step % PROGRESSION.length];
    const barLen = 3.2;

    pad(chord[0], t, barLen * 1.05, 0.055);
    pad(chord[1], t + 0.4, barLen * 0.9, 0.028);

    // 主旋律：五声音阶随机漫步，偏中高音区
    const density = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < density; i++) {
      const when = t + (barLen / density) * i + Math.random() * 0.25;
      const f = rand(SCALE.slice(6, 15));
      pluck(f, when, 0.11 + Math.random() * 0.05, 3.2, (Math.random() - 0.5) * 0.7);
      // 偶尔叠一个五度回应音
      if (Math.random() < 0.3) {
        const up = SCALE[SCALE.indexOf(f) + 2];
        if (up) pluck(up, when + 0.32, 0.05, 2.6, (Math.random() - 0.5) * 0.5);
      }
    }
    // 每两小节一次低音拨弦
    if (step % 2 === 0) pluck(chord[0] * 2, t + 0.02, 0.09, 3.8, -0.2);

    step++;
  }

  function start() {
    init();
    if (ctx.state === "suspended") ctx.resume();
    if (playing) return;
    playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.85, ctx.currentTime, 1.2);
    scheduleBar();
    timer = setInterval(scheduleBar, 3200);
  }

  function stop() {
    if (!ctx || !playing) return;
    playing = false;
    clearInterval(timer);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
  }

  return {
    toggle() {
      if (playing) { stop(); return false; }
      start(); return true;
    },
    get playing() { return playing; }
  };
})();
