// 1 Harf 1 Soru — yönetim paneli.
// Yetki kontrolü sunucuda: her admin_* fonksiyonu önce yöneticiliği denetler (supabase/migrations/20261001000000_admin.sql).
// config.js yayında üretilir (scripts/publish-site.sh): window.ADMIN_CONFIG = { url, anonKey, turnstileKey }.
'use strict';

const cfg = window.ADMIN_CONFIG || {};
const sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, storageKey: 'bhbs-admin' } });

const $ = (id) => document.getElementById(id);
const TR_LETTERS = 'A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z'.split(' ');
const EN_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '★'];
const TOPICS = ['tarih', 'cografya', 'bilim', 'doga', 'spor', 'sanat', 'edebiyat', 'muzik', 'sinema', 'yemek', 'gunluk', 'dil', 'teknoloji', 'din', 'ekonomi', 'saglik', 'uzay', 'matematik', 'mitoloji'];
const MODES = { classic: 'Klasik', football: 'Futbol', english: 'İngilizce', ish: 'İsim-Şehir-Hayvan', blitz: 'Yıldırım', sudden: 'Ani Ölüm', kids: 'Kolay Mod', daily: 'Günün Bulmacası' };
const KINDS = { solo: 'tek', daily: 'günlük', versus: 'düello' };
const JOKERS = { length: 'Harf sayısı', letters: 'İlk harfler', swap: 'Soru değiştir', gold: 'Altın' };
const REASONS = { wrong_answer: 'cevap yanlış', unclear: 'anlaşılmıyor', typo: 'yazım hatası', other: 'diğer' };
const FB_KINDS = { oneri: 'Öneri', sikayet: 'Şikâyet', hata: 'Hata', diger: 'Diğer' };
const FB_STATUS = { yeni: 'Yeni', okundu: 'Okundu', cozuldu: 'Çözüldü' };
const PAGE = 50;

// ── Yardımcılar ──────────────────────────────────────────────────────────
// Oyuncudan gelen her metin (isim, geri bildirim, bildirimdeki cevap) buradan geçer: HTML olarak işlenmez.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (v) => (v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const fmtDay = (v) => (v ? new Date(v + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—');
const num = (v) => Number(v ?? 0).toLocaleString('tr-TR');
const trUpper = (s) => s.toLocaleUpperCase('tr-TR');

function toast(text, bad = false) {
  const t = $('toast');
  t.textContent = text;
  t.className = 'toast' + (bad ? ' bad' : '');
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), bad ? 5000 : 2500);
}

async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) {
    toast(error.message === 'Yetkisiz' ? 'Bu hesabın yönetici yetkisi yok.' : error.message, true);
    throw error;
  }
  return data;
}

function options(select, list, selected) {
  select.innerHTML = list.map(([v, label]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

// ── Giriş ────────────────────────────────────────────────────────────────
let captchaToken = null;
let captchaId = null;

function renderCaptcha() {
  if (!cfg.turnstileKey) return;
  if (!window.turnstile) return setTimeout(renderCaptcha, 200);
  if (captchaId !== null) return window.turnstile.reset(captchaId);
  captchaId = window.turnstile.render('#captcha', {
    sitekey: cfg.turnstileKey,
    language: 'tr',
    callback: (t) => (captchaToken = t),
    'expired-callback': () => (captchaToken = null),
    'error-callback': (code) => {
      $('loginErr').textContent = String(code).startsWith('1102')
        ? `Cloudflare bu adresi tanımıyor (${code}). Turnstile → Hostname listesine "${location.hostname}" eklenmeli.`
        : `Doğrulama yüklenemedi (hata ${code}). Sayfayı yenileyin.`;
      return true;
    },
  });
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginErr').textContent = '';
  if (cfg.turnstileKey && !captchaToken) return ($('loginErr').textContent = 'Önce "insan mısın" doğrulamasını tamamlayın.');
  $('loginBtn').disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value,
    options: captchaToken ? { captchaToken } : undefined,
  });
  $('loginBtn').disabled = false;
  captchaToken = null;
  if (error) {
    $('loginErr').textContent = error.message.includes('Invalid login') ? 'E-posta ya da şifre hatalı.' : error.message;
    renderCaptcha();
    return;
  }
  $('password').value = '';
  start();
});

