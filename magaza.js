// İndirme butonları cihaza göre: iPhone'da App Store, diğerlerinde Google Play.
// APP_STORE boşken iPhone'a "çok yakında" ve tarayıcıda oyna gösterilir (iOS 2026-11-06'da yayına girdi).
(function () {
  var PLAY = 'https://play.google.com/store/apps/details?id=com.birharfbirsoru.app';
  var APP_STORE = 'https://apps.apple.com/tr/app/id6829243401';
  // Kaynak etiketi: indir.html?k=instagram → Play Console "UTM ile izlenen kanallar"da instagram olarak görünür.
  // Etiketsiz gelenler "site" + sayfa adıyla işaretlenir (ör. soru sayfalarından gelen indirme: utm_source=site, utm_campaign=sorular).
  var k = (location.search.match(/[?&]k=([a-z0-9_-]{1,30})/i) || [])[1];
  var sayfa = (location.pathname.match(/\/(sorular)\//) || location.pathname.match(/([a-z0-9-]+)\.html$/i) || [0, 'ana'])[1];
  PLAY += '&referrer=' + encodeURIComponent(k ? 'utm_source=' + k + '&utm_medium=sosyal&utm_campaign=profil' : 'utm_source=site&utm_medium=web&utm_campaign=' + sayfa);
  var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.STORE_URL = ios ? APP_STORE || 'oyna.html' : PLAY;
  function apply() {
    document.querySelectorAll('[data-play]').forEach(function (a) { a.href = PLAY; });
    document.querySelectorAll('[data-store]').forEach(function (a) {
      if (!ios) { a.href = PLAY; return; }
      if (APP_STORE) { a.href = APP_STORE; a.textContent = "App Store'dan indir"; }
      else { a.href = 'oyna.html'; a.textContent = 'iPhone sürümü çok yakında · tarayıcıda oyna'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
