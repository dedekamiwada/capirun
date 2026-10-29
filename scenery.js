// Desenhos do cenário: monumentos no horizonte (2D) e decorações ao lado dos trilhos (no mundo 3D).
window.Scenery = (() => {
  const PALETTE = ["#e8525c", "#ffcf3a", "#4fd1c5", "#9b7bff", "#ff9f1c", "#7bd37b", "#f2f2f2"];
  const h = (a, b = 0) => ((Math.imul(a + 1, 73856093) ^ Math.imul(b + 7, 19349663)) >>> 0) % 1000;

  function path(g, pts, col) {
    g.fillStyle = col; g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath(); g.fill();
  }
  function windows(g, x, y, w, hgt, col, seed) {
    g.fillStyle = col;
    for (let wy = y + 8; wy < y + hgt - 10; wy += 16)
      for (let wx = x + 6; wx < x + w - 10; wx += 13)
        if (h(wx | 0, (wy | 0) + seed) % 3) g.fillRect(wx, wy, 6, 8);
  }

  // ---------- monumentos (silhuetas no horizonte); retornam a largura aproximada ----------
  const LANDMARKS = {
    pagoda(g, x, b, k, c, a) {
      for (let i = 0; i < 5; i++) {
        const w = (78 - i * 12) * k, y = b - i * 30 * k;
        g.fillStyle = a; g.fillRect(x - w * 0.32, y - 22 * k, w * 0.64, 22 * k);
        path(g, [[x - w / 2 - 12 * k, y - 18 * k], [x + w / 2 + 12 * k, y - 18 * k], [x + w / 2 - 4 * k, y - 30 * k], [x - w / 2 + 4 * k, y - 30 * k]], c);
      }
      g.fillStyle = c; g.fillRect(x - 2 * k, b - 175 * k, 4 * k, 30 * k);
      return 100 * k;
    },
    tower(g, x, b, k, c, a) {
      g.fillStyle = c; g.fillRect(x - 5 * k, b - 210 * k, 10 * k, 210 * k);
      g.beginPath(); g.ellipse(x, b - 150 * k, 22 * k, 14 * k, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x, b - 95 * k, 14 * k, 9 * k, 0, 0, 7); g.fill();
      g.fillStyle = a; g.fillRect(x - 1.5 * k, b - 250 * k, 3 * k, 40 * k);
      return 60 * k;
    },
    skyscraper(g, x, b, k, c, a, win, seed) {
      const w = (40 + seed % 30) * k, hh = (150 + seed % 90) * k;
      g.fillStyle = c; g.fillRect(x - w / 2, b - hh, w, hh);
      path(g, [[x - w / 2, b - hh], [x + w / 2, b - hh], [x, b - hh - 30 * k]], c);
      windows(g, x - w / 2, b - hh, w, hh, win, seed);
      return w + 10;
    },
    colosseum(g, x, b, k, c, a) {
      path(g, [[x - 110 * k, b], [x - 110 * k, b - 72 * k], [x + 55 * k, b - 72 * k], [x + 110 * k, b - 40 * k], [x + 110 * k, b]], c);
      g.fillStyle = a;
      for (let r = 0; r < 3; r++) for (let i = -100; i < 100; i += 17) {
        const top = b - (62 - r * 22) * k;
        if (r === 0 && i > 50) continue;
        g.beginPath(); g.roundRect(x + i * k, top, 9 * k, 15 * k, [5 * k, 5 * k, 0, 0]); g.fill();
      }
      return 230 * k;
    },
    dome(g, x, b, k, c, a) {
      g.fillStyle = c; g.fillRect(x - 65 * k, b - 50 * k, 130 * k, 50 * k);
      g.fillRect(x - 28 * k, b - 78 * k, 56 * k, 28 * k);
      g.beginPath(); g.arc(x, b - 78 * k, 32 * k, Math.PI, 0); g.fill();
      g.fillRect(x - 5 * k, b - 125 * k, 10 * k, 18 * k);
      g.fillStyle = a; for (let i = -55; i < 60; i += 22) g.fillRect(x + i * k, b - 40 * k, 8 * k, 26 * k);
      return 140 * k;
    },
    campanile(g, x, b, k, c, a) {
      g.fillStyle = c; g.fillRect(x - 14 * k, b - 150 * k, 28 * k, 150 * k);
      path(g, [[x - 16 * k, b - 150 * k], [x + 16 * k, b - 150 * k], [x, b - 190 * k]], c);
      g.fillStyle = a; g.fillRect(x - 8 * k, b - 140 * k, 6 * k, 16 * k); g.fillRect(x + 2 * k, b - 140 * k, 6 * k, 16 * k);
      return 40 * k;
    },
    eiffel(g, x, b, k, c, a) {
      g.fillStyle = c; g.beginPath();
      g.moveTo(x - 60 * k, b); g.lineTo(x - 32 * k, b - 70 * k); g.lineTo(x - 14 * k, b - 135 * k);
      g.lineTo(x - 5 * k, b - 215 * k); g.lineTo(x, b - 245 * k); g.lineTo(x + 5 * k, b - 215 * k);
      g.lineTo(x + 14 * k, b - 135 * k); g.lineTo(x + 32 * k, b - 70 * k); g.lineTo(x + 60 * k, b);
      g.lineTo(x + 34 * k, b); g.quadraticCurveTo(x, b - 80 * k, x - 34 * k, b); g.closePath(); g.fill();
      g.fillStyle = a; g.fillRect(x - 38 * k, b - 72 * k, 76 * k, 6 * k); g.fillRect(x - 18 * k, b - 137 * k, 36 * k, 5 * k);
      return 130 * k;
    },
    haussmann(g, x, b, k, c, a, win, seed) {
      const w = 130 * k;
      g.fillStyle = c; g.fillRect(x - w / 2, b - 70 * k, w, 70 * k);
      path(g, [[x - w / 2, b - 70 * k], [x + w / 2, b - 70 * k], [x + w / 2 - 10 * k, b - 90 * k], [x - w / 2 + 10 * k, b - 90 * k]], a);
      g.fillStyle = a; g.fillRect(x - 40 * k, b - 100 * k, 8 * k, 12 * k); g.fillRect(x + 30 * k, b - 100 * k, 8 * k, 12 * k);
      windows(g, x - w / 2, b - 70 * k, w, 70 * k, win, seed);
      return w + 8;
    },
    mountain(g, x, b, k, c, a) {
      path(g, [[x - 170 * k, b], [x - 25 * k, b - 165 * k], [x + 25 * k, b - 165 * k], [x + 170 * k, b]], c);
      path(g, [[x - 48 * k, b - 140 * k], [x - 25 * k, b - 165 * k], [x + 25 * k, b - 165 * k], [x + 48 * k, b - 140 * k], [x + 20 * k, b - 132 * k], [x, b - 145 * k], [x - 22 * k, b - 130 * k]], "rgba(255,255,255,.9)");
      return 340 * k;
    },
    sugarloaf(g, x, b, k, c, a) {
      g.fillStyle = c; g.beginPath();
      g.moveTo(x - 70 * k, b); g.bezierCurveTo(x - 60 * k, b - 150 * k, x - 10 * k, b - 190 * k, x + 15 * k, b - 175 * k);
      g.bezierCurveTo(x + 45 * k, b - 150 * k, x + 60 * k, b - 70 * k, x + 70 * k, b); g.fill();
      g.beginPath(); g.moveTo(x - 190 * k, b); g.bezierCurveTo(x - 160 * k, b - 90 * k, x - 110 * k, b - 95 * k, x - 80 * k, b); g.fill();
      g.strokeStyle = a; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 135 * k, b - 70 * k); g.lineTo(x + 5 * k, b - 170 * k); g.stroke();
      return 270 * k;
    },
    favela(g, x, b, k, c, a, win, seed) {
      g.fillStyle = c; g.beginPath(); g.ellipse(x, b, 150 * k, 70 * k, 0, Math.PI, 0); g.fill();
      for (let i = 0; i < 26; i++) {
        const px = x + ((h(i, seed) % 260) - 130) * k, top = b - Math.sqrt(Math.max(0, 1 - ((px - x) / (150 * k)) ** 2)) * 70 * k;
        g.fillStyle = PALETTE[h(i + 9, seed) % PALETTE.length];
        g.fillRect(px - 8 * k, top - 8 * k, 16 * k, 14 * k);
      }
      return 300 * k;
    },
    pyramid(g, x, b, k, c, a) {
      path(g, [[x - 130 * k, b], [x, b - 135 * k], [x + 130 * k, b]], c);
      path(g, [[x, b - 135 * k], [x + 130 * k, b], [x + 30 * k, b]], a);
      return 260 * k;
    },
    obelisk(g, x, b, k, c, a) {
      path(g, [[x - 9 * k, b], [x - 6 * k, b - 140 * k], [x, b - 155 * k], [x + 6 * k, b - 140 * k], [x + 9 * k, b]], c);
      return 30 * k;
    },
    windmill(g, x, b, k, c, a, win, seed, t) {
      path(g, [[x - 24 * k, b], [x - 14 * k, b - 100 * k], [x + 14 * k, b - 100 * k], [x + 24 * k, b]], c);
      path(g, [[x - 18 * k, b - 100 * k], [x, b - 120 * k], [x + 18 * k, b - 100 * k]], a);
      g.save(); g.translate(x, b - 105 * k); g.rotate(t * 0.8 + seed);
      g.fillStyle = a;
      for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillRect(-5 * k, 0, 10 * k, 70 * k); }
      g.restore();
      return 150 * k;
    },
    canalHouses(g, x, b, k, c, a, win, seed) {
      for (let i = 0; i < 5; i++) {
        const w = 26 * k, hh = (70 + h(i, seed) % 40) * k, px = x - 65 * k + i * w;
        g.fillStyle = i % 2 ? c : a; g.fillRect(px, b - hh, w - 1, hh);
        path(g, [[px, b - hh], [px + w / 2, b - hh - 16 * k], [px + w - 1, b - hh]], i % 2 ? c : a);
        windows(g, px, b - hh, w, hh, win, seed + i);
      }
      return 140 * k;
    }
  };

  function building(g, x, b, w, hgt, col, win, seed) {
    g.fillStyle = col; g.fillRect(x, b - hgt, w, hgt);
    windows(g, x, b - hgt, w, hgt, win, seed);
  }

  // ---------- bandeiras ----------
  function star(g, cx, cy, r, col) {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  function flag(g, x, y, w, hh, f) {
    g.save(); g.beginPath(); g.roundRect(x, y, w, hh, 3); g.clip();
    if (f.type === "v3") f.colors.forEach((c, i) => { g.fillStyle = c; g.fillRect(x + i * w / 3, y, w / 3 + 1, hh); });
    else if (f.type === "h3") f.colors.forEach((c, i) => { g.fillStyle = c; g.fillRect(x, y + i * hh / 3, w, hh / 3 + 1); });
    else if (f.type === "china") { g.fillStyle = "#de2910"; g.fillRect(x, y, w, hh); star(g, x + w * 0.18, y + hh * 0.3, hh * 0.2, "#ffde00"); }
    else if (f.type === "japan") { g.fillStyle = "#fff"; g.fillRect(x, y, w, hh); g.fillStyle = "#bc002d"; g.beginPath(); g.arc(x + w / 2, y + hh / 2, hh * 0.3, 0, 7); g.fill(); }
    else if (f.type === "brazil") {
      g.fillStyle = "#009c3b"; g.fillRect(x, y, w, hh);
      path(g, [[x + w / 2, y + hh * 0.12], [x + w * 0.9, y + hh / 2], [x + w / 2, y + hh * 0.88], [x + w * 0.1, y + hh / 2]], "#ffdf00");
      g.fillStyle = "#002776"; g.beginPath(); g.arc(x + w / 2, y + hh / 2, hh * 0.24, 0, 7); g.fill();
    }
    g.restore();
    g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 2; g.beginPath(); g.roundRect(x, y, w, hh, 3); g.stroke();
  }

  // ---------- decorações ao lado dos trilhos (api: g, proj, box, side, shade, t) ----------
  function trunk(g, sx, sy, s, hgt, col = "#6b4a2f", w = 0.28) { g.fillStyle = col; g.fillRect(sx - w * s / 2, sy - hgt * s, w * s, hgt * s); }
  function blob(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const PROPS = {
    tree(api, o, sx, sy, s) { const g = api.g; trunk(g, sx, sy, s, 2); blob(g, sx, sy - 2.6 * s, 1.3 * s, "#3f8f4a"); blob(g, sx - 0.6 * s, sy - 2.2 * s, 0.9 * s, "#367d40"); blob(g, sx + 0.5 * s, sy - 3.1 * s, 0.8 * s, "#4fa65a"); },
    olive(api, o, sx, sy, s) { const g = api.g; trunk(g, sx, sy, s, 1.4, "#7a6650"); blob(g, sx, sy - 2 * s, 1.1 * s, "#8a9a5b"); blob(g, sx + 0.7 * s, sy - 1.7 * s, 0.7 * s, "#9aab6a"); },
    cypress(api, o, sx, sy, s) { const g = api.g; trunk(g, sx, sy, s, 0.6); g.fillStyle = "#2f5a32"; g.beginPath(); g.ellipse(sx, sy - 3 * s, 0.55 * s, 2.6 * s, 0, 0, 7); g.fill(); },
    palm(api, o, sx, sy, s) {
      const g = api.g, tx = sx + 0.8 * s, ty = sy - 4.6 * s;
      g.strokeStyle = "#8a6a45"; g.lineWidth = 0.3 * s; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + 0.1 * s, sy - 3 * s, tx, ty); g.stroke();
      g.fillStyle = "#3fa34d";
      for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(tx, ty, 1.7 * s, 0.3 * s, -0.3 + i * Math.PI / 3.5 + Math.sin(api.t * 2 + i) * 0.05, 0, 7); g.fill(); }
    },
    bamboo(api, o, sx, sy, s) {
      const g = api.g;
      for (let i = -2; i <= 2; i++) {
        const bx = sx + i * 0.35 * s, hh = (3.5 + (i + 2) % 3 * 0.6) * s;
        g.fillStyle = "#6fae3f"; g.fillRect(bx - 0.08 * s, sy - hh, 0.16 * s, hh);
        g.fillStyle = "#4f8a2c"; for (let y = 0.8; y < hh / s; y += 0.8) g.fillRect(bx - 0.1 * s, sy - y * s, 0.2 * s, 0.05 * s);
      }
    },
    sakura(api, o, sx, sy, s) { const g = api.g; trunk(g, sx, sy, s, 1.8, "#5a3b30"); blob(g, sx, sy - 2.5 * s, 1.3 * s, "#ffb7d5"); blob(g, sx - 0.8 * s, sy - 2.1 * s, 0.9 * s, "#ff9ec7"); blob(g, sx + 0.8 * s, sy - 2.8 * s, 0.8 * s, "#ffd0e4"); },
    lantern(api, o, sx, sy, s) {
      const g = api.g; g.fillStyle = "#4a2020"; g.fillRect(sx - 0.06 * s, sy - 3 * s, 0.12 * s, 3 * s); g.fillRect(sx, sy - 3 * s, 0.7 * s, 0.08 * s);
      const lx = sx + 0.65 * s, ly = sy - 2.4 * s, gl = g.createRadialGradient(lx, ly, 0, lx, ly, 1.2 * s);
      gl.addColorStop(0, "rgba(255,120,80,.45)"); gl.addColorStop(1, "rgba(255,120,80,0)"); g.fillStyle = gl; g.fillRect(lx - 1.2 * s, ly - 1.2 * s, 2.4 * s, 2.4 * s);
      g.fillStyle = "#e02b2b"; g.beginPath(); g.ellipse(lx, ly, 0.35 * s, 0.45 * s, 0, 0, 7); g.fill();
      g.fillStyle = "#ffcf3a"; g.fillRect(lx - 0.2 * s, ly - 0.5 * s, 0.4 * s, 0.08 * s); g.fillRect(lx - 0.2 * s, ly + 0.42 * s, 0.4 * s, 0.08 * s);
    },
    lamp(api, o, sx, sy, s) { const g = api.g; g.fillStyle = "#1f2430"; g.fillRect(sx - 0.07 * s, sy - 3.4 * s, 0.14 * s, 3.4 * s); g.fillRect(sx - 0.25 * s, sy - 3.6 * s, 0.5 * s, 0.25 * s); blob(g, sx, sy - 3.3 * s, 0.18 * s, "#fff3b0"); },
    torii(api, o, sx, sy, s) {
      const g = api.g;
      g.fillStyle = "#d4332a"; g.fillRect(sx - 1.4 * s, sy - 4 * s, 0.25 * s, 4 * s); g.fillRect(sx + 1.15 * s, sy - 4 * s, 0.25 * s, 4 * s);
      g.fillRect(sx - 1.6 * s, sy - 3.3 * s, 3.2 * s, 0.22 * s);
      g.fillStyle = "#222"; g.beginPath(); g.moveTo(sx - 2.1 * s, sy - 4.15 * s); g.quadraticCurveTo(sx, sy - 3.8 * s, sx + 2.1 * s, sy - 4.15 * s); g.lineTo(sx + 2 * s, sy - 3.9 * s); g.lineTo(sx - 2 * s, sy - 3.9 * s); g.fill();
    },
    tulips(api, o, sx, sy, s) {
      const g = api.g;
      for (let i = 0; i < 9; i++) {
        const fx = sx + (i - 4) * 0.35 * s, fy = sy - (0.5 + (i % 2) * 0.1) * s;
        g.fillStyle = "#3f8f3a"; g.fillRect(fx - 0.03 * s, fy, 0.06 * s, 0.5 * s);
        blob(g, fx, fy, 0.13 * s, ["#ff3d6e", "#ffcf3a", "#ff7b39", "#c04bd6"][(o.seed + i) % 4]);
      }
    },
    flowers(api, o, sx, sy, s) { const g = api.g; g.fillStyle = "#3f8f4a"; g.beginPath(); g.ellipse(sx, sy - 0.4 * s, 1 * s, 0.5 * s, 0, 0, 7); g.fill(); for (let i = 0; i < 6; i++) blob(g, sx + ((h(i, o.seed) % 160) - 80) / 100 * s, sy - (0.3 + (h(i + 3, o.seed) % 50) / 100) * s, 0.1 * s, PALETTE[(o.seed + i) % 5]); },
    bush(api, o, sx, sy, s) { const g = api.g; blob(g, sx - 0.4 * s, sy - 0.5 * s, 0.6 * s, "#2f8a3e"); blob(g, sx + 0.4 * s, sy - 0.55 * s, 0.65 * s, "#38a04a"); },
    rock(api, o, sx, sy, s) { path(api.g, [[sx - 1 * s, sy], [sx - 0.7 * s, sy - 0.7 * s], [sx + 0.2 * s, sy - 0.95 * s], [sx + 0.9 * s, sy - 0.4 * s], [sx + 1 * s, sy]], "#b08b5a"); },
    cactus(api, o, sx, sy, s) { const g = api.g; g.fillStyle = "#4f8f4a"; g.beginPath(); g.roundRect(sx - 0.2 * s, sy - 2.2 * s, 0.4 * s, 2.2 * s, 0.2 * s); g.roundRect(sx - 0.75 * s, sy - 1.6 * s, 0.3 * s, 0.9 * s, 0.15 * s); g.roundRect(sx + 0.45 * s, sy - 1.9 * s, 0.3 * s, 0.8 * s, 0.15 * s); g.fill(); g.fillRect(sx - 0.6 * s, sy - 0.85 * s, 0.5 * s, 0.2 * s); g.fillRect(sx + 0.1 * s, sy - 1.25 * s, 0.5 * s, 0.2 * s); },
    obeliskSmall(api, o, sx, sy, s) { path(api.g, [[sx - 0.35 * s, sy], [sx - 0.25 * s, sy - 4 * s], [sx, sy - 4.5 * s], [sx + 0.25 * s, sy - 4 * s], [sx + 0.35 * s, sy]], "#d8b878"); },
    windmillSmall(api, o, sx, sy, s) {
      const g = api.g;
      path(g, [[sx - 0.8 * s, sy], [sx - 0.5 * s, sy - 4 * s], [sx + 0.5 * s, sy - 4 * s], [sx + 0.8 * s, sy]], "#7a4a3a");
      path(g, [[sx - 0.65 * s, sy - 4 * s], [sx, sy - 4.8 * s], [sx + 0.65 * s, sy - 4 * s]], "#2f2f36");
      g.save(); g.translate(sx, sy - 4.2 * s); g.rotate(api.t * 1.2 + o.seed);
      g.fillStyle = "#f4efe4"; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillRect(-0.15 * s, 0, 0.3 * s, 2.4 * s); }
      g.restore();
    }
  };
  Object.assign(PROPS, {
    grass(api, o, sx, sy, s) {
      const g = api.g; g.strokeStyle = o.seed % 2 ? "rgba(40,90,30,.55)" : "rgba(70,120,40,.5)"; g.lineWidth = Math.max(1, 0.05 * s);
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(sx + i * 0.12 * s, sy); g.lineTo(sx + i * 0.2 * s, sy - (0.35 + (i & 1) * 0.15) * s); g.stroke(); }
    },
    bench(api, o, sx, sy, s) {
      const g = api.g; g.fillStyle = "#3b2f2a"; g.fillRect(sx - 0.8 * s, sy - 0.45 * s, 0.08 * s, 0.45 * s); g.fillRect(sx + 0.72 * s, sy - 0.45 * s, 0.08 * s, 0.45 * s);
      g.fillStyle = "#8a5a3a"; g.fillRect(sx - 0.9 * s, sy - 0.5 * s, 1.8 * s, 0.12 * s); g.fillRect(sx - 0.9 * s, sy - 0.95 * s, 1.8 * s, 0.1 * s); g.fillRect(sx - 0.9 * s, sy - 0.75 * s, 1.8 * s, 0.1 * s);
    },
    umbrella(api, o, sx, sy, s) {
      const g = api.g, col = PALETTE[o.seed % 5];
      g.fillStyle = "#444"; g.fillRect(sx - 0.04 * s, sy - 2.2 * s, 0.08 * s, 2.2 * s);
      g.fillStyle = "#6b4a2f"; g.fillRect(sx - 0.5 * s, sy - 0.75 * s, 1 * s, 0.08 * s); g.fillRect(sx - 0.05 * s, sy - 0.75 * s, 0.1 * s, 0.75 * s);
      g.fillStyle = col; g.beginPath(); g.moveTo(sx - 1.3 * s, sy - 1.9 * s); g.quadraticCurveTo(sx, sy - 2.8 * s, sx + 1.3 * s, sy - 1.9 * s); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.moveTo(sx - 0.45 * s, sy - 2.05 * s); g.quadraticCurveTo(sx, sy - 2.75 * s, sx + 0.45 * s, sy - 2.05 * s); g.closePath(); g.fill();
    },
    flagpole(api, o, sx, sy, s) {
      const g = api.g; g.fillStyle = "#cfd3da"; g.fillRect(sx - 0.05 * s, sy - 5 * s, 0.1 * s, 5 * s);
      const wave = Math.sin(api.t * 4 + o.seed) * 0.06 * s;
      flag(g, sx + 0.05 * s, sy - 5 * s + wave, 1.5 * s, 1 * s, o.th.flag);
    }
  });
  // enfeites pendurados por cima dos trilhos, presos em dois postes
  function drawOverhead(api, o, wall) {
    if (o.z < 0.8 || !o.kind) return;
    const { g, proj, box } = api, top = 6.6, sag = 0.7, n = 18;
    for (const sgn of [-1, 1]) box(sgn * (wall - 0.25), 0, o.z, 0.18, top + 0.3, 0.18, "#3b3f4a");
    const pts = [];
    for (let i = 0; i <= n; i++) { const x = -wall + 0.25 + i * (2 * wall - 0.5) / n, u = x / wall; pts.push([x, top - sag * (1 - u * u)]); }
    const P = pts.map(([x, y]) => proj(x, y, o.z)), s = P[n >> 1][2];
    g.strokeStyle = "#2a2a2a"; g.lineWidth = Math.max(1, s * 0.025);
    g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    if (o.kind === "bunting") {
      const cols = o.th.bunting || PALETTE;
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], tip = proj((x0 + x1) / 2, (y0 + y1) / 2 - 0.55, o.z);
        path(g, [[P[i][0], P[i][1]], [P[i + 1][0], P[i + 1][1]], [tip[0], tip[1]]], cols[i % cols.length]);
      }
    } else for (let i = 1; i < n; i += o.kind === "lanterns" ? 2 : 1) {
      const [x, y] = pts[i], [cx, cy] = proj(x, y - (o.kind === "lanterns" ? 0.45 : 0.08), o.z);
      const gl = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.6);
      gl.addColorStop(0, "rgba(255,210,120,.45)"); gl.addColorStop(1, "rgba(255,210,120,0)");
      g.fillStyle = gl; g.fillRect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2);
      if (o.kind === "lanterns") {
        g.fillStyle = o.th.lantern || "#e02b2b"; g.beginPath(); g.ellipse(cx, cy, s * 0.22, s * 0.3, 0, 0, 7); g.fill();
        g.fillStyle = "#d4a017"; g.fillRect(cx - s * 0.12, cy - s * 0.34, s * 0.24, s * 0.06); g.fillRect(cx - s * 0.12, cy + s * 0.28, s * 0.24, s * 0.06);
      } else blob(g, cx, cy, Math.max(1.5, s * 0.07), "#fff1b8");
    }
  }
  // casas são caixas 3D com janelas na face voltada para os trilhos
  function house(api, o, th, pagoda) {
    const { box, side, shade } = api;
    const col = th.house[o.seed % th.house.length];
    box(o.x, 0, o.z, o.w, o.h, o.d, col);
    const inner = o.x < 0 ? o.x + o.w / 2 : o.x - o.w / 2;
    for (let wy = 1; wy < o.h - 0.8; wy += 1.6)
      for (let wz = o.z + 0.7; wz < o.z + o.d - 0.9; wz += 1.5) side(inner, wy, wy + 0.8, wz, wz + 0.7, h(wz | 0, wy * 10 + o.seed) % 4 ? "#2a3550" : "#ffe9a8");
    if (pagoda) {
      box(o.x, o.h, o.z - 0.6, o.w + 1.4, 0.35, o.d + 1.2, th.roof);
      box(o.x, o.h + 0.35, o.z, o.w * 0.6, 1.2, o.d, shade(col, 0.9));
      box(o.x, o.h + 1.55, o.z - 0.3, o.w + 0.6, 0.3, o.d + 0.6, th.roof);
    } else box(o.x, o.h, o.z - 0.2, o.w + 0.4, 0.45, o.d + 0.4, th.roof);
  }
  function drawProp(api, o, th) {
    if (o.kind === "house" || o.kind === "pagodaHouse" || o.kind === "bighouse")
      return house(api, o, th, o.kind === "pagodaHouse" || (o.kind === "bighouse" && th.props.includes("pagodaHouse")));
    if (o.z < 0.8) return;
    const [sx, sy, s] = api.proj(o.x, 0, o.z);
    (PROPS[o.kind] || PROPS.bush)(api, o, sx, sy, s);
  }

  return { LANDMARKS, building, flag, drawProp, drawOverhead, hash: h };
})();
