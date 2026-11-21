/**
 * ============================================================
 *  IrregularVerbs — Base de données Google Sheets
 *  À coller dans : Extensions > Apps Script (depuis ta feuille Google)
 * ============================================================
 *  1. Colle ce code, enregistre (💾).
 *  2. Recharge la feuille : un menu « Verbes irréguliers » apparaît.
 *  3. Menu > « 1. Préparer la feuille », puis « 2. Définir le NIP ».
 *  4. Déployer > Nouveau déploiement > Application Web
 *       Exécuter en tant que : Moi
 *       Qui a accès : Tout le monde
 *  5. Copie l'URL (…/exec) dans js/config.js du site.
 * ============================================================
 */

const FEUILLE_RESULTATS = 'Résultats';
const FEUILLE_VERBES = 'Verbes';
const ENTETES_RESULTATS = ['Date', 'Code', 'Groupe', 'Bloc', 'Activité', 'Score', 'Maximum', 'Pourcentage', 'Durée (s)', 'Questions', 'Réussis', 'Ratés', 'ID'];
const ENTETES_VERBES = ['Bloc', 'Infinitif', 'Passé', 'Participe passé', 'Français'];
const MODES = ['quiz', 'entrainement', 'sprint', 'difficiles'];

/* ---------------- Menu dans la feuille ---------------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Verbes irréguliers')
    .addItem('1. Préparer la feuille', 'preparerFeuille')
    .addItem('2. Définir ou changer le NIP', 'definirNip')
    .addToUi();
}

function preparerFeuille() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const res = obtenirFeuille_(FEUILLE_RESULTATS, ENTETES_RESULTATS);
  const ver = obtenirFeuille_(FEUILLE_VERBES, ENTETES_VERBES);
  res.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  [res, ver].forEach(function (f) { f.setFrozenRows(1); f.getRange(1, 1, 1, f.getLastColumn()).setFontWeight('bold').setBackground('#ebeaff'); });
  const defaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (defaut && defaut.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(defaut);
  SpreadsheetApp.getUi().alert('✅ Feuille prête.\n\nÉtape suivante : menu « Verbes irréguliers » > « 2. Définir ou changer le NIP ».\n\nAstuce : l\'onglet « Verbes » peut rester vide. La liste par défaut sera utilisée et tu pourras la modifier dans l\'espace enseignant.');
}

function definirNip() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('NIP enseignant', 'Choisis un NIP de 4 à 8 chiffres :', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const nip = r.getResponseText().trim();
  if (!/^\d{4,8}$/.test(nip)) { ui.alert('Le NIP doit contenir de 4 à 8 chiffres. Recommence.'); return; }
  enregistrerNip_(nip);
  ui.alert('🔑 NIP enregistré. Il est conservé sous forme chiffrée dans les propriétés du script (pas dans la feuille).');
}

/* ---------------- Points d'entrée Web ---------------- */
function doGet(e) {
  return repondre_(traiter_((e && e.parameter) || {}));
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return repondre_({ ok: false, error: 'Requête invalide.' }); }
  return repondre_(traiter_(req));
}

function traiter_(req) {
  try {
    switch (req.action) {
      case 'ping':       return { ok: true, message: 'Le script fonctionne.' };
      case 'getVerbs':   return { ok: true, verbes: lireVerbes_() };
      case 'submit':     return enregistrerResultat_(req.data || {});
      case 'login':      verifierNip_(req.pin); return { ok: true };
      case 'getResults': verifierNip_(req.pin); return { ok: true, lignes: lireResultats_() };
      case 'saveVerbs':  verifierNip_(req.pin); return sauverVerbes_(req.verbes);
      case 'deleteGroup':verifierNip_(req.pin); return supprimerGroupe_(req.groupe);
      case 'changePin':
        verifierNip_(req.pin);
        if (!/^\d{4,8}$/.test(String(req.nouveau || ''))) throw new Error('Le NIP doit contenir de 4 à 8 chiffres.');
        enregistrerNip_(String(req.nouveau));
        return { ok: true };
      default: return { ok: false, error: 'Action inconnue.' };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function repondre_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- NIP (haché + protection contre les essais répétés) ---------------- */
function enregistrerNip_(nip) {
  const p = PropertiesService.getScriptProperties();
  const sel = Utilities.getUuid();
  p.setProperty('NIP_SEL', sel);
  p.setProperty('NIP_HASH', hacher_(sel + nip));
}

function hacher_(texte) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texte, Utilities.Charset.UTF_8));
}

function verifierNip_(nip) {
  const cache = CacheService.getScriptCache();
  const echecs = Number(cache.get('echecs_nip') || 0);
  if (echecs >= 5) throw new Error('Trop d\'essais de NIP. Réessaie dans 5 minutes.');
  const p = PropertiesService.getScriptProperties();
  const hash = p.getProperty('NIP_HASH');
  if (!hash) throw new Error('Aucun NIP configuré : dans la feuille, utilise le menu « Verbes irréguliers > Définir ou changer le NIP ».');
  if (hacher_((p.getProperty('NIP_SEL') || '') + String(nip || '')) !== hash) {
    cache.put('echecs_nip', String(echecs + 1), 300);
    throw new Error('NIP incorrect.');
  }
  cache.remove('echecs_nip');
}