$('logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    $('app').hidden = true;
    $('who').hidden = true;
    $('login').hidden = false;
    renderCaptcha();
    return;
  }
  $('login').hidden = true;
  $('who').hidden = false;
  $('whoEmail').textContent = data.session.user.email || 'anonim';
  const { data: ok } = await sb.rpc('is_admin');
  if (!ok) {
    $('app').hidden = true;
    $('login').hidden = false;
    $('loginForm').hidden = true;
    $('login').querySelector('p').textContent = 'Bu hesap yönetici değil. Çıkış yapıp yönetici hesabıyla girin.';
    return;
  }
  $('app').hidden = false;
  showTab(location.hash.slice(1) || 'overview');
}

// ── Sekmeler ─────────────────────────────────────────────────────────────
const loaders = {};
function showTab(name) {
  if (!loaders[name]) name = 'overview';
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => (t.hidden = t.id !== 'tab-' + name));
  history.replaceState(null, '', '#' + name);
  loaders[name]();
}
$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) showTab(b.dataset.tab);
});

function setBadge(id, n) {
  $(id).hidden = !n;
  $(id).textContent = n;
}

// ── Genel bakış ──────────────────────────────────────────────────────────
loaders.overview = async () => {
  const box = $('tab-overview');
  box.innerHTML = '<p class="muted">Yükleniyor…</p>';
  const o = await rpc('admin_overview');
  setBadge('badgeReports', o.open_reports);
  setBadge('badgeFeedback', o.new_feedback);
  const stat = (v, label) => `<div class="stat"><b>${num(v)}</b><span>${esc(label)}</span></div>`;
  const max = Math.max(1, ...o.days.map((d) => d.rounds));
  const q = o.questions || {};
  const qRow = (bank, label) => {
    const b = q[bank] || {};
    return `<tr><td>${label}</td><td>${num(b.total)}</td><td>${num(b.kolay)}</td><td>${num(b.orta)}</td><td>${num(b.zor)}</td></tr>`;
  };
  const modes = Object.entries(o.modes_7d || {}).sort((a, b) => b[1] - a[1]);
  box.innerHTML = `
    <div class="grid">
      ${stat(o.players, 'oyuncu (isim girmiş)')}
      ${stat(o.players_today, 'bugün yeni oyuncu')}
      ${stat(o.active_today, 'bugün oynayan')}
      ${stat(o.active_7d, 'son 7 günde oynayan')}
      ${stat(o.rounds_today, 'bugünkü tur')}
      ${stat(o.rounds_7d, 'son 7 gün tur')}
      ${stat(o.daily_today, 'bugün Günün Bulmacası')}
      ${stat(o.versus_today, 'bugün düello turu')}
      ${stat(o.open_reports, 'bildirilen soru')}
      ${stat(o.new_feedback, 'yeni geri bildirim')}
      ${stat(o.accounts, 'anonim hesap (toplam)')}
    </div>
    <div class="card"><b>Son 14 gün — tur sayısı</b>
      <div class="bars">${o.days.map((d) => `<div title="${esc(d.day)}: ${d.rounds} tur, ${d.players} oyuncu, ${d.new} yeni"><span>${d.rounds || ''}</span><i style="height:${(d.rounds / max) * 100}%"></i><span>${fmtDay(d.day)}</span></div>`).join('')}</div>
    </div>
    <div class="card scroll"><b>Son 14 gün</b>
      <table><tr><th>Gün</th><th>Tur</th><th>Oynayan</th><th>Yeni oyuncu</th></tr>
      ${o.days.slice().reverse().map((d) => `<tr><td>${fmtDay(d.day)}</td><td>${num(d.rounds)}</td><td>${num(d.players)}</td><td>${num(d.new)}</td></tr>`).join('')}</table>
    </div>
    <div class="card scroll"><b>Son 7 gün modlara göre</b>
      <table><tr><th>Mod</th><th>Tur</th></tr>${modes.map(([m, n]) => `<tr><td>${esc(MODES[m] || m)}</td><td>${num(n)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Henüz tur yok</td></tr>'}</table>
    </div>
    <div class="card scroll"><b>İçerik</b>
      <table><tr><th>Banka</th><th>Toplam</th><th>Kolay</th><th>Orta</th><th>Zor</th></tr>
      ${qRow('classic', 'Klasik')}${qRow('english', 'İngilizce')}${qRow('kids', 'Kolay Mod')}</table>
      <p class="muted">İsim-Şehir-Hayvan: ${num(o.words)} kelime · Futbol: ${num(o.players_fb)} aktif futbolcu</p>
    </div>`;
};

// ── Oyuncular ────────────────────────────────────────────────────────────
let playerPage = 0;
loaders.players = () => loadPlayers();
$('playerSearchBtn').addEventListener('click', () => { playerPage = 0; loadPlayers(); });
$('playerSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { playerPage = 0; loadPlayers(); } });

async function loadPlayers() {
  $('playerDetail').innerHTML = '';
  const res = await rpc('admin_players', { p_search: $('playerSearch').value, p_limit: PAGE, p_offset: playerPage * PAGE });
  $('playerList').innerHTML = `
    <div class="card scroll"><table>
      <tr><th>İsim</th><th>Katıldı</th><th>Tur</th><th>Doğru</th><th class="hide-sm">Seri</th><th class="hide-sm">Düello galibiyeti</th><th>Son tur</th></tr>
      ${res.rows.map((p) => `<tr class="click" data-id="${esc(p.id)}"><td><b>${esc(p.name)}</b></td><td>${fmtDate(p.created_at)}</td><td>${num(p.games)}</td><td>${num(p.correct_total)}</td><td class="hide-sm">${num(p.daily_streak)}</td><td class="hide-sm">${num(p.versus_wins)}</td><td>${fmtDate(p.last_round)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Oyuncu bulunamadı</td></tr>'}
    </table></div>
    ${pager(res.total, playerPage, 'player')}`;
}

function pager(total, page, key) {
  const pages = Math.ceil(total / PAGE);
  if (pages <= 1) return `<div class="pager">${num(total)} kayıt</div>`;
  return `<div class="pager"><button class="small" data-page="${key}:${page - 1}" ${page === 0 ? 'disabled' : ''}>‹ Önceki</button>
    Sayfa ${page + 1} / ${pages} · ${num(total)} kayıt
    <button class="small" data-page="${key}:${page + 1}" ${page + 1 >= pages ? 'disabled' : ''}>Sonraki ›</button></div>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-page]');
  if (!b) return;
  const [key, p] = b.dataset.page.split(':');
  if (key === 'player') { playerPage = +p; loadPlayers(); }
  if (key === 'q') { qPage = +p; loadQuestions(); }
});

$('playerList').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) openPlayer(tr.dataset.id);
});

async function openPlayer(id) {
  const d = await rpc('admin_player', { p_user: id });
  if (!d.profile) return toast('Oyuncu bulunamadı', true);
  const p = d.profile;
  const s = d.stats || {};
  const box = $('playerDetail');
  box.innerHTML = `
    <div class="card">
      <h2 style="margin:0">${esc(p.name)}</h2>
      <p class="muted">Kimlik: <code>${esc(p.id)}</code><br>
        Katıldı: ${fmtDate(p.created_at)} · Son giriş: ${fmtDate(d.account?.last_sign_in_at)} · İsim değişikliği: ${num(p.name_changes)}</p>
      <div class="grid">
        <div class="stat"><b>${num(s.games)}</b><span>tur</span></div>
        <div class="stat"><b>${num(s.correct_total)}</b><span>doğru</span></div>
        <div class="stat"><b>${num(s.daily_played)}</b><span>Günün Bulmacası</span></div>
        <div class="stat"><b>${num(s.daily_streak)} / ${num(s.daily_best_streak)}</b><span>seri / en iyi</span></div>
        <div class="stat"><b>${num(s.versus_wins)}</b><span>düello galibiyeti</span></div>
        <div class="stat"><b>${num(d.achievements)}</b><span>başarım</span></div>
      </div>

      <h3>Jokerler</h3>
      <div class="jokers">
        ${Object.entries(JOKERS).map(([k, label]) => `<label>${esc(label)}<input type="number" min="0" max="999" data-joker="${k}" value="${Number(d.jokers[k] ?? 0)}"></label>`).join('')}
        <button class="primary" id="saveJokers">Jokerleri kaydet</button>
      </div>

      <h3>İsim</h3>
      <div class="bar"><input id="newName" maxlength="20" value="${esc(p.name)}"><button id="rename">İsmi değiştir</button><button id="resetChanges" class="ghost">Değiştirme hakkını sıfırla</button></div>

      <h3>Son turlar</h3>
      <div class="scroll"><table><tr><th>Başladı</th><th>Mod</th><th>Tür</th><th>Puan</th><th>Pas</th><th>Bitti</th></tr>
        ${d.rounds.map((r) => `<tr><td>${fmtDate(r.started_at)}</td><td>${esc(MODES[r.mode] || r.mode)}</td><td>${esc(KINDS[r.kind] || r.kind)}${r.daily_day ? ' · ' + fmtDay(r.daily_day) : ''}</td><td>${r.score ?? '—'}</td><td>${num(r.passes)}</td><td>${r.finished_at ? fmtDate(r.finished_at) : '<span class="muted">yarım</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Tur yok</td></tr>'}
      </table></div>

      ${d.feedback.length ? `<h3>Geri bildirimleri</h3>${d.feedback.map((f) => `<div class="card"><span class="pill">${esc(FB_KINDS[f.kind] || f.kind)}</span> <span class="muted">${fmtDate(f.created_at)}</span><div class="msg">${esc(f.message)}</div></div>`).join('')}` : ''}
      <p class="muted">Gönderdiği soru bildirimi: ${num(d.reports)}</p>

      <h3>Tehlikeli bölge</h3>
      <p class="muted">Hesap ve bütün verileri (turlar, başarımlar, jokerler, bildirimler) kalıcı olarak silinir. Geri alınamaz.</p>
      <button class="danger" id="deleteUser">Hesabı sil</button>
    </div>`;
  box.scrollIntoView({ behavior: 'smooth' });

  $('saveJokers').onclick = async () => {
    for (const input of box.querySelectorAll('[data-joker]')) {
      const val = Math.max(0, Math.min(999, parseInt(input.value, 10) || 0));
      if (val !== Number(d.jokers[input.dataset.joker] ?? 0)) await rpc('admin_set_joker', { p_user: id, p_kind: input.dataset.joker, p_count: val });
    }
    toast('Jokerler kaydedildi');
    openPlayer(id);
  };
  $('rename').onclick = async () => {
    await rpc('admin_rename', { p_user: id, p_name: $('newName').value });
    toast('İsim değişti');
    openPlayer(id);
    loadPlayers();
  };
  $('resetChanges').onclick = async () => {
    await rpc('admin_reset_name_changes', { p_user: id });
    toast('Oyuncu ismini bir kez daha değiştirebilir');
    openPlayer(id);
  };
  $('deleteUser').onclick = async () => {
    const typed = prompt(`Silmek için oyuncunun ismini aynen yazın: ${p.name}`);
    if (typed === null) return;
    if (typed.trim() !== p.name) return toast('İsim eşleşmedi, silinmedi.', true);
    await rpc('admin_delete_user', { p_user: id });
    toast('Hesap silindi');
    loadPlayers();
  };
}

// ── Sorular ──────────────────────────────────────────────────────────────
let qPage = 0;
let qRows = [];
const lettersOf = (bank) => (bank === 'english' ? EN_LETTERS : TR_LETTERS);

function fillLetterFilter() {
  options($('qLetter'), [['', 'Tüm harfler'], ...lettersOf($('qBank').value).map((l) => [l, l])], '');
}
fillLetterFilter();
$('qBank').addEventListener('change', () => { fillLetterFilter(); qPage = 0; loadQuestions(); });
['qLetter', 'qDiff', 'qActive', 'qFlagged'].forEach((id) => $(id).addEventListener('change', () => { qPage = 0; loadQuestions(); }));
$('qSearchBtn').addEventListener('click', () => { qPage = 0; loadQuestions(); });
$('qSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { qPage = 0; loadQuestions(); } });
loaders.questions = () => loadQuestions();

async function loadQuestions() {
  const active = $('qActive').value;
  const res = await rpc('admin_questions', {
    p_bank: $('qBank').value,
    p_letter: $('qLetter').value || null,
    p_difficulty: $('qDiff').value || null,
    p_search: $('qSearch').value,
    p_active: active === '' ? null : active === 'true',
    p_flagged: $('qFlagged').checked,
    p_limit: PAGE,
    p_offset: qPage * PAGE,
  });
  qRows = res.rows;
  $('qList').innerHTML = `
    <div class="card scroll"><table>
      <tr><th>No</th><th>Harf</th><th>Soru</th><th>Cevap</th><th>Zorluk</th><th class="hide-sm">Konu</th><th class="hide-sm">Doğru %</th><th></th></tr>
      ${qRows.map((q, i) => `<tr class="${q.active ? '' : 'off'}">
        <td>${q.id}</td><td><b>${esc(q.letter)}</b></td>
        <td>${esc(q.text)}${q.flag ? `<div class="flag">⚠ ${esc(q.flag)}</div>` : ''}${q.active ? '' : '<div class="muted">pasif</div>'}</td>
        <td>${q.answers.map(esc).join(' <span class="muted">|</span> ')}</td>
        <td><span class="pill ${esc(q.difficulty)}">${esc(q.difficulty)}</span>${q.suggested_difficulty && q.suggested_difficulty !== q.difficulty ? `<div class="muted">öneri: ${esc(q.suggested_difficulty)}</div>` : ''}</td>
        <td class="hide-sm">${esc(q.topic || '—')}</td>
        <td class="hide-sm">${q.answered ? `%${q.correct_pct} <span class="muted">(${q.answered})</span>` : '—'}${q.reports ? `<div class="flag">${q.reports} bildirim</div>` : ''}</td>
        <td><button class="small" data-edit="${i}">Düzenle</button> <button class="small" data-toggle="${i}">${q.active ? 'Pasife al' : 'Aktif et'}</button></td>
      </tr>`).join('') || '<tr><td colspan="8" class="muted">Soru bulunamadı</td></tr>'}
    </table></div>
    ${pager(res.total, qPage, 'q')}`;
}

$('qList').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit]');
  const toggle = e.target.closest('[data-toggle]');
  if (edit) openQuestion(qRows[+edit.dataset.edit]);
  if (toggle) {
    const q = qRows[+toggle.dataset.toggle];
    await rpc('admin_set_question_active', { p_id: q.id, p_active: !q.active });
    toast(q.active ? 'Soru pasife alındı (artık sorulmaz)' : 'Soru yeniden aktif');
    loadQuestions();
  }
});

$('qAdd').addEventListener('click', () => openQuestion(null));
options($('fTopic'), [['', '— konu yok —'], ...TOPICS.map((t) => [t, t])], '');

let qDialogBank = 'classic';
let qDialogDone = null;
function openQuestion(q, done) {
  qDialogBank = q?.bank || $('qBank').value;
  qDialogDone = done || loadQuestions;
  options($('fLetter'), lettersOf(qDialogBank).map((l) => [l, l]), q?.letter || $('qLetter').value || lettersOf(qDialogBank)[0]);
  $('qTitle').textContent = q ? `Soru #${q.id} düzenle` : `Yeni soru (${{ classic: 'Klasik', english: 'İngilizce', kids: 'Kolay Mod' }[qDialogBank]})`;
  $('fId').value = q?.id || '';
  $('fDiff').value = q?.difficulty || 'orta';
  $('fTopic').value = q?.topic || '';
  $('fActive').checked = q ? q.active : true;
  $('fText').value = q?.text || '';
  $('fAnswers').value = (q?.answers || []).join(' | ');
  $('fErr').textContent = '';
  $('qDialog').showModal();
}
$('qCancel').addEventListener('click', () => $('qDialog').close());

$('qForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const letter = $('fLetter').value;
  const answers = $('fAnswers').value.split('|').map((a) => a.trim()).filter(Boolean);
  const text = $('fText').value.trim();
  // Cevap o harfle başlamalı (Ğ ve ★ hariç: Ğ cevabın içinde geçer, ★ bonus sorusu)
  if (!['Ğ', '★'].includes(letter)) {
    const bad = answers.filter((a) => trUpper(a[0]) !== letter);
    if (bad.length) return ($('fErr').textContent = `Şu cevaplar "${letter}" ile başlamıyor: ${bad.join(', ')}`);
  } else if (letter === 'Ğ') {
    const bad = answers.filter((a) => !a.toLocaleLowerCase('tr-TR').includes('ğ'));
    if (bad.length) return ($('fErr').textContent = `Şu cevaplarda "ğ" yok: ${bad.join(', ')}`);
  }
  if (!text || !answers.length) return ($('fErr').textContent = 'Soru ve en az bir cevap gerekli.');
  try {
    await rpc('admin_save_question', {
      p: {
        id: $('fId').value || null,
        bank: qDialogBank,
        letter,
        difficulty: $('fDiff').value,
        topic: $('fTopic').value,
        text,
        answers,
        active: $('fActive').checked,
      },
    });
  } catch (err) {
    $('fErr').textContent = err.message.includes('duplicate') ? 'Bu soru metni bankada zaten var.' : err.message;
    return;
  }
  $('qDialog').close();
  toast('Soru kaydedildi');
  qDialogDone();
});

// ── Bildirimler ──────────────────────────────────────────────────────────
let reportRows = [];
loaders.reports = async () => {
  reportRows = await rpc('admin_reports');
  setBadge('badgeReports', reportRows.length);
  $('reportList').innerHTML = reportRows.length
    ? reportRows.map((r, i) => `
      <div class="card">
        <div><span class="pill">${esc(r.bank === 'football' ? 'Futbol' : { classic: 'Klasik', english: 'İngilizce', kids: 'Kolay Mod' }[r.bank])}</span>
          <b>${esc(r.letter)}</b> · <b>${r.count}</b> bildirim · son ${fmtDate(r.last)} ${r.active ? '' : '<span class="pill">pasif</span>'}</div>
        <div class="msg"><b>${esc(r.text)}</b></div>
        <div>Cevap: ${(r.answers || []).map(esc).join(' | ')}</div>
        <div class="muted">Neden: ${Object.entries(r.reasons || {}).map(([k, n]) => `${esc(REASONS[k] || k)} (${n})`).join(', ')}</div>
        ${r.given?.length ? `<div class="muted">Oyuncuların yazdığı: ${r.given.map(esc).join(', ')}</div>` : ''}
        <div class="actions">
          ${r.question_id ? `<button class="small" data-redit="${i}">Düzenle</button>` : ''}
          ${r.active ? `<button class="small" data-roff="${i}">${r.question_id ? 'Soruyu pasife al' : 'Futbolcuyu pasife al'}</button>` : ''}
          <button class="small primary" data-rclear="${i}">İncelendi (bildirimleri kaldır)</button>
        </div>
      </div>`).join('')
    : '<p class="muted">Bekleyen bildirim yok.</p>';
};

$('reportList').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const r = reportRows[+(t.dataset.redit ?? t.dataset.roff ?? t.dataset.rclear)];
  if (t.dataset.redit) {
    openQuestion({ id: r.question_id, bank: r.bank, letter: r.letter, text: r.text, answers: r.answers, difficulty: r.difficulty, topic: r.topic, active: r.active }, loaders.reports);
  } else if (t.dataset.roff) {
    if (r.question_id) await rpc('admin_set_question_active', { p_id: r.question_id, p_active: false });
    else await rpc('admin_set_player_active', { p_player: r.player_id, p_active: false });
    toast('Pasife alındı');
    loaders.reports();
  } else if (t.dataset.rclear) {
    await rpc('admin_clear_reports', r.question_id ? { p_question: r.question_id } : { p_player: r.player_id });
    toast('Bildirimler kaldırıldı');
    loaders.reports();
  }
});

