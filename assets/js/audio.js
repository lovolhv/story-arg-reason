/* ========== 哲学冥想音乐引擎 ==========
   极简钢琴 + 深沉氛围 Pad + 长混响空间。
   参考 Max Richter / 星际穿越 / 深夜认知类视频的听觉氛围。 */
const MusicBox = (() => {
  let ctx = null, master = null, reverb = null, delaySend = null, drone = null;
  let playing = false, timer = null, step = 0;

  // 低音区五声音阶（羽调式），更沉稳
  const SCALE = [
    55.00, 65.41, 73.42, 82.41, 98.00,      // A1 C2 D2 E2 G2
    110.00, 130.81, 146.83, 164.81, 196.00, // A2 C3 D3 E3 G3
    220.00, 261.63, 293.66, 329.63, 392.00, // A3 C4 D4 E4 G4
  ];

  // 极简和弦进行：Am - F - C - G，更慢更空旷
  const PROGRESSION = [
    [55.00, 82.41, 110.00, 164.81],   // Am 深沉
    [43.65, 65.41, 87.31, 130.81],    // F  辽阔
    [65.41, 98.00, 130.81, 196.00],   // C  温暖
    [49.00, 73.42, 98.00, 146.83],    // G  悠远
  ];

  function makeImpulse(seconds, decay) {
    const rate = ctx.sampleRate, len = rate * seconds;
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // 更复杂的早期反射 + 长尾衰减
        const t = i / rate;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (1 + 0.3 * Math.sin(t * 20));
      }
    }
    return buf;
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // 超长混响：6秒，营造大教堂/宇宙空间感
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(6.0, 3.5);
    const revGain = ctx.createGain(); revGain.gain.value = 0.65;
    reverb.connect(revGain); revGain.connect(master);

    // 延迟：附点四分音符，制造"回声-追问"感
    delaySend = ctx.createGain(); delaySend.gain.value = 0.22;
    const delay = ctx.createDelay(3); delay.delayTime.value = 0.72;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = "lowpass"; fbFilter.frequency.value = 1200;
    delay.connect(fbFilter); fbFilter.connect(fb); fb.connect(delay);
    delaySend.connect(delay); delay.connect(reverb);
    delaySend.connect(reverb);

    // 低音 Drone：持续不断的A1正弦波，像心跳/大地
    drone = ctx.createGain(); drone.gain.value = 0;
    const droneOsc = ctx.createOscillator();
    droneOsc.type = "sine"; droneOsc.frequency.value = 55;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass"; droneFilter.frequency.value = 200;
    droneOsc.connect(droneFilter); droneFilter.connect(drone); drone.connect(master);
    droneOsc.start();
  }

  // 冥想钢琴音：极慢 Attack，长衰减，像水滴入深潭
  function pluck(freq, when, vol, dur = 5.0, pan = 0) {
    const out = ctx.createGain();
    out.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; out.connect(p); p.connect(master); p.connect(delaySend); }
    else { out.connect(master); out.connect(delaySend); }

    // 基音 + 五度泛音 + 高八度微光
    [[1, 1], [1.5, 0.25], [2, 0.12], [3, 0.05]].forEach(([mult, amt]) => {
      const osc = ctx.createOscillator();
      osc.type = mult === 1 ? "sine" : "triangle";
      osc.frequency.value = freq * mult;
      const g = ctx.createGain(); g.gain.value = amt;
      osc.connect(g); g.connect(out);
      osc.start(when); osc.stop(when + dur + 0.5);
    });

    // 慢 Attack：0.8秒淡入，像从很远的地方传来
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(vol, when + 0.8);
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  }

  // 氛围 Pad：长音铺垫，制造"时间停滞"感
  function pad(freqs, when, dur, vol = 0.04) {
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = f;
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 400; filter.Q.value = 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vol * (1 - i * 0.2), when + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, when + dur);
      osc.connect(filter); filter.connect(g); g.connect(reverb); g.connect(master);
      osc.start(when); osc.stop(when + dur + 0.1);
    });
  }

  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 每小节 6.4 秒：极简、留白、深沉
  function scheduleBar() {
    if (!playing) return;
    const t = ctx.currentTime + 0.1;
    const chord = PROGRESSION[step % PROGRESSION.length];
    const barLen = 6.4;

    // 深层 Pad：整个小节的底色
    pad([chord[0], chord[1], chord[2]], t, barLen * 1.1, 0.035);

    // Drone 呼吸：随和弦微调
    if (drone) drone.gain.setTargetAtTime(0.04 + Math.sin(step * 0.5) * 0.01, t, 1.0);

    // 极简旋律：每小节只弹 1-3 个音，大量留白
    const density = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < density; i++) {
      // 偏向中低音区，更沉稳
      const f = rand(SCALE.slice(5, 12));
      const when = t + (barLen * 0.3) + (barLen * 0.4 * i / density) + Math.random() * 0.5;
      pluck(f, when, 0.08 + Math.random() * 0.04, 6.0, (Math.random() - 0.5) * 0.6);

      // 偶尔在高八度回应，像远处的星光
      if (Math.random() < 0.2) {
        const high = f * 2;
        pluck(high, when + 1.2, 0.03, 4.0, (Math.random() - 0.5) * 0.4);
      }
    }

    // 每四小节，一次深沉的低音脉冲
    if (step % 4 === 0) {
      pluck(chord[0], t, 0.12, 8.0, -0.3);
    }

    step++;
  }

  function start() {
    init();
    if (ctx.state === "suspended") ctx.resume();
    if (playing) return;
    playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.75, ctx.currentTime, 2.0);
    drone.gain.setTargetAtTime(0.05, ctx.currentTime, 2.0);
    scheduleBar();
    timer = setInterval(scheduleBar, 6400);
  }

  function stop() {
    if (!ctx || !playing) return;
    playing = false;
    clearInterval(timer);
    master.gain.setTargetAtTime(0, ctx.currentTime, 1.5);
    if (drone) drone.gain.setTargetAtTime(0, ctx.currentTime, 1.0);
  }

  return {
    toggle() {
      if (playing) { stop(); return false; }
      start(); return true;
    },
    get playing() { return playing; }
  };
})();
