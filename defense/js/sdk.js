"use strict";
/* ============================================================
   CrazyGames SDK v3 wrapper.
   Every call is guarded so the game runs identically on
   localhost / any host where the SDK is absent or blocked.
   ============================================================ */
const CG = (() => {
  let sdk = null;
  let ready = false;

  async function init() {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) {
        await window.CrazyGames.SDK.init();
        sdk = window.CrazyGames.SDK;
        ready = true;
      }
    } catch (e) {
      console.warn("[CG] SDK init failed, running standalone.", e);
    }
    return ready;
  }

  function safe(fn) {
    if (!ready || !sdk) return;
    try { fn(sdk); } catch (e) { console.warn("[CG]", e); }
  }

  return {
    init,
    get ready() { return ready; },
    loadingStart: () => safe(s => s.game.loadingStart()),
    loadingStop:  () => safe(s => s.game.loadingStop()),
    gameplayStart:() => safe(s => s.game.gameplayStart()),
    gameplayStop: () => safe(s => s.game.gameplayStop()),
    happytime:    () => safe(s => s.game.happytime()),

    /* Rewarded ad: hooks.rewarded() fires only if the ad was fully
       watched; hooks.pause()/hooks.resume() bracket the ad.
       Standalone (no SDK): grant immediately so the game stays testable. */
    rewardedAd(hooks) {
      if (!ready || !sdk) { try{hooks.rewarded();}catch(e){} hooks.resume(); return; }
      let done = false;
      const finish = (grant) => {
        if (done) return; done = true;
        if (grant) { try{hooks.rewarded();}catch(e){} }
        hooks.resume();
      };
      try {
        sdk.ad.requestAd("rewarded", {
          adStarted: () => { try { hooks.pause(); } catch (e) {} },
          adFinished: () => finish(true),
          adError: () => finish(false)
        });
      } catch (e) {
        console.warn("[CG] rewarded requestAd failed", e);
        finish(false);
      }
    },

    /* Midgame ad at a natural break.
       hooks.pause() is called when the ad starts (mute + freeze),
       hooks.resume() when it ends or errors (always called exactly once). */
    midgameAd(hooks) {
      if (!ready || !sdk) { hooks.resume(); return; }
      let resumed = false;
      const resume = () => { if (!resumed) { resumed = true; hooks.resume(); } };
      try {
        sdk.ad.requestAd("midgame", {
          adStarted: () => { try { hooks.pause(); } catch (e) {} },
          adFinished: resume,
          adError: resume
        });
      } catch (e) {
        console.warn("[CG] requestAd failed", e);
        resume();
      }
    }
  };
})();
