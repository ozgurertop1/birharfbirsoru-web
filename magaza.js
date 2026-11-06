// İndirme butonları cihaza göre: iPhone'da App Store, diğerlerinde Google Play.
// APP_STORE boşken iPhone'a "çok yakında" ve tarayıcıda oyna gösterilir (iOS 2026-11-06'da yayına girdi).
(function () {
  var PLAY = 'https://play.google.com/store/apps/details?id=com.birharfbirsoru.app';
  var APP_STORE = 'https://apps.apple.com/tr/app/id6829243401';
  var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.STORE_URL = ios ? APP_STORE || 'oyna.html' : PLAY;
  function apply() {
    document.querySelectorAll('[data-store]').forEach(function (a) {
      if (!ios) return;
      if (APP_STORE) { a.href = APP_STORE; a.textContent = "App Store'dan indir"; }
      else { a.href = 'oyna.html'; a.textContent = 'iPhone sürümü çok yakında · tarayıcıda oyna'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
