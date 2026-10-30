// Escolha da regra de presente: usada pelo jogo (game.js) e pelo painel (admin.html), para os dois decidirem igual.
//
// 1) Regra do presente doado: pelo ID oficial da TikTok ou pelo nome. O nome aceita apelidos (campo
//    "aliases"), porque a TikTok pode mandar o nome em inglês ("Rose") ou em português ("Rosa").
// 2) Regras de "qualquer presente" (sem presente escolhido), pelo valor mínimo em moedas.
// 3) Nenhuma regra serviu e "giftFallback" está ligado: vale a regra do presente da lista com o valor
//    (em moedas) mais próximo do presente doado, sempre AJUDANDO (o "−" vira "+"). O "zera" fica de fora.
window.GiftRules = (() => {
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`´]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const names = r => [r.gift, r.label, ...(r.aliases || [])].filter(Boolean).map(norm);
  const specific = r => !!(r.giftId || r.gift || (r.aliases || []).length);
  const sameGift = (r, name, id) => (r.giftId && id && String(r.giftId) === id) || (!!name && names(r).includes(name));
  const HURT_ONLY = ["zera", "train", "speed", "reverse", "dark"]; // efeitos que só atrapalham: não entram na "ajuda"

  function pick(rules, ev, coins, fallback) {
    rules = rules || [];
    const name = norm(ev.gift), id = ev.giftId ? String(ev.giftId) : "";
    const count = r => Number(ev.count) || Math.max(1, Math.round(coins / Math.max(1, Number(r.giftCoins) || coins)));
    const enough = r => specific(r) ? count(r) >= (Number(r.minCount) || 1) : coins >= (Number(r.minCoins) || 0);
    const weight = r => specific(r) ? (Number(r.minCount) || 1) * (Number(r.giftCoins) || 1) : Number(r.minCoins) || 0;
    const sorted = rules.slice().sort((a, b) => (specific(b) - specific(a)) || weight(b) - weight(a));
    const mine = sorted.filter(r => specific(r) && sameGift(r, name, id)); // regras deste presente (ex.: 1× e 10×)
    const own = mine.find(enough);
    if (own) return own;
    const any = sorted.find(r => !specific(r) && enough(r));
    if (any) return any;
    if (!fallback || mine.length) return null; // presente da lista sem a quantidade mínima: não vira "outro presente"
    // presente fora da lista: o de valor mais próximo (por unidade), sempre ajudando
    const per = coins / Math.max(1, Number(ev.count) || 1);
    const pool = rules.filter(r => specific(r) && Number(r.giftCoins) > 0 && r.effect !== "zera");
    if (!pool.length) return null;
    const near = pool.reduce((a, b) => Math.abs(b.giftCoins - per) < Math.abs(a.giftCoins - per) ? b : a);
    return {
      meters: -Math.abs(Number(near.meters) || 0), effect: HURT_ONLY.includes(near.effect) ? "" : near.effect || "",
      perGift: near.perGift, sound: "", nearestOf: near.label || near.gift
    };
  }
  // completa as regras com os dados oficiais do catálogo (imagem, ID e valor), achando o presente pelo nome
  function resolve(rules, catalog) {
    let changed = false;
    const byName = new Map();
    for (const g of catalog || []) if (g && g.name) byName.set(norm(g.name), g);
    for (const r of rules || []) {
      if (!specific(r)) continue;
      const g = (r.giftId && (catalog || []).find(x => String(x.id) === String(r.giftId))) || names(r).map(n => byName.get(n)).find(Boolean);
      if (!g) continue;
      if (!r.giftId && g.id) { r.giftId = String(g.id); changed = true; }
      if (!r.giftImg && g.img) { r.giftImg = g.img; changed = true; }
      if (g.coins && Number(r.giftCoins) !== Number(g.coins)) { r.giftCoins = Number(g.coins); changed = true; }
    }
    return changed;
  }
  return { pick, resolve, norm, specific };
})();
