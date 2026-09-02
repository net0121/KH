(() => {
  "use strict";

  // ---------- Config ----------
  const ROUND_SECONDS = 60;
  const COMBO_WINDOW_MS = 1400;   // time allowed between hits before combo breaks
  const HIT_BASE_SCORE = 3;
  const HIGH_SCORE_KEY = "tripleHitHighScore";

  // Combo tiers: [minCombo, multiplier, color]
  const COMBO_TIERS = [
    { min: 0, mult: 1, color: "var(--magenta)" },
    { min: 5, mult: 1.5, color: "var(--cyan)" },
    { min: 10, mult: 2, color: "var(--gold)" },
    { min: 20, mult: 3, color: "#ff8a3d" },
    { min: 35, mult: 4, color: "#ff5c5c" }
  ];

  // ---------- DOM ----------
  const arena = document.getElementById("arena");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const comboCountEl = document.getElementById("comboCount");
  const comboFillEl = document.getElementById("comboFill");
  const statusText = document.getElementById("statusText");
  const highscoreEl = document.getElementById("highscore");

  const startOverlay = document.getElementById("startOverlay");
  const endOverlay = document.getElementById("endOverlay");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const endHeading = document.getElementById("endHeading");
  const finalScoreEl = document.getElementById("finalScore");
  const newBestNote = document.getElementById("newBestNote");

  // ---------- State ----------
  let score = 0;
  let timeLeft = ROUND_SECONDS;
  let combo = 0;
  let lastHitAt = 0;
  let gameActive = false;
  let countdownTimer = null;
  let comboTickTimer = null;
  let slots = []; // { el, portrait, nameEl, pipEls, hp, enemy }

  // ---------- Setup ----------
  function loadHighScore() {
    const stored = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    highscoreEl.textContent = stored;
    return stored;
  }

  function buildArena() {
    arena.innerHTML = "";
    slots = [];
    for (let i = 0; i < ARENA_SIZE; i++) {
      const slot = createSlot(i);
      arena.appendChild(slot.el);
      slots.push(slot);
    }
  }

  function createSlot(index) {
    const el = document.createElement("div");
    el.className = "enemy";
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");

    const portraitWrap = document.createElement("div");
    portraitWrap.className = "enemy-portrait-wrap";
    const portrait = document.createElement("img");
    portrait.className = "enemy-portrait";
    portrait.alt = "";
    portrait.loading = "lazy";
    portrait.onerror = () => {
      // Graceful fallback if a swapped-in image link is broken
      portrait.onerror = null;
      portrait.src = "https://placehold.co/300x300/1c1830/948fb0?text=%3F";
    };
    portraitWrap.appendChild(portrait);

    const nameEl = document.createElement("div");
    nameEl.className = "enemy-name";

    const pips = document.createElement("div");
    pips.className = "enemy-pips";
    const pipEls = [];
    for (let p = 0; p < HITS_TO_DEFEAT; p++) {
      const pip = document.createElement("span");
      pip.className = "pip";
      pips.appendChild(pip);
      pipEls.push(pip);
    }

    el.appendChild(portraitWrap);
    el.appendChild(nameEl);
    el.appendChild(pips);

    const slot = { el, portrait, nameEl, pipEls, hp: 0, enemy: null, locked: false };

    const activate = (e) => {
      e.preventDefault();
      handleHit(slot, e);
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") activate(e);
    });

    return slot;
  }

  function randomEnemy() {
    return ENEMY_ROSTER[Math.floor(Math.random() * ENEMY_ROSTER.length)];
  }

  function spawnEnemy(slot, animate) {
    const enemy = randomEnemy();
    slot.enemy = enemy;
    slot.hp = HITS_TO_DEFEAT;
    slot.locked = false;
    slot.portrait.src = enemy.image;
    slot.portrait.alt = enemy.name;
    slot.nameEl.textContent = enemy.name;
    slot.pipEls.forEach((pip) => {
      pip.classList.remove("filled");
      pip.style.setProperty("--pip-color", enemy.tint);
    });
    slot.el.classList.remove("is-defeated");
    if (animate) {
      slot.el.classList.add("is-spawning");
      setTimeout(() => slot.el.classList.remove("is-spawning"), 300);
    }
  }

  // ---------- Combo ----------
  function currentTier() {
    let tier = COMBO_TIERS[0];
    for (const t of COMBO_TIERS) {
      if (combo >= t.min) tier = t;
    }
    return tier;
  }

  function registerHitForCombo() {
    combo += 1;
    lastHitAt = Date.now();
    const tier = currentTier();
    comboCountEl.textContent = `×${combo}`;
    comboCountEl.style.color = tier.color;
    comboFillEl.style.background = tier.color;
    comboFillEl.style.width = "100%";
  }

  function breakCombo(reason) {
    if (combo > 0 && reason) {
      statusText.textContent = reason;
    }
    combo = 0;
    comboCountEl.textContent = "×0";
    comboCountEl.style.color = "var(--text-dim)";
    comboFillEl.style.width = "0%";
  }

  function tickComboDecay() {
    if (!gameActive || combo === 0) return;
    const elapsed = Date.now() - lastHitAt;
    const remaining = Math.max(0, 1 - elapsed / COMBO_WINDOW_MS);
    comboFillEl.style.width = `${remaining * 100}%`;
    if (elapsed >= COMBO_WINDOW_MS) {
      breakCombo("Streak dropped — timing reset.");
    }
  }

  // ---------- Hit handling ----------
  function showFloater(slot, text) {
    const f = document.createElement("div");
    f.className = "floater";
    f.textContent = text;
    slot.el.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  const STAR_COLORS = ["var(--gold)", "#ffffff", "var(--cyan)", "var(--magenta)"];

  function spawnStarBurst(slot, x, y, big) {
    const count = big ? 12 : 6;
    const baseDistance = big ? 46 : 26;
    for (let i = 0; i < count; i++) {
      const star = document.createElement("div");
      star.className = "star-particle";

      // Spread evenly around a circle with a little jitter for a natural burst
      const angle = (360 / count) * i + (Math.random() * 20 - 10);
      const rad = (angle * Math.PI) / 180;
      const distance = baseDistance + Math.random() * (big ? 26 : 16);
      const dx = Math.cos(rad) * distance;
      const dy = Math.sin(rad) * distance;
      const size = big ? 10 + Math.random() * 8 : 6 + Math.random() * 5;
      const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];

      star.style.setProperty("--x", `${x}px`);
      star.style.setProperty("--y", `${y}px`);
      star.style.setProperty("--dx", `${dx}px`);
      star.style.setProperty("--dy", `${dy}px`);
      star.style.setProperty("--size", `${size}px`);
      star.style.setProperty("--star-color", color);
      star.style.setProperty("--rot", `${Math.round(Math.random() * 360)}deg`);
      star.style.setProperty("--end-scale", big ? "1.3" : "0.9");
      star.style.setProperty("--delay", `${Math.random() * 60}ms`);

      slot.el.appendChild(star);
      setTimeout(() => star.remove(), 700);
    }
  }

  function hitPoint(slot, evt) {
    const rect = slot.el.getBoundingClientRect();
    if (evt && typeof evt.clientX === "number") {
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  function handleHit(slot, evt) {
    if (!gameActive || slot.locked || slot.hp <= 0) return;

    registerHitForCombo();
    const tier = currentTier();
    slot.hp -= 1;

    const pipIndex = HITS_TO_DEFEAT - slot.hp - 1;
    if (slot.pipEls[pipIndex]) slot.pipEls[pipIndex].classList.add("filled");

    const point = hitPoint(slot, evt);

    if (slot.hp > 0) {
      // Regular hit
      const gained = Math.round(HIT_BASE_SCORE * tier.mult);
      score += gained;
      slot.el.classList.remove("is-hit");
      void slot.el.offsetWidth; // restart animation
      slot.el.classList.add("is-hit");
      spawnStarBurst(slot, point.x, point.y, false);
      showFloater(slot, `+${gained}`);
      statusText.textContent = `${slot.enemy.name} staggers — ${slot.hp} hit${slot.hp === 1 ? "" : "s"} left.`;
    } else {
      // Defeated
      slot.locked = true;
      const gained = Math.round(slot.enemy.points * tier.mult);
      score += gained;
      spawnStarBurst(slot, point.x, point.y, true);
      showFloater(slot, `+${gained}`);
      slot.el.classList.add("is-defeated");
      statusText.textContent = `${slot.enemy.name} banished! Combo ×${combo} blazing.`;
      setTimeout(() => {
        spawnEnemy(slot, true);
      }, 320);
    }

    scoreEl.textContent = score;
  }

  function handleArenaMiss(e) {
    if (!gameActive) return;
    if (e.target === arena) {
      breakCombo("Missed! Combo broken.");
    }
  }

  // ---------- Timer ----------
  function tickCountdown() {
    timeLeft -= 1;
    timeEl.textContent = timeLeft;
    timeEl.classList.toggle("time-low", timeLeft <= 10);
    if (timeLeft <= 0) {
      endGame();
    }
  }

  // ---------- Game lifecycle ----------
  function startGame() {
    score = 0;
    timeLeft = ROUND_SECONDS;
    combo = 0;
    gameActive = true;

    scoreEl.textContent = "0";
    timeEl.textContent = ROUND_SECONDS;
    timeEl.classList.remove("time-low");
    breakCombo(null);
    statusText.textContent = "Strike a shadow to begin.";

    buildArena();
    slots.forEach((slot) => spawnEnemy(slot, false));

    startOverlay.classList.add("overlay--hidden");
    endOverlay.classList.add("overlay--hidden");

    clearInterval(countdownTimer);
    clearInterval(comboTickTimer);
    countdownTimer = setInterval(tickCountdown, 1000);
    comboTickTimer = setInterval(tickComboDecay, 100);
  }

  function endGame() {
    gameActive = false;
    clearInterval(countdownTimer);
    clearInterval(comboTickTimer);

    const best = loadHighScore();
    const isNewBest = score > best;
    if (isNewBest) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
      highscoreEl.textContent = score;
    }

    endHeading.textContent = "LIGHT FADES";
    finalScoreEl.textContent = score;
    newBestNote.classList.toggle("overlay--hidden", !isNewBest);
    endOverlay.classList.remove("overlay--hidden");
  }

  // ---------- Wire up ----------
  arena.addEventListener("click", handleArenaMiss);
  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  loadHighScore();
  buildArena();
  slots.forEach((slot) => spawnEnemy(slot, false));
})();
