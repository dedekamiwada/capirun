// Sons gerados na hora com Web Audio — nenhum arquivo de áudio, tudo original e editável.
window.Sound = (() => {
  const V = Object.assign({ master: 0.6, music: 0.35, sfx: 0.8 }, window.CONFIG.sound);
  let ctx, master, musicBus, sfxBus, noiseBuf, timer, step = 0, nextTime = 0, tempo = 128;
  let muted = false;
  try { muted = localStorage.getItem("capivara-mute") === "1"; } catch {}

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : V.master; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = V.music; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = V.sfx; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // ---------- primitivas ----------
  function tone(f, dur, { type = "square", vol = 0.3, to, at = 0, bus = sfxBus, attack = 0.005 } = {}) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.3, freq = 2000, to, type = "lowpass", at = 0, bus = sfxBus } = {}) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }

  // ---------- efeitos ----------
  const SFX = {
    coin()   { tone(1320, 0.06, { vol: 0.12 }); tone(1980, 0.12, { vol: 0.12, at: 0.05 }); },
    jump()   { tone(260, 0.18, { type: "sine", vol: 0.35, to: 720 }); },
    roll()   { noise(0.25, { vol: 0.35, freq: 3000, to: 300 }); },
    lane()   { noise(0.08, { vol: 0.18, freq: 1500, type: "highpass" }); },
    power()  { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, { type: "triangle", vol: 0.25, at: i * 0.06 })); },
    crash()  { noise(0.45, { vol: 0.6, freq: 1200, to: 80 }); tone(180, 0.35, { type: "sawtooth", vol: 0.3, to: 45 }); },
    break()  { tone(900, 0.3, { type: "triangle", vol: 0.3, to: 150 }); noise(0.2, { vol: 0.25, freq: 4000, type: "highpass" }); },
    horn()   { for (const f of [233, 294, 349]) tone(f, 0.7, { type: "sawtooth", vol: 0.08, attack: 0.04 }); },
    like()   { tone(880, 0.08, { type: "sine", vol: 0.2 }); tone(1175, 0.12, { type: "sine", vol: 0.2, at: 0.07 }); },
    follow() { [784, 988, 1175].forEach((f, i) => tone(f, 0.25, { type: "sine", vol: 0.18, at: i * 0.08 })); },
    win()    { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.16, { type: "square", vol: 0.15, at: i * 0.13 })); },
    // doação: quanto maior o valor (tier 0..3), mais dramático
    donate(tier = 0) {
      noise(0.5, { vol: 0.3, freq: 400, to: 6000, type: "bandpass" });
      const notes = [[392, 370], [392, 349, 330], [440, 415, 392, 311], [466, 440, 415, 370, 220]][Math.min(3, tier)];
      notes.forEach((f, i) => tone(f, i === notes.length - 1 ? 0.7 : 0.22, { type: "sawtooth", vol: 0.13, at: 0.25 + i * 0.22, to: i === notes.length - 1 ? f * 0.85 : undefined }));
      if (tier >= 2) for (let i = 0; i < 4; i++) noise(0.12, { vol: 0.35, freq: 150, at: 0.25 + i * 0.11 });
    },
    // ---------- biblioteca para escolher no painel (todos sintetizados aqui, originais) ----------
    tada()     { [392, 523, 659, 784].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.12, { type: "square", vol: 0.14, at: i * 0.09 })); noise(0.4, { vol: 0.15, freq: 6000, type: "highpass", at: 0.27 }); },
    fanfare()  { [[523, 0], [523, 0.12], [523, 0.24], [659, 0.36], [784, 0.6], [1047, 0.84]].forEach(([f, a], i) => { tone(f, i === 5 ? 0.9 : 0.14, { type: "sawtooth", vol: 0.1, at: a }); tone(f / 2, i === 5 ? 0.9 : 0.14, { type: "square", vol: 0.06, at: a }); }); },
    airhorn()  { for (const a of [0, 0.22, 0.44]) for (const f of [415, 494, 622]) tone(f, a === 0.44 ? 0.55 : 0.18, { type: "sawtooth", vol: 0.07, at: a, attack: 0.01 }); },
    boing()    { tone(180, 0.45, { type: "sine", vol: 0.4, to: 620 }); tone(620, 0.3, { type: "sine", vol: 0.2, to: 240, at: 0.2 }); },
    boom()     { noise(0.9, { vol: 0.7, freq: 900, to: 40 }); tone(90, 0.8, { type: "sine", vol: 0.6, to: 30 }); },
    laser()    { for (let i = 0; i < 3; i++) tone(1800, 0.14, { type: "square", vol: 0.1, to: 200, at: i * 0.1 }); },
    magic()    { for (let i = 0; i < 8; i++) tone(880 * Math.pow(1.122, i), 0.25, { type: "sine", vol: 0.1, at: i * 0.05 }); },
    coins()    { for (let i = 0; i < 6; i++) { tone(1320 + i * 90, 0.06, { vol: 0.08, at: i * 0.07 }); tone(1980 + i * 90, 0.1, { vol: 0.08, at: i * 0.07 + 0.04 }); } },
    drumroll() { for (let i = 0; i < 22; i++) noise(0.07, { vol: 0.12 + i * 0.012, freq: 1800, type: "bandpass", at: i * 0.045 }); noise(0.5, { vol: 0.5, freq: 3500, type: "highpass", at: 1.0 }); tone(110, 0.4, { type: "sine", vol: 0.5, to: 50, at: 1.0 }); },
    applause() { for (let i = 0; i < 40; i++) noise(0.05, { vol: 0.1 + Math.random() * 0.12, freq: 2500 + Math.random() * 2500, type: "bandpass", at: Math.random() * 1.6 }); },
    womp()     { [392, 370, 349, 330].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.3, { type: "sawtooth", vol: 0.12, at: i * 0.32, to: i === 3 ? 280 : undefined })); },
    siren()    { for (let i = 0; i < 3; i++) { tone(660, 0.25, { type: "triangle", vol: 0.15, to: 990, at: i * 0.5 }); tone(990, 0.25, { type: "triangle", vol: 0.15, to: 660, at: i * 0.5 + 0.25 }); } }
  };
  const LIBRARY = [
    ["", "Automático (conforme o efeito)"], ["tada", "Tcharam"], ["fanfare", "Fanfarra"], ["airhorn", "Buzina de festa"], ["boing", "Boing"],
    ["boom", "Explosão"], ["laser", "Laser"], ["magic", "Mágica"], ["coins", "Chuva de moedas"], ["drumroll", "Rufar de tambor"],
    ["applause", "Aplausos"], ["womp", "Derrota cômica"], ["siren", "Sirene"], ["win", "Vitória"], ["power", "Power-up"], ["crash", "Batida"]
  ];
  // arquivo de áudio enviado pelo painel (data URL); reaproveita o elemento de áudio de cada arquivo
  const customCache = new Map();
  function playCustom(url) {
    if (muted || !url) return;
    let a = customCache.get(url);
    if (!a) { a = new Audio(url); customCache.set(url, a); if (customCache.size > 30) customCache.delete(customCache.keys().next().value); }
    a.volume = Math.min(1, V.master * V.sfx * 1.4); a.currentTime = 0; a.play().catch(() => {});
  }

  // ---------- música original (Am - F - C - G, sequenciador de 16 passos) ----------
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const ARP = [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1, 2, 1];
  const LEAD = [76, null, 74, 72, null, 72, 74, null, 76, null, 79, 76, null, 74, 72, null];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function scheduleStep(i, t) {
    const at = t - ctx.currentTime, bar = Math.floor(i / 16) % 4, s = i % 16, ch = CHORDS[bar];
    if (s % 4 === 0) { tone(150, 0.15, { type: "sine", vol: 0.6, to: 45, at, bus: musicBus }); }       // bumbo
    if (s % 8 === 4) noise(0.14, { vol: 0.25, freq: 1800, type: "bandpass", at, bus: musicBus });        // caixa
    if (s % 2 === 1) noise(0.04, { vol: 0.1, freq: 7000, type: "highpass", at, bus: musicBus });          // chimbal
    if (s % 2 === 0) tone(midi(ch[0] - 24), 0.18, { type: "triangle", vol: 0.35, at, bus: musicBus });    // baixo
    tone(midi(ch[ARP[s]] + 12), 0.09, { type: "square", vol: 0.05, at, bus: musicBus });                  // arpejo
    if (bar % 2 === 1 && LEAD[s]) tone(midi(LEAD[s] - (bar === 3 ? 2 : 0)), 0.2, { type: "triangle", vol: 0.12, at, bus: musicBus });
  }
  function tick() {
    const stepDur = 60 / tempo / 4;
    while (nextTime < ctx.currentTime + 0.12) { scheduleStep(step++, nextTime); nextTime += stepDur; }
  }

  return {
    play(name, arg) { if (init() && SFX[name]) SFX[name](arg); },
    playCustom, LIBRARY,
    startMusic() {
      if (!init() || timer) return;
      step = 0; nextTime = ctx.currentTime + 0.05; timer = setInterval(tick, 25);
    },
    stopMusic() { clearInterval(timer); timer = null; },
    setTempo(bpm) { tempo = bpm; },
    // volumes de 0 a 1 (menu do jogo e painel); valem na hora
    setVolumes(v) {
      if (!v) return;
      for (const k of ["master", "music", "sfx"]) if (v[k] !== undefined) V[k] = Math.max(0, Math.min(1, Number(v[k]) || 0));
      if (!ctx) return;
      musicBus.gain.setTargetAtTime(V.music, ctx.currentTime, 0.03);
      sfxBus.gain.setTargetAtTime(V.sfx, ctx.currentTime, 0.03);
      if (!muted) master.gain.setTargetAtTime(V.master, ctx.currentTime, 0.03);
    },
    get volumes() { return { master: V.master, music: V.music, sfx: V.sfx }; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem("capivara-mute", muted ? "1" : "0"); } catch {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : V.master, ctx.currentTime, 0.02);
      return muted;
    },
    get muted() { return muted; }
  };
})();
