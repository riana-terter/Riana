"use strict";
/* ============================================================
   Level tuning — 15 theatres. To add a level:
     1. add an entry here (bg = its background image)
     2. add its name + mission to BOTH languages in i18n.js
   Everything else adapts automatically.

   dur/spawn/speed/mp/fr : difficulty tuning
   bob    helicopter hover (cockpit backgrounds), intensity 0-1
   drift  slow lateral camera pan, intensity 0-1
   hunt   seconds between hunter-drone spawns (0 = none)
   ============================================================ */

/* ── TEST MODE ─────────────────────────────────────────────
   Set to 10 to make every level last 10 seconds while testing.
   Set to 0 before submitting to CrazyGames to restore the
   real durations below. */
const TEST_LEVEL_SECONDS = 10;

const LEVELS = [
  /*  1 · Green valley        */ { dur:40, spawn:1.55, speed:1.00, mp:.10, fr:13,  hunt:0,  bob:.3, bg:"assets/bg/level1.jpg" },
  /*  2 · Golden plains       */ { dur:45, spawn:1.42, speed:1.08, mp:.13, fr:12,  hunt:0,  bg:"assets/bg/level2.jpg" },
  /*  3 · Northern forest     */ { dur:45, spawn:1.30, speed:1.16, mp:.16, fr:11,  hunt:0,  bg:"assets/bg/level3.jpg" },
  /*  4 · Highland outpost    */ { dur:50, spawn:1.20, speed:1.24, mp:.19, fr:10,  hunt:0,  drift:.35, bg:"assets/bg/level4.jpg" },
  /*  5 · Coastal village     */ { dur:50, spawn:1.11, speed:1.32, mp:.22, fr:9.5, hunt:0,  bob:.5, bg:"assets/bg/level5.jpg" },
  /*  6 · Desert canyon       */ { dur:50, spawn:1.02, speed:1.40, mp:.26, fr:9,   hunt:0,  bg:"assets/bg/level6.jpg" },
  /*  7 · Citadel oasis       */ { dur:55, spawn:.94,  speed:1.48, mp:.30, fr:8,   hunt:0,  drift:.45, bg:"assets/bg/level7.jpg" },
  /*  8 · Offshore platform   */ { dur:55, spawn:.87,  speed:1.56, mp:.34, fr:7,   hunt:14, bob:.7, bg:"assets/bg/level8.jpg" },
  /*  9 · Sunset valley       */ { dur:60, spawn:.80,  speed:1.64, mp:.38, fr:6.5, hunt:13, bg:"assets/bg/level9.jpg" },
  /* 10 · Harbour at sunset   */ { dur:60, spawn:.74,  speed:1.72, mp:.42, fr:6,   hunt:12, drift:.6, bg:"assets/bg/level10.jpg" },
  /* 11 · Capital at sunset   */ { dur:60, spawn:.69,  speed:1.80, mp:.45, fr:5.5, hunt:11, bob:.8, bg:"assets/bg/level11.jpg" },
  /* 12 · Twilight metropolis */ { dur:60, spawn:.64,  speed:1.88, mp:.48, fr:5.5, hunt:10, bob:.8, drift:.4, bg:"assets/bg/level12.jpg" },
  /* 13 · Industrial port     */ { dur:65, spawn:.60,  speed:1.96, mp:.50, fr:5,   hunt:9,  drift:.85, bg:"assets/bg/level13.jpg" },
  /* 14 · Night over capital  */ { dur:65, spawn:.57,  speed:2.02, mp:.52, fr:5,   hunt:8,  drift:.9, bg:"assets/bg/level14.jpg" },
  /* 15 · Summit station      */ { dur:70, spawn:.54,  speed:2.08, mp:.54, fr:4.5, hunt:6,  bob:1, bg:"assets/bg/level15.jpg" }
];

/* Show a midgame ad after completing these levels (1-based),
   and after a fail before retrying. Tune freely. */
const AD_AFTER_LEVELS = new Set([2, 4, 6, 8, 10, 12]);
