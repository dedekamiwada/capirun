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
const BARRIERS = ["low", "mid", "high"]; // low: só pulando · mid: pula por cima ou rola por baixo · high: só rolando por baixo
// altura do topo de cada barreira: dá para pisar em cima (como um degrau), e a zona em z onde ela é sólida
const BAR_TOP = { low: 1.0, mid: 1.35, high: 3.3 }, STEP = 0.7;
const inBarZ = o => o.z <= PZ + 0.5 && o.z >= PZ - 0.8;

// ---------- estado ----------
let S;
function reset() {
  if (S) saveBest(); // reiniciou no meio de uma run do modo infinito: o recorde não se perde
  S = {
    state: "menu", dist: 0, speed: C.startSpeed, coins: 0, t: 0,
    lane: 0, x: 0, y: 0, vy: 0, floor: 0, grounded: true, jumps: 1, roll: 0, invuln: 0, stumble: 0, dizzy: 0,
    camX: 0, camY: CAM_H, camBase: 0,
    boardTime: 0, magnet: 0, double: 0, shield: 0,
    speedFx: 0, slowFx: 0, reverseFx: 0, darkFx: 0, likes: 0,
    objs: [], queue: [], lastChunk: null, nextSpawn: 30, popups: [], feed: [], parts: [], memeTimer: 6,
    deco: [], over: [], amb: [], nextDeco: 0, nextOver: 0, decoReady: false, theme: null, banner: 0,
    paused: false, themeOrder: THEME_ORDER,
    look: 0, lookDir: 1, lookT: 0, nextLook: 4, mood: "", moodT: 0, alerts: [],
    team: { help: 0, hurt: 0 }, donors: {}, combo: 0, comboT: 0, flash: 0, flashCol: "#fff", shakeT: 0, shakeA: 0,
    confetti: [], milestone: 0, winner: "", winT: 0, legendX: 0, likeCounts: {}, landT: 0,
    notes: [], overT: 0, continues: 0, newBest: false, letterCD: 250 + Math.random() * 200, letterOut: false
  };
}
// vitórias da sessão (sobrevivem ao reinício da partida; editáveis/zeráveis pelo painel)
const SESSION = { wins: 0 };
try { SESSION.wins = Number(JSON.parse(localStorage.getItem("capivara-wins")).wins) || 0; } catch {}
function setWins(n) {
  SESSION.wins = Math.max(0, Math.floor(Number(n) || 0));
  try { localStorage.setItem("capivara-wins", JSON.stringify({ wins: SESSION.wins })); } catch {}
}
// modos: "meta" (chegar na meta; bater tira metros) e "infinito" (sem meta; bater acaba a run)
const infinite = () => C.mode === "infinito";
// coisas que ficam salvas entre as runs: cabeças de capivara, recorde do modo infinito e a palavra do dia
const SAVE = { keys: 0, best: 0, word: { day: "", n: 0 } };
try { Object.assign(SAVE, JSON.parse(localStorage.getItem("capivara-save")) || {}); } catch {}
function store() { try { localStorage.setItem("capivara-save", JSON.stringify(SAVE)); } catch {} }
function saveBest() {
  if (infinite() && S.dist > SAVE.best) { SAVE.best = Math.floor(S.dist); store(); }
}
// avisos rápidos no centro da tela (recorde, letra, cabeça…); aparecem mesmo com os popups desligados
function note(a, b = "", col = "#fff") { S.notes.push({ a, b, col, t: 2.4 }); if (S.notes.length > 3) S.notes.shift(); }

// ---------- caça às letras: uma palavra por dia, as letras aparecem na pista em ordem ----------
const WORDS = ["CAPIVARA", "TRILHO", "VAGAO", "MOEDA", "CORRIDA", "PRANCHA", "RAMPA", "ESTACAO", "APITO", "VIAGEM", "TUNEL", "LANTERNA", "MOCHILA", "FOGUETE", "SURFISTA", "PIPOCA"];
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function dayWord() {
  const d = today();
  if (SAVE.word.day !== d) { SAVE.word = { day: d, n: 0 }; store(); } // virou o dia: palavra nova
  let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return WORDS[h % WORDS.length];
}
const wordDone = () => SAVE.word.n >= dayWord().length;
function gotLetter() {
  const w = dayWord(); SAVE.word.n++; store();
  S.letterOut = false; S.letterCD = rnd(500, 900);
  Sound.play("power");
  if (SAVE.word.n >= w.length) {
    SAVE.keys += 2; store(); S.coins += 500;
    note(`🔤 ${w}!`, `palavra do dia completa · +2 ${CAPY} +500 🪙`, "#ffd23f");
    confettiBurst(80, W / 2, H * 0.35, 0.8); Sound.play("fanfare");
  } else note(`LETRA ${w[SAVE.word.n - 1]}`, `${SAVE.word.n}/${w.length} da palavra do dia`, "#d6a8ff");
}
// coloca uma letra (ou uma cabeça de capivara) no lugar de uma moeda do chão do bloco novo
function swapCoin(items, obj) {
  const spots = items.filter(o => o.t === "coin" && o.y < 1.5);
  if (!spots.length) return false;
  const c = pick(spots); Object.assign(c, obj, { y: 1 });
  return true;
}

// ordem sorteada uma vez por sessão: sem país escolhido no painel, o primeiro dela fica fixo
const THEME_ORDER = TH.map((_, i) => i).sort(() => Math.random() - 0.5);
reset();

// ---------- configurações do painel (admin.html) ----------
const SETTINGS_KEYS = ["mode", "botCoins", "giftFallback", "goalMeters", "crashPenaltyMeters", "likesPerPushback", "likePushbackMeters", "donationRules", "theme", "skin", "binds", "testKeys", "giftBinds", "autoRestartSec", "showLegend", "likeRules", "hud", "hudTop", "shortcuts", "sound"];
function applySettings(o) {
  if (!o || typeof o !== "object") return;
  const prevTheme = C.theme, prevMode = C.mode;
  for (const k of SETTINGS_KEYS) if (o[k] !== undefined) C[k] = o[k];
  if (o.donationRules) loadCatalog(); // regras novas: completa as imagens pelo catálogo
  if (S && C.mode !== prevMode && (S.state === "run" || S.state === "over")) { reset(); S.state = "run"; Sound.startMusic(); }
  if (C.theme !== prevTheme) refreshScenery();
  if (o.sound) Sound.setVolumes(o.sound);
}
// troca de país: refaz as decorações na hora em vez de esperar o caminho renovar
function refreshScenery() { S.deco = []; S.over = []; S.decoReady = false; }
try { applySettings(JSON.parse(localStorage.getItem("capivara-settings"))); } catch {}
loadCatalog();
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
function addTrain(lane, z, opts = {}) {
  const d = opts.d || rnd(14, 28);
  if (opts.ramp) { S.objs.push({ t: "ramp", lane, z, d: RAMP }); z += RAMP; }
  S.objs.push({ t: "train", lane, z, d, col: opts.col || pick(C.colors.train), num: opts.num || 100 + (Math.random() * 900 | 0), move: opts.move || 0 });
  if (opts.ramp) coinLine(lane, z + 2, Math.floor(d / 3), false, TRAIN_H);
}
function coinLine(lane, z, n, arc, base = 0, out = S.objs) {
  for (let i = 0; i < n; i++) out.push({ t: "coin", lane, z: z + i * 2.2, y: base + (arc ? 1 + Math.sin(i / (n - 1) * Math.PI) * 2 : 0.8) });
}

