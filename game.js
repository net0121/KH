(() => {
  "use strict";

  const ROUND_SECONDS = 60;
  const COMBO_WINDOW_MS = 5000;
  const HIT_BASE_SCORE = 3;
  const HIGH_SCORE_KEY = "keyOfLightHighScore";
  const ENDLESS_HIGH_SCORE_KEY = "keyOfLightEndlessHighScore";
  const MUTED_KEY = "keyOfLightMuted";
  const XP_KEY = "keyOfLightXP";

  const ENDLESS_DIFFICULTY_INTERVAL_S = 20; // ramp difficulty every N seconds survived
  const ENDLESS_DIFFICULTY_STEP = 0.15;     // +15% speed / attack frequency per ramp
  const ENDLESS_DIFFICULTY_CAP = 2.5;       // hard ceiling on the multiplier

  const THUNDER_PNG_URL = "https://github.com/net0121/KH/blob/main/badthundaga.png?raw=true";

  const BASE_SPELLS = ['Fire', 'Blizzard', 'Thunder', 'Cure', 'Reflect', 'Magnet', 'Stop', 'Aero'];
  const BASE_SPELL_COSTS = [10, 15, 20, 18, 15, 22, 25, 20];

  const COMBO_TIERS = [
    { min: 0, mult: 1, color: "var(--magenta)" },
    { min: 5, mult: 1.5, color: "var(--cyan)" },
    { min: 10, mult: 2, color: "var(--gold)" },
    { min: 20, mult: 3, color: "#ff8a3d" },
    { min: 35, mult: 4, color: "#ff5c5c" }
  ];

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener("mousemove", (e) => {
    const rect = arena.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  let currentSpellIndex = 0;
  let spellMenuOpen = false;
  let activeBarriers = [];
  let activeProjectiles = [];

  const arena = document.getElementById("arena");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const timeLabelEl = document.getElementById("timeLabel");
  const comboCountEl = document.getElementById("comboCount");
  const comboFillEl = document.getElementById("comboFill");
  const statusText = document.getElementById("statusText");
  const highscoreEl = document.getElementById("highscore");
  const highscoreLabelEl = document.getElementById("highscoreLabel");
  const muteBtn = document.getElementById("muteBtn");
  const magicBtn = document.getElementById("magicBtn");

  const startOverlay = document.getElementById("startOverlay");
  const endOverlay = document.getElementById("endOverlay");
  const startTimedBtn = document.getElementById("startTimedBtn");
  const startEndlessBtn = document.getElementById("startEndlessBtn");
  const timedLockNote = document.getElementById("timedLockNote");
  const restartBtn = document.getElementById("restartBtn");
  const menuBtn = document.getElementById("menuBtn");
  const endHeading = document.getElementById("endHeading");
  const finalScoreEl = document.getElementById("finalScore");
  const newBestNote = document.getElementById("newBestNote");
  const survivalNote = document.getElementById("survivalNote");
  const survivalTimeEl = document.getElementById("survivalTime");

  const spellMenuEl = document.getElementById("spellMenu");
  const levelDisplayEl = document.getElementById("levelDisplay");
  const xpFillEl = document.getElementById("xpFill");
  const mpFillEl = document.getElementById("mpFill");
  const hpFillEl = document.getElementById("hpFill");

  let score = 0;
  let timeLeft = ROUND_SECONDS;
  let combo = 0;
  let lastKillAt = 0;
  let gameActive = false;
  let gameMode = "timed"; // "timed" | "endless"
  let survivalSeconds = 0;
  let endlessDifficulty = 0;
  let countdownTimer = null;
  let comboTickTimer = null;
  let rafId = null;
  let lastFrameTime = 0;
  let slots = [];
  let muted = localStorage.getItem(MUTED_KEY) === "1";

  let playerXp = Number(localStorage.getItem(XP_KEY)) || 0;
  let playerLevel = 1;
  let maxMp = 100;
  let currentMp = 100;
  let maxHp = 100;
  let currentHp = 100;

  function getMagicTier() {
    if (playerLevel >= 10) return 3;
    if (playerLevel >= 5) return 2;
    return 1;
  }

  function getSpellName(index) {
    const tier = getMagicTier();
    const suffixes = [
      ['Fire', 'Fira', 'Firaga'],
      ['Blizzard', 'Blizzara', 'Blizzaga'],
      ['Thunder', 'Thundara', 'Thundaga'],
      ['Cure', 'Cura', 'Curaga'],
      ['Reflect', 'Reflera', 'Reflega'],
      ['Magnet', 'Magnera', 'Magnega'],
      ['Stop', 'Stopra', 'Stopga'],
      ['Aero', 'Aerora', 'Aeroga']
    ];
    return suffixes[index][tier - 1];
  }

  function updatePlayerStats() {
    const newLevel = Math.floor(Math.sqrt(playerXp / 50)) + 1;
    if (newLevel > playerLevel) {
      playerLevel = newLevel;
      statusText.textContent = `Level Up! Reached Level ${playerLevel}.`;
    }
    
    const xpForCurrent = 50 * Math.pow(playerLevel - 1, 2);
    const xpForNext = 50 * Math.pow(playerLevel, 2);
    const xpProgress = ((playerXp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100;

    maxMp = 80 + (playerLevel * 20);
    levelDisplayEl.textContent = playerLevel;
    xpFillEl.style.width = `${Math.min(100, Math.max(0, xpProgress))}%`;
    mpFillEl.style.width = `${(currentMp / maxMp) * 100}%`;
  }

  function restoreMp(amount) {
    currentMp = Math.min(maxMp, currentMp + amount);
    mpFillEl.style.width = `${(currentMp / maxMp) * 100}%`;
  }

  function drainMp(amount) {
    if (currentMp >= amount) {
      currentMp -= amount;
      mpFillEl.style.width = `${(currentMp / maxMp) * 100}%`;
      return true;
    }
    mpFillEl.classList.add("mp-empty");
    setTimeout(() => mpFillEl.classList.remove("mp-empty"), 200);
    return false;
  }

  function updateHpFill() {
    const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
    hpFillEl.style.width = `${pct}%`;
    hpFillEl.classList.toggle("hp-low", pct <= 25);
  }

  function damagePlayer(amount) {
    if (!gameActive) return;
    currentHp = Math.max(0, currentHp - amount);
    updateHpFill();
    hpFillEl.classList.remove("hp-flash");
    void hpFillEl.offsetWidth;
    hpFillEl.classList.add("hp-flash");
    playSynthTone({ wave: "square", freq: 160 }, { pitchMult: 1, duration: 0.18, volume: 0.16, sweep: 0.4 });
    if (currentHp <= 0) {
      endGame("Your Heart Fell...");
    }
  }

  function healPlayer(amount) {
    currentHp = Math.min(maxHp, currentHp + amount);
    updateHpFill();
  }

  function showArenaFloater(x, y, text, color) {
    const f = document.createElement("div");
    f.className = "floater";
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.style.transform = "translateX(-50%)";
    if (color) f.style.color = color;
    arena.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  function showFloater(slot, text, color) {
    showArenaFloater(slot.x + (slot.w || 100) / 2, slot.y, text, color);
  }

  function spawnStarBurst(x, y, color) {
    const count = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "star-particle";
      const angle = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 40;
      p.style.setProperty("--x", `${x}px`);
      p.style.setProperty("--y", `${y}px`);
      p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      p.style.setProperty("--size", `${8 + Math.random() * 8}px`);
      p.style.setProperty("--rot", `${Math.floor(Math.random() * 360)}deg`);
      p.style.setProperty("--star-color", color || "var(--gold)");
      arena.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  // ---------- Combo ----------

  function getComboTier(count) {
    let tier = COMBO_TIERS[0];
    for (const t of COMBO_TIERS) {
      if (count >= t.min) tier = t;
    }
    return tier;
  }

  function updateComboUI() {
    const tier = getComboTier(combo);
    comboCountEl.textContent = `${combo}x COMBO`;
    comboCountEl.style.color = tier.color;
    const elapsed = combo > 0 ? performance.now() - lastKillAt : 0;
    const pct = combo > 0 ? Math.max(0, 100 - (elapsed / COMBO_WINDOW_MS) * 100) : 0;
    comboFillEl.style.width = `${pct}%`;
    comboFillEl.style.background = tier.color;
  }

  function breakCombo(message) {
    if (combo > 0) {
      combo = 0;
      updateComboUI();
    }
    if (message) statusText.textContent = message;
  }

  let audioCtx = null;
  const audioElCache = new Map();

  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playSynthTone({ wave = "sine", freq = 440 }, { pitchMult = 1, duration = 0.1, volume = 0.16, sweep = 0.82 } = {}) {
    const ctx = getAudioCtx();
    if (!ctx || muted) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    const startFreq = freq * pitchMult;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, startFreq * sweep), ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function playNoiseBurst({ duration = 0.05, volume = 0.14 } = {}) {
    const ctx = getAudioCtx();
    if (!ctx || muted) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start();
  }

  function playFileSound(url) {
    if (muted) return;
    let base = audioElCache.get(url);
    if (!base) {
      base = new Audio(url);
      base.preload = "auto";
      audioElCache.set(url, base);
    }
    const node = base.cloneNode(true);
    node.volume = 0.6;
    node.play().catch(() => {});
  }

  function playHitSound(enemy, hitsLanded) {
    if (enemy.hitSounds && enemy.hitSounds.length) {
      const clip = enemy.hitSounds[Math.min(hitsLanded, enemy.hitSounds.length) - 1];
      if (clip) {
        playFileSound(clip);
        return;
      }
    }
    const cfg = enemy.sound || { wave: "square", freq: 240 };
    if (hitsLanded >= HITS_TO_DEFEAT) {
      playSynthTone(cfg, { pitchMult: 1.5, duration: 0.16, volume: 0.19 });
      playNoiseBurst({ duration: 0.07, volume: 0.16 });
    } else {
      playSynthTone(cfg, { pitchMult: 1 + (hitsLanded - 1) * 0.18, duration: 0.09, volume: 0.15 });
    }
  }

  function setMuted(next) {
    muted = next;
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-pressed", String(muted));
  }

  function loadHighScore(mode = gameMode) {
    const key = mode === "endless" ? ENDLESS_HIGH_SCORE_KEY : HIGH_SCORE_KEY;
    const stored = Number(localStorage.getItem(key)) || 0;
    highscoreEl.textContent = stored;
    return stored;
  }

  function isMobileDevice() {
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
    if (coarse && noHover) return true;
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
  }

  function applyModeLock() {
    const locked = isMobileDevice();
    startTimedBtn.disabled = locked;
    startTimedBtn.classList.toggle("mode-btn--locked", locked);
    timedLockNote.classList.toggle("overlay--hidden", !locked);
  }

  function startGame(requestedMode) {
    let resolvedMode = requestedMode === "endless" ? "endless" : "timed";
    // Timed Hunt is a PC-only mode; force Endless on touch/mobile devices
    // even if something manages to trigger the timed button directly.
    if (resolvedMode === "timed" && isMobileDevice()) {
      resolvedMode = "endless";
    }
    gameMode = resolvedMode;

    gameActive = true;
    score = 0;
    timeLeft = ROUND_SECONDS;
    survivalSeconds = 0;
    endlessDifficulty = 0;
    combo = 0;
    lastKillAt = performance.now();
    currentHp = maxHp;
    currentMp = maxMp;

    scoreEl.textContent = "0";
    timeLabelEl.textContent = gameMode === "endless" ? "SURVIVED" : "TIME";
    highscoreLabelEl.textContent = gameMode === "endless" ? "BEST (ENDLESS)" : "HIGH SCORE";
    loadHighScore(gameMode);
    timeEl.textContent = gameMode === "endless" ? "0" : String(timeLeft);
    timeEl.classList.remove("time-low");
    statusText.textContent =
      gameMode === "endless"
        ? "Endless Hunt: survive as long as you can!"
        : "Select or press Magic button to cast spells!";

    updateHpFill();
    updatePlayerStats();
    updateComboUI();
    closeSpellMenu();

    buildArena();
    slots.forEach((slot) => spawnEnemyInSlot(slot, { immediate: true }));

    startOverlay.classList.add("overlay--hidden");
    endOverlay.classList.add("overlay--hidden");

    clearInterval(countdownTimer);
    clearInterval(comboTickTimer);
    if (rafId) cancelAnimationFrame(rafId);

    countdownTimer = setInterval(() => {
      if (gameMode === "timed") {
        timeLeft -= 1;
        timeEl.textContent = String(Math.max(0, timeLeft));
        timeEl.classList.toggle("time-low", timeLeft <= 10);
        if (timeLeft <= 0) endGame();
      } else {
        survivalSeconds += 1;
        timeEl.textContent = String(survivalSeconds);
        if (
          survivalSeconds % ENDLESS_DIFFICULTY_INTERVAL_S === 0 &&
          endlessDifficulty < ENDLESS_DIFFICULTY_CAP
        ) {
          endlessDifficulty = Math.min(
            ENDLESS_DIFFICULTY_CAP,
            endlessDifficulty + ENDLESS_DIFFICULTY_STEP
          );
        }
      }
    }, 1000);

    comboTickTimer = setInterval(() => {
      if (combo > 0 && performance.now() - lastKillAt > COMBO_WINDOW_MS) {
        breakCombo();
      } else {
        updateComboUI();
      }
    }, 200);

    lastFrameTime = 0;
    rafId = requestAnimationFrame(animationLoop);
  }

  function endGame(message) {
    if (!gameActive) return;
    gameActive = false;

    clearInterval(countdownTimer);
    clearInterval(comboTickTimer);
    if (rafId) cancelAnimationFrame(rafId);
    closeSpellMenu();

    const storedHigh = loadHighScore(gameMode);
    const isNewBest = score > storedHigh;
    if (isNewBest) {
      const key = gameMode === "endless" ? ENDLESS_HIGH_SCORE_KEY : HIGH_SCORE_KEY;
      localStorage.setItem(key, String(score));
      highscoreEl.textContent = String(score);
    }

    endHeading.textContent = message || "TIME'S UP!";
    finalScoreEl.textContent = String(score);
    newBestNote.classList.toggle("overlay--hidden", !isNewBest);

    if (gameMode === "endless") {
      survivalTimeEl.textContent = String(survivalSeconds);
      survivalNote.classList.remove("overlay--hidden");
    } else {
      survivalNote.classList.add("overlay--hidden");
    }

    endOverlay.classList.remove("overlay--hidden");
  }

  function buildArena() {
    arena.innerHTML = "";
    slots = [];
    for (let i = 0; i < ARENA_SIZE; i++) {
      const slot = createSlot();
      arena.appendChild(slot.el);
      slots.push(slot);
    }
  }

  function createSlot() {
    const el = document.createElement("div");
    el.className = "enemy";
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");

    const inner = document.createElement("div");
    inner.className = "enemy-inner";

    const portraitWrap = document.createElement("div");
    portraitWrap.className = "enemy-portrait-wrap";
    const portrait = document.createElement("img");
    portrait.className = "enemy-portrait";
    portrait.alt = "";
    portraitWrap.appendChild(portrait);
    inner.appendChild(portraitWrap);
    el.appendChild(inner);

    const nameEl = document.createElement("div");
    nameEl.className = "enemy-name";
    el.appendChild(nameEl);

    const telegraphEl = document.createElement("div");
    telegraphEl.className = "enemy-telegraph";
    el.appendChild(telegraphEl);

    const pips = document.createElement("div");
    pips.className = "enemy-pips";
    const pipEls = [];
    for (let p = 0; p < HITS_TO_DEFEAT; p++) {
      const pip = document.createElement("span");
      pip.className = "pip";
      pips.appendChild(pip);
      pipEls.push(pip);
    }
    el.appendChild(pips);

    const slot = {
      el, inner, portrait, nameEl, pipEls, telegraphEl,
      hp: 0, enemy: null, locked: false,
      x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0,
      wanderRate: 0, freezeTimer: 0, stopTimer: 0, magnetTick: 0, aeroTick: 0,
      moving: true, attackTimer: Infinity, attacking: false, telegraphTimer: 0,
      preAttackVx: 0, preAttackVy: 0, cloakTimer: 0, speedBoostTimer: 0
    };

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

  function randomAttackInterval(enemy) {
    if (!enemy || !enemy.attack) return Infinity;
    const { cooldownMin = 5000, cooldownMax = 9000 } = enemy.attack;
    const base = cooldownMin + Math.random() * (cooldownMax - cooldownMin);
    if (gameMode === "endless" && endlessDifficulty > 0) {
      return base / (1 + endlessDifficulty * 0.6);
    }
    return base;
  }

  function updatePips(slot) {
    const hitsLanded = HITS_TO_DEFEAT - slot.hp;
    slot.pipEls.forEach((pip, i) => pip.classList.toggle("filled", i < hitsLanded));
  }

  function spawnEnemyInSlot(slot, { immediate = false } = {}) {
    const enemy = randomEnemy();
    slot.enemy = enemy;
    slot.hp = HITS_TO_DEFEAT;
    slot.locked = false;
    slot.moving = true;
    slot.attacking = false;
    slot.telegraphTimer = 0;
    slot.cloakTimer = 0;
    slot.freezeTimer = 0;
    slot.stopTimer = 0;
    slot.speedBoostTimer = 0;
    slot.magnetTick = 0;
    slot.aeroTick = 0;

    slot.telegraphEl.classList.remove("is-charging");
    slot.inner.classList.remove("is-cloaked", "is-frozen", "is-stopped", "is-defeated", "is-hit");
    slot.inner.style.removeProperty("--cloak-opacity");

    slot.portrait.src = enemy.image;
    slot.portrait.alt = enemy.name;
    slot.nameEl.textContent = enemy.name;
    slot.el.style.setProperty("--pip-color", enemy.tint);
    updatePips(slot);

    slot.attackTimer = randomAttackInterval(enemy);

    randomPositionFor(slot);
    randomVelocityFor(slot);
    placeSlot(slot);

    if (!immediate) {
      slot.inner.classList.add("is-spawning");
      setTimeout(() => slot.inner.classList.remove("is-spawning"), 300);
    }
  }

  function randomPositionFor(slot) {
    const arenaW = arena.clientWidth;
    const arenaH = arena.clientHeight;
    const w = slot.el.offsetWidth || slot.w || 120;
    const h = slot.el.offsetHeight || slot.h || 140;
    slot.w = w;
    slot.h = h;
    slot.x = Math.random() * Math.max(0, arenaW - w);
    slot.y = Math.random() * Math.max(0, arenaH - h);
  }

  function randomVelocityFor(slot) {
    const baseSpeed = (slot.enemy && slot.enemy.speed) || 60;
    const speed =
      gameMode === "endless" && endlessDifficulty > 0
        ? baseSpeed * (1 + endlessDifficulty)
        : baseSpeed;
    slot.wanderRate = 0.6 + Math.random() * 1.4;
    if (prefersReducedMotion) {
      slot.vx = 0;
      slot.vy = 0;
      return;
    }
    const angle = Math.random() * Math.PI * 2;
    slot.vx = Math.cos(angle) * speed;
    slot.vy = Math.sin(angle) * speed;
  }

  function nudgeHeading(slot, maxRadians) {
    const speed = Math.hypot(slot.vx, slot.vy);
    if (!speed) return;
    const angle = Math.atan2(slot.vy, slot.vx) + (Math.random() - 0.5) * 2 * maxRadians;
    slot.vx = Math.cos(angle) * speed;
    slot.vy = Math.sin(angle) * speed;
  }

  function placeSlot(slot) {
    slot.el.style.transform = `translate(${slot.x}px, ${slot.y}px)`;
  }

  // ---------- Movement & Spells Engine ----------

  function reflectProjectile(proj, barrier) {
    proj.reflected = true;
    if (proj.timeoutId) clearTimeout(proj.timeoutId);

    playSynthTone({ wave: "triangle", freq: 880 }, { pitchMult: 1.4, duration: 0.15, volume: 0.2, sweep: 1.5 });
    playNoiseBurst({ duration: 0.08, volume: 0.15 });

    let targetSlot = slots.find(s => s.hp > 0 && !s.locked);

    if (targetSlot) {
      const targetX = targetSlot.x + (targetSlot.w || 100) / 2;
      const targetY = targetSlot.y + (targetSlot.h || 100) / 2;

      proj.el.style.transition = "left 0.2s cubic-bezier(0.2,0.8,0.2,1), top 0.2s cubic-bezier(0.2,0.8,0.2,1), background 0.1s";
      proj.el.style.background = "#f4c95d";
      proj.el.style.boxShadow = "0 0 20px #ffffff, 0 0 10px #f4c95d";
      proj.el.style.left = `${targetX}px`;
      proj.el.style.top = `${targetY}px`;

      setTimeout(() => {
        if (proj.el.parentNode) proj.el.remove();
        activeProjectiles = activeProjectiles.filter(p => p !== proj);
        if (targetSlot && targetSlot.hp > 0 && !targetSlot.locked) {
          handleHit(targetSlot, { clientX: arena.getBoundingClientRect().left + targetX, clientY: arena.getBoundingClientRect().top + targetY });
        }
      }, 200);
    } else {
      if (proj.el.parentNode) proj.el.remove();
      activeProjectiles = activeProjectiles.filter(p => p !== proj);
    }
  }

function stepMovement(dt) {
    const arenaW = arena.clientWidth;
    const arenaH = arena.clientHeight;
    const arenaRect = arena.getBoundingClientRect();
    const now = performance.now();

    // Active spell barriers logic
    activeBarriers.forEach(b => {
      // 1. ADDED MAGNEGA HERE: Now Magnet follows the mouse just like Fire, Blizzard, Reflect, and Aero
      if (b.type === 'firaga' || b.type === 'blizzaga' || b.type === 'reflega' || b.type === 'aeroga' || b.type === 'magnega') {
        b.x = mouseX;
        b.y = mouseY;
        b.el.style.left = (b.x - b.radius) + 'px';
        b.el.style.top = (b.y - b.radius) + 'px';
      }

      // Check Reflect against enemy projectiles
      if (b.type === 'reflega') {
        activeProjectiles.forEach(proj => {
          if (proj.reflected) return;
          const progress = Math.min(1, (now - proj.startTime) / proj.duration);
          const px = proj.startX + (proj.targetX - proj.startX) * progress;
          const py = proj.startY + (proj.targetY - proj.startY) * progress;
          const dist = Math.hypot(px - b.x, py - b.y);

          if (dist <= b.radius + 15) {
            reflectProjectile(proj, b);
          }
        });
      }

      slots.forEach(slot => {
        if (slot.hp <= 0 || slot.locked) return;
        const w = slot.w || slot.el.offsetWidth;
        const h = slot.h || slot.el.offsetHeight;
        const scx = slot.x + w / 2;
        const scy = slot.y + h / 2;
        const dist = Math.hypot(scx - b.x, scy - b.y);

        if (dist < (w / 2 + b.radius)) {
          if (b.type === 'firaga') {
            slot.hp = 1;
            handleHit(slot, { clientX: arenaRect.left + scx, clientY: arenaRect.top + scy });
          } else if (b.type === 'blizzaga') {
            if (!slot.freezeTimer || slot.freezeTimer <= 0) {
              slot.freezeTimer = 3000 + (b.tier * 2000);
            }
          } else if (b.type === 'aeroga') {
            // 2. STRONGER AERO PUSH: Base push of 150 + 120 per tier
            const pushStrength = 150 + (b.tier * 120);
            const angle = Math.atan2(scy - b.y, scx - b.x);
            slot.x += Math.cos(angle) * pushStrength * dt;
            slot.y += Math.sin(angle) * pushStrength * dt;
            
            // 3. STRONGER AERO DAMAGE: Ticks faster at higher tiers
            const tickRate = 500 - (b.tier * 120); 
            if (!slot.aeroTick || now - slot.aeroTick > tickRate) {
              slot.aeroTick = now;
              handleHit(slot, { clientX: arenaRect.left + scx, clientY: arenaRect.top + scy });
            }
          }
        }

        // 4. MAGNET UPDATES: Pulls towards moving player center, stronger per tier
        if (b.type === 'magnega') {
          const pullRadius = 320 + (b.tier * 80); // Gets wider per tier
          if (dist < pullRadius) {
            const pullSpeed = (pullRadius - dist) * (1.2 + b.tier * 0.4);
            const angle = Math.atan2(b.y - scy, b.x - scx);
            slot.x += Math.cos(angle) * pullSpeed * dt;
            slot.y += Math.sin(angle) * pullSpeed * dt;

            const tickRate = 600 - (b.tier * 100); // Damages faster at higher tiers
            if (dist < 40 + (b.tier * 10) && (!slot.magnetTick || now - slot.magnetTick > tickRate)) {
              slot.magnetTick = now;
              handleHit(slot, { clientX: arenaRect.left + scx, clientY: arenaRect.top + scy });
            }
          }
        }
      });
    });

    for (const slot of slots) {
      if (slot.stopTimer && slot.stopTimer > 0) {
        slot.stopTimer -= dt * 1000;
        slot.inner.classList.add('is-stopped');
        continue;
      } else {
        slot.inner.classList.remove('is-stopped');
        slot.stopTimer = 0;
      }

      if (slot.freezeTimer && slot.freezeTimer > 0) {
        slot.freezeTimer -= dt * 1000;
        slot.inner.classList.add('is-frozen');
        continue;
      } else {
        slot.inner.classList.remove('is-frozen');
        slot.freezeTimer = 0;
      }

      if (!slot.moving || slot.locked) continue;

      const w = slot.w || slot.el.offsetWidth;
      const h = slot.h || slot.el.offsetHeight;
      const maxX = Math.max(0, arenaW - w);
      const maxY = Math.max(0, arenaH - h);

      if (!prefersReducedMotion && slot.wanderRate) {
        nudgeHeading(slot, slot.wanderRate * dt);
      }

      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;

      if (slot.x <= 0) { slot.x = 0; slot.vx = Math.abs(slot.vx); nudgeHeading(slot, 0.35); }
      else if (slot.x >= maxX) { slot.x = maxX; slot.vx = -Math.abs(slot.vx); nudgeHeading(slot, 0.35); }

      if (slot.y <= 0) { slot.y = 0; slot.vy = Math.abs(slot.vy); nudgeHeading(slot, 0.35); }
      else if (slot.y >= maxY) { slot.y = maxY; slot.vy = -Math.abs(slot.vy); nudgeHeading(slot, 0.35); }

      placeSlot(slot);
    }
  }
  
  function animationLoop(now) {
    if (!gameActive) return;
    const dt = lastFrameTime ? Math.min(0.05, (now - lastFrameTime) / 1000) : 0;
    lastFrameTime = now;
    stepMovement(dt);
    stepEnemyAttacks(dt);
    rafId = requestAnimationFrame(animationLoop);
  }

  function cancelAttackWindup(slot, { restoreVelocity = true } = {}) {
    slot.attacking = false;
    slot.telegraphTimer = 0;
    slot.telegraphEl.classList.remove("is-charging");
    if (restoreVelocity) {
      slot.vx = slot.preAttackVx;
      slot.vy = slot.preAttackVy;
    }
  }

  function stepEnemyAttacks(dt) {
    for (const slot of slots) {
      if (!slot.enemy || slot.hp <= 0 || slot.locked) continue;

      if (slot.cloakTimer > 0) {
        slot.cloakTimer -= dt * 1000;
        if (slot.cloakTimer <= 0) {
          slot.cloakTimer = 0;
          slot.inner.classList.remove("is-cloaked");
        }
      }
      if (slot.speedBoostTimer > 0) {
        slot.speedBoostTimer -= dt * 1000;
        if (slot.speedBoostTimer <= 0) {
          slot.speedBoostTimer = 0;
          randomVelocityFor(slot);
        }
      }

      if (!slot.enemy.attack || slot.freezeTimer > 0 || slot.stopTimer > 0) continue;

      if (slot.attacking) {
        slot.telegraphTimer -= dt * 1000;
        if (slot.telegraphTimer <= 0) {
          slot.attacking = false;
          slot.telegraphEl.classList.remove("is-charging");
          executeEnemyAttack(slot);
          slot.attackTimer = randomAttackInterval(slot.enemy);
        }
      } else {
        slot.attackTimer -= dt * 1000;
        if (slot.attackTimer <= 0) {
          const atk = slot.enemy.attack;
          slot.attacking = true;
          slot.telegraphTimer = atk.telegraph;
          slot.telegraphEl.style.setProperty("--atk-color", atk.color);
          slot.telegraphEl.classList.add("is-charging");
          slot.preAttackVx = slot.vx;
          slot.preAttackVy = slot.vy;
          slot.vx *= 0.15;
          slot.vy *= 0.15;
          playSynthTone({ wave: "triangle", freq: 700 }, { pitchMult: 1, duration: 0.12, volume: 0.07, sweep: 1.3 });
        }
      }
    }
  }

  function fireProjectile(slot, atk) {
    const w = slot.w || slot.el.offsetWidth;
    const h = slot.h || slot.el.offsetHeight;
    const startX = slot.x + w / 2;
    const startY = slot.y + h / 2;
    const targetX = mouseX;
    const targetY = mouseY;

    const el = document.createElement("div");
    el.className = "enemy-projectile";
    el.style.setProperty("--proj-color", atk.color || "var(--danger)");
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    arena.appendChild(el);

    const speed = 480;
    const dist = Math.hypot(targetX - startX, targetY - startY);
    const duration = Math.max(220, (dist / speed) * 1000);

    requestAnimationFrame(() => {
      el.style.transition = `left ${duration}ms linear, top ${duration}ms linear`;
      el.style.left = `${targetX}px`;
      el.style.top = `${targetY}px`;
    });

    const projectile = {
      el, startX, startY, targetX, targetY,
      startTime: performance.now(), duration, reflected: false
    };
    activeProjectiles.push(projectile);

    const timeoutId = setTimeout(() => {
      if (projectile.reflected) return;
      if (el.parentNode) el.remove();
      activeProjectiles = activeProjectiles.filter((p) => p !== projectile);
      if (!gameActive) return;

      const hitRadius = 42;
      const playerDist = Math.hypot(mouseX - targetX, mouseY - targetY);
      if (playerDist < hitRadius) {
        damagePlayer(atk.power);
        showArenaFloater(targetX, targetY, `-${atk.power} HP`, "var(--danger)");
      } else {
        showArenaFloater(targetX, targetY, "Dodged!", "var(--cyan)");
      }
    }, duration);

    projectile.timeoutId = timeoutId;
  }

  function executeEnemyAttack(slot) {
    const atk = slot.enemy.attack;
    if (!atk) return;

    switch (atk.type) {
      case "cloak": {
        slot.inner.classList.add("is-cloaked");
        slot.inner.style.setProperty("--cloak-opacity", atk.power);
        slot.cloakTimer = 2800;
        showFloater(slot, atk.name);
        playNoiseBurst({ duration: 0.12, volume: 0.1 });
        statusText.textContent = `${slot.enemy.name} melts into shadow!`;
        break;
      }
      case "mp-drain": {
        const amt = atk.power;
        currentMp = Math.max(0, currentMp - amt);
        mpFillEl.style.width = `${(currentMp / maxMp) * 100}%`;
        mpFillEl.classList.add("mp-empty");
        setTimeout(() => mpFillEl.classList.remove("mp-empty"), 300);
        showFloater(slot, `-${amt} MP`);
        statusText.textContent = `${slot.enemy.name} siphons your mana!`;
        playSynthTone({ wave: "sine", freq: 200 }, { pitchMult: 0.6, duration: 0.3, volume: 0.15, sweep: 0.5 });
        break;
      }
      case "combo-break": {
        if (combo > 0) {
          showFloater(slot, "Combo Broken!");
          breakCombo(`${slot.enemy.name} lets out a wail — combo shattered!`);
        } else {
          showFloater(slot, atk.name);
        }
        playNoiseBurst({ duration: 0.18, volume: 0.15 });
        break;
      }
      case "dodge": {
        randomPositionFor(slot);
        randomVelocityFor(slot);
        slot.vx *= atk.power;
        slot.vy *= atk.power;
        slot.speedBoostTimer = 2000;
        showFloater(slot, atk.name);
        playSynthTone({ wave: "sawtooth", freq: 600 }, { pitchMult: 1, duration: 0.1, volume: 0.12, sweep: 0.3 });
        statusText.textContent = `${slot.enemy.name} warps away!`;
        break;
      }
      case "time-steal": {
        if (gameMode === "endless") {
          // Doesn't make sense against a count-up survival clock — bite score instead.
          const stolen = Math.min(score, atk.power * 5);
          score -= stolen;
          scoreEl.textContent = score;
          showFloater(slot, `-${stolen} pts`);
          statusText.textContent = `${slot.enemy.name} burns away your points!`;
          playSynthTone({ wave: "square", freq: 150 }, { pitchMult: 1, duration: 0.25, volume: 0.15, sweep: 0.4 });
          break;
        }
        timeLeft = Math.max(0, timeLeft - atk.power);
        timeEl.textContent = timeLeft;
        timeEl.classList.toggle("time-low", timeLeft <= 10);
        showFloater(slot, `-${atk.power}s`);
        statusText.textContent = `${slot.enemy.name} burns away precious seconds!`;
        playSynthTone({ wave: "square", freq: 150 }, { pitchMult: 1, duration: 0.25, volume: 0.15, sweep: 0.4 });
        if (timeLeft <= 0) endGame();
        break;
      }
      case "score-steal": {
        const stolen = Math.min(score, atk.power);
        score -= stolen;
        scoreEl.textContent = score;
        showFloater(slot, `-${stolen} pts`);
        statusText.textContent = `${slot.enemy.name} siphons your score into the void!`;
        playSynthTone({ wave: "sine", freq: 500 }, { pitchMult: 1, duration: 0.2, volume: 0.12, sweep: 0.4 });
        break;
      }
      case "projectile": {
        showFloater(slot, atk.name);
        statusText.textContent = `${slot.enemy.name} fires ${atk.name}!`;
        fireProjectile(slot, atk);
        break;
      }
    }
  }

  // ---------- Hit Handling ----------

  function handleHit(slot, evt) {
    if (!gameActive || !slot.enemy || slot.hp <= 0 || slot.locked) return;

    const enemy = slot.enemy;
    if (slot.attacking) cancelAttackWindup(slot);

    slot.hp -= 1;
    const hitsLanded = HITS_TO_DEFEAT - slot.hp;
    updatePips(slot);

    slot.inner.classList.remove("is-hit");
    void slot.inner.offsetWidth;
    slot.inner.classList.add("is-hit");

    playHitSound(enemy, hitsLanded);

    const w = slot.w || slot.el.offsetWidth;
    const h = slot.h || slot.el.offsetHeight;
    spawnStarBurst(slot.x + w / 2, slot.y + h / 2, enemy.tint);

    combo += 1;
    lastKillAt = performance.now();
    const tier = getComboTier(combo);
    updateComboUI();

    if (slot.hp <= 0) {
      slot.locked = true;
      slot.moving = false;
      slot.inner.classList.add("is-defeated");

      const pts = Math.round(enemy.points * tier.mult);
      score += pts;
      scoreEl.textContent = score;
      showFloater(slot, `+${pts}`, enemy.tint);
      statusText.textContent = `${enemy.name} defeated!`;

      playerXp += enemy.points;
      localStorage.setItem(XP_KEY, String(playerXp));
      updatePlayerStats();

      setTimeout(() => {
        if (!gameActive) return;
        spawnEnemyInSlot(slot);
      }, 340);
    } else {
      const pts = Math.max(1, Math.round(HIT_BASE_SCORE * tier.mult));
      score += pts;
      scoreEl.textContent = score;
      showFloater(slot, `+${pts}`);
      statusText.textContent = `Hit ${enemy.name}!`;
    }
  }

  // ---------- Spells Casting ----------

  function spawnBarrier(type, radius, tier, duration = 3000) {
    const el = document.createElement('div');
    el.className = `barrier ${type}-barrier`;
    el.style.width = (radius * 2) + 'px';
    el.style.height = (radius * 2) + 'px';
    arena.appendChild(el);

    const b = { el, type, radius, tier, x: mouseX, y: mouseY };
    activeBarriers.push(b);

    setTimeout(() => {
      // Reflect barrier blast on expiration
      if (type === 'reflega') {
        const shatter = document.createElement('div');
        shatter.className = 'reflect-shatter';
        shatter.style.left = (b.x - radius * 1.3) + 'px';
        shatter.style.top = (b.y - radius * 1.3) + 'px';
        shatter.style.width = (radius * 2.6) + 'px';
        shatter.style.height = (radius * 2.6) + 'px';
        arena.appendChild(shatter);
        setTimeout(() => shatter.remove(), 350);

        playSynthTone({ wave: "sine", freq: 650 }, { pitchMult: 1.5, duration: 0.25, volume: 0.2, sweep: 1.8 });

        slots.forEach(s => {
          if (s.hp > 0 && !s.locked) {
            const scx = s.x + (s.w || 100) / 2;
            const scy = s.y + (s.h || 100) / 2;
            if (Math.hypot(scx - b.x, scy - b.y) <= radius * 1.4) {
              handleHit(s, { clientX: arena.getBoundingClientRect().left + scx, clientY: arena.getBoundingClientRect().top + scy });
            }
          }
        });
      }

      el.remove();
      activeBarriers = activeBarriers.filter(bar => bar !== b);
    }, duration);
  }

  function castSpell(spellIndex) {
    const cost = BASE_SPELL_COSTS[spellIndex] * getMagicTier();
    if (!drainMp(cost)) {
      statusText.textContent = "Not enough MP!";
      return;
    }

    const tier = getMagicTier();
    const spellName = getSpellName(spellIndex);
    statusText.textContent = `Cast ${spellName}!`;

    switch (spellIndex) {
      case 0: // Fire
        spawnBarrier('firaga', 60 + tier * 27, tier);
        playSynthTone({ wave: "sawtooth", freq: 280 }, { pitchMult: 1.2, duration: 0.5, volume: 0.18, sweep: 0.6 });
        break;
      case 1: // Blizzard
        spawnBarrier('blizzaga', 80 + tier * 29, tier);
        playSynthTone({ wave: "sine", freq: 600 }, { pitchMult: 1.4, duration: 0.3, volume: 0.15, sweep: 0.8 });
        break;
      case 2: // Thunder
        castThunder(tier);
        break;
      case 3: // Cure
        castCure(tier);
        break;
      case 4: // Reflect
        spawnBarrier('reflega', 70 + tier * 20, tier, 2500);
        playSynthTone({ wave: "triangle", freq: 520 }, { pitchMult: 1.3, duration: 0.2, volume: 0.2, sweep: 1.2 });
        break;
      case 5: // Magnet
        spawnBarrier('magnega', 90 + tier * 25, tier, 3500);
        playSynthTone({ wave: "sine", freq: 180 }, { pitchMult: 0.8, duration: 0.35, volume: 0.18, sweep: 1.4 });
        break;
      case 6: // Stop
        castStop(tier);
        break;
      case 7: // Aero
        spawnBarrier('aeroga', 75 + tier * 20, tier, 4000);
        playSynthTone({ wave: "sawtooth", freq: 340 }, { pitchMult: 1.1, duration: 0.6, volume: 0.16, sweep: 1.5 });
        break;
    }
  }

function castThunder(tier) {
    const targetCount = Math.min(slots.length, tier + 2);
    const shuffled = [...slots].sort(() => 0.5 - Math.random());
    const targets = shuffled.slice(0, targetCount);

    targets.forEach((slot, index) => {
      setTimeout(() => {
        if (!gameActive) return;
        const bolt = document.createElement('div');
        bolt.className = 'thundaga-bolt';
        const w = slot.w || 100;
        
        // 5. THUNDER BIGGER: Visual width increases with tier
        const boltWidth = 30 + (tier * 20); 
        bolt.style.width = boltWidth + 'px';
        bolt.style.height = '100%';
        bolt.style.left = (slot.x + w / 2 - (boltWidth / 2)) + 'px';
        bolt.style.top = '0';
        arena.appendChild(bolt);

        playSynthTone({ wave: "square", freq: 400 - (tier * 20) }, { pitchMult: 1.5, duration: 0.15, volume: 0.15 + (tier * 0.05), sweep: 0.3 });
        
        // 6. THUNDER STRONGER: Hits multiple times based on tier (Thundaga hits 3 times)
        for (let hit = 0; hit < tier; hit++) {
           setTimeout(() => {
              if (slot.hp > 0 && !slot.locked) {
                 handleHit(slot, { clientX: arena.getBoundingClientRect().left + slot.x, clientY: arena.getBoundingClientRect().top + slot.y });
              }
           }, hit * 100);
        }

        setTimeout(() => bolt.remove(), 300 + (tier * 50));
      }, index * 100);
    });
  }

  function castCure(tier) {
    const healAmount = 25 * tier;
    healPlayer(healAmount);
    showArenaFloater(mouseX, mouseY, `+${healAmount} HP`, "var(--hp-color)");
    playSynthTone({ wave: "sine", freq: 520 }, { pitchMult: 1.5, duration: 0.3, volume: 0.2, sweep: 1.2 });
  }

  function castStop(tier) {
    const duration = 3500 + tier * 1000;
    playSynthTone({ wave: "triangle", freq: 800 }, { pitchMult: 0.5, duration: 0.4, volume: 0.2, sweep: 0.3 });
    playNoiseBurst({ duration: 0.12, volume: 0.15 });

    slots.forEach(slot => {
      if (slot.hp > 0 && !slot.locked) {
        slot.stopTimer = duration;
        showFloater(slot, "STOP!", "var(--gold)");
      }
    });
  }

  function updateSpellMenu() {
    const items = spellMenuEl.querySelectorAll('.spell-item');
    items.forEach((item, idx) => {
      item.textContent = getSpellName(idx);
      item.classList.toggle('selected', idx === currentSpellIndex);
    });
  }

  function openSpellMenu(clientX = mouseX, clientY = mouseY) {
    spellMenuOpen = true;
    updateSpellMenu();
    spellMenuEl.style.left = `${Math.max(8, Math.min(window.innerWidth - 180, clientX + 16))}px`;
    spellMenuEl.style.top = `${Math.max(8, Math.min(window.innerHeight - 300, clientY + 16))}px`;
    spellMenuEl.classList.remove('overlay--hidden');
  }

  function closeSpellMenu() {
    spellMenuOpen = false;
    spellMenuEl.classList.add('overlay--hidden');
  }

  // Spell Menu Interaction
  spellMenuEl.addEventListener("click", (e) => {
    const item = e.target.closest(".spell-item");
    if (!item) return;
    const items = Array.from(spellMenuEl.querySelectorAll(".spell-item"));
    const idx = items.indexOf(item);
    if (idx !== -1) {
      currentSpellIndex = idx;
      castSpell(currentSpellIndex);
      closeSpellMenu();
    }
  });

  arena.addEventListener('contextmenu', (e) => {
    if (!gameActive) return;
    e.preventDefault();
    const rect = arena.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    openSpellMenu(e.clientX, e.clientY);
  });

  window.addEventListener('keydown', (e) => {
    if (!gameActive) return;

    if (e.key === 'q' || e.key === 'Q') {
      if (spellMenuOpen) closeSpellMenu();
      else openSpellMenu(e.clientX, e.clientY);
    } else if (spellMenuOpen) {
      if (e.key === 'ArrowDown') {
        currentSpellIndex = (currentSpellIndex + 1) % BASE_SPELLS.length;
        updateSpellMenu();
      } else if (e.key === 'ArrowUp') {
        currentSpellIndex = (currentSpellIndex - 1 + BASE_SPELLS.length) % BASE_SPELLS.length;
        updateSpellMenu();
      } else if (e.key === 'Enter') {
        castSpell(currentSpellIndex);
        closeSpellMenu();
      } else if (e.key === 'Escape') {
        closeSpellMenu();
      }
    }
  });

  magicBtn.addEventListener("click", (e) => {
    if (!gameActive) return;
    if (spellMenuOpen) {
      closeSpellMenu();
    } else {
      const rect = magicBtn.getBoundingClientRect();
      openSpellMenu(rect.left, rect.top);
    }
  });

  document.addEventListener("click", (e) => {
    if (!spellMenuOpen) return;
    if (spellMenuEl.contains(e.target) || e.target === magicBtn) return;
    closeSpellMenu();
  });

  muteBtn.addEventListener("click", () => setMuted(!muted));

  startTimedBtn.addEventListener("click", () => startGame("timed"));
  startEndlessBtn.addEventListener("click", () => startGame("endless"));
  restartBtn.addEventListener("click", () => startGame(gameMode));
  menuBtn.addEventListener("click", () => {
    endOverlay.classList.add("overlay--hidden");
    startOverlay.classList.remove("overlay--hidden");
  });

  // ---------- Init ----------
  setMuted(muted);
  applyModeLock();
  loadHighScore(gameMode);
  updatePlayerStats();
  updateHpFill();
  updateComboUI();

})();
