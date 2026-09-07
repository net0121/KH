(() => {
  "use strict";

  // ---------- Config ----------
  const ROUND_SECONDS = 60;
  const COMBO_WINDOW_MS = 5000;
  const HIT_BASE_SCORE = 3;
  const HIGH_SCORE_KEY = "keyOfLightHighScore";
  const MUTED_KEY = "keyOfLightMuted";
  const XP_KEY = "keyOfLightXP";
  
  const BASE_SPELL_COSTS = [10, 15, 20, 15];

  const COMBO_TIERS = [
    { min: 0, mult: 1, color: "var(--magenta)" },
    { min: 5, mult: 1.5, color: "var(--cyan)" },
    { min: 10, mult: 2, color: "var(--gold)" },
    { min: 20, mult: 3, color: "#ff8a3d" },
    { min: 35, mult: 4, color: "#ff5c5c" }
  ];

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Mouse Tracking ----------
  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener("mousemove", (e) => {
    const rect = arena.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  // ---------- Spells & Magic Tiers ----------
  const BASE_SPELLS = ['Fire', 'Blizzard', 'Thunder', 'Reflect'];
  let currentSpellIndex = 0;
  let spellMenuOpen = false;
  let activeBarriers = [];
  let activeProjectiles = [];

  // ---------- DOM ----------
  const arena = document.getElementById("arena");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const comboCountEl = document.getElementById("comboCount");
  const comboFillEl = document.getElementById("comboFill");
  const statusText = document.getElementById("statusText");
  const highscoreEl = document.getElementById("highscore");
  const muteBtn = document.getElementById("muteBtn");

  const startOverlay = document.getElementById("startOverlay");
  const endOverlay = document.getElementById("endOverlay");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const endHeading = document.getElementById("endHeading");
  const finalScoreEl = document.getElementById("finalScore");
  const newBestNote = document.getElementById("newBestNote");

  const spellMenuEl = document.getElementById("spellMenu");
  const levelDisplayEl = document.getElementById("levelDisplay");
  const xpFillEl = document.getElementById("xpFill");
  const mpFillEl = document.getElementById("mpFill");

  // ---------- State ----------
  let score = 0;
  let timeLeft = ROUND_SECONDS;
  let combo = 0;
  let lastKillAt = 0;
  let gameActive = false;
  let countdownTimer = null;
  let comboTickTimer = null;
  let rafId = null;
  let lastFrameTime = 0;
  let slots = [];
  let muted = localStorage.getItem(MUTED_KEY) === "1";

  // RPG State
  let playerXp = Number(localStorage.getItem(XP_KEY)) || 0;
  let playerLevel = 1;
  let maxMp = 100;
  let currentMp = 100;

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
      ['Reflect', 'Reflera', 'Reflega']
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

  // ================================================================
  // AUDIO
  // ================================================================
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
    const hz = freq * pitchMult;
    osc.frequency.setValueAtTime(hz, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(hz * sweep, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playHtmlAudio(url, vol = 0.4) {
    if (muted || !url) return;
    let pool = audioElCache.get(url);
    if (!pool) { pool = []; audioElCache.set(url, pool); }
    let audio = pool.find(a => a.paused || a.ended);
    if (!audio) {
      audio = new Audio(url);
      pool.push(audio);
    }
    audio.currentTime = 0;
    audio.volume = vol;
    audio.play().catch(() => {});
  }

  // ================================================================
  // MENU & SPELLS
  // ================================================================
  const localHigh = localStorage.getItem(HIGH_SCORE_KEY);
  if (localHigh) highscoreEl.textContent = localHigh;

  function updateMuteBtn() {
    muteBtn.setAttribute("aria-pressed", muted);
    muteBtn.textContent = muted ? "🔇" : "🔊";
  }
  updateMuteBtn();

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    updateMuteBtn();
    if (!muted) getAudioCtx();
  });

  document.addEventListener("contextmenu", (e) => {
    if (gameActive) {
      e.preventDefault();
      openSpellMenu(e.clientX, e.clientY);
    }
  });

  const magicBtn = document.getElementById("magicBtn");
  magicBtn.addEventListener("click", (e) => {
    if (!gameActive) return;
    e.stopPropagation();
    openSpellMenu(window.innerWidth / 2 - 100, window.innerHeight - 200);
  });

  document.addEventListener("click", (e) => {
    if (spellMenuOpen && !spellMenuEl.contains(e.target) && e.target !== magicBtn) {
      closeSpellMenu();
    }
  });

  spellMenuEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.deltaY > 0) cycleSpell(1);
    else cycleSpell(-1);
  });

  function openSpellMenu(x, y) {
    spellMenuOpen = true;
    spellMenuEl.classList.remove("overlay--hidden");
    
    const items = spellMenuEl.querySelectorAll(".spell-item");
    items.forEach((el, i) => {
      el.textContent = getSpellName(i);
      el.classList.toggle("selected", i === currentSpellIndex);
    });

    const mw = spellMenuEl.offsetWidth;
    const mh = spellMenuEl.offsetHeight;
    const tx = Math.max(10, Math.min(x, window.innerWidth - mw - 10));
    const ty = Math.max(10, Math.min(y, window.innerHeight - mh - 10));
    spellMenuEl.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  function closeSpellMenu() {
    spellMenuOpen = false;
    spellMenuEl.classList.add("overlay--hidden");
  }

  function cycleSpell(dir) {
    currentSpellIndex = (currentSpellIndex + dir + BASE_SPELLS.length) % BASE_SPELLS.length;
    const items = spellMenuEl.querySelectorAll(".spell-item");
    items.forEach((el, i) => el.classList.toggle("selected", i === currentSpellIndex));
  }

  document.addEventListener("keydown", (e) => {
    if (!gameActive) return;
    if (e.key >= '1' && e.key <= '4') {
      const idx = parseInt(e.key) - 1;
      currentSpellIndex = idx;
      castSpell(idx);
    }
  });

  function castSpell(spellIndex) {
    if (spellMenuOpen) closeSpellMenu();
    
    const magicTier = getMagicTier();
    const cost = BASE_SPELL_COSTS[spellIndex];
    if (!drainMp(cost)) {
      statusText.textContent = "Not enough MP!";
      playSynthTone({ wave: "sawtooth", freq: 110 }, { duration: 0.1, sweep: 0.9, pitchMult: 1 });
      return;
    }

    const sName = getSpellName(spellIndex);
    statusText.textContent = `Cast ${sName}!`;
    playSynthTone({ wave: "sine", freq: 600 + (spellIndex*100) }, { duration: 0.2, pitchMult: 1.5, sweep: 2.0 });

    if (spellIndex === 0) spawnBarrier('firaga', 120 + (magicTier * 20), magicTier);
    else if (spellIndex === 1) spawnBarrier('blizzaga', 180 + (magicTier * 40), magicTier);
    else if (spellIndex === 2) castThunder(magicTier);
    else if (spellIndex === 3) spawnBarrier('reflega', 120 + (magicTier * 20), magicTier);
  }

  function spawnBarrier(type, durationFrames, tier) {
    const el = document.createElement("div");
    el.className = `barrier ${type}-barrier`;
    const radius = type === 'blizzaga' ? (120 + tier * 30) : (80 + tier * 20);
    el.style.width = `${radius * 2}px`;
    el.style.height = `${radius * 2}px`;
    el.style.left = `${mouseX - radius}px`;
    el.style.top = `${mouseY - radius}px`;
    arena.appendChild(el);

    activeBarriers.push({ type, el, x: mouseX, y: mouseY, radius, framesLeft: durationFrames, tier });
  }

  function castThunder(tier) {
    const targets = [...slots].filter(s => s.hp > 0 && !s.locked).slice(0, 2 + tier);
    targets.forEach(slot => {
      const w = slot.w || slot.el.offsetWidth;
      const h = slot.h || slot.el.offsetHeight;
      const tcx = slot.x + w/2;
      const tcy = slot.y + h/2;

      const bolt = document.createElement("div");
      bolt.className = "thundaga-bolt";
      bolt.style.width = "40px";
      bolt.style.height = "150%";
      bolt.style.left = `${tcx - 20}px`;
      bolt.style.bottom = `${arena.offsetHeight - tcy}px`;
      arena.appendChild(bolt);

      setTimeout(() => bolt.remove(), 300);
      handleHit(slot, { clientX: tcx + arena.getBoundingClientRect().left, clientY: tcy + arena.getBoundingClientRect().top });
    });
  }

  function updateBarriers() {
    for (let i = activeBarriers.length - 1; i >= 0; i--) {
      const b = activeBarriers[i];
      b.framesLeft--;
      if (b.framesLeft <= 0) {
        b.el.remove();
        activeBarriers.splice(i, 1);
        continue;
      }
      if (b.type === 'firaga') {
        b.el.style.left = `${mouseX - b.radius}px`;
        b.el.style.top = `${mouseY - b.radius}px`;
        b.x = mouseX;
        b.y = mouseY;
        checkBarrierCollisions(b);
      } else if (b.type === 'blizzaga') {
        checkBarrierCollisions(b);
      }
    }
  }

  function checkBarrierCollisions(b) {
    for (const slot of slots) {
      if (slot.hp <= 0 || slot.locked) continue;
      const w = slot.w || slot.el.offsetWidth;
      const h = slot.h || slot.el.offsetHeight;
      const scx = slot.x + w / 2;
      const scy = slot.y + h / 2;
      const dist = Math.hypot(b.x - scx, b.y - scy);
      
      if (dist < (b.radius + w/2)) {
        if (b.type === 'firaga' && !slot.fireCooldown) {
          handleHit(slot, { clientX: b.x + arena.getBoundingClientRect().left, clientY: b.y + arena.getBoundingClientRect().top });
          slot.fireCooldown = 30;
        } else if (b.type === 'blizzaga') {
          slot.freezeTimer = 180 + (b.tier * 60);
          slot.inner.classList.add("is-frozen");
        }
      }
    }
  }

  // ================================================================
  // COMBAT & GAMEPLAY
  // ================================================================
  function getActiveTier() {
    let t = COMBO_TIERS[0];
    for (const c of COMBO_TIERS) {
      if (combo >= c.min) t = c;
    }
    return t;
  }

  function handleHit(slot, event) {
    if (slot.locked) return;
    
    getAudioCtx();
    const enemyData = slot.enemyData;
    const tier = getActiveTier();

    slot.inner.classList.remove("is-hit");
    void slot.inner.offsetWidth;
    slot.inner.classList.add("is-hit");

    // Play hit sound based on remaining hits or fallback to synth
    const hitIndex = HITS_TO_DEFEAT - slot.hp;
    if (enemyData.hitSounds && enemyData.hitSounds[hitIndex]) {
      playHtmlAudio(enemyData.hitSounds[hitIndex], 0.4);
    } else {
      playSynthTone(enemyData.sound || { wave: "triangle", freq: 440 }, { duration: 0.15, sweep: 1.5 });
    }

    slot.hp -= 1;
    updatePips(slot);
    spawnHitEffect(event.clientX, event.clientY, tier.color);

    if (slot.hp <= 0) {
      destroyEnemy(slot);
    }
  }

  function breakCombo(reason = "Combo dropped!") {
    if (combo > 0) {
      statusText.textContent = reason;
      combo = 0;
      comboCountEl.textContent = `×${combo}`;
      comboCountEl.style.color = "var(--magenta)";
      comboFillEl.style.width = "0%";
      playSynthTone({ wave: "sawtooth", freq: 150 }, { duration: 0.3, sweep: 0.5 });
    }
  }

  function updateComboTick() {
    if (!gameActive || combo === 0) {
      comboFillEl.style.width = "0%";
      return;
    }
    const now = performance.now();
    const elapsed = now - lastKillAt;
    const remaining = COMBO_WINDOW_MS - elapsed;
    if (remaining <= 0) breakCombo();
    else comboFillEl.style.width = `${(remaining / COMBO_WINDOW_MS) * 100}%`;
  }

  function updateScore(amount) {
    score += amount;
    scoreEl.textContent = score;
    scoreEl.style.transform = "scale(1.3)";
    setTimeout(() => { scoreEl.style.transform = "scale(1)"; }, 150);
  }

  function destroyEnemy(slot) {
    const enemyData = slot.enemyData;
    slot.locked = true;
    slot.inner.classList.remove("is-hit");
    slot.inner.classList.add("is-defeated");
    slot.el.classList.add("is-defeated");

    // Play final defeat sound if available
    if (enemyData.hitSounds && enemyData.hitSounds[2]) {
      playHtmlAudio(enemyData.hitSounds[2], 0.6);
    } else {
      playSynthTone({ wave: "square", freq: 110 }, { duration: 0.25, sweep: 0.5 });
    }

    combo++;
    lastKillAt = performance.now();
    
    playerXp += 5;
    updatePlayerStats();
    restoreMp(5 + getMagicTier());

    const tier = getActiveTier();
    comboCountEl.textContent = `×${combo}`;
    comboCountEl.style.color = tier.color;

    const gained = enemyData.points * tier.mult;
    updateScore(gained);

    const rect = slot.el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    spawnFloatingText(centerX, rect.top, `+${gained}`, tier.color);

    if (!prefersReducedMotion) {
      spawnDefeatSparks(centerX, rect.top + rect.height / 2, tier.color, 3 + Math.floor(combo / 10));
    }

    statusText.textContent = `Defeated ${enemyData.name}!`;

    setTimeout(() => {
      slot.el.remove();
      if (gameActive) respawnSlot(slot);
    }, 400);
  }

  function spawnHitEffect(x, y, color) {
    if (prefersReducedMotion) return;
    const flash = document.createElement("div");
    flash.style.position = "fixed";
    flash.style.left = `${x}px`;
    flash.style.top = `${y}px`;
    flash.style.width = "40px";
    flash.style.height = "40px";
    flash.style.background = `radial-gradient(circle, #fff 10%, ${color} 40%, transparent 70%)`;
    flash.style.borderRadius = "50%";
    flash.style.transform = "translate(-50%, -50%) scale(0.2)";
    flash.style.pointerEvents = "none";
    flash.style.zIndex = "99";
    document.body.appendChild(flash);

    flash.animate([
      { transform: "translate(-50%, -50%) scale(0.2)", opacity: 1 },
      { transform: "translate(-50%, -50%) scale(1.5)", opacity: 0 }
    ], { duration: 250, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }).onfinish = () => flash.remove();
  }

  function spawnFloatingText(x, y, text, color) {
    if (prefersReducedMotion) return;
    const f = document.createElement("div");
    f.className = "floater";
    f.textContent = text;
    f.style.color = color;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 750);
  }

  function spawnDefeatSparks(cx, cy, color, count) {
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("div");
      spark.className = "star-particle";
      spark.style.setProperty("--star-color", color);
      spark.style.setProperty("--x", `${cx}px`);
      spark.style.setProperty("--y", `${cy}px`);
      
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      spark.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      spark.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      spark.style.setProperty("--rot", `${-100 + Math.random() * 200}deg`);
      spark.style.setProperty("--end-scale", `${0.2 + Math.random() * 0.4}`);
      spark.style.setProperty("--size", `${8 + Math.random() * 6}px`);
      
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 600);
    }
  }

  // ================================================================
  // ENEMY SETUP & MOVEMENT
  // ================================================================
  function createEnemyEl(enemyData) {
    const wrap = document.createElement("div");
    wrap.className = "enemy";
    wrap.style.setProperty("--pip-color", enemyData.tint || "var(--magenta)");

    const inner = document.createElement("div");
    inner.className = "enemy-inner is-spawning";
    inner.addEventListener("animationend", (e) => {
      if (e.animationName === "spawnin") inner.classList.remove("is-spawning");
    });

    const imgWrap = document.createElement("div");
    imgWrap.className = "enemy-portrait-wrap";

    const img = document.createElement("img");
    img.src = enemyData.image;
    img.className = "enemy-portrait";
    img.draggable = false;
    img.alt = "";

    const nameLab = document.createElement("div");
    nameLab.className = "enemy-name";
    nameLab.textContent = enemyData.name;

    const pips = document.createElement("div");
    pips.className = "enemy-pips";
    for (let i = 0; i < HITS_TO_DEFEAT; i++) {
      const p = document.createElement("div");
      p.className = "pip filled";
      pips.appendChild(p);
    }

    imgWrap.appendChild(img);
    inner.appendChild(imgWrap);
    wrap.appendChild(inner);
    wrap.appendChild(nameLab);
    wrap.appendChild(pips);

    return wrap;
  }

  function updatePips(slot) {
    const pips = slot.el.querySelectorAll(".pip");
    pips.forEach((p, idx) => { p.classList.toggle("filled", idx < slot.hp); });
  }

  function getRandomEnemyData() {
    const index = Math.floor(Math.random() * ENEMY_ROSTER.length);
    return ENEMY_ROSTER[index];
  }

  function spawnSlot(idx) {
    const enemyData = getRandomEnemyData();
    const el = createEnemyEl(enemyData);
    arena.appendChild(el);

    const aw = arena.clientWidth;
    const ah = arena.clientHeight;
    const compW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--enemy-w')) || 128;
    
    const x = Math.max(0, Math.random() * (aw - compW));
    const y = Math.max(0, Math.random() * (ah - compW));

    const angle = Math.random() * Math.PI * 2;
    const speed = enemyData.speed || 55;
    
    const slotObj = {
      idx, enemyData, el, inner: el.querySelector(".enemy-inner"),
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      hp: HITS_TO_DEFEAT, locked: false,
      w: compW, h: compW, fireCooldown: 0, freezeTimer: 0
    };

    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || !gameActive) return;
      handleHit(slotObj, e);
    });

    slots[idx] = slotObj;
  }

  function respawnSlot(oldSlot) {
    if (oldSlot && oldSlot.el) oldSlot.el.remove();
    spawnSlot(oldSlot.idx);
  }

  function stepMovement(dt) {
    if (!gameActive) return;
    const aw = arena.clientWidth;
    const ah = arena.clientHeight;

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s || s.locked) continue;

      if (s.fireCooldown > 0) s.fireCooldown--;
      if (s.freezeTimer > 0) {
        s.freezeTimer--;
        if (s.freezeTimer <= 0) s.inner.classList.remove("is-frozen");
        s.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
        continue;
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      let bounced = false;
      if (s.x < 0) { s.x = 0; s.vx *= -1; bounced = true; }
      else if (s.x + s.w > aw) { s.x = aw - s.w; s.vx *= -1; bounced = true; }
      
      if (s.y < 0) { s.y = 0; s.vy *= -1; bounced = true; }
      else if (s.y + s.h > ah) { s.y = ah - s.h; s.vy *= -1; bounced = true; }

      if (!bounced && Math.random() < 0.02) {
        const angle = Math.random() * Math.PI * 2;
        const spd = s.enemyData.speed || 55;
        s.vx = Math.cos(angle) * spd;
        s.vy = Math.sin(angle) * spd;
      }

      s.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
  }

  function animationLoop(now) {
    if (!gameActive) return;
    if (lastFrameTime === 0) lastFrameTime = now;
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    stepMovement(dt);
    updateBarriers();
    
    rafId = requestAnimationFrame(animationLoop);
  }

  // ================================================================
  // LIFECYCLE
  // ================================================================
  function startGame() {
    startOverlay.classList.add("overlay--hidden");
    endOverlay.classList.add("overlay--hidden");

    score = 0;
    timeLeft = ROUND_SECONDS;
    combo = 0;
    scoreEl.textContent = score;
    timeEl.textContent = timeLeft;
    timeEl.classList.remove("time-low");
    comboCountEl.textContent = "×0";
    comboCountEl.style.color = "var(--magenta)";
    comboFillEl.style.width = "0%";
    statusText.textContent = "Defeat the Heartless!";

    arena.innerHTML = "";
    slots = [];
    activeBarriers = [];

    getAudioCtx();
    updatePlayerStats();
    restoreMp(100);

    const spawnCount = typeof ARENA_SIZE !== 'undefined' ? ARENA_SIZE : 4;
    for (let i = 0; i < spawnCount; i++) {
      spawnSlot(i);
    }

    gameActive = true;
    lastFrameTime = 0;
    
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 10) timeEl.classList.add("time-low");
      if (timeLeft >= 0) timeEl.textContent = timeLeft;
      if (timeLeft <= 0) endGame();
    }, 1000);

    if (comboTickTimer) clearInterval(comboTickTimer);
    comboTickTimer = setInterval(updateComboTick, 50);

    rafId = requestAnimationFrame(animationLoop);
  }

  function endGame() {
    gameActive = false;
    clearInterval(countdownTimer);
    clearInterval(comboTickTimer);
    if (rafId) cancelAnimationFrame(rafId);
    
    if (spellMenuOpen) closeSpellMenu();

    finalScoreEl.textContent = score;
    const prevBest = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
    
    if (score > prevBest) {
      localStorage.setItem(HIGH_SCOR_KEY || HIGH_SCORE_KEY, score);
      highscoreEl.textContent = score;
      newBestNote.classList.remove("overlay--hidden");
      endHeading.textContent = "Outstanding!";
    } else {
      newBestNote.classList.add("overlay--hidden");
      endHeading.textContent = "Time's Up!";
    }

    localStorage.setItem(XP_KEY, playerXp);
    
    setTimeout(() => {
      endOverlay.classList.remove("overlay--hidden");
      restartBtn.focus();
    }, 800);
  }

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

})();
