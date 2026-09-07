(() => {
  "use strict";

  // ---------- Config ----------
  const ROUND_SECONDS = 60;
  const COMBO_WINDOW_MS = 5000;
  const HIT_BASE_SCORE = 3;
  const HIGH_SCORE_KEY = "keyOfLightHighScore";
  const MUTED_KEY = "keyOfLightMuted";
  const XP_KEY = "keyOfLightXP";
  const BASE_SPELL_COSTS = [10, 15, 20, 18];

  const THUNDER_PNG_URL = "https://github.com/net0121/KH/blob/main/badthundaga.png?raw=true";

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
  const BASE_SPELLS = ['Fire', 'Blizzard', 'Thunder', 'Cure'];
  let currentSpellIndex = 0;
  let spellMenuOpen = false;
  let activeBarriers = [];

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
  const hpFillEl = document.getElementById("hpFill");

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
  let maxHp = 100;
  let currentHp = 100;
  let activeProjectiles = [];

  function getMagicTier() {
    if (playerLevel >= 10) return 3; // -aga
    if (playerLevel >= 5) return 2;  // -ara
    return 1;                        // base
  }

  function getSpellName(index) {
    const tier = getMagicTier();
    const suffixes = [
      ['Fire', 'Fira', 'Firaga'],
      ['Blizzard', 'Blizzara', 'Blizzaga'],
      ['Thunder', 'Thundara', 'Thundaga'],
      ['Cure', 'Cura', 'Curaga']
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

  // A floater anchored to arena coordinates rather than a specific enemy slot —
  // used for player-facing feedback like Cure heals or a landed projectile hit.
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
    if (enemy.soundUrl) {
      playFileSound(enemy.soundUrl);
      return;
    }
    const cfg = enemy.sound || { wave: "square", freq: 240 };
    if (hitsLanded >= HITS_TO_DEFEAT) {
      playSynthTone(cfg, { pitchMult: 1.5, duration: 0.16, volume: 0.19 });
      playSynthTone(cfg, { pitchMult: 1.5 * 1.5, duration: 0.14, volume: 0.13 });
      playNoiseBurst({ duration: 0.07, volume: 0.16 });
    } else {
      const pitchMult = 1 + (hitsLanded - 1) * 0.18;
      playSynthTone(cfg, { pitchMult, duration: 0.09, volume: 0.15 });
    }
  }

  function setMuted(next) {
    muted = next;
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    muteBtn.textContent = muted ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  }

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
    portrait.loading = "lazy";
    portrait.onerror = () => {
      portrait.onerror = null;
      portrait.src = "https://placehold.co/300x300/1c1830/948fb0?text=%3F";
    };
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
      wanderRate: 0, freezeTimer: 0,
      moving: true,
      attackTimer: Infinity, attacking: false, telegraphTimer: 0,
      preAttackVx: 0, preAttackVy: 0,
      cloakTimer: 0, speedBoostTimer: 0
    };

    const activate = (e) => {
      e.preventDefault();
      handleHit(slot, e);
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") activate(e);
    });
    el.addEventListener("focus", () => { slot.moving = false; });
    el.addEventListener("blur", () => { if (!slot.locked) slot.moving = true; });

    return slot;
  }

  function randomEnemy() {
    return ENEMY_ROSTER[Math.floor(Math.random() * ENEMY_ROSTER.length)];
  }

  function randomAttackInterval(enemy) {
    if (!enemy || !enemy.attack) return Infinity;
    const { cooldownMin = 5000, cooldownMax = 9000 } = enemy.attack;
    return cooldownMin + Math.random() * (cooldownMax - cooldownMin);
  }

  // ---------- Movement ----------
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
    const speed = (slot.enemy && slot.enemy.speed) || 60;
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

  function stepMovement(dt) {
    const arenaW = arena.clientWidth;
    const arenaH = arena.clientHeight;
    const arenaRect = arena.getBoundingClientRect();

    activeBarriers.forEach(b => {
      b.x = mouseX;
      b.y = mouseY;
      b.el.style.left = (b.x - b.radius) + 'px';
      b.el.style.top = (b.y - b.radius) + 'px';

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
          }
        }
      });
    });

    for (const slot of slots) {
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

  // ---------- Enemy attacks ----------
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

      // Cloak and speed-boost effects wind down regardless of attack state.
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

      if (!slot.enemy.attack || slot.freezeTimer > 0) continue;

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
          // Enemy visibly slows to "charge" its attack, giving the player
          // a fair window to notice and interrupt it.
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

    const speed = 480; // px/second
    const dist = Math.hypot(targetX - startX, targetY - startY);
    const duration = Math.max(220, (dist / speed) * 1000);

    requestAnimationFrame(() => {
      el.style.transition = `left ${duration}ms linear, top ${duration}ms linear`;
      el.style.left = `${targetX}px`;
      el.style.top = `${targetY}px`;
    });

    const projectile = { el };
    activeProjectiles.push(projectile);

    const timeoutId = setTimeout(() => {
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
        statusText.textContent = `${slot.enemy.name} fires ${atk.name} — dodge it!`;
        playSynthTone({ wave: "sawtooth", freq: 380 }, { pitchMult: 1, duration: 0.16, volume: 0.14, sweep: 0.55 });
        fireProjectile(slot, atk);
        break;
      }
    }
  }

  function handleResize() {
    if (!gameActive) return;
    const arenaW = arena.clientWidth;
    const arenaH = arena.clientHeight;
    for (const slot of slots) {
      const w = slot.el.offsetWidth;
      const h = slot.el.offsetHeight;
      slot.x = Math.min(slot.x, Math.max(0, arenaW - w));
      slot.y = Math.min(slot.y, Math.max(0, arenaH - h));
      placeSlot(slot);
    }
  }

  function spawnEnemy(slot, animate) {
    const enemy = randomEnemy();
    slot.enemy = enemy;
    slot.hp = HITS_TO_DEFEAT;
    slot.locked = false;
    slot.moving = true;
    slot.freezeTimer = 0;
    slot.portrait.src = enemy.image;
    slot.portrait.alt = enemy.name;
    slot.nameEl.textContent = enemy.name;
    slot.pipEls.forEach((pip) => {
      pip.classList.remove("filled");
      pip.style.setProperty("--pip-color", enemy.tint);
    });
    slot.inner.classList.remove("is-defeated");
    slot.inner.classList.remove("is-frozen");
    slot.inner.classList.remove("is-cloaked");
    slot.telegraphEl.classList.remove("is-charging");
    slot.attacking = false;
    slot.telegraphTimer = 0;
    slot.cloakTimer = 0;
    slot.speedBoostTimer = 0;
    slot.attackTimer = randomAttackInterval(enemy);

    randomPositionFor(slot);
    randomVelocityFor(slot);
    placeSlot(slot);

    if (animate) {
      slot.inner.classList.add("is-spawning");
      setTimeout(() => slot.inner.classList.remove("is-spawning"), 300);
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

  function registerKillForCombo() {
    combo += 1;
    lastKillAt = Date.now();
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
    const elapsed = Date.now() - lastKillAt;
    const remaining = Math.max(0, 1 - elapsed / COMBO_WINDOW_MS);
    comboFillEl.style.width = `${remaining * 100}%`;
    if (elapsed >= COMBO_WINDOW_MS) {
      breakCombo("No kill in time — combo broken.");
    }
  }

  // ---------- Hit effects ----------
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

  // ---------- Hit handling ----------
  function handleHit(slot, evt) {
    if (!gameActive || slot.locked || slot.hp <= 0) return;

    if (slot.attacking) {
      cancelAttackWindup(slot);
      slot.attackTimer = randomAttackInterval(slot.enemy);
    }

    const willKill = slot.hp <= 1;
    if (willKill) registerKillForCombo();
    const tier = currentTier();
    slot.hp -= 1;
    const hitsLanded = HITS_TO_DEFEAT - slot.hp;

    const pipIndex = hitsLanded - 1;
    if (slot.pipEls[pipIndex]) slot.pipEls[pipIndex].classList.add("filled");

    const point = hitPoint(slot, evt);
    playHitSound(slot.enemy, hitsLanded);
    
    restoreMp(2);

    if (slot.hp > 0) {
      const gained = Math.round(HIT_BASE_SCORE * tier.mult);
      score += gained;
      slot.inner.classList.remove("is-hit");
      void slot.inner.offsetWidth;
      slot.inner.classList.add("is-hit");
      spawnStarBurst(slot, point.x, point.y, false);
      showFloater(slot, `+${gained}`);
      statusText.textContent = `${slot.enemy.name} staggers — ${slot.hp} hit${slot.hp === 1 ? "" : "s"} left.`;
    } else {
      slot.locked = true;
      slot.moving = false;
      const gained = Math.round(slot.enemy.points * tier.mult);
      score += gained;
      
      playerXp += gained;
      localStorage.setItem(XP_KEY, playerXp);
      updatePlayerStats();
      restoreMp(8);

      spawnStarBurst(slot, point.x, point.y, true);
      showFloater(slot, `+${gained}`);
      slot.inner.classList.add("is-defeated");
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
    getAudioCtx();

    score = 0;
    timeLeft = ROUND_SECONDS;
    combo = 0;
    lastKillAt = 0;
    gameActive = true;
    lastFrameTime = 0;

    activeBarriers.forEach(b => { if (b.el.parentNode) b.el.remove(); });
    activeBarriers = [];
    activeProjectiles.forEach(p => {
      clearTimeout(p.timeoutId);
      if (p.el.parentNode) p.el.remove();
    });
    activeProjectiles = [];
    spellMenuOpen = false;
    if (spellMenuEl) spellMenuEl.classList.add('overlay--hidden');

    scoreEl.textContent = "0";
    timeEl.textContent = ROUND_SECONDS;
    timeEl.classList.remove("time-low");
    breakCombo(null);
    statusText.textContent = "Strike a shadow to begin.";

    updatePlayerStats();
    currentMp = maxMp;
    maxHp = 100;
    currentHp = maxHp;
    updateHpFill();
    updatePlayerStats();

    buildArena();
    slots.forEach((slot) => spawnEnemy(slot, false));

    startOverlay.classList.add("overlay--hidden");
    endOverlay.classList.add("overlay--hidden");

    clearInterval(countdownTimer);
    clearInterval(comboTickTimer);
    cancelAnimationFrame(rafId);
    countdownTimer = setInterval(tickCountdown, 1000);
    comboTickTimer = setInterval(tickComboDecay, 100);
    rafId = requestAnimationFrame(animationLoop);
  }

  function endGame(reason) {
    if (!gameActive) return;
    gameActive = false;
    clearInterval(countdownTimer);
    clearInterval(comboTickTimer);
    cancelAnimationFrame(rafId);

    activeBarriers.forEach(b => { if (b.el.parentNode) b.el.remove(); });
    activeBarriers = [];
    activeProjectiles.forEach(p => {
      clearTimeout(p.timeoutId);
      if (p.el.parentNode) p.el.remove();
    });
    activeProjectiles = [];
    spellMenuOpen = false;
    if (spellMenuEl) spellMenuEl.classList.add('overlay--hidden');

    const best = loadHighScore();
    const isNewBest = score > best;
    if (isNewBest) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
      highscoreEl.textContent = score;
    }

    endHeading.textContent = reason || "Time's Up";
    finalScoreEl.textContent = score;
    newBestNote.classList.toggle("overlay--hidden", !isNewBest);
    endOverlay.classList.remove("overlay--hidden");
  }

  // ---------- Spell Menu Interactions ----------
  function updateSpellMenuUI() {
    if (!spellMenuEl) return;
    const items = spellMenuEl.querySelectorAll('.spell-item');
    items.forEach((item, index) => {
      item.textContent = getSpellName(index);
      if (index === currentSpellIndex) item.classList.add('selected');
      else item.classList.remove('selected');
    });
  }

  function castSpell(spellIndex) {
    const magicTier = getMagicTier();
    const cost = BASE_SPELL_COSTS[spellIndex] * magicTier;

    if (!drainMp(cost)) {
      statusText.textContent = "Not enough MP!";
      return;
    }

    if (spellIndex === 0) {
      spawnBarrier('firaga', 80 + (magicTier * 20), magicTier);
    } else if (spellIndex === 1) {
      spawnBarrier('blizzaga', 140 + (magicTier * 40), magicTier);
    } else if (spellIndex === 2) {
      const rect = arena.getBoundingClientRect();
      castThunder(rect, magicTier);
    } else if (spellIndex === 3) {
      castCure(magicTier);
    }
  }

  function castCure(tier) {
    const healAmt = 25 + tier * 15;
    healPlayer(healAmt);
    showArenaFloater(mouseX, mouseY, `+${healAmt} HP`, "var(--hp-color)");
    statusText.textContent = `${getSpellName(3)} mends your heart.`;
    playSynthTone({ wave: "sine", freq: 620 }, { pitchMult: 1, duration: 0.28, volume: 0.16, sweep: 1.35 });
    playSynthTone({ wave: "sine", freq: 620 }, { pitchMult: 1.5, duration: 0.24, volume: 0.1, sweep: 1.25 });
  }

  function spawnBarrier(type, radius, tier) {
    const el = document.createElement('div');
    el.className = `barrier ${type}-barrier`;
    
    const size = radius * 2;
    el.style.position = 'absolute';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = (mouseX - radius) + 'px';
    el.style.top = (mouseY - radius) + 'px';
    
    arena.appendChild(el);
    
    const barrier = { type, x: mouseX, y: mouseY, radius, tier, el };
    activeBarriers.push(barrier);
    
    setTimeout(() => {
      if (el.parentNode) el.remove();
      activeBarriers = activeBarriers.filter(b => b !== barrier);
    }, 4000);
  }

  function castThunder(arenaRect, tier) {
    if (!gameActive) return;

    const numBolts = tier === 3 ? 5 : (tier === 2 ? 3 : 1);
    const boltWidth = 120;
    
    let targets = [];
    if (tier === 1) {
      targets.push(mouseX);
    } else {
      targets = Array.from({ length: numBolts }, () => Math.random() * arenaRect.width);
    }

    targets.forEach((tx, index) => {
      setTimeout(() => {
        if (!gameActive) return;
        
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

        requestAnimationFrame(() => {
          el.style.opacity = '0';
        });
        setTimeout(() => {
          if (el.parentNode) el.remove();
        }, 350);
        
      }, index * 80); 
    });
  }

  // --- Input overrides for Spell Menu ---
  const magicBtn = document.getElementById("magicBtn");

  // Open menu via mobile-friendly button
  if (magicBtn) {
    magicBtn.addEventListener("click", (e) => {
      if (!gameActive) return;
      e.stopPropagation();
      spellMenuOpen = true;
      spellMenuEl.style.left = '50%';
      spellMenuEl.style.top = '50%';
      spellMenuEl.style.transform = 'translate(-50%, -50%)'; // Center on screen
      spellMenuEl.classList.remove('overlay--hidden');
      updateSpellMenuUI();
    });
  }

  // Open menu via right-click (Desktop)
  document.addEventListener('contextmenu', (e) => {
    if (!gameActive) return;
    e.preventDefault();
    spellMenuOpen = true;
    
    spellMenuEl.style.left = e.clientX + 'px';
    spellMenuEl.style.top = e.clientY + 'px';
    spellMenuEl.style.transform = 'translate(0, 0)'; // Reset transform 
    spellMenuEl.classList.remove('overlay--hidden');
    updateSpellMenuUI();
  });

  // Cycle spells via scroll wheel (Desktop)
  document.addEventListener('wheel', (e) => {
    if (!spellMenuOpen) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      currentSpellIndex = (currentSpellIndex + 1) % BASE_SPELLS.length;
    } else {
      currentSpellIndex = (currentSpellIndex - 1 + BASE_SPELLS.length) % BASE_SPELLS.length;
    }
    updateSpellMenuUI();
  }, { passive: false });

  // Hover to select spell item
  spellMenuEl.addEventListener('mouseover', (e) => {
    const hoveredSpell = e.target.closest('.spell-item');
    if (hoveredSpell) {
      const items = Array.from(spellMenuEl.querySelectorAll('.spell-item'));
      currentSpellIndex = items.indexOf(hoveredSpell);
      updateSpellMenuUI();
    }
  });

  // Click on a specific spell to cast it
  spellMenuEl.addEventListener('click', (e) => {
    if (!gameActive || !spellMenuOpen) return;
    const clickedSpell = e.target.closest('.spell-item');
    if (clickedSpell) {
      e.preventDefault();
      e.stopPropagation();
      
      const items = Array.from(spellMenuEl.querySelectorAll('.spell-item'));
      currentSpellIndex = items.indexOf(clickedSpell);
      
      spellMenuOpen = false;
      spellMenuEl.classList.add('overlay--hidden');
      castSpell(currentSpellIndex);
    }
  });

  // Click outside to dismiss the menu WITHOUT casting
  document.addEventListener('click', (e) => {
    if (!gameActive || !spellMenuOpen) return;
    
    // If the click is NOT inside the spell menu and NOT the magic button
    if (!spellMenuEl.contains(e.target) && e.target.id !== 'magicBtn') {
      spellMenuOpen = false;
      spellMenuEl.classList.add('overlay--hidden');
    }
  });

  // ---------- Wire up ----------
  document.addEventListener("DOMContentLoaded", () => {
    arena.addEventListener("click", handleArenaMiss);
    startBtn.addEventListener("click", startGame);
    restartBtn.addEventListener("click", startGame);
    muteBtn.addEventListener("click", () => {
      getAudioCtx();
      setMuted(!muted);
    });
    window.addEventListener("resize", handleResize);

    setMuted(muted);
    loadHighScore();
    buildArena();
    slots.forEach((slot) => spawnEnemy(slot, false));
    updatePlayerStats();
    updateHpFill();
  });
})();
