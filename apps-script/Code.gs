/**
 * ============================================================
 *  IrregularVerbs — Base de données Google Sheets (version 2 : multi-enseignants)
 *  À coller dans : Extensions > Apps Script (depuis ta feuille Google)
 * ============================================================
 *  Première installation :
 *  1. Colle ce code, enregistre (💾).
 *  2. Recharge la feuille : un menu « Verbes irréguliers » apparaît.
 *  3. Menu > « 1. Préparer la feuille », puis « 2. Définir le NIP administrateur ».
 *  4. Déployer > Nouveau déploiement > Application Web
 *       Exécuter en tant que : Moi      Qui a accès : Tout le monde
 *  5. Copie l'URL (…/exec) dans js/config.js du site.
 *
 *  Mise à jour depuis la version 1 :
 *  colle ce code, enregistre, relance « 1. Préparer la feuille »,
 *  puis Déployer > Gérer les déploiements > ✏️ > Nouvelle version.
 * ============================================================
 *  Rôles
 *  - Administrateur (identifiant « admin ») : voit et gère tout.
 *  - Enseignant (compte créé par l'administrateur) : crée ses groupes,
 *    voit et supprime uniquement les données de ses groupes.
 *  Le tri des données se fait ICI, côté serveur : un enseignant ne reçoit
 *  jamais les résultats des groupes des autres.
 * ============================================================
 */

const F_RES = 'Résultats';
const F_VERBES = 'Verbes';
const F_ENS = 'Enseignants';
const F_GRP = 'Groupes';
const E_RES = ['Date', 'Code', 'Groupe', 'Bloc', 'Activité', 'Score', 'Maximum', 'Pourcentage', 'Durée (s)', 'Questions', 'Réussis', 'Ratés', 'ID'];
const E_VERBES = ['Bloc', 'Infinitif', 'Passé', 'Participe passé', 'Français'];
const E_ENS = ['Identifiant', 'Nom', 'Empreinte du NIP (ne pas modifier)', 'Sel (ne pas modifier)', 'Actif', 'Créé le'];
const E_GRP = ['Groupe', 'Enseignant (identifiant)', 'Créé le'];
const MODES = ['quiz', 'entrainement', 'sprint', 'difficiles'];
const DUREE_SESSION = 21600; // 6 heures (maximum permis par le cache)
const ADMIN = 'admin';

/* ================= Menu dans la feuille ================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Verbes irréguliers')
    .addItem('1. Préparer la feuille', 'preparerFeuille')
    .addItem('2. Définir ou changer le NIP administrateur', 'definirNip')
    .addToUi();
}

function preparerFeuille() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuilles = [feuille_(F_RES, E_RES), feuille_(F_VERBES, E_VERBES), feuille_(F_GRP, E_GRP), feuille_(F_ENS, E_ENS)];
  feuilles[0].getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  feuilles.forEach(function (f) {
    f.setFrozenRows(1);
    f.getRange(1, 1, 1, f.getLastColumn()).setFontWeight('bold').setBackground('#ebeaff');
  });
  const defaut = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (defaut && defaut.getLastRow() === 0 && ss.getSheets().length > 4) ss.deleteSheet(defaut);
  SpreadsheetApp.getUi().alert('✅ Feuille prête (onglets Résultats, Verbes, Groupes, Enseignants).\n\n' +
    'Si ce n\'est pas déjà fait : menu « Verbes irréguliers » > « 2. Définir ou changer le NIP administrateur ».\n\n' +
    'Les comptes enseignants se créent ensuite dans l\'espace enseignant du site (identifiant : admin).');
}

function definirNip() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('NIP administrateur', 'Choisis un NIP de 4 à 8 chiffres (identifiant de connexion : admin) :', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const nip = r.getResponseText().trim();
  if (!/^\d{4,8}$/.test(nip)) { ui.alert('Le NIP doit contenir de 4 à 8 chiffres. Recommence.'); return; }
  enregistrerNipAdmin_(nip);
  ui.alert('🔑 NIP administrateur enregistré (chiffré dans les propriétés du script).\nConnexion sur le site : identifiant « admin » + ce NIP.');
}

/* ================= Points d'entrée Web ================= */
function doGet(e) { return repondre_(traiter_((e && e.parameter) || {})); }

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return repondre_({ ok: false, error: 'Requête invalide.' }); }
  return repondre_(traiter_(req));
}

