(() => {
  const canvas = document.getElementById("game");
  const stage = document.getElementById("stage");
  const ctx = canvas.getContext("2d");

  const hudPlayer = document.getElementById("hudPlayer");
  const hudRoundTime = document.getElementById("hudRoundTime");
  const hudScore = document.getElementById("hudScore");

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

  // ===== 4 cats =====
  const CATS = [
    { id: "orange", name: "橘貓", desc: "可愛橘橘，活力滿滿", body: "#f59e0b", belly: "#fde68a", stripe: "#d97706" },
    { id: "tux",    name: "黑白貓", desc: "黑白配，酷酷的",   body: "#0f172a", belly: "#f8fafc", stripe: "#334155" },
    { id: "gray",   name: "灰貓",   desc: "耐看灰色系",       body: "#64748b", belly: "#e2e8f0", stripe: "#475569" },
    { id: "calico", name: "三花貓", desc: "斑斕三色超吸睛",   body: "#f8fafc", belly: "#fde68a", stripe: "#f97316" },
  ];

  function catThumbSVG(cat){
    const isCalico = cat.id === "calico";
    const isTux = cat.id === "tux";
    return `
    <svg width="64" height="44" viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 22 C2 14, 4 30, 12 30" fill="none" stroke="${cat.stripe}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="30" cy="26" rx="18" ry="11" fill="${cat.body}"/>
      <ellipse cx="34" cy="29" rx="10" ry="7" fill="${cat.belly}" opacity="0.95"/>

      ${
        isCalico
          ? `
            <circle cx="22" cy="24" r="4.4" fill="#f97316"/>
            <circle cx="34" cy="20" r="3.6" fill="#0f172a"/>
            <circle cx="40" cy="30" r="3.6" fill="#fde68a"/>
          `
          : isTux
            ? `
              <rect x="18" y="19" width="6" height="16" fill="#ffffff" opacity="0.95"/>
              <rect x="28" y="17" width="6" height="18" fill="${cat.stripe}" opacity="0.9"/>
              <rect x="38" y="19" width="6" height="16" fill="#ffffff" opacity="0.95"/>
            `
            : `
              <rect x="20" y="20" width="4" height="12" fill="${cat.stripe}" opacity="0.9"/>
              <rect x="28" y="18" width="4" height="14" fill="${cat.stripe}" opacity="0.85"/>
              <rect x="36" y="20" width="4" height="12" fill="${cat.stripe}" opacity="0.9"/>
            `
      }

      <circle cx="48" cy="20" r="7" fill="${cat.body}"/>
      <path d="M44 15 L46.5 10.5 L48.5 15 Z" fill="${cat.stripe}" opacity="0.95"/>
      <path d="M52 15 L49.5 10.5 L47.5 15 Z" fill="${cat.stripe}" opacity="0.95"/>
      <circle cx="46.2" cy="19.5" r="1.4" fill="#111"/>
      <circle cx="49.8" cy="19.5" r="1.4" fill="#111"/>
    </svg>`;
  }

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

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const playerX = ()=> W * playerXRatio;

  // ===== Panels =====
  function popCard() {
    overlayCard.classList.remove("pop");
    void overlayCard.offsetWidth;
    overlayCard.classList.add("pop");
  }
  function showPanel(panel) {
    overlay.classList.remove("hidden");
    panelPick.classList.add("hidden");
    panelReady.classList.add("hidden");
    panelResult.classList.add("hidden");
    panel.classList.remove("hidden");
    popCard();
  }
  function hideOverlay() { overlay.classList.add("hidden"); }

  function updateHUD() {
    hudPlayer.textContent = playerName(currentPlayer);
    hudScore.textContent = String(Math.floor(score));
    hudRoundTime.textContent = String(Math.max(0, Math.ceil(roundSeconds - elapsed)));
  }

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
    pickBody.textContent = `目前玩家：${playerCount} 位。依序選貓後開始比賽。`;
    renderCatPicker();
    updateHUD();
    popCard();
  }

  [...countRow.querySelectorAll(".countBtn")].forEach(btn => {
    btn.addEventListener("click", () => setPlayerCount(Number(btn.dataset.n)));
  });

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

      meta.appendChild(name);
      meta.appendChild(desc);

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
    stateBody.innerHTML =
      `規則：躲避樹木🌳（更大更難）。吃到食物加分：🐟 +50 / 🍗 +100 / 🍔 +150；吃到炸彈 💣 扣 100。<br/>
       操作：空白鍵（往下循環換道） / ↑↓ 或 W/S（指定換道） / 點畫面（循環換道）`;
    showPanel(panelReady);
    resetRoundState();
  }

  // ===== Controls =====
  function setLane(newLane) {
    if (!running) return;
    if (cooldown > 0) return;
    lane = clamp(newLane, 0, LANES - 1);
    cooldown = laneSwitchCooldown;
    sfxSwitch();
  }
  function cycleLaneDown() { setLane((lane + 1) % LANES); }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (e.code === "Space") {
      e.preventDefault();
      if (!running && !overlay.classList.contains("hidden")) startRound();
      else if (running) cycleLaneDown();
      return;
    }
    if (e.code === "ArrowUp" || e.code === "ArrowDown") e.preventDefault();
    if (!running) return;
    if (e.code === "ArrowUp" || k === "w") setLane(lane - 1);
    if (e.code === "ArrowDown" || k === "s") setLane(lane + 1);
  });

  canvas.addEventListener("pointerdown", () => {
    if (!running && !overlay.classList.contains("hidden")) startRound();
    else if (running) cycleLaneDown();
  });

  // ===== Start/finish =====
  function startRound() {
    if (running) return;
    roundSeconds = parseInt(roundSecondsInput.value || "20", 10);
    if (!Number.isFinite(roundSeconds) || roundSeconds < 5) roundSeconds = 20;

    hideOverlay();
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

    const first = ranking[0];
    const second = ranking[1];
    const third = ranking[2];
    const fourth = ranking[3];

    const steps = [];
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

  function spawnObstacle() {
    const ln = Math.floor(Math.random() * LANES);
    const s = 62 + Math.random() * 26;
    obstacles.push({ x: W + 90, lane: ln, w: s, h: s });
  }

  function spawnItem() {
    const ln = Math.floor(Math.random() * LANES);
    if (Math.random() < bombChance) items.push({ x: W + 90, lane: ln, kind: "bomb", icon: BOMB.icon, value: BOMB.value });
    else {
      const f = FOOD[Math.floor(Math.random() * FOOD.length)];
      items.push({ x: W + 90, lane: ln, kind: "food", icon: f.icon, value: f.value });
    }
  }

  // ===== Collision / FX =====
  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function playerY() {
    const y0 = laneY[0], y2 = laneY[2];
    return y0 + (y2 - y0) * (laneVisual / 2);
  }
  function addPop(x, y, text, kind) {
    pops.push({ x, y, text, ttl: 0.75, vy: -75, scale: 1.7, kind });
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
        i === 0 ? "rgba(255,210,110,0.22)" :
        i === 1 ? "rgba(120,200,255,0.18)" :
                  "rgba(167,243,208,0.18)";
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
  }

  function drawObstacle(ob) { drawTree(ob.x, laneY[ob.lane], ob.w); }

  function drawItem(it) {
    ctx.save();
    ctx.globalAlpha = 1;
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

    ctx.save();
    ctx.globalAlpha = 1;

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
      const life = clamp(p.ttl / 0.75, 0, 1);

      ctx.save();
      ctx.globalAlpha = life;
      const scale = p.scale + (1 - life) * 0.30;

      ctx.font = `${Math.floor(48 * scale)}px "Microsoft JhengHei","微軟正黑體", system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.strokeText(p.text, p.x, p.y);

      ctx.fillStyle = p.kind === "bomb" ? "rgba(239,68,68,1)" : "rgba(22,163,74,1)";
      ctx.fillText(p.text, p.x, p.y);

      ctx.restore();

      if (p.ttl <= 0) pops.splice(i, 1);
    }
  }

  function drawFinalCountdownBounce(){
  const remain = roundSeconds - elapsed;

  // ✅ 用 <= 5 確保最後五秒一定會畫
  if (!(remain <= 5 && remain > 0)) return;

  const n = Math.ceil(remain);   // 5,4,3,2,1
  const frac = remain - Math.floor(remain); // 0~1
  const p = 1 - frac;            // 0->1
  const bounce = Math.sin(p * Math.PI); // 0..1..0
  const scale = 1 + 0.32 * bounce;

  const sizeBase = Math.floor(Math.min(W, H) * 0.22);
  const fontSize = Math.floor(sizeBase * scale);

  ctx.save();

  // ✅ 仍然半透明（50%），但加陰影讓它非常清楚
  ctx.globalAlpha = 0.5;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${fontSize}px "Microsoft JhengHei","微軟正黑體", system-ui`;

  // ✅ 陰影（不受 alpha 影響太多，會更顯眼）
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;

  // 白邊
  ctx.lineWidth = Math.max(10, Math.floor(Math.min(W, H) * 0.02));
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.strokeText(String(n), W/2, H/2);

  // 紅字
  ctx.fillStyle = "rgba(239,68,68,1)";
  ctx.fillText(String(n), W/2, H/2);

  ctx.restore();
}


  function drawFrame(dt) {
    drawBackground();
    for (const ob of obstacles) drawObstacle(ob);
    for (const it of items) drawItem(it);

    const cat = playerCat[currentPlayer] || CATS[0];
    drawRunningCat(cat, playerX(), playerY(), elapsed);

    drawPops(dt);

    // ✅ 最後五秒跳動倒數
    drawFinalCountdownBounce();
  }

  function loop(ts) {
    if (!running) return;

    const t = ts / 1000;
    let dt = tPrev ? (t - tPrev) : 0;
tPrev = t;

// ✅ 防止切分頁/卡頓導致 dt 爆大，跳過倒數
dt = Math.min(dt, 0.05);


    elapsed += dt;
    cooldown = Math.max(0, cooldown - dt);
    laneVisual += (lane - laneVisual) * 0.18;
    score += dt * scorePerSecond;

    const speed = baseSpeed * speedMult();

    obstacleTimer += dt;
    itemTimer += dt;

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

    for (const ob of obstacles) ob.x -= speed * dt;
    for (const it of items) it.x -= speed * dt;

    while (obstacles.length && obstacles[0].x < -180) obstacles.shift();
    while (items.length && items[0].x < -180) items.shift();

    const px = playerX();
    const py = playerY();
    const playerRect = { x: px - CAT_SIZE*0.65, y: py - CAT_SIZE*0.55, w: CAT_SIZE*1.6, h: CAT_SIZE*1.1 };

    for (const ob of obstacles) {
      const oy = laneY[ob.lane];
      const obRect = { x: ob.x - ob.w*0.40, y: oy - ob.h*0.48, w: ob.w*0.80, h: ob.h*0.98 };
      if (rectOverlap(playerRect.x, playerRect.y, playerRect.w, playerRect.h, obRect.x, obRect.y, obRect.w, obRect.h)) {
        sfxCrash();
        finishRound("撞到樹木！");
        return;
      }
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const iy = laneY[it.lane];
      const itRect = { x: it.x - 18, y: iy - 18, w: 36, h: 36 };
      if (rectOverlap(playerRect.x, playerRect.y, playerRect.w, playerRect.h, itRect.x, itRect.y, itRect.w, itRect.h)) {
        items.splice(i, 1);
        score += it.value;
        if (it.kind === "bomb") { sfxBomb(); addPop(px + 70, py - 30, `-100`, "bomb"); }
        else { sfxFood(); addPop(px + 70, py - 30, `+${it.value}`, "food"); }
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

  btnStart.addEventListener("click", startRound);
  btnRestart.addEventListener("click", resetMatch);
  btnBackToPick.addEventListener("click", resetMatch);

  recomputeLanes();
  resizeCanvas();
  resetMatch();
})();
