/*
  ENEMY ROSTER
  ============
  This is the only file you need to touch to change who shows up in the arena.

  Each entry:
    name    - shown under the portrait
    image   - a URL to any image (square images look best, ~300x300+).
              Swap these for your own art or sprites at any time — for
              example, drop in your own creature/character renders here.
    points  - base score awarded when this enemy is fully defeated (3rd hit)
    tint    - a CSS color used for that enemy's hit-flash and HP pips,
              so different enemies feel distinct even with placeholder art

  All entries below use placehold.co so the game works out of the box.
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
    tint: "#ff6b9d"
  },
  {
    name: "Gloom Wisp",
    image: "https://placehold.co/300x300/141a3d/6bc6ff?text=GLOOM%0AWISP&font=raleway",
    points: 15,
    tint: "#6bc6ff"
  },
  {
    name: "Ashen Wraith",
    image: "https://placehold.co/300x300/141a3d/f4c95d?text=ASHEN%0AWRAITH&font=raleway",
    points: 12,
    tint: "#f4c95d"
  },
  {
    name: "Static Nightling",
    image: "https://placehold.co/300x300/141a3d/b98bff?text=STATIC%0ANIGHTLING&font=raleway",
    points: 18,
    tint: "#b98bff"
  },
  {
    name: "Ember Phantom",
    image: "https://placehold.co/300x300/141a3d/ff9770?text=EMBER%0APHANTOM&font=raleway",
    points: 14,
    tint: "#ff9770"
  },
  {
    name: "Void Glimmer",
    image: "https://placehold.co/300x300/141a3d/7ef5d0?text=VOID%0AGLIMMER&font=raleway",
    points: 20,
    tint: "#7ef5d0"
  }
];

// How many enemy slots are active in the arena at once.
const ARENA_SIZE = 6;

// Hits required to defeat any enemy.
const HITS_TO_DEFEAT = 3;