// ---------- blocos pré-desenhados (chunks.js) ----------
// cada bloco vira uma lista de objetos; eles ficam numa fila e entram na pista quando chegam ao horizonte
const CHUNKS = window.CHUNKS || [], CHUNK_STEP = 3.5; // metros por linha
const BAR_CHAR = { L: "low", B: "mid", H: "high" };
// rows: as linhas já na ordem de perto para longe (linha 0 = a mais perto)
function buildChunk(rows, z0, k) {
  const out = [];
  const zr = i => z0 + i * CHUNK_STEP * k;
  for (let li = 0; li < 3; li++) {
    const lane = li - 1, col = rows.map(r => r[li] || ".");
    for (let i = 0; i < col.length; i++) {
      const c = col[i];
      if ("RTtM".includes(c)) {
        // trecho de vagão: rampa (R...) seguida de T/t, ou um vagão em movimento (M...)
        let j = i; while (col[j] === "R") j++;
        const ramp = j > i, moving = col[j] === "M";
        let e = j; while (e < col.length && (moving ? col[e] === "M" : "Tt".includes(col[e]))) e++;
        if (e === j) { i = j - 1; continue; } // rampa sem vagão depois: ignora
        const zt = ramp ? zr(i) + RAMP : zr(j), d = zr(e) - zt;
        if (ramp) out.push({ t: "ramp", lane, z: zr(i), d: RAMP });
        out.push({ t: "train", lane, z: zt, d, col: pick(C.colors.train), num: 100 + (Math.random() * 900 | 0), move: moving ? rnd(6, 12) : 0 });
        if (ramp) coinLine(lane, zt + 2, Math.floor(d / 3), false, TRAIN_H, out);
        for (let q = j; q < e; q++) if (col[q] === "t") coinLine(lane, zr(q), 2, false, TRAIN_H, out);
        i = e - 1;
      } else if (BAR_CHAR[c.toUpperCase()]) {
        out.push({ t: BAR_CHAR[c.toUpperCase()], lane, z: zr(i) });
        if (c === "l" || c === "b") coinLine(lane, zr(i) - 4.4, 5, true, 0, out);
        if (c === "h") coinLine(lane, zr(i) - 2.2, 3, false, 0, out);
      } else if (c === "p" && Math.random() < 0.5) {
        out.push({ t: "power", kind: pick(["board", "magnet", "double"]), lane, z: zr(i), y: 1 });
      } else if (c === "c" || c === "p") coinLine(lane, zr(i), 2, false, 0, out);
    }
  }
  return out;
}
// ---------- variedade: o mesmo bloco nunca vem igual ----------
// tem caminho? Vindo de qualquer pista, sempre dá para passar, no ritmo de um jogador de verdade: uma troca de
// pista leva quase duas linhas (então entre uma troca e outra passam pelo menos duas linhas inteiras) e a pista nova
// não pode ter vagão do lado durante a troca. Subir num vagão só pela rampa; do teto, dá para andar de teto em teto
function chunkPassable(rows) {
  rows = ["...", "...", "...", "...", ...rows]; // o respiro antes do bloco (no mínimo 4 linhas livres)
  const n = rows.length, kind = (i, l) => i < 0 || i >= n ? "" : "TtM".includes(rows[i][l]) ? "T" : rows[i][l] === "R" ? "R" : "";
  for (let start = 0; start < 3; start++) {
    let st = new Set([start * 8]); // estado = pista * 8 + teto * 4 + linhas que faltam para poder trocar de novo (0 a 2)
    for (let i = 0; i < n && st.size; i++) {
      const nx = new Set();
      for (const s0 of st) {
        const l = s0 >> 3, roof = (s0 >> 2) & 1, busy = s0 & 3;
        for (const nl of [l - 1, l, l + 1]) {
          if (nl < 0 || nl > 2) continue;
          const change = nl !== l;
          if (change && (busy || (!roof && (kind(i - 1, nl) === "T" || kind(i, nl) === "T" && kind(i, l) !== "T")))) continue;
          const wait = change ? 2 : Math.max(0, busy - 1);
          if (kind(i, nl) === "T") { if (roof || (!change && kind(i - 1, l) === "R")) nx.add(nl * 8 + 4 + wait); }
          else nx.add(nl * 8 + wait);
        }
      }
      st = nx;
    }
    if (!st.size) return false;
  }
  return true;
}
// sorteia uma variação do bloco: pistas em outra ordem, barreiras de outro tipo e moedas em outros lugares.
// Só vale a variação que ainda tem caminho; se nenhuma tiver, usa o bloco original (que sempre tem)
const LANE_ORDERS = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0]];
const BAR_SWAP = { L: "LB", B: "BLH", H: "HB", l: "lb", b: "bl", h: "hb" }; // tipos que podem trocar entre si
function varyChunk(ch) {
  const base = ch.rows.slice().reverse(); // de perto para longe
  // bloco com parede de vagões (2+ numa linha) ou trem vindo: só espelha (trocar a ordem das pistas podia
  // deixar a única saída num canto, a duas pistas de distância, com o trem chegando)
  const tight = base.some(r => (r.match(/[TtM]/g) || []).length >= 2 || r.includes("M"));
  const orders = tight ? LANE_ORDERS.slice(0, 2) : LANE_ORDERS;
  for (let tries = 0; tries < 8; tries++) {
    const ord = tries < 6 ? pick(orders) : tries === 6 ? [2, 1, 0] : [0, 1, 2];
    const moving = [0, 1, 2].map(li => base.some(r => r[ord[li]] === "M")); // pista com trem vindo: nada de moeda nova
    const rows = base.map(r => ord.map((src, li) => {
      let c = r[src] || ".";
      if (BAR_SWAP[c] && Math.random() < 0.4) c = pick(BAR_SWAP[c]);
      else if (c === "c" && Math.random() < 0.25) c = ".";                                 // tira umas moedas…
      else if (c === "." && !moving[li] && Math.random() < 0.05) c = "c";                  // …e põe outras
      return c;
    }).join(""));
    if (chunkPassable(rows)) return rows;
  }
  return base;
}
// trecho curto montado na hora entre os blocos: uma ou duas barreiras soltas e moedas (sempre tem caminho)
function fillerRows() {
  const n = 5 + Math.floor(Math.random() * 5), rows = Array.from({ length: n }, () => [".", ".", "."]);
  rows[1][Math.floor(Math.random() * 3)] = pick(["L", "B", "H", "l", "b"]);
  if (n >= 8 && Math.random() < 0.5) rows[6][Math.floor(Math.random() * 3)] = pick(["L", "B", "H"]); // 2ª barreira, com folga
  const cl = Math.floor(Math.random() * 3), c0 = Math.floor(Math.random() * Math.max(1, n - 3));
  for (let i = c0; i < Math.min(n, c0 + 3); i++) if (rows[i][cl] === ".") rows[i][cl] = "c";
  return rows.map(r => r.join(""));
}
// sorteia o próximo bloco: a dificuldade acompanha a velocidade (bate → fica mais lento → blocos mais fáceis).
// Os últimos blocos que saíram não voltam logo, e de vez em quando entra um trecho curto montado na hora
function spawnChunk() {
  const lvl = Math.max(0, Math.min(1, (S.speed - C.startSpeed) / Math.max(1, C.maxSpeed - C.startSpeed)));
  const maxTier = lvl < 0.1 ? 0 : lvl < 0.4 ? 1 : 2;
  // mais rápido = blocos esticam, mas um pouco menos que a velocidade (o tempo entre obstáculos encurta)
  const k = 1 + (Math.max(C.startSpeed, S.speed) / C.startSpeed - 1) * 0.75;
  const recent = S.recentChunks || (S.recentChunks = []);
  const all = CHUNKS.filter(c => c.tier <= maxTier);
  if (!all.length) { S.nextSpawn = 30; return; }
  let rows, name;
  if (recent.length && Math.random() < 0.2) { rows = fillerRows(); name = "trecho sorteado"; }
  else {
    const keep = Math.min(5, all.length - 1); // quantos blocos recentes ficam de fora
    const pool = all.filter(c => !recent.slice(-keep).includes(c.name));
    const weight = c => c.tier === maxTier ? 2 : 1; // blocos do nível atual aparecem mais
    let r = Math.random() * pool.reduce((a, c) => a + weight(c), 0), ch = pool[0];
    for (const c of pool) { r -= weight(c); if (r <= 0) { ch = c; break; } }
    rows = varyChunk(ch); name = ch.name;
    recent.push(ch.name); if (recent.length > 8) recent.shift();
    S.lastChunk = ch;
  }
  const items = buildChunk(rows, FAR + 1, k);
  for (const o of items) o.blk = name; // de qual bloco veio (para achar bloco com problema nos testes)
  if (!S.letterOut && S.letterCD <= 0 && !wordDone() && swapCoin(items, { t: "letter", ch: dayWord()[SAVE.word.n] })) S.letterOut = true;
  if (Math.random() < 0.03) swapCoin(items, { t: "key" }); // cabeça de capivara: rara (uma a cada minuto e meio, mais ou menos)
  S.queue.push(...items);
  S.queue.sort((a, b) => a.z - b.z);
  S.nextSpawn = (rows.length + 4 + Math.floor(Math.random() * 3)) * CHUNK_STEP * k; // respiro de 4 a 6 linhas
}
// objetos da fila entram na pista ao chegar no horizonte. Um vagão em movimento é mais rápido que tudo,
// então ele não pode alcançar o que está na frente dele na mesma pista antes daquilo sair da tela:
// a velocidade dele é limitada para isso; se nem devagar der, ele fica parado
function releaseQueue(dz) {
  for (const o of S.queue) o.z -= dz;
  while (S.queue.length && S.queue[0].z <= FAR) {
    const o = S.queue.shift();
    if (o.move) {
      const v = S.speed * 0.7; // pior caso: público deixou o jogo mais lento
      for (const p of S.objs) {
        if (p.lane !== o.lane || p.z >= o.z) continue;
        const end = p.z + (p.d || 0.5) + 1; // quando "end" metros passarem, p já saiu da tela
        if (end > 0) o.move = Math.min(o.move, (o.z - end) * v / end);
      }
      if (o.move < 5) o.move = 0;
    }
    S.objs.push(o);
  }
}
// altura do chão numa pista, na posição do jogador: trilho, rampa ou teto de trem
// reach: só conta superfícies até essa altura (o que dá para pisar); trens já atravessados não contam
// bars: inclui o topo das barreiras (dá para pisar em cima delas); a câmera ignora esses degraus
// climb: vindo de frente (sem estar trocando de pista), a rampa e o trem logo depois dela sempre se sobem,
// mesmo que a altura mude mais que "reach" num quadro só (quadro lento ou velocidade alta). Sem isso a rampa
// virava parede, o jogo contava uma batida e o personagem atravessava o trem por dentro, com a câmera embaixo
function floorAt(lane, reach = Infinity, bars = true, climb = false) {
  let f = 0;
  for (const o of S.objs) {
    if (o.lane !== lane || o.passed) continue;
    if (BARRIERS.includes(o.t)) {
      if (bars && !o.hit && inBarZ(o) && BAR_TOP[o.t] <= reach) f = Math.max(f, BAR_TOP[o.t]);
      continue;
    }
    if (!o.d || PZ < o.z || PZ > o.z + o.d) continue;
    const h = o.t === "train" ? TRAIN_H : o.t === "ramp" ? TRAIN_H * (PZ - o.z) / o.d : 0;
    if (h <= reach || (climb && climbable(o))) f = Math.max(f, h);
  }
  return f;
}
// rampa, ou trem que começa onde termina uma rampa da mesma pista
function climbable(o) {
  return o.t === "ramp" || (o.t === "train" && S.objs.some(r => r.t === "ramp" && r.lane === o.lane && !r.passed && Math.abs(r.z + r.d - o.z) < 0.6));
}
// trem (ou trecho alto de rampa) na posição do jogador que é alto demais para subir: é uma parede
function wallAt(lane, climb = false) {
  return S.objs.find(o => o.lane === lane && !o.passed && (o.t === "train" || o.t === "ramp") && PZ >= o.z && PZ <= o.z + o.d &&
    !(climb && climbable(o)) && (o.t === "train" ? TRAIN_H : TRAIN_H * (PZ - o.z) / o.d) - S.y > 0.7);
}

