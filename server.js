// Modo sem app: node server.js [usuario_tiktok]  (o Iniciar.bat faz isso). O .exe usa main.js.
const { startServer } = require("./app-server");

startServer({ port: 8080, dataDir: __dirname }).then(({ port, connectLive }) => {
  console.log(`Jogo:   http://localhost:${port}`);
  console.log(`Painel: http://localhost:${port}/admin.html  (não capture esta janela na live)`);
  if (process.argv[2]) connectLive(process.argv[2]);
}).catch(e => { console.error("Não consegui iniciar o servidor:", e.message); process.exit(1); });
