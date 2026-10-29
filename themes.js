// Países do caminho. O país fica fixo até ser trocado no painel (admin.html); "Automático" troca a cada THEME_LENGTH metros.
// Para criar um país novo, copie um bloco e troque cores, monumentos (landmarks) e decorações (props).
//   landmarks: pagoda, tower, colosseum, dome, campanile, eiffel, haussmann, mountain, sugarloaf,
//              favela, pyramid, obelisk, windmill, canalHouses, skyscraper
//   props:     tree, olive, cypress, palm, bamboo, sakura, lantern, lamp, torii, tulips, flowers, bush, rock,
//              obeliskSmall, windmillSmall, house, pagodaHouse, cactus, bench, umbrella, flagpole
//   overhead:  enfeite pendurado sobre os trilhos: "lanterns" | "lights" | "bunting" | null
//   particles: clima/ambiente na tela: "petals" | "sand" | "confetti" | "leaves" | null
//   flag:      { type: "v3" | "h3", colors: [3 cores] } ou { type: "china" | "japan" | "brazil" }
window.THEME_LENGTH = 2000;
window.THEMES = [
  {
    name: "China", flag: { type: "china" },
    sky: ["#3a1f5c", "#e0566a", "#ffbe7a"], sun: "#ffe7c2",
    far: ["#7a3a4c", "#6c3343"], near: ["#41202f", "#361a27"], win: "rgba(255,190,110,.55)",
    landmarks: ["pagoda", "pagoda", "tower", "skyscraper"],
    wall: "#b3302f", wallTop: "#e0b04a", panels: ["#ffd23f", "#2f2f2f", "#ff6b4a"],
    outside: "#4d6b3a", house: ["#b3302f", "#8f2424", "#d9c9a8"], roof: "#2b2b2b",
    props: ["lantern", "lantern", "pagodaHouse", "bamboo", "tree", "bench", "flagpole"],
    overhead: "lanterns", lantern: "#e02b2b", particles: "leaves"
  },
  {
    name: "Itália", flag: { type: "v3", colors: ["#009246", "#ffffff", "#ce2b37"] },
    sky: ["#3f6fd1", "#f6a26b", "#ffe3a3"], sun: "#fff4d6",
    far: ["#c98a5b", "#b57a50"], near: ["#8b5a3c", "#7a4e33"], win: "rgba(255,230,170,.45)",
    landmarks: ["colosseum", "dome", "campanile"],
    wall: "#d48a5c", wallTop: "#efd6b4", panels: ["#2e8b57", "#fff6e0", "#cf3a3a"],
    outside: "#7a8f3a", house: ["#e3a36b", "#d9c08e", "#c9775a"], roof: "#b4522f",
    props: ["cypress", "cypress", "house", "olive", "flowers", "umbrella", "bench", "flagpole"],
    overhead: "lights", particles: null
  },
  {
    name: "França", flag: { type: "v3", colors: ["#0055a4", "#ffffff", "#ef4135"] },
    sky: ["#4e5fc9", "#f0a0c0", "#ffe0d0"], sun: "#fff3e6",
    far: ["#8d8fb5", "#7c7ea6"], near: ["#565a86", "#4a4e78"], win: "rgba(255,225,180,.5)",
    landmarks: ["eiffel", "haussmann", "dome", "haussmann"],
    wall: "#e3d6bb", wallTop: "#b9ab8e", panels: ["#2b4fd1", "#ffffff", "#e03a3e"],
    outside: "#5f8a4a", house: ["#ece0c8", "#d8cdb6", "#c9bfa8"], roof: "#4b5563",
    props: ["lamp", "tree", "house", "flowers", "umbrella", "bench", "flagpole"],
    overhead: "lights", particles: "leaves"
  },
  {
    name: "Japão", flag: { type: "japan" },
    sky: ["#ff8fc0", "#ffc4a3", "#fff0d6"], sun: "#ffffff",
    far: ["#b98aa8", "#a97b98"], near: ["#6b4a62", "#5c3f54"], win: "rgba(255,240,200,.5)",
    landmarks: ["mountain", "pagoda", "tower", "skyscraper"],
    wall: "#ece6df", wallTop: "#c94a4a", panels: ["#d93a4a", "#ffffff", "#2b2b2b"],
    outside: "#6f9a5a", house: ["#f1e9de", "#e4d8c6", "#c9b8a0"], roof: "#3b3b46",
    props: ["sakura", "sakura", "torii", "lantern", "house", "bench", "bamboo"],
    overhead: "lanterns", lantern: "#f4efe2", particles: "petals"
  },
  {
    name: "Brasil", flag: { type: "brazil" },
    sky: ["#1e8fd0", "#7fd3e6", "#fff2b0"], sun: "#fffbe0",
    far: ["#3d8c5a", "#2f7a4c"], near: ["#2f5f45", "#27523b"], win: "rgba(255,240,160,.5)",
    landmarks: ["sugarloaf", "favela", "skyscraper", "favela"],
    wall: "#f2c94c", wallTop: "#2f9e57", panels: ["#009c3b", "#ffdf00", "#1f3fa0"],
    outside: "#3fa34d", house: ["#ff9f6b", "#7bd3c5", "#f2e36b", "#e77fb0"], roof: "#c0563a",
    props: ["palm", "palm", "house", "bush", "flowers", "umbrella", "flagpole"],
    overhead: "bunting", bunting: ["#009c3b", "#ffdf00", "#1f3fa0", "#ffffff"], particles: "confetti"
  },
  {
    name: "Egito", flag: { type: "h3", colors: ["#ce1126", "#ffffff", "#1a1a1a"] },
    sky: ["#d9733a", "#f6c26b", "#fff0c4"], sun: "#fff6d8",
    far: ["#d9a75a", "#c99750"], near: ["#a87a3f", "#966c37"], win: "rgba(255,240,190,.45)",
    landmarks: ["pyramid", "pyramid", "obelisk", "pyramid"],
    wall: "#e3c08a", wallTop: "#b88a4a", panels: ["#c8102e", "#f6e7c8", "#2b2b2b"],
    outside: "#e6c98a", house: ["#e8cf9e", "#d9bd86", "#c9a466"], roof: "#c9a466",
    props: ["palm", "rock", "obeliskSmall", "cactus", "house", "umbrella", "flagpole"],
    overhead: "bunting", bunting: ["#ce1126", "#ffffff", "#1a1a1a", "#d4a017"], particles: "sand"
  },
  {
    name: "Holanda", flag: { type: "h3", colors: ["#ae1c28", "#ffffff", "#21468b"] },
    sky: ["#6aa0e0", "#bcd8f0", "#f4f1e6"], sun: "#ffffff",
    far: ["#8fa3b8", "#8095aa"], near: ["#7a4a3a", "#6b4032"], win: "rgba(255,240,200,.5)",
    landmarks: ["windmill", "canalHouses", "windmill", "canalHouses"],
    wall: "#a9553a", wallTop: "#e6d9c3", panels: ["#ae1c28", "#ffffff", "#21468b"],
    outside: "#58a04a", house: ["#9c4a32", "#3f5f7a", "#5a3a2a"], roof: "#2f2f36",
    props: ["tulips", "tulips", "windmillSmall", "house", "tree", "bench", "flagpole"],
    overhead: "bunting", bunting: ["#ff7f00", "#ae1c28", "#ffffff", "#21468b"], particles: null
  }
];