function repondre_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function traiter_(req) {
  try {
    // ---- Actions publiques (élèves)
    switch (req.action) {
      case 'ping':      return { ok: true, message: 'Le script fonctionne.', version: 2 };
      case 'getVerbs':  return { ok: true, verbes: lireVerbes_() };
      case 'getGroups': return { ok: true, groupes: listeGroupes_().map(function (g) { return g.groupe; }) };
      case 'submit':    return enregistrerResultat_(req.data || {});
      case 'login':     return connexion_(req.identifiant, req.pin);
    }
    // ---- Actions qui exigent une session
    const s = session_(req.token);
    switch (req.action) {
      case 'logout':        CacheService.getScriptCache().remove('s_' + req.token); return { ok: true };
      case 'whoami':        return { ok: true, session: s };
      case 'getResults':    return { ok: true, lignes: lireResultats_(s) };
      case 'listGroups':    return groupesPour_(s);
      case 'createGroup':   return creerGroupe_(s, req.groupe, req.proprietaire);
      case 'deleteGroup':   return supprimerGroupe_(s, req.groupe, !!req.resultatsSeulement);
      case 'changePin':     return changerMonNip_(s, req.nouveau);
    }
    // ---- Actions réservées à l'administrateur
    if (s.role !== 'admin') throw new Error('Action réservée à l\'administrateur.');
    switch (req.action) {
      case 'saveVerbs':     return sauverVerbes_(req.verbes);
      case 'reassignGroup': return reattribuerGroupe_(req.groupe, req.proprietaire);
      case 'listTeachers':  return { ok: true, enseignants: listeEnseignants_() };
      case 'saveTeacher':   return sauverEnseignant_(req);
      case 'deleteTeacher': return supprimerEnseignant_(req.identifiant);
    }
    return { ok: false, error: 'Action inconnue.' };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/* ================= Sécurité : NIP et sessions ================= */
function hacher_(texte) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texte, Utilities.Charset.UTF_8));
}
function nipValide_(nip) { return /^\d{4,8}$/.test(String(nip || '')); }

function enregistrerNipAdmin_(nip) {
  const p = PropertiesService.getScriptProperties();
  const sel = Utilities.getUuid();
  p.setProperty('NIP_SEL', sel);
  p.setProperty('NIP_HASH', hacher_(sel + nip));
}

function connexion_(identifiant, nip) {
  const id = String(identifiant || '').trim().toLowerCase();
  if (!id) throw new Error('Entre ton identifiant.');
  const cache = CacheService.getScriptCache();
  const cleEchecs = 'echecs_' + id;
  const echecs = Number(cache.get(cleEchecs) || 0);
  if (echecs >= 5) throw new Error('Trop d\'essais pour cet identifiant. Réessaie dans 5 minutes.');

  let session = null;
  if (id === ADMIN) {
    const p = PropertiesService.getScriptProperties();
    const hash = p.getProperty('NIP_HASH');
    if (!hash) throw new Error('Aucun NIP administrateur : dans la feuille, utilise le menu « Verbes irréguliers > Définir ou changer le NIP administrateur ».');
    if (hacher_((p.getProperty('NIP_SEL') || '') + String(nip || '')) === hash) session = { id: ADMIN, role: 'admin', nom: 'Administrateur' };
  } else {
    const e = trouverEnseignant_(id);
    if (e && e.actif && hacher_(e.sel + String(nip || '')) === e.hash) session = { id: e.identifiant, role: 'enseignant', nom: e.nom };
  }
  if (!session) {
    cache.put(cleEchecs, String(echecs + 1), 300);
    throw new Error('Identifiant ou NIP incorrect.');
  }
  cache.remove(cleEchecs);
  const jeton = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  cache.put('s_' + jeton, JSON.stringify(session), DUREE_SESSION);
  return { ok: true, token: jeton, session: session };
}

function session_(jeton) {
  if (!jeton) throw new Error('Session expirée : reconnecte-toi.');
  const cache = CacheService.getScriptCache();
  const brut = cache.get('s_' + jeton);
  if (!brut) throw new Error('Session expirée : reconnecte-toi.');
  const s = JSON.parse(brut);
  if (s.role === 'enseignant') {
    const e = trouverEnseignant_(s.id);
    if (!e || !e.actif) { cache.remove('s_' + jeton); throw new Error('Session expirée : compte désactivé.'); }
  }
  cache.put('s_' + jeton, brut, DUREE_SESSION); // prolonge la session tant qu'elle sert
  return s;
}