/* ---------------- Feuilles ---------------- */
function obtenirFeuille_(nom, entetes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let f = ss.getSheetByName(nom);
  if (!f) f = ss.insertSheet(nom);
  if (f.getLastRow() === 0) f.appendRow(entetes);
  return f;
}

/* ---------------- Résultats ---------------- */
function enregistrerResultat_(d) {
  const code = String(d.code || '').toUpperCase().trim();
  if (!/^\d{1,4}-[A-Z]{2,4}\d?$/.test(code)) throw new Error('Code élève invalide.');
  const groupe = code.split('-')[0];
  const bloc = Number(d.bloc);
  if (!(bloc >= 1 && bloc <= 4)) throw new Error('Bloc invalide.');
  const mode = MODES.indexOf(d.mode) >= 0 ? d.mode : 'entrainement';
  const nombre = function (x, max) { const n = Number(x); return isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; };
  const liste = function (x) { return String(x || '').replace(/[^a-zA-Z,\- ']/g, '').slice(0, 1500); };
  const id = String(d.id || '').slice(0, 40);

  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = obtenirFeuille_(FEUILLE_RESULTATS, ENTETES_RESULTATS);
    // Évite les doublons quand un envoi hors-ligne est réessayé
    const der = f.getLastRow();
    if (id && der > 1) {
      const debut = Math.max(2, der - 300);
      const ids = f.getRange(debut, 13, der - debut + 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return { ok: true, doublon: true };
    }
    f.appendRow([new Date(), code, "'" + groupe, bloc, mode, nombre(d.score, 10000), nombre(d.max, 10000), nombre(d.pct, 100),
                 nombre(d.duree, 36000), nombre(d.questions, 1000), liste(d.reussis), liste(d.rates), id]);
  } finally { verrou.releaseLock(); }
  return { ok: true };
}

function lireResultats_() {
  const f = obtenirFeuille_(FEUILLE_RESULTATS, ENTETES_RESULTATS);
  const n = f.getLastRow();
  if (n < 2) return [];
  return f.getRange(2, 1, n - 1, 13).getValues().filter(function (r) { return r[1]; }).map(function (r) {
    return {
      date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), code: String(r[1]), groupe: String(r[2]),
      bloc: r[3], mode: r[4], score: r[5], max: r[6], pct: r[7], duree: r[8], questions: r[9],
      reussis: String(r[10] || ''), rates: String(r[11] || '')
    };
  });
}

function supprimerGroupe_(groupe) {
  groupe = String(groupe || '').trim();
  if (!/^\d{1,4}$/.test(groupe)) throw new Error('Groupe invalide.');
  const verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    const f = obtenirFeuille_(FEUILLE_RESULTATS, ENTETES_RESULTATS);
    const n = f.getLastRow();
    if (n < 2) return { ok: true, supprimees: 0 };
    const nbCol = ENTETES_RESULTATS.length;
    const donnees = f.getRange(2, 1, n - 1, nbCol).getValues();
    const garder = donnees.filter(function (r) { return String(r[2]) !== groupe; });
    const supprimees = donnees.length - garder.length;
    if (supprimees) {
      f.getRange(2, 1, n - 1, nbCol).clearContent();
      if (garder.length) f.getRange(2, 1, garder.length, nbCol).setValues(garder);
      if (n - 1 > garder.length) f.deleteRows(2 + garder.length, n - 1 - garder.length);
    }
    return { ok: true, supprimees: supprimees };
  } finally { verrou.releaseLock(); }
}

/* ---------------- Verbes ---------------- */
function lireVerbes_() {
  const f = obtenirFeuille_(FEUILLE_VERBES, ENTETES_VERBES);
  const n = f.getLastRow();
  if (n < 2) return [];
  return f.getRange(2, 1, n - 1, 5).getValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return { bloc: Number(r[0]), base: String(r[1]).trim(), passe: String(r[2]).trim(), participe: String(r[3]).trim(), fr: String(r[4]).trim() }; });
}

function sauverVerbes_(verbes) {
  if (!Array.isArray(verbes) || !verbes.length || verbes.length > 400) throw new Error('Liste de verbes invalide.');
  const propre = function (x) { return String(x || '').trim().slice(0, 80); };
  const lignes = verbes.map(function (v) { return [Number(v.bloc), propre(v.base), propre(v.passe), propre(v.participe), propre(v.fr)]; })
    .filter(function (r) { return r[0] >= 1 && r[0] <= 4 && r[1] && r[2] && r[3] && r[4]; });
  if (!lignes.length) throw new Error('Aucun verbe valide.');
  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    const f = obtenirFeuille_(FEUILLE_VERBES, ENTETES_VERBES);
    if (f.getLastRow() > 1) f.getRange(2, 1, f.getLastRow() - 1, 5).clearContent();
    f.getRange(2, 1, lignes.length, 5).setValues(lignes);
  } finally { verrou.releaseLock(); }
  return { ok: true, nombre: lignes.length };
}
