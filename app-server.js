// Servidor local do jogo: serve os arquivos, guarda configurações, conecta na TikTok LIVE e repassa os eventos
// para o jogo e o painel via WebSocket. Usado pelo app (.exe, main.js) e pelo Iniciar.bat (server.js).
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon" };
// só estes arquivos são servidos (o resto da pasta, como node_modules e dados salvos, fica de fora)
const PUBLIC = new Set(["index.html", "admin.html", "config.js", "themes.js", "scenery.js", "characters.js", "sound.js", "chunks.js", "game.js"]);

function startServer({ port = 8080, dataDir = __dirname, log = console.log } = {}) {
  const file = name => path.join(dataDir, name);
  const readJson = (name, fallback) => { try { return JSON.parse(fs.readFileSync(file(name), "utf8")); } catch { return fallback; } };
  const writeJson = (name, value) => { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(file(name), JSON.stringify(value, null, 2)); };

  let wss;
  const send = msg => { const s = JSON.stringify(msg); wss && wss.clients.forEach(c => c.readyState === 1 && c.send(s)); };

  // ---------- TikTok LIVE ----------
  const live = { state: "idle", username: readJson("live.json", {}).username || "", roomId: "", error: "", conn: null, manual: false };
  const liveStatus = () => ({ type: "live", state: live.state, username: live.username, roomId: live.roomId, error: live.error });
  const setLive = patch => { Object.assign(live, patch); send(liveStatus()); };

  // catálogo oficial de presentes (vem da própria TikTok ao conectar; fica salvo para usar offline)
  function normalizeGift(x) {
    const img = x.image || x.icon || {};
    return {
      id: String(x.id), name: String(x.name || ""), coins: Number(x.diamond_count ?? x.diamondCount ?? 0),
      img: (img.url_list || img.urlList || [])[0] || "", combo: !!x.combo || x.type === 1
    };
  }
  function saveCatalog(list) {
    const gifts = list.map(normalizeGift).filter(g => g.id && g.name)
      .filter((g, i, a) => a.findIndex(o => o.id === g.id) === i).sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name));
    if (!gifts.length) return;
    writeJson("gifts.json", { updated: new Date().toISOString(), from: live.username, gifts });
    send({ type: "gifts", updated: Date.now(), count: gifts.length });
    log(`Catálogo de presentes atualizado: ${gifts.length} presentes`);
  }
  function friendlyError(e) {
    const n = e && (e.constructor && e.constructor.name || e.name) || "";
    if (n === "UserOfflineError") return `@${live.username} não está ao vivo agora. Inicie a live e clique em Conectar.`;
    if (n === "InvalidUniqueIdError") return "Usuário da TikTok inválido.";
    if (n === "SignatureRateLimitError") return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
    return (e && e.message) || String(e);
  }
  async function disconnectLive(manual = true) {
    live.manual = manual;
    const c = live.conn; live.conn = null;
    if (c) try { await c.disconnect(); } catch {}
    setLive({ state: "idle", roomId: "" });
  }
  async function connectLive(username) {
    username = String(username || "").trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) return setLive({ state: "error", error: "Digite seu @ da TikTok (letras, números, ponto ou _)." });
    await disconnectLive(false);
    writeJson("live.json", { username });
    setLive({ state: "connecting", username, error: "" });
    live.manual = false;
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import("tiktok-live-connector");
    const conn = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
    live.conn = conn;

    conn.on(WebcastEvent.GIFT, d => {
      const g = d.gift || {}, ext = d.extendedGiftInfo || {};
      const combo = g.combo || g.type === 1 || ext.combo || ext.type === 1;
      if (combo && !d.repeatEnd) return; // sequência (combo) só conta quando termina
      const per = Number(g.diamondCount ?? ext.diamond_count ?? 0) || 1, count = Math.max(1, Number(d.repeatCount) || 1);
      const name = g.name || ext.name || "", id = String(d.giftId || g.id || ext.id || "");
      const img = ((ext.image && ext.image.url_list) || (g.image && g.image.urlList) || [])[0] || "";
      const user = (d.user && (d.user.nickname || d.user.displayId)) || "alguém";
      log(`🎁 ${user}: ${name} x${count} (${per * count} moedas) [id ${id}]`);
      send({ type: "gift", user, gift: name, giftId: id, coins: per * count, count, img });
    });
    conn.on(WebcastEvent.LIKE, d => send({ type: "like", user: d.user && d.user.nickname, count: Number(d.count) || 1 }));
    conn.on(WebcastEvent.FOLLOW, d => send({ type: "follow", user: d.user && d.user.nickname }));
    conn.on(WebcastEvent.STREAM_END, () => setLive({ state: "ended", error: "A live terminou." }));
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (live.conn !== conn || live.manual) return;
      setLive({ state: "reconnecting" });
      setTimeout(() => { if (live.conn === conn && !live.manual) connectLive(username); }, 8000);
    });
    conn.on(ControlEvent.ERROR, e => log("Erro na conexão TikTok:", (e && e.message) || e));

    try {
      await conn.connect();
      if (live.conn !== conn) return;
      setLive({ state: "connected", roomId: conn.roomId, error: "" });
      log(`Conectado à live de @${username} (sala ${conn.roomId})`);
      const gifts = conn.availableGifts;
      if (Array.isArray(gifts) && gifts.length) saveCatalog(gifts);
      else conn.fetchAvailableGifts().then(l => Array.isArray(l) && saveCatalog(l)).catch(e => log("Não consegui baixar o catálogo de presentes:", e.message));
    } catch (e) {
      if (live.conn === conn) { live.conn = null; setLive({ state: "error", error: friendlyError(e) }); }
      log("Falha ao conectar na TikTok:", friendlyError(e));
    }
  }

  // ---------- HTTP ----------
  function readBody(req, cb) {
    let body = "";
    // configurações podem trazer sons enviados pelo painel (até ~1 MB cada, em base64)
    req.on("data", c => { body += c; if (body.length > 25e6) req.destroy(); });
    req.on("end", () => { try { cb(JSON.parse(body || "{}")); } catch { cb(null); } });
  }
  const json = (res, code, value) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(value === undefined ? "" : JSON.stringify(value)); };

  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (url === "/api/settings" && req.method === "GET") return json(res, 200, readJson("settings.json", {}));
    if (url === "/api/settings" && req.method === "POST") return readBody(req, s => {
      if (!s || typeof s !== "object") return json(res, 400);
      writeJson("settings.json", s); send({ type: "settings", settings: s }); json(res, 204);
    });
    if (url === "/api/cmd" && req.method === "POST") return readBody(req, c => {
      if (!c || typeof c.type !== "string") return json(res, 400);
      send(c); json(res, 204);
    });
    if (url === "/api/gifts" && req.method === "GET") return json(res, 200, readJson("gifts.json", { gifts: [] }));
    if (url === "/api/live" && req.method === "GET") return json(res, 200, liveStatus());
    if (url === "/api/live/connect" && req.method === "POST") return readBody(req, b => { connectLive(b && b.username); json(res, 202, liveStatus()); });
    if (url === "/api/live/disconnect" && req.method === "POST") return disconnectLive(true).then(() => json(res, 200, liveStatus()));

    const name = url === "/" ? "index.html" : decodeURIComponent(url).replace(/^\/+/, "");
    if (!PUBLIC.has(name)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(name)] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(path.join(__dirname, name)).pipe(res);
  });

  wss = new WebSocketServer({ server, path: "/ws" });
  // o ws repassa os erros do servidor HTTP (ex.: porta ocupada); quem trata é o server.on("error") abaixo
  wss.on("error", () => {});
  // repassa mensagens pequenas entre janelas (ex.: o jogo manda seu status para o painel)
  wss.on("connection", ws => {
    ws.send(JSON.stringify(liveStatus()));
    ws.on("message", data => {
      if (data.length > 4096) return;
      const s = data.toString();
      wss.clients.forEach(c => c !== ws && c.readyState === 1 && c.send(s));
    });
  });

  // tenta a porta pedida e as 10 seguintes, caso esteja ocupada
  return new Promise((resolve, reject) => {
    let p = port;
    server.on("error", e => {
      if (e.code === "EADDRINUSE" && p < port + 10) server.listen(++p, "127.0.0.1");
      else reject(e);
    });
    server.listen(p, "127.0.0.1", () => resolve({ port: p, connectLive, close: () => { disconnectLive(true); server.close(); } }));
  });
}

module.exports = { startServer };