function changerMonNip_(s, nouveau) {
  if (!nipValide_(nouveau)) throw new Error('Le NIP doit contenir de 4 à 8 chiffres.');
  if (s.role === 'admin') { enregistrerNipAdmin_(String(nouveau)); return { ok: true }; }
  definirNipEnseignant_(s.id, String(nouveau));
  return { ok: true };
}

/* ================= Feuilles ================= */
function feuille_(nom, entetes) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let f = ss.getSheetByName(nom);
  if (!f) f = ss.insertSheet(nom);
  if (f.getLastRow() === 0) f.appendRow(entetes);
  return f;
}
function valeurs_(f, nbCol) {
  const n = f.getLastRow();
  return n < 2 ? [] : f.getRange(2, 1, n - 1, nbCol).getValues();
}
function verrou_(fn) {
  const v = LockService.getScriptLock();
  v.waitLock(20000);
  try { return fn(); } finally { v.releaseLock(); }
}

/* ================= Enseignants ================= */
function lireEnseignants_() {
  return valeurs_(feuille_(F_ENS, E_ENS), 6).filter(function (r) { return r[0]; }).map(function (r, i) {
    return { ligne: i + 2, identifiant: String(r[0]).trim().toLowerCase(), nom: String(r[1]), hash: String(r[2]), sel: String(r[3]),
             actif: r[4] === true || String(r[4]).toUpperCase() === 'TRUE' || String(r[4]).toLowerCase() === 'oui' };
  });
}
function trouverEnseignant_(id) {
  id = String(id || '').toLowerCase();
  return lireEnseignants_().filter(function (e) { return e.identifiant === id; })[0] || null;
}
function listeEnseignants_() {
  const groupes = listeGroupes_();
  return lireEnseignants_().map(function (e) {
    return { identifiant: e.identifiant, nom: e.nom, actif: e.actif,
             groupes: groupes.filter(function (g) { return g.enseignant === e.identifiant; }).map(function (g) { return g.groupe; }) };
  });
}
function definirNipEnseignant_(id, nip) {
  const e = trouverEnseignant_(id);
  if (!e) throw new Error('Enseignant introuvable.');
  const sel = Utilities.getUuid();
  feuille_(F_ENS, E_ENS).getRange(e.ligne, 3, 1, 2).setValues([[hacher_(sel + nip), sel]]);
}
function sauverEnseignant_(req) {
  const id = String(req.identifiant || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,20}$/.test(id)) throw new Error('Identifiant : 2 à 20 caractères (lettres minuscules, chiffres, point, tiret).');
  if (id === ADMIN) throw new Error('L\'identifiant « admin » est réservé.');
  const nom = String(req.nom || '').trim().slice(0, 60);
  return verrou_(function () {
    const f = feuille_(F_ENS, E_ENS);
    const e = trouverEnseignant_(id);
    if (req.nouveau) {
      if (e) throw new Error('Cet identifiant existe déjà.');
      if (!nom) throw new Error('Entre le nom de l\'enseignant.');
      if (!nipValide_(req.pin)) throw new Error('Le NIP doit contenir de 4 à 8 chiffres.');
      const sel = Utilities.getUuid();
      f.appendRow([id, nom, hacher_(sel + String(req.pin)), sel, true, new Date()]);
      return { ok: true };
    }
    if (!e) throw new Error('Enseignant introuvable.');
    if (nom) f.getRange(e.ligne, 2).setValue(nom);
    if (typeof req.actif === 'boolean') f.getRange(e.ligne, 5).setValue(req.actif);
    if (req.pin) { if (!nipValide_(req.pin)) throw new Error('Le NIP doit contenir de 4 à 8 chiffres.'); definirNipEnseignant_(id, String(req.pin)); }
    return { ok: true };
  });
}
function supprimerEnseignant_(id) {
  id = String(id || '').toLowerCase();
  return verrou_(function () {
    const e = trouverEnseignant_(id);
    if (!e) throw new Error('Enseignant introuvable.');
    if (listeGroupes_().some(function (g) { return g.enseignant === id; })) throw new Error('Cet enseignant a encore des groupes : réattribue-les ou supprime-les d\'abord.');
    feuille_(F_ENS, E_ENS).deleteRow(e.ligne);
    return { ok: true };
  });
}

