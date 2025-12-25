(() => {
  const canvas = document.getElementById("game");
  const stage = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const hudPlayer = document.getElementById("hudPlayer");
  const hudRoundTime = document.getElementById("hudRoundTime");
  const hudScore = document.getElementById("hudScore");
  const hudSkillName = document.getElementById("hudSkillName");
  const hudSkillCD = document.getElementById("hudSkillCD");

  const overlay = document.getElementById("overlay");
  const overlayCard = document.getElementById("overlayCard");

  const panelPick = document.getElementById("panelPick");
  const panelReady = document.getElementById("panelReady");
  const panelResult = document.getElementById("panelResult");

  const pickTitle = document.getElementById("pickTitle");
  const pickBody = document.getElementById("pickBody");
  const countRow = document.getElementById("countRow");
  const catGrid = document.getElementById("catGrid");
  const pickHint = document.getElementById("pickHint");

  const btnStart = document.getElementById("btnStart");
  const btnRestart = document.getElementById("btnRestart");
  const btnBackToPick = document.getElementById("btnBackToPick");

  const stateTitle = document.getElementById("stateTitle");
  const stateBody = document.getElementById("stateBody");
  const roundSecondsInput = document.getElementById("roundSeconds");
  const scoreboard = document.getElementById("scoreboard");

  const resultTitle = document.getElementById("resultTitle");
  const resultBody = document.getElementById("resultBody");
  const podiumEl = document.getElementById("podium");

  const playerName = (n) => ["", "玩家一", "玩家二", "玩家三", "玩家四"][n] || `玩家${n}`;

  // ========= Responsive canvas =========
  let W = 900, H = 460, DPR = 1;
  function resizeCanvas() {
    const r = stage.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(r.width * DPR));
    canvas.height = Math.max(1, Math.floor(r.height * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    W = r.width;
    H = r.height;
    recomputeLanes();
    drawFrame(0);
  }
  window.addEventListener("resize", resizeCanvas);

  // ===== Lanes =====
  const LANES = 3;
  let laneY = [];
  let laneHalfHeight = 60;
  function recomputeLanes() {
    laneY = [H * 0.28, H * 0.50, H * 0.72];
    laneHalfHeight = Math.max(52, Math.min(78, H * 0.12));
  }

  // ===== Config =====
  const playerXRatio = 0.20;
  const CAT_SIZE = 44;

  const baseSpeed = 310;
  const speedRamp = 0.020;
  const scorePerSecond = 12;

  // ✅ Risk lane (middle)
  const RISK_LANE = 1;
  const RISK_ITEM_MULT = 1.5;
  const RISK_OBSTACLE_WEIGHT = 1.6;
  const RISK_OBSTACLE_SIZE_MULT = 1.15;

  const obstacleBaseInterval = 0.92;
  const obstacleMinInterval = 0.33;
  const itemBaseInterval = 1.05;
  const itemMinInterval = 0.52;

  const bombChance = 0.18;
  const laneSwitchCooldown = 0.08;

  const FOOD = [
    { icon: "🐟", value: 50 },
    { icon: "🍗", value: 100 },
    { icon: "🍔", value: 150 },
  ];
  const BOMB = { icon: "💣", value: -100 };

  // ✅ Lives: 2 potions
  const MAX_LIVES = 2;

  // ===== SFX =====
  let audioCtx = null;
  function beep(freq = 440, dur = 0.06, type = "triangle", gain = 0.05) {
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + dur);
    } catch {}
  }
  const sfxSwitch = () => beep(420, 0.04, "triangle", 0.04);
  const sfxFood   = () => beep(820, 0.05, "sine", 0.05);
  const sfxBomb   = () => beep(150, 0.09, "square", 0.06);
  const sfxCrash  = () => beep(180, 0.10, "square", 0.06);
  const sfxSkill  = () => beep(620, 0.07, "sine", 0.06);

  // ===== CATS + Skills =====
  const CATS = [
    {
      id: "orange",
      name: "橘貓",
      desc: "可愛橘橘，活力滿滿",
      skillName: "衝刺無敵",
      skillDesc: "2 秒無敵（可硬吃樹），但期間分數獲得 x0.6",
      cd: 7.5,
      body: "#f59e0b", belly: "#fde68a", stripe: "#d97706",
      onUse: () => activateInvincible(2.0, 0.6),
    },
    {
      id: "tux",
      name: "黑白貓",
      desc: "黑白配，酷酷的",
      skillName: "時間變慢",
      skillDesc: "1.2 秒世界變慢（更好躲樹），分數照常",
      cd: 8.5,
      body: "#0f172a", belly: "#f8fafc", stripe: "#334155",
      onUse: () => activateSlowmo(1.2, 0.55),
    },
    {
      id: "gray",
      name: "灰貓",
      desc: "耐看灰色系",
      skillName: "瞬間換道",
      skillDesc: "0.7 秒內 ↑↓/W/S 立刻換道（不吃冷卻延遲）",
      cd: 6.5,
      body: "#64748b", belly: "#e2e8f0", stripe: "#475569",
      onUse: () => activateDashLane(0.7),
    },
    {
      id: "calico",
      name: "三花貓",
      desc: "斑斕三色超吸睛",
      skillName: "幸運加倍",
      skillDesc: "3 秒內食物分數 x2（炸彈照扣）",
      cd: 10.0,
      body: "#f8fafc", belly: "#fde68a", stripe: "#f97316",
      onUse: () => activateFoodBoost(3.0, 2.0),
    },
  ];

  function catThumbSVG(cat) {
    const isCalico = cat.id === "calico";
    const isTux = cat.id === "tux";
    return `
    <svg width="70" height="50" viewBox="0 0 70 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 25 C2 16, 4 34, 13 34" fill="none" stroke="${cat.stripe}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="33" cy="30" rx="20" ry="12" fill="${cat.body}"/>
      <ellipse cx="37" cy="33" rx="11" ry="8" fill="${cat.belly}" opacity="0.95"/>
      ${
        isCalico
          ? `
            <circle cx="25" cy="28" r="4.8" fill="#f97316"/>
            <circle cx="38" cy="24" r="3.8" fill="#0f172a"/>
            <circle cx="45" cy="34" r="3.8" fill="#fde68a"/>
          `
          : isTux
            ? `
              <rect x="22" y="22" width="7" height="20" fill="#ffffff" opacity="0.95"/>
              <rect x="33" y="21" width="7" height="21" fill="${cat.stripe}" opacity="0.92"/>
              <rect x="44" y="22" width="7" height="20" fill="#ffffff" opacity="0.95"/>
            `
            : `
              <rect x="23" y="24" width="4" height="14" fill="${cat.stripe}" opacity="0.9"/>
              <rect x="32" y="22" width="4" height="16" fill="${cat.stripe}" opacity="0.85"/>
              <rect x="41" y="24" width="4" height="14" fill="${cat.stripe}" opacity="0.9"/>
            `
      }
      <circle cx="53" cy="23" r="8" fill="${cat.body}"/>
      <path d="M48 17 L51 11.5 L53.5 17 Z" fill="${cat.stripe}" opacity="0.95"/>
      <path d="M58 17 L55 11.5 L52.5 17 Z" fill="${cat.stripe}" opacity="0.95"/>
      <circle cx="50.8" cy="23" r="1.6" fill="#111"/>
      <circle cx="55.2" cy="23" r="1.6" fill="#111"/>
    </svg>`;
  }

  // ===== Tournament state =====
  let playerCount = 2;
  let currentPlayer = 1;

  const picked = new Set();
  const playerCat = {};
  const resultScore = {};

  // ===== Runtime =====
  let running = false;
  let tPrev = 0;
  let elapsed = 0;
  let score = 0;

  let lane = 1;
  let laneVisual = 1;
  let cooldown = 0;

  const obstacles = [];
  const items = [];
  const pops = [];

  let obstacleTimer = 0;
  let itemTimer = 0;
  let roundSeconds = 20;

  // ✅ lives + hit protection
  let lives = MAX_LIVES;
  let hitInvuln = 0;
  let screenShake = 0;

  // ✅ skill state
  let skillCD = 0;
  let invincible = 0;
  let scoreGainMult = 1.0;
  let slowmo = 0;
  let slowFactor = 1.0;
  let foodBoost = 0;
  let foodMult = 1.0;
  let dashLaneWindow = 0;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const playerX = ()=> W * playerXRatio;
  const currentCat = ()=> playerCat[currentPlayer] || CATS[0];

  // ===== Panels =====
  function popCard() {
    overlayCard.classList.remove("pop");
    void overlayCard.offsetWidth;
    overlayCard.classList.add("pop");
  }

  // ✅ overlay 顯示時：讓背後遊戲 50% 透明（只在 overlay 顯示）
  function showPanel(panel) {
    stage.classList.add("dim");          // ✅ 新增
    overlay.classList.remove("hidden");
    panelPick.classList.add("hidden");
    panelReady.classList.add("hidden");
    panelResult.classList.add("hidden");
    panel.classList.remove("hidden");
    popCard();
  }

  // ✅ overlay 隱藏時：恢復 100% 不透明
  function hideOverlay() {
    stage.classList.remove("dim");       // ✅ 新增
    overlay.classList.add("hidden");
  }

  // ===== HUD =====
  function updateHUD() {
    hudPlayer.textContent = playerName(currentPlayer);
    hudScore.textContent = String(Math.floor(score));
    hudRoundTime.textContent = String(Math.max(0, Math.ceil(roundSeconds - elapsed)));

    const cat = currentCat();
    hudSkillName.textContent = cat.skillName;

    const pct = cat.cd > 0 ? clamp(skillCD / cat.cd, 0, 1) : 0;
    hudSkillCD.style.width = `${Math.floor(pct * 100)}%`;
    hudSkillCD.style.background = pct <= 0.001 ? "rgba(34,197,94,1)" : "rgba(239,68,68,1)";
  }

  // ===== Reset =====
  function resetRoundState() {
    running = false;
    tPrev = 0;
    elapsed = 0;
    score = 0;

    lane = 1;
    laneVisual = 1;
    cooldown = 0;

    obstacles.length = 0;
    items.length = 0;
    pops.length = 0;
    obstacleTimer = 0;
    itemTimer = 0;

    lives = MAX_LIVES;
    hitInvuln = 0;
    screenShake = 0;

    skillCD = 0;
    invincible = 0;
    scoreGainMult = 1.0;
    slowmo = 0;
    slowFactor = 1.0;
    foodBoost = 0;
    foodMult = 1.0;
    dashLaneWindow = 0;

    updateHUD();
    drawFrame(0);
  }

  function resetMatch() {
    currentPlayer = 1;
    picked.clear();
    Object.keys(playerCat).forEach(k => delete playerCat[k]);
    Object.keys(resultScore).forEach(k => delete resultScore[k]);

    pickTitle.textContent = "先選擇玩家人數（1～4）";
    pickBody.textContent = "選好人數後，會依序讓 玩家一～玩家四 選貓（不可重複）。";
    catGrid.classList.add("hidden");
    pickHint.classList.add("hidden");

    [...countRow.querySelectorAll(".countBtn")].forEach(b => b.classList.remove("active"));
    countRow.classList.remove("hidden");

    showPanel(panelPick);
    resetRoundState();
  }

  // ===== Player Count =====
  function setPlayerCount(n) {
    playerCount = n;
    [...countRow.querySelectorAll(".countBtn")].forEach(b => {
      b.classList.toggle("active", Number(b.dataset.n) === n);
    });

    countRow.classList.add("hidden");
    catGrid.classList.remove("hidden");
    pickHint.classList.remove("hidden");

    currentPlayer = 1;
    pickTitle.textContent = `${playerName(currentPlayer)} 選擇你的貓（不可重複）`;
    pickBody.textContent = `目前玩家：${playerCount} 位。每位貓都有技能（按 F）。`;
    renderCatPicker();
    updateHUD();
    popCard();
  }
  [...countRow.querySelectorAll(".countBtn")].forEach(btn => {
    btn.addEventListener("click", () => setPlayerCount(Number(btn.dataset.n)));
  });

  // ===== Cat Picker =====
  function renderCatPicker() {
    catGrid.innerHTML = "";
    CATS.forEach(cat => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "catBtn" + (picked.has(cat.id) ? " disabled" : "");

      const thumb = document.createElement("div");
      thumb.className = "catThumb";
      thumb.innerHTML = catThumbSVG(cat);

      const meta = document.createElement("div");
      meta.className = "catMeta";

      const name = document.createElement("div");
      name.className = "catName";
      name.textContent = cat.name;

      const desc = document.createElement("div");
      desc.className = "catDesc";
      desc.textContent = cat.desc;

      const skill = document.createElement("div");
      skill.className = "catSkill";
      skill.textContent = `技能（F｜冷卻 ${cat.cd}s）：${cat.skillDesc}`;

      meta.appendChild(name);
      meta.appendChild(desc);
      meta.appendChild(skill);

      btn.appendChild(thumb);
      btn.appendChild(meta);

      if (!picked.has(cat.id)) {
        btn.addEventListener("click", () => {
          picked.add(cat.id);
          playerCat[currentPlayer] = cat;

          if (currentPlayer < playerCount) {
            currentPlayer += 1;
            pickTitle.textContent = `${playerName(currentPlayer)} 選擇你的貓（不可重複）`;
            renderCatPicker();
            updateHUD();
            popCard();
          } else {
            currentPlayer = 1;
            toReady(`按「開始」進行 ${playerName(currentPlayer)} 回合`);
          }
        });
      } else {
        btn.disabled = true;
      }

      catGrid.appendChild(btn);
    });
  }

  function toReady(title) {
    stateTitle.textContent = title;

    const cat = currentCat();
    stateBody.innerHTML =
      `規則：躲避樹木🌳（中間跑道更危險）。吃到食物加分：🐟 +50 / 🍗 +100 / 🍔 +150；吃到炸彈 💣 扣 100。<br/>
       <b>中間跑道：樹更多、食物分數 x1.5</b>。<b>生命：🧪🧪</b>（撞樹扣 1 瓶，扣光才結束換下一人）。<br/>
       操作：空白鍵 / ↑↓ 或 W/S / 點畫面。<b>技能：F（${cat.skillName}）</b>`;

    showPanel(panelReady);
    resetRoundState();
  }

  // ===== Controls =====
  function setLane(newLane) {
    if (!running) return;
    if (cooldown > 0) return;
    lane = clamp(newLane, 0, LANES - 1);
    cooldown = 0.08;
    sfxSwitch();
  }
  function cycleLaneDown() { setLane((lane + 1) % LANES); }

  // ===== Pops =====
  function addPop(x, y, text, kind, ttl = 0.75) {
    pops.push({ x, y, text, ttl, vy: -75, scale: 1.7, kind, base: ttl });
  }
  function toastSkill(text, ok=true) {
    addPop(W/2, H*0.36, text, ok ? "skillToast" : "cooldownToast", 0.5);
  }

  function tryUseSkill() {
    if (!running) return;
    if (skillCD > 0) {
      toastSkill("技能冷卻中…", false);
      beep(220, 0.06, "square", 0.04);
      return;
    }
    const cat = currentCat();
    skillCD = cat.cd;
    sfxSkill();
    cat.onUse?.();
    toastSkill("已開啟技能！");
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();

    if (k === "f") {
      e.preventDefault();
      tryUseSkill();
      return;
    }

    if (e.code === "Space") {
      e.preventDefault();
      if (!running && !overlay.classList.contains("hidden")) startRound();
      else if (running) cycleLaneDown();
      return;
    }

    if (e.code === "ArrowUp" || e.code === "ArrowDown") e.preventDefault();
    if (!running) return;

    const dashMode = dashLaneWindow > 0;
    if (e.code === "ArrowUp" || k === "w") {
      if (dashMode) lane = clamp(lane - 1, 0, 2);
      else setLane(lane - 1);
    }
    if (e.code === "ArrowDown" || k === "s") {
      if (dashMode) lane = clamp(lane + 1, 0, 2);
      else setLane(lane + 1);
    }
  });

  canvas.addEventListener("pointerdown", () => {
    if (!running && !overlay.classList.contains("hidden")) startRound();
    else if (running) cycleLaneDown();
  });

  // ===== Skill effects =====
  function activateInvincible(sec, scoreMult) { invincible = Math.max(invincible, sec); scoreGainMult = scoreMult; }
  function activateSlowmo(sec, factor) { slowmo = Math.max(slowmo, sec); slowFactor = factor; }
  function activateFoodBoost(sec, mult) { foodBoost = Math.max(foodBoost, sec); foodMult = mult; }
  function activateDashLane(sec) { dashLaneWindow = Math.max(dashLaneWindow, sec); }

  // ===== Start/finish =====
  function startRound() {
    if (running) return;
    roundSeconds = parseInt(roundSecondsInput.value || "20", 10);
    if (!Number.isFinite(roundSeconds) || roundSeconds < 5) roundSeconds = 20;

    hideOverlay(); // ✅ 這裡會把 dim 拿掉，canvas 回到 100% 不透明
    running = true;
    beep(520, 0.03, "sine", 0.03);
    requestAnimationFrame(loop);
  }

  function finishRound(reason = "") {
    running = false;
    resultScore[currentPlayer] = Math.floor(score);

    if (currentPlayer < playerCount) {
      const prev = currentPlayer;
      currentPlayer += 1;

      scoreboard.textContent =
        `已完成：${playerName(prev)}=${resultScore[prev]} ｜下一位：${playerName(currentPlayer)}`
        + (reason ? `（${reason}）` : "");

      updateHUD();
      toReady(`${playerName(prev)} 回合結束 → 按「開始」進行 ${playerName(currentPlayer)} 回合`);
      return;
    }

    const ranking = [];
    for (let i = 1; i <= playerCount; i++) ranking.push({ p: i, s: resultScore[i] ?? 0 });
    ranking.sort((a,b) => b.s - a.s);

    const first = ranking[0];
    resultTitle.textContent = "比賽結束！";
    const lines = ranking.map(r => `${playerName(r.p)} 分數：<b>${r.s}</b>`).join("<br/>");
    resultBody.innerHTML = `${lines}<br/><br/><b style="font-size:18px">🎉 ${playerName(first.p)} 獲勝！</b>`;

    renderPodium(ranking);
    showPanel(panelResult);
  }

  function renderPodium(ranking) {
    podiumEl.innerHTML = "";

    const steps = [];
    const first = ranking[0];
    const second = ranking[1];
    const third = ranking[2];
    const fourth = ranking[3];

    if (second) steps.push({ cls:"second", label:"🥈 第二名", who:playerName(second.p), sc: second.s });
    steps.push({ cls:"first", label:"🥇 第一名", who:playerName(first.p), sc: first.s });
    if (third) steps.push({ cls:"third", label:"🥉 第三名", who:playerName(third.p), sc: third.s });
    if (fourth) steps.push({ cls:"fourth", label:"第四名", who:playerName(fourth.p), sc: fourth.s });

    for (const st of steps) {
      const div = document.createElement("div");
      div.className = `step ${st.cls}`;
      div.innerHTML = `
        <div class="rank">${st.label}</div>
        <div class="who">${st.who}</div>
        <div class="sc">${st.sc} 分</div>
      `;
      podiumEl.appendChild(div);
    }
  }

  // ===== Spawn =====
  function speedMult() { return 1 + elapsed * speedRamp; }
  function obstacleInterval() {
    const v = obstacleBaseInterval - elapsed * 0.018;
    return Math.max(obstacleMinInterval, v);
  }
  function itemInterval() {
    const v = itemBaseInterval - elapsed * 0.012;
    return Math.max(itemMinInterval, v);
  }
  function weightedLane() {
    const w = [1.0, RISK_OBSTACLE_WEIGHT, 1.0];
    const sum = w[0] + w[1] + w[2];
    const r = Math.random() * sum;
    if (r < w[0]) return 0;
    if (r < w[0] + w[1]) return 1;
    return 2;
  }
  function spawnObstacle() {
    const ln = weightedLane();
    let s = 66 + Math.random() * 28;
    if (ln === RISK_LANE) s *= RISK_OBSTACLE_SIZE_MULT;
    obstacles.push({ x: W + 100, lane: ln, w: s, h: s });
  }
  function spawnItem() {
    const ln = Math.floor(Math.random() * LANES);
    if (Math.random() < bombChance) items.push({ x: W + 100, lane: ln, kind: "bomb", icon: BOMB.icon, value: BOMB.value });
    else {
      const f = FOOD[Math.floor(Math.random() * FOOD.length)];
      items.push({ x: W + 100, lane: ln, kind: "food", icon: f.icon, value: f.value });
    }
  }

  // ===== Collision / helpers =====
  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function playerY() {
    const y0 = laneY[0], y2 = laneY[2];
    return y0 + (y2 - y0) * (laneVisual / 2);
  }

  // ===== Draw =====
  function drawBackground() {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(230,247,255,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < LANES; i++) {
      const y = laneY[i];
      ctx.fillStyle =
        i === 0 ? "rgba(167,243,208,0.18)" :
        i === 1 ? "rgba(255,210,110,0.26)" :
                  "rgba(120,200,255,0.18)";
      ctx.fillRect(0, y - laneHalfHeight, W, laneHalfHeight * 2);

      ctx.strokeStyle = "rgba(15,23,42,0.10)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y - laneHalfHeight); ctx.lineTo(W, y - laneHalfHeight); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y + laneHalfHeight); ctx.lineTo(W, y + laneHalfHeight); ctx.stroke();
    }
  }

  function drawTree(x, y, size) {
    const trunkW = size * 0.22;
    const trunkH = size * 0.34;
    ctx.fillStyle = "#7c4a1b";
    ctx.fillRect(x - trunkW/2, y + size*0.08, trunkW, trunkH);

    ctx.fillStyle = "#1f7a3a";
    ctx.beginPath(); ctx.arc(x, y - size*0.12, size*0.35, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - size*0.22, y, size*0.30, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + size*0.22, y, size*0.30, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath(); ctx.arc(x - size*0.10, y - size*0.18, size*0.12, 0, Math.PI*2); ctx.fill();
  }

  function drawObstacle(ob) { drawTree(ob.x, laneY[ob.lane], ob.w); }

  function drawItem(it) {
    ctx.save();
    ctx.globalAlpha = 1; // ✅ 繪圖本身永遠不透明
    ctx.font = `34px "Microsoft JhengHei","微軟正黑體", system-ui, Apple Color Emoji, Segoe UI Emoji`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(it.icon, it.x, laneY[it.lane]);
    ctx.restore();
  }

  function drawRunningCat(cat, x, y, t) {
    const s = CAT_SIZE;
    const bodyL = s * 1.25;
    const bodyH = s * 0.58;
    const phase = Math.sin(t * 10);

    const alpha = invincible > 0 ? (0.65 + 0.35 * Math.sin(t * 24)) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = cat.stripe;
    ctx.lineWidth = Math.max(4, s * 0.10);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - bodyL*0.60, y - bodyH*0.05);
    ctx.quadraticCurveTo(x - bodyL*1.00, y - bodyH*0.55, x - bodyL*0.78, y + bodyH*0.18);
    ctx.stroke();

    const legY = y + bodyH*0.62;
    const legSwing = phase * (s * 0.20);
    function leg(px, front) {
      ctx.strokeStyle = cat.stripe;
      ctx.lineWidth = Math.max(5, s * 0.12);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, y + bodyH*0.28);
      ctx.lineTo(px + (front ? legSwing : -legSwing), legY);
      ctx.stroke();
    }
    leg(x - bodyL*0.22, true);
    leg(x + bodyL*0.06, false);
    leg(x + bodyL*0.28, true);
    leg(x - bodyL*0.40, false);

    ctx.fillStyle = cat.body;
    ctx.beginPath();
    ctx.ellipse(x, y, bodyL*0.55, bodyH*0.55, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = cat.belly;
    ctx.beginPath();
    ctx.ellipse(x + bodyL*0.12, y + bodyH*0.10, bodyL*0.35, bodyH*0.35, 0, 0, Math.PI*2);
    ctx.fill();

    const hx = x + bodyL*0.64;
    const hr = s*0.34;
    ctx.fillStyle = cat.body;
    ctx.beginPath(); ctx.arc(hx, y - bodyH*0.18, hr, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = cat.stripe;
    ctx.beginPath();
    ctx.moveTo(hx - hr*0.55, y - bodyH*0.62);
    ctx.lineTo(hx - hr*0.10, y - bodyH*1.02);
    ctx.lineTo(hx + hr*0.05, y - bodyH*0.62);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + hr*0.55, y - bodyH*0.62);
    ctx.lineTo(hx + hr*0.10, y - bodyH*1.02);
    ctx.lineTo(hx - hr*0.05, y - bodyH*0.62);
    ctx.fill();

    ctx.fillStyle = "rgba(15,23,42,0.95)";
    ctx.beginPath();
    ctx.arc(hx - hr*0.18, y - bodyH*0.18, 2.6, 0, Math.PI * 2);
    ctx.arc(hx + hr*0.18, y - bodyH*0.18, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawPops(dt) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.ttl -= dt;
      p.y += p.vy * dt;
      const life = clamp(p.ttl / (p.base || 0.75), 0, 1);

      ctx.save();
      ctx.globalAlpha = life;

      const isToast = (p.kind === "skillToast" || p.kind === "cooldownToast");
      const scale = isToast ? (1.0 + 0.20 * Math.sin((1-life) * Math.PI)) : (p.scale + (1 - life) * 0.30);

      ctx.font = `${Math.floor((isToast ? 44 : 48) * scale)}px "Microsoft JhengHei","微軟正黑體", system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeText(p.text, p.x, p.y);

      let fill = "rgba(22,163,74,1)";
      if (p.kind === "bomb") fill = "rgba(239,68,68,1)";
      if (p.kind === "skillToast") fill = "rgba(59,130,246,1)";
      if (p.kind === "cooldownToast") fill = "rgba(249,115,22,1)";
      ctx.fillStyle = fill;
      ctx.fillText(p.text, p.x, p.y);

      ctx.restore();

      if (p.ttl <= 0) pops.splice(i, 1);
    }
  }

  // ✅ lives：移除圓框底板，只留 🧪（不會再有那個方框/圓框感）
  function drawLives() {
    const x0 = 16, y0 = 14;
    const gap = 34;

    ctx.save();
    ctx.font = `26px "Microsoft JhengHei","微軟正黑體", system-ui, Apple Color Emoji, Segoe UI Emoji`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (let i = 0; i < MAX_LIVES; i++) {
      const on = i < lives;
      ctx.globalAlpha = on ? 1 : 0.28;
      ctx.fillText("🧪", x0 + i * gap, y0);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFinalCountdownBounce() {
    const remain = roundSeconds - elapsed;
    if (!(remain <= 5 && remain > 0)) return;

    const n = Math.ceil(remain);
    const frac = remain - Math.floor(remain);
    const p = 1 - frac;
    const bounce = Math.sin(p * Math.PI);
    const scale = 1 + 0.32 * bounce;

    const sizeBase = Math.floor(Math.min(W, H) * 0.22);
    const fontSize = Math.floor(sizeBase * scale);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${fontSize}px "Microsoft JhengHei","微軟正黑體", system-ui`;

    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    ctx.lineWidth = Math.max(10, Math.floor(Math.min(W, H) * 0.02));
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.strokeText(String(n), W/2, H/2);

    ctx.fillStyle = "rgba(239,68,68,1)";
    ctx.fillText(String(n), W/2, H/2);

    ctx.restore();
  }

  function drawFrame(dt) {
    if (screenShake > 0) {
      const s = 6 * (screenShake / 0.35);
      const ox = (Math.random() * 2 - 1) * s;
      const oy = (Math.random() * 2 - 1) * s;
      ctx.save();
      ctx.translate(ox, oy);
      drawBackground();
      for (const ob of obstacles) drawObstacle(ob);
      for (const it of items) drawItem(it);
      drawRunningCat(currentCat(), playerX(), playerY(), elapsed);
      drawPops(dt);
      ctx.restore();
    } else {
      drawBackground();
      for (const ob of obstacles) drawObstacle(ob);
      for (const it of items) drawItem(it);
      drawRunningCat(currentCat(), playerX(), playerY(), elapsed);
      drawPops(dt);
    }

    drawLives();
    drawFinalCountdownBounce();
  }

  function tickSkillTimers(dt){
    skillCD = Math.max(0, skillCD - dt);
    invincible = Math.max(0, invincible - dt);
    slowmo = Math.max(0, slowmo - dt);
    foodBoost = Math.max(0, foodBoost - dt);
    dashLaneWindow = Math.max(0, dashLaneWindow - dt);

    if (invincible <= 0) scoreGainMult = 1.0;
    if (foodBoost <= 0) foodMult = 1.0;
    if (slowmo <= 0) slowFactor = 1.0;
  }

  function loop(ts) {
    if (!running) return;

    const t = ts / 1000;
    let dt = tPrev ? (t - tPrev) : 0;
    tPrev = t;
    dt = Math.min(dt, 0.05);

    let worldDT = dt;
    if (slowmo > 0) worldDT *= slowFactor;

    elapsed += dt;
    cooldown = Math.max(0, cooldown - dt);

    laneVisual += (lane - laneVisual) * 0.18;

    obstacleTimer += worldDT;
    itemTimer += worldDT;

    hitInvuln = Math.max(0, hitInvuln - dt);
    screenShake = Math.max(0, screenShake - dt);

    tickSkillTimers(dt);

    score += dt * scorePerSecond * scoreGainMult;

    const speed = baseSpeed * speedMult();

    if (obstacleTimer >= obstacleInterval()) {
      obstacleTimer = 0;
      spawnObstacle();
      if (Math.random() < clamp(0.06 + elapsed * 0.01, 0.06, 0.22)) {
        setTimeout(() => { if (running) spawnObstacle(); }, 120);
      }
    }
    if (itemTimer >= itemInterval()) {
      itemTimer = 0;
      spawnItem();
    }

    for (const ob of obstacles) ob.x -= speed * worldDT;
    for (const it of items) it.x -= speed * worldDT;

    while (obstacles.length && obstacles[0].x < -220) obstacles.shift();
    while (items.length && items[0].x < -220) items.shift();

    const px = playerX();
    const py = playerY();
    const playerRect = { x: px - CAT_SIZE*0.65, y: py - CAT_SIZE*0.55, w: CAT_SIZE*1.6, h: CAT_SIZE*1.1 };

    if (hitInvuln <= 0 && invincible <= 0) {
      for (const ob of obstacles) {
        const oy = laneY[ob.lane];
        const obRect = { x: ob.x - ob.w*0.40, y: oy - ob.h*0.48, w: ob.w*0.80, h: ob.h*0.98 };
        if (rectOverlap(playerRect.x, playerRect.y, playerRect.w, playerRect.h, obRect.x, obRect.y, obRect.w, obRect.h)) {
          lives -= 1;
          sfxCrash();
          screenShake = 0.35;
          hitInvuln = 0.90;
          addPop(px, py - 70, "撞到！", "hit");
          addPop(px + 90, py - 40, "-1🧪", "hit");

          if (lives <= 0) {
            finishRound("生命歸零！");
            return;
          }
          break;
        }
      }
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const iy = laneY[it.lane];
      const itRect = { x: it.x - 18, y: iy - 18, w: 36, h: 36 };
      if (rectOverlap(playerRect.x, playerRect.y, playerRect.w, playerRect.h, itRect.x, itRect.y, itRect.w, itRect.h)) {
        items.splice(i, 1);

        if (it.kind === "food") {
          let add = it.value * foodMult;
          if (lane === RISK_LANE) add *= RISK_ITEM_MULT;
          score += add;
          sfxFood();
          addPop(px + 90, py - 40, `+${Math.round(add)}`, "food");
        } else {
          score += it.value;
          sfxBomb();
          addPop(px + 90, py - 40, `-100`, "bomb");
        }
      }
    }

    updateHUD();
    drawFrame(dt);

    if (elapsed >= roundSeconds) {
      finishRound("時間到！");
      return;
    }

    requestAnimationFrame(loop);
  }

  // ===== Buttons =====
  btnStart.addEventListener("click", startRound);
  btnRestart.addEventListener("click", resetMatch);
  btnBackToPick.addEventListener("click", resetMatch);

  // ===== init =====
  recomputeLanes();
  resizeCanvas();
  resetMatch();
})();
