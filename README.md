# 🦫 Capivara Runner

Jogo de corrida infinita (3 pistas, trens, barreiras, moedas e power-ups) feito para **lives interativas na TikTok**.
O público controla o destino da partida com presentes e likes: uns **atrapalham** (fazem voltar metros), outros **ajudam**
(fazem avançar) e um presente especial pode dar a **vitória instantânea**. A meta padrão é chegar a **100.000 m**.

Tudo foi feito do zero: personagens, cenários, sons e música são originais e gerados por código.

> ⚠️ Projeto independente, **sem ligação com a TikTok**. A conexão com a live usa a biblioteca não oficial
> [`tiktok-live-connector`](https://www.npmjs.com/package/tiktok-live-connector), que pode deixar de funcionar
> quando a TikTok mudar algo. Faça uma live curta de teste antes de usar para valer.

---

## ✨ Recursos

- **Integração com a TikTok LIVE**: presentes, likes e follows chegam ao jogo em tempo real.
- **Catálogo oficial de presentes**: ao conectar, o app baixa da própria TikTok o nome, o valor, a imagem e o ID de cada presente. As regras usam o **ID oficial**, então não existe risco de nome errado.
- **Regras de presentes**: para cada presente (e quantidade), defina se ele ajuda ou atrapalha, quantos metros move, um efeito extra e o som que toca.
- **Regras de likes**: "a cada N likes → acontece algo". Podem existir várias, cada uma contando separado.
- **Alerta com o nome de quem doou**, com a imagem do presente, o efeito e um **COMBO** quando vários presentes chegam seguidos.
- **Placar 😇 Ajuda × Atrapalha 😈**: cabo de guerra com os metros que cada lado moveu.
- **🏆 Top da partida** e **contador de vitórias da sessão**.
- **Vitória instantânea**: tela de festa com "VITÓRIA! graças a *nome*", confete, troféu e aplausos.
- **Efeitos que crescem com o valor**: flash, tremida de tela e confete maiores para presentes maiores.
- **Metas a cada 10%** com comemoração, e uma **RETA FINAL** de tensão nos últimos 10%.
- **Faixa "o que cada presente faz"** com a imagem do presente, posicionada fora da área coberta pela interface da TikTok.
- **Menu do jogo**: Jogar/Continuar, Personagem, Mapa, Som (volume geral, música e efeitos) e Controles.
- **7 países**: China, Itália, França, Japão, Brasil, Egito e Holanda, com monumentos, decorações, enfeites e clima próprios.
- **9 personagens** com rosto, expressões e animação: Capivara, Capivara Skatista, Capivara Astronauta, Panda DJ, Raposa Ninja, Gato Mago, Sapo MC, Pinguim Surfista e Lhama Rockstar. Um **avatar** no canto reage à live.
- **Bot automático** que joga sozinho, apertando teclas como uma pessoa, e nunca perde metros. Ele só faz o que um jogador conseguiria fazer: prevê a física do pulo, da rolada e da troca de pista e nunca atravessa trem ou barreira (ao esbarrar de lado, quica de volta como qualquer jogador). Com o controle invertido por presente, ele compensa.
- **Bot sem moedas** (chave "🪙 Bot desvia das moedas" no painel): o bot foge das moedas o máximo possível, trocando de pista, escolhendo entre pular ou rolar a barra azul e pulando por cima das filas de moedas e do ímã. Nos testes ele pegou cerca de metade das moedas do bot normal; o resto fica no único caminho possível (corredores de vagões, teto do trem, moedas coladas na barreira). O prêmio da palavra do dia (+500 🪙) continua valendo.
- **Painel de controle** numa janela separada, que não aparece na live, onde **tudo é configurável**.
- **Atalhos de teclado**: cada tecla faz o que você quiser (avançar, voltar, vitória, simular presente ou likes).

---

## 🚀 Uso rápido (Windows)

1. Baixe o **`CapivaraRunner.exe`** (aba *Releases* do GitHub, ou gere o seu: veja [Desenvolvimento](#-desenvolvimento)).
2. Dê dois cliques. Na primeira vez ele leva uns **15 segundos** para abrir.
   Se o Windows mostrar *"O Windows protegeu o computador"*, clique em **Mais informações → Executar assim mesmo**. O app não tem assinatura digital paga, por isso o aviso aparece.
3. Abrem duas janelas:
   - **Capivara Runner**: o jogo, em formato vertical 9:16. É **esta** que você captura na live.
   - **Capivara Runner — Painel**: o seu controle. **Não capture** esta janela.

Feche a janela do jogo para encerrar o app.

### Primeira live, passo a passo

1. Abra o app e inicie a sua live (TikTok LIVE Studio, OBS etc.).
2. No TikTok LIVE Studio ou no OBS, adicione uma **captura de janela** apontando para a janela **Capivara Runner**.
3. No painel, no cartão **TikTok LIVE**, digite o seu @ (sem o @) e clique em **Conectar**.
   Quando aparecer *"Conectado à live de @você"*, presentes, likes e follows já mexem no jogo.
4. Na primeira conexão, o **catálogo oficial de presentes** é carregado. Agora configure as regras (veja abaixo).
5. No jogo, escolha **JOGAR** no menu (ou ligue o **bot** no painel).

---

## 🎮 Menu do jogo

Ao abrir o jogo aparece o menu principal (setas + **Enter**, ou mouse/toque):

| Opção | O que faz |
|---|---|
| **▶ Jogar** | Começa uma partida. |
| **🏁 / ♾️ Modo** | Troca entre o modo **Meta** e o modo **Infinito** (também no painel). |
| **🦫 Personagem** | Troca o personagem (◀ ▶). |
| **🗺️ Mapa** | Escolhe o país do cenário, ou *Automático*, que troca a cada 2.000 m. |
| **🔊 Som** | Volume geral, da música e dos efeitos, e liga/desliga o som. |
| **🎮 Controles** | Mostra as teclas. |

**Durante a partida**, **Esc**, **P** ou o botão azul do canto pausam. A pausa tem **▶ Continuar** e **🏠 Menu principal**.
Abrindo o menu no meio da partida, aparecem **▶ Continuar**, que volta sem perder a distância, e **🔄 Nova partida**.
O painel também tem o botão **🏠 Abrir menu do jogo**.

As escolhas feitas no menu (personagem, mapa e volumes) ficam salvas e aparecem no painel, e vice-versa.

---

## 🎛️ Painel

| Cartão | O que faz |
|---|---|
| **Barra do topo** | Mostra o progresso da partida ao vivo e se o jogo está conectado, pausado ou com o bot ligado. |
| **TikTok LIVE** | Conecta ou desconecta da sua live e mostra o estado da conexão e do catálogo de presentes. |
| **Partida** | Pausar, bot, vitórias da sessão (+ − zerar), abrir o menu do jogo e reiniciar a partida. |
| **País do cenário** | Escolhe o país. |
| **Personagem** | Escolhe quem corre (prévia animada). |
| **Regras de presentes** | O que cada presente faz (veja abaixo). |
| **Teclas** | Teclas de andar, pular, abaixar, pausar, bot e som. |
| **Atalhos de teclado** | Teclas que aplicam uma ação na hora (veja abaixo). |
| **Likes** | Regras "a cada N likes". |
| **Tela da live** | Liga e desliga cada elemento da tela, ajusta os volumes e a margem do topo. |
| **Testar** | Simula presentes e likes sem precisar de live. |
| **Presentes recebidos** | Presentes que chegaram na live. Clique em um para criar uma regra. |
| **Configurações** | Meta, metros perdidos ao bater e tempo até a nova partida depois da vitória. |

### Regras de presentes

Cada regra tem:

- **Presente**: escolha no catálogo oficial (com imagem e valor), ou *Qualquer presente*.
- **Quantidade mínima** (com presente escolhido): quantas unidades daquele presente, por exemplo *5× Rosa* num combo. O painel mostra o total em moedas.
- **A partir de** (com *Qualquer presente*): valor mínimo em moedas (🪙).
- **Ação**: 😈 **Atrapalhar** (volta metros) ou 😇 **Ajudar** (avança metros).
- **Metros**: quanto volta ou avança.
- **Efeito**: trem na pista, acelerar, inverter controles, escurecer a tela, prancha, escudo, ímã, moedas em dobro, desacelerar, **0️⃣ zerar a distância** ou **🏆 VITÓRIA INSTANTÂNEA**.
- **Som na live**: automático, um dos 15 sons do jogo ou **um arquivo seu** (MP3, WAV ou OGG de até 1 MB). O botão ▶ toca uma prévia.

**Qual regra vale?** A mais específica: primeiro as regras de um presente escolhido (a de maior quantidade que foi atingida), depois a de "qualquer presente" com o maior valor mínimo.
Exemplo: *1× Rosa → +100 m*, *5× Rosa → +5.000 m* e *qualquer presente a partir de 500 🪙 → −300 m*.

**Presentes padrão** (em `config.js`; os metros valem **por unidade**, então um combo de 5 Rosas volta 5 × 50 m):

| Presente | O que faz |
|---|---|
| 🌹 Rosa | volta 50 m |
| TikTok | avança 50 m |
| 🦖 Mini Dino | avança 500 m |
| Perfume | volta 500 m |
| 🎉 Confete | avança 2.500 m |
| 🫶 Mãos em coração | volta 2.500 m |
| 🧸 Você é demais | **zera** a distância |
| 💸 Money Gun | **vitória** instantânea |

As regras acham o presente pelo nome, em português ou em inglês ("Rosa"/"Rose", "Confete"/"Confetti"…). Quando a live conecta, o catálogo oficial completa a imagem, o ID e o valor de cada um.

**Presente fora da lista** (chave "Presente fora da lista ajuda" no painel, ligada por padrão): vale a regra do presente da lista com o **valor em moedas mais próximo**, sempre **ajudando**. Exemplos: um presente de 1 moeda avança 50 m; um de 30 moedas avança 500 m (o mais perto é o de 20); um de 299 avança 2.500 m; um de mais de 300 moedas fica mais perto do Money Gun (500) e dá a vitória. O "zera" nunca entra nessa conta.

No modo **Infinito** os presentes não fazem nada (veja *Como o jogo funciona*).

### Atalhos de teclado

Cada atalho é **Tecla → Ação**, e as ações podem ser:

| Ação | O que faz |
|---|---|
| 😇 **Avançar** | Avança X metros (com efeito e som opcionais). |
| 😈 **Voltar** | Volta X metros (com efeito e som opcionais). |
| 🏆 **Vitória** | Vitória instantânea. |
| 🎁 **Simular presente** | Simula um presente do catálogo (com quantidade) e passa pelas regras de presentes. |
| ❤️ **Simular likes** | Soma likes e passa pelas regras de likes. |

Exemplo: tecla **1** = avançar 50 m, tecla **2** = avançar 500.000 m. Aperte a tecla com a janela do jogo em foco.

> Ações feitas por atalho ou pelo cartão *Testar* aparecem na tela **sem nome de pessoa** (como "😇 AJUDA!"),
> para ninguém confundir com uma doação real.

### Likes

Cada regra é **"a cada N likes → atrapalhar ou ajudar X metros"**, com efeito e som opcionais.
Podem existir várias regras ao mesmo tempo, por exemplo *a cada 100 likes +20 m* e *a cada 1.000 likes vem um trem*.
Na tela, o medidor mostra quanto falta para a próxima: *❤️ 230/500 likes = −10 m*.

### Tela da live

- Liga e desliga: vitórias da sessão, moedas, medidor de likes, placar Ajuda × Atrapalha, faixa "o que cada presente faz", últimas doações, Top da partida e avatar.
- **Volumes**: geral, música e efeitos.
- **Margem do topo**: empurra as informações para baixo, para não ficarem embaixo do nome e dos espectadores da TikTok. As informações ficam da margem até a altura do personagem, longe da área de comentários.

### Teclas padrão

| Ação | Teclas |
|---|---|
| Esquerda / Direita | ← → ou A D |
| Pular | ↑, W ou Espaço |
| Abaixar / rolar | ↓ ou S |
| Pausar | P ou Esc |
| Ligar/desligar bot | B |
| Som liga/desliga | M |
| Atalhos | 1 = +50 m · 2 = −50 m · 3 = +1.000 m · 4 = −1.000 m · 0 = +100 likes |

Tudo pode ser trocado no painel.

---

## 🕹️ Como o jogo funciona

- **3 pistas**: troque de pista para desviar dos trens. Os trens com **rampa** dão para subir e correr por cima, onde ficam moedas.
- **Barreiras**:
  - 🟥 cerca listrada vermelha e branca: **só pulando** (rolar não adianta). Dá para **pisar em cima** dela;
  - 🟦 barra azul suspensa: **pulando ou rolando por baixo**. Dá para **pisar em cima** dela (e pular de novo lá de cima), como no Subway Surfers;
  - 🟨 painel alto amarelo e preto: **só rolando por baixo**.
  - Só perde metros quem bate **de frente**, baixo demais. Encostar no topo não conta como batida.
- **Bater de frente** num trem ou numa barreira faz perder metros (configurável) e o personagem atravessa piscando. A prancha e o escudo protegem.
- **Esbarrar de lado** (trocar de pista com um trem do lado) faz o personagem quicar de volta e ficar **meio tonto** por 4 s: estrelinhas girando na cabeça e correndo um pouco mais devagar, mas sem parar. **Esbarrar de novo ainda tonto derruba**, igual a bater de frente: no modo Meta perde metros, no Infinito acaba a run. Bater de frente derruba direto.
- Só dá para subir num trem **pela rampa** ou caindo de cima.
- **Power-ups na pista**: 🛹 prancha, 🧲 ímã e 2X moedas. Os ativos aparecem na lateral direita, com uma barra mostrando o tempo que falta.
- **Dois modos de jogo** (menu ou painel):
  - 🏁 **Meta**: chegar até a meta (100.000 m, configurável). Bater tira metros.
  - ♾️ **Infinito**: sem linha de chegada. **Bater acaba a run** e aparece a tela de fim com a pontuação, as moedas, o recorde, **Continuar** e **🔄 Jogar de novo**. Depois de alguns segundos começa outra run sozinha (o mesmo tempo da "nova partida após a vitória"). É um modo só do jogador: **presentes e likes não fazem nada**, e a tela mostra só o jogo (pontuação, moedas, cabeças de capivara, recorde, palavra do dia e power-ups), sem meta, Ajuda × Atrapalha, faixa de presentes, top da partida e avatar.
- **🦫 Cabeças de capivara**: itens raros na pista, douradas e balançando (e prêmio da palavra do dia). Continuar depois de bater custa 1 cabeça, depois 2, depois 4… na mesma run. Elas ficam salvas.
- **🔤 Caça às letras**: todo dia tem uma palavra nova. As letras aparecem na pista, em ordem, e vão preenchendo os quadradinhos no topo da tela. Completou a palavra: **+2 cabeças de capivara e +500 🪙**. O progresso fica salvo até o dia virar.
- **HUD**: no topo, a pausa, a palavra do dia e a pontuação (⭐ = metros da run); abaixo, as moedas e as cabeças de capivara; no modo Meta, quanto falta e a barra até a meta. O centro fica livre, só com avisos rápidos (novo recorde, letra, cabeça de capivara). Os itens da live (Ajuda × Atrapalha, presentes, top da partida, avatar) continuam e podem ser desligados no painel.
- **Trens vindo na sua direção** buzinam antes de chegar.
- **Pulo no ar**: um pulo por vez que o pé encosta em algo (chão, teto do trem ou topo de barreira). Caiu de um vagão sem ter pulado? Ainda dá para pular uma vez.
- **Mapa em blocos**: a pista é montada com blocos pré-desenhados (`chunks.js`), sorteados e encaixados um depois do outro, às vezes espelhados. Todo bloco tem um caminho possível. Tem corredores de vagões, "segundo andar" pela rampa, escada de vagões, trens vindo na sua direção e combos do tipo troca de pista → pula → rola.
- **Dificuldade**: cresce com a velocidade. No começo só saem blocos fáceis; depois entram os médios e, com o jogo rápido, os difíceis. Bater deixa o jogo mais lento e os blocos voltam a ficar mais fáceis.
- **Vitória**: ao chegar na meta, ou por um presente de vitória instantânea. Depois de alguns segundos começa outra partida sozinha (configurável).

---

## 💡 Por que esses recursos? (dicas para engajar a live)

Os recursos de engajamento seguem o que pesquisas sobre presentes em lives apontam:

- **Reconhecimento motiva doações.** Um estudo com espectadores de TikTok LIVE encontrou que o reconhecimento do streamer aumenta a vontade de mandar presentes ([Archer, Broadbridge e Dyussembayeva, Universidade de Portsmouth](https://researchportal.port.ac.uk/en/publications/diamonds-are-a-tiktokers-best-friend-unwrapping-the-motivations-b/)). Por isso o jogo mostra **o nome de quem doou** num alerta grande e no ranking. **Agradeça em voz alta também.**
- **Visibilidade e competição.** Rankings, presentes em níveis e alertas animados aparecem na literatura como incentivos, por dar visibilidade e prestígio a quem doa ([revisão na Frontiers in Communication, 2025](https://www.frontiersin.org/articles/10.3389/fcomm.2025.1648927/full); [estudo sobre lives na China](https://arxiv.org/pdf/1803.06032)). Daí o **Top da partida**, o **placar Ajuda × Atrapalha** e os **efeitos maiores para presentes maiores**.
- **Emoção e diversão.** Conexão emocional e diversão também aparecem entre os motivos para doar ([TikTok e Ipsos, 2025](https://www.ipsos.com/en-us/creator-economy-redefined-how-interactive-livestream-gifting-transforming-entertainment), pesquisa encomendada pela própria plataforma). Daí o avatar que reage, o confete, as metas e a reta final.

Dicas práticas:
- Deixe claro **o que cada presente faz**. A faixa da tela faz isso sozinha, mas fale também.
- Crie **rivalidade saudável** entre quem ajuda e quem atrapalha, usando o placar.
- Na **reta final**, chame a galera: *"falta pouco, quem vai fazer a gente ganhar?"*.
- Coloque a **vitória instantânea** num presente mais caro, para ser um momento raro e marcante.

---

## 🛠️ Desenvolvimento

Requisitos: **Node.js 20 ou mais novo** e Windows para gerar o `.exe`.

```bash
npm install
```

| Comando | O que faz |
|---|---|
| `npm run app` | Abre o app (jogo + painel) com Electron, sem gerar `.exe`. |
| `npm start` | Só o servidor: jogo em `http://localhost:8080` e painel em `http://localhost:8080/admin.html`. Aceita o usuário da TikTok: `node server.js seu_usuario`. |
| `npm run build:exe` | Gera o `.exe` portátil em `release/CapivaraRunner.exe`. |

O `Iniciar.bat` faz o `npm install` (na primeira vez) e roda o `npm start`, para quem prefere usar no navegador.
Também dá para abrir o `index.html` direto no navegador para testar o jogo sem servidor (sem conexão com a TikTok).

### Estrutura

| Arquivo | Conteúdo |
|---|---|
| `index.html`, `game.js` | O jogo (canvas): física, obstáculos, bot, menu, regras, alertas, efeitos e HUD. |
| `chunks.js` | Os blocos pré-desenhados do mapa (vagões, barreiras, moedas e power-ups). |
| `PROXIMOS-PASSOS.md` | Ideias anotadas para fazer depois (ex.: multiplicador de pontuação). |
| `admin.html` | O painel de controle. |
| `config.js` | Valores padrão: meta, velocidade, regras iniciais, atalhos, likes, teclas, tela e efeitos disponíveis. |
| `themes.js` | Os países (cores, monumentos, decorações, enfeites e clima). |
| `scenery.js` | Desenhos dos monumentos, decorações e bandeiras. |
| `characters.js` | Os personagens (de costas no jogo; de frente no menu, no painel e no avatar). |
| `sound.js` | Efeitos sonoros e música, sintetizados com Web Audio. |
| `app-server.js` | Servidor local: arquivos, configurações, conexão com a TikTok LIVE e WebSocket. |
| `main.js` | App Electron (janelas do jogo e do painel). |
| `server.js`, `Iniciar.bat` | Modo sem app (navegador). |

### Personalizar

- **Novo país**: copie um bloco em `themes.js` e troque cores, `landmarks` e `props`.
- **Novo personagem**: copie um bloco de `SKINS` em `characters.js` e combine cabeça, chapéu, roupa e acessórios.
- **Palavras do dia**: a lista `WORDS` fica no começo do `game.js` (só letras sem acento).
- **Novo bloco do mapa**: em `chunks.js`, copie um bloco e desenhe as linhas (a legenda está no topo do arquivo). A primeira linha é a mais longe. Garanta que sempre exista um caminho.
- **Valores padrão**: `config.js` (o painel sobrepõe estes valores).

Onde ficam os dados salvos: no app, em `%APPDATA%\Capivara Runner` (`settings.json`, `gifts.json`, `live.json` e `erro.log`, se houver erro). No modo `npm start`, na própria pasta do projeto. Esses arquivos estão no `.gitignore`.

---

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| O `.exe` não abre | Espere uns 15 s na primeira vez. Se ainda assim não abrir, veja `%APPDATA%\Capivara Runner\erro.log`. Cópias antigas travadas são fechadas sozinhas ao abrir de novo. |
| *"não está ao vivo agora"* | Inicie a live **antes** de clicar em Conectar. |
| O catálogo de presentes está vazio | Ele é baixado na primeira conexão com a live. Conecte uma vez. |
| Um presente não faz nada | Confira se existe uma regra que combine com ele (presente e quantidade, ou *Qualquer presente* com valor mínimo menor que o do presente). |
| Informações cobertas pela interface da TikTok | Aumente a **Margem do topo** no cartão *Tela da live*. |
| A conexão parou de funcionar | A TikTok pode ter mudado algo. Atualize a biblioteca (`npm install tiktok-live-connector@latest`) e gere o `.exe` de novo. |

---

## 📄 Licença

Defina a licença do seu repositório (por exemplo, MIT) antes de publicar.