/* ================= Groupes ================= */
function listeGroupes_() {
  return valeurs_(feuille_(F_GRP, E_GRP), 3).filter(function (r) { return r[0] !== ''; }).map(function (r, i) {
    return { ligne: i + 2, groupe: String(r[0]).trim(), enseignant: String(r[1]).trim().toLowerCase() };
  });
}
function groupeValide_(g) { g = String(g || '').trim(); if (!/^\d{1,4}$/.test(g)) throw new Error('Numéro de groupe invalide (1 à 4 chiffres).'); return g; }

// Migration depuis la version 1 : les groupes déjà présents dans les résultats sont attribués à l'administrateur.
function migrer_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('MIGRATION_V2')) return;
  verrou_(function () {
    const connus = {};
    listeGroupes_().forEach(function (g) { connus[g.groupe] = true; });
    const f = feuille_(F_GRP, E_GRP);
    const nouveaux = {};
    valeurs_(feuille_(F_RES, E_RES), 3).forEach(function (r) { const g = String(r[2]).trim(); if (/^\d{1,4}$/.test(g) && !connus[g]) nouveaux[g] = true; });
    Object.keys(nouveaux).forEach(function (g) { f.appendRow(["'" + g, ADMIN, new Date()]); });
    p.setProperty('MIGRATION_V2', 'fait');
  });
}

function groupesPour_(s) {
  if (s.role === 'admin') migrer_();
  const groupes = listeGroupes_();
  const compte = {};
  valeurs_(feuille_(F_RES, E_RES), 3).forEach(function (r) { const g = String(r[2]).trim(); compte[g] = (compte[g] || 0) + 1; });
  const noms = { admin: 'Administrateur' };
  lireEnseignants_().forEach(function (e) { noms[e.identifiant] = e.nom; });
  const visibles = groupes.filter(function (g) { return s.role === 'admin' || g.enseignant === s.id; }).map(function (g) {
    return { groupe: g.groupe, enseignant: g.enseignant, nomEnseignant: noms[g.enseignant] || g.enseignant, resultats: compte[g.groupe] || 0 };
  });
  const rep = { ok: true, groupes: visibles };
  if (s.role === 'admin') {
    const connus = {};
    groupes.forEach(function (g) { connus[g.groupe] = true; });
    rep.orphelins = Object.keys(compte).filter(function (g) { return !connus[g]; }).map(function (g) { return { groupe: g, resultats: compte[g] }; });
    rep.enseignants = lireEnseignants_().map(function (e) { return { identifiant: e.identifiant, nom: e.nom, actif: e.actif }; });
  }
  return rep;
}

function creerGroupe_(s, groupe, proprietaire) {
  const g = groupeValide_(groupe);
  let proprio = s.id;
  if (s.role === 'admin' && proprietaire) {
    proprio = String(proprietaire).toLowerCase();
    if (proprio !== ADMIN && !trouverEnseignant_(proprio)) throw new Error('Enseignant introuvable.');
  }
  return verrou_(function () {
    const existant = listeGroupes_().filter(function (x) { return x.groupe === g; })[0];
    if (existant) {
      if (s.role === 'admin') throw new Error('Le groupe ' + g + ' existe déjà (propriétaire : ' + existant.enseignant + ').');
      throw new Error(existant.enseignant === s.id ? 'Tu as déjà créé le groupe ' + g + '.' : 'Le groupe ' + g + ' est déjà utilisé par un autre enseignant. Choisis un autre numéro ou contacte l\'administrateur.');
    }
    feuille_(F_GRP, E_GRP).appendRow(["'" + g, proprio, new Date()]);
    return { ok: true };
  });
}

function reattribuerGroupe_(groupe, proprietaire) {
  const g = groupeValide_(groupe);
  const proprio = String(proprietaire || '').toLowerCase();
  if (proprio !== ADMIN && !trouverEnseignant_(proprio)) throw new Error('Enseignant introuvable.');
  return verrou_(function () {
    const existant = listeGroupes_().filter(function (x) { return x.groupe === g; })[0];
    const f = feuille_(F_GRP, E_GRP);
    if (existant) f.getRange(existant.ligne, 2).setValue(proprio);
    else f.appendRow(["'" + g, proprio, new Date()]); // groupe orphelin : on l'enregistre
    return { ok: true };
  });
}

