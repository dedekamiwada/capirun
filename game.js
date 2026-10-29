// Capivara Runner — endless runner de 3 pistas com meta de distância e doações da live.
(() => {
const C = Object.assign({}, window.CONFIG), FX = window.EFFECTS;
const TH = window.THEMES, TLEN = window.THEME_LENGTH || 2000, SC = window.Scenery;
// navegadores antigos (ex.: OBS mais velho) não têm roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  r = Math.max(0, Math.min(Array.isArray(r) ? r[0] : r, Math.abs(w) / 2, Math.abs(h) / 2));
  this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
  this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
};
const cv = document.getElementById("c"), g = cv.getContext("2d");
const W = cv.width, H = cv.height;
const LANE = 2.4, CAM_H = 5.4, F = W * 0.85, HORIZON = H * 0.27, PZ = 7.5, FAR = 120, WALL = LANE * 1.75;
const TRAIN_H = 3.4, RAMP = 7;
const BARRIERS = ["low", "mid", "high"]; // low: só por cima · high: só por baixo · mid: por cima ou por baixo

// ---------- estado ----------
let S;
function reset() {
  S = {
    state: "menu", dist: 0, speed: C.startSpeed, coins: 0, t: 0,
    lane: 0, x: 0, y: 0, vy: 0, floor: 0, grounded: true, roll: 0, invuln: 0, stumble: 0,
    camX: 0, camY: CAM_H,
    boardTime: 0, magnet: 0, double: 0, shield: 0,
    speedFx: 0, slowFx: 0, reverseFx: 0, darkFx: 0, likes: 0,
    objs: [], nextSpawn: 30, popups: [], feed: [], parts: [], memeTimer: 6,
    deco: [], over: [], amb: [], nextDeco: 0, nextOver: 0, decoReady: false, theme: null, banner: 0,
    paused: false, themeOrder: THEME_ORDER,
    look: 0, lookDir: 1, lookT: 0, nextLook: 4, mood: "", moodT: 0, alerts: [],
    team: { help: 0, hurt: 0 }, donors: {}, combo: 0, comboT: 0, flash: 0, flashCol: "#fff", shakeT: 0, shakeA: 0,
    confetti: [], milestone: 0, winner: "", winT: 0, legendX: 0, likeCounts: {}, landT: 0
  };
}
// vitórias da sessão (sobrevivem ao reinício da partida; editáveis/zeráveis pelo painel)
const SESSION = { wins: 0 };
try { SESSION.wins = Number(JSON.parse(localStorage.getItem("capivara-wins")).wins) || 0; } catch {}
function setWins(n) {
  SESSION.wins = Math.max(0, Math.floor(Number(n) || 0));
  try { localStorage.setItem("capivara-wins", JSON.stringify({ wins: SESSION.wins })); } catch {}
}
// ordem sorteada uma vez por sessão: sem país escolhido no painel, o primeiro dela fica fixo
const THEME_ORDER = TH.map((_, i) => i).sort(() => Math.random() - 0.5);
reset();

// ---------- configurações do painel (admin.html) ----------
const SETTINGS_KEYS = ["goalMeters", "crashPenaltyMeters", "likesPerPushback", "likePushbackMeters", "donationRules", "theme", "skin", "binds", "testKeys", "giftBinds", "autoRestartSec", "showLegend", "likeRules", "hud", "hudTop", "shortcuts", "sound"];
function applySettings(o) {
  if (!o || typeof o !== "object") return;
  const prevTheme = C.theme;
  for (const k of SETTINGS_KEYS) if (o[k] !== undefined) C[k] = o[k];
  if (C.theme !== prevTheme) refreshScenery();
  if (o.sound) Sound.setVolumes(o.sound);
}
// troca de país: refaz as decorações na hora em vez de esperar o caminho renovar
function refreshScenery() { S.deco = []; S.over = []; S.decoReady = false; }
try { applySettings(JSON.parse(localStorage.getItem("capivara-settings"))); } catch {}
if (location.protocol.startsWith("http"))
  fetch("/api/settings").then(r => r.ok ? r.json() : null).then(applySettings).catch(() => {});

// ---------- projeção e primitivas (câmera segue o jogador) ----------
function proj(x, y, z) {
  const s = F / Math.max(z, 0.3);
  return [W / 2 + (x - S.camX) * s, HORIZON + (S.camY - y) * s, s];
}
function poly(pts, fill) {
  g.fillStyle = fill; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.closePath(); g.fill();
}
// retângulo vertical voltado para a câmera, no plano z
function face(x0, y0, x1, y1, z, fill) {
  if (z < 0.4) return;
  const a = proj(x0, y1, z), b = proj(x1, y0, z);
  g.fillStyle = fill; g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
}
// retângulo no plano lateral x, de z0 a z1
function side(x, y0, y1, z0, z1, fill) {
  z0 = Math.max(z0, 0.4); if (z1 <= z0) return;
  poly([proj(x, y0, z0), proj(x, y0, z1), proj(x, y1, z1), proj(x, y1, z0)], fill);
}
// escurece/clareia uma cor "#rrggbb" ou "rgb(r,g,b)"
function shade(col, k) {
  let c;
  if (col[0] === "#") { const n = parseInt(col.slice(1), 16); c = [n >> 16, (n >> 8) & 255, n & 255]; }
  else c = col.match(/\d+/g).slice(0, 3).map(Number);
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}
const hash = (a, b = 0) => ((Math.imul(a + 1, 73856093) ^ Math.imul(b + 7, 19349663)) >>> 0) % 1000;
// caixa: centro x, base y, z da frente, largura, altura, profundidade
function box(x, y, zFront, w, h, d, col) {
  const z1 = zFront + d, z0 = Math.max(zFront, 0.4);
  if (z1 <= z0) return;
  const l = x - w / 2, r = x + w / 2;
  if (l > S.camX) side(l, y, y + h, z0, z1, shade(col, 0.62));
  if (r < S.camX) side(r, y, y + h, z0, z1, shade(col, 0.62));
  if (y + h < S.camY) poly([proj(l, y + h, z0), proj(r, y + h, z0), proj(r, y + h, z1), proj(l, y + h, z1)], shade(col, 1.18));
  // a frente só existe enquanto ainda está diante da câmera
  if (zFront >= 0.4) face(l, y, r, y + h, zFront, col);
}

// ---------- geração ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const solid = o => o.t === "train" || o.t === "ramp" || BARRIERS.includes(o.t);
// a pista já tem algo sólido perto de z? (evita trens/barreiras sobrepostos)
function laneBusy(lane, z0, z1 = z0) {
  return S.objs.some(o => solid(o) && o.lane === lane && o.z - 4 < z1 && o.z + (o.d || 0.5) + 4 > z0);
}
function addTrain(lane, z, opts = {}) {
  const d = opts.d || rnd(14, 28);
  if (opts.ramp) { S.objs.push({ t: "ramp", lane, z, d: RAMP }); z += RAMP; }
  S.objs.push({ t: "train", lane, z, d, col: opts.col || pick(C.colors.train), num: opts.num || 100 + (Math.random() * 900 | 0), move: opts.move || 0 });
  if (opts.ramp) coinLine(lane, z + 2, Math.floor(d / 3), false, TRAIN_H);
}
function spawnRow(z) {
  const open = [-1, 0, 1].filter(l => !laneBusy(l, z));
  if (!open.length) return;
  const free = pick(open); // sempre fica uma pista livre nesta linha
  for (const l of open) {
    if (l === free) { if (Math.random() < 0.6) coinLine(l, z, 6); continue; }
    const r = Math.random();
    if (r < 0.4) {
      // trem em movimento só se a pista estiver vazia até o jogador (senão atravessaria outros objetos)
      const clear = !S.objs.some(o => o.lane === l && o.z + (o.d || 0.5) > PZ - 2);
      const move = clear && Math.random() < 0.3 ? rnd(6, 12) : 0;
      addTrain(l, z, { move, ramp: !move && Math.random() < 0.45 });
    } else if (r < 0.88) S.objs.push({ t: pick(BARRIERS), lane: l, z });
    else coinLine(l, z, 5, true);
  }
  if (Math.random() < 0.08) S.objs.push({ t: "power", kind: pick(["board", "magnet", "double"]), lane: free, z: z + 3, y: 1 });
}
function coinLine(lane, z, n, arc, base = 0) {
  for (let i = 0; i < n; i++) S.objs.push({ t: "coin", lane, z: z + i * 2.2, y: base + (arc ? 1 + Math.sin(i / (n - 1) * Math.PI) * 2 : 0.8) });
}
// altura do chão numa pista, na posição do jogador: trilho, rampa ou teto de trem
// reach: só conta superfícies até essa altura (o que dá para pisar); trens já atravessados não contam
function floorAt(lane, reach = Infinity) {
  let f = 0;
  for (const o of S.objs) {
    if (o.lane !== lane || o.passed || PZ < o.z || PZ > o.z + o.d) continue;
    const h = o.t === "train" ? TRAIN_H : o.t === "ramp" ? TRAIN_H * (PZ - o.z) / o.d : 0;
    if (h <= reach) f = Math.max(f, h);
  }
  return f;
}
// trem (ou trecho alto de rampa) na posição do jogador que é alto demais para subir: é uma parede
function wallAt(lane) {
  return S.objs.find(o => o.lane === lane && !o.passed && (o.t === "train" || o.t === "ramp") && PZ >= o.z && PZ <= o.z + o.d &&
    (o.t === "train" ? TRAIN_H : TRAIN_H * (PZ - o.z) / o.d) - S.y > 0.7);
}

// ---------- doações ----------
// regra mais específica primeiro: presente escolhido (pelo ID oficial da TikTok, ou pelo nome) e depois maior valor mínimo
// regras de um presente escolhido pedem uma QUANTIDADE daquele presente (ex.: 5× Rosa num combo);
// regras de "qualquer presente" pedem um valor mínimo em moedas
function ruleFor(ev, coins) {
  const name = String(ev.gift || "").trim().toLowerCase(), id = ev.giftId ? String(ev.giftId) : "";
  const specific = r => !!(r.giftId || r.gift);
  const matches = r => !specific(r) || (r.giftId ? String(r.giftId) === id : String(r.gift).trim().toLowerCase() === name);
  const count = r => Number(ev.count) || Math.max(1, Math.round(coins / Math.max(1, Number(r.giftCoins) || coins)));
  const enough = r => specific(r) ? count(r) >= (Number(r.minCount) || 1) : coins >= (Number(r.minCoins) || 0);
  const weight = r => specific(r) ? (Number(r.minCount) || 1) * (Number(r.giftCoins) || 1) : Number(r.minCoins) || 0;
  return (C.donationRules || []).slice().sort((a, b) => (specific(b) - specific(a)) || weight(b) - weight(a)).find(r => matches(r) && enough(r));
}
function donate(ev) {
  const coins = Math.max(1, Number(ev.coins) || 1);
  const rule = ev.rule || (ev.ruleIndex != null ? (C.donationRules || [])[ev.ruleIndex] : null) || ruleFor(ev, coins);
  if (!rule) return;
  if (S.state === "win") return; // partida já acabou
  const m = Number(rule.meters) || 0; // > 0 atrapalha (volta), < 0 ajuda (avança)
  const win = rule.effect === "win";
  const before = S.dist;
  S.dist = win ? C.goalMeters : Math.min(C.goalMeters - 1, Math.max(0, S.dist - m));
  applyEffect(rule.effect);
  const help = win || m < 0 || (FX[rule.effect] || {}).kind === "help";
  // simulação (atalhos, teclas de teste, painel) não mostra nome de ninguém: só o presente e o efeito
  const who = ev.sim ? "" : String(ev.user || "").trim().slice(0, 22);
  const giftName = ev.gift || rule.gift || "";
  const img = ev.img || rule.giftImg || "";

  // time Ajuda × time Atrapalha (metros de verdade que cada lado moveu) e ranking da partida
  const moved = Math.abs(S.dist - before);
  if (help) S.team.help += moved; else S.team.hurt += moved;
  if (who) {
    const d = S.donors[who] || (S.donors[who] = { name: who, coins: 0, help: 0, hurt: 0 });
    d.coins += coins; if (help) d.help += coins; else d.hurt += coins;
  }
  // combo: presentes seguidos (até 6 s entre eles) aumentam o hype
  S.combo = S.comboT > 0 ? S.combo + 1 : 1;
  S.comboT = 6;
  const tier = Math.min(4, (coins >= 1000 ? 3 : coins >= 100 ? 2 : coins >= 10 ? 1 : 0) + (S.combo >= 5 ? 1 : 0));
  hype(tier, help, win);

  // som: o escolhido na regra (biblioteca ou arquivo próprio) ou o automático
  if (rule.soundData) Sound.playCustom(rule.soundData);
  else if (rule.sound) Sound.play(rule.sound, tier);
  else Sound.play(win ? "fanfare" : help ? "power" : "donate", tier);

  react(help ? "laugh" : "shock", help ? 2.5 : 1.8);
  const fxLabel = rule.effect && FX[rule.effect] && !win ? " " + FX[rule.effect].label.split(" ")[0] : "";
  const effect = win ? "VITÓRIA!" : `${m > 0 ? "−" : "+"}${Math.abs(m).toLocaleString("pt-BR")} m${fxLabel}`;
  if (win) S.winner = who || giftName || "um presente";
  // simulação sem presente (atalho de teclado, likes): título pelo tipo, nunca "teste"
  const title = ev.title || (ev.sim && !giftName ? (win ? "🏆 VITÓRIA!" : help ? "😇 AJUDA!" : "😈 SABOTAGEM!") : "");
  S.alerts.push({ who, title, gift: giftName, img, effect, help, win, combo: S.combo, tier, t: 0 });
  if (S.alerts.length > 6) S.alerts.splice(1, 1); // fila cheia: pula os mais antigos (o atual continua)
  S.feed.unshift({ text: `${who || title || "🎁 " + (giftName || "presente")}: ${effect}`, help, t: 0 });
  S.feed.length = Math.min(S.feed.length, 5);
}
// imagens dos presentes (vêm da TikTok), carregadas uma vez
const giftImgs = {};
function giftImage(url) {
  if (!url) return null;
  if (!giftImgs[url]) { const im = new Image(); im.referrerPolicy = "no-referrer"; im.src = url; giftImgs[url] = im; }
  return giftImgs[url].complete && giftImgs[url].naturalWidth ? giftImgs[url] : null;
}
function applyEffect(e) {
  if (e === "win") return; // tratado em donate(): leva direto à vitória com o nome de quem doou
  if (e === "train") {
    // remove o que estiver no caminho para o trem não atravessar nada
    S.objs = S.objs.filter(o => !(o.lane === S.lane && o.z > 55 && o.z < 100));
    addTrain(S.lane, 70, { d: 22, col: "#e8525c", num: 666 });
  }
  if (e === "speed") S.speedFx = 10;
  if (e === "slow") S.slowFx = 10;
  if (e === "reverse") S.reverseFx = 10;
  if (e === "dark") S.darkFx = 10;
  if (e === "board") S.boardTime = 30;
  if (e === "shield") S.shield = 10;
  if (e === "magnet" || e === "double") S[e] = 12;
}
// regras de likes: "a cada N likes → avança/volta X m (+ efeito e som)"; cada regra conta separado
function likeRules() {
  if (Array.isArray(C.likeRules)) return C.likeRules.filter(r => Number(r.every) > 0);
  // configurações antigas (antes da lista de regras)
  return C.likesPerPushback > 0 ? [{ every: C.likesPerPushback, meters: C.likePushbackMeters, effect: "" }] : [];
}
function onLike(n) {
  S.likes += n;
  likeRules().forEach((r, i) => {
    S.likeCounts[i] = (S.likeCounts[i] || 0) + n;
    while (S.likeCounts[i] >= r.every) {
      S.likeCounts[i] -= r.every;
      donate({ sim: true, title: `❤️ ${Number(r.every).toLocaleString("pt-BR")} likes!`, gift: "", coins: 1, rule: { meters: r.meters, effect: r.effect, sound: r.sound || "like", soundData: r.soundData } });
    }
  });
}
function popup(a, b, col) { if (C.showPopups) S.popups.push({ a, b, col, t: 3.5 }); }
// o painel manda cada comando pelo navegador e pelo servidor: o id evita aplicar duas vezes
const seenCmds = new Set();
function command(c) {
  if (c && c.id) {
    if (seenCmds.has(c.id)) return;
    seenCmds.add(c.id);
    if (seenCmds.size > 200) seenCmds.delete(seenCmds.values().next().value);
  }
  if (!c) return;
  if (c.type === "gift") donate(c);
  if (c.type === "like") onLike(c.count || 1);
  if (c.type === "follow") Sound.play("follow");
  if (c.type === "settings") applySettings(c.settings);
  if (c.type === "bot") toggleBot();
  if (c.type === "pause") togglePause();
  if (c.type === "restart") { const p = S.paused; reset(); S.state = "run"; if (!p) Sound.startMusic(); }
  if (c.type === "wins") setWins(c.value);
  if (c.type === "menu") openMenu();
}
function togglePause() {
  if (S.state !== "run") return;
  S.paused = !S.paused;
  MENU.sel = 0; // na pausa, "Continuar" vem selecionado
  if (S.paused) Sound.stopMusic(); else Sound.startMusic();
}
// estado atual para o painel (mesmo navegador via localStorage, ou pelo servidor)
let WS = null;
setInterval(() => {
  const st = { type: "status", state: S.state, paused: S.paused, bot: BOT.on, dist: Math.floor(S.dist), goal: C.goalMeters, theme: S.theme && S.theme.name, themeMode: C.theme || "", coins: S.coins, wins: SESSION.wins };
  try { localStorage.setItem("capivara-status", JSON.stringify(st)); } catch {}
  if (WS && WS.readyState === 1) WS.send(JSON.stringify(st));
}, 500);
window.Game = { donate, onLike, toggleBot: () => toggleBot(), step: dt => update(dt), get botOn() { return BOT.on; }, get menu() { return MENU; }, get state() { return S; } };

// painel admin.html na mesma máquina (funciona até abrindo os arquivos direto, sem servidor)
addEventListener("storage", e => {
  try {
    if (e.key === "capivara-settings") applySettings(JSON.parse(e.newValue));
    if (e.key === "capivara-cmd" && e.newValue) command(JSON.parse(e.newValue));
  } catch {}
});
// ponte local (server.js) — opcional
(function connect() {
  if (location.protocol === "file:") return;
  let ws;
  try { ws = WS = new WebSocket(`ws://${location.host}/ws`); } catch { return; }
  ws.onmessage = m => { try { command(JSON.parse(m.data)); } catch {} };
  ws.onclose = () => setTimeout(connect, 2000);
})();

// ---------- controles ----------
function start() { if (S.state === "menu" || S.state === "win") { reset(); S.state = "run"; Sound.startMusic(); } }
function act(a, fromBot) {
  if (S.state === "menu") { if (!fromBot) menuKey(a); return; }
  if (S.state !== "run") { if (!fromBot) start(); return; }
  if (S.paused) return;
  if (S.reverseFx > 0) a = { left: "right", right: "left", up: "down", down: "up" }[a];
  const lane = S.lane;
  if (a === "left") S.lane = Math.max(-1, S.lane - 1);
  if (a === "right") S.lane = Math.min(1, S.lane + 1);
  if (S.lane !== lane) { S.prevLane = lane; Sound.play("lane"); }
  if (a === "up" && S.grounded) { S.vy = 13; S.roll = 0; S.grounded = false; Sound.play("jump"); }
  if (a === "down") { S.roll = 0.7; if (!S.grounded) S.vy = -25; Sound.play("roll"); }
}
// teclas configuráveis no painel (C.binds: ação → lista de e.code)
addEventListener("keydown", e => {
  // no menu: setas/WASD navegam, Enter/Espaço confirmam, Esc/Backspace voltam
  if (S.state === "menu" && !e.repeat) {
    if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") { menuKey("ok"); e.preventDefault(); return; }
    if (e.code === "Escape" || e.code === "Backspace") {
      if (MENU.screen === "main" && S.resumable) resumeRun(); else menuKey("back"); // Esc no menu principal volta para a partida
      e.preventDefault(); return;
    }
  }
  // na pausa: setas escolhem entre Continuar e Menu principal, Enter confirma
  if (S.paused && !e.repeat) {
    const a0 = actionFor(e.code);
    if (a0 === "up" || a0 === "down") { MENU.sel = MENU.sel === 1 ? 0 : 1; e.preventDefault(); return; }
    if (e.code === "Enter" || e.code === "NumpadEnter") { MENU.sel === 1 ? openMenu() : togglePause(); e.preventDefault(); return; }
  }
  if (e.repeat && !["left", "right", "up", "down"].includes(actionFor(e.code))) return;
  const a = actionFor(e.code);
  if (["left", "right", "up", "down"].includes(a)) { act(a); e.preventDefault(); }
  if (a === "pause") togglePause();
  if (a === "bot") toggleBot();
  if (a === "mute") Sound.toggleMute();
  // atalhos de teclado configurados no painel (avançar, voltar, vitória, simular presente, likes)
  const sc = shortcuts().find(b => b.code === e.code);
  if (sc && !e.repeat) runShortcut(sc);
});
// lista de atalhos; configurações antigas ("atalhos de presente") viram atalhos do tipo "presente"
function shortcuts() {
  if (Array.isArray(C.shortcuts)) return C.shortcuts;
  return (C.giftBinds || []).map(b => ({ ...b, kind: "gift" }));
}
function runShortcut(sc) {
  const m = Math.abs(Number(sc.meters) || 0), qty = Math.max(1, Number(sc.qty) || 1);
  if (sc.kind === "likes") return onLike(Math.max(1, Number(sc.count) || 1));
  if (sc.kind === "gift") // passa pelas mesmas regras de uma doação real
    return donate({ sim: true, gift: sc.gift || "", giftId: sc.giftId || "", img: sc.giftImg || "", coins: Math.max(1, Number(sc.coins) || 1) * qty, count: qty });
  const rule = { meters: sc.kind === "help" ? -m : sc.kind === "hurt" ? m : 0, effect: sc.kind === "win" ? "win" : sc.effect || "", sound: sc.sound || "", soundData: sc.soundData };
  donate({ sim: true, gift: "", coins: 1, rule });
}
function actionFor(code) {
  for (const [action, codes] of Object.entries(C.binds || {})) if (codes.includes(code)) return action;
  return null;
}
// abrir com ?bot=1 já liga o bot (útil na fonte de navegador do OBS)
if (new URLSearchParams(location.search).get("bot") === "1") setTimeout(toggleBot, 300);
let tx, ty;
cv.addEventListener("pointerdown", e => { tx = e.clientX; ty = e.clientY; });
// posição do toque/clique em coordenadas do canvas (ele é escalado para caber na janela)
function canvasPoint(e) {
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
}
cv.addEventListener("pointermove", e => { if (S.state === "menu" || S.paused) menuHover(...canvasPoint(e)); });
cv.addEventListener("pointerup", e => {
  if (S.state === "menu" || S.paused) return menuClick(...canvasPoint(e));
  const dx = e.clientX - tx, dy = e.clientY - ty;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return act("up");
  act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
});

// ---------- bot (tecla B): reage com atraso humano, se mexe o tempo todo e nunca é punido por bater ----------
const BOT = { on: false, wait: 0, idle: 0.5 };
function toggleBot() {
  BOT.on = !BOT.on;
  if (BOT.on) start();
}
function botPress(a, spam) {
  // o bot "sabe" que os controles estão invertidos e compensa
  if (S.reverseFx > 0) a = { left: "right", right: "left", up: "down", down: "up" }[a];
  act(a, true);
  BOT.wait = spam ? spamGap() : rnd(0.1, 0.22);
}
// intervalo entre teclas do spam: cada um sorteado na hora, com distribuição de cauda longa
// (quase sempre rápido, às vezes uma hesitação, raramente uma pausa) — sem ritmo fixo
function spamGap() {
  const r = Math.random();
  return r < 0.72 ? rnd(0.03, 0.12) : r < 0.93 ? rnd(0.12, 0.28) : rnd(0.28, 0.6);
}
// rajada de teclas: cada tecla sorteada de forma independente entre as quatro, tamanho também sorteado
function humanBurst() {
  const n = 1 + Math.floor(-Math.log(1 - Math.random()) * 6); // geralmente curta, às vezes bem longa
  BOT.burst = { i: 0, keys: Array.from({ length: Math.min(n, 30) }, () => pick(["up", "down", "left", "right"])) };
}
// segundos até um trem bloquear a pista (0 = bloqueada agora, Infinity = livre)
function laneDanger(lane) {
  if (floorAt(lane) - S.y > 0.7) return 0;
  let t = Infinity;
  for (const o of S.objs) {
    if (o.lane !== lane || o.t !== "train" || o.z <= PZ) continue;
    if (S.objs.some(r => r.t === "ramp" && r.lane === lane && Math.abs(r.z + r.d - o.z) < 0.5 && r.z > PZ - 0.5)) continue;
    t = Math.min(t, (o.z - PZ) / (runSpeed() + (o.move || 0)));
  }
  return t;
}
// barreiras que ainda não passaram totalmente pelo jogador, da mais próxima à mais distante
function barriersIn(lane) {
  return S.objs.filter(o => o.lane === lane && BARRIERS.includes(o.t) && o.z + 0.6 > PZ - 0.6).sort((a, b) => a.z - b.z);
}
function laneSafeToEnter(lane) {
  const b = barriersIn(lane)[0];
  return laneDanger(lane) > 0.4 && !(b && (b.z - PZ) / runSpeed() < 0.45);
}
function botUpdate(dt) {
  if (!BOT.on || S.state !== "run") return;
  BOT.wait -= dt; BOT.idle -= dt;
  if (BOT.wait > 0) return;
  const pl = S.lane, look = 3, v = runSpeed();
  const score = l => {
    const d = laneDanger(l);
    let s = Math.min(d, look) * 10 - Math.abs(l - pl) * 1.5 + (l === pl ? 1 : 0);
    for (const o of S.objs) if (o.lane === l && o.t === "coin" && o.z > PZ && o.z < PZ + v * 1.5) s += 0.6;
    for (const o of S.objs) if (o.lane === l && o.t === "ramp" && o.z > PZ) s += 2;
    return s;
  };
  // 1) escolher a melhor pista e andar uma pista por vez, se a próxima estiver segura
  const best = [-1, 0, 1].reduce((a, b) => score(b) > score(a) ? b : a, pl);
  if (best !== pl) {
    const step = best > pl ? 1 : -1;
    if (laneSafeToEnter(pl + step)) return botPress(step > 0 ? "right" : "left");
  }
  // 2) pular ou rolar barreiras da pista atual
  const ahead = S.floor < 0.1 && barriersIn(pl)[0];
  if (ahead) {
    if (ahead.z < PZ + 0.5) return; // passando pela barreira agora: mantém o pulo/rolamento
    const t = (ahead.z - PZ) / v;
    ahead.react = ahead.react || rnd(0.2, 0.36);
    if (t < ahead.react) {
      const want = ahead.t === "low" ? "up" : ahead.t === "high" ? "down" : (ahead.choice = ahead.choice || pick(["up", "down"]));
      if (want === "up" && S.grounded && S.roll <= 0) return botPress("up");
      if (want === "down" && S.roll <= 0.15 && S.y < 0.6) return botPress("down");
    }
    if (t < 1) { BOT.burst = null; return; } // concentrado: nada de spam perto de obstáculo
  }
  // 3) spam de teclas como uma pessoa apertando tudo: s d a w a d s a w…
  if (BOT.burst) {
    const b = BOT.burst, key = b.keys[b.i++];
    if (b.i >= b.keys.length) { BOT.burst = null; BOT.idle = spamGap(); }
    if (key === "left" || key === "right") {
      // pista perigosa: a tecla "escorrega" (não troca de pista), mas o spam continua
      const nl = pl + (key === "right" ? 1 : -1);
      if (nl >= -1 && nl <= 1 && (!laneSafeToEnter(nl) || laneDanger(nl) < 1)) { BOT.wait = spamGap(); return; }
    }
    return botPress(key, true);
  }
  if (BOT.idle <= 0 && laneDanger(pl) > 1.2) { BOT.idle = spamGap(); return humanBurst(); }
}

// ---------- update ----------
function runSpeed() {
  return S.speed * (S.speedFx > 0 ? 1.4 : 1) * (S.slowFx > 0 ? 0.7 : 1) * (S.stumble > 0 ? 0.5 : 1);
}
function crash() {
  if (BOT.on || S.invuln > 0 || S.shield > 0) return; // com o bot ligado ele atravessa sem penalidade
  if (S.boardTime > 0) { S.boardTime = 0; S.invuln = 1.2; Sound.play("break"); return; }
  Sound.play("crash");
  react("shock", 1.6);
  S.crashes = (S.crashes || 0) + 1;
  S.dist = Math.max(0, S.dist - C.crashPenaltyMeters);
  S.speed = Math.max(C.startSpeed, S.speed * 0.8);
  S.invuln = 2; S.stumble = 0.6;
  popup("BATEU 💥", `-${C.crashPenaltyMeters} m`, "#ff7b39");
}
function sparkle(x, y, z, col, n) {
  const [sx, sy, s] = proj(x, y, z);
  for (let i = 0; i < n; i++) S.parts.push({ x: sx, y: sy, vx: rnd(-1, 1) * s * 2, vy: rnd(-2.5, -0.5) * s, life: rnd(0.3, 0.6), col, r: s * rnd(0.05, 0.1) });
}
function update(dt) {
  // cenário é refeito mesmo pausado, para a troca de país pelo painel aparecer na hora
  if (!S.decoReady) {
    for (let z = 2; z < FAR; z += rnd(1.5, 4)) spawnDeco(z);
    for (let z = 10; z < FAR; z += rnd(16, 28)) spawnOver(z);
    S.decoReady = true;
  }
  const here = themeAt(S.dist);
  if (here !== S.theme) { S.theme = here; S.banner = 4; }
  if (S.paused) return;
  S.t += dt;
  S.popups.forEach(p => p.t -= dt); S.popups = S.popups.filter(p => p.t > 0);
  S.feed.forEach(f => f.t += dt);
  S.legendX += dt * 80;
  updateHype(dt);
  if (S.state === "win") {
    // festa da vitória e nova partida automática
    S.winT += dt;
    if (Math.random() < dt * 6) confettiBurst(30, rnd(80, W - 80), rnd(300, 700), 0.9);
    if (C.autoRestartSec > 0 && S.winT > C.autoRestartSec) { const bot = BOT.wasOn; reset(); S.state = "run"; Sound.startMusic(); if (bot) BOT.on = true; }
  }
  for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt; }
  S.parts = S.parts.filter(p => p.life > 0);
  // câmera atrás do jogador: acompanha a pista e a altura do chão (sobe junto no teto do trem)
  S.camX += (S.x - S.camX) * Math.min(1, dt * 8);
  S.camY += (S.floor + CAM_H - S.camY) * Math.min(1, dt * 5);
  S.banner = Math.max(0, S.banner - dt);
  // expressão do avatar e olhadinha por cima do ombro de vez em quando
  S.moodT = Math.max(0, S.moodT - dt);
  if (!S.moodT) S.mood = "";
  S.nextLook -= dt;
  if (S.nextLook <= 0 && !S.lookT) { S.lookT = rnd(0.6, 1.1); S.lookDir = pick([-1, 1]); S.nextLook = rnd(4, 9); }
  S.lookT = Math.max(0, S.lookT - dt);
  S.look += ((S.lookT ? S.lookDir : 0) - S.look) * Math.min(1, dt * 10);
  updateAmbient(dt, here);
  if (S.state !== "run") return;
  botUpdate(dt);
  S.speed = Math.min(C.maxSpeed, S.speed + C.speedGainPerSec * dt);
  const dz = runSpeed() * dt;
  S.dist += dz;
  ["invuln", "stumble", "roll", "speedFx", "slowFx", "reverseFx", "darkFx", "boardTime", "magnet", "double", "shield"].forEach(k => S[k] = Math.max(0, S[k] - dt));
  S.memeTimer -= dt;
  if (S.memeTimer <= 0) { S.memeTimer = rnd(8, 15); popup(pick(C.memes), "", "#fff"); }

  S.nextSpawn -= dz;
  if (S.nextSpawn <= 0) { spawnRow(FAR); S.nextSpawn = rnd(18, 30) * (1 - (S.speed - C.startSpeed) / 100); }
  for (const o of S.objs) {
    o.z -= dz + (o.move || 0) * dt;
    if (o.move && !o.honked && o.z < 60) { o.honked = true; Sound.play("horn"); }
  }
  for (const d of S.deco) d.z -= dz;
  for (const o of S.over) o.z -= dz;
  S.deco = S.deco.filter(d => d.z + (d.d || 1) > 0);
  S.over = S.over.filter(o => o.z > 0.5);
  S.nextDeco -= dz; S.nextOver -= dz;
  while (S.nextDeco <= 0) { spawnDeco(FAR); S.nextDeco += rnd(1.5, 4); }
  if (S.nextOver <= 0) { spawnOver(FAR); S.nextOver = rnd(16, 28); }
  // reta final (últimos 10%): música mais rápida para aumentar a tensão
  Sound.setTempo(S.speedFx > 0 ? 150 : (S.dist / C.goalMeters >= 0.9 ? 145 : 128) + (S.speed - C.startSpeed) * 0.6);

  S.x += (S.lane * LANE - S.x) * Math.min(1, dt * 14);
  const pl = Math.round(S.x / LANE);
  // trem alto demais na frente/lado: nunca teletransporta para o teto (só se sobe pela rampa ou caindo de cima)
  const wall = wallAt(pl);
  if (wall) {
    const changing = S.prevLane !== undefined && S.prevLane !== pl && Math.abs(S.x - pl * LANE) > 0.25;
    if (BOT.on) wall.passed = true;                       // bot atravessa sem penalidade
    else if (changing && !wallAt(S.prevLane)) {           // bateu de lado trocando de pista: quica de volta
      S.lane = S.prevLane; S.stumble = Math.max(S.stumble, 0.3);
      Sound.play("lane"); react("shock", 0.8);
    } else { crash(); wall.passed = true; }               // de frente: perde metros e atravessa piscando
  }
  S.floor = floorAt(Math.round(S.x / LANE), S.y + 0.7);
  const wasGrounded = S.grounded;
  S.vy -= 38 * dt; S.y += S.vy * dt;
  S.grounded = S.y <= S.floor;
  if (S.grounded) { S.y = S.floor; S.vy = 0; }
  if (S.grounded && !wasGrounded) S.landT = 0.18; // aterrissou: amassa um pouquinho
  S.landT = Math.max(0, (S.landT || 0) - dt);

  for (const o of S.objs) {
    const hitZ = o.z < PZ + 0.5 && o.z + (o.d || 0.6) > PZ - 0.5;
    if (o.t === "coin" || o.t === "power") {
      if (S.magnet > 0 && o.t === "coin" && Math.abs(o.z - PZ) < 12) { o.lane += (S.x / LANE - o.lane) * 0.3; o.y += (S.y + 0.8 - o.y) * 0.3; }
      if (hitZ && Math.abs(o.lane * LANE - S.x) < 1.2 && Math.abs(o.y - (S.y + 0.8)) < 1.6) {
        o.dead = true;
        if (o.t === "coin") { S.coins += S.double > 0 ? 2 : 1; Sound.play("coin"); sparkle(o.lane * LANE, o.y, PZ, "#ffe66b", 5); }
        else { applyEffect(o.kind); Sound.play("power"); sparkle(o.lane * LANE, o.y, PZ, "#7be0ff", 14); }
      }
      continue;
    }
    if (!hitZ || o.lane !== pl || o.hit) continue;
    const rolling = S.roll > 0 && S.y < 0.6;
    if (o.t === "low" && S.y < 1.1) { o.hit = true; crash(); }                   // só pulando
    if (o.t === "mid" && !rolling && S.y < 1.3) { o.hit = true; crash(); }       // pulando ou rolando
    if (o.t === "high" && !rolling && S.y < 3.2) { o.hit = true; crash(); }      // só rolando
  }
  S.objs = S.objs.filter(o => !o.dead && o.z + (o.d || 1) > 0);

  if (S.dist >= C.goalMeters) {
    S.dist = C.goalMeters; S.state = "win"; S.winT = 0;
    setWins(SESSION.wins + 1);
    BOT.wasOn = BOT.on; BOT.on = false;
    Sound.stopMusic(); Sound.play("win"); setTimeout(() => Sound.play("applause"), 900);
    confettiRain(200); S.flash = 1; S.flashCol = "#ffd23f";
  }
}