// ---------- doações ----------
// regra mais específica primeiro: presente escolhido (pelo ID oficial da TikTok, ou pelo nome) e depois maior valor mínimo
// regras de um presente escolhido pedem uma QUANTIDADE daquele presente (ex.: 5× Rosa num combo);
// regras de "qualquer presente" pedem um valor mínimo em moedas
// a regra vem de rules.js (o painel usa a mesma), com o "presente fora da lista → o de valor mais próximo, ajudando"
function ruleFor(ev, coins) { return GiftRules.pick(C.donationRules, ev, coins, C.giftFallback !== false); }
// catálogo oficial dos presentes (o servidor monta durante a live): completa imagem, ID e valor das regras pelo nome
function loadCatalog() {
  if (!location.protocol.startsWith("http")) return;
  fetch("/api/gifts").then(r => r.ok ? r.json() : null).then(d => { if (d && d.gifts) GiftRules.resolve(C.donationRules, d.gifts); }).catch(() => {});
}
function donate(ev) {
  const coins = Math.max(1, Number(ev.coins) || 1);
  const rule = ev.rule || (ev.ruleIndex != null ? (C.donationRules || [])[ev.ruleIndex] : null) || ruleFor(ev, coins);
  if (!rule) return;
  if (S.state === "win" || S.state === "over") return; // partida já acabou
  if (infinite()) return; // modo infinito é só o jogador: presentes não ajudam nem atrapalham
  // perGift: os metros valem por unidade (um combo de 5 Rosas = 5 × os metros da Rosa)
  const units = rule.perGift ? Math.max(1, Number(ev.count) || 1) : 1;
  const m = (Number(rule.meters) || 0) * units; // > 0 atrapalha (volta), < 0 ajuda (avança)
  const win = rule.effect === "win", zera = rule.effect === "zera";
  const before = S.dist;
  S.dist = win ? C.goalMeters : zera ? 0 : Math.min(C.goalMeters - 1, Math.max(0, S.dist - m));
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
  const effect = win ? "VITÓRIA!" : zera ? "ZEROU! 0 m" : `${m > 0 ? "−" : "+"}${Math.abs(m).toLocaleString("pt-BR")} m${fxLabel}`;
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
    // com o bot jogando, o trem surge mais longe: dá tempo de sair até de um corredor de vagões
    // (o bot nunca atravessa nada; uma pessoa tem o trem mais perto, porque é uma sabotagem)
    // e nunca fecha as três pistas: procura um ponto em que uma pista do lado fique livre durante o trem todo
    const all = [...S.objs, ...S.queue], wall = o => o.t === "train" || o.t === "ramp";
    const busy = (lane, z0, z1) => all.some(o => wall(o) && o.lane === lane && o.z < z1 && o.z + o.d > z0);
    const side = [S.lane - 1, S.lane + 1].filter(l => l >= -1 && l <= 1);
    let z = BOT.on ? 100 : 70;
    while (z < 150 && !side.some(l => !busy(l, z - 12, z + 22 + 12))) z += 4;
    if (z >= 150) return; // nenhum lugar justo agora: o trem não aparece (melhor que uma batida impossível de evitar)
    const clear = o => !(o.lane === S.lane && o.z > z - 15 && o.z < z + 30);
    S.objs = S.objs.filter(clear); S.queue = S.queue.filter(clear); // remove o que estiver no caminho
    addTrain(S.lane, z, { d: 22, col: "#e8525c", num: 666 });
    if (z > FAR) { const t = S.objs.pop(); S.queue.push(t); S.queue.sort((a, b) => a.z - b.z); } // além do horizonte: entra pela fila
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
  if (S.state === "over" || infinite()) return; // likes também não contam no modo infinito
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
  if (c.type === "gifts") loadCatalog(); // catálogo de presentes atualizado pelo servidor
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
  const st = { type: "status", mode: infinite() ? "infinito" : "meta", best: SAVE.best, keys: SAVE.keys, state: S.state, paused: S.paused, bot: BOT.on, dist: Math.floor(S.dist), goal: C.goalMeters, theme: S.theme && S.theme.name, themeMode: C.theme || "", coins: S.coins, wins: SESSION.wins };
  try { localStorage.setItem("capivara-status", JSON.stringify(st)); } catch {}
  if (WS && WS.readyState === 1) WS.send(JSON.stringify(st));
}, 500);
window.Game = { donate, onLike, toggleBot: () => toggleBot(), step: dt => update(dt), draw: () => render(), get botOn() { return BOT.on; }, get menu() { return MENU; }, get state() { return S; } };

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
function start() { if (S.state === "menu" || S.state === "win" || S.state === "over") { reset(); S.state = "run"; Sound.startMusic(); } }
function act(a, fromBot) {
  if (S.state === "menu") { if (!fromBot) menuKey(a); return; }
  if (S.state === "over") { if (!fromBot && (a === "up" || a === "down")) overMove(a === "down" ? 1 : -1); return; }
  if (S.state !== "run") { if (!fromBot) start(); return; }
  if (S.paused) return;
  if (S.reverseFx > 0) a = { left: "right", right: "left", up: "down", down: "up" }[a];
  const lane = S.lane;
  if (a === "left") S.lane = Math.max(-1, S.lane - 1);
  if (a === "right") S.lane = Math.min(1, S.lane + 1);
  if (S.lane !== lane) { S.prevLane = lane; Sound.play("lane"); }
  // um pulo por vez que o pé encosta em algo: vale no chão e também no ar (ex.: caindo de um vagão
  // sem ter pulado); quem já pulou só ganha outro quando pisar de novo (chão, trem ou barreira)
  if (a === "up" && (S.grounded || S.jumps > 0)) { S.vy = 13; S.roll = 0; S.grounded = false; S.jumps = 0; Sound.play("jump"); }
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
  // fim da run: setas escolhem, Enter confirma
  if (S.state === "over" && !e.repeat && (e.code === "Enter" || e.code === "NumpadEnter")) { overChoose(); e.preventDefault(); return; }
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
cv.addEventListener("pointerdown", e => {
  tx = e.clientX; ty = e.clientY;
  // começou em cima de uma barra arrastável (volume): segue o dedo/mouse até soltar
  if (S.state === "menu") {
    const [x, y] = canvasPoint(e), h = hitAt(x, y, false);
    if (h && h.drag) { MENU.dragging = h; h.drag(x); try { cv.setPointerCapture(e.pointerId); } catch {} }
  }
});
// posição do toque/clique em coordenadas do canvas (ele é escalado para caber na janela)
function canvasPoint(e) {
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
}
cv.addEventListener("pointermove", e => {
  if (MENU.dragging) return MENU.dragging.drag(canvasPoint(e)[0]);
  if (S.state === "menu" || S.paused || S.state === "over") menuHover(...canvasPoint(e));
});
cv.addEventListener("pointerup", e => {
  if (MENU.dragging) { const k = MENU.dragging.key; MENU.dragging = null; saveVolumes(k); return; } // soltou a barra: salva uma vez só
  if (S.state === "menu" || S.paused || S.state === "over") return menuClick(...canvasPoint(e));
  const [px, py] = canvasPoint(e);
  if (S.state === "run" && inPauseButton(px, py)) return togglePause(); // botão de pausa do canto
  const dx = e.clientX - tx, dy = e.clientY - ty;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return act("up");
  act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
});

// ---------- bot (tecla B): reage com atraso humano, se mexe o tempo todo e nunca é punido por bater ----------
const BOT = { on: false, wait: 0, idle: 0.5, cool: 0 };
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
// ---------- previsões do bot: ele só faz o que um jogador conseguiria fazer ----------
// altura do personagem daqui a t segundos, sem apertar nada (no chão fica onde está)
// (a física anda quadro a quadro, ~1/60 s, o que deixa o pulo um pouco mais baixo que a conta exata: o termo t/60 corrige)
const fall = t => 19 * t * (t + 1 / 60);
function yAt(t) { return S.grounded ? S.y : Math.max(0, S.y + S.vy * t - fall(t)); }
// altura de um trem/rampa na posição do jogador daqui a t segundos (0 = ainda não chegou ou já passou)
function solidH(o, t) {
  const z = o.z - (runSpeed() + (o.move || 0)) * t;
  if (PZ < z || PZ > z + o.d) return 0;
  return o.t === "train" ? TRAIN_H : TRAIN_H * (PZ - z) / o.d;
}
const BOT_SIDE = 0.24; // a troca de pista leva ~0,2 s: nesse tempo a pista nova não pode ter parede do lado
function sideClear(lane) {
  for (const o of S.objs) {
    if (o.lane !== lane || o.passed || (o.t !== "train" && o.t !== "ramp")) continue;
    for (let t = 0; t <= BOT_SIDE; t += 0.02) if (solidH(o, t) - Math.min(S.y, yAt(t)) > STEP) return false;
  }
  return true;
}
// segundos até bater de frente num trem nesta pista, estando nela a partir de tA (Infinity = livre)
function frontDanger(lane, tA = 0) {
  const v = runSpeed();
  if (lane === S.lane && wallAt(lane, true)) return 0;
  // no teto de um trem desta pista: trens que chegam antes do teto acabar ficam na mesma altura
  let roofEnd = -1;
  if (yAt(tA) >= TRAIN_H - STEP) for (const o of S.objs)
    if (o.lane === lane && o.t === "train" && !o.passed && solidH(o, tA) >= TRAIN_H) roofEnd = Math.max(roofEnd, (o.z + o.d - PZ) / (v + (o.move || 0)));
  let t = Infinity;
  for (const o of S.objs) {
    if (o.lane !== lane || o.passed || o.t !== "train") continue;
    const tf = (o.z - PZ) / (v + (o.move || 0));
    if (tf <= 0) continue;                       // já está do lado: quem cuida é o sideClear
    if (tf < roofEnd + 0.15) continue;            // emenda com o teto em que ele está
    const ramp = S.objs.find(r => r.t === "ramp" && r.lane === lane && !r.passed && Math.abs(r.z + r.d - o.z) < 0.6);
    // trem com rampa: dá para subir, se chegar na pista antes da rampa ou se já estiver subindo por ela
    if (ramp && ((ramp.z - PZ) / v > tA || (lane === S.lane && solidH(ramp, 0) > 0 && S.y >= solidH(ramp, 0) - STEP))) continue;
    t = Math.min(t, tf);
  }
  return t;
}
// barreiras que ainda não passaram totalmente pelo jogador, da mais próxima à mais distante
function barriersIn(lane) {
  return S.objs.filter(o => o.lane === lane && BARRIERS.includes(o.t) && !o.hit && o.z + 0.6 > PZ - 0.6).sort((a, b) => a.z - b.z);
}
// need: quanto tempo livre a pista precisa ter depois da troca (troca planejada pede folga; fuga aceita menos)
function laneSafeToEnter(lane, need = 0.5) {
  if (lane < -1 || lane > 1 || !sideClear(lane) || frontDanger(lane, BOT_SIDE) < need) return false;
  const b = barriersIn(lane)[0];
  return !(b && (b.z - PZ) / runSpeed() < 0.4); // barreira perto demais para dar tempo de reagir
}
const botAvoidsCoins = () => C.botCoins === false;
const coinNear = (lane, z0, z1) => S.objs.some(o => o.t === "coin" && Math.round(o.lane) === lane && o.z > z0 && o.z < z1);
function botUpdate(dt) {
  if (!BOT.on || S.state !== "run") return;
  BOT.wait -= dt; BOT.idle -= dt; BOT.cool -= dt;
  if (botReflex()) { BOT.wait = Math.max(BOT.wait, rnd(0.1, 0.2)); return; }
  if (BOT.wait > 0) return;
  const pl = S.lane, look = 3, v = runSpeed(), noCoins = botAvoidsCoins();
  // segurança primeiro: moedas só desempatam entre pistas seguras (desviar de moeda nunca leva para um trem)
  const score = l => {
    const d = frontDanger(l, l === pl ? 0 : BOT_SIDE);
    let s = Math.min(d, look) * 10 - Math.abs(l - pl) * 1.5 + (l === pl ? 1 : 0), extra = 0;
    for (const o of S.objs) {
      if (Math.round(o.lane) !== l || o.z <= PZ) continue;
      if (!noCoins) { if (o.t === "coin" && o.z < PZ + v * 1.5) extra += 0.6; if (o.t === "ramp") extra += 2; continue; }
      // sem moedas: olha mais longe; moeda em arco, no teto ou colada numa barreira não dá para pular (pesa mais)
      if (o.t === "coin" && o.z < PZ + v * 2.5) extra -= o.y > 1.3 || S.objs.some(b => BARRIERS.includes(b.t) && b.lane === l && Math.abs(b.z - o.z) < 5) ? 2 : 0.7;
      if (o.t === "ramp") extra -= 3;                             // rampa leva ao teto, que sempre tem moedas
      if (o.t === "power" && o.z < PZ + v * 2.5) extra -= o.kind === "magnet" ? 12 : o.kind === "double" ? 5 : 0; // ímã puxa as moedas; 2X dobra
    }
    return s + (d >= (noCoins ? 1.6 : look) ? Math.max(noCoins ? -16 : -6, Math.min(6, extra)) : 0);
  };
  // 1) escolher a melhor pista e andar uma pista por vez, se a próxima der para entrar
  const best = [-1, 0, 1].reduce((a, b) => score(b) > score(a) ? b : a, pl);
  if (best !== pl) {
    const step = best > pl ? 1 : -1;
    // a pista escolhida é a mais segura; a do meio, se for só de passagem, precisa de folga só para a próxima troca
    if (laneSafeToEnter(pl + step, 0.6)) return botPress(step > 0 ? "right" : "left");
  }
  // 2) spam de teclas como uma pessoa apertando tudo: s d a w a d s a w… (só longe de qualquer perigo)
  const calm = frontDanger(pl) > 1.6 && !(barriersIn(pl)[0] && (barriersIn(pl)[0].z - PZ) / v < 1.4);
  if (!calm) { BOT.burst = null; return; }
  if (BOT.burst) {
    const b = BOT.burst, key = b.keys[b.i++];
    if (b.i >= b.keys.length) { BOT.burst = null; BOT.idle = spamGap(); }
    if (key === "left" || key === "right") {
      // pista perigosa: a tecla "escorrega" (não troca de pista), mas o spam continua
      const nl = pl + (key === "right" ? 1 : -1);
      if (nl >= -1 && nl <= 1 && !laneSafeToEnter(nl, 1.2)) { BOT.wait = spamGap(); return; }
    }
    if (noCoins && (key === "down" || key === "up") && coinNear(pl, PZ - 1, PZ + v * 1.2)) { BOT.wait = spamGap(); return; } // pular/rolar perto de moeda pega moeda
    if (noCoins && (key === "left" || key === "right") && coinNear(pl + (key === "right" ? 1 : -1), PZ - 1, PZ + v * 0.8)) { BOT.wait = spamGap(); return; }
    return botPress(key, true);
  }
  if (BOT.idle <= 0) { BOT.idle = spamGap(); return humanBurst(); }
}
// "custo" de moedas que o personagem vai pegar seguindo a altura y(t) nos próximos `horizon` segundos: a moeda passa
// por PZ entre z = PZ + 0,5 e PZ − 1,1 e é pega se a altura do personagem + 0,8 ficar a menos de 1,6 dela.
// O ímã custa muito mais: ele puxa todas as moedas por 12 s.
function coinCost(yf, horizon) {
  const v = runSpeed(), pl = S.lane;
  let cost = 0;
  for (const o of S.objs) {
    const magnet = o.t === "power" && o.kind === "magnet", dbl = o.t === "power" && o.kind === "double";
    if (!(o.t === "coin" || magnet || dbl) || Math.round(o.lane) !== pl || o.z < PZ - 1.1) continue;
    const t0 = Math.max(0, (o.z - PZ - 0.5) / v), t1 = (o.z - PZ + 1.1) / v;
    if (t0 > horizon) continue;
    for (let t = t0; t <= t1; t += 0.01) if (Math.abs(o.y - (yf(t) + 0.8)) < 1.75) { cost += magnet ? 25 : dbl ? 8 : 1; break; } // 1,75 = 1,6 + margem
  }
  return cost;
}
// vale pular agora? compara pular agora com não pular e com pular mais tarde (de 0,04 em 0,04 s): só pula se
// agora for o melhor momento. Pular cedo demais desperdiça o pulo: no ar não dá para pular de novo, e a queda
// pode cair em cima de moedas ou do ímã
function coinJumpNow() {
  const fl = S.floor, ride = t => Math.max(fl, yAt(t)), H = 1.1;
  const jumpAt = d => t => t < d ? ride(t) : Math.max(fl, ride(d) + 13 * (t - d) - fall(t - d));
  const stay = coinCost(ride, H);
  if (!stay) return false;
  const now = coinCost(jumpAt(0), H);
  if (now >= stay) return false;
  for (let d = 0.04; d <= 0.6; d += 0.04) if (coinCost(jumpAt(d), H) < now) return false; // esperar é melhor
  return true;
}
// tecla do bot: com os controles invertidos ele aperta o contrário (como uma pessoa que percebeu a inversão)
function botAct(a) { act(S.reverseFx > 0 ? { left: "right", right: "left", up: "down", down: "up" }[a] : a, true); }
// reflexos (todo quadro, mesmo no meio do spam): fugir de trem, passar por barreira e, sem moedas, pular moedas
function botReflex() {
  const pl = S.lane, v = runSpeed();
  // 1) trem chegando de frente nesta pista: troca para a pista do lado que estiver livre
  const d = frontDanger(pl);
  if (d < 0.85 && BOT.cool <= 0) { // (cool: não aperta duas trocas de pista seguidas sem querer)
    const opts = [pl - 1, pl + 1].filter(l => laneSafeToEnter(l)).sort((a, b) => frontDanger(b, BOT_SIDE) - frontDanger(a, BOT_SIDE));
    if (opts.length && frontDanger(opts[0], BOT_SIDE) > d) { botAct(opts[0] > pl ? "right" : "left"); BOT.cool = 0.15; return true; }
  }
  // 2) barreira na pista: pula (cerca e barra) ou rola (barra e painel), com o atraso de reação de uma pessoa
  const b = S.y < TRAIN_H - STEP && barriersIn(pl)[0];
  if (b && b.z > PZ + 0.3) {
    const t = (b.z - PZ) / v;
    b.react = b.react || rnd(0.2, 0.34);
    if (t < b.react) {
      const canJump = S.grounded || S.jumps > 0, top = BAR_TOP[b.t] - STEP;
      const clears = yAt(t) >= top;                                      // já vai passar por cima sem fazer nada
      const rollOk = b.t !== "low" && S.roll > t + 0.05 && yAt(t) < 0.6; // já vai passar rolando
      if (clears || rollOk) return false;
      if (!b.choice && botAvoidsCoins() && b.t === "mid") { // pula ou rola: o caminho que pega menos moedas
        const fl = S.floor, jump = tt => tt < t ? fl : fl + 13 * (tt - t) - fall(tt - t);
        b.choice = coinCost(jump, t + 0.8) < coinCost(() => fl, t + 0.8) ? "up" : "down";
      }
      let want = b.t === "low" ? "up" : b.t === "high" ? "down" : (b.choice = b.choice || pick(["up", "down"]));
      if (want === "up" && !canJump) want = b.t === "low" ? "" : "down"; // sem pulo: na barra ainda dá para rolar
      if (want === "up" && 13 * t - fall(t) + S.y < top) want = b.t === "low" ? "up" : "down";
      if (want) { botAct(want); return true; }
      // cerca baixa sem pulo: só sobra trocar de pista
      const alt = [pl - 1, pl + 1].filter(l => laneSafeToEnter(l));
      if (alt.length && BOT.cool <= 0) { botAct(pick(alt) > pl ? "right" : "left"); BOT.cool = 0.15; return true; }
    }
  }
  // 3) sem moedas: pula na hora certa para passar por cima das moedas que vêm chegando
  const barNear = barriersIn(pl).some(o => o.z > PZ - 0.5 && (o.z - PZ) / v < 0.9); // pulo de moeda não pode cair numa barreira
  if (botAvoidsCoins() && (S.grounded || S.jumps > 0) && !barNear && coinJumpNow()) { botAct("up"); return true; }
  return false;
}

// ---------- update ----------
function runSpeed() {
  return S.speed * (S.speedFx > 0 ? 1.4 : 1) * (S.slowFx > 0 ? 0.7 : 1) * (S.stumble > 0 ? 0.5 : 1) * (1 - DIZZY_SLOW * Math.min(1, S.dizzy));
}
function crash() {
  if (BOT.on || S.invuln > 0 || S.shield > 0) return; // com o bot ligado ele atravessa sem penalidade
  if (S.boardTime > 0) { S.boardTime = 0; S.invuln = 1.2; Sound.play("break"); return; }
  Sound.play("crash");
  react("shock", 1.6);
  S.crashes = (S.crashes || 0) + 1;
  if (infinite()) return gameOver();
  S.dist = Math.max(0, S.dist - C.crashPenaltyMeters);
  S.speed = Math.max(C.startSpeed, S.speed * 0.8);
  S.invuln = 2; S.stumble = 0.6;
  popup("BATEU 💥", `-${C.crashPenaltyMeters} m`, "#ff7b39");
}
// esbarrão de lado: o 1º deixa meio tonto por alguns segundos (estrelinhas na cabeça e corre um pouco mais
// devagar, mas continua correndo); esbarrar de novo ainda tonto = cai (igual a bater de frente)
const DIZZY_SECS = 4, DIZZY_SLOW = 0.2; // 20% mais devagar, voltando ao normal no último segundo
function bump() {
  if (S.invuln > 0) return;
  if (S.dizzy > 0) { S.dizzy = 0; return crash(); }
  S.dizzy = DIZZY_SECS;
}
// ---------- fim da run (modo infinito) ----------
const continueCost = () => 2 ** S.continues; // 1, 2, 4, 8… cabeças de capivara na mesma run
function gameOver() {
  S.state = "over"; S.overT = 0; S.stumble = 0.6;
  S.newBest = S.dist > SAVE.best;
  saveBest();
  Sound.stopMusic();
  MENU.sel = SAVE.keys >= continueCost() ? 0 : 1; // sem cabeças de capivara suficientes, "Jogar de novo" vem selecionado
}
function overMove(d) {
  MENU.sel = (MENU.sel + d + 3) % 3;
  if (MENU.sel === 0 && SAVE.keys < continueCost()) MENU.sel = (MENU.sel + d + 3) % 3; // pula o "Continuar" sem cabeças de capivara
  Sound.play("lane");
}
function overChoose() { [continueRun, () => start(), () => openMenu()][MENU.sel](); }
// continua de onde bateu: gasta as cabeças de capivara, tira os obstáculos da frente e dá alguns segundos piscando
function continueRun() {
  const cost = continueCost();
  if (SAVE.keys < cost) return Sound.play("lane");
  SAVE.keys -= cost; store(); S.continues++;
  S.objs = S.objs.filter(o => !(["train", "ramp", ...BARRIERS].includes(o.t) && o.z < PZ + 45 && o.z + (o.d || 1) > PZ - 3));
  S.y = 0; S.vy = 0; S.floor = 0; S.camBase = 0; S.grounded = true; S.jumps = 1;
  S.state = "run"; S.invuln = 3; S.stumble = 0; S.dizzy = 0;
  Sound.startMusic(); Sound.play("power");
  note(`CONTINUA! ${CAPY}`, `-${cost} ${cost === 1 ? "cabeça" : "cabeças"} de capivara`, "#ffd23f");
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
  S.notes.forEach(n => n.t -= dt); S.notes = S.notes.filter(n => n.t > 0);
  if (S.state === "over") { // nova run sozinha depois de alguns segundos (para a live não ficar parada)
    S.overT += dt;
    if (C.autoRestartSec > 0 && S.overT > C.autoRestartSec) start();
  }
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
  // câmera atrás do jogador: acompanha a pista e a altura do personagem
  // no chão (ou no teto do trem) fica na altura de onde ele pisa; no ar mantém essa altura enquanto
  // ele estiver por perto, e segue o personagem quando ele cai abaixo dela (saiu do trem) ou sobe muito
  // acima dela. Pisar no topo de uma barreira não mexe a câmera (seria um tranco a cada barreira)
  S.camX += (S.x - S.camX) * Math.min(1, dt * 8);
  if (S.state === "run") {
    if (S.grounded) S.camBase = floorAt(Math.round(S.x / LANE), S.y + STEP, false, true);
    else S.camBase = Math.max(S.y - 2.4, Math.min(S.camBase, S.y));
  }
  const camTarget = S.camBase + CAM_H;
  S.camY += (camTarget - S.camY) * Math.min(1, dt * (camTarget < S.camY ? 8 : 6));
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
  S.letterCD -= dz;
  if (infinite() && !S.newBest && SAVE.best > 0 && S.dist > SAVE.best) { S.newBest = true; note("🏆 NOVO RECORDE!", "", "#ffd23f"); Sound.play("fanfare"); }
  ["invuln", "stumble", "dizzy", "roll", "speedFx", "slowFx", "reverseFx", "darkFx", "boardTime", "magnet", "double", "shield"].forEach(k => S[k] = Math.max(0, S[k] - dt));
  S.memeTimer -= dt;
  if (S.memeTimer <= 0) { S.memeTimer = rnd(8, 15); popup(pick(C.memes), "", "#fff"); }

  S.nextSpawn -= dz;
  if (S.nextSpawn <= 0) spawnChunk();
  for (const o of S.objs) {
    o.z -= dz + (o.move || 0) * dt;
    if (o.move && !o.honked && o.z < 60) { o.honked = true; Sound.play("horn"); }
  }
  releaseQueue(dz);
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
  const changing = S.prevLane !== undefined && S.prevLane !== pl && Math.abs(S.x - pl * LANE) > 0.25;
  const wall = wallAt(pl, !changing);
  if (wall) {
    if (changing && !wallAt(S.prevLane)) {                // esbarrou de lado trocando de pista: quica de volta (o bot também)
      if (S.lane !== S.prevLane) {                         // (já voltando de um esbarrão: não conta de novo)
        S.lane = S.prevLane;
        Sound.play("lane"); react("shock", 0.8);
        bump();
      }
    } else { crash(); wall.passed = true; }               // de frente: cai direto (perde metros ou acaba a run;
                                                          // com o bot, crash() não pune: é a rede de segurança)
  }
  S.floor = floorAt(Math.round(S.x / LANE), S.y + STEP, true, !changing);
  const wasGrounded = S.grounded;
  S.vy -= 38 * dt; S.y += S.vy * dt;
  // subindo no pulo e passando pelo topo de uma barreira: só "sobe o degrau", sem cortar o pulo
  S.grounded = S.y <= S.floor && S.vy <= 0;
  if (S.y < S.floor) S.y = S.floor;
  if (S.grounded) { S.vy = 0; S.jumps = 1; }
  if (S.grounded && !wasGrounded) S.landT = 0.18; // aterrissou: amassa um pouquinho
  S.landT = Math.max(0, (S.landT || 0) - dt);

  for (const o of S.objs) {
    const hitZ = o.z < PZ + 0.5 && o.z + (o.d || 0.6) > PZ - 0.5;
    if (o.t === "coin" || o.t === "power" || o.t === "key" || o.t === "letter") {
      if (S.magnet > 0 && o.t === "coin" && Math.abs(o.z - PZ) < 12) { o.lane += (S.x / LANE - o.lane) * 0.3; o.y += (S.y + 0.8 - o.y) * 0.3; }
      if (hitZ && Math.abs(o.lane * LANE - S.x) < 1.2 && Math.abs(o.y - (S.y + 0.8)) < 1.6) {
        o.dead = true;
        if (o.t === "coin") { S.coins += S.double > 0 ? 2 : 1; Sound.play("coin"); sparkle(o.lane * LANE, o.y, PZ, "#ffe66b", 5); }
        else if (o.t === "key") { SAVE.keys++; store(); Sound.play("power"); note(`+1 ${CAPY}`, `você tem ${SAVE.keys} ${SAVE.keys === 1 ? "cabeça" : "cabeças"} de capivara`, "#ffd23f"); sparkle(o.lane * LANE, o.y, PZ, "#ffd23f", 14); }
        else if (o.t === "letter") { gotLetter(); sparkle(o.lane * LANE, o.y, PZ, "#d6a8ff", 18); }
        else { applyEffect(o.kind); Sound.play("power"); sparkle(o.lane * LANE, o.y, PZ, "#7be0ff", 14); }
      }
      continue;
    }
    if (!BARRIERS.includes(o.t) || !inBarZ(o) || o.lane !== pl || o.hit) continue;
    // barreiras têm física: quem chega perto do topo (pulando ou caindo) pisa em cima dela e segue,
    // e pode até pular de novo lá de cima. Só bate quem chega de frente, baixo demais, sem estar rolando
    // (a cerca baixa é fechada embaixo: rolar não adianta, só pulando ou pisando em cima)
    const rolling = S.roll > 0 && S.y < 0.6 && o.t !== "low";
    if (!rolling && S.y < BAR_TOP[o.t] - STEP) { o.hit = true; crash(); }
  }
  // letra que passou sem ser pega: volta a aparecer um pouco mais à frente
  if (S.letterOut && !S.objs.some(o => o.t === "letter" && !o.dead && o.z + 1 > 0) && !S.queue.some(o => o.t === "letter")) { S.letterOut = false; S.letterCD = rnd(250, 400); }
  S.objs = S.objs.filter(o => !o.dead && o.z + (o.d || 1) > 0);

  if (!infinite() && S.dist >= C.goalMeters) {
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
  if (o.t === "low") {        // cerca baixa e fechada: só passa pulando (ou pisando em cima)
    box(x, 0, o.z, 2, 1.0, 0.35, "#d8d8d8");
    stripes(x - 1, 0.1, x + 1, 0.95, o.z, "#e8525c", "#ffffff", 8);
    blink(x + 0.85, 1.12, o.z);
  } else if (o.t === "mid") { // barra suspensa com vão embaixo: pula por cima, pisa em cima ou rola por baixo
    for (const lx of [-0.9, 0.9]) box(x + lx, 0, o.z + 0.1, 0.12, 1.35, 0.12, "#3b3f4a");
    box(x, 0.85, o.z, 2, 0.5, 0.35, "#f2f2f2");
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
  } else if (o.t === "key" || o.t === "letter") {
    if (o.z < 0.5) return;
    const [cx, cy, s] = proj(x, o.y + Math.sin(S.t * 3 + o.z) * 0.2, o.z), key = o.t === "key";
    const col = key ? "255,210,63" : "214,168,255";
    const gl = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.95);
    gl.addColorStop(0, `rgba(${col},.85)`); gl.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gl; g.fillRect(cx - s, cy - s, s * 2, s * 2);
    if (key) { // cabeça de capivara balançando
      g.save(); g.translate(cx, cy); g.rotate(Math.sin(S.t * 4 + o.z) * 0.18); capyHead(0, 0, s * 0.68); g.restore();
      return;
    }
    rrect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8, s * 0.16, key ? "#1a3a5c" : "#4b1f7a");
    g.lineWidth = s * 0.06; g.strokeStyle = "#fff"; g.beginPath(); g.roundRect(cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8, s * 0.16); g.stroke();
    g.fillStyle = "#fff"; g.font = `900 ${s * 0.5}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(o.ch, cx, cy + s * 0.03);
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
  if (S.dizzy > 0) { // tonto: estrelinhas girando em volta da cabeça (piscam no último segundo)
    if (S.dizzy < 1 && Math.floor(S.t * 10) % 2) return;
    const hy = by - s * (S.roll > 0 ? 0.8 : 1.42);
    for (let i = 0; i < 3; i++) {
      const a = S.t * 5 + i * Math.PI * 2 / 3, sx = px + Math.cos(a) * s * 0.32, sy = hy + Math.sin(a) * s * 0.08;
      g.font = `900 ${s * (Math.sin(a) > 0 ? 0.2 : 0.15)}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#ffd23f"; g.fillText("★", sx, sy);
    }
  }
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
  // passos exatos de 5% (sem erro de arredondamento do ponto flutuante), iguais aos controles do painel
  const v = Sound.volumes, nv = Math.max(0, Math.min(20, Math.round(v[key] * 20 + 1e-6) + Math.sign(d))) / 20;
  Sound.setVolumes({ [key]: nv }); saveVolumes(key);
}
// arrastando a barra: muda o volume na hora (de 5 em 5%) e só salva quando soltar
function setVolumeAt(key, frac) {
  Sound.setVolumes({ [key]: Math.round(Math.max(0, Math.min(1, frac)) * 20) / 20 });
}
function saveVolumes(key) {
  saveFromGame({ sound: { ...(C.sound || {}), ...Sound.volumes } });
  Sound.play((key || (MENU.dragging || {}).key) === "sfx" ? "jump" : "coin");
}
// itens do menu principal: aberto no meio de uma partida, ganha "Continuar" (sem perder a distância) e "Nova partida"
function mainItems() {
  const mode = ["mode", infinite() ? "♾️  MODO: INFINITO" : "🏁  MODO: META"];
  const rest = [mode, ...MENU_MAIN.slice(1)];
  return S.resumable ? [["play", "▶  CONTINUAR"], ["new", "🔄  NOVA PARTIDA"], ...rest] : [MENU_MAIN[0], ...rest];
}
// trocar de modo no meio de uma partida começa uma nova (a distância de um modo não vale no outro)
function toggleMode() {
  saveFromGame({ mode: infinite() ? "meta" : "infinito" });
  S.resumable = false; Sound.play("coin");
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
      else if (id === "mode") toggleMode();
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
// as áreas de clique são registradas na ordem do desenho: a última que contém o ponto é a que está por cima
// (ex.: o botão "+" fica em cima da linha "Música"; a linha só seleciona, o botão muda o volume)
function hitAt(x, y, onlySelectable) {
  for (let i = MENU.hits.length - 1; i >= 0; i--) {
    const b = MENU.hits[i];
    if (onlySelectable && b.sel === undefined) continue;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}
function menuClick(x, y) {
  const h = hitAt(x, y, false);
  if (h) h.fn();
}
function menuHover(x, y) {
  const h = hitAt(x, y, true);
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
  if (label.includes(CAPY)) richText(label, 0, 2, size, selected ? "#1d1600" : "#fff", "center", false);
  else { g.fillStyle = selected ? "#1d1600" : "#fff"; g.fillText(label, 0, 2); }
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
    text(infinite() ? `Modo infinito · 🏆 recorde ${SAVE.best.toLocaleString("pt-BR")} · ${CAPY} ${SAVE.keys}`
      : `Meta: ${C.goalMeters.toLocaleString("pt-BR")} m · 🏆 ${SESSION.wins} ${SESSION.wins === 1 ? "vitória" : "vitórias"}`, W / 2, T + 215, 28, "#fff");
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
      // barra arrastável: clicar ou arrastar em qualquer ponto define o volume (área de toque mais alta que a barra)
      MENU.hits.push({ x: bx - 14, y: y + 26, w: bw + 28, h: 56, sel: i, key: k, drag: px => { MENU.sel = i; setVolumeAt(k, (px - bx) / bw); } });
      rrect(bx, y + 44, bw, 20, 10, "rgba(255,255,255,.15)");
      if (v[k] > 0) rrect(bx, y + 44, Math.max(20, bw * v[k]), 20, 10, "#ffd23f");
      const kx = bx + bw * v[k], dragging = MENU.dragging && MENU.dragging.key === k;
      ell(kx, y + 54, dragging ? 20 : 16, dragging ? 20 : 16, "#fff"); // bolinha para arrastar
      g.lineWidth = 3; g.strokeStyle = "#ffd23f"; g.beginPath(); g.arc(kx, y + 54, dragging ? 20 : 16, 0, 7); g.stroke();
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
  const items = (C.donationRules || []).map(r => {
    const m = Number(r.meters) || 0, win = r.effect === "win", zera = r.effect === "zera";
    const fx = r.effect && FX[r.effect] && !win && !zera ? " " + FX[r.effect].label.split(" ")[0] : "";
    const what = win ? "VITÓRIA!" : zera ? "ZERA" : `${m > 0 ? "−" : "+"}${Math.abs(m).toLocaleString("pt-BR")} m${fx}`;
    const name = r.gift ? ((r.minCount || 1) > 1 ? `${r.minCount}× ${r.gift}` : r.gift) : (r.minCoins > 1 ? `${r.minCoins}+🪙` : "qualquer presente");
    return { img: r.giftImg, name, what, help: win || m < 0 };
  });
  // presentes fora da lista: ajudam como o presente da lista de valor mais próximo
  if (C.giftFallback !== false && items.length) items.push({ img: "", name: "outros presentes", what: "ajudam como o de valor mais parecido", help: true });
  return items;
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
// cabeça de capivara: o item de "continuar" (antes era a chave). É o mesmo rosto do avatar, sem o fone
const CAPY = "\u{E000}", CAPY_SKIN = { ...Characters.SKINS[0], hat: "none" };
function capyHead(cx, cy, r) {
  g.save();
  Characters.portrait(g, cx, cy - r * 0.18, r * 1.1, CAPY_SKIN, "happy", S.t);
  g.restore();
}
// largura de um texto que pode ter cabeças de capivara no meio (cada uma ocupa ~1,4× o tamanho da letra)
function richWidth(t, size) {
  g.font = `900 ${size}px system-ui`;
  return t.split(CAPY).reduce((w, part) => w + g.measureText(part).width, 0) + (t.split(CAPY).length - 1) * size * 1.4;
}
function richText(t, x, y, size, col, align, stroke) {
  const parts = t.split(CAPY), tw = richWidth(t, size);
  let cx = align === "left" ? x : align === "right" ? x - tw : x - tw / 2;
  parts.forEach((part, i) => {
    if (part) {
      g.textAlign = "left"; g.textBaseline = "middle";
      if (stroke) { g.lineWidth = size / 6; g.strokeStyle = "#000"; g.lineJoin = "round"; g.strokeText(part, cx, y); }
      g.fillStyle = col; g.fillText(part, cx, y); cx += g.measureText(part).width;
    }
    if (i < parts.length - 1) { capyHead(cx + size * 0.7, y, size * 0.74); cx += size * 1.4; }
  });
}
function text(t, x, y, size, col, align = "center") {
  if (t.includes(CAPY)) { g.font = `900 ${size}px system-ui`; return richText(t, x, y, size, col, align, true); }
  g.font = `900 ${size}px system-ui`; g.textAlign = align; g.textBaseline = "middle";
  g.lineWidth = size / 6; g.strokeStyle = "#000"; g.lineJoin = "round"; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y);
}
// Layout na "área segura" da TikTok LIVE: o topo (nome, espectadores) e o terço de baixo (comentários,
// barra de presentes) ficam cobertos pela interface do app, então as informações começam em hudTop
// e vão só até a altura do personagem.
const hudTop = () => Math.max(0, Number(C.hudTop) || 0);
let HUD_COL = 400; // onde começam as colunas laterais (depende do que está ligado no topo)
// botão de pausa do canto (dá para clicar/tocar durante a run)
const PAUSE_BTN = () => ({ x: 20, y: hudTop() + 10, w: 66, h: 66 });
function inPauseButton(x, y) { const b = PAUSE_BTN(); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
// power-ups e efeitos na lateral: ícone + barra de tempo (duração máxima de cada um, para a barra)
const FX_HUD = [["boardTime", "🛹", 30, "#ffd23f"], ["shield", "🛡️", 10, "#7be0ff"], ["magnet", "🧲", 12, "#ff5a6e"], ["double", "2X", 12, "#3ee07a"],
  ["speedFx", "⚡", 10, "#ff7b39"], ["slowFx", "🐢", 10, "#8dffb0"], ["reverseFx", "🔄", 10, "#ffb3c1"], ["darkFx", "🌑", 10, "#9b7bff"]];
// etiqueta escura alinhada à direita; devolve a largura
function pill(xRight, y, label, col) {
  const w = richWidth(label, 30) + 36;
  rrect(xRight - w, y, w, 46, 23, "rgba(10,8,18,.6)");
  text(label, xRight - 18, y + 24, 30, col, "right");
  return w;
}
function drawHUD() {
  if (S.state === "menu") return drawMenu(); // o menu ocupa a tela toda, sem o placar por trás
  const T = hudTop();
  // 1) canto superior: pausa + barra com a palavra do dia (esquerda) e a pontuação (direita)
  const pb = PAUSE_BTN();
  rrect(pb.x, pb.y + 4, pb.w, pb.h, 16, "rgba(0,0,0,.35)");
  rrect(pb.x, pb.y, pb.w, pb.h, 16, "#3f8fe0");
  g.lineWidth = 4; g.strokeStyle = "#cfe6ff"; g.beginPath(); g.roundRect(pb.x, pb.y, pb.w, pb.h, 16); g.stroke();
  rrect(pb.x + 20, pb.y + 17, 9, 32, 3, "#fff"); rrect(pb.x + 37, pb.y + 17, 9, 32, 3, "#fff");
  if (Sound.muted) text("🔇", pb.x + pb.w / 2, pb.y + pb.h + 26, 26, "#fff");
  const bx = pb.x + pb.w + 12, bw = W - 20 - bx;
  rrect(bx, pb.y + 4, bw, 58, 29, "rgba(10,8,18,.6)");
  const word = dayWord(), got = SAVE.word.n, done = got >= word.length, bs = word.length > 7 ? 24 : 27;
  for (let i = 0; i < word.length; i++) { // palavra do dia: quadradinhos com as letras já pegas
    const x = bx + 16 + i * (bs + 4), y = pb.y + 33 - bs / 2;
    rrect(x, y, bs, bs, 6, i < got ? (done ? "#3ee07a" : "#9b5cff") : "rgba(255,255,255,.14)");
    if (i < got) text(word[i], x + bs / 2, y + bs / 2 + 1, bs * 0.7, "#fff");
  }
  // pontuação = metros da run (aqui entra o multiplicador no futuro: veja PROXIMOS-PASSOS.md)
  const score = String(Math.floor(S.dist)).padStart(6, "0");
  text(score, bx + bw - 22, pb.y + 34, 44, "#fff", "right");
  g.font = "900 44px system-ui"; const sw = g.measureText(score).width;
  text("⭐", bx + bw - 30 - sw, pb.y + 33, 34, "#ffd23f", "right");
  // 2) abaixo da pontuação: moedas e cabeças de capivara (e o recorde no modo infinito)
  const py = pb.y + 72;
  let pw = 0;
  if (hudOn("coins")) pw = pill(W - 20, py, `${S.coins} 🪙`, "#ffe08a") + 10;
  pill(W - 20 - pw, py, `${SAVE.keys} ${CAPY}`, "#ffd23f");
  let y = py + 62;
  if (infinite()) {
    text(S.newBest ? "🏆 NOVO RECORDE" : `🏆 recorde ${SAVE.best.toLocaleString("pt-BR")}`, W - 24, y - 4, 22, S.newBest ? "#ffd23f" : "#e8e2ff", "right");
    y += 26;
  } else {
    // 3) modo meta: quanto falta e a barra até a meta (com as marcas de 10 em 10%)
    const left = Math.max(0, C.goalMeters - S.dist), p = S.dist / C.goalMeters, final = p >= 0.9 && S.state === "run";
    if (final) { // reta final: pulsa em vermelho para criar tensão (ajudar a ganhar × atrapalhar no fim)
      const pulse = 1 + Math.sin(S.t * 8) * 0.06;
      g.save(); g.translate(W / 2, y + 12); g.scale(pulse, pulse);
      text(`🔥 RETA FINAL · faltam ${Math.ceil(left).toLocaleString("pt-BR")} m 🔥`, 0, 0, 28, "#ff6b6b");
      g.restore();
    } else text(`faltam ${Math.ceil(left).toLocaleString("pt-BR")} m até a meta`, W / 2, y + 12, 28, "#ffe08a");
    const by = y + 34;
    rrect(40, by, W - 80, 20, 10, "rgba(0,0,0,.5)");
    if (p > 0) {
      const bar = g.createLinearGradient(40, 0, W - 40, 0); bar.addColorStop(0, "#3ee07a"); bar.addColorStop(1, final ? "#ff4f6d" : "#ffd23f");
      g.fillStyle = bar; g.beginPath(); g.roundRect(40, by, Math.max(20, (W - 80) * p), 20, 10); g.fill();
    }
    for (let i = 1; i < 10; i++) { g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(40 + (W - 80) * i / 10 - 1, by + 4, 2, 12); }
    text("🏁", W - 40, by + 10, 28, "#fff");
    y = by + 40;
  }
  // 4) itens da live: Ajuda × Atrapalha e a faixa "o que cada presente faz" (só no modo meta;
  //    o modo infinito mostra só o jogo: pontuação, moedas, cabeças, recorde, palavra e power-ups)
  const live = !infinite();
  if (live && hudOn("teams")) { drawTeams(y); y += 46; }
  if (live && C.showLegend !== false && hudOn("legend") && legendItems().length) { drawLegend(y + 24); y += 62; }
  HUD_COL = y + 12;
  // 5) coluna da esquerda: avatar, vitórias, medidor de likes e últimas doações
  let ly = HUD_COL;
  if (live && hudOn("avatar")) { drawAvatar(72, ly + 48, 46); ly += 112; }
  if (live && hudOn("wins")) { text(`🏆 ${SESSION.wins} ${SESSION.wins === 1 ? "vitória" : "vitórias"}`, 26, ly + 10, 26, "#ffd23f", "left"); ly += 38; }
  const lr = likeRules()[0];
  if (live && lr && hudOn("likes")) {
    const i = likeRules().indexOf(lr), cnt = S.likeCounts[i] || 0, lp = Math.min(1, cnt / lr.every);
    const m = Number(lr.meters) || 0, what = lr.effect === "win" ? "vitória" : `${m > 0 ? "−" : "+"}${Math.abs(m).toLocaleString("pt-BR")} m`;
    text(`❤️ ${cnt}/${lr.every} = ${what}`, 26, ly + 8, 18, "#ffd0e4", "left");
    rrect(26, ly + 20, 180, 12, 6, "rgba(0,0,0,.5)");
    if (lp > 0) rrect(26, ly + 20, Math.max(12, 180 * lp), 12, 6, "#ff6fae");
    ly += 48;
  }
  if (live && hudOn("feed")) S.feed.forEach((f, i) => {
    g.globalAlpha = Math.max(0.35, 1 - f.t / 20);
    text(f.text.length > 18 ? f.text.slice(0, 17) + "…" : f.text, 26, ly + 10 + i * 28, 19, f.help ? "#8dffb0" : "#ffb3c1", "left");
    g.globalAlpha = 1;
  });
  // 6) coluna da direita: power-ups ativos com a barra de tempo diminuindo, e o top da partida
  let ry = HUD_COL;
  for (const [k, icon, max, col] of FX_HUD) {
    if (!(S[k] > 0)) continue;
    const x = W - 20 - 76;
    rrect(x, ry, 76, 76, 18, "rgba(10,8,18,.62)");
    g.lineWidth = 3; g.strokeStyle = col; g.beginPath(); g.roundRect(x, ry, 76, 76, 18); g.stroke();
    text(icon, x + 38, ry + 34, icon === "2X" ? 30 : 38, "#fff");
    rrect(x + 10, ry + 60, 56, 8, 4, "rgba(255,255,255,.2)");
    rrect(x + 10, ry + 60, Math.max(8, 56 * Math.min(1, S[k] / max)), 8, 4, col);
    ry += 86;
  }
  if (S.reverseFx > 0) text("CONTROLES INVERTIDOS", W / 2, HUD_COL + 14, 24, "#ffb3c1");
  if (live && hudOn("top")) drawTop(W - 24, ry + 14);
  // 7) centro livre: só avisos rápidos (recorde, letra, cabeça, continuar…)
  S.notes.forEach((n, i) => {
    g.globalAlpha = Math.min(1, n.t * 3);
    const yy = HUD_COL + 120 + i * 96, k = 1 + Math.max(0, n.t - 2.1) * 0.6; // "estoura" ao aparecer
    g.save(); g.translate(W / 2, yy); g.scale(k, k);
    const tw = Math.max(richWidth(n.a, 44), n.b ? 300 : 0);
    rrect(-tw / 2 - 30, -38, tw + 60, n.b ? 88 : 66, 24, "rgba(10,8,18,.55)");
    text(n.a, 0, -6, 44, n.col);
    if (n.b) text(n.b, 0, 34, 22, "#fff");
    g.restore(); g.globalAlpha = 1;
  });
  if (S.banner > 0 && S.theme) { // placa de "chegou em outro país"
    g.globalAlpha = Math.min(1, S.banner, (4 - S.banner) * 3);
    g.font = "900 26px system-ui"; const tw = g.measureText(S.theme.name).width, x0 = W / 2 - (tw + 56) / 2;
    rrect(x0 - 12, HUD_COL + 40, tw + 80, 44, 22, "rgba(0,0,0,.45)");
    SC.flag(g, x0, HUD_COL + 48, 42, 28, S.theme.flag);
    text(S.theme.name, x0 + 52, HUD_COL + 62, 26, "#fff", "left");
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
  if (S.state === "over") drawOver();
  drawConfetti();
}
// tela de fim de run (modo infinito): pontuação, moedas, recorde, continuar com cabeças de capivara e jogar de novo
function drawOver() {
  MENU.hits = [];
  const T = hudTop(), k = Math.min(1, S.overT * 4);
  g.fillStyle = `rgba(20,10,40,${0.68 * k})`; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = k;
  text("BATEU! 💥", W / 2, T + 140, 78, "#ff7b39");
  rrect(W / 2 - 270, T + 200, 540, 320, 32, "rgba(20,14,36,.88)");
  g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.15)"; g.beginPath(); g.roundRect(W / 2 - 270, T + 200, 540, 320, 32); g.stroke();
  text("PONTUAÇÃO", W / 2, T + 244, 26, "#cfc8e8");
  text(`⭐ ${Math.floor(S.dist).toLocaleString("pt-BR")}`, W / 2, T + 304, 68, "#fff");
  if (S.newBest) { const b = 1 + Math.sin(S.t * 6) * 0.05; g.save(); g.translate(W / 2, T + 368); g.scale(b, b); text("🏆 NOVO RECORDE!", 0, 0, 34, "#ffd23f"); g.restore(); }
  else text(`🏆 recorde ${SAVE.best.toLocaleString("pt-BR")}`, W / 2, T + 368, 28, "#cfc8e8");
  text(`🪙 ${S.coins} moedas   ·   ${CAPY} ${SAVE.keys} ${SAVE.keys === 1 ? "cabeça" : "cabeças"}`, W / 2, T + 426, 28, "#ffe08a");
  const w = dayWord();
  text(wordDone() ? `🔤 palavra do dia: ${w} ✔` : `🔤 palavra do dia: ${SAVE.word.n}/${w.length} letras`, W / 2, T + 476, 24, "#d6a8ff");
  const cost = continueCost(), can = SAVE.keys >= cost;
  g.globalAlpha = k * (can ? 1 : 0.45);
  menuButton(W / 2 - 240, T + 560, 480, 86, `CONTINUAR  (${cost} ${CAPY})`, MENU.sel === 0, continueRun, 0, 32);
  g.globalAlpha = k;
  if (!can) text(`faltam ${cost - SAVE.keys} ${CAPY} · pegue na pista e na palavra do dia`, W / 2, T + 668, 21, "#cfc8e8");
  menuButton(W / 2 - 240, T + 700, 480, 86, "🔄  JOGAR DE NOVO", MENU.sel === 1, () => start(), 1, 34);
  menuButton(W / 2 - 240, T + 806, 480, 76, "🏠  MENU", MENU.sel === 2, () => openMenu(), 2, 30);
  if (C.autoRestartSec > 0) text(`nova run em ${Math.max(0, Math.ceil(C.autoRestartSec - S.overT))}s`, W / 2, T + 920, 24, "#d9d3ee");
  g.restore();
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
