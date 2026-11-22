/* ============================================================
   Outils communs (élève + enseignant)
   ============================================================ */
'use strict';
const VI = (window.VI = {});

/* ---------- Stockage local sécuritaire ---------- */
VI.store = {
  get(k, def) {
    try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* plein ou bloqué */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- Communication avec Google Apps Script ---------- */
VI.urlConfiguree = () =>
  typeof GOOGLE_SCRIPT_URL === 'string' && /^https:\/\/script\.google(usercontent)?\.com\//.test(GOOGLE_SCRIPT_URL);

// POST en text/plain : évite la requête « preflight » CORS que Apps Script ne gère pas.
VI.api = async function (action, donnees = {}, delaiMs = 15000) {
  if (!VI.urlConfiguree()) throw new Error("L'URL du script Google n'est pas configurée (js/config.js).");
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), delaiMs);
  try {
    const rep = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, donnees)),
      signal: ctrl.signal,
      redirect: 'follow'
    });
    const json = await rep.json();
    if (!json.ok) { const err = new Error(json.error || 'Erreur du serveur'); err.serveur = true; throw err; }
    return json;
  } finally { clearTimeout(minuterie); }
};

/* ---------- Texte et validation ---------- */
VI.norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // enlève les accents
  .replace(/[’`]/g, "'")
  .replace(/\s+/g, ' ')
  .trim();
VI.variantes = (s) => String(s ?? '').split('/').map((x) => x.trim()).filter(Boolean);
VI.premiere = (s) => VI.variantes(s)[0] || '';
VI.echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

VI.ORDRE = ['base', 'passe', 'participe', 'fr'];
VI.FORMES = {
  base:      { label: 'Infinitif',        anglais: true,  aide: 'base form' },
  passe:     { label: 'Passé simple',     anglais: true,  aide: 'simple past' },
  participe: { label: 'Participe passé',  anglais: true,  aide: 'past participle' },
  fr:        { label: 'Traduction',       anglais: false, aide: 'en français' }
};

/* Vérifie une réponse :
   - majuscules, espaces et accents ignorés ;
   - toutes les variantes « a/b » acceptées (l'élève peut en écrire une ou plusieurs) ;
   - « to go » accepté pour « go » ; « s'asseoir » / « asseoir » acceptés en français ;
   - aucune tolérance pour les fautes d'orthographe. */
VI.verifier = function (forme, reponse, attendu) {
  const prep = (x) => {
    let n = VI.norm(x);
    if (forme === 'base') n = n.replace(/^to /, '');
    if (forme === 'fr') n = n.replace(/^(se |s')/, '');
    return n;
  };
  const acceptees = new Set(VI.variantes(attendu).map(prep));
  const parties = String(reponse ?? '').split('/').map(prep).filter(Boolean);
  return parties.length > 0 && parties.every((p) => acceptees.has(p));
};

/* ---------- Familles de verbes (apprentissage par régularités) ---------- */
VI.FAMILLES = {
  AAA:   { nom: 'Aucun changement',      explication: 'Les trois formes anglaises sont identiques.', exemple: 'cut → cut → cut' },
  ABB:   { nom: 'Passé = participe',     explication: 'Le passé et le participe passé sont pareils.', exemple: 'keep → kept → kept' },
  OUGHT: { nom: 'Famille -ought/-aught', explication: 'Passé et participe se terminent par -ought ou -aught.', exemple: 'buy → bought → bought' },
  IAU:   { nom: 'Voyelles i → a → u',    explication: 'Seule la voyelle change : i, puis a, puis u.', exemple: 'sing → sang → sung' },
  ABA:   { nom: 'Retour à la base',      explication: "Le participe passé redevient l'infinitif.", exemple: 'come → came → come' },
  ABN:   { nom: 'Participe en -n/-en',   explication: 'Trois formes différentes ; le participe finit par -n, -ne ou -en.', exemple: 'take → took → taken' },
  ABC:   { nom: 'Cas uniques',           explication: 'Trois formes différentes, sans régularité : à retenir par cœur.', exemple: 'chaque verbe est unique' }
};
VI.ORDRE_FAMILLES = ['AAA', 'ABB', 'OUGHT', 'IAU', 'ABA', 'ABN', 'ABC'];

VI.famille = function (v) {
  const b = VI.norm(VI.premiere(v.base)), p = VI.norm(VI.premiere(v.passe)), pp = VI.norm(VI.premiere(v.participe));
  if (b === p && p === pp) return 'AAA';
  if (/(ought|aught)$/.test(p) && p === pp) return 'OUGHT';
  if (p === pp) return 'ABB';
  if (b.includes('i') && b.replace('i', 'a') === p && b.replace('i', 'u') === pp) return 'IAU';
  if (b === pp) return 'ABA';
  if (/(n|ne)$/.test(pp)) return 'ABN';
  return 'ABC';
};

/* ---------- Verbes : liste par défaut, cache et serveur ---------- */
VI.verbesDefaut = () => VERBES_DEFAUT.map(([bloc, base, passe, participe, fr]) => ({ bloc, base, passe, participe, fr }));

VI.nettoyerVerbes = (liste) => (Array.isArray(liste) ? liste : [])
  .map((v) => ({
    bloc: Number(v.bloc),
    base: String(v.base || '').trim(), passe: String(v.passe || '').trim(),
    participe: String(v.participe || '').trim(), fr: String(v.fr || '').trim()
  }))
  .filter((v) => v.bloc >= 1 && v.bloc <= 4 && v.base && v.passe && v.participe && v.fr);

// Renvoie tout de suite la meilleure liste disponible (cache ou défaut)
VI.verbesLocaux = function () {
  const cache = VI.nettoyerVerbes(VI.store.get('vi:verbes', null));
  return cache.length ? cache : VI.verbesDefaut();
};
// Met à jour depuis la feuille Google ; renvoie true si la liste a changé
VI.rafraichirVerbes = async function () {
  if (!VI.urlConfiguree()) return false;
  try {
    const rep = await VI.api('getVerbs', {}, 10000);
    const liste = VI.nettoyerVerbes(rep.verbes);
    const avant = JSON.stringify(VI.store.get('vi:verbes', null));
    if (liste.length) VI.store.set('vi:verbes', liste); else VI.store.del('vi:verbes');
    return JSON.stringify(VI.store.get('vi:verbes', null)) !== avant;
  } catch (e) { return false; }
};
VI.cle = (v) => v.bloc + '|' + VI.norm(VI.premiere(v.base));

/* ---------- Thème clair/sombre et lecture facilitée ---------- */
VI.initApparence = function (btnTheme, btnLecture) {
  const html = document.documentElement;
  const sys = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const appliquer = () => {
    const t = VI.store.get('vi:theme', sys);
    html.dataset.theme = t;
    if (btnTheme) { btnTheme.textContent = t === 'dark' ? '☀️' : '🌙'; btnTheme.setAttribute('aria-label', t === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'); }
    const l = VI.store.get('vi:lecture', false);
    html.dataset.lecture = l ? 'on' : 'off';
    if (btnLecture) btnLecture.setAttribute('aria-pressed', String(l));
  };
  if (btnTheme) btnTheme.addEventListener('click', () => { VI.store.set('vi:theme', html.dataset.theme === 'dark' ? 'light' : 'dark'); appliquer(); });
  if (btnLecture) btnLecture.addEventListener('click', () => { VI.store.set('vi:lecture', !VI.store.get('vi:lecture', false)); appliquer(); });
  appliquer();
};

/* ---------- Prononciation (synthèse vocale du navigateur) ---------- */
VI.audioDispo = () => 'speechSynthesis' in window;
VI.parler = function (texte) {
  if (!VI.audioDispo()) return;
  const u = new SpeechSynthesisUtterance(String(texte).replace(/\s*\/\s*/g, ' or ').replace(/→/g, ','));
  const voix = speechSynthesis.getVoices();
  const v = voix.find((x) => /^en[-_](US|CA)/i.test(x.lang)) || voix.find((x) => /^en/i.test(x.lang));
  if (v) u.voice = v;
  u.lang = v ? v.lang : 'en-US';
  u.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
};
if (VI.audioDispo()) speechSynthesis.getVoices(); // précharge les voix

/* ---------- Petits utilitaires d'interface ---------- */
VI.$ = (sel, el = document) => el.querySelector(sel);
VI.$$ = (sel, el = document) => [...el.querySelectorAll(sel)];
VI.toast = function (html, type = '') {
  let zone = VI.$('#toasts');
  if (!zone) { zone = document.createElement('div'); zone.id = 'toasts'; zone.setAttribute('aria-live', 'polite'); document.body.appendChild(zone); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<span>' + html + '</span>';
  zone.appendChild(t);
  setTimeout(() => t.classList.add('sortie'), 3200);
  setTimeout(() => t.remove(), 3700);
};
VI.confettis = function (n = 28) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const couleurs = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];
  const zone = document.createElement('div');
  zone.className = 'confettis';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.setProperty('--x', (Math.random() * 2 - 1) * 260 + 'px');
    c.style.setProperty('--y', -(120 + Math.random() * 260) + 'px');
    c.style.setProperty('--r', Math.random() * 720 + 'deg');
    c.style.background = couleurs[i % couleurs.length];
    c.style.animationDelay = Math.random() * 0.1 + 's';
    zone.appendChild(c);
  }
  document.body.appendChild(zone);
  setTimeout(() => zone.remove(), 1600);
};
VI.melanger = (t) => { const a = t.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
VI.aujourdhui = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
VI.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Application installable (PWA) ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
