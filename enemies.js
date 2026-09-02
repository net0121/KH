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
    soundUrl - The hit sound actually played. Every enemy below points at a
               real, hosted MP3 (Mixkit sound effects — free, royalty-free,
               no attribution required, no download needed). When soundUrl
               is set it's used instead of the synthesized "sound" tone.
               Swap it for your own link, or a local file like
               "assets/hit-goblin.mp3", any time — or delete the line to
               fall back to the synth tone.

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
    // "Magic sparkle touch" — Mixkit, free & royalty-free, no attribution required.
    soundUrl: "https://assets.mixkit.co/active_storage/sfx/3083/3083-preview.mp3"
  },
  {
    name: "Gloom Wisp",
    image: "https://placehold.co/300x300/141a3d/6bc6ff?text=GLOOM%0AWISP&font=raleway",
    points: 15,
    tint: "#6bc6ff",
    speed: 70,
    sound: { wave: "sine", freq: 440 },
    // "Stardust swish" — Mixkit.
    soundUrl: "https://assets.mixkit.co/active_storage/sfx/1498/1498-preview.mp3"
  },
  {
    name: "Ashen Wraith",
    image: "https://placehold.co/300x300/141a3d/f4c95d?text=ASHEN%0AWRAITH&font=raleway",
    points: 12,
    tint: "#f4c95d",
    speed: 40,
    sound: { wave: "square", freq: 220 },
    // "Magic spell of light" — Mixkit.
    soundUrl: "https://assets.mixkit.co/active_storage/sfx/2588/2588-preview.mp3"
  },
  {
    name: "Static Nightling",
    image: "https://placehold.co/300x300/141a3d/b98bff?text=STATIC%0ANIGHTLING&font=raleway",
    points: 18,
    tint: "#b98bff",
    speed: 85,
    sound: { wave: "sawtooth", freq: 180 },
    // "Small electric glitch" — Mixkit.
    soundUrl: "https://assets.mixkit.co/active_storage/sfx/2595/2595-preview.mp3"
  },
  {
    name: "Ember Phantom",
    image: "https://placehold.co/300x300/141a3d/ff9770?text=EMBER%0APHANTOM&font=raleway",
    points: 14,
    tint: "#ff9770",
    speed: 50,
    sound: { wave: "square", freq: 260 },
    // "Exciting fast hit" — Mixkit.
    soundUrl: "https://assets.mixkit.co/active_storage/sfx/2180/2180-preview.mp3"
  },
  {
    name: "Void Glimmer",
    image: "https://placehold.co/300x300/141a3d/7ef5d0?text=VOID%0AGLIMMER&font=raleway",
    points: 20,
    tint: "#7ef5d0",
    speed: 95,
    sound: { wave: "sine", freq: 520 },
    // "Magic wand sparkle" — Mixkit.
    soundUrl: "https://assets.mixkit.co/active_storage/sfx/3062/3062-preview.mp3"
  }
];

// How many enemy slots are active in the arena at once.
const ARENA_SIZE = 6;

// Hits required to defeat any enemy.
const HITS_TO_DEFEAT = 3;
