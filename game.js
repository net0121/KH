(() => {
  "use strict";

  // ---------- Config ----------
  const ROUND_SECONDS = 60;[cite: 6]
  const COMBO_WINDOW_MS = 5000;   // time allowed after a kill before the combo breaks[cite: 6]
  const HIT_BASE_SCORE = 3;[cite: 6]
  const HIGH_SCORE_KEY = "keyOfLightHighScore";[cite: 6]
  const MUTED_KEY = "keyOfLightMuted";[cite: 6]

  // PNG source for Thundaga strikes (change this path to replace the graphic)
  const THUNDER_PNG_URL = "assets/thunder.png";[cite: 6]

  // Combo tiers: [minCombo, multiplier, color]
  const COMBO_TIERS = [[cite: 6]
    { min: 0, mult: 1, color: "var(--magenta)" },[cite: 6]
    { min: 5, mult: 1.5, color: "var(--cyan)" },[cite: 6]
    { min: 10, mult: 2, color: "var(--gold)" },[cite: 6]
    { min: 20, mult: 3, color: "#ff8a3d" },[cite: 6]
    { min: 35, mult: 4, color: "#ff5c5c" }[cite: 6]
  ];[cite: 6]

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;[cite: 6]

  // ---------- Mouse Tracking ----------
  let mouseX = 0;[cite: 6]
  let mouseY = 0;[cite: 6]

  document.addEventListener("mousemove", (e) => {[cite: 6]
    if (!arena) return;[cite: 6]
    const rect = arena.getBoundingClientRect();[cite: 6]
    mouseX = e.clientX - rect.left;[cite: 6]
    mouseY = e.clientY - rect.top;[cite: 6]
  });[cite: 6]

  // ---------- Spells ----------
  const SPELLS = ['Firaga', 'Blizzaga', 'Thundaga'];[cite: 6]
  let currentSpellIndex = 0;[cite: 6]
  let spellMenuOpen = false;[cite: 6]
  let activeBarriers = [];[cite: 6]

  // ---------- DOM ----------
  const arena = document.getElementById("arena");[cite: 6]
  const scoreEl = document.getElementById("score");[cite: 6]
  const timeEl = document.getElementById("time");[cite: 6]
  const comboCountEl = document.getElementById("comboCount");[cite: 6]
  const comboFillEl = document.getElementById("comboFill");[cite: 6]
  const statusText = document.getElementById("statusText");[cite: 6]
  const highscoreEl = document.getElementById("highscore");[cite: 6]
  const muteBtn = document.getElementById("muteBtn");[cite: 6]

  const startOverlay = document.getElementById("startOverlay");[cite: 6]
  const endOverlay = document.getElementById("endOverlay");[cite: 6]
  const startBtn = document.getElementById("startBtn");[cite: 6]
  const restartBtn = document.getElementById("restartBtn");[cite: 6]
  const endHeading = document.getElementById("endHeading");[cite: 6]
  const finalScoreEl = document.getElementById("finalScore");[cite: 6]
  const newBestNote = document.getElementById("newBestNote");[cite: 6]

  const spellMenuEl = document.getElementById("spellMenu");[cite: 6]

  // ---------- State ----------
  let score = 0;[cite: 6]
  let timeLeft = ROUND_SECONDS;[cite: 6]
  let combo = 0;[cite: 6]
  let lastKillAt = 0;[cite: 6]
  let gameActive = false;[cite: 6]
  let countdownTimer = null;[cite: 6]
  let comboTickTimer = null;[cite: 6]
  let rafId = null;[cite: 6]
  let lastFrameTime = 0;[cite: 6]
  let slots = [];[cite: 6]
  let muted = localStorage.getItem(MUTED_KEY) === "1";[cite: 6]

  // ================================================================
  // AUDIO
  // ================================================================
  let audioCtx = null;[cite: 6]
  const audioElCache = new Map();[cite: 6]

  function getAudioCtx() {[cite: 6]
    if (!audioCtx) {[cite: 6]
      const Ctx = window.AudioContext || window.webkitAudioContext;[cite: 6]
      if (Ctx) audioCtx = new Ctx();[cite: 6]
    }
    if (audioCtx && audioCtx.state === "suspended") {[cite: 6]
      audioCtx.resume().catch(() => {});[cite: 6]
    }
    return audioCtx;[cite: 6]
  }

  function playSynthTone({ wave = "sine", freq = 440 }, { pitchMult = 1, duration = 0.1, volume = 0.16, sweep = 0.82 } = {}) {[cite: 6]
    const ctx = getAudioCtx();[cite: 6]
    if (!ctx || muted) return;[cite: 6]

    const osc = ctx.createOscillator();[cite: 6]
    const gain = ctx.createGain();[cite: 6]
    osc.type = wave;[cite: 6]
    const startFreq = freq * pitchMult;[cite: 6]
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);[cite: 6]
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, startFreq * sweep), ctx.currentTime + duration);[cite: 6]

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);[cite: 6]
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.008);[cite: 6]
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);[cite: 6]

    osc.connect(gain).connect(ctx.destination);[cite: 6]
    osc.start();[cite: 6]
    osc.stop(ctx.currentTime + duration + 0.02);[cite: 6]
  }

  function playNoiseBurst({ duration = 0.05, volume = 0.14 } = {}) {[cite: 6]
    const ctx = getAudioCtx();[cite: 6]
    if (!ctx || muted) return;[cite: 6]

    const bufferSize = Math.floor(ctx.sampleRate * duration);[cite: 6]
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);[cite: 6]
    const data = buffer.getChannelData(0);[cite: 6]
    for (let i = 0; i < bufferSize; i++) {[cite: 6]
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);[cite: 6]
    }
    const noise = ctx.createBufferSource();[cite: 6]
    noise.buffer = buffer;[cite: 6]

    const filter = ctx.createBiquadFilter();[cite: 6]
    filter.type = "bandpass";[cite: 6]
    filter.frequency.value = 1400;[cite: 6]

    const gain = ctx.createGain();[cite: 6]
    gain.gain.setValueAtTime(volume, ctx.currentTime);[cite: 6]
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);[cite: 6]

    noise.connect(filter).connect(gain).connect(ctx.destination);[cite: 6]
    noise.start();[cite: 6]
  }

  function playFileSound(url) {[cite: 6]
    if (muted) return;[cite: 6]
    let base = audioElCache.get(url);[cite: 6]
    if (!base) {[cite: 6]
      base = new Audio(url);[cite: 6]
      base.preload = "auto";[cite: 6]
      audioElCache.set(url, base);[cite: 6]
    }
    const node = base.cloneNode(true);[cite: 6]
    node.volume = 0.6;[cite: 6]
    node.play().catch(() => {});[cite: 6]
  }

  function playHitSound(enemy, hitsLanded) {[cite: 6]
    if (enemy.hitSounds && enemy.hitSounds.length) {[cite: 6]
      const clip = enemy.hitSounds[Math.min(hitsLanded, enemy.hitSounds.length) - 1];[cite: 6]
      if (clip) {[cite: 6]
        playFileSound(clip);[cite: 6]
        return;[cite: 6]
      }
    }
    if (enemy.soundUrl) {[cite: 6]
      playFileSound(enemy.soundUrl);[cite: 6]
      return;[cite: 6]
    }
    const cfg = enemy.sound || { wave: "square", freq: 240 };[cite: 6]
    if (hitsLanded >= HITS_TO_DEFEAT) {[cite: 6]
      playSynthTone(cfg, { pitchMult: 1.5, duration: 0.16, volume: 0.19 });[cite: 6]
      playSynthTone(cfg, { pitchMult: 1.5 * 1.5, duration: 0.14, volume: 0.13 });[cite: 6]
      playNoiseBurst({ duration: 0.07, volume: 0.16 });[cite: 6]
    } else {
      const pitchMult = 1 + (hitsLanded - 1) * 0.18;[cite: 6]
      playSynthTone(cfg, { pitchMult, duration: 0.09, volume: 0.15 });[cite: 6]
    }
  }

  function setMuted(next) {[cite: 6]
    muted = next;[cite: 6]
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");[cite: 6]
    muteBtn.textContent = muted ? "🔇" : "🔊";[cite: 6]
    muteBtn.setAttribute("aria-pressed", String(muted));[cite: 6]
    muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");[cite: 6]
  }

  // ---------- Setup ----------
  function loadHighScore() {[cite: 6]
    const stored = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;[cite: 6]
    highscoreEl.textContent = stored;[cite: 6]
    return stored;[cite: 6]
  }

  function buildArena() {[cite: 6]
    arena.innerHTML = "";[cite: 6]
    slots = [];[cite: 6]
    for (let i = 0; i < ARENA_SIZE; i++) {[cite: 6]
      const slot = createSlot();[cite: 6]
      arena.appendChild(slot.el);[cite: 6]
      slots.push(slot);[cite: 6]
    }
  }

  function createSlot() {[cite: 6]
    const el = document.createElement("div");[cite: 6]
    el.className = "enemy";[cite: 6]
    el.setAttribute("role", "button");[cite: 6]
    el.setAttribute("tabindex", "0");[cite: 6]

    const inner = document.createElement("div");[cite: 6]
    inner.className = "enemy-inner";[cite: 6]

    const portraitWrap = document.createElement("div");[cite: 6]
    portraitWrap.className = "enemy-portrait-wrap";[cite: 6]
    const portrait = document.createElement("img");[cite: 6]
    portrait.className = "enemy-portrait";[cite: 6]
    portrait.alt = "";[cite: 6]
    portrait.loading = "lazy";[cite: 6]
    portrait.onerror = () => {[cite: 6]
      portrait.onerror = null;[cite: 6]
      portrait.src = "https://placehold.co/300x300/1c1830/948fb0?text=%3F";[cite: 6]
    };
    portraitWrap.appendChild(portrait);[cite: 6]
    inner.appendChild(portraitWrap);[cite: 6]
    el.appendChild(inner);[cite: 6]

    const nameEl = document.createElement("div");[cite: 6]
    nameEl.className = "enemy-name";[cite: 6]
    el.appendChild(nameEl);[cite: 6]

    const pips = document.createElement("div");[cite: 6]
    pips.className = "enemy-pips";[cite: 6]
    const pipEls = [];[cite: 6]
    for (let p = 0; p < HITS_TO_DEFEAT; p++) {[cite: 6]
      const pip = document.createElement("span");[cite: 6]
      pip.className = "pip";[cite: 6]
      pips.appendChild(pip);[cite: 6]
      pipEls.push(pip);[cite: 6]
    }
    el.appendChild(pips);[cite: 6]

    const slot = {[cite: 6]
      el, inner, portrait, nameEl, pipEls,[cite: 6]
      hp: 0, enemy: null, locked: false,[cite: 6]
      x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0,[cite: 6]
      wanderRate: 0, freezeTimer: 0,[cite: 6]
      moving: true[cite: 6]
    };

    const activate = (e) => {[cite: 6]
      e.preventDefault();[cite: 6]
      handleHit(slot, e);[cite: 6]
    };
    el.addEventListener("click", activate);[cite: 6]
    el.addEventListener("keydown", (e) => {[cite: 6]
      if (e.key === "Enter" || e.key === " ") activate(e);[cite: 6]
    });
    el.addEventListener("focus", () => { slot.moving = false; });[cite: 6]
    el.addEventListener("blur", () => { if (!slot.locked) slot.moving = true; });[cite: 6]

    return slot;[cite: 6]
  }

  function randomEnemy() {[cite: 6]
    return ENEMY_ROSTER[Math.floor(Math.random() * ENEMY_ROSTER.length)];[cite: 6]
  }

  // ---------- Movement ----------
  function randomPositionFor(slot) {[cite: 6]
    const arenaW = arena.clientWidth;[cite: 6]
    const arenaH = arena.clientHeight;[cite: 6]
    const w = slot.el.offsetWidth || slot.w || 120;[cite: 6]
    const h = slot.el.offsetHeight || slot.h || 140;[cite: 6]
    slot.w = w;[cite: 6]
    slot.h = h;[cite: 6]
    slot.x = Math.random() * Math.max(0, arenaW - w);[cite: 6]
    slot.y = Math.random() * Math.max(0, arenaH - h);[cite: 6]
  }

  function randomVelocityFor(slot) {[cite: 6]
    const speed = (slot.enemy && slot.enemy.speed) || 60;[cite: 6]
    slot.wanderRate = 0.6 + Math.random() * 1.4;[cite: 6]
    if (prefersReducedMotion) {[cite: 6]
      slot.vx = 0;[cite: 6]
      slot.vy = 0;[cite: 6]
      return;[cite: 6]
    }
    const angle = Math.random() * Math.PI * 2;[cite: 6]
    slot.vx = Math.cos(angle) * speed;[cite: 6]
    slot.vy = Math.sin(angle) * speed;[cite: 6]
  }

  function nudgeHeading(slot, maxRadians) {[cite: 6]
    const speed = Math.hypot(slot.vx, slot.vy);[cite: 6]
    if (!speed) return;[cite: 6]
    const angle = Math.atan2(slot.vy, slot.vx) + (Math.random() - 0.5) * 2 * maxRadians;[cite: 6]
    slot.vx = Math.cos(angle) * speed;[cite: 6]
    slot.vy = Math.sin(angle) * speed;[cite: 6]
  }

  function placeSlot(slot) {[cite: 6]
    slot.el.style.transform = `translate(${slot.x}px, ${slot.y}px)`;[cite: 6]
  }

  function stepMovement(dt) {[cite: 6]
    const arenaW = arena.clientWidth;[cite: 6]
    const arenaH = arena.clientHeight;[cite: 6]
    const arenaRect = arena.getBoundingClientRect();[cite: 6]

    // Barrier position & collision update
    activeBarriers.forEach(b => {[cite: 6]
      // Update barrier center to track cursor
      b.x = mouseX;[cite: 6]
      b.y = mouseY;[cite: 6]
      b.el.style.left = (b.x - b.radius) + 'px';[cite: 6]
      b.el.style.top = (b.y - b.radius) + 'px';[cite: 6]

      slots.forEach(slot => {[cite: 6]
        if (slot.hp <= 0 || slot.locked) return;[cite: 6]
        const w = slot.w || slot.el.offsetWidth;[cite: 6]
        const h = slot.h || slot.el.offsetHeight;[cite: 6]
        const scx = slot.x + w / 2;[cite: 6]
        const scy = slot.y + h / 2;[cite: 6]
        const dist = Math.hypot(scx - b.x, scy - b.y);[cite: 6]
        
        if (dist < (w / 2 + b.radius)) {[cite: 6]
          if (b.type === 'firaga') {[cite: 6]
            slot.hp = 1; // Instant kill setup[cite: 6]
            handleHit(slot, { clientX: arenaRect.left + scx, clientY: arenaRect.top + scy });[cite: 6]
          } else if (b.type === 'blizzaga') {[cite: 6]
            if (!slot.freezeTimer || slot.freezeTimer <= 0) {[cite: 6]
              slot.freezeTimer = 5000;[cite: 6]
            }
          }
        }
      });
    });

    for (const slot of slots) {[cite: 6]
      // Freeze condition
      if (slot.freezeTimer && slot.freezeTimer > 0) {[cite: 6]
        slot.freezeTimer -= dt * 1000;[cite: 6]
        slot.inner.classList.add('is-frozen');[cite: 6]
        continue;[cite: 6]
      } else {
        slot.inner.classList.remove('is-frozen');[cite: 6]
        slot.freezeTimer = 0;[cite: 6]
      }

      if (!slot.moving || slot.locked) continue;[cite: 6]

      const w = slot.w || slot.el.offsetWidth;[cite: 6]
      const h = slot.h || slot.el.offsetHeight;[cite: 6]
      const maxX = Math.max(0, arenaW - w);[cite: 6]
      const maxY = Math.max(0, arenaH - h);[cite: 6]

      if (!prefersReducedMotion && slot.wanderRate) {[cite: 6]
        nudgeHeading(slot, slot.wanderRate * dt);[cite: 6]
      }

      slot.x += slot.vx * dt;[cite: 6]
      slot.y += slot.vy * dt;[cite: 6]

      if (slot.x <= 0) { slot.x = 0; slot.vx = Math.abs(slot.vx); nudgeHeading(slot, 0.35); }[cite: 6]
      else if (slot.x >= maxX) { slot.x = maxX; slot.vx = -Math.abs(slot.vx); nudgeHeading(slot, 0.35); }[cite: 6]

      if (slot.y <= 0) { slot.y = 0; slot.vy = Math.abs(slot.vy); nudgeHeading(slot, 0.35); }[cite: 6]
      else if (slot.y >= maxY) { slot.y = maxY; slot.vy = -Math.abs(slot.vy); nudgeHeading(slot, 0.35); }[cite: 6]

      placeSlot(slot);[cite: 6]
    }
  }

  function animationLoop(now) {[cite: 6]
    if (!gameActive) return;[cite: 6]
    const dt = lastFrameTime ? Math.min(0.05, (now - lastFrameTime) / 1000) : 0;[cite: 6]
    lastFrameTime = now;[cite: 6]
    stepMovement(dt);[cite: 6]
    rafId = requestAnimationFrame(animationLoop);[cite: 6]
  }

  function handleResize() {[cite: 6]
    if (!gameActive) return;[cite: 6]
    const arenaW = arena.clientWidth;[cite: 6]
    const arenaH = arena.clientHeight;[cite: 6]
    for (const slot of slots) {[cite: 6]
      const w = slot.el.offsetWidth;[cite: 6]
      const h = slot.el.offsetHeight;[cite: 6]
      slot.x = Math.min(slot.x, Math.max(0, arenaW - w));[cite: 6]
      slot.y = Math.min(slot.y, Math.max(0, arenaH - h));[cite: 6]
      placeSlot(slot);[cite: 6]
    }
  }

  function spawnEnemy(slot, animate) {[cite: 6]
    const enemy = randomEnemy();[cite: 6]
    slot.enemy = enemy;[cite: 6]
    slot.hp = HITS_TO_DEFEAT;[cite: 6]
    slot.locked = false;[cite: 6]
    slot.moving = true;[cite: 6]
    slot.freezeTimer = 0;[cite: 6]
    slot.portrait.src = enemy.image;[cite: 6]
    slot.portrait.alt = enemy.name;[cite: 6]
    slot.nameEl.textContent = enemy.name;[cite: 6]
    slot.pipEls.forEach((pip) => {[cite: 6]
      pip.classList.remove("filled");[cite: 6]
      pip.style.setProperty("--pip-color", enemy.tint);[cite: 6]
    });
    slot.inner.classList.remove("is-defeated");[cite: 6]
    slot.inner.classList.remove("is-frozen");[cite: 6]

    randomPositionFor(slot);[cite: 6]
    randomVelocityFor(slot);[cite: 6]
    placeSlot(slot);[cite: 6]

    if (animate) {[cite: 6]
      slot.inner.classList.add("is-spawning");[cite: 6]
      setTimeout(() => slot.inner.classList.remove("is-spawning"), 300);[cite: 6]
    }
  }

  // ---------- Combo ----------
  function currentTier() {[cite: 6]
    let tier = COMBO_TIERS[0];[cite: 6]
    for (const t of COMBO_TIERS) {[cite: 6]
      if (combo >= t.min) tier = t;[cite: 6]
    }
    return tier;[cite: 6]
  }

  function registerKillForCombo() {[cite: 6]
    combo += 1;[cite: 6]
    lastKillAt = Date.now();[cite: 6]
    const tier = currentTier();[cite: 6]
    comboCountEl.textContent = `×${combo}`;[cite: 6]
    comboCountEl.style.color = tier.color;[cite: 6]
    comboFillEl.style.background = tier.color;[cite: 6]
    comboFillEl.style.width = "100%";[cite: 6]
  }

  function breakCombo(reason) {[cite: 6]
    if (combo > 0 && reason) {[cite: 6]
      statusText.textContent = reason;[cite: 6]
    }
    combo = 0;[cite: 6]
    comboCountEl.textContent = "×0";[cite: 6]
    comboCountEl.style.color = "var(--text-dim)";[cite: 6]
    comboFillEl.style.width = "0%";[cite: 6]
  }

  function tickComboDecay() {[cite: 6]
    if (!gameActive || combo === 0) return;[cite: 6]
    const elapsed = Date.now() - lastKillAt;[cite: 6]
    const remaining = Math.max(0, 1 - elapsed / COMBO_WINDOW_MS);[cite: 6]
    comboFillEl.style.width = `${remaining * 100}%`;[cite: 6]
    if (elapsed >= COMBO_WINDOW_MS) {[cite: 6]
      breakCombo("No kill in time — combo broken.");[cite: 6]
    }
  }

  // ---------- Hit effects ----------
  function showFloater(slot, text) {[cite: 6]
    const f = document.createElement("div");[cite: 6]
    f.className = "floater";[cite: 6]
    f.textContent = text;[cite: 6]
    slot.el.appendChild(f);[cite: 6]
    setTimeout(() => f.remove(), 700);[cite: 6]
  }

  const STAR_COLORS = ["var(--gold)", "#ffffff", "var(--cyan)", "var(--magenta)"];[cite: 6]

  function spawnStarBurst(slot, x, y, big) {[cite: 6]
    const count = big ? 12 : 6;[cite: 6]
    const baseDistance = big ? 46 : 26;[cite: 6]
    for (let i = 0; i < count; i++) {[cite: 6]
      const star = document.createElement("div");[cite: 6]
      star.className = "star-particle";[cite: 6]

      const angle = (360 / count) * i + (Math.random() * 20 - 10);[cite: 6]
      const rad = (angle * Math.PI) / 180;[cite: 6]
      const distance = baseDistance + Math.random() * (big ? 26 : 16);[cite: 6]
      const dx = Math.cos(rad) * distance;[cite: 6]
      const dy = Math.sin(rad) * distance;[cite: 6]
      const size = big ? 10 + Math.random() * 8 : 6 + Math.random() * 5;[cite: 6]
      const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];[cite: 6]

      star.style.setProperty("--x", `${x}px`);[cite: 6]
      star.style.setProperty("--y", `${y}px`);[cite: 6]
      star.style.setProperty("--dx", `${dx}px`);[cite: 6]
      star.style.setProperty("--dy", `${dy}px`);[cite: 6]
      star.style.setProperty("--size", `${size}px`);[cite: 6]
      star.style.setProperty("--star-color", color);[cite: 6]
      star.style.setProperty("--rot", `${Math.round(Math.random() * 360)}deg`);[cite: 6]
      star.style.setProperty("--end-scale", big ? "1.3" : "0.9");[cite: 6]
      star.style.setProperty("--delay", `${Math.random() * 60}ms`);[cite: 6]

      slot.el.appendChild(star);[cite: 6]
      setTimeout(() => star.remove(), 700);[cite: 6]
    }
  }

  function hitPoint(slot, evt) {[cite: 6]
    const rect = slot.el.getBoundingClientRect();[cite: 6]
    if (evt && typeof evt.clientX === "number") {[cite: 6]
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };[cite: 6]
    }
    return { x: rect.width / 2, y: rect.height / 2 };[cite: 6]
  }

  // ---------- Hit handling ----------
  function handleHit(slot, evt) {[cite: 6]
    if (!gameActive || slot.locked || slot.hp <= 0) return;[cite: 6]

    const willKill = slot.hp <= 1;[cite: 6]
    if (willKill) registerKillForCombo();[cite: 6]
    const tier = currentTier();[cite: 6]
    slot.hp -= 1;[cite: 6]
    const hitsLanded = HITS_TO_DEFEAT - slot.hp;[cite: 6]

    const pipIndex = hitsLanded - 1;[cite: 6]
    if (slot.pipEls[pipIndex]) slot.pipEls[pipIndex].classList.add("filled");[cite: 6]

    const point = hitPoint(slot, evt);[cite: 6]
    playHitSound(slot.enemy, hitsLanded);[cite: 6]

    if (slot.hp > 0) {[cite: 6]
      const gained = Math.round(HIT_BASE_SCORE * tier.mult);[cite: 6]
      score += gained;[cite: 6]
      slot.inner.classList.remove("is-hit");[cite: 6]
      void slot.inner.offsetWidth;[cite: 6]
      slot.inner.classList.add("is-hit");[cite: 6]
      spawnStarBurst(slot, point.x, point.y, false);[cite: 6]
      showFloater(slot, `+${gained}`);[cite: 6]
      statusText.textContent = `${slot.enemy.name} staggers — ${slot.hp} hit${slot.hp === 1 ? "" : "s"} left.`;[cite: 6]
    } else {
      slot.locked = true;[cite: 6]
      slot.moving = false;[cite: 6]
      const gained = Math.round(slot.enemy.points * tier.mult);[cite: 6]
      score += gained;[cite: 6]
      spawnStarBurst(slot, point.x, point.y, true);[cite: 6]
      showFloater(slot, `+${gained}`);[cite: 6]
      slot.inner.classList.add("is-defeated");[cite: 6]
      statusText.textContent = `${slot.enemy.name} banished! Combo ×${combo} blazing.`;[cite: 6]
      setTimeout(() => {[cite: 6]
        spawnEnemy(slot, true);[cite: 6]
      }, 320);[cite: 6]
    }

    scoreEl.textContent = score;[cite: 6]
  }

  function handleArenaMiss(e) {[cite: 6]
    if (!gameActive) return;[cite: 6]
    if (e.target === arena) {[cite: 6]
      breakCombo("Missed! Combo broken.");[cite: 6]
    }
  }

  // ---------- Timer ----------
  function tickCountdown() {[cite: 6]
    timeLeft -= 1;[cite: 6]
    timeEl.textContent = timeLeft;[cite: 6]
    timeEl.classList.toggle("time-low", timeLeft <= 10);[cite: 6]
    if (timeLeft <= 0) {[cite: 6]
      endGame();[cite: 6]
    }
  }

  // ---------- Game lifecycle ----------
  function startGame() {[cite: 6]
    getAudioCtx();[cite: 6]

    score = 0;[cite: 6]
    timeLeft = ROUND_SECONDS;[cite: 6]
    combo = 0;[cite: 6]
    lastKillAt = 0;[cite: 6]
    gameActive = true;[cite: 6]
    lastFrameTime = 0;[cite: 6]

    activeBarriers.forEach(b => { if (b.el.parentNode) b.el.remove(); });[cite: 6]
    activeBarriers = [];[cite: 6]
    spellMenuOpen = false;[cite: 6]
    if (spellMenuEl) spellMenuEl.classList.add('overlay--hidden');[cite: 6]

    scoreEl.textContent = "0";[cite: 6]
    timeEl.textContent = ROUND_SECONDS;[cite: 6]
    timeEl.classList.remove("time-low");[cite: 6]
    breakCombo(null);[cite: 6]
    statusText.textContent = "Strike a shadow to begin.";[cite: 6]

    buildArena();[cite: 6]
    slots.forEach((slot) => spawnEnemy(slot, false));[cite: 6]

    startOverlay.classList.add("overlay--hidden");[cite: 6]
    endOverlay.classList.add("overlay--hidden");[cite: 6]

    clearInterval(countdownTimer);[cite: 6]
    clearInterval(comboTickTimer);[cite: 6]
    cancelAnimationFrame(rafId);[cite: 6]
    countdownTimer = setInterval(tickCountdown, 1000);[cite: 6]
    comboTickTimer = setInterval(tickComboDecay, 100);[cite: 6]
    rafId = requestAnimationFrame(animationLoop);[cite: 6]
  }

  function endGame() {[cite: 6]
    gameActive = false;[cite: 6]
    clearInterval(countdownTimer);[cite: 6]
    clearInterval(comboTickTimer);[cite: 6]
    cancelAnimationFrame(rafId);[cite: 6]

    activeBarriers.forEach(b => { if (b.el.parentNode) b.el.remove(); });[cite: 6]
    activeBarriers = [];[cite: 6]
    spellMenuOpen = false;[cite: 6]
    if (spellMenuEl) spellMenuEl.classList.add('overlay--hidden');[cite: 6]

    const best = loadHighScore();[cite: 6]
    const isNewBest = score > best;[cite: 6]
    if (isNewBest) {[cite: 6]
      localStorage.setItem(HIGH_SCORE_KEY, String(score));[cite: 6]
      highscoreEl.textContent = score;[cite: 6]
    }

    endHeading.textContent = "LIGHT FADES";[cite: 6]
    finalScoreEl.textContent = score;[cite: 6]
    newBestNote.classList.toggle("overlay--hidden", !isNewBest);[cite: 6]
    endOverlay.classList.remove("overlay--hidden");[cite: 6]
  }

  // ---------- Spell Menu Interactions ----------
  function updateSpellMenuUI() {[cite: 6]
    if (!spellMenuEl) return;[cite: 6]
    const items = spellMenuEl.querySelectorAll('.spell-item');[cite: 6]
    items.forEach((item, index) => {[cite: 6]
      if (index === currentSpellIndex) item.classList.add('selected');[cite: 6]
      else item.classList.remove('selected');[cite: 6]
    });
  }

  function castSpell(spellName) {[cite: 6]
    if (spellName === 'Firaga') {[cite: 6]
      spawnBarrier('firaga', 150);[cite: 6]
    } else if (spellName === 'Blizzaga') {[cite: 6]
      spawnBarrier('blizzaga', 160);[cite: 6]
    } else if (spellName === 'Thundaga') {[cite: 6]
      const rect = arena.getBoundingClientRect();[cite: 6]
      castThundaga(rect);[cite: 6]
    }
  }

  function spawnBarrier(type, radius) {[cite: 6]
    const el = document.createElement('div');[cite: 6]
    el.className = `barrier ${type}-barrier`;[cite: 6]
    
    const size = radius * 2;[cite: 6]
    el.style.position = 'absolute';[cite: 6]
    el.style.width = size + 'px';[cite: 6]
    el.style.height = size + 'px';[cite: 6]
    el.style.left = (mouseX - radius) + 'px';[cite: 6]
    el.style.top = (mouseY - radius) + 'px';[cite: 6]
    
    arena.appendChild(el);[cite: 6]
    
    const barrier = { type, x: mouseX, y: mouseY, radius, el };[cite: 6]
    activeBarriers.push(barrier);[cite: 6]
    
    setTimeout(() => {[cite: 6]
      if (el.parentNode) el.remove();[cite: 6]
      activeBarriers = activeBarriers.filter(b => b !== barrier);[cite: 6]
    }, 4000);[cite: 6]
  }

  function castThundaga(arenaRect) {
    if (!gameActive) return;

    const boltWidth = 120;
    const tx = mouseX; // Target directly on current cursor X coordinate

    // Create single bolt element from PNG
    const el = document.createElement('img');
    el.className = 'thundaga-bolt';
    el.src = THUNDER_PNG_URL;
    el.style.position = 'absolute';
    el.style.left = (tx - boltWidth / 2) + 'px';
    el.style.top = '0px';
    el.style.width = boltWidth + 'px';
    el.style.height = arenaRect.height + 'px';
    el.style.pointerEvents = 'none';
    el.style.opacity = '1';
    el.style.transition = 'opacity 0.35s ease-out';
    arena.appendChild(el);

    // Trigger instant hit detection along the bolt column
    slots.forEach(slot => {
      if (slot.hp <= 0 || slot.locked) return;
      const w = slot.w || slot.el.offsetWidth;
      const scx = slot.x + w / 2;
      const scy = slot.y + (slot.h || slot.el.offsetHeight) / 2;

      if (Math.abs(scx - tx) < (w / 2 + boltWidth / 2)) {
        slot.hp = 1;
        handleHit(slot, { clientX: arenaRect.left + scx, clientY: arenaRect.top + scy });
      }
    });

    // Start fading out after impact, then cleanup DOM node
    requestAnimationFrame(() => {
      el.style.opacity = '0';
    });
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 350);
  }

  // --- Input overrides for Spell Menu ---
  document.addEventListener('contextmenu', (e) => {[cite: 6]
    if (!gameActive) return;[cite: 6]
    e.preventDefault();[cite: 6]
    spellMenuOpen = true;[cite: 6]
    
    spellMenuEl.style.left = e.clientX + 'px';[cite: 6]
    spellMenuEl.style.top = e.clientY + 'px';[cite: 6]
    spellMenuEl.classList.remove('overlay--hidden');[cite: 6]
    updateSpellMenuUI();[cite: 6]
  });[cite: 6]

  document.addEventListener('wheel', (e) => {[cite: 6]
    if (!spellMenuOpen) return;[cite: 6]
    e.preventDefault();[cite: 6]
    if (e.deltaY > 0) {[cite: 6]
      currentSpellIndex = (currentSpellIndex + 1) % SPELLS.length;[cite: 6]
    } else {
      currentSpellIndex = (currentSpellIndex - 1 + SPELLS.length) % SPELLS.length;[cite: 6]
    }
    updateSpellMenuUI();[cite: 6]
  }, { passive: false });[cite: 6]

  document.addEventListener('click', (e) => {[cite: 6]
    if (!gameActive) return;[cite: 6]
    if (spellMenuOpen) {[cite: 6]
      e.preventDefault();[cite: 6]
      e.stopPropagation();[cite: 6]
      spellMenuOpen = false;[cite: 6]
      spellMenuEl.classList.add('overlay--hidden');[cite: 6]
      castSpell(SPELLS[currentSpellIndex]);[cite: 6]
    }
  }, true);[cite: 6]


  // ---------- Wire up ----------
  arena.addEventListener("click", handleArenaMiss);[cite: 6]
  startBtn.addEventListener("click", startGame);[cite: 6]
  restartBtn.addEventListener("click", startGame);[cite: 6]
  muteBtn.addEventListener("click", () => {[cite: 6]
    getAudioCtx();[cite: 6]
    setMuted(!muted);[cite: 6]
  });[cite: 6]
  window.addEventListener("resize", handleResize);[cite: 6]

  setMuted(muted);[cite: 6]
  loadHighScore();[cite: 6]
  buildArena();[cite: 6]
  slots.forEach((slot) => spawnEnemy(slot, false));[cite: 6]
})();