// ---------- cenário: países que mudam ao longo do caminho ----------
// país fixo: o escolhido no painel, ou o sorteado no início da sessão; "auto" troca a cada TLEN metros
function fixedTheme() {
  if (C.theme === "auto") return null;
  return TH.find(t => t.name === C.theme) || TH[S.themeOrder[0]];
}
function themeAt(pos) { return fixedTheme() || TH[S.themeOrder[Math.floor(Math.max(0, pos) / TLEN) % TH.length]]; }
function themeBlend(pos) {
  const f = fixedTheme();
  if (f) return { a: f, b: f, m: 0 };
  const p = (Math.max(0, pos) % TLEN) / TLEN;
  return { a: themeAt(pos), b: themeAt(pos + TLEN), m: p > 0.92 ? (p - 0.92) / 0.08 : 0 };
}
function spawnOver(z) {
  const th = themeAt(S.dist + z);
  if (th.overhead && Math.random() < 0.75) S.over.push({ z, th, kind: th.overhead });
}
// clima do país: pétalas, areia, confete ou folhas caindo na tela
function updateAmbient(dt, th) {
  const kind = th.particles;
  if (kind && S.amb.length < 40 && Math.random() < dt * (kind === "sand" ? 18 : 6)) {
    const col = kind === "petals" ? pick(["#ffc4dd", "#ff9ec7", "#fff0f6"]) : kind === "sand" ? "rgba(230,190,120,.6)"
      : kind === "confetti" ? pick(["#009c3b", "#ffdf00", "#1f3fa0", "#ff4fa3"]) : pick(["#c98a3a", "#8fae4a", "#d9a441"]);
    S.amb.push(kind === "sand"
      ? { x: W + 10, y: rnd(HORIZON, H), vx: rnd(-500, -300), vy: rnd(-20, 20), r: rnd(1, 2.5), col, rot: 0, vr: 0, life: 3 }
      : { x: rnd(-50, W), y: -10, vx: rnd(20, 70), vy: rnd(50, 110), r: rnd(4, 8), col, rot: rnd(0, 6), vr: rnd(-3, 3), life: 14 });
  }
  for (const p of S.amb) { p.x += p.vx * dt + Math.sin(S.t * 2 + p.r) * 0.4; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt; }
  S.amb = S.amb.filter(p => p.life > 0 && p.y < H + 20 && p.x > -60);
}
function mix(c1, c2, m) {
  if (m <= 0) return c1;
  if (m >= 1) return c2;
  const p = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const A = p(c1), B = p(c2);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * m)).join(",")})`;
}
function spawnDeco(z) {
  const th = themeAt(S.dist + z), sgn = pick([-1, 1]), kind = pick(th.props), seed = Math.random() * 1000 | 0;
  if (kind === "house" || kind === "pagodaHouse") {
    const w = rnd(3, 5);
    S.deco.push({ kind, th, seed, z, w, h: kind === "house" ? rnd(3, 6.5) : rnd(2.5, 3.5), d: rnd(4, 8), x: sgn * (WALL + 1.2 + w / 2 + rnd(0, 2)) });
  } else S.deco.push({ kind, th, seed, z, x: sgn * (WALL + rnd(1.3, 6)) });
  // segunda fileira: prédios maiores mais afastados, para o horizonte não ficar vazio
  if (Math.random() < 0.45) {
    const s2 = pick([-1, 1]), w = rnd(5, 9);
    S.deco.push({ kind: "bighouse", th, seed: seed + 1, z, w, h: rnd(6, 14), d: rnd(6, 11), x: s2 * (WALL + 8 + w / 2 + rnd(0, 6)) });
  }
  // tufos de grama dão textura ao chão
  for (let i = 0; i < 2; i++) S.deco.push({ kind: "grass", th, seed: seed + 2 + i, z: z + rnd(0, 2), x: pick([-1, 1]) * (WALL + rnd(0.6, 12)) });
}
// camadas do horizonte: monumentos ao fundo, prédios na frente; cada volta do ciclo sorteia de novo
function skyline(th, layer, alpha) {
  if (alpha <= 0.01) return;
  g.globalAlpha = alpha;
  const far = layer === 0, k = far ? 0.08 : 0.3, n = far ? 4 : 8, span = W + 600, slot = span / n;
  for (let i = 0; i < n; i++) {
    const raw = i * slot - S.dist * k - S.camX * (far ? 4 : 12), cyc = Math.floor(raw / span);
    const bx = raw - cyc * span - 300, seed = SC.hash(i, cyc * 31 + layer);
    if (far) {
      const type = th.landmarks[seed % th.landmarks.length], col = th.far[i % 2];
      SC.LANDMARKS[type](g, bx + slot / 2, HORIZON, 0.8 + (seed % 40) / 100, col, shade(col, 0.8), th.win, seed, S.t);
    } else {
      const w = 60 + seed % 70, hh = 45 + SC.hash(seed) % 90;
      SC.building(g, bx, HORIZON, w, hh, th.near[i % 2], th.win, seed);
      if (seed % 4 === 0) {
        const type = th.landmarks[(seed >> 2) % th.landmarks.length], col = th.near[(i + 1) % 2];
        SC.LANDMARKS[type](g, bx + w + 45, HORIZON, 0.5, col, shade(col, 0.8), th.win, seed, S.t);
      }
    }
  }
  g.globalAlpha = 1;
}
function drawWorld() {
  const { a, b, m } = themeBlend(S.dist);
  const sky = g.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, mix(a.sky[0], b.sky[0], m)); sky.addColorStop(0.65, mix(a.sky[1], b.sky[1], m)); sky.addColorStop(1, mix(a.sky[2], b.sky[2], m));
  g.fillStyle = sky; g.fillRect(0, 0, W, HORIZON + 2);
  const sx = W * 0.72, sy = HORIZON - 170;
  const glow = g.createRadialGradient(sx, sy, 20, sx, sy, 200);
  glow.addColorStop(0, "rgba(255,240,190,.8)"); glow.addColorStop(1, "rgba(255,200,150,0)");
  g.fillStyle = glow; g.fillRect(sx - 200, sy - 200, 400, 400);
  g.fillStyle = mix(a.sun, b.sun, m); g.beginPath(); g.arc(sx, sy, 50, 0, 7); g.fill();
  g.fillStyle = "rgba(255,255,255,.55)";
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 230 + S.t * 12) % (W + 300)) - 150, cy = 70 + i * 45;
    g.beginPath(); g.ellipse(cx, cy, 70, 20, 0, 0, 7); g.ellipse(cx + 40, cy - 12, 45, 22, 0, 0, 7); g.fill();
  }
  skyline(a, 0, 1 - m); skyline(b, 0, m);
  skyline(a, 1, 1 - m); skyline(b, 1, m);
  // morros baixos cobrem a base dos prédios e emendam o horizonte com o chão
  const out = mix(a.outside, b.outside, m);
  for (const [k, amp, base, kk] of [[0.5, 14, 22, 0.7], [0.9, 10, 10, 0.85]]) {
    g.fillStyle = shade(out, kk); g.beginPath(); g.moveTo(0, HORIZON + 2);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, HORIZON - base - amp * Math.sin((x + S.dist * k + S.camX * 20) / 90) - amp * 0.5 * Math.sin((x + S.dist * k) / 37));
    g.lineTo(W, HORIZON + 2); g.closePath(); g.fill();
  }

  // terreno fora dos muros e decorações do país (desenhadas antes dos muros, que as cobrem)
  g.fillStyle = mix(a.outside, b.outside, m); g.fillRect(0, HORIZON, W, H - HORIZON);
  const api = { g, proj, box, side, shade, t: S.t };
  S.deco.filter(d => d.z + (d.d || 1) > 0.5).sort((p, q) => q.z - p.z).forEach(d => SC.drawProp(api, d, d.th));

  poly([proj(-WALL, 0, 0.5), proj(WALL, 0, 0.5), proj(WALL, 0, FAR), proj(-WALL, 0, FAR)], C.colors.ground);
  for (const l of [-1, 0, 1])
    poly([proj(l * LANE - 0.95, 0, 0.5), proj(l * LANE + 0.95, 0, 0.5), proj(l * LANE + 0.95, 0, FAR), proj(l * LANE - 0.95, 0, FAR)], shade(C.colors.ground, 0.82));
  const off = S.dist % 1.6;
  for (let z = FAR - off; z > 0.5; z -= 1.6) for (const l of [-1, 0, 1]) {
    const x0 = l * LANE - 0.9, x1 = l * LANE + 0.9;
    poly([proj(x0, 0, z), proj(x1, 0, z), proj(x1, 0, z + 0.4), proj(x0, 0, z + 0.4)], C.colors.sleeper);
  }
  for (const l of [-1, 0, 1]) for (const s of [-0.6, 0.6]) {
    const x = l * LANE + s;
    poly([proj(x - 0.07, 0, 0.5), proj(x + 0.07, 0, 0.5), proj(x + 0.07, 0, FAR), proj(x - 0.07, 0, FAR)], "#55575f");
    poly([proj(x - 0.06, 0.12, 0.5), proj(x + 0.06, 0.12, 0.5), proj(x + 0.06, 0.12, FAR), proj(x - 0.06, 0.12, FAR)], C.colors.rail);
  }
  // muros em trechos de 12 m: cor e cartazes do país daquele trecho, sem padrão fixo
  const SEG = 12, first = Math.floor(S.dist / SEG) * SEG;
  for (let wp = first + Math.ceil(FAR / SEG) * SEG; wp >= first; wp -= SEG) {
    const z = wp - S.dist, th = themeAt(wp), idx = wp / SEG;
    for (const sgn of [-1, 1]) {
      const x = sgn * WALL;
      side(x, 0, 2.2, z, z + SEG, th.wall);
      side(x, 2.2, 2.45, z, z + SEG, th.wallTop);
      side(x, 0, 2.2, z, z + 0.4, shade(th.wall, 0.75));
      if (hash(idx, sgn + 5) % 3) {
        const p0 = z + 1 + hash(idx, sgn + 7) % 4, len = 3 + hash(idx, sgn + 9) % 5;
        side(x, 0.45, 1.75, p0, p0 + len, shade(th.panels[hash(idx, sgn) % th.panels.length], 0.95));
        side(x, 0.6, 0.75, p0 + 0.4, p0 + len - 0.4, th.panels[(hash(idx, sgn) + 1) % th.panels.length]);
      }
    }
  }
  for (const sgn of [-1, 1]) {
    const x = sgn * WALL;
    const offP = S.dist % 24;
    for (let z = FAR - offP; z > 1; z -= 24) {
      box(x - sgn * 0.3, 0, z, 0.15, 5, 0.15, "#3b3f4a");
      const [lx, ly, s] = proj(x - sgn * 0.8, 5, z), [px] = proj(x - sgn * 0.3, 5, z);
      g.fillStyle = "#3b3f4a"; g.fillRect(Math.min(lx, px), ly - s * 0.05, Math.abs(lx - px), s * 0.1);
      g.fillStyle = "#fff3b0"; g.beginPath(); g.arc(lx, ly + s * 0.08, s * 0.12, 0, 7); g.fill();
    }
  }
  const fog = g.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 90);
  fog.addColorStop(0, "rgba(255,210,138,0)"); fog.addColorStop(0.3, C.colors.sky[2]); fog.addColorStop(1, "rgba(255,210,138,0)");
  g.fillStyle = fog; g.fillRect(0, HORIZON - 30, W, 120);
}

// ---------- objetos ----------
function drawRamp(o) {
  const x = o.lane * LANE, z0 = o.z, zEnd = o.z + o.d, zs = Math.max(z0, 0.4);
  if (zEnd <= zs) return;
  const h = z => TRAIN_H * (z - z0) / o.d, l = x - 1.02, r = x + 1.02;
  // laterais (triângulos) e estrutura por baixo
  if (l > S.camX) poly([proj(l, 0, zs), proj(l, 0, zEnd), proj(l, TRAIN_H, zEnd), proj(l, h(zs), zs)], "#8a4b16");
  if (r < S.camX) poly([proj(r, 0, zs), proj(r, 0, zEnd), proj(r, TRAIN_H, zEnd), proj(r, h(zs), zs)], "#8a4b16");
  // piso da rampa em ripas de madeira alternadas
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = Math.max(z0 + o.d * i / n, zs), b = z0 + o.d * (i + 1) / n;
    if (b <= a) continue;
    poly([proj(l, h(a), a), proj(r, h(a), a), proj(r, h(b), b), proj(l, h(b), b)], i % 2 ? "#e8913a" : "#d17a28");
  }
  // bordas de segurança
  for (const ex of [l, r]) poly([proj(ex - 0.08, h(zs) + 0.05, zs), proj(ex + 0.08, h(zs) + 0.05, zs), proj(ex + 0.08, TRAIN_H + 0.05, zEnd), proj(ex - 0.08, TRAIN_H + 0.05, zEnd)], "#ffd23f");
  if (z0 >= 0.4) face(l, 0, r, 0.08, z0, "#ffd23f"); // ponta da rampa no chão
}
function drawTrain(o) {
  const x = o.lane * LANE, w = 2.1, z = o.z, d = o.d, col = o.col;
  box(x, 0, z + 0.3, w * 0.8, 0.5, d - 0.6, "#24252c");
  box(x, 0.45, z, w, 2.75, d, col);
  box(x, 3.2, z + 0.4, w * 0.75, TRAIN_H - 3.2, d - 0.8, shade(col, 0.7));
  const l = x - w / 2, r = x + w / 2, fx = l > S.camX ? l : r < S.camX ? r : null;
  if (fx !== null) {
    side(fx, 1.25, 1.5, z, z + d, "rgba(255,255,255,.85)");
    for (let wz = z + 1.5; wz < z + d - 1.8; wz += 2.6) side(fx, 1.9, 2.85, wz, wz + 1.7, "#bfe6f7");
    for (let wz = z + 1; wz < z + d; wz += 5) side(fx, 0.05, 0.4, wz, wz + 0.9, "#111");
  }
  if (z < 0.5) return;
  face(l, 1.25, r, 1.5, z, "rgba(255,255,255,.85)");
  face(x - 0.85, 2.05, x - 0.08, 2.95, z, "#1d2b3a");
  face(x + 0.08, 2.05, x + 0.85, 2.95, z, "#1d2b3a");
  face(x - 0.8, 2.6, x - 0.5, 2.9, z, "rgba(255,255,255,.35)");
  face(x - 0.95, 0.45, x + 0.95, 0.62, z, "#2a2b33");
  const lit = o.move ? (Math.floor(S.t * 8) % 2 ? "#fff36b" : "#ffffff") : "#ffe9b0";
  for (const hx of [-0.62, 0.62]) {
    const [cx, cy, s] = proj(x + hx, 0.9, z);
    if (o.move) { const gl = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.7); gl.addColorStop(0, "rgba(255,250,180,.7)"); gl.addColorStop(1, "rgba(255,250,180,0)"); g.fillStyle = gl; g.fillRect(cx - s, cy - s, s * 2, s * 2); }
    g.fillStyle = lit; g.beginPath(); g.arc(cx, cy, s * 0.14, 0, 7); g.fill();
  }
  const [nx, ny, s] = proj(x, 1.78, z);
  g.fillStyle = "#fff"; g.font = `900 ${s * 0.32}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(o.num, nx, ny);
}
function stripes(x0, y0, x1, y1, z, a, b, n) {
  for (let i = 0; i < n; i++) face(x0 + (x1 - x0) * i / n, y0, x0 + (x1 - x0) * (i + 1) / n, y1, z, i % 2 ? a : b);
}
function blink(x, y, z) {
  if (z < 0.5 || Math.floor(S.t * 4) % 2) return;
  const [cx, cy, s] = proj(x, y, z); g.fillStyle = "#ff9f1c"; g.beginPath(); g.arc(cx, cy, s * 0.08, 0, 7); g.fill();
}
function drawObj(o) {
  const x = o.lane * LANE;
  if (o.t === "train") return drawTrain(o);
  if (o.t === "ramp") return drawRamp(o);
  if (o.t === "low") {        // cerca baixa e fechada: só passa pulando
    box(x, 0, o.z, 2, 1.0, 0.3, "#d8d8d8");
    stripes(x - 1, 0.1, x + 1, 0.95, o.z, "#e8525c", "#ffffff", 8);
    blink(x + 0.85, 1.12, o.z);
  } else if (o.t === "mid") { // barra suspensa com vão embaixo: pula por cima ou rola por baixo
    for (const lx of [-0.9, 0.9]) box(x + lx, 0, o.z + 0.05, 0.12, 1.35, 0.12, "#3b3f4a");
    box(x, 0.85, o.z, 2, 0.5, 0.15, "#f2f2f2");
    stripes(x - 1, 0.88, x + 1, 1.32, o.z, "#2f7df6", "#ffffff", 8);
    blink(x - 0.85, 1.48, o.z);
  } else if (o.t === "high") { // painel alto com vão embaixo: só passa rolando
    for (const lx of [-0.94, 0.94]) box(x + lx, 0, o.z, 0.14, 3.3, 0.14, "#34363f");
    box(x, 1.15, o.z, 2, 2.1, 0.18, "#ffcf3a");
    stripes(x - 1, 1.2, x + 1, 1.5, o.z, "#222", "#ffcf3a", 10);
    stripes(x - 1, 2.9, x + 1, 3.2, o.z, "#222", "#ffcf3a", 10);
    blink(x, 3.4, o.z);
  } else if (o.t === "coin") {
    if (o.z < 0.5) return;
    const [cx, cy, s] = proj(x, o.y, o.z), spin = Math.sin(S.t * 5 + o.z), w = Math.abs(spin) * s * 0.34 + 1, h = s * 0.34;
    g.fillStyle = "#c68a00"; g.beginPath(); g.ellipse(cx + (spin > 0 ? 1 : -1) * s * 0.03, cy, w, h, 0, 0, 7); g.fill();
    g.fillStyle = C.colors.coin; g.beginPath(); g.ellipse(cx, cy, w, h, 0, 0, 7); g.fill();
    g.fillStyle = "#fff1a8"; g.beginPath(); g.ellipse(cx, cy, w * 0.62, h * 0.62, 0, 0, 7); g.fill();
    g.fillStyle = C.colors.coin; g.beginPath(); g.ellipse(cx, cy, w * 0.45, h * 0.45, 0, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.ellipse(cx - w * 0.35, cy - h * 0.4, w * 0.15, h * 0.12, -0.6, 0, 7); g.fill();
  } else if (o.t === "power") {
    if (o.z < 0.5) return;
    const [cx, cy, s] = proj(x, o.y + Math.sin(S.t * 3) * 0.2, o.z);
    const gl = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.9);
    gl.addColorStop(0, "rgba(123,224,255,.8)"); gl.addColorStop(1, "rgba(123,224,255,0)");
    g.fillStyle = gl; g.fillRect(cx - s, cy - s, s * 2, s * 2);
    g.strokeStyle = "#fff"; g.lineWidth = s * 0.06; g.beginPath(); g.arc(cx, cy, s * 0.5, S.t * 3, S.t * 3 + 4.5); g.stroke();
    g.fillStyle = "#1a3a5c"; g.beginPath(); g.arc(cx, cy, s * 0.42, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.font = `bold ${s * 0.45}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText({ board: "🛹", magnet: "🧲", double: "2X" }[o.kind], cx, cy);
  }
}

// ---------- personagem original: capivara de moletom, fone e mochila ----------
function ell(x, y, rx, ry, col, rot = 0) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, 7); g.fill(); }
function rrect(x, y, w, h, r, col) { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function drawPlayer() {
  const [px, py, ps] = proj(S.x, S.y, PZ), [, gy] = proj(S.x, S.floor, PZ), s = ps * 1.3;
  if (S.shield > 0) {
    const gl = g.createRadialGradient(px, py - s * 0.6, s * 0.3, px, py - s * 0.6, s * 1.1);
    gl.addColorStop(0, "rgba(123,224,255,0)"); gl.addColorStop(0.8, "rgba(123,224,255,.25)"); gl.addColorStop(1, "rgba(123,224,255,.7)");
    g.fillStyle = gl; g.beginPath(); g.arc(px, py - s * 0.6, s * 1.1, 0, 7); g.fill();
  }
  if (S.invuln > 0 && Math.floor(S.t * 12) % 2 && S.boardTime === 0) return;
  ell(px, gy, s * 0.55 / (1 + (S.y - S.floor) * 0.15), s * 0.14, "rgba(0,0,0,.3)");
  const onBoard = S.boardTime > 0;
  let by = py;
  if (onBoard) {
    by = py - s * 0.22 + Math.sin(S.t * 6) * s * 0.03;
    const gl = g.createRadialGradient(px, by + s * 0.12, 0, px, by + s * 0.12, s * 0.8);
    gl.addColorStop(0, "rgba(255,79,163,.5)"); gl.addColorStop(1, "rgba(255,79,163,0)");
    g.fillStyle = gl; g.fillRect(px - s, by - s * 0.5, s * 2, s);
    rrect(px - s * 0.62, by, s * 1.24, s * 0.13, s * 0.06, C.colors.board);
    rrect(px - s * 0.5, by + s * 0.02, s * 1.0, s * 0.04, s * 0.02, "#fff");
  }
  Characters.draw(g, px, by, s, Characters.byId(C.skin), {
    t: S.t, run: S.state === "run" && !onBoard, air: !S.grounded, roll: S.roll > 0, powerBoard: onBoard, look: S.look,
    lean: Math.max(-1, Math.min(1, (S.lane * LANE - S.x) / LANE * 1.6)),      // inclina para o lado da troca de pista
    stretch: !S.grounded && S.vy > 0 ? Math.min(1, S.vy / 13) : 0,             // estica subindo no pulo
    squash: (S.landT || 0) / 0.18,                                             // amassa ao aterrissar
    stumble: S.stumble > 0 ? S.stumble / 0.6 : 0                               // cambaleia depois de bater
  });
}

// ---------- avatar com expressões (reage à live) ----------
function react(mood, secs) {
  S.mood = mood; S.moodT = secs;
  if (mood === "shock") { S.lookT = 0.8; S.lookDir = pick([-1, 1]); } // vira pra trás pra ver o que aconteceu
}
function drawAvatar(cx, cy, r) {
  const sk = Characters.byId(C.skin);
  const mood = S.mood || (S.state !== "run" ? "happy" : S.reverseFx > 0 || S.darkFx > 0 ? "sad" : "focus");
  const ring = { laugh: "#3ee07a", shock: "#ff4f6d", sad: "#9b7bff" }[mood] || "#ffffff";
  const bounce = S.moodT ? Math.sin(S.t * 18) * 3 * Math.min(1, S.moodT) : 0;
  cy += bounce;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, 7);
  const bg = g.createLinearGradient(0, cy - r, 0, cy + r);
  bg.addColorStop(0, S.theme ? S.theme.sky[1] : "#ff8f70"); bg.addColorStop(1, S.theme ? S.theme.sky[2] : "#ffd28a");
  g.fillStyle = bg; g.fill(); g.clip();
  Characters.portrait(g, cx, cy, r, sk, mood, S.t);
  g.restore();
  g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,.55)"; g.beginPath(); g.arc(cx, cy, r + 2, 0, 7); g.stroke();
  g.lineWidth = 4; g.strokeStyle = ring; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
}

// ---------- menu do jogo: Jogar, Personagem, Mapa, Som e Controles ----------
// as escolhas feitas aqui são salvas nas mesmas configurações do painel (e aparecem lá)
const MENU = { screen: "main", sel: 0, hits: [] };
const MENU_MAIN = [["play", "▶  JOGAR"], ["skin", "🦫  PERSONAGEM"], ["map", "🗺️  MAPA"], ["sound", "🔊  SOM"], ["controls", "🎮  CONTROLES"]];
const SOUND_ROWS = ["master", "music", "sfx", "mute", "back"];
const mapChoices = () => ["auto", ...TH.map(t => t.name)];
function saveFromGame(patch) {
  Object.assign(C, patch);
  try { localStorage.setItem("capivara-settings", JSON.stringify({ ...(JSON.parse(localStorage.getItem("capivara-settings")) || {}), ...patch })); } catch {}
  if (location.protocol.startsWith("http")) { // junta com o que já está salvo no servidor (regras, sons…) e grava
    fetch("/api/settings").then(r => r.ok ? r.json() : {}).then(s => fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, ...patch }) })).catch(() => {});
    fetch("/api/cmd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "gamePatch", patch }) }).catch(() => {}); // avisa o painel
  }
}
function menuGo(screen) { MENU.screen = screen; MENU.sel = 0; Sound.play("lane"); }
function cycleSkin(d) {
  const list = Characters.SKINS, i = list.indexOf(Characters.byId(C.skin));
  saveFromGame({ skin: list[(i + d + list.length) % list.length].id }); Sound.play("coin");
}
function cycleMap(d) {
  const list = mapChoices(), cur = C.theme && list.includes(C.theme) ? C.theme : TH[S.themeOrder[0]].name;
  const i = list.indexOf(cur);
  saveFromGame({ theme: list[(i + d + list.length) % list.length] }); refreshScenery(); Sound.play("coin");
}
function nudgeVolume(key, d) {
  // passos exatos de 10% (sem erro de arredondamento do ponto flutuante)
  const v = Sound.volumes, nv = Math.max(0, Math.min(10, Math.round(v[key] * 10 + 1e-6) + Math.sign(d))) / 10;
  Sound.setVolumes({ [key]: nv }); saveFromGame({ sound: { ...(C.sound || {}), ...Sound.volumes } });
  Sound.play(key === "sfx" ? "jump" : "coin");
}
// itens do menu principal: aberto no meio de uma partida, ganha "Continuar" (sem perder a distância) e "Nova partida"
function mainItems() {
  return S.resumable ? [["play", "▶  CONTINUAR"], ["new", "🔄  NOVA PARTIDA"], ...MENU_MAIN.slice(1)] : MENU_MAIN;
}
// abre o menu: pelo botão da pausa, pelo painel ou pela tecla de pausa já no menu de pausa
function openMenu() {
  if (S.state === "run") S.resumable = true;
  S.state = "menu"; S.paused = false; Sound.stopMusic();
  MENU.screen = "main"; MENU.sel = 0;
}
function resumeRun() { S.state = "run"; S.resumable = false; Sound.startMusic(); }
function menuKey(a) {
  const scr = MENU.screen, items = mainItems();
  if (scr === "main") {
    if (a === "up" || a === "down") { MENU.sel = (MENU.sel + (a === "down" ? 1 : -1) + items.length) % items.length; Sound.play("lane"); }
    if (a === "ok") {
      const id = (items[MENU.sel] || items[0])[0];
      if (id === "play") S.resumable ? resumeRun() : start();
      else if (id === "new") { S.resumable = false; start(); }
      else menuGo(id);
    }
    return;
  }
  if (a === "back") return menuGo("main");
  if (scr === "skin") { if (a === "left" || a === "right") cycleSkin(a === "right" ? 1 : -1); if (a === "ok") menuGo("main"); }
  else if (scr === "map") { if (a === "left" || a === "right") cycleMap(a === "right" ? 1 : -1); if (a === "ok") menuGo("main"); }
  else if (scr === "sound") {
    if (a === "up" || a === "down") MENU.sel = (MENU.sel + (a === "down" ? 1 : -1) + SOUND_ROWS.length) % SOUND_ROWS.length;
    const row = SOUND_ROWS[MENU.sel];
    if ((a === "left" || a === "right") && (row === "master" || row === "music" || row === "sfx")) nudgeVolume(row, a === "right" ? 0.1 : -0.1);
    if (a === "ok") { if (row === "mute") Sound.toggleMute(); else if (row === "back") menuGo("main"); }
  } else if (a === "ok") menuGo("main");
}
function menuClick(x, y) {
  const h = MENU.hits.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  if (h) h.fn();
}
function menuHover(x, y) {
  const h = MENU.hits.find(b => b.sel !== undefined && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  if (h && MENU.sel !== h.sel) MENU.sel = h.sel;
}
function menuButton(x, y, w, h, label, selected, fn, sel, size = 34) {
  MENU.hits.push({ x, y, w, h, fn, sel });
  const pop = selected ? 1 + Math.sin(S.t * 6) * 0.02 : 1;
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(pop, pop);
  rrect(-w / 2, -h / 2 + 6, w, h, h / 2, "rgba(0,0,0,.35)");
  rrect(-w / 2, -h / 2, w, h, h / 2, selected ? "#ffd23f" : "rgba(20,14,36,.82)");
  g.lineWidth = 4; g.strokeStyle = selected ? "#fff6c8" : "rgba(255,255,255,.18)"; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.stroke();
  g.font = `900 ${size}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = selected ? "#1d1600" : "#fff"; g.fillText(label, 0, 2);
  g.restore();
}
function drawMenu() {
  MENU.hits = [];
  const T = hudTop(), scr = MENU.screen;
  g.fillStyle = "rgba(20,10,40,.55)"; g.fillRect(0, 0, W, H);
  const back = (y) => menuButton(W / 2 - 150, y, 300, 72, "↩  VOLTAR", scr === "sound" ? SOUND_ROWS[MENU.sel] === "back" : true, () => menuGo("main"), scr === "sound" ? 4 : undefined, 30);
  if (scr === "main") {
    text("CAPIVARA", W / 2, T + 70, 90, "#ffd23f");
    text("RUNNER", W / 2, T + 150, 90, "#ff4fa3");
    text(`Meta: ${C.goalMeters.toLocaleString("pt-BR")} m · 🏆 ${SESSION.wins} ${SESSION.wins === 1 ? "vitória" : "vitórias"}`, W / 2, T + 215, 28, "#fff");
    const items = mainItems(), gap = items.length > 5 ? 84 : 92;
    items.forEach(([id, label], i) => menuButton(W / 2 - 230, T + 260 + i * gap, 460, 72, label, MENU.sel === i, () => { MENU.sel = i; menuKey("ok"); }, i, id === "play" ? 38 : 30));
    const sk = Characters.byId(C.skin);
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(W / 2, H * 0.93, 100, 18, 0, 0, 7); g.fill();
    Characters.draw(g, W / 2, H * 0.93, 150, sk, { t: S.t, view: "front", mood: (S.t % 5) > 4 ? "laugh" : "happy", wave: (S.t % 5) < 2 });
    text("setas + Enter, ou toque/clique", W / 2, H * 0.97, 20, "#cfc8e8");
  } else if (scr === "skin") {
    const list = Characters.SKINS, sk = Characters.byId(C.skin), i = list.indexOf(sk);
    text("PERSONAGEM", W / 2, T + 70, 64, "#ffd23f");
    text(`${i + 1} / ${list.length}`, W / 2, T + 125, 26, "#cfc8e8");
    const gl = g.createRadialGradient(W / 2, H * 0.5, 40, W / 2, H * 0.5, 320);
    gl.addColorStop(0, "rgba(255,210,63,.35)"); gl.addColorStop(1, "rgba(255,210,63,0)");
    g.fillStyle = gl; g.fillRect(0, H * 0.2, W, H * 0.6);
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(W / 2, H * 0.66, 140, 26, 0, 0, 7); g.fill();
    Characters.draw(g, W / 2, H * 0.66, 300, sk, { t: S.t, view: "front", mood: (S.t % 4) > 3 ? "laugh" : "happy", wave: (S.t % 4) < 1.4 });
    text(sk.name, W / 2, H * 0.7, 46, "#fff");
    text(sk.desc, W / 2, H * 0.74, 26, "#cfc8e8");
    menuButton(30, H * 0.45, 90, 110, "◀", false, () => cycleSkin(-1), undefined, 48);
    menuButton(W - 120, H * 0.45, 90, 110, "▶", false, () => cycleSkin(1), undefined, 48);
    menuButton(W / 2 - 180, H * 0.79, 360, 80, "✔  ESCOLHER", true, () => menuGo("main"), undefined, 34);
  } else if (scr === "map") {
    const list = mapChoices(), cur = C.theme && list.includes(C.theme) ? C.theme : TH[S.themeOrder[0]].name;
    const th = TH.find(t => t.name === cur);
    text("MAPA", W / 2, T + 70, 64, "#ffd23f");
    text(`${list.indexOf(cur) + 1} / ${list.length}`, W / 2, T + 125, 26, "#cfc8e8");
    rrect(W / 2 - 220, H * 0.4, 440, 230, 30, "rgba(20,14,36,.8)");
    if (th) SC.flag(g, W / 2 - 75, H * 0.4 + 30, 150, 100, th.flag);
    else text("🔀", W / 2, H * 0.4 + 80, 90, "#fff");
    text(th ? th.name : "Automático", W / 2, H * 0.4 + 170, 46, "#fff");
    text(th ? "o caminho fica neste país" : `troca de país a cada ${TLEN.toLocaleString("pt-BR")} m`, W / 2, H * 0.4 + 210, 22, "#cfc8e8");
    menuButton(30, H * 0.45, 90, 110, "◀", false, () => cycleMap(-1), undefined, 48);
    menuButton(W - 120, H * 0.45, 90, 110, "▶", false, () => cycleMap(1), undefined, 48);
    menuButton(W / 2 - 180, H * 0.79, 360, 80, "✔  ESCOLHER", true, () => menuGo("main"), undefined, 34);
  } else if (scr === "sound") {
    text("SOM", W / 2, T + 70, 64, "#ffd23f");
    const v = Sound.volumes;
    [["master", "🔊 Volume geral"], ["music", "🎵 Música"], ["sfx", "💥 Efeitos"]].forEach(([k, label], i) => {
      const y = T + 180 + i * 140, selected = SOUND_ROWS[MENU.sel] === k;
      MENU.hits.push({ x: 40, y: y - 30, w: W - 80, h: 120, fn: () => { MENU.sel = i; }, sel: i });
      rrect(40, y - 30, W - 80, 120, 24, selected ? "rgba(255,210,63,.18)" : "rgba(20,14,36,.8)");
      text(label, 70, y + 4, 32, "#fff", "left");
      text(`${Math.round(v[k] * 100)}%`, W - 70, y + 4, 32, "#ffd23f", "right");
      const bx = 150, bw = W - 300;
      rrect(bx, y + 44, bw, 20, 10, "rgba(255,255,255,.15)");
      if (v[k] > 0) rrect(bx, y + 44, Math.max(20, bw * v[k]), 20, 10, "#ffd23f");
      menuButton(60, y + 28, 70, 52, "−", false, () => { MENU.sel = i; nudgeVolume(k, -0.1); }, undefined, 34);
      menuButton(W - 130, y + 28, 70, 52, "+", false, () => { MENU.sel = i; nudgeVolume(k, 0.1); }, undefined, 34);
    });
    menuButton(W / 2 - 200, T + 610, 400, 76, Sound.muted ? "🔇  SOM DESLIGADO" : "🔊  SOM LIGADO", SOUND_ROWS[MENU.sel] === "mute", () => { MENU.sel = 3; Sound.toggleMute(); }, 3, 30);
    back(T + 710);
  } else if (scr === "controls") {
    text("CONTROLES", W / 2, T + 70, 64, "#ffd23f");
    const names = { left: "Esquerda", right: "Direita", up: "Pular", down: "Abaixar / rolar", pause: "Pausar", bot: "Bot", mute: "Som" };
    const keyName = c => ({ ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Space: "Espaço", Escape: "Esc" }[c] || c.replace(/^Key|^Digit/, ""));
    Object.entries(names).forEach(([k, label], i) => {
      const y = T + 170 + i * 66;
      rrect(60, y - 26, W - 120, 54, 16, "rgba(20,14,36,.8)");
      text(label, 84, y, 26, "#fff", "left");
      text(((C.binds || {})[k] || []).map(keyName).join("  ·  ") || "—", W - 84, y, 26, "#ffd23f", "right");
    });
    text("Celular: deslize para os lados, para cima e para baixo", W / 2, T + 170 + 7 * 66, 22, "#cfc8e8");
    text("As teclas podem ser trocadas no painel", W / 2, T + 205 + 7 * 66, 22, "#cfc8e8");
    back(T + 260 + 7 * 66);
  }
}

// ---------- hype: efeitos que crescem com o valor do presente e com o combo ----------
const CONFETTI = ["#ffd23f", "#ff4fa3", "#3ee07a", "#7be0ff", "#9b7bff", "#ff7a2f", "#ffffff"];
function confettiBurst(n, x, y, spread = 1) {
  for (let i = 0; i < n && S.confetti.length < 400; i++) {
    const a = rnd(-Math.PI, 0), v = rnd(300, 900) * spread;
    S.confetti.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, 6), vr: rnd(-12, 12), w: rnd(8, 16), h: rnd(5, 9), col: pick(CONFETTI), life: rnd(2.5, 4) });
  }
}
function confettiRain(n) {
  for (let i = 0; i < n && S.confetti.length < 400; i++)
    S.confetti.push({ x: rnd(0, W), y: rnd(-60, -10), vx: rnd(-60, 60), vy: rnd(150, 350), rot: rnd(0, 6), vr: rnd(-8, 8), w: rnd(8, 16), h: rnd(5, 9), col: pick(CONFETTI), life: rnd(4, 6) });
}
function hype(tier, help, win) {
  if (win) { S.flash = 1; S.flashCol = "#ffd23f"; S.shakeT = 0.8; S.shakeA = 22; confettiRain(160); confettiBurst(120, W / 2, 420, 1.3); return; }
  S.flash = [0.25, 0.4, 0.6, 0.8, 1][tier]; S.flashCol = help ? "#3ee07a" : "#ff4f6d";
  if (tier >= 1) { S.shakeT = 0.25 + tier * 0.12; S.shakeA = 4 + tier * 4; }
  confettiBurst([12, 25, 50, 90, 140][tier], W / 2, hudTop() + 430, 0.6 + tier * 0.15);
  if (tier >= 3) confettiRain(80);
}
function updateHype(dt) {
  S.comboT = Math.max(0, S.comboT - dt);
  S.flash = Math.max(0, S.flash - dt * 2.2);
  S.shakeT = Math.max(0, S.shakeT - dt);
  for (const c of S.confetti) { c.vy += 700 * dt; c.vx *= 0.99; c.vy = Math.min(c.vy, 420); c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; c.life -= dt; }
  S.confetti = S.confetti.filter(c => c.life > 0 && c.y < H + 30);
  // fila de alertas: cada um fica ~3 s (menos quando tem muita gente doando)
  const a = S.alerts[0];
  if (a) { a.t += dt * (S.alerts.length > 2 ? 1.6 : 1); if (a.t > (a.win ? 5 : 3.2)) S.alerts.shift(); }
  // metas a cada 10% do caminho
  if (S.state === "run") {
    const ms = Math.floor(S.dist / C.goalMeters * 10);
    if (ms > S.milestone && ms < 10) {
      S.alerts.push({ milestone: true, who: `${ms * 10}% DA META!`, gift: `${Math.floor(S.dist).toLocaleString("pt-BR")} m percorridos`, effect: "🎉", help: true, t: 0, tier: 2 });
      confettiRain(70); Sound.play("tada");
    }
    S.milestone = Math.max(S.milestone, ms);
    if (ms < S.milestone) S.milestone = ms; // voltou por doação: a meta pode ser comemorada de novo
  }
}
// cartão do alerta: nome de quem doou (ou o presente, nas simulações), imagem do presente e o efeito
function drawAlert() {
  const a = S.alerts[0];
  if (!a) return;
  const dur = a.win ? 5 : 3.2, tin = Math.min(1, a.t / 0.25), tout = Math.min(1, (dur - a.t) / 0.25);
  const k = Math.min(tin, tout), pop = 1 + Math.sin(Math.min(1, a.t / 0.35) * Math.PI) * 0.12;
  const cw = 600, ch = 124, cx = W / 2, cy = hudTop() + 430 + (1 - k) * 30;
  const col = a.win || a.milestone ? "#ffd23f" : a.help ? "#3ee07a" : "#ff4f6d";
  g.save(); g.globalAlpha = k; g.translate(cx, cy); g.scale(pop * (0.85 + 0.15 * k), pop * (0.85 + 0.15 * k));
  // brilho atrás
  const gl = g.createRadialGradient(0, 0, 40, 0, 0, 360);
  gl.addColorStop(0, col + "66"); gl.addColorStop(1, col + "00");
  g.fillStyle = gl; g.fillRect(-360, -200, 720, 400);
  rrect(-cw / 2, -ch / 2, cw, ch, 26, "rgba(14,10,24,.88)");
  g.lineWidth = 5; g.strokeStyle = col; g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, 26); g.stroke();
  // imagem do presente
  const im = giftImage(a.img), ix = -cw / 2 + 74;
  if (im) g.drawImage(im, ix - 46, -46, 92, 92);
  else text(a.milestone ? "🚩" : a.win ? "🏆" : "🎁", ix, 2, 64, "#fff");
  // textos
  const tx = ix + 66, title = a.who || a.title || a.gift || "Presente", sub = a.who && !a.milestone ? `mandou ${a.gift || "um presente"}` : a.milestone ? a.gift : "";
  g.font = "900 40px system-ui"; let size = 40;
  while (g.measureText(title).width > 300 && size > 22) { size -= 2; g.font = `900 ${size}px system-ui`; }
  text(title, tx, sub ? -16 : 0, size, "#fff", "left");
  if (sub) text(sub, tx, 26, 24, "#d9d3ee", "left");
  // efeito em destaque
  if (!a.milestone) {
    g.font = "900 34px system-ui"; const ew = Math.max(120, g.measureText(a.effect).width + 36);
    rrect(cw / 2 - ew - 18, -28, ew, 56, 28, col);
    g.fillStyle = "#14101c"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(a.effect, cw / 2 - 18 - ew / 2, 1);
  }
  // combo
  if (a.combo >= 2 && !a.milestone) {
    g.save(); g.translate(cw / 2 - 40, -ch / 2 - 6); g.rotate(0.12);
    rrect(-78, -22, 156, 44, 22, "#ff4fa3");
    text(`COMBO x${a.combo}`, 0, 1, 26, "#fff");
    g.restore();
  }
  g.restore();
}
function drawConfetti() {
  for (const c of S.confetti) {
    g.save(); g.globalAlpha = Math.min(1, c.life); g.translate(c.x, c.y); g.rotate(c.rot);
    g.fillStyle = c.col; g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.rot * 1.7)) + 1);
    g.restore();
  }
}
// placar do cabo de guerra: metros que o time Ajuda e o time Atrapalha já moveram nesta partida
// sempre com rótulo, para o público entender; antes da 1ª doação fica dividido ao meio
function drawTeams(y) {
  const { help, hurt } = S.team, tot = help + hurt;
  const x0 = 40, w = W - 80, hw = tot ? w * (help / tot) : w / 2;
  const short = v => v >= 10000 ? (v / 1000).toFixed(0) + " mil" : Math.round(v).toLocaleString("pt-BR");
  rrect(x0, y, w, 30, 15, tot ? "#ff4f6d" : "rgba(255,79,109,.45)");
  if (hw > 0) { g.fillStyle = tot ? "#3ee07a" : "rgba(62,224,122,.45)"; g.beginPath(); g.roundRect(x0, y, Math.max(30, hw), 30, 15); g.fill(); }
  g.fillStyle = "#fff"; g.fillRect(x0 + hw - 2, y - 4, 4, 38);
  text(`😇 AJUDA ${short(help)} m`, x0 + 12, y + 15, 19, "#fff", "left");
  text(`${short(hurt)} m ATRAPALHA 😈`, x0 + w - 12, y + 15, 19, "#fff", "right");
}
function topDonors(n) {
  return Object.values(S.donors).sort((a, b) => b.coins - a.coins).slice(0, n);
}
function drawTop(x, y) {
  const top = topDonors(3);
  if (!top.length) return;
  text("🏆 TOP DA PARTIDA", x, y, 22, "#ffd23f", "right");
  const medals = ["🥇", "🥈", "🥉"];
  top.forEach((d, i) => text(`${d.name.slice(0, 14)} ${medals[i]} ${d.coins.toLocaleString("pt-BR")}🪙`, x, y + 32 + i * 30, 21, "#fff", "right"));
}
// faixa no rodapé: o que cada presente faz (montada das regras do painel)
function legendItems() {
  return (C.donationRules || []).map(r => {
    const m = Number(r.meters) || 0, win = r.effect === "win";
    const fx = r.effect && FX[r.effect] && !win ? " " + FX[r.effect].label.split(" ")[0] : "";
    const what = win ? "VITÓRIA!" : `${m > 0 ? "−" : "+"}${Math.abs(m).toLocaleString("pt-BR")} m${fx}`;
    const name = r.gift ? ((r.minCount || 1) > 1 ? `${r.minCount}× ${r.gift}` : r.gift) : (r.minCoins > 1 ? `${r.minCoins}+🪙` : "qualquer presente");
    return { img: r.giftImg, name, what, help: win || m < 0 };
  });
}
const hudOn = k => !C.hud || C.hud[k] !== false;
function drawLegend(y) {
  if (C.showLegend === false || !hudOn("legend")) return;
  const items = legendItems();
  if (!items.length) return;
  g.fillStyle = "rgba(10,8,18,.72)"; g.fillRect(0, y - 24, W, 50);
  g.save(); g.beginPath(); g.rect(0, y - 24, W, 50); g.clip();
  g.font = "900 22px system-ui";
  const widths = items.map(it => 40 + g.measureText(`${it.name} → ${it.what}`).width + 40);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = -(S.legendX % total);
  for (let rep = 0; x < W; rep++) items.forEach((it, i) => {
    if (x > W) return;
    const im = giftImage(it.img);
    if (im) g.drawImage(im, x, y - 17, 34, 34); else text("🎁", x + 17, y, 24, "#fff");
    text(it.name, x + 40, y, 22, "#fff", "left");
    const nw = g.measureText(it.name).width;
    text(` → ${it.what}`, x + 40 + nw, y, 22, it.help ? "#8dffb0" : "#ffb3c1", "left");
    x += widths[i];
  });
  g.restore();
}

