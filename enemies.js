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
      "https://assets.mixkit.co/active_storage/sfx/2581/2581-preview.mp3", // Magical light aura
      "https://assets.mixkit.co/active_storage/sfx/2583/2583-preview.mp3", // Magical light transition
      "https://assets.mixkit.co/active_storage/sfx/3083/3083-preview.mp3"  // Magic sparkle touch (defeat)
    ]
  },
  {
    name: "Gloom Wisp",
    image: "https://placehold.co/300x300/141a3d/6bc6ff?text=GLOOM%0AWISP&font=raleway",
    points: 15,
    tint: "#6bc6ff",
    speed: 70,
    sound: { wave: "sine", freq: 440 },
    hitSounds: [
      "https://assets.mixkit.co/active_storage/sfx/1498/1498-preview.mp3", // Stardust swish
      "https://assets.mixkit.co/active_storage/sfx/2586/2586-preview.mp3", // Magical light sweep
      "https://assets.mixkit.co/active_storage/sfx/3082/3082-preview.mp3"  // Magic sparkle poof hit (defeat)
    ]
  },
  {
    name: "Ashen Wraith",
    image: "https://placehold.co/300x300/141a3d/f4c95d?text=ASHEN%0AWRAITH&font=raleway",
    points: 12,
    tint: "#f4c95d",
    speed: 40,
    sound: { wave: "square", freq: 220 },
    hitSounds: [
      "https://assets.mixkit.co/active_storage/sfx/2148/2148-preview.mp3", // Weak hit impact
      "https://assets.mixkit.co/active_storage/sfx/2150/2150-preview.mp3", // Impact of a blow
      "https://assets.mixkit.co/active_storage/sfx/3057/3057-preview.mp3"  // Apocalyptic stomp impact (defeat)
    ]
  },
  {
    name: "Static Nightling",
    image: "https://placehold.co/300x300/141a3d/b98bff?text=STATIC%0ANIGHTLING&font=raleway",
    points: 18,
    tint: "#b98bff",
    speed: 85,
    sound: { wave: "sawtooth", freq: 180 },
    hitSounds: [
      "https://assets.mixkit.co/active_storage/sfx/2595/2595-preview.mp3", // Small electric glitch
      "https://assets.mixkit.co/active_storage/sfx/2597/2597-preview.mp3", // Static electric glitch
      "https://assets.mixkit.co/active_storage/sfx/2951/2951-preview.mp3"  // Digital glitch break (defeat)
    ]
  },
  {
    name: "Ember Phantom",
    image: "https://placehold.co/300x300/141a3d/ff9770?text=EMBER%0APHANTOM&font=raleway",
    points: 14,
    tint: "#ff9770",
    speed: 50,
    sound: { wave: "square", freq: 260 },
    hitSounds: [
      "https://assets.mixkit.co/active_storage/sfx/2299/2299-preview.mp3", // Short bass hit
      "https://assets.mixkit.co/active_storage/sfx/2303/2303-preview.mp3", // Futuristic bass hit
      "https://assets.mixkit.co/active_storage/sfx/756/756-preview.mp3"    // Falling hit on gravel (defeat)
    ]
  },
  {
    name: "Void Glimmer",
    image: "https://placehold.co/300x300/141a3d/7ef5d0?text=VOID%0AGLIMMER&font=raleway",
    points: 20,
    tint: "#7ef5d0",
    speed: 95,
    sound: { wave: "sine", freq: 520 },
    hitSounds: [
      "https://assets.mixkit.co/active_storage/sfx/3062/3062-preview.mp3", // Magic wand sparkle
      "https://assets.mixkit.co/active_storage/sfx/2588/2588-preview.mp3", // Magic spell of light
      "https://assets.mixkit.co/active_storage/sfx/788/788-preview.mp3"    // Big cinematic impact (defeat)
    ]
  }
];

// How many enemy slots are active in the arena at once.
const ARENA_SIZE = 6;

// Hits required to defeat any enemy.
const HITS_TO_DEFEAT = 3;
