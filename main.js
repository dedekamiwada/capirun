// App para Windows (.exe): abre a janela do jogo (para capturar na live) e a janela do painel (só para você).
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const { startServer } = require("./app-server");

// qualquer erro inesperado vira uma mensagem clara (e um arquivo de log), em vez de deixar o app aberto sem janelas
function fatal(err) {
  const msg = (err && err.stack) || String(err);
  try { fs.appendFileSync(path.join(app.getPath("userData"), "erro.log"), `[${new Date().toISOString()}] ${msg}\n`); } catch {}
  dialog.showErrorBox("Capivara Runner não conseguiu abrir", `${(err && err.message) || err}\n\nFeche o app e abra de novo. Detalhes salvos em:\n${path.join(app.getPath("userData"), "erro.log")}`);
  app.exit(1);
}
process.on("uncaughtException", fatal);
process.on("unhandledRejection", fatal);

// pasta de dados alternativa (ex.: para rodar uma cópia de teste separada da principal)
if (process.env.CAPIVARA_DATA_DIR) app.setPath("userData", process.env.CAPIVARA_DATA_DIR);

// ---------- só uma cópia aberta, mas sem ficar refém de uma cópia travada ----------
const http = require("http");
const { execFileSync } = require("child_process");
const sleep = ms => new Promise(r => setTimeout(r, ms));
function probe(port) {
  return new Promise(res => {
    const r = http.get({ host: "127.0.0.1", port, path: "/api/live", timeout: 800 }, x => { x.resume(); res(x.statusCode === 200); });
    r.on("error", () => res(false));
    r.on("timeout", () => { r.destroy(); res(false); });
  });
}
async function healthyCopyRunning() {
  for (let p = 8080; p <= 8090; p++) if (await probe(p)) return true;
  return false;
}
// fecha cópias antigas do app que não respondem (preserva esta cópia, o lançador dela e os processos filhos dela)
function closeStuckCopies() {
  try {
    const ps = "Get-CimInstance Win32_Process -Filter \"Name='Capivara Runner.exe' OR Name='CapivaraRunner.exe'\" | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress";
    const list = [].concat(JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8" }) || "[]"));
    const mine = new Set([process.pid, process.ppid]);
    for (const p of list) if (p.ParentProcessId === process.pid) mine.add(p.ProcessId);
    for (const p of list) if (!mine.has(p.ProcessId)) try { execFileSync("taskkill", ["/F", "/PID", String(p.ProcessId)]); } catch {}
  } catch (e) { fatal(new Error("Existe uma cópia antiga do Capivara Runner travada. Feche-a no Gerenciador de Tarefas e abra de novo.")); }
}

let gameWin, panelWin;
function openExternal(win) {
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

async function boot() {
  if (!app.requestSingleInstanceLock()) {
    // já existe uma cópia: se ela funciona, ela mesma mostra as janelas (second-instance); se travou, fecha e segue
    if (await healthyCopyRunning()) return app.quit();
    closeStuckCopies();
    await sleep(1200);
    app.requestSingleInstanceLock(); // tenta pegar de novo; se não der, abre mesmo assim
  }
  await app.whenReady();
  Menu.setApplicationMenu(null);
  const { port } = await startServer({ port: 8080, dataDir: app.getPath("userData") });
  const base = `http://127.0.0.1:${port}`;

  gameWin = new BrowserWindow({
    width: 540, height: 960, useContentSize: true, title: "Capivara Runner", backgroundColor: "#111111",
    // continua rodando liso mesmo sem foco (enquanto você mexe no painel ou no TikTok LIVE Studio)
    webPreferences: { backgroundThrottling: false }
  });
  gameWin.setAspectRatio(9 / 16);
  gameWin.loadURL(base + "/");
  openExternal(gameWin);
  gameWin.on("page-title-updated", e => e.preventDefault());

  panelWin = new BrowserWindow({
    width: 1320, height: 900, title: "Capivara Runner — Painel", backgroundColor: "#0e0d13",
    webPreferences: { backgroundThrottling: false }
  });
  panelWin.loadURL(base + "/admin.html");
  openExternal(panelWin);
  panelWin.on("page-title-updated", e => e.preventDefault());

  // fechar o jogo encerra o app; fechar o painel só fecha o painel
  gameWin.on("closed", () => app.quit());
}
boot().catch(fatal);

// abriu de novo: mostra as janelas; se esta cópia ficou sem janelas por algum motivo, reinicia em vez de travar
app.on("second-instance", () => {
  if (!gameWin || gameWin.isDestroyed()) { app.relaunch(); app.exit(0); return; }
  gameWin.show(); gameWin.focus();
  if (panelWin && !panelWin.isDestroyed()) panelWin.show();
});
app.on("window-all-closed", () => app.quit());