// ── Geri bildirim ────────────────────────────────────────────────────────
loaders.feedback = async () => {
  const status = $('fbStatus').value || null;
  const rows = await rpc('admin_feedback', { p_status: status, p_limit: 200 });
  if (status === 'yeni') setBadge('badgeFeedback', rows.length);
  $('fbList').innerHTML = rows.length
    ? rows.map((f) => `
      <div class="card">
        <span class="pill">${esc(FB_KINDS[f.kind] || f.kind)}</span> <b>${esc(f.player || 'isimsiz')}</b>
        <span class="muted">· ${fmtDate(f.created_at)} · ${esc(FB_STATUS[f.status] || f.status)}</span>
        <div class="msg">${esc(f.message)}</div>
        ${f.meta && Object.keys(f.meta).length ? `<div class="muted">${Object.entries(f.meta).map(([k, v]) => `${esc(k)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join(' · ')}</div>` : ''}
        <div class="actions">
          ${Object.entries(FB_STATUS).filter(([k]) => k !== f.status).map(([k, label]) => `<button class="small" data-fb="${f.id}" data-status="${k}">${label}</button>`).join('')}
          <button class="small ghost" data-player="${esc(f.user_id)}">Oyuncuyu aç</button>
        </div>
      </div>`).join('')
    : '<p class="muted">Bu durumda geri bildirim yok.</p>';
};
$('fbStatus').addEventListener('change', loaders.feedback);
$('fbList').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.fb) {
    await rpc('admin_set_feedback_status', { p_id: +b.dataset.fb, p_status: b.dataset.status });
    loaders.feedback();
  } else if (b.dataset.player) {
    showTab('players');
    openPlayer(b.dataset.player);
  }
});

// ── Günün Bulmacası ──────────────────────────────────────────────────────
loaders.daily = async () => {
  const d = await rpc('admin_daily', { p_day: $('dailyDay').value || null });
  if (!$('dailyDay').value) $('dailyDay').value = d.day;
  $('dailyBox').innerHTML = `
    <div class="grid"><div class="stat"><b>${num(d.played)}</b><span>başlayan</span></div><div class="stat"><b>${num(d.finished)}</b><span>bitiren</span></div></div>
    <div class="card scroll"><table><tr><th>Sıra</th><th>Oyuncu</th><th>Puan</th><th>Doğru</th><th>Süre (sn)</th></tr>
      ${d.rows.map((r) => `<tr class="click" data-id="${esc(r.user_id)}"><td>${r.rank}</td><td>${esc(r.name || '—')}</td><td>${num(r.score)}</td><td>${num(r.correct)}</td><td>${num(r.seconds)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Bu gün için sonuç yok</td></tr>'}
    </table></div>`;
};
$('dailyBtn').addEventListener('click', loaders.daily);
$('dailyBox').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) { showTab('players'); openPlayer(tr.dataset.id); }
});

// ── Kelimeler ────────────────────────────────────────────────────────────
let wCats = null;
loaders.words = async () => {
  const res = await rpc('admin_words', { p_category: $('wCat').value || null, p_search: $('wSearch').value, p_limit: 300 });
  if (!wCats) {
    wCats = res.categories;
    options($('wCat'), wCats.map((c) => [c.id, `${c.name} (${c.count})`]), wCats[0]?.id);
    return loaders.words();
  }
  $('wList').innerHTML = `<p class="muted">${res.rows.length} kelime gösteriliyor${res.rows.length >= 300 ? ' (ilk 300 — aramayı daraltın)' : ''}</p>
    <div class="chips">${res.rows.map((w) => `<span class="chip">${esc(w.word)}<button title="Sil" data-word="${esc(w.word)}">×</button></span>`).join('')}</div>`;
};
$('wCat').addEventListener('change', loaders.words);
$('wSearchBtn').addEventListener('click', loaders.words);
$('wSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') loaders.words(); });
$('wAdd').addEventListener('click', async () => {
  const word = $('wNew').value.trim();
  if (!word) return;
  await rpc('admin_add_word', { p_category: $('wCat').value, p_word: trUpper(word[0]) + word.slice(1) });
  $('wNew').value = '';
  toast('Kelime eklendi');
  wCats = null;
  const cat = $('wCat').value;
  await loaders.words();
  $('wCat').value = cat;
});
$('wList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-word]');
  if (!b || !confirm(`"${b.dataset.word}" silinsin mi?`)) return;
  await rpc('admin_remove_word', { p_category: $('wCat').value, p_word: b.dataset.word });
  toast('Kelime silindi');
  loaders.words();
});

