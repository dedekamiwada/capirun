# Próximos passos

Ideias combinadas para fazer depois, com o caminho no código.

## Multiplicador de pontuação (o "x23" do Subway Surfers)

Hoje a pontuação (⭐ no topo da tela) é só a distância da run em metros. A ideia é ela virar
**distância × multiplicador**, com o multiplicador aparecendo ao lado da pontuação.

**Como fazer:**

1. **Estado** (`reset()` no `game.js`): criar `score: 0` e `mult: 1`.
2. **Pontos por quadro** (`update()`, logo depois de `S.dist += dz`):
   ```js
   S.score += dz * S.mult * (S.double > 0 ? 2 : 1); // o 2X passa a dobrar a pontuação também
   ```
   Somar quadro a quadro, e não fazer `dist × mult` no fim: assim, quando o multiplicador sobe, ele só vale
   daquele ponto em diante.
3. **O que faz o multiplicador subir** (escolher uma ou mais opções):
   - **Distância**: `S.mult = 1 + Math.floor(S.dist / 1000)` (+1 a cada 1.000 m).
   - **Presentes e likes da live**: um efeito novo `"mult"` em `config.js` (`EFFECTS`), tratado em
     `applyEffect()` com `S.mult++`. O painel já mostra os efeitos na lista das regras de presentes.
   - **Missões**: uma lista de missões (ex.: "pule 20 barreiras", "pegue 300 moedas") contadas durante a run.
     Cada missão completa dá +1 permanente (salvo em `SAVE`, como as cabeças de capivara), e a run começa com esse valor.
4. **HUD** (`drawHUD()`, parte 1): desenhar `x${S.mult}` em amarelo à esquerda da ⭐ e mostrar `S.score`
   no lugar de `S.dist`.
5. **Recorde e tela de fim** (`saveBest()`, `gameOver()` e `drawOver()`): usar `S.score` em vez de `S.dist`.
6. **Bater**: no modo Meta, decidir se a batida tira pontos ou só metros (hoje tira metros).