// ---------- HUD ----------
function text(t, x, y, size, col, align = "center") {
  g.font = `900 ${size}px system-ui`; g.textAlign = align; g.textBaseline = "middle";
  g.lineWidth = size / 6; g.strokeStyle = "#000"; g.lineJoin = "round"; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y);
}
// Layout na "área segura" da TikTok LIVE: o topo (nome, espectadores) e o terço de baixo (comentários,
// barra de presentes) ficam cobertos pela interface do app, então as informações começam em hudTop
// e vão só até a altura do personagem.
const hudTop = () => Math.max(0, Number(C.hudTop) || 0);
function drawHUD() {
  if (S.state === "menu") return drawMenu(); // o menu ocupa a tela toda, sem o placar por trás
  const T = hudTop();
  const left = Math.max(0, C.goalMeters - S.dist);
  const p = S.dist / C.goalMeters, final = p >= 0.9 && S.state === "run";
  text(`${Math.floor(S.dist).toLocaleString("pt-BR")} m`, W / 2, T + 46, 56, "#fff");
  if (final) { // reta final: pulsa em vermelho para criar tensão (ajudar a ganhar × atrapalhar no fim)
    const pulse = 1 + Math.sin(S.t * 8) * 0.06;
    g.save(); g.translate(W / 2, T + 96); g.scale(pulse, pulse);
    text(`🔥 RETA FINAL · faltam ${Math.ceil(left).toLocaleString("pt-BR")} m 🔥`, 0, 0, 28, "#ff6b6b");
    g.restore();
  } else text(`faltam ${Math.ceil(left).toLocaleString("pt-BR")} m`, W / 2, T + 96, 28, "#ffe08a");
  const by = T + 120;
  rrect(40, by, W - 80, 24, 12, "rgba(0,0,0,.5)");
  if (p > 0) {
    const bar = g.createLinearGradient(40, 0, W - 40, 0); bar.addColorStop(0, "#3ee07a"); bar.addColorStop(1, final ? "#ff4f6d" : "#ffd23f");
    g.fillStyle = bar; g.beginPath(); g.roundRect(40, by, Math.max(24, (W - 80) * p), 24, 12); g.fill();
  }
  for (let i = 1; i < 10; i++) { g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(40 + (W - 80) * i / 10 - 1, by + 4, 2, 16); } // marcas das metas
  text("🏁", W - 40, by + 12, 30, "#fff");
  if (hudOn("teams")) drawTeams(T + 156);
  drawLegend(T + 220);
  // coluna da esquerda: vitórias da sessão, moedas e o medidor da próxima regra de likes
  let ly = T + 276;
  if (hudOn("wins")) { text(`🏆 ${SESSION.wins} ${SESSION.wins === 1 ? "vitória" : "vitórias"}`, 30, ly, 28, "#ffd23f", "left"); ly += 34; }
  if (hudOn("coins")) { text(`🪙 ${S.coins} moedas`, 30, ly, 22, "#ffe9a8", "left"); ly += 30; }
  const lr = likeRules()[0];
  if (lr && hudOn("likes")) {
    const i = likeRules().indexOf(lr), cnt = S.likeCounts[i] || 0, lp = Math.min(1, cnt / lr.every);
    const m = Number(lr.meters) || 0, what = lr.effect === "win" ? "vitória" : `${m > 0 ? "−" : "+"}${Math.abs(m).toLocaleString("pt-BR")} m`;
    text(`❤️ ${cnt}/${lr.every} likes = ${what}`, 30, ly, 18, "#ffd0e4", "left");
    rrect(30, ly + 12, 200, 12, 6, "rgba(0,0,0,.5)");
    if (lp > 0) rrect(30, ly + 12, Math.max(12, 200 * lp), 12, 6, "#ff6fae");
  }
  if (hudOn("avatar")) drawAvatar(W - 72, T + 300, 46);
  if (Sound.muted) text("🔇", W - 130, T + 280, 26, "#fff", "right");
  const fx = [];
  if (S.boardTime > 0) fx.push(`🛹 ${S.boardTime | 0}s`);
  if (S.shield > 0) fx.push(`🛡️ ${S.shield | 0}s`);
  if (S.magnet > 0) fx.push(`🧲 ${S.magnet | 0}s`);
  if (S.double > 0) fx.push(`2X ${S.double | 0}s`);
  if (S.speedFx > 0) fx.push(`⚡ ${S.speedFx | 0}s`);
  if (S.slowFx > 0) fx.push(`🐢 ${S.slowFx | 0}s`);
  if (S.reverseFx > 0) fx.push(`🔄 INVERTIDO ${S.reverseFx | 0}s`);
  if (S.darkFx > 0) fx.push(`🌑 ${S.darkFx | 0}s`);
  fx.forEach((f, i) => text(f, W - 30, T + 372 + i * 34, 24, "#7be0ff", "right"));
  // doações recentes (esquerda) e ranking (direita), acima da altura do personagem
  if (hudOn("feed")) S.feed.forEach((f, i) => {
    g.globalAlpha = Math.max(0.35, 1 - f.t / 20);
    text(f.text.length > 21 ? f.text.slice(0, 20) + "…" : f.text, 30, T + 380 + i * 30, 21, f.help ? "#8dffb0" : "#ffb3c1", "left");
    g.globalAlpha = 1;
  });
  if (hudOn("top")) drawTop(W - 30, T + 380 + Math.max(0, Math.min(fx.length, 3)) * 34);
  if (S.banner > 0 && S.theme) { // placa de "chegou em outro país"
    g.globalAlpha = Math.min(1, S.banner, (4 - S.banner) * 3);
    g.font = "900 26px system-ui"; const tw = g.measureText(S.theme.name).width, x0 = W / 2 - (tw + 56) / 2;
    rrect(x0 - 12, T + 268, tw + 80, 44, 22, "rgba(0,0,0,.45)");
    SC.flag(g, x0, T + 276, 42, 28, S.theme.flag);
    text(S.theme.name, x0 + 52, T + 290, 26, "#fff", "left");
    g.globalAlpha = 1;
  }
  if (S.state === "run") drawAlert();
  S.popups.forEach((p, i) => {
    g.globalAlpha = Math.min(1, p.t);
    const y = H * 0.45 + i * 90 - (3.5 - p.t) * 20;
    text(p.a, W / 2, y, 38, p.col); if (p.b) text(p.b, W / 2, y + 42, 30, "#fff");
    g.globalAlpha = 1;
  });
  if (S.paused) { // tela de pausa com Continuar e Menu principal
    MENU.hits = [];
    g.fillStyle = "rgba(20,10,40,.6)"; g.fillRect(0, 0, W, H);
    rrect(W / 2 - 44, H * 0.3 - 50, 30, 100, 8, "#fff"); rrect(W / 2 + 14, H * 0.3 - 50, 30, 100, 8, "#fff");
    text("PAUSADO", W / 2, H * 0.3 + 100, 56, "#fff");
    menuButton(W / 2 - 220, H * 0.44, 440, 80, "▶  CONTINUAR", MENU.sel !== 1, () => togglePause(), 0, 36);
    menuButton(W / 2 - 220, H * 0.44 + 100, 440, 80, "🏠  MENU PRINCIPAL", MENU.sel === 1, () => openMenu(), 1, 32);
    text("a distância da partida não se perde", W / 2, H * 0.44 + 215, 22, "#cfc8e8");
  }
  if (S.state === "win") {
    g.fillStyle = "rgba(20,10,40,.62)"; g.fillRect(0, 0, W, H);
    // raios girando atrás do troféu
    g.save(); g.translate(W / 2, H * 0.3); g.rotate(S.t * 0.4);
    for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = i % 2 ? "rgba(255,210,63,.12)" : "rgba(255,255,255,.05)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(-60, -700); g.lineTo(60, -700); g.fill(); }
    g.restore();
    const bounce = 1 + Math.sin(S.t * 6) * 0.05;
    g.save(); g.translate(W / 2, H * 0.24); g.scale(bounce, bounce); text("🏆", 0, 0, 130, "#ffd23f"); g.restore();
    text("VITÓRIA!", W / 2, H * 0.36, 86, "#ffd23f");
    if (S.winner) {
      text("graças a", W / 2, H * 0.42, 30, "#fff");
      g.font = "900 54px system-ui"; let size = 54;
      while (g.measureText(S.winner).width > W - 80 && size > 28) { size -= 2; g.font = `900 ${size}px system-ui`; }
      text(S.winner, W / 2, H * 0.47, size, "#8dffb0");
    } else text("META BATIDA!", W / 2, H * 0.43, 44, "#fff");
    const sk = Characters.byId(C.skin);
    Characters.draw(g, W / 2, H * 0.78, 170, sk, { t: S.t, view: "front", mood: "laugh" });
    const top = topDonors(3);
    if (top.length) {
      text("🏆 HERÓIS DA PARTIDA", W / 2, H * 0.53, 28, "#ffd23f");
      top.forEach((d, i) => text(`${["🥇", "🥈", "🥉"][i]} ${d.name}  ${d.coins.toLocaleString("pt-BR")}🪙`, W / 2, H * 0.53 + 40 + i * 36, 26, "#fff"));
    }
    if (hudOn("wins")) text(`🏆 ${SESSION.wins}ª vitória da sessão`, W / 2, H * 0.3, 30, "#fff");
    if (C.autoRestartSec > 0) text(`nova partida em ${Math.max(0, Math.ceil(C.autoRestartSec - S.winT))}s`, W / 2, H * 0.82, 26, "#d9d3ee");
  }
  drawConfetti();
}
function render() {
  const amp = (S.stumble > 0.3 ? 7 : 0) + (S.shakeT > 0 ? S.shakeA * Math.min(1, S.shakeT * 3) : 0);
  g.save(); g.translate((Math.random() - 0.5) * 2 * amp, (Math.random() - 0.5) * amp);
  drawWorld();
  // ordem de desenho:
  // 1) enfeites pendurados: os postes ficam do lado de fora das pistas e as cordas acima de tudo,
  //    então nunca ficam na frente de um trem — desenhá-los antes evita que atravessem os trens
  // 2) objetos das pistas: primeiro as pistas mais longe da câmera, depois as mais perto. Vista de
  //    trás, a lateral de um trem de uma pista de fora nunca cobre o que está numa pista mais ao centro,
  //    mas o contrário acontece; dentro da mesma pista, do mais distante ao mais perto
  // 3) o jogador, e por cima dele só as barreiras da pista dele que estão entre ele e a câmera (já passou
  //    por elas, ou está rolando por baixo agora): assim a barra fica na frente e dá para ver que ele passou por baixo
  const api = { g, proj, box, side, shade, t: S.t };
  S.over.slice().sort((a, b) => b.z - a.z).forEach(o => SC.drawOverhead(api, o, WALL));
  const laneDist = o => Math.round(Math.abs(o.lane * LANE - S.camX) * 10);
  const depth = o => o.t === "coin" && o.y >= TRAIN_H ? o.z - 1000 : o.z; // moedas no teto vêm depois do trem
  const pl = Math.round(S.x / LANE);
  const inFront = o => BARRIERS.includes(o.t) && o.lane === pl &&
    (o.z + 0.3 < PZ - 0.3 || (o.z < PZ + 0.6 && S.roll > 0 && S.y < 0.6 && o.t !== "low"));
  const visible = S.objs.filter(o => o.z + (o.d || 1) > 0.5).sort((a, b) => laneDist(b) - laneDist(a) || depth(b) - depth(a));
  visible.filter(o => !inFront(o)).forEach(drawObj);
  drawPlayer();
  visible.filter(inFront).forEach(drawObj);
  for (const p of S.amb) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col;
    if (p.vx < -100) g.fillRect(-p.r * 4, 0, p.r * 8, p.r * 0.8); // grão de areia voando
    else { g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 7); g.fill(); }
    g.restore();
  }
  for (const p of S.parts) { g.globalAlpha = Math.min(1, p.life * 3); ell(p.x, p.y, p.r, p.r, p.col); }
  g.globalAlpha = 1;
  if (S.speedFx > 0) {
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const a = hash(i, Math.floor(S.t * 20)) / 1000 * Math.PI * 2, r0 = 260 + hash(i + 3, Math.floor(S.t * 20)) % 200;
      g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r0, HORIZON + Math.sin(a) * r0); g.lineTo(W / 2 + Math.cos(a) * (r0 + 160), HORIZON + Math.sin(a) * (r0 + 160)); g.stroke();
    }
  }
  if (S.reverseFx > 0) { g.fillStyle = `rgba(155,123,255,${0.12 + Math.sin(S.t * 6) * 0.05})`; g.fillRect(0, 0, W, H); }
  if (S.darkFx > 0) { // escuridão com um foco de luz no jogador
    const [px, py] = proj(S.x, S.y, PZ), k = Math.min(1, S.darkFx);
    const dk = g.createRadialGradient(px, py - 60, 80, px, py - 60, 360);
    dk.addColorStop(0, "rgba(0,0,0,0)"); dk.addColorStop(1, `rgba(0,0,0,${0.93 * k})`);
    g.fillStyle = dk; g.fillRect(0, 0, W, H);
  }
  // reta final: bordas da tela pulsando em vermelho
  if (S.state === "run" && S.dist / C.goalMeters >= 0.9) {
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(255,40,60,0)"); vg.addColorStop(1, `rgba(255,40,60,${0.18 + Math.sin(S.t * 8) * 0.1})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  if (S.flash > 0) { g.globalAlpha = Math.min(0.55, S.flash * 0.55); g.fillStyle = S.flashCol; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  g.restore();
  drawHUD();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
