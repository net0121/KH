/*
  ENEMY ROSTER
  ============
  This is the only file you need to touch to change who shows up in the arena,
  what they look like, and what they sound like when hit.

  Each entry:
    name     - shown under the portrait
    image    - a URL to any image (square images look best, ~300x300+).
               Swap these for your own art or sprites at any time.
    points   - base score awarded when this enemy is fully defeated (3rd hit)
    tint     - a CSS color used for that enemy's hit-flash and HP pips,
               so different enemies feel distinct even with placeholder art
    speed    - how fast this enemy drifts around the arena, in pixels/second.
               Try a range like 30-90. Higher = harder to click.
    sound    - the hit sound, synthesized live so there's nothing to download.
                 wave: "sine" | "triangle" | "square" | "sawtooth"
                 freq: base pitch in Hz — lower numbers sound heavier/thuddier,
                       higher numbers sound lighter/sparklier
               Change wave/freq per enemy for a totally different hit sound.
    soundUrl - The hit sound actually played. Every enemy below has real,
               hosted MP3s (Mixkit sound effects — free, royalty-free, no
               attribution required, no download needed) wired up via
               "hitSounds": a 3-item array, one per click — [1st hit,
               2nd hit, defeating 3rd hit]. When "hitSounds" is set it's
               used instead of the synthesized "sound" tone. Swap any
               entry for your own link, or a local file like
               "assets/hit-goblin-1.mp3", any time — or delete the array
               to fall back to the synth tone.
    attack   - Optional. Gives the enemy a periodic special attack while
               it's alive. It winds up with a glowing telegraph ring (and
               visibly slows down) so the player has a fair window to
               interrupt it by landing a hit — hitting the enemy during
               the windup cancels the attack outright.
                 name        - shown in floaters/status text
                 type        - one of:
                     "cloak"       fades the enemy to low opacity, making
                                   it harder to spot for a few seconds
                     "mp-drain"    instantly drains a chunk of player MP
                     "combo-break" shatters the player's current combo
                     "dodge"       warps to a new spot and bolts away at
                                   a speed multiplier
                     "time-steal"  knocks a few seconds off the clock
                     "score-steal" siphons points straight off the score
                     "projectile"  launches a homing bolt at wherever your
                                   cursor is when it fires. If your cursor
                                   is still near that spot when the bolt
                                   arrives, it hits and damages your HP —
                                   move away in time and it whiffs.
                                   Optional "projectileCount" (default 1)
                                   fires that many bolts in a staggered
                                   burst, each re-aimed at the cursor's
                                   position at the moment it's launched.
                 color       - CSS color for the telegraph ring/glow (and,
                               for "projectile", the bolt itself)
                 telegraph   - windup duration in ms before the attack fires
                 cooldownMin/cooldownMax - random range in ms between attacks
                 power       - effect magnitude (MP amount / speed multiplier /
                               seconds stolen / points stolen / HP damage —
                               ignored by "cloak" and "combo-break")
               Delete the "attack" object on any enemy to make it passive.

  Replace the "image" value with your own link, e.g.:
    image: "https://example.com/my-shadow-creature.png"
  or a local file, e.g.:
    image: "assets/nightling.png"
*/