function supprimerGroupe_(s, groupe, resultatsSeulement) {
  const g = groupeValide_(groupe);
  return verrou_(function () {
    const existant = listeGroupes_().filter(function (x) { return x.groupe === g; })[0];
    if (s.role !== 'admin' && (!existant || existant.enseignant !== s.id)) throw new Error('Ce groupe ne t\'appartient pas.');
    // 1) Résultats du groupe
    const f = feuille_(F_RES, E_RES);
    const n = f.getLastRow();
    let supprimees = 0;
    if (n >= 2) {
      const nbCol = E_RES.length;
      const donnees = f.getRange(2, 1, n - 1, nbCol).getValues();
      const garder = donnees.filter(function (r) { return String(r[2]).trim() !== g; });
      supprimees = donnees.length - garder.length;
      if (supprimees) {
        f.getRange(2, 1, n - 1, nbCol).clearContent();
        if (garder.length) f.getRange(2, 1, garder.length, nbCol).setValues(garder);
        if (n - 1 > garder.length) f.deleteRows(2 + garder.length, n - 1 - garder.length);
      }
    }
    // 2) Le groupe lui-même
    if (!resultatsSeulement && existant) feuille_(F_GRP, E_GRP).deleteRow(existant.ligne);
    return { ok: true, supprimees: supprimees };
  });
}

/* ================= Résultats ================= */
function enregistrerResultat_(d) {
  const code = String(d.code || '').toUpperCase().trim();
  if (!/^\d{1,4}-[A-Z]{2,4}\d?$/.test(code)) throw new Error('Code élève invalide.');
  const groupe = code.split('-')[0];
  const bloc = Number(d.bloc);
  if (!(bloc >= 1 && bloc <= 4)) throw new Error('Bloc invalide.');
  const mode = MODES.indexOf(d.mode) >= 0 ? d.mode : 'entrainement';
  const nombre = function (x, max) { const v = Number(x); return isFinite(v) ? Math.max(0, Math.min(max, v)) : 0; };
  const liste = function (x) { return String(x || '').replace(/[^a-zA-Z,\- ']/g, '').slice(0, 1500); };
  const id = String(d.id || '').slice(0, 40);
  return verrou_(function () {
    const f = feuille_(F_RES, E_RES);
    const der = f.getLastRow();
    if (id && der > 1) { // évite les doublons d'un envoi hors-ligne réessayé
      const debut = Math.max(2, der - 300);
      const ids = f.getRange(debut, 13, der - debut + 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) if (ids[i][0] === id) return { ok: true, doublon: true };
    }
    f.appendRow([new Date(), code, "'" + groupe, bloc, mode, nombre(d.score, 10000), nombre(d.max, 10000), nombre(d.pct, 100),
                 nombre(d.duree, 36000), nombre(d.questions, 1000), liste(d.reussis), liste(d.rates), id]);
    return { ok: true };
  });
}

function lireResultats_(s) {
  let permis = null; // null = tout (admin)
  if (s.role !== 'admin') {
    permis = {};
    listeGroupes_().forEach(function (g) { if (g.enseignant === s.id) permis[g.groupe] = true; });
  }
  return valeurs_(feuille_(F_RES, E_RES), 13)
    .filter(function (r) { return r[1] && (!permis || permis[String(r[2]).trim()]); })
    .map(function (r) {
      return {
        date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), code: String(r[1]), groupe: String(r[2]).trim(),
        bloc: r[3], mode: r[4], score: r[5], max: r[6], pct: r[7], duree: r[8], questions: r[9],
        reussis: String(r[10] || ''), rates: String(r[11] || '')
      };
    });
}

/* ================= Verbes ================= */
function lireVerbes_() {
  return valeurs_(feuille_(F_VERBES, E_VERBES), 5)
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return { bloc: Number(r[0]), base: String(r[1]).trim(), passe: String(r[2]).trim(), participe: String(r[3]).trim(), fr: String(r[4]).trim() }; });
}

function sauverVerbes_(verbes) {
  if (!Array.isArray(verbes) || !verbes.length || verbes.length > 400) throw new Error('Liste de verbes invalide.');
  const propre = function (x) { return String(x || '').trim().slice(0, 80); };
  const lignes = verbes.map(function (v) { return [Number(v.bloc), propre(v.base), propre(v.passe), propre(v.participe), propre(v.fr)]; })
    .filter(function (r) { return r[0] >= 1 && r[0] <= 4 && r[1] && r[2] && r[3] && r[4]; });
  if (!lignes.length) throw new Error('Aucun verbe valide.');
  return verrou_(function () {
    const f = feuille_(F_VERBES, E_VERBES);
    if (f.getLastRow() > 1) f.getRange(2, 1, f.getLastRow() - 1, 5).clearContent();
    f.getRange(2, 1, lignes.length, 5).setValues(lignes);
    return { ok: true, nombre: lignes.length };
  });
}