// ── Yasaklı kelimeler ────────────────────────────────────────────────────
const B_MODES = { exact: 'tam', prefix: 'başı', contains: 'içinde' };
loaders.banned = async () => {
  const rows = await rpc('admin_banned_words');
  $('bList').innerHTML = `<p class="muted">${rows.length} kelime</p><div class="chips">${rows.map((b) => `<span class="chip">${esc(b.word)} <span class="muted">${B_MODES[b.mode]}</span><button title="Kaldır" data-banned="${esc(b.word)}">×</button></span>`).join('')}</div>`;
};
$('bAdd').addEventListener('click', async () => {
  if (!$('bNew').value.trim()) return;
  const w = await rpc('admin_add_banned', { p_word: $('bNew').value, p_mode: $('bMode').value });
  $('bNew').value = '';
  toast(`"${w}" eklendi`);
  loaders.banned();
});
$('bList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-banned]');
  if (!b || !confirm(`"${b.dataset.banned}" listeden çıkarılsın mı?`)) return;
  await rpc('admin_remove_banned', { p_word: b.dataset.banned });
  loaders.banned();
});

// ── İşlem kaydı ──────────────────────────────────────────────────────────
const ACTIONS = {
  set_joker: 'Joker ayarlandı', rename: 'İsim değişti', reset_name_changes: 'İsim hakkı sıfırlandı', delete_user: 'Hesap silindi',
  add_question: 'Soru eklendi', edit_question: 'Soru düzenlendi', activate_question: 'Soru aktif', deactivate_question: 'Soru pasif',
  clear_reports: 'Bildirim kaldırıldı', football_player_active: 'Futbolcu durumu', feedback_status: 'Geri bildirim durumu',
  add_banned: 'Yasaklı kelime eklendi', remove_banned: 'Yasaklı kelime kaldırıldı', add_word: 'Kelime eklendi', remove_word: 'Kelime silindi',
};
loaders.log = async () => {
  const rows = await rpc('admin_log_list', { p_limit: 200 });
  $('logList').innerHTML = `<div class="card scroll"><table><tr><th>Zaman</th><th>Yönetici</th><th>İşlem</th><th>Hedef</th><th>Ayrıntı</th></tr>
    ${rows.map((l) => `<tr><td>${fmtDate(l.created_at)}</td><td>${esc(l.admin)}</td><td>${esc(ACTIONS[l.action] || l.action)}</td><td><code>${esc(l.target)}</code></td><td class="muted">${esc(JSON.stringify(l.details))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Kayıt yok</td></tr>'}
  </table></div>`;
};

// ── Başlat ───────────────────────────────────────────────────────────────
if (!cfg.url || !cfg.anonKey) {
  document.body.innerHTML = '<p style="padding:24px">config.js eksik. Paneli <code>sh scripts/publish-site.sh</code> ile yayınlayın ya da yerelde <code>sh scripts/publish-site.sh --local</code> çalıştırın.</p>';
} else {
  sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') location.reload(); });
  start();
}