const ENEMY_ROSTER = [
  {
    name: "Umbra Sprite",
    image: "https://placehold.co/300x300/141a3d/ff6b9d?text=UMBRA%0ASPRITE&font=raleway",
    points: 10,
    tint: "#ff6b9d",
    speed: 55,
    sound: { wave: "triangle", freq: 330 },
    // Mixkit, free & royalty-free, no attribution required.
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav", // Magical light aura
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav", // Magical light transition
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2313.wav"  // Magic sparkle touch (defeat)
    ],
    attack: {
      name: "Shadowmeld",
      type: "cloak",
      color: "#ff6b9d",
      telegraph: 900,
      cooldownMin: 5000,
      cooldownMax: 8500,
      power: 0.3 // opacity it fades down to
    }
  },
  {
    name: "Gloom Wisp",
    image: "https://placehold.co/300x300/141a3d/6bc6ff?text=GLOOM%0AWISP&font=raleway",
    points: 15,
    tint: "#6bc6ff",
    speed: 70,
    sound: { wave: "sine", freq: 440 },
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav", // Stardust swish
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav", // Magical light sweep
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2314.wav"  // Magic sparkle poof hit (defeat)
    ],
    attack: {
      name: "Mana Leech",
      type: "mp-drain",
      color: "#6bc6ff",
      telegraph: 800,
      cooldownMin: 4500,
      cooldownMax: 8000,
      power: 18 // MP drained
    }
  },
  {
    name: "Ashen Wraith",
    image: "https://placehold.co/300x300/141a3d/f4c95d?text=ASHEN%0AWRAITH&font=raleway",
    points: 12,
    tint: "#f4c95d",
    speed: 40,
    sound: { wave: "square", freq: 220 },
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav", // Weak hit impact
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav", // Impact of a blow
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2313.wav"  // Apocalyptic stomp impact (defeat)
    ],
    attack: {
      name: "Ashen Wail",
      type: "combo-break",
      color: "#f4c95d",
      telegraph: 1100,
      cooldownMin: 6000,
      cooldownMax: 10000
    }
  },
  {
    name: "Static Nightling",
    image: "https://placehold.co/300x300/141a3d/b98bff?text=STATIC%0ANIGHTLING&font=raleway",
    points: 18,
    tint: "#b98bff",
    speed: 85,
    sound: { wave: "sawtooth", freq: 180 },
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav", // Small electric glitch
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav", // Static electric glitch
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2314.wav"  // Digital glitch break (defeat)
    ],
    attack: {
      name: "Glitch Warp",
      type: "dodge",
      color: "#b98bff",
      telegraph: 500,
      cooldownMin: 4000,
      cooldownMax: 7000,
      power: 2.2 // speed multiplier after warping
    }
  },
  {
    name: "Ember Phantom",
    image: "https://placehold.co/300x300/141a3d/ff9770?text=EMBER%0APHANTOM&font=raleway",
    points: 14,
    tint: "#ff9770",
    speed: 50,
    sound: { wave: "square", freq: 260 },
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav", // Short bass hit
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav", // Futuristic bass hit
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2313.wav"    // Falling hit on gravel (defeat)
    ],
    attack: {
      name: "Ember Surge",
      type: "time-steal",
      color: "#ff9770",
      telegraph: 1000,
      cooldownMin: 7000,
      cooldownMax: 11000,
      power: 3 // seconds stolen off the clock
    }
  },
  {
    name: "Void Glimmer",
    image: "https://placehold.co/300x300/141a3d/7ef5d0?text=VOID%0AGLIMMER&font=raleway",
    points: 20,
    tint: "#7ef5d0",
    speed: 95,
    sound: { wave: "sine", freq: 520 },
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav", // Magic wand sparkle
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav", // Magic spell of light
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2314.wav"    // Big cinematic impact (defeat)
    ],
    attack: {
      name: "Void Siphon",
      type: "score-steal",
      color: "#7ef5d0",
      telegraph: 900,
      cooldownMin: 6000,
      cooldownMax: 9500,
      power: 16 // points stolen
    }
  },
  {
    name: "Doom Specter",
    image: "https://placehold.co/300x300/141a3d/ff4d6d?text=DOOM%0ASPECTER&font=raleway",
    points: 16,
    tint: "#ff4d6d",
    speed: 45,
    sound: { wave: "sawtooth", freq: 200 },
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav", // Dark thud impact
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav", // Heavy dark impact
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2313.wav"  // Apocalyptic stomp impact (defeat)
    ],
    attack: {
      name: "Doom Bolt",
      type: "projectile",
      color: "#ff4d6d",
      telegraph: 700,
      cooldownMin: 4000,
      cooldownMax: 6500,
      power: 14, // HP damage on a landed hit
      projectileCount: 3 // fires a 3-shot burst instead of a single bolt
    }
  }
];

// How many enemy slots are active in the arena at once.
const ARENA_SIZE = 9;

// Hits required to defeat any enemy (unless the enemy defines its own "hp").
const HITS_TO_DEFEAT = 3;

/*
  BOSSES
  ======
  Endless Hunt only. Every BOSS_KILL_INTERVAL regular enemies you defeat,
  one of your active arena slots is taken over by a boss instead of
  respawning a normal enemy.

  A boss looks like a normal enemy entry but adds:
    isBoss   - true. Enlarges it on-screen and swaps its hit-pips for a
               proper health bar above the arena.
    hp       - hits required to defeat it. Make this much higher than
               HITS_TO_DEFEAT (3) — that's the whole point of a boss.
    attacks  - an ARRAY of attack objects (instead of a single "attack"),
               each shaped exactly like a normal enemy's attack. The boss
               picks one at random each time its cooldown expires, so it
               keeps mixing up its moveset instead of repeating one trick.
               Add "desktopOnly: true" to any attack that depends on a
               persistent mouse cursor (namely "projectile" attacks) —
               those are automatically dropped from the pool on touch
               devices, and the boss just uses its other attacks instead,
               so it still fights back on mobile without being unfair.

  Attack type reference: see the ENEMY_ROSTER comment above for cloak,
  mp-drain, combo-break, dodge, time-steal, score-steal, and projectile.
  Bosses can additionally use:
    "hp-slam"  a direct, unavoidable-by-dodging hit to the player's HP
               (power = damage). Can still be interrupted by landing a
               hit on the boss during its windup, same as any attack.
*/

const BOSS_KILL_INTERVAL = 50;

const BOSS_ROSTER = [
  {
    name: "Nightmare Colossus",
    image: "https://placehold.co/420x420/141a3d/ff2d55?text=NIGHTMARE%0ACOLOSSUS&font=raleway",
    isBoss: true,
    points: 4000,
    tint: "#ff2d55",
    speed: 36,
    hp: 44,
    sound: { wave: "sawtooth", freq: 130 },
    hitSounds: [
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2311.wav",
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2312.wav",
      "https://file.garden/ZnTkuwEIPj2gHUsg/se02001%2313.wav"
    ],
    attacks: [
      {
        name: "Meteor Barrage",
        type: "projectile",
        color: "#ff2d55",
        telegraph: 1100,
        cooldownMin: 3200,
        cooldownMax: 4800,
        power: 20,
        projectileCount: 9,
        desktopOnly: true // needs a persistent cursor to aim at — desktop/mouse only
      },
      {
        name: "Heartquake",
        type: "hp-slam",
        color: "#ff8a3d",
        telegraph: 1300,
        cooldownMin: 5000,
        cooldownMax: 7500,
        power: 19
      },
      {
        name: "Soul Drain",
        type: "mp-drain",
        color: "#b98bff",
        telegraph: 900,
        cooldownMin: 4500,
        cooldownMax: 6500,
        power: 55
      },
      {
        name: "Despair Wave",
        type: "combo-break",
        color: "#6bc6ff",
        telegraph: 1000,
        cooldownMin: 6000,
        cooldownMax: 9000
      }
    ]
  }
];
