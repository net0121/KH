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
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_m01.wav", // Magical light aura
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_s01.wav", // Magical light transition
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_single_l01.wav"  // Magic sparkle touch (defeat)
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
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_m01.wav", // Stardust swish
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_s01.wav", // Magical light sweep
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_single_l01.wav"  // Magic sparkle poof hit (defeat)
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
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_m01.wav", // Weak hit impact
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_s01.wav", // Impact of a blow
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_single_l01.wav"  // Apocalyptic stomp impact (defeat)
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
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_m01.wav", // Small electric glitch
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_s01.wav", // Static electric glitch
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_single_l01.wav"  // Digital glitch break (defeat)
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
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_m01.wav", // Short bass hit
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_s01.wav", // Futuristic bass hit
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_single_l01.wav"    // Falling hit on gravel (defeat)
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
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_m01.wav", // Magic wand sparkle
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_s01.wav", // Magic spell of light
      "https://file.garden/ZnTkuwEIPj2gHUsg/se_trail_hit_cleave_single_l01.wav"    // Big cinematic impact (defeat)
    ]
  }
];

// How many enemy slots are active in the arena at once.
const ARENA_SIZE = 6;

// Hits required to defeat any enemy.
const HITS_TO_DEFEAT = 3;
