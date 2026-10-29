// Personagens jogáveis (todos originais). No jogo aparecem de costas (e olham para trás de vez em quando);
// no painel e no avatar do canto da tela aparecem de frente, com rosto e expressões.
// Para criar uma skin, copie um bloco de SKINS e troque cores e peças:
//   head: capybara | panda | fox | cat | frog | penguin | llama
//   hat: headphones | capBack | wizard | bucket | headband | helmet | null
//   back: backpack | vinyl | bamboo | surfboard | tank | guitar | null
//   chest (detalhe da frente da roupa): hoodie | tee | astro | belly | gi | robe | jersey | jacket
//   tail: fox | cat | penguin | null      extras: chain, lei, board (skate sempre no pé)
// Expressões (mood): happy | laugh | shock | focus | sad
window.Characters = (() => {
  const SKINS = [
    { id: "capivara", name: "Capivara", desc: "A clássica de moletom e fone",
      head: "capybara", fur: "#a86f42", outfit: "#2f7df6", pants: "#2b2f3a", shoes: "#f4f4f4", shoeAccent: "#ff3d6e",
      hat: "headphones", hatColor: "#ff3d6e", back: "backpack", backColor: "#ffcf3a", chest: "hoodie" },
    { id: "capivara-skate", name: "Capivara Skatista", desc: "Boné pra trás e shape no pé",
      head: "capybara", fur: "#b97a48", outfit: "#ff7a2f", pants: "#3a4a6b", shoes: "#1f1f24", shoeAccent: "#ffffff",
      hat: "capBack", hatColor: "#e8343f", back: null, number: "88", extras: ["board"], boardColor: "#2fd1a0", chest: "tee" },
    { id: "capivara-astro", name: "Capivara Astronauta", desc: "Capacete de vidro e tanque de oxigênio",
      head: "capybara", fur: "#a86f42", outfit: "#eef1f6", pants: "#d9dde6", shoes: "#9aa3b2", shoeAccent: "#ff7a2f",
      hat: "helmet", back: "tank", backColor: "#f4f6fa", armColor: "#e3e7ee", chest: "astro" },
    { id: "panda-dj", name: "Panda DJ", desc: "Fone gigante e disco de vinil",
      head: "panda", fur: "#f7f5f0", furDark: "#1d1d22", outfit: "#1d1d22", pants: "#1d1d22", shoes: "#ff3df0", shoeAccent: "#ffffff",
      hat: "headphones", hatColor: "#39ff9c", back: "vinyl", armColor: "#1d1d22", extras: ["chain"], chest: "belly", bellyColor: "#f7f5f0" },
    { id: "raposa-ninja", name: "Raposa Ninja", desc: "Faixa vermelha e bastão de bambu",
      head: "fox", fur: "#ff8a3d", furDark: "#c9601d", outfit: "#22222b", pants: "#22222b", shoes: "#22222b", shoeAccent: "#e8343f",
      hat: "headband", hatColor: "#e8343f", back: "bamboo", tail: "fox", chest: "gi" },
    { id: "gato-mago", name: "Gato Mago", desc: "Chapéu de estrelas e manto roxo",
      head: "cat", fur: "#9a9cab", furDark: "#6e7080", outfit: "#6a3fc8", pants: "#3f2a78", shoes: "#3f2a78", shoeAccent: "#ffd23f",
      hat: "wizard", hatColor: "#4b2a99", back: null, tail: "cat", stars: true, chest: "robe" },
    { id: "sapo-mc", name: "Sapo MC", desc: "Chapéu bucket e corrente de ouro",
      head: "frog", fur: "#5cc85a", furDark: "#3f9a3e", outfit: "#ffd23f", pants: "#2f6fd6", shoes: "#ffffff", shoeAccent: "#e8343f",
      hat: "bucket", hatColor: "#1f1f24", back: null, number: "07", extras: ["chain"], chest: "jersey" },
    { id: "pinguim-surf", name: "Pinguim Surfista", desc: "Colar havaiano e prancha nas costas",
      head: "penguin", fur: "#23252e", furDark: "#14151b", outfit: "#23252e", pants: "#23252e", shoes: "#ff9f1c", shoeAccent: "#ff9f1c",
      hat: null, back: "surfboard", backColor: "#4fd1c5", tail: "penguin", extras: ["lei"], armColor: "#23252e", chest: "belly", bellyColor: "#f4f1ea" },
    { id: "lhama-rock", name: "Lhama Rockstar", desc: "Jaqueta de couro e guitarra",
      head: "llama", fur: "#f3eadb", furDark: "#d9cbb3", outfit: "#26262e", pants: "#3a3f55", shoes: "#26262e", shoeAccent: "#ff3d6e",
      hat: null, back: "guitar", backColor: "#e8343f", chest: "jacket" }
  ];

  // ---------- utilitários de desenho ----------
  const INK = "#1b1420", LINE = "rgba(27,20,32,.6)";
  function shade(col, k) {
    const n = parseInt(col.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  // contorno de desenho animado nas formas principais
  const outline = (g, w) => { g.strokeStyle = LINE; g.lineWidth = w; g.stroke(); };
  const ell = (g, x, y, rx, ry, col, rot = 0, ow = 0) => {
    g.fillStyle = col; g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, 7); g.fill(); if (ow) outline(g, ow);
  };
  const rr = (g, x, y, w, h, r, col, ow = 0) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); if (ow) outline(g, ow); };
  const tri = (g, pts, col, ow = 0) => {
    g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); if (ow) outline(g, ow);
  };
  function star(g, x, y, r, col) {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath(); g.fill();
  }
  const furD = sk => sk.furDark || shade(sk.fur, 0.72);

  // ---------- rosto (de frente) ----------
  function eyes(g, cx, ey, s, mood, t, gap, size = 1) {
    const blink = (t % 3.7) < 0.12 && mood !== "shock";
    for (const sg of [-1, 1]) {
      const x = cx + sg * s * gap;
      if (blink || mood === "laugh") { // olho fechado: risquinho ou "^^" de risada
        g.strokeStyle = INK; g.lineWidth = s * 0.026; g.lineCap = "round"; g.beginPath();
        if (mood === "laugh") g.arc(x, ey + s * 0.025, s * 0.048 * size, Math.PI * 1.15, Math.PI * 1.85);
        else { g.moveTo(x - s * 0.05 * size, ey); g.lineTo(x + s * 0.05 * size, ey); }
        g.stroke(); g.lineCap = "butt"; continue;
      }
      const ry = s * (mood === "shock" ? 0.092 : 0.078) * size;
      ell(g, x, ey, s * 0.066 * size, ry, "#fff", 0, s * 0.014);
      const pr = s * (mood === "shock" ? 0.028 : 0.043) * size, look = mood === "focus" ? 0 : sg * s * 0.006;
      ell(g, x + look, ey + s * 0.012, pr, pr * 1.12, INK);
      ell(g, x + look - pr * 0.38, ey + s * 0.012 - pr * 0.45, pr * 0.4, pr * 0.4, "#fff");
      ell(g, x + look + pr * 0.35, ey + s * 0.012 + pr * 0.4, pr * 0.16, pr * 0.16, "rgba(255,255,255,.8)");
    }
  }
  function brows(g, cx, by, s, mood, gap, col) {
    const tilt = mood === "focus" ? 0.03 : mood === "sad" ? -0.028 : 0, lift = mood === "shock" ? -0.04 : mood === "laugh" ? -0.015 : 0;
    g.strokeStyle = col; g.lineWidth = s * 0.03; g.lineCap = "round";
    for (const sg of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + sg * s * (gap - 0.045), by + (tilt + lift) * s);
      g.quadraticCurveTo(cx + sg * s * gap, by + (lift - 0.012) * s, cx + sg * s * (gap + 0.05), by + (lift - tilt * 0.6) * s);
      g.stroke();
    }
    g.lineCap = "butt";
  }
  function mouth(g, mx, my, s, mood, w = 1) {
    g.strokeStyle = INK; g.lineWidth = s * 0.024; g.lineCap = "round";
    if (mood === "laugh") {
      g.fillStyle = "#4a1a2a"; g.beginPath();
      g.moveTo(mx - s * 0.075 * w, my - s * 0.012); g.quadraticCurveTo(mx, my + s * 0.11, mx + s * 0.075 * w, my - s * 0.012); g.closePath(); g.fill();
      ell(g, mx, my + s * 0.045, s * 0.035 * w, s * 0.02, "#ff7a95");
      g.fillStyle = "#fff"; g.fillRect(mx - s * 0.04 * w, my - s * 0.01, s * 0.08 * w, s * 0.018);
    } else if (mood === "shock") {
      ell(g, mx, my + s * 0.02, s * 0.034, s * 0.048, "#4a1a2a", 0, s * 0.012);
    } else if (mood === "sad") {
      g.beginPath(); g.arc(mx, my + s * 0.07, s * 0.055 * w, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    } else if (mood === "focus") {
      g.beginPath(); g.moveTo(mx - s * 0.045 * w, my + s * 0.01); g.quadraticCurveTo(mx, my + s * 0.022, mx + s * 0.05 * w, my - s * 0.008); g.stroke();
    } else { // happy
      g.beginPath(); g.arc(mx, my - s * 0.025, s * 0.058 * w, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
    }
    g.lineCap = "butt";
  }
  const blush = (g, cx, y, s, gap) => { for (const sg of [-1, 1]) ell(g, cx + sg * s * gap, y, s * 0.045, s * 0.026, "rgba(255,110,140,.38)"); };

  function faceFront(g, sk, cx, hy, s, mood, t) {
    const fur = sk.fur, fd = furD(sk), ow = s * 0.022;
    switch (sk.head) {
      case "panda":
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.25, hy - s * 0.24, s * 0.11, s * 0.1, fd, 0, ow);
        ell(g, cx, hy, s * 0.35, s * 0.31, fur, 0, ow);
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.13, hy - s * 0.01, s * 0.085, s * 0.11, fd, sg * 0.45);
        eyes(g, cx, hy - s * 0.01, s, mood, t, 0.13, 0.85);
        brows(g, cx, hy - s * 0.15, s, mood, 0.13, "#3a3a44");
        ell(g, cx, hy + s * 0.11, s * 0.12, s * 0.08, "#fff");
        ell(g, cx, hy + s * 0.075, s * 0.04, s * 0.026, INK);
        mouth(g, cx, hy + s * 0.14, s, mood, 0.8);
        blush(g, cx, hy + s * 0.08, s, 0.22);
        break;
      case "fox":
        for (const sg of [-1, 1]) {
          tri(g, [[cx + sg * s * 0.08, hy - s * 0.2], [cx + sg * s * 0.33, hy - s * 0.52], [cx + sg * s * 0.33, hy - s * 0.1]], fur, ow);
          tri(g, [[cx + sg * s * 0.16, hy - s * 0.22], [cx + sg * s * 0.3, hy - s * 0.43], [cx + sg * s * 0.3, hy - s * 0.18]], "#ffe3c8");
        }
        ell(g, cx, hy, s * 0.33, s * 0.29, fur, 0, ow);
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.17, hy + s * 0.12, s * 0.14, s * 0.12, "#fff4e6");
        tri(g, [[cx - s * 0.1, hy + s * 0.04], [cx + s * 0.1, hy + s * 0.04], [cx, hy + s * 0.2]], "#fff4e6");
        eyes(g, cx, hy - s * 0.04, s, mood, t, 0.13, 0.85);
        brows(g, cx, hy - s * 0.16, s, mood, 0.13, shade(fd, 0.7));
        ell(g, cx, hy + s * 0.08, s * 0.045, s * 0.03, INK);
        mouth(g, cx, hy + s * 0.15, s, mood, 0.75);
        break;
      case "cat":
        for (const sg of [-1, 1]) {
          tri(g, [[cx + sg * s * 0.1, hy - s * 0.18], [cx + sg * s * 0.34, hy - s * 0.4], [cx + sg * s * 0.31, hy - s * 0.04]], fur, ow);
          tri(g, [[cx + sg * s * 0.17, hy - s * 0.17], [cx + sg * s * 0.31, hy - s * 0.32], [cx + sg * s * 0.29, hy - s * 0.1]], "#ffb3c6");
        }
        ell(g, cx, hy, s * 0.32, s * 0.28, fur, 0, ow);
        g.strokeStyle = fd; g.lineWidth = s * 0.03;
        for (const dx of [-0.07, 0, 0.07]) { g.beginPath(); g.moveTo(cx + dx * s, hy - s * 0.27); g.lineTo(cx + dx * s, hy - s * 0.17); g.stroke(); }
        ell(g, cx, hy + s * 0.11, s * 0.13, s * 0.09, shade(fur, 1.25));
        eyes(g, cx, hy - s * 0.03, s, mood, t, 0.13, 0.9);
        brows(g, cx, hy - s * 0.15, s, mood, 0.13, fd);
        tri(g, [[cx - s * 0.03, hy + s * 0.06], [cx + s * 0.03, hy + s * 0.06], [cx, hy + s * 0.095]], "#ff8fab");
        g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = s * 0.01;
        for (const sg of [-1, 1]) for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(cx + sg * s * 0.12, hy + s * (0.1 + k * 0.025)); g.lineTo(cx + sg * s * 0.3, hy + s * (0.08 + k * 0.045)); g.stroke(); }
        if (mood === "happy" || mood === "focus") { // boquinha em "w"
          g.strokeStyle = INK; g.lineWidth = s * 0.02; g.beginPath();
          g.arc(cx - s * 0.025, hy + s * 0.12, s * 0.025, 0.1 * Math.PI, 0.9 * Math.PI); g.arc(cx + s * 0.025, hy + s * 0.12, s * 0.025, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
        } else mouth(g, cx, hy + s * 0.14, s, mood, 0.7);
        break;
      case "frog":
        ell(g, cx, hy + s * 0.04, s * 0.4, s * 0.25, fur, 0, ow);
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.19, hy - s * 0.15, s * 0.14, s * 0.13, fur, 0, ow);
        eyes(g, cx, hy - s * 0.15, s, mood, t, 0.19, 1.35);
        brows(g, cx, hy - s * 0.31, s, mood, 0.19, fd);
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.04, hy + s * 0.03, s * 0.012, s * 0.009, fd);
        if (mood === "happy" || mood === "focus") {
          g.strokeStyle = INK; g.lineWidth = s * 0.025; g.lineCap = "round";
          g.beginPath(); g.moveTo(cx - s * 0.22, hy + s * 0.08); g.quadraticCurveTo(cx, hy + s * (mood === "happy" ? 0.2 : 0.13), cx + s * 0.22, hy + s * 0.08); g.stroke(); g.lineCap = "butt";
        } else mouth(g, cx, hy + s * 0.12, s, mood, 1.6);
        blush(g, cx, hy + s * 0.1, s, 0.26);
        break;
      case "penguin":
        ell(g, cx, hy + s * 0.02, s * 0.33, s * 0.31, fur, 0, ow);
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.1, hy + s * 0.02, s * 0.15, s * 0.2, "#f4f1ea", sg * 0.25);
        eyes(g, cx, hy - s * 0.02, s, mood, t, 0.1, 0.8);
        brows(g, cx, hy - s * 0.13, s, mood, 0.1, "#3a3a44");
        if (mood === "laugh" || mood === "shock") mouth(g, cx, hy + s * 0.12, s, mood, 0.7);
        tri(g, [[cx - s * 0.06, hy + s * 0.07], [cx + s * 0.06, hy + s * 0.07], [cx, hy + s * 0.14]], "#ff9f1c", s * 0.012);
        blush(g, cx, hy + s * 0.08, s, 0.17);
        break;
      case "llama": {
        rr(g, cx - s * 0.14, hy - s * 0.05, s * 0.28, s * 0.42, s * 0.13, fur, ow);
        const fy = hy - s * 0.22;
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.19, fy - s * 0.2, s * 0.06, s * 0.15, fd, sg * 0.35, ow);
        ell(g, cx, fy, s * 0.24, s * 0.23, fur, 0, ow);
        for (let i = -2; i <= 2; i++) ell(g, cx + i * s * 0.065, fy - s * 0.2, s * 0.07, s * 0.06, "#fff8ec");
        ell(g, cx, fy + s * 0.1, s * 0.14, s * 0.11, shade(fur, 0.92));
        eyes(g, cx, fy - s * 0.04, s, mood, t, 0.11, 0.8);
        brows(g, cx, fy - s * 0.15, s, mood, 0.11, shade(fd, 0.7));
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.04, fy + s * 0.07, s * 0.016, s * 0.011, INK);
        mouth(g, cx, fy + s * 0.15, s, mood, 0.6);
        blush(g, cx, fy + s * 0.06, s, 0.16);
        break;
      }
      default: { // capivara: olhos no alto, focinho grande e quadradão
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.24, hy - s * 0.24, s * 0.075, s * 0.065, fd, 0, ow);
        ell(g, cx, hy, s * 0.35, s * 0.3, fur, 0, ow);
        ell(g, cx, hy - s * 0.2, s * 0.18, s * 0.06, shade(fur, 1.12));
        rr(g, cx - s * 0.18, hy + s * 0.0, s * 0.36, s * 0.24, s * 0.11, shade(fur, 0.86));
        eyes(g, cx, hy - s * 0.09, s, mood, t, 0.15, 0.82);
        brows(g, cx, hy - s * 0.2, s, mood, 0.15, shade(fd, 0.7));
        for (const sg of [-1, 1]) ell(g, cx + sg * s * 0.06, hy + s * 0.05, s * 0.025, s * 0.016, INK, sg * 0.4);
        mouth(g, cx, hy + s * 0.15, s, mood, 0.85);
        blush(g, cx, hy + s * 0.05, s, 0.25);
      }
    }
  }

  // ---------- cabeça de costas (com olhadinha por cima do ombro) ----------
  function headBack(g, sk, px, hy, s, t, look) {
    const fur = sk.fur, fd = furD(sk), ow = s * 0.022;
    switch (sk.head) {
      case "panda":
        for (const sg of [-1, 1]) ell(g, px + sg * s * 0.24, hy - s * 0.24, s * 0.11, s * 0.1, fd, 0, ow);
        ell(g, px, hy, s * 0.34, s * 0.31, fur, 0, ow); break;
      case "fox":
        for (const sg of [-1, 1]) {
          tri(g, [[px + sg * s * 0.1, hy - s * 0.18], [px + sg * s * 0.32, hy - s * 0.5], [px + sg * s * 0.32, hy - s * 0.1]], fur, ow);
          tri(g, [[px + sg * s * 0.27, hy - s * 0.4], [px + sg * s * 0.32, hy - s * 0.5], [px + sg * s * 0.32, hy - s * 0.36]], "#22222b");
        }
        ell(g, px, hy, s * 0.32, s * 0.28, fur, 0, ow); ell(g, px, hy + s * 0.1, s * 0.26, s * 0.16, fd); break;
      case "cat":
        for (const sg of [-1, 1]) tri(g, [[px + sg * s * 0.14, hy - s * 0.16], [px + sg * s * 0.36, hy - s * 0.36], [px + sg * s * 0.32, hy - s * 0.04]], fur, ow);
        ell(g, px, hy, s * 0.31, s * 0.27, fur, 0, ow);
        g.strokeStyle = fd; g.lineWidth = s * 0.035;
        for (const dx of [-0.1, 0, 0.1]) { g.beginPath(); g.moveTo(px + dx * s, hy - s * 0.2); g.lineTo(px + dx * s, hy - s * 0.06); g.stroke(); }
        break;
      case "frog":
        ell(g, px, hy + s * 0.02, s * 0.38, s * 0.26, fur, 0, ow);
        for (const sg of [-1, 1]) { ell(g, px + sg * s * 0.2, hy - s * 0.2, s * 0.13, s * 0.12, fur, 0, ow); ell(g, px + sg * s * 0.2, hy - s * 0.24, s * 0.06, s * 0.05, fd); }
        break;
      case "penguin": ell(g, px, hy + s * 0.03, s * 0.32, s * 0.3, fur, 0, ow); break;
      case "llama":
        rr(g, px - s * 0.13, hy - s * 0.05, s * 0.26, s * 0.4, s * 0.12, fur, ow);
        for (const sg of [-1, 1]) ell(g, px + sg * s * 0.17, hy - s * 0.42, s * 0.06, s * 0.14, fd, sg * 0.3, ow);
        ell(g, px, hy - s * 0.22, s * 0.25, s * 0.22, fur, 0, ow);
        for (let i = -2; i <= 2; i++) ell(g, px + i * s * 0.07, hy - s * 0.4, s * 0.07, s * 0.06, "#fff8ec");
        break;
      default:
        ell(g, px - s * 0.22, hy - s * 0.24, s * 0.08, s * 0.07, fd, 0, ow); ell(g, px + s * 0.22, hy - s * 0.24, s * 0.08, s * 0.07, fd, 0, ow);
        ell(g, px, hy, s * 0.34, s * 0.3, fur, 0, ow); ell(g, px, hy + s * 0.08, s * 0.3, s * 0.2, fd);
        g.strokeStyle = shade(fur, 1.2); g.lineWidth = s * 0.02;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(px + i * s * 0.08, hy - s * 0.12); g.lineTo(px + i * s * 0.1, hy - s * 0.02); g.stroke(); }
    }
    // olhando por cima do ombro: aparece um olho e o focinho de perfil
    if (Math.abs(look) > 0.15) {
      const sg = Math.sign(look), k = Math.min(1, Math.abs(look)), fy = sk.head === "llama" ? hy - s * 0.22 : hy;
      const snout = sk.head === "penguin" ? "#ff9f1c" : sk.head === "panda" ? "#fff" : sk.head === "fox" ? "#fff4e6" : shade(sk.fur, 0.86);
      ell(g, px + sg * s * (0.27 + 0.08 * k), fy + s * 0.07, s * (0.07 + 0.05 * k), s * 0.075, snout, 0, s * 0.015);
      ell(g, px + sg * s * (0.38 + 0.08 * k), fy + s * 0.05, s * 0.022, s * 0.018, INK);
      ell(g, px + sg * s * 0.2, fy - s * 0.04, s * 0.05, s * 0.058, "#fff", 0, s * 0.012);
      ell(g, px + sg * s * 0.215, fy - s * 0.035, s * 0.028, s * 0.032, INK);
      ell(g, px + sg * s * 0.205, fy - s * 0.045, s * 0.01, s * 0.01, "#fff");
    }
  }

  // ---------- chapéus ----------
  function hat(g, sk, px, hy, s, t, front) {
    // sapo: de frente o chapéu fica acima dos olhos saltados
    const c = sk.hatColor, top = sk.head === "llama" ? hy - s * 0.22 : sk.head === "frog" && front ? hy - s * 0.3 : hy, ow = s * 0.02;
    if (sk.hat === "headphones") {
      g.strokeStyle = shade(c, 0.8); g.lineWidth = s * 0.07;
      g.beginPath(); g.ellipse(px, top - s * 0.02, s * 0.34, s * 0.3, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
      const big = sk.head === "panda" ? 1.35 : 1;
      for (const sg of [-1, 1]) {
        const x = sg < 0 ? px - s * (0.36 + 0.06 * big) : px + s * 0.29;
        rr(g, x, top - s * 0.1, s * 0.13 * big, s * 0.22 * big, s * 0.06, c, ow);
        rr(g, x + s * 0.03, top - s * 0.06, s * 0.07 * big, s * 0.14 * big, s * 0.03, "rgba(255,255,255,.35)");
      }
    } else if (sk.hat === "capBack") {
      if (front) {
        ell(g, px, top - s * 0.33, s * 0.22, s * 0.07, shade(c, 0.75), 0, ow); // aba aparecendo atrás
        ell(g, px, top - s * 0.23, s * 0.34, s * 0.12, c, 0, ow);               // copa acima dos olhos
        rr(g, px - s * 0.09, top - s * 0.16, s * 0.18, s * 0.045, s * 0.022, "#fff");
      } else {
        ell(g, px, top - s * 0.12, s * 0.33, s * 0.2, c, 0, ow);
        rr(g, px - s * 0.12, top - s * 0.02, s * 0.24, s * 0.06, s * 0.03, "#fff");
        ell(g, px, top + s * 0.1, s * 0.25, s * 0.07, shade(c, 0.75), 0, ow);
      }
    } else if (sk.hat === "wizard") {
      ell(g, px, top - s * 0.15, s * 0.44, s * 0.11, c, 0, ow);
      tri(g, [[px - s * 0.25, top - s * 0.17], [px + s * 0.25, top - s * 0.17], [px + s * 0.12 + Math.sin(t * 3) * s * 0.03, top - s * 0.88]], c, ow);
      rr(g, px - s * 0.24, top - s * 0.24, s * 0.48, s * 0.07, s * 0.03, "#ffd23f");
      star(g, px - s * 0.06, top - s * 0.4, s * 0.07, "#ffd23f"); star(g, px + s * 0.08, top - s * 0.58, s * 0.05, "#ffd23f");
    } else if (sk.hat === "bucket") {
      ell(g, px, top - s * 0.07, s * 0.43, s * 0.11, c, 0, ow);
      tri(g, [[px - s * 0.3, top - s * 0.09], [px + s * 0.3, top - s * 0.09], [px + s * 0.24, top - s * 0.34], [px - s * 0.24, top - s * 0.34]], c, ow);
      rr(g, px - s * 0.29, top - s * 0.16, s * 0.58, s * 0.05, s * 0.02, "#ffd23f");
    } else if (sk.hat === "headband") {
      rr(g, px - s * 0.33, top - s * 0.12, s * 0.66, s * 0.09, s * 0.04, c, ow);
      if (front) ell(g, px, top - s * 0.075, s * 0.05, s * 0.04, "#f4f4f4"); // plaquinha na testa
      g.strokeStyle = c; g.lineWidth = s * 0.06; g.lineCap = "round";
      for (const k of [0, 1]) {
        g.beginPath(); g.moveTo(px + s * 0.28, top - s * 0.07);
        g.quadraticCurveTo(px + s * (0.4 + k * 0.1), top + s * 0.08 + Math.sin(t * 9 + k) * s * 0.06, px + s * (0.52 + k * 0.1), top + s * (0.2 + k * 0.08) + Math.sin(t * 9 + k + 1) * s * 0.08);
        g.stroke();
      }
      g.lineCap = "butt";
    } else if (sk.hat === "helmet") {
      const gl = g.createRadialGradient(px - s * 0.14, top - s * 0.17, s * 0.04, px, top, s * 0.48);
      gl.addColorStop(0, "rgba(255,255,255,.35)"); gl.addColorStop(0.35, "rgba(190,230,255,.06)"); gl.addColorStop(1, "rgba(160,210,255,.4)");
      g.fillStyle = gl; g.beginPath(); g.arc(px, top, s * 0.47, 0, 7); g.fill();
      g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = s * 0.03; g.beginPath(); g.arc(px, top, s * 0.47, 0, 7); g.stroke();
      g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = s * 0.025; g.beginPath(); g.arc(px, top, s * 0.38, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
      rr(g, px - s * 0.36, top + s * 0.31, s * 0.72, s * 0.11, s * 0.05, "#c9ced8", ow);
    }
  }

  // ---------- objeto das costas ----------
  function backItem(g, sk, px, y, s, t) {
    const c = sk.backColor, ow = s * 0.02;
    if (sk.back === "backpack") {
      rr(g, px - s * 0.25, y - s * 0.03, s * 0.5, s * 0.42, s * 0.11, c, ow);
      rr(g, px - s * 0.19, y + s * 0.2, s * 0.38, s * 0.14, s * 0.05, shade(c, 0.82), ow);
      rr(g, px - s * 0.12, y + s * 0.03, s * 0.24, s * 0.04, s * 0.02, shade(c, 0.7));
      ell(g, px + s * 0.12, y + s * 0.1, s * 0.05, s * 0.05, "#ff3d6e", 0, s * 0.01);
      star(g, px - s * 0.1, y + s * 0.12, s * 0.035, "#fff");
    } else if (sk.back === "vinyl") {
      ell(g, px, y + s * 0.15, s * 0.31, s * 0.31, "#111", 0, ow);
      g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = s * 0.015;
      for (const r of [0.14, 0.2, 0.25]) { g.beginPath(); g.arc(px, y + s * 0.15, s * r, 0, 7); g.stroke(); }
      g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = s * 0.02; g.beginPath(); g.arc(px, y + s * 0.15, s * 0.22, t * 2, t * 2 + 0.8); g.stroke();
      ell(g, px, y + s * 0.15, s * 0.09, s * 0.09, "#39ff9c"); ell(g, px, y + s * 0.15, s * 0.02, s * 0.02, "#111");
    } else if (sk.back === "bamboo") {
      g.save(); g.translate(px, y + s * 0.15); g.rotate(-0.6);
      rr(g, -s * 0.05, -s * 0.75, s * 0.1, s * 1.5, s * 0.04, "#7fae3f", ow);
      g.fillStyle = "#5c8a2c"; for (let k = -0.6; k < 0.75; k += 0.3) g.fillRect(-s * 0.06, k * s, s * 0.12, s * 0.035);
      g.restore();
    } else if (sk.back === "surfboard") {
      // presa na diagonal, saindo pelo ombro, para não esconder o corpo
      g.save(); g.translate(px + s * 0.32, y + s * 0.05); g.rotate(0.55);
      rr(g, -s * 0.11, -s * 0.7, s * 0.22, s * 1.25, s * 0.11, c, ow);
      g.fillStyle = "#fff"; g.fillRect(-s * 0.02, -s * 0.65, s * 0.04, s * 1.15);
      g.fillStyle = "#ff7a2f"; g.fillRect(-s * 0.11, -s * 0.15, s * 0.22, s * 0.06);
      g.restore();
    } else if (sk.back === "tank") {
      for (const dx of [-0.12, 0.12]) { rr(g, px + dx * s - s * 0.1, y - s * 0.08, s * 0.2, s * 0.5, s * 0.1, c, ow); rr(g, px + dx * s - s * 0.1, y - s * 0.08, s * 0.2, s * 0.08, s * 0.04, "#c9ced8"); }
      ell(g, px, y + s * 0.3, s * 0.04, s * 0.04, Math.floor(t * 3) % 2 ? "#ff3d3d" : "#5a1a1a");
    } else if (sk.back === "guitar") {
      g.save(); g.translate(px, y + s * 0.15); g.rotate(-0.5);
      rr(g, -s * 0.03, -s * 0.85, s * 0.06, s * 0.75, s * 0.02, "#3b2a20", ow);
      ell(g, 0, s * 0.05, s * 0.2, s * 0.24, c, 0, ow); ell(g, 0, -s * 0.18, s * 0.15, s * 0.16, c, 0, ow);
      ell(g, 0, -s * 0.02, s * 0.05, s * 0.05, "#1a1a1a");
      rr(g, -s * 0.06, -s * 0.95, s * 0.12, s * 0.14, s * 0.03, "#1a1a1a");
      g.restore();
    }
  }
  function tail(g, sk, px, y, s, t) {
    const fur = sk.fur, sway = Math.sin(t * 8) * 0.2;
    if (sk.tail === "fox") {
      g.save(); g.translate(px + s * 0.15, y); g.rotate(0.9 + sway);
      ell(g, 0, s * 0.3, s * 0.16, s * 0.34, fur, 0, s * 0.02); ell(g, 0, s * 0.56, s * 0.1, s * 0.12, "#fff");
      g.restore();
    } else if (sk.tail === "cat") {
      g.strokeStyle = fur; g.lineWidth = s * 0.07; g.lineCap = "round";
      g.beginPath(); g.moveTo(px + s * 0.1, y); g.quadraticCurveTo(px + s * 0.5, y + s * 0.05, px + s * (0.42 + sway * 0.3), y - s * 0.4); g.stroke();
      g.lineCap = "butt";
    } else if (sk.tail === "penguin") tri(g, [[px - s * 0.1, y], [px + s * 0.1, y], [px, y + s * 0.16]], furD(sk));
  }

  // ---------- detalhes da frente da roupa ----------
  function chest(g, sk, px, y, s, t) {
    const o = sk.outfit;
    switch (sk.chest) {
      case "hoodie":
        rr(g, px - s * 0.2, y + s * 0.2, s * 0.4, s * 0.18, s * 0.07, shade(o, 0.82));
        g.strokeStyle = "#fff"; g.lineWidth = s * 0.018;
        for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(px + sg * s * 0.07, y - s * 0.02); g.lineTo(px + sg * s * 0.08, y + s * 0.14); g.stroke(); }
        for (const sg of [-1, 1]) rr(g, px + sg * s * 0.26 - s * 0.04, y - s * 0.05, s * 0.08, s * 0.3, s * 0.03, sk.backColor);
        break;
      case "tee":
        tri(g, [[px + s * 0.02, y + s * 0.02], [px - s * 0.09, y + s * 0.2], [px, y + s * 0.2], [px - s * 0.04, y + s * 0.36], [px + s * 0.1, y + s * 0.14], [px + s * 0.02, y + s * 0.14]], "#ffd23f");
        break;
      case "astro":
        rr(g, px - s * 0.17, y + s * 0.08, s * 0.34, s * 0.2, s * 0.04, "#c9ced8", s * 0.012);
        ["#ff3d3d", "#ffd23f", "#39d98a"].forEach((c, i) => ell(g, px - s * 0.09 + i * s * 0.09, y + s * 0.18, s * 0.03, s * 0.03, c));
        rr(g, px - s * 0.3, y - s * 0.02, s * 0.1, s * 0.07, s * 0.01, "#2f7df6");
        break;
      case "belly":
        ell(g, px, y + s * 0.2, s * 0.24, s * 0.25, sk.bellyColor || "#fff");
        break;
      case "gi":
        g.fillStyle = "#3a3a46"; tri(g, [[px - s * 0.2, y - s * 0.04], [px, y + s * 0.24], [px + s * 0.2, y - s * 0.04], [px + s * 0.1, y - s * 0.04], [px, y + s * 0.12], [px - s * 0.1, y - s * 0.04]], "#3a3a46");
        rr(g, px - s * 0.36, y + s * 0.3, s * 0.72, s * 0.07, s * 0.03, sk.hatColor);
        break;
      case "robe":
        tri(g, [[px - s * 0.18, y - s * 0.04], [px, y + s * 0.12], [px + s * 0.18, y - s * 0.04]], shade(o, 1.3));
        star(g, px, y + s * 0.12, s * 0.05, "#ffd23f");
        break;
      case "jersey":
        g.fillStyle = "#2f6fd6"; g.font = `900 ${s * 0.2}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(sk.number || "", px, y + s * 0.24);
        break;
      case "jacket":
        rr(g, px - s * 0.08, y - s * 0.04, s * 0.16, s * 0.48, s * 0.04, "#f4f4f4");
        g.strokeStyle = "#8a8fa0"; g.lineWidth = s * 0.012;
        for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(px + sg * s * 0.09, y - s * 0.04); g.lineTo(px + sg * s * 0.09, y + s * 0.44); g.stroke(); }
        g.strokeStyle = "#5a3a2a"; g.lineWidth = s * 0.04;
        g.beginPath(); g.moveTo(px - s * 0.3, y - s * 0.02); g.lineTo(px + s * 0.3, y + s * 0.4); g.stroke();
        break;
    }
  }

  // ---------- desenho completo ----------
  // P: { t, run, air, roll, powerBoard, view: "back" | "front", look (-1..1), mood,
  //      lean (-1..1: inclina ao trocar de pista), squash (0..1: amassa ao aterrissar),
  //      stretch (0..1: estica no pulo), wave (acena), stumble (0..1: tropeção) }
  // (px, py) = pés do personagem na tela  ·  s = escala
  function limb(g, x, y, ang, len, w, col, ow) {
    g.save(); g.translate(x, y); g.rotate(ang);
    rr(g, -w / 2, 0, w, len, w / 2, col, ow);
    g.restore();
    return [x - Math.sin(ang) * len, y + Math.cos(ang) * len];
  }
  function draw(g, px, py, s, sk, P) {
    sk = sk || SKINS[0];
    const lean = P.lean || 0, sq = P.squash || 0, st = P.stretch || 0, wob = P.stumble ? Math.sin((P.t || 0) * 40) * P.stumble * 0.12 : 0;
    g.save();
    // inclina, amassa e estica o corpo inteiro a partir dos pés
    g.translate(px, py); g.rotate(lean * 0.18 + wob); g.scale(1 + sq * 0.16 - st * 0.07, 1 - sq * 0.16 + st * 0.1); g.translate(-px, -py);
    body(g, px, py, s, sk, P);
    g.restore();
  }
  function body(g, px, py, s, sk, P) {
    const fur = sk.fur, fd = furD(sk), out = sk.outfit, t = P.t || 0, front = P.view === "front", ow = s * 0.022;
    const skate = (sk.extras || []).includes("board") && !P.powerBoard;
    let by = py;
    if (skate) {
      by = py - s * 0.18;
      const tilt = P.run ? Math.sin(t * 4) * 0.04 : 0;
      g.save(); g.translate(px, by + s * 0.07); g.rotate(tilt); g.translate(-px, -(by + s * 0.07));
      rr(g, px - s * 0.62, by + s * 0.02, s * 1.24, s * 0.1, s * 0.05, sk.boardColor, ow);
      rr(g, px - s * 0.5, by + s * 0.03, s * 1.0, s * 0.03, s * 0.015, "rgba(255,255,255,.6)");
      for (const dx of [-0.42, 0.42]) ell(g, px + dx * s, by + s * 0.14, s * 0.06, s * 0.06, "#f4f4f4", 0, s * 0.012);
      g.restore();
    }
    if (P.roll) { // rolando: vira uma bolinha girando, baixa o bastante para caber sob as barreiras
      const cy = by - s * 0.33, a = t * 22;
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = s * 0.04; g.lineCap = "round"; // rastro de giro
      for (const r of [0.42, 0.5]) { g.beginPath(); g.arc(px, cy, s * r, a + 2.4, a + 3.6); g.stroke(); }
      g.lineCap = "butt";
      ell(g, px, cy, s * 0.36, s * 0.33, sk.head === "panda" || sk.head === "penguin" ? fd : fur, 0, ow);
      g.strokeStyle = out; g.lineWidth = s * 0.11; g.beginPath(); g.arc(px, cy, s * 0.24, a, a + 2.2); g.stroke();
      g.strokeStyle = fd; g.lineWidth = s * 0.04; g.beginPath(); g.arc(px, cy, s * 0.29, a + 3, a + 4.5); g.stroke();
      return;
    }
    const ph = t * 15, run = P.run && !P.air;
    const swing = run && !skate ? Math.sin(ph) : 0;
    // respiração parado, balanço correndo (duas batidas por passada)
    const bob = run && !skate ? Math.abs(Math.cos(ph)) * s * 0.06 : P.run ? 0 : Math.sin(t * 3) * s * 0.012;
    const push = skate && run ? Math.max(0, Math.sin(t * 4)) : 0;
    const hipY = by - s * 0.45 - bob, bodyY = hipY - s * 0.38;
    if (front) { tail(g, sk, px, hipY + s * 0.02, s, t); if (sk.back === "surfboard" || sk.back === "bamboo" || sk.back === "guitar") backItem(g, sk, px, bodyY, s, t); }
    // pernas: giram a partir do quadril; no ar ficam dobradas, no skate uma dá impulso
    for (const sg of [-1, 1]) {
      const ang = P.air ? sg * 0.45 : skate ? (sg > 0 ? push * 0.55 : -0.06) : swing * sg * 0.62;
      const len = P.air ? s * 0.32 : s * (0.42 - Math.max(0, swing * sg) * 0.08);
      const [fx, fy] = limb(g, px + sg * s * 0.17, hipY, ang, len, s * 0.18, sk.pants, ow);
      ell(g, fx, fy, s * 0.13, s * 0.07, sk.shoes, ang * 0.5, ow);
      ell(g, fx, fy + s * 0.02, s * 0.13, s * 0.03, sk.shoeAccent, ang * 0.5);
    }
    // braços: giram a partir dos ombros, em oposição às pernas; no ar vão para cima; no skate, abertos
    for (const sg of [-1, 1]) {
      const wave = P.wave && sg > 0 ? Math.PI - 0.5 + Math.sin(t * 9) * 0.35 : null;
      const ang = wave != null ? -wave : P.air ? sg * 2.5 : skate ? sg * (0.55 + Math.sin(t * 3 + sg) * 0.1) : -swing * sg * 0.75 + sg * 0.08;
      const [hx, hy2] = limb(g, px + sg * s * 0.36, bodyY + s * 0.06, ang, s * 0.34, s * 0.16, sk.armColor || shade(out, 0.85), ow);
      ell(g, hx, hy2, s * 0.08, s * 0.075, sk.head === "panda" ? fd : fur, 0, ow);
    }
    // tronco (gira um pouquinho com a passada)
    g.save(); g.translate(px, hipY); g.rotate(swing * 0.04); g.translate(-px, -hipY);
    if (sk.head === "penguin") ell(g, px, bodyY + s * 0.18, s * 0.42, s * 0.42, fur, 0, ow);
    else {
      rr(g, px - s * 0.36, bodyY - s * 0.05, s * 0.72, s * 0.52, s * 0.2, out, ow);
      rr(g, px - s * 0.36, bodyY + s * 0.38, s * 0.72, s * 0.08, s * 0.04, shade(out, 0.75));
      ell(g, px - s * 0.18, bodyY + s * 0.05, s * 0.12, s * 0.05, "rgba(255,255,255,.12)", -0.4); // brilho
    }
    if (front) chest(g, sk, px, bodyY, s, t);
    if (sk.stars) for (const [dx, dy] of [[-0.2, 0.1], [0.15, 0.25], [0.05, 0.02]]) star(g, px + dx * s, bodyY + dy * s, s * 0.05, "#ffd23f");
    if (sk.number && !front) {
      g.fillStyle = "rgba(255,255,255,.9)"; g.font = `900 ${s * 0.26}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(sk.number, px, bodyY + s * 0.2);
    }
    if (!front && (sk.back === "surfboard" || sk.back === "bamboo" || sk.back === "guitar")) backItem(g, sk, px, bodyY, s, t);
    if (!front) tail(g, sk, px, hipY + s * 0.02, s, t);
    if ((sk.extras || []).includes("lei")) for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.1 + i * 0.1);
      ell(g, px + Math.cos(a) * s * 0.3, bodyY - s * 0.04 + Math.sin(a) * s * (front ? 0.12 : 0.06), s * 0.06, s * 0.06, ["#ff4fa3", "#ffd23f", "#ff7a2f"][i % 3]);
    }
    if ((sk.extras || []).includes("chain")) {
      g.strokeStyle = "#ffd23f"; g.lineWidth = s * 0.04;
      g.beginPath(); g.ellipse(px, bodyY - s * 0.03, s * 0.24, s * (front ? 0.16 : 0.08), 0, 0.1, Math.PI - 0.1); g.stroke();
      if (front) { ell(g, px, bodyY + s * 0.15, s * 0.06, s * 0.06, "#ffd23f", 0, s * 0.012); ell(g, px, bodyY + s * 0.15, s * 0.025, s * 0.025, "#b8860b"); }
    }
    if (!front && sk.back && !["surfboard", "bamboo", "guitar"].includes(sk.back)) backItem(g, sk, px, bodyY, s, t);
    g.restore();
    // cabeça: balança com a passada e inclina para o lado da passada
    const hy = bodyY - s * 0.28 - (run ? Math.sin(ph * 2) * s * 0.02 : 0);
    g.save(); g.translate(px, hy + s * 0.2); g.rotate((run ? Math.sin(ph) * 0.05 : Math.sin(t * 2) * 0.03)); g.translate(-px, -(hy + s * 0.2));
    if (front) faceFront(g, sk, px, hy, s, P.mood || "happy", t);
    else headBack(g, sk, px, hy, s, t, P.look || 0);
    hat(g, sk, px, hy, s, t, front);
    g.restore();
  }

  // retrato (só a cabeça, de frente) para o avatar do canto da tela
  function portrait(g, cx, cy, r, sk, mood, t) {
    const s = r * 1.55, hy = cy + r * 0.12 + (sk.head === "llama" ? r * 0.3 : 0) + (sk.hat === "wizard" ? r * 0.25 : 0);
    faceFront(g, sk, cx, hy, s, mood, t);
    hat(g, sk, cx, hy, s, t, true);
  }

  // prévia (para o painel): de frente, sorrindo e às vezes rindo
  function preview(canvas, sk, t = 0) {
    const g = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    const s = h * 0.4;
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(w / 2, h * 0.92, s * 0.55, s * 0.12, 0, 0, 7); g.fill();
    const mood = (t % 6) > 4.6 ? "laugh" : "happy";
    draw(g, w / 2, h * 0.92, s, sk, { t, run: false, view: "front", mood, wave: (t % 6) < 1.6 });
  }

  return { SKINS, draw, portrait, preview, byId: id => SKINS.find(k => k.id === id) || SKINS[0] };
})();
