// Configuração padrão do jogo — edite à vontade (é um arquivo "modável").
// As regras de presentes também podem ser editadas pelo painel admin.html (fica salvo e sobrepõe estes valores).
window.CONFIG = {
  botCoins: true,              // false = o bot automático desvia das moedas o máximo possível
  mode: "meta",                // "meta": chegar na meta (bater tira metros) · "infinito": sem meta, bater acaba a run
  goalMeters: 100000,          // meta da live
  startSpeed: 22,              // metros por segundo
  maxSpeed: 45,
  speedGainPerSec: 0.08,
  crashPenaltyMeters: 200,     // quanto volta ao bater (0 = sem penalidade)
  likesPerPushback: 500,       // a cada N likes, volta likePushbackMeters
  likePushbackMeters: 10,
  showPopups: false,           // textos grandes no meio da tela (doações/memes)
  autoRestartSec: 25,          // depois da vitória, começa outra partida sozinho (0 = não reinicia)
  showLegend: true,            // faixa no rodapé mostrando o que cada presente faz
  skin: "capivara",            // personagem (ids em characters.js) — também escolhível no painel
  // atalhos de teclado (também no painel). kind: help (avança) | hurt (volta) | win | gift (simula presente) | likes
  shortcuts: [
    { code: "Digit1", kind: "help", meters: 50 },
    { code: "Digit2", kind: "hurt", meters: 50 },
    { code: "Digit3", kind: "help", meters: 1000 },
    { code: "Digit4", kind: "hurt", meters: 1000 },
    { code: "Digit0", kind: "likes", count: 100 }
  ],
  // regras de likes: a cada "every" likes faz algo (meters positivo = volta, negativo = avança)
  likeRules: [{ every: 500, meters: 10, effect: "" }],
  // o que aparece na tela do jogo (também no painel, cartão "Tela da live")
  hud: { wins: true, coins: true, likes: true, teams: true, legend: true, feed: true, top: true, avatar: true },
  hudTop: 110,                 // margem do topo, para não ficar embaixo do nome/espectadores da TikTok
  // teclas de cada ação (códigos de tecla do navegador) — também configuráveis no painel
  binds: {
    left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"], up: ["ArrowUp", "KeyW", "Space"], down: ["ArrowDown", "KeyS"],
    pause: ["KeyP", "Escape"], bot: ["KeyB"], mute: ["KeyM"]
  },
  sound: { master: 0.6, music: 0.35, sfx: 0.8 }, // volumes de 0 a 1 (tecla M liga/desliga o som)

  // Regras de presente. Vale a regra mais específica: primeiro as de um presente escolhido, depois a de maior minCoins.
  // Escolha os presentes pelo painel: ele usa o catálogo oficial da TikTok (ID, nome e imagem corretos).
  //   giftId / gift: presente escolhido (vazio = qualquer presente)
  //   meters: positivo = ATRAPALHA (volta), negativo = AJUDA (avança)
  //   effect: um dos efeitos de EFFECTS abaixo (ou "" para nenhum)
  // Presentes da live (a imagem dos presentes): meters positivo = volta (atrapalha), negativo = avança (ajuda).
  // perGift: vale para cada unidade (5 Rosas num combo = 5 × 50 m). aliases: o nome em outras línguas.
  // giftCoins: valor de 1 unidade em moedas (o catálogo oficial da TikTok atualiza sozinho quando a live conecta)
  donationRules: [
    { gift: "Rosa",            aliases: ["Rose"],                                  giftCoins: 1,   minCount: 1, perGift: true, meters: 50,    effect: "" },
    { gift: "TikTok",          aliases: [],                                        giftCoins: 1,   minCount: 1, perGift: true, meters: -50,   effect: "" },
    { gift: "Mini Dino",       aliases: ["Mini Dinosaur", "Tiny Dino"],            giftCoins: 10,  minCount: 1, perGift: true, meters: -500,  effect: "" },
    { gift: "Perfume",         aliases: [],                                        giftCoins: 20,  minCount: 1, perGift: true, meters: 500,   effect: "" },
    { gift: "Confete",         aliases: ["Confetti"],                              giftCoins: 100, minCount: 1, perGift: true, meters: -2500, effect: "" },
    { gift: "Mãos em coração", aliases: ["Hand Hearts", "Hand Heart"],             giftCoins: 100, minCount: 1, perGift: true, meters: 2500,  effect: "" },
    { gift: "Você é demais",   aliases: ["You're awesome", "You are awesome"],     giftCoins: 0,   minCount: 1, meters: 0, effect: "zera" },
    { gift: "Money Gun",       aliases: ["Arma de dinheiro"],                      giftCoins: 500, minCount: 1, meters: 0, effect: "win" }
  ],
  // presente que não está na lista acima: ajuda como o presente da lista de valor mais próximo (o "−" vira "+")
  giftFallback: true,

  memes: ["sigma grindset", "aura +1000", "skibidi trem", "é o bonde", "foco no shape", "não tankei", "brainrot speedrun"],

  colors: {
    sky: ["#5b4bc4", "#ff8f70", "#ffd28a"], ground: "#5b4a3c", rail: "#c9ccd6", sleeper: "#6e4f35",
    train: ["#2fb5a8", "#e8525c", "#f2b134", "#7b6cf6"], coin: "#ffd23f",
    player: "#a86f42", hoodie: "#2f7df6", headphones: "#ff3d6e", backpack: "#ffcf3a", board: "#ff4fa3"
  }
};

// Efeitos disponíveis para as regras (usados pelo jogo e pelo painel).
window.EFFECTS = {
  "":      { label: "Nenhum",                       kind: "" },
  train:   { label: "🚂 Trem na pista do jogador",   kind: "hurt" },
  speed:   { label: "⚡ Acelerar 10s",               kind: "hurt" },
  reverse: { label: "🔄 Inverter controles 10s",     kind: "hurt" },
  dark:    { label: "🌑 Escurecer a tela 10s",       kind: "hurt" },
  board:   { label: "🛹 Dar prancha",                kind: "help" },
  shield:  { label: "🛡️ Escudo 10s",                kind: "help" },
  magnet:  { label: "🧲 Ímã 12s",                    kind: "help" },
  double:  { label: "2️⃣ Moedas em dobro 12s",       kind: "help" },
  slow:    { label: "🐢 Desacelerar 10s",            kind: "help" },
  zera:    { label: "0️⃣ Zerar a distância",          kind: "hurt" },
  win:     { label: "🏆 VITÓRIA INSTANTÂNEA",        kind: "help" }
};
