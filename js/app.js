/* ============================================================
   Application élève
   ============================================================ */
'use strict';
(function () {
  const { $, $$ } = VI;
  const esc = VI.echapper;

  // Valeurs par défaut pour les réglages ajoutés après la version 1 (config.js n'a pas à être modifié)
  const C = Object.assign({ questionsPhrases: 15, manchesChasse: 4, dureeVraiFaux: 60 }, typeof CONFIG === 'object' ? CONFIG : {});
  let VERBES = VI.verbesLocaux();
  let PHRASES = VI.phrasesLocales();
  let eleve = null;      // { code, groupe, ecole, nomEcole }
  let profil = null;     // progression locale de l'élève
  let session = null;    // activité en cours
  let q = null;          // question en cours
  const choix = { bloc: VI.store.get('vi:bloc', 1), forme: VI.store.get('vi:forme', 'hasard') };

  const MODES = {
    etude:        { groupe: 'apprendre', titre: 'Étudier',               icone: '📖', desc: 'Découvre les verbes par familles et teste ta mémoire.' },
    entrainement: { groupe: 'apprendre', titre: 'Entraînement',          icone: '🎯', desc: '15 questions qui ciblent tes erreurs. Indices permis.' },
    difficiles:   { groupe: 'apprendre', titre: 'Mes verbes difficiles', icone: '🧠', desc: 'Seulement les verbes qui te donnent du fil à retordre.' },
    phrases:      { groupe: 'contexte',  titre: 'Phrases à compléter',   icone: '✍️', desc: 'Mets le verbe au bon temps grâce aux indices de la phrase.' },
    erreurs:      { groupe: 'contexte',  titre: 'Chasse aux erreurs',    icone: '🕵️', desc: 'Repère les verbes mal conjugués et corrige-les.' },
    quiz:         { groupe: 'defis',     titre: 'Quiz',                  icone: '📝', desc: '20 questions notées. Un indice coûte la moitié des points.' },
    sprint:       { groupe: 'defis',     titre: 'Sprint 60 s',           icone: '⚡', desc: 'Le plus de verbes possible en une minute. Sans indice.' },
    vraifaux:     { groupe: 'defis',     titre: 'Vrai ou faux éclair',   icone: '✅', desc: 'go → went → goed ? Réponds le plus vite possible en 60 s.' }
  };
  const GROUPES_MODES = { apprendre: '🌱 Apprendre', contexte: '💬 En contexte', defis: '🏆 Défis' };

  const BADGES = [
    { id: 'premier',   icone: '👣', nom: 'Premier pas', desc: 'Terminer une première activité au complet' },
    { id: 'serie10',   icone: '🔥', nom: '10 de suite', desc: '10 bonnes réponses consécutives, sans indice' },
    { id: 'eclair',    icone: '⚡', nom: 'Éclair',      desc: 'Au moins 15 verbes réussis dans un sprint de 60 s' },
    { id: 'parfait',   icone: '💎', nom: 'Sans faute',  desc: `Un quiz complet (${CONFIG.questionsQuiz} questions) à 100 %, sans indice` },
    { id: 'constance', icone: '📅', nom: 'Constance',   desc: 'Terminer au moins une activité 3 jours de suite' },
    { id: 'contexte',  icone: '✍️', nom: 'Bon temps',   desc: `Réussir les ${C.questionsPhrases} phrases à compléter, sans faute ni indice` },
    { id: 'detective', icone: '🕵️', nom: 'Détective',   desc: `Réussir les ${C.manchesChasse} manches d'une chasse aux erreurs, sans faute` },
    { id: 'lynx',      icone: '👁️', nom: 'Œil de lynx', desc: 'Vrai ou faux : au moins 20 bonnes réponses et 90 % de réussite' },
    { id: 'maitre1',   icone: '🥇', nom: 'Maître · bloc 1', desc: 'Maîtriser tous les verbes du bloc 1' },
    { id: 'maitre2',   icone: '🥇', nom: 'Maître · bloc 2', desc: 'Maîtriser tous les verbes du bloc 2' },
    { id: 'maitre3',   icone: '🥇', nom: 'Maître · bloc 3', desc: 'Maîtriser tous les verbes du bloc 3' },
    { id: 'maitre4',   icone: '🥇', nom: 'Maître · bloc 4', desc: 'Maîtriser tous les verbes du bloc 4' }
  ];

  const BRAVO = ['Excellent !', 'Parfait !', 'Bien joué !', 'Superbe !', 'Exactement !', 'Nice!', 'Great job!'];
  const PRESQUE = ['Presque ! Observe les corrections.', 'Pas encore… et c\'est comme ça qu\'on apprend.', 'Ton cerveau vient de noter cette erreur : tu le reverras bientôt.', 'Regarde bien la famille de ce verbe, ça aide !'];

  /* ---------------- Profil local (par élève, utile sur un Chromebook partagé) ---------------- */
  const sauverProfil = () => { VI.store.set('vi:eleve:' + eleve.code, profil); if (!LOCAL) VI.store.set('vi:sale:' + eleve.code, true); };
  const boite = (v) => (profil.boites[VI.cle(v)] || { b: 0, vu: 0 }).b;
  const niveau = () => Math.floor(Math.sqrt(profil.xp / 40)) + 1;
  const verbesDuBloc = (b) => VERBES.filter((v) => v.bloc === b);
  // État d'un bloc : maîtrisés (niveau 4+), en bonne voie (2-3), à revoir (raté la dernière fois), pas encore vus
  const maitrise = (b) => {
    const l = verbesDuBloc(b);
    const etat = { total: l.length, ok: 0, voie: 0, revoir: 0, nouveaux: 0 };
    l.forEach((v) => {
      const st = profil.boites[VI.cle(v)];
      const n = st ? st.b : 0;
      if (n >= 4) etat.ok++; else if (n >= 2) etat.voie++; else if (st && st.vu > 0) etat.revoir++; else etat.nouveaux++;
    });
    return etat;
  };
  const pluriel = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
  // Barre en trois segments : maîtrisés · en bonne voie · à revoir
  const barreEtat = (m) => {
    const w = (n) => (m.total ? (n / m.total) * 100 : 0).toFixed(1) + '%';
    return `<span class="jauge jauge-etat" role="img" aria-label="${m.ok} maîtrisés, ${m.voie} en bonne voie, ${m.revoir} à revoir sur ${m.total}">
      <span class="seg-ok" style="width:${w(m.ok)}"></span><span class="seg-voie" style="width:${w(m.voie)}"></span><span class="seg-revoir" style="width:${w(m.revoir)}"></span></span>`;
  };
  const difficilesDuBloc = (b) => verbesDuBloc(b).filter((v) => { const s = profil.boites[VI.cle(v)]; return s && s.vu > 0 && s.b <= 1; }); // raté (ou réussi avec indice) la dernière fois

  function serieJours() {
    const ens = new Set(profil.jours);
    const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const d = new Date();
    if (!ens.has(fmt(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (ens.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------------- Navigation ---------------- */
  function afficher(id) {
    $$('.ecran').forEach((s) => { s.hidden = s.id !== id; });
    window.scrollTo(0, 0);
    $('#principal').focus({ preventScroll: true });
  }

  function majEntete() {
    const visible = !!eleve;
    $('#entete-stats').hidden = !visible;
    if (!visible) return;
    $('#val-serie').textContent = serieJours();
    $('#val-niveau').textContent = niveau();
    $('#pastille-niveau').title = profil.xp + ' XP — prochain niveau à ' + (niveau() ** 2 * 40) + ' XP';
    $('#pastille-code').textContent = eleve.code.replace(/^LOCAL-/, '');
    $('#pastille-code').title = eleve.nomEcole && eleve.ecole !== 'LOCAL' ? eleve.nomEcole : 'Ton code';
  }

  /* ---------------- Connexion (école + groupe + initiales + NIP) ---------------- */
  const LOCAL = !VI.urlConfiguree();          // mode local : pas de feuille Google, donc pas d'école ni de NIP
  const RX_CODE = /^([A-Z0-9]{2,6})-(\d{1,4})-([A-Z]{2,4}\d?)$/;
  let ECOLES = VI.store.get('vi:ecoles', []);
  let etapeNip = null;                         // { code, mode: 'login' | 'register' }

  const nomEcole = (id) => (ECOLES.find((e) => e.id === id) || {}).nom || id;
  const jeton = (code) => VI.store.get('vi:jeton:' + code, null);
  const ecrireSessionOnglet = (code) => { try { code ? sessionStorage.setItem('vi:session', code) : sessionStorage.removeItem('vi:session'); } catch (e) {} };
  const lireSessionOnglet = () => { try { return sessionStorage.getItem('vi:session'); } catch (e) { return null; } };
  // Sécurité (appareils partagés) : aucune empreinte du NIP n'est gardée sur l'appareil,
  // et le jeton d'un élève est effacé dès qu'il ne sert plus (élève déconnecté, aucun résultat en attente).
  function purgerJetons() {
    const enAttente = new Set(VI.store.get('vi:file', []).filter((x) => x && x.data).map((x) => x.code));
    const actuel = eleve ? eleve.code : lireSessionOnglet();
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('vi:nip:')) localStorage.removeItem(k);   // anciennes versions
        if (k.startsWith('vi:jeton:')) { const c = k.slice(9); if (c !== actuel && !enAttente.has(c)) localStorage.removeItem(k); }
      });
    } catch (e) { /* stockage bloqué */ }
  }

  function remplirEcoles() {
    const sel = $('#in-ecole');
    const actuel = sel.value || VI.store.get('vi:ecole', '');
    sel.innerHTML = '<option value="">— Choisis ton école —</option>' + ECOLES.map((e) => `<option value="${esc(e.id)}" ${e.id === actuel ? 'selected' : ''}>${esc(e.nom)}</option>`).join('');
  }
  async function chargerEcoles() {
    if (LOCAL) return;
    try {
      const rep = await VI.api('getSchools', {}, 8000);
      ECOLES = rep.ecoles || [];
      VI.store.set('vi:ecoles', ECOLES);
      remplirEcoles();
    } catch (e) { /* hors-ligne : on garde la liste en cache */ }
  }

  function lireCode() {
    const ec = LOCAL ? 'LOCAL' : $('#in-ecole').value;
    const g = $('#in-groupe').value.replace(/\D/g, '');
    const i = $('#in-initiales').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return { ec, g, i, code: ec && g && i ? ec + '-' + g + '-' + i : '' };
  }
  const codeAffiche = (code) => { const m = RX_CODE.exec(code); return m ? (m[1] === 'LOCAL' ? '' : nomEcole(m[1]) + ' · ') + m[2] + '-' + m[3] : code; };

  function afficherConnexion() {
    eleve = null; profil = null; etapeNip = null; ecrireSessionOnglet(null); majEntete();
    purgerJetons();
    $('#champ-ecole').hidden = LOCAL;
    remplirEcoles();
    montrerEtape('code');
    const codes = VI.store.get('vi:codes', []).filter((c) => RX_CODE.test(c));
    $('#anciens-codes').innerHTML = codes.length
      ? '<p class="muted petit">Déjà utilisé sur cet appareil' + (LOCAL ? '' : ' (ton NIP sera demandé)') + ' :</p>' + codes.map((c) =>
          `<span class="puce-code"><button type="button" data-code="${esc(c)}">${esc(codeAffiche(c))}</button><button type="button" class="retirer" data-retirer="${esc(c)}" aria-label="Retirer ce code de cet appareil">✕</button></span>`).join('')
      : '';
    afficher('ecran-connexion');
    (LOCAL || $('#in-ecole').value ? $('#in-groupe') : $('#in-ecole')).focus();
  }
  function montrerEtape(etape, mode) {
    $('#etape-code').hidden = etape !== 'code';
    $('#etape-nip').hidden = etape !== 'nip';
    $('#erreur-connexion').textContent = '';
    if (etape === 'nip') {
      const premiere = mode === 'register';
      $('#nip-titre').innerHTML = premiere
        ? `Première connexion pour <b>${esc(codeAffiche(etapeNip.code))}</b> 🎉<br>Choisis un NIP de 4 chiffres. <b>Garde-le secret</b> : il protège ta progression.`
        : `Bon retour, <b>${esc(codeAffiche(etapeNip.code))}</b> !<br>Entre ton NIP.`;
      $('#champ-nip2').hidden = !premiere;
      $('#in-nip').value = ''; $('#in-nip2').value = '';
      $('#in-nip').setAttribute('autocomplete', premiere ? 'new-password' : 'current-password');
      $('#btn-nip-oublie').hidden = premiere;
      $('#in-nip').focus();
    }
  }
  function erreurConnexion(msg, champ) { $('#erreur-connexion').textContent = msg; if (champ) { champ.focus(); if (champ.select) champ.select(); } }
  function occupe(btn, oui, texte) { btn.disabled = oui; if (texte) btn.textContent = texte; }

  // Étape 1 : école, groupe, initiales
  async function validerCode(codeImpose) {
    let code = codeImpose;
    if (!code) {
      const { ec, g, i, code: c } = lireCode();
      if (!LOCAL && !ec) return erreurConnexion('Choisis ton école.', $('#in-ecole'));
      if (!/^\d{1,4}$/.test(g)) return erreurConnexion('Entre ton numéro de groupe (des chiffres seulement).', $('#in-groupe'));
      if (!/^[A-Z]{2,4}\d?$/.test(i)) return erreurConnexion('Entre 2 à 4 initiales (lettres), suivies au besoin d\'un chiffre.', $('#in-initiales'));
      code = c;
      if (!LOCAL) VI.store.set('vi:ecole', ec);
    }
    if (LOCAL) return reussirConnexion(code, null, null);
    const btn = $('#btn-continuer'); occupe(btn, true, 'Vérification…');
    try {
      const rep = await VI.api('studentCheck', { code }, 10000);
      if (!rep.groupeExiste) return erreurConnexion(`Ce groupe n'existe pas dans cette école. Vérifie le numéro avec ton enseignant·e.`, $('#in-groupe'));
      etapeNip = { code, mode: rep.nipDefini ? 'login' : 'register' };
    } catch (e) {
      if (e.serveur) return erreurConnexion(e.message);
      return erreurConnexion('Pas de connexion Internet. La connexion doit se faire en ligne; ensuite, tu pourras continuer même si le réseau coupe.');
    } finally { occupe(btn, false, 'Continuer →'); }
    montrerEtape('nip', etapeNip.mode);
  }

  // Étape 2 : NIP
  async function validerNip() {
    const nip = $('#in-nip').value.trim();
    if (!/^\d{4}$/.test(nip)) return erreurConnexion('Ton NIP contient exactement 4 chiffres.', $('#in-nip'));
    const { code, mode } = etapeNip;
    if (mode === 'register' && $('#in-nip2').value.trim() !== nip) return erreurConnexion('Les deux NIP ne sont pas identiques.', $('#in-nip2'));
    if (mode === 'register' && (/^(\d)\1{3}$/.test(nip) || ['1234', '4321', '0123', '9876'].includes(nip))) return erreurConnexion('Ce NIP est trop facile à deviner. Choisis-en un autre.', $('#in-nip'));
    const btn = $('#btn-entrer'); occupe(btn, true, 'Connexion…');
    try {
      const rep = await VI.api(mode === 'register' ? 'studentRegister' : 'studentLogin', { code, pin: nip }, 15000);
      reussirConnexion(code, rep.token, rep.progression);
    } catch (e) {
      erreurConnexion(e.serveur ? e.message : 'Impossible de joindre le serveur. Réessaie dans un instant.', $('#in-nip'));
    } finally { occupe(btn, false, 'Entrer'); }
  }

  function reussirConnexion(code, tokenNeuf, progressionServeur) {
    if (tokenNeuf) VI.store.set('vi:jeton:' + code, tokenNeuf);
    ecrireSessionOnglet(code);
    const m = RX_CODE.exec(code);
    eleve = { code, ecole: m[1], groupe: m[1] + '-' + m[2], nomEcole: nomEcole(m[1]) };
    // Progression : appareil + serveur (+ ancienne progression locale « 21-AB » des versions précédentes)
    let local = VI.store.get('vi:eleve:' + code, null);
    const ancienne = VI.store.get('vi:eleve:' + m[2] + '-' + m[3], null);
    if (ancienne) { local = fusionnerProfils(local, ancienne); VI.store.del('vi:eleve:' + m[2] + '-' + m[3]); }
    const fusion = fusionnerProfils(local, progressionServeur);
    profil = Object.assign(profilVide(), fusion || {});
    sauverProfil();
    if (!LOCAL && JSON.stringify(fusion) !== JSON.stringify(progressionServeur)) VI.store.set('vi:sale:' + code, true);
    const codes = VI.store.get('vi:codes', []).filter((c) => c !== code && RX_CODE.test(c));
    codes.unshift(code);
    VI.store.set('vi:codes', codes.slice(0, 8));
    afficherAccueil();
    viderFile();
  }

  $('#form-connexion').addEventListener('input', () => { $('#apercu-code').textContent = lireCode().code ? codeAffiche(lireCode().code) : '—'; $('#erreur-connexion').textContent = ''; });
  $('#form-connexion').addEventListener('submit', (e) => { e.preventDefault(); if (!$('#etape-nip').hidden) validerNip(); else validerCode(); });
  $('#btn-retour-code').addEventListener('click', () => { etapeNip = null; montrerEtape('code'); $('#in-groupe').focus(); });
  $('#btn-nip-oublie').addEventListener('click', () => erreurConnexion('Demande à ton enseignant·e de réinitialiser ton NIP. Ta progression sera conservée.'));
  $('#anciens-codes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.code) {
      const m = RX_CODE.exec(b.dataset.code);
      if (!LOCAL) { $('#in-ecole').value = m[1]; }
      $('#in-groupe').value = m[2]; $('#in-initiales').value = m[3];
      validerCode(b.dataset.code);
    }
    if (b.dataset.retirer) {
      const c = b.dataset.retirer;
      VI.store.set('vi:codes', VI.store.get('vi:codes', []).filter((x) => x !== c));
      ['vi:eleve:', 'vi:jeton:', 'vi:nip:', 'vi:sale:'].forEach((k) => VI.store.del(k + c));
      afficherConnexion();
    }
  });
  $('#btn-changer-eleve').addEventListener('click', afficherConnexion);

  /* ---------------- Fusion de deux progressions (appareil + serveur) ---------------- */
  function profilVide() { return { xp: 0, boites: {}, badges: [], jours: [], sprint: {}, historique: [] }; }
  function fusionnerProfils(a, b) {
    if (!a) return b ? Object.assign(profilVide(), b) : null;
    if (!b) return Object.assign(profilVide(), a);
    const r = profilVide();
    r.xp = Math.max(a.xp || 0, b.xp || 0);
    r.boites = Object.assign({}, b.boites || {});
    Object.entries(a.boites || {}).forEach(([k, v]) => { const w = r.boites[k]; if (!w || (v.vu || 0) > (w.vu || 0)) r.boites[k] = v; });
    r.badges = [...new Set([...(a.badges || []), ...(b.badges || [])])];
    r.jours = [...new Set([...(a.jours || []), ...(b.jours || [])])].sort().slice(-60);
    r.sprint = Object.assign({}, b.sprint || {});
    Object.entries(a.sprint || {}).forEach(([k, v]) => { r.sprint[k] = Math.max(v, r.sprint[k] || 0); });
    const h = {}; [...(a.historique || []), ...(b.historique || [])].forEach((x) => { h[x.d + x.mode] = x; });
    r.historique = Object.values(h).sort((x, y) => x.d - y.d).slice(-50);
    return r;
  }

  /* ---------------- Accueil ---------------- */
  function afficherAccueil() {
    majEntete();
    const totalM = [1, 2, 3, 4].reduce((s, b) => s + maitrise(b).ok, 0);
    const totalV = [1, 2, 3, 4].reduce((s, b) => s + maitrise(b).voie, 0);
    $('#titre-accueil').textContent = 'Salut ' + eleve.code.split('-').slice(1).join('-') + ' !';
    const sj = serieJours();
    $('#message-accueil').textContent = !profil.historique.length
      ? 'Commence par « Étudier » pour découvrir les familles de verbes, puis teste-toi.'
      : totalM === 0 ? `${pluriel(totalV, 'verbe')} en bonne voie ! Un verbe devient « maîtrisé » après 3 bonnes réponses sans indice.`
      : `Tu maîtrises ${pluriel(totalM, 'verbe')} sur ${VERBES.length}` + (totalV ? ` et ${totalV} ${totalV > 1 ? 'sont' : 'est'} en bonne voie.` : '.') + (sj > 1 ? ` ${sj} jours de suite, continue !` : ' Un peu chaque jour, c\'est la clé.');

    // Blocs
    $('#grille-blocs').innerHTML = [1, 2, 3, 4].map((b) => {
      const m = maitrise(b);
      return `<button class="bloc b${b}" role="radio" aria-checked="${choix.bloc === b}" data-bloc="${b}" ${m.total ? '' : 'disabled'}>
        <span class="bloc-nom">Bloc ${b}</span>
        <span class="bloc-info">${m.total} verbes</span>
        ${barreEtat(m)}
        <span class="bloc-info"><b class="c-ok">${m.ok}</b> maîtrisé${m.ok > 1 ? 's' : ''} · <b class="c-voie">${m.voie}</b> en bonne voie</span>
      </button>`;
    }).join('');

    // Modes
    const nbDiff = difficilesDuBloc(choix.bloc).length;
    const nbPhrases = phrasesDuBloc(choix.bloc).length;
    $('#grille-modes').innerHTML = Object.entries(GROUPES_MODES).map(([g, titreG]) => `<h3 class="groupe-modes">${titreG}</h3>` +
      Object.entries(MODES).filter(([, m]) => m.groupe === g).map(([id, m]) => {
        let extra = '', off = false;
        if (id === 'sprint' && profil.sprint[choix.bloc]) extra = `<span class="mode-extra">Record : ${profil.sprint[choix.bloc]}</span>`;
        if (id === 'vraifaux' && profil.sprint['vf' + choix.bloc]) extra = `<span class="mode-extra">Record : ${profil.sprint['vf' + choix.bloc]}</span>`;
        if (id === 'difficiles') { extra = `<span class="mode-extra">${nbDiff ? nbDiff + ' à revoir' : 'Rien à revoir 🎉'}</span>`; off = !nbDiff; }
        if ((id === 'phrases' || id === 'erreurs') && nbPhrases < 5) { extra = '<span class="mode-extra">Pas assez de phrases pour ce bloc</span>'; off = true; }
        return `<button class="mode" data-mode="${id}" ${off ? 'disabled' : ''}>
          <span class="mode-icone" aria-hidden="true">${m.icone}</span>
          <span class="mode-titre">${m.titre}</span>
          <span class="mode-desc">${m.desc}</span>${extra}
        </button>`;
      }).join('')).join('');

    // Options de forme
    $$('#seg-forme button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.forme === choix.forme)));

    // Badges
    $('#badges').innerHTML = BADGES.map((b) => {
      const a = profil.badges.includes(b.id);
      return `<div class="badge ${a ? 'obtenu' : ''}" title="${esc(b.desc)}"><span aria-hidden="true">${a ? b.icone : '🔒'}</span><b>${esc(b.nom)}</b><small>${esc(b.desc)}</small></div>`;
    }).join('');

    afficher('ecran-accueil');
  }

  $('#grille-blocs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bloc]'); if (!b) return;
    choix.bloc = Number(b.dataset.bloc); VI.store.set('vi:bloc', choix.bloc); afficherAccueil();
  });
  $('#grille-modes').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) demarrer(b.dataset.mode); });
  $('#seg-forme').addEventListener('click', (e) => {
    const b = e.target.closest('[data-forme]'); if (!b) return;
    choix.forme = b.dataset.forme; VI.store.set('vi:forme', choix.forme);
    $$('#seg-forme button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  });
  $$('[data-retour]').forEach((b) => b.addEventListener('click', afficherAccueil));

  /* ---------------- Étudier (par familles) ---------------- */
  let colonneCachee = 'aucune';
  function afficherEtude() {
    $('#titre-etude').textContent = 'Étudier · Bloc ' + choix.bloc;
    const groupes = {};
    verbesDuBloc(choix.bloc).forEach((v) => { (groupes[VI.famille(v)] = groupes[VI.famille(v)] || []).push(v); });
    $('#liste-etude').innerHTML = VI.ORDRE_FAMILLES.filter((f) => groupes[f]).map((f) => {
      const F = VI.FAMILLES[f];
      return `<section class="carte famille">
        <header><h2>${esc(F.nom)} <span class="compte">${groupes[f].length}</span></h2><p class="muted">${esc(F.explication)} <i>(${esc(F.exemple)})</i></p></header>
        <div class="tableau-etude" role="table">
          <div class="ligne entete-ligne" role="row">${VI.ORDRE.map((c) => `<span role="columnheader">${VI.FORMES[c].label}</span>`).join('')}<span></span></div>
          ${groupes[f].map((v) => `<div class="ligne" role="row">
            ${VI.ORDRE.map((c) => `<span role="cell" data-label="${VI.FORMES[c].label}" class="cellule ${c === 'fr' ? 'fr' : ''}" data-col="${c}"><span class="val">${esc(VI.variantes(v[c]).join(' / '))}</span><button type="button" class="masque" aria-label="Révéler">•••</button></span>`).join('')}
            <span role="cell"><button type="button" class="btn-icone btn-audio" data-dire="${esc([v.base, v.passe, v.participe].join(' → '))}" aria-label="Écouter ${esc(v.base)}">🔊</button></span>
          </div>`).join('')}
        </div>
      </section>`;
    }).join('');
    appliquerCache();
    if (!VI.audioDispo()) $$('#liste-etude .btn-audio').forEach((b) => (b.hidden = true));
    afficher('ecran-etude');
  }
  function appliquerCache() {
    $$('#liste-etude .cellule').forEach((c) => c.classList.toggle('cachee', c.dataset.col === colonneCachee));
    $$('#seg-cacher button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cacher === colonneCachee)));
  }
  $('#seg-cacher').addEventListener('click', (e) => { const b = e.target.closest('[data-cacher]'); if (b) { colonneCachee = b.dataset.cacher; appliquerCache(); } });
  $('#liste-etude').addEventListener('click', (e) => {
    const m = e.target.closest('.masque'); if (m) { m.parentElement.classList.remove('cachee'); return; }
    const a = e.target.closest('[data-dire]'); if (a) VI.parler(a.dataset.dire);
  });

  /* ---------------- Sélection des verbes (répétition espacée) ---------------- */
  const POIDS = [6, 10, 6, 3, 1.5, 0.7]; // boîte 0 (jamais vu) à 5 (très bien maîtrisé)
  function choisirVerbe(pool) {
    const recents = session.recents;
    let candidats = pool.filter((v) => !recents.includes(VI.cle(v)));
    if (!candidats.length) candidats = pool;
    const total = candidats.reduce((s, v) => s + POIDS[boite(v)], 0);
    let r = Math.random() * total;
    for (const v of candidats) { r -= POIDS[boite(v)]; if (r <= 0) return v; }
    return candidats[candidats.length - 1];
  }

  /* ---------------- Démarrer une activité ---------------- */
  function demarrer(mode) {
    if (mode === 'etude') return afficherEtude();
    if (mode === 'phrases' || mode === 'erreurs' || mode === 'vraifaux') return demarrerSpecial(mode);
    const pool = mode === 'difficiles' ? difficilesDuBloc(choix.bloc) : verbesDuBloc(choix.bloc);
    if (!pool.length) { VI.toast('Aucun verbe disponible pour ce bloc.'); return; }
    session = {
      id: VI.uid(), mode, type: 'formes', bloc: choix.bloc, pool, debut: Date.now(), index: 0,
      total: mode === 'quiz' ? CONFIG.questionsQuiz : mode === 'entrainement' ? CONFIG.questionsEntrainement
           : mode === 'difficiles' ? Math.min(CONFIG.questionsDifficiles, Math.max(pool.length * 2, 4)) : Infinity,
      file: [], recents: [], resultats: [], points: 0, max: 0, serie: 0, serieMax: 0, xp: 0,
      maitriseAvant: maitrise(choix.bloc).ok, minuterie: null, auto: null
    };
    if (mode === 'quiz') { while (session.file.length < session.total) session.file.push(...VI.melanger(pool)); session.file.length = session.total; }
    $('#etiquette-mode').textContent = MODES[mode].icone + ' ' + MODES[mode].titre + ' · Bloc ' + choix.bloc;
    $('#btn-indice').hidden = mode === 'sprint';
    $('#btn-indice').innerHTML = mode === 'quiz' ? '💡 Indice <small>(−50 %)</small>' : '💡 Indice';
    $('#serie-live').textContent = '';
    if (mode === 'sprint') {
      session.dureeMs = CONFIG.dureeSprintSecondes * 1000;
      session.fin = Date.now() + session.dureeMs;
      session.minuterie = setInterval(tic, 200);
    }
    afficher('ecran-exercice');
    montrerCarte('formes');
    nouvelleQuestion();
    if (mode === 'sprint') tic();
  }

  function tic() {
    const reste = Math.max(0, session.fin - Date.now());
    $('#compteur').textContent = '⏱ ' + Math.ceil(reste / 1000) + ' s · ' + session.points + ' ✓';
    $('#progression-barre').style.width = (reste / session.dureeMs) * 100 + '%';
    $('#progression-barre').classList.toggle('urgent', reste < 10000);
    if (reste <= 0) terminer(true);
  }

  /* ---------------- Question ---------------- */
  function nouvelleQuestion() {
    const s = session;
    const verbe = s.mode === 'quiz' ? s.file[s.index] : choisirVerbe(s.pool);
    s.recents.push(VI.cle(verbe)); if (s.recents.length > Math.min(4, s.pool.length - 1)) s.recents.shift();
    const donnee = choix.forme === 'hasard' ? VI.ORDRE[Math.floor(Math.random() * 4)] : choix.forme;
    q = { verbe, donnee, demandees: VI.ORDRE.filter((f) => f !== donnee), niveauIndice: 0, aIndice: false, verifie: false };

    // Progression
    if (s.mode !== 'sprint') {
      $('#compteur').textContent = (s.index + 1) + ' / ' + s.total;
      $('#progression-barre').style.width = (s.index / s.total) * 100 + '%';
    }

    // Forme donnée
    const F = VI.FORMES[donnee];
    $('#donnee-label').textContent = F.label + (F.anglais ? ' (' + F.aide + ')' : '');
    $('#donnee-valeur').textContent = VI.variantes(verbe[donnee]).join(' / ');
    $('#donnee-valeur').lang = F.anglais ? 'en' : 'fr';
    $('#btn-audio-donnee').hidden = !F.anglais || !VI.audioDispo();

    // Plusieurs verbes possibles ? (ex. « faire » = do / make)
    const memes = s.pool.filter((v) => v !== verbe && VI.variantes(v[donnee]).some((x) => VI.variantes(verbe[donnee]).some((y) => VI.norm(x) === VI.norm(y))));
    const desamb = $('#indice-desamb');
    if (memes.length) {
      desamb.innerHTML = donnee === 'base'
        ? `Indice : en français, ce verbe commence par « <b>${esc(VI.premiere(verbe.fr)[0])}</b> ».`
        : `Plusieurs verbes possibles : l'infinitif anglais commence par « <b>${esc(VI.premiere(verbe.base)[0])}</b> ».`;
    } else desamb.innerHTML = '';

    // Champs à remplir
    $('#champs-reponse').innerHTML = q.demandees.map((f) => {
      const G = VI.FORMES[f];
      return `<div class="champ-rep" data-f="${f}">
        <label for="rep-${f}">${G.label} <small>${G.anglais ? G.aide : ''}</small></label>
        <input id="rep-${f}" type="text" lang="${G.anglais ? 'en' : 'fr'}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next">
        <span class="correction" aria-live="polite"></span>
      </div>`;
    }).join('');
    const champs = $$('#champs-reponse input');
    champs[champs.length - 1].setAttribute('enterkeyhint', 'done');

    $('#retro').innerHTML = '';
    $('#retro').className = 'retro';
    $('#btn-valider').innerHTML = 'Vérifier <kbd>Entrée</kbd>';
    $('#btn-indice').disabled = false;
    $('#form-question').classList.remove('anim-ok', 'anim-ko');
    champs[0].focus();
  }

  $('#btn-audio-donnee').addEventListener('click', () => VI.parler(q.verbe[q.donnee]));

  $('#btn-indice').addEventListener('click', () => {
    if (!q || q.verifie) return;
    q.aIndice = true;
    q.niveauIndice++;
    q.demandees.forEach((f) => {
      const inp = $('#rep-' + f);
      const mot = VI.premiere(q.verbe[f]);
      const n = Math.min(q.niveauIndice, Math.max(1, mot.length - 1));
      inp.placeholder = mot.slice(0, n) + '…' + ' (' + mot.length + ' lettres)';
    });
    const premierVide = $$('#champs-reponse input').find((i) => !i.value.trim());
    (premierVide || $('#champs-reponse input')).focus();
  });

  $('#form-question').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!q) return;
    if (q.verifie) { suivante(); return; }
    // Entrée dans un champ : on passe au prochain champ vide avant de vérifier
    const champs = $$('#champs-reponse input');
    const actif = document.activeElement;
    const pos = champs.indexOf(actif);
    if (pos >= 0) {
      const prochain = champs.slice(pos + 1).find((i) => !i.value.trim());
      if (prochain) { prochain.focus(); return; }
    }
    verifier(); // des cases vides comptent comme « je ne sais pas » : c'est permis
  });

  function verifier() {
    const s = session, v = q.verbe;
    q.verifie = true;
    let nbOk = 0;
    q.demandees.forEach((f) => {
      const zone = $(`.champ-rep[data-f="${f}"]`);
      const inp = $('#rep-' + f);
      const ok = VI.verifier(f, inp.value, v[f]);
      if (ok) nbOk++;
      inp.readOnly = true;
      zone.classList.add(ok ? 'ok' : 'ko');
      const toutes = VI.variantes(v[f]);
      zone.querySelector('.correction').innerHTML = ok
        ? (toutes.length > 1 ? '✓ aussi accepté : ' + esc(toutes.join(' / ')) : '✓')
        : '→ <b>' + esc(toutes.join(' / ')) + '</b>';
    });
    const tout = nbOk === 3;

    // Points
    if (s.mode === 'sprint') { s.points += tout ? 1 : 0; s.max += 1; }
    else { s.points += nbOk * (q.aIndice ? 0.5 : 1); s.max += 3; }
    const gainXp = Math.round((nbOk * 3 + (tout ? 5 : 0)) * (q.aIndice ? 0.5 : 1));
    s.xp += gainXp;

    // Répétition espacée (boîtes de Leitner)
    const cle = VI.cle(v);
    const st = profil.boites[cle] || { b: 0, vu: 0 };
    st.vu++;
    if (tout && !q.aIndice) st.b = st.b === 0 ? 2 : Math.min(5, st.b + 1);
    else if (tout) st.b = Math.max(1, st.b);
    else st.b = 1;
    profil.boites[cle] = st;

    // Série
    if (tout && !q.aIndice) { s.serie++; s.serieMax = Math.max(s.serieMax, s.serie); } else s.serie = 0;
    $('#serie-live').textContent = s.serie >= 3 ? '🔥 ' + s.serie + ' de suite' : '';
    if (s.serie === 5) VI.toast('🔥 5 de suite !');
    if (s.serie === 10) { VI.toast('🔥🔥 10 de suite ! Incroyable.'); VI.confettis(); }

    s.resultats.push({ base: VI.premiere(v.base), tout, nbOk, indice: q.aIndice });

    // Rétroaction
    const carte = $('#form-question');
    void carte.offsetWidth;
    carte.classList.add(tout ? 'anim-ok' : 'anim-ko');
    const retro = $('#retro');
    retro.className = 'retro visible ' + (tout ? 'ok' : 'ko');
    const F = VI.FAMILLES[VI.famille(v)];
    const formes = [v.base, v.passe, v.participe].map(VI.premiere);
    const msg = tout ? BRAVO[Math.floor(Math.random() * BRAVO.length)] : PRESQUE[Math.floor(Math.random() * PRESQUE.length)];
    retro.innerHTML = `<p class="retro-titre">${tout ? '✅' : '💪'} ${esc(msg)} <span class="xp">+${gainXp} XP</span></p>` +
      (s.mode === 'sprint' && tout ? '' : `
      <div class="retro-famille">
        <p><b>${esc(formes.join(' → '))}</b>
          ${VI.audioDispo() ? `<button type="button" class="btn-icone btn-audio" data-dire="${esc(formes.join(' → '))}" aria-label="Écouter">🔊</button>` : ''}</p>
        <p class="muted">Famille <b>${esc(F.nom)}</b> : ${esc(F.explication)}</p>
        <p class="repere" lang="en">Yesterday, I <b>${esc(formes[1])}</b>… · I have <b>${esc(formes[2])}</b>…</p>
      </div>`);

    $('#btn-indice').disabled = true;
    $('#btn-valider').innerHTML = 'Suivant → <kbd>Entrée</kbd>';
    $('#btn-valider').focus();

    if (s.mode === 'sprint') s.auto = setTimeout(() => { if (session === s && q && q.verifie) suivante(); }, tout ? 450 : 1800);
  }

  $('#retro').addEventListener('click', (e) => { const a = e.target.closest('[data-dire]'); if (a) VI.parler(a.dataset.dire); });

  function suivante() {
    const s = session; if (!s) return;
    clearTimeout(s.auto);
    s.index++;
    if (s.fin && Date.now() >= s.fin) return terminer(true);
    if (s.index >= s.total) return terminer(true);
    if (s.type === 'phrase') nouvellePhrase();
    else if (s.type === 'chasse') nouvelleManche();
    else if (s.type === 'vf') nouveauVF();
    else nouvelleQuestion();
  }

  $('#btn-quitter').addEventListener('click', () => {
    if (!session) return afficherAccueil();
    if (session.resultats.length) terminer(false); // activité interrompue : résultats envoyés, mais pas de badge
    else { arreterSession(); afficherAccueil(); }
  });

  function arreterSession() {
    if (!session) return;
    clearInterval(session.minuterie); clearTimeout(session.auto);
    session = null; q = null;
  }

  /* ---------------- Activités en contexte et défis ---------------- */
  function phrasesDuBloc(b) {
    const parBase = {};
    verbesDuBloc(b).forEach((v) => { parBase[VI.norm(VI.premiere(v.base))] = v; });
    return PHRASES.filter((p) => parBase[VI.norm(p.v)]).map((p) => Object.assign({ verbe: parBase[VI.norm(p.v)] }, p));
  }
  const CARTES = { formes: 'form-question', phrase: 'form-phrase', vf: 'carte-vf', chasse: 'form-chasse' };
  function montrerCarte(type) {
    Object.values(CARTES).forEach((id) => { $('#' + id).hidden = id !== CARTES[type]; });
    $$('[data-etiquette]').forEach((el) => { el.textContent = MODES[session.mode].icone + ' ' + MODES[session.mode].titre + ' · Bloc ' + session.bloc; });
  }
  function majBoite(v, tout, indice) {
    const cle = VI.cle(v);
    const st = profil.boites[cle] || { b: 0, vu: 0 };
    st.vu++;
    if (tout && !indice) st.b = st.b === 0 ? 2 : Math.min(5, st.b + 1);
    else if (tout) st.b = Math.max(1, st.b);
    else st.b = 1;
    profil.boites[cle] = st;
  }
  function majSerie(ok) {
    const s = session;
    if (ok) { s.serie++; s.serieMax = Math.max(s.serieMax, s.serie); } else s.serie = 0;
    $$('[data-serie]').forEach((el) => { el.textContent = s.serie >= 3 ? '🔥 ' + s.serie + ' de suite' : ''; });
    if (s.serie === 5) VI.toast('🔥 5 de suite !');
    if (s.serie === 10) { VI.toast('🔥🔥 10 de suite ! Incroyable.'); VI.confettis(); }
  }
  function progression() {
    const s = session;
    if (s.type === 'vf') return;
    $('#compteur').textContent = s.type === 'chasse' ? 'Manche ' + (s.index + 1) + ' / ' + s.total : (s.index + 1) + ' / ' + s.total;
    $('#progression-barre').style.width = (s.index / s.total) * 100 + '%';
  }
  const animer = (el, ok) => { el.classList.remove('anim-ok', 'anim-ko'); void el.offsetWidth; el.classList.add(ok ? 'anim-ok' : 'anim-ko'); };
  const hasard = (t) => t[Math.floor(Math.random() * t.length)];
  // Met en évidence l'indice de temps dans un texte déjà échappé
  const surligner = (texteEsc, indice) => {
    if (!indice) return texteEsc;
    const i = esc(indice), pos = texteEsc.indexOf(i);
    return pos < 0 ? texteEsc : texteEsc.slice(0, pos) + '<mark>' + i + '</mark>' + texteEsc.slice(pos + i.length);
  };
  function phraseHtml(p, verbeHtml) {
    const [avant, apres] = p.s.split('___');
    const a = surligner(esc(avant), p.c);
    const b = a.includes('<mark>') ? esc(apres) : surligner(esc(apres), p.c);
    return a + verbeHtml + b;
  }

  function demarrerSpecial(mode) {
    const pool = verbesDuBloc(choix.bloc);
    const phrases = phrasesDuBloc(choix.bloc);
    if (mode !== 'vraifaux' && phrases.length < 5) { VI.toast('Pas assez de phrases pour ce bloc.'); return; }
    session = {
      id: VI.uid(), mode, bloc: choix.bloc, pool, phrases, debut: Date.now(), index: 0,
      type: mode === 'phrases' ? 'phrase' : mode === 'erreurs' ? 'chasse' : 'vf',
      total: mode === 'phrases' ? C.questionsPhrases : mode === 'erreurs' ? C.manchesChasse : Infinity,
      recents: [], recentsP: [], resultats: [], points: 0, max: 0, serie: 0, serieMax: 0, xp: 0,
      maitriseAvant: maitrise(choix.bloc).ok, minuterie: null, auto: null
    };
    afficher('ecran-exercice');
    montrerCarte(session.type);
    $$('[data-serie]').forEach((el) => { el.textContent = ''; });
    if (session.type === 'vf') {
      session.dureeMs = C.dureeVraiFaux * 1000;
      session.fin = Date.now() + session.dureeMs;
      session.minuterie = setInterval(tic, 200);
      nouveauVF(); tic();
    } else if (session.type === 'phrase') nouvellePhrase();
    else nouvelleManche();
  }

  /* ----- Phrases à compléter ----- */
  function nouvellePhrase() {
    const s = session;
    const verbes = [...new Set(s.phrases.map((p) => p.verbe))];
    const v = choisirVerbe(verbes);
    s.recents.push(VI.cle(v)); if (s.recents.length > Math.min(4, verbes.length - 1)) s.recents.shift();
    const options = s.phrases.filter((p) => p.verbe === v);
    const p = hasard(options.filter((x) => !s.recentsP.includes(x.s)).length ? options.filter((x) => !s.recentsP.includes(x.s)) : options);
    s.recentsP.push(p.s); s.recentsP = s.recentsP.slice(-30);
    q = { type: 'phrase', verbe: v, p, aIndice: false, verifie: false };
    progression();
    const [avant, apres] = p.s.split('___');
    $('#phrase-texte').innerHTML = esc(avant) +
      `<input id="rep-phrase" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Le verbe ${esc(VI.premiere(v.base))} au bon temps">` +
      ` <span class="verbe-base">(${esc(VI.premiere(v.base))})</span>` + esc(apres);
    $('#phrase-indice').textContent = '';
    $('#retro-phrase').className = 'retro'; $('#retro-phrase').innerHTML = '';
    $('#btn-valider-phrase').innerHTML = 'Vérifier <kbd>Entrée</kbd>';
    $('#btn-indice-phrase').disabled = false;
    $('#form-phrase').classList.remove('anim-ok', 'anim-ko');
    $('#rep-phrase').focus();
  }
  $('#btn-indice-phrase').addEventListener('click', () => {
    if (!q || q.type !== 'phrase' || q.verifie) return;
    q.aIndice = true;
    $('#phrase-indice').innerHTML = `💡 En français : <b>${esc(VI.premiere(q.verbe.fr))}</b> · La réponse commence par « <b>${esc(VI.premiere(q.p.r)[0])}</b> » et compte ${VI.premiere(q.p.r).length} lettres.`;
    $('#btn-indice-phrase').disabled = true;
    $('#rep-phrase').focus();
  });
  $('#form-phrase').addEventListener('submit', (e) => { e.preventDefault(); if (!q || q.type !== 'phrase') return; if (q.verifie) suivante(); else verifierPhrase(); });
  function verifierPhrase() {
    const s = session, p = q.p, v = q.verbe;
    q.verifie = true;
    const inp = $('#rep-phrase');
    const ok = VI.verifier('passe', inp.value, p.r);
    inp.readOnly = true; inp.classList.add(ok ? 'ok' : 'ko');
    s.points += ok ? (q.aIndice ? 0.5 : 1) : 0; s.max += 1;
    const gain = ok ? (q.aIndice ? 4 : 8) : 0; s.xp += gain;
    majBoite(v, ok, q.aIndice);
    majSerie(ok && !q.aIndice);
    s.resultats.push({ base: VI.premiere(v.base), tout: ok, indice: q.aIndice });
    animer($('#form-phrase'), ok);
    const reponse = VI.variantes(p.r).join(' / ');
    const plein = p.s.replace('___', VI.premiere(p.r));
    $('#retro-phrase').className = 'retro visible ' + (ok ? 'ok' : 'ko');
    $('#retro-phrase').innerHTML =
      `<p class="retro-titre">${ok ? '✅ ' + esc(hasard(BRAVO)) : '💪 La bonne réponse : <b class="mono">' + esc(reponse) + '</b>'} ${gain ? `<span class="xp">+${gain} XP</span>` : ''}</p>
      <div class="retro-famille">
        <p class="phrase-complete" lang="en">${phraseHtml(p, '<b class="rep">' + esc(reponse) + '</b>')}
          ${VI.audioDispo() ? `<button type="button" class="btn-icone btn-audio" data-dire="${esc(plein)}" aria-label="Écouter la phrase">🔊</button>` : ''}</p>
        <p class="muted"><span class="tag-forme">${esc(VI.LIBELLE_FORME[p.f])}</span> ${esc(VI.explication(p.f, p.c))}</p>
      </div>`;
    $('#btn-indice-phrase').disabled = true;
    $('#btn-valider-phrase').innerHTML = 'Suivant → <kbd>Entrée</kbd>';
    $('#btn-valider-phrase').focus();
  }
  $('#retro-phrase').addEventListener('click', (e) => { const a = e.target.closest('[data-dire]'); if (a) VI.parler(a.dataset.dire); });

  /* ----- Chasse aux erreurs ----- */
  // Pour chaque phrase, l'élève choisit explicitement « ✓ Correct » ou « ✗ À corriger » (et écrit alors la bonne forme).
  function nouvelleManche() {
    const s = session;
    const choisies = [], vus = new Set();
    for (const p of VI.melanger(s.phrases)) { if (vus.has(p.v)) continue; vus.add(p.v); choisies.push(p); if (choisies.length === 5) break; }
    const nbErreurs = Math.random() < 0.5 ? 2 : 3;
    const avecErreur = new Set(VI.melanger([...choisies.keys()]).slice(0, nbErreurs));
    q = { type: 'chasse', verifie: false, items: choisies.map((p, i) => {
      let affiche = VI.premiere(p.r), faux = false;
      if (avecErreur.has(i)) { const f = VI.fausseFormePhrase(p, p.verbe); if (f) { affiche = f; faux = true; } }
      return { p, affiche, faux, choix: null };
    }) };
    progression();
    $('#liste-chasse').innerHTML = q.items.map((it, i) => `<li data-i="${i}">
      <div class="ligne-chasse">
        <p class="phrase-chasse" lang="en">${esc(it.p.s.split('___')[0])}<span class="verbe-chasse">${esc(it.affiche)}</span>${esc(it.p.s.split('___')[1])}</p>
        <div class="choix-chasse" role="group" aria-label="Phrase ${i + 1} : le verbe est-il correct ?">
          <button type="button" class="btn-choix ok" data-choix="ok" data-i="${i}" aria-pressed="false">✓ Correct</button>
          <button type="button" class="btn-choix faux" data-choix="faux" data-i="${i}" aria-pressed="false">✗ À corriger</button>
        </div>
      </div>
      <div class="correction-chasse" hidden>
        <label>Bonne forme : <input type="text" data-i="${i}" lang="en" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="écris la bonne forme"></label>
        <span class="avert-chasse" aria-live="polite"></span>
      </div>
      <div class="retro-chasse"></div></li>`).join('');
    $('#retro-chasse').className = 'retro'; $('#retro-chasse').innerHTML = '';
    $('#form-chasse').classList.remove('anim-ok', 'anim-ko');
    majBoutonChasse();
    const premier = $('#liste-chasse .btn-choix'); if (premier) premier.focus();
  }

  // État du bouton Vérifier : il faut une décision pour chaque phrase et une correction pour chaque « À corriger »
  function etatChasse() {
    let decides = 0, manquantes = 0, identiques = 0;
    q.items.forEach((it, i) => {
      if (it.choix) decides++;
      const li = $(`#liste-chasse li[data-i="${i}"]`);
      const inp = li.querySelector('input'), avert = li.querySelector('.avert-chasse');
      avert.textContent = '';
      if (it.choix === 'faux') {
        const v = inp.value.trim();
        if (!v) manquantes++;
        else if (VI.norm(v) === VI.norm(it.affiche)) { identiques++; avert.textContent = 'C\'est la même forme ! Si ce verbe est correct, choisis « ✓ Correct ».'; }
      }
    });
    return { decides, manquantes, identiques };
  }
  function majBoutonChasse() {
    if (!q || q.type !== 'chasse' || q.verifie) return;
    const e = etatChasse(), btn = $('#btn-valider-chasse'), n = q.items.length;
    if (e.decides < n) { btn.disabled = true; btn.innerHTML = `Décide pour chaque phrase (${e.decides}/${n})`; }
    else if (e.manquantes) { btn.disabled = true; btn.innerHTML = `Écris la bonne forme (${e.manquantes} manquante${e.manquantes > 1 ? 's' : ''})`; }
    else if (e.identiques) { btn.disabled = true; btn.innerHTML = 'Vérifie tes corrections'; }
    else { btn.disabled = false; btn.innerHTML = 'Vérifier <kbd>Entrée</kbd>'; }
  }

  $('#liste-chasse').addEventListener('click', (e) => {
    const b = e.target.closest('.btn-choix'); if (!b || !q || q.type !== 'chasse' || q.verifie) return;
    const i = Number(b.dataset.i), it = q.items[i];
    it.choix = b.dataset.choix;
    const li = b.closest('li');
    li.querySelectorAll('.btn-choix').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    li.classList.toggle('a-corriger', it.choix === 'faux');
    li.classList.toggle('juge-correct', it.choix === 'ok');
    const zone = li.querySelector('.correction-chasse');
    zone.hidden = it.choix !== 'faux';
    if (it.choix === 'faux') zone.querySelector('input').focus();
    else { // passe à la prochaine phrase sans décision
      const suivant = q.items.findIndex((x, k) => k > i && !x.choix);
      if (suivant >= 0) $(`#liste-chasse li[data-i="${suivant}"] .btn-choix`).focus();
    }
    majBoutonChasse();
  });
  $('#liste-chasse').addEventListener('input', majBoutonChasse);

  $('#form-chasse').addEventListener('submit', (e) => {
    e.preventDefault(); if (!q || q.type !== 'chasse') return;
    if (q.verifie) return suivante();
    // Entrée dans une case de correction : on passe à la prochaine phrase sans décision, ou au bouton
    const actif = document.activeElement;
    if (actif && actif.matches('#liste-chasse input')) {
      const i = Number(actif.dataset.i);
      const suivant = q.items.findIndex((x, k) => k > i && !x.choix);
      if (suivant >= 0) { $(`#liste-chasse li[data-i="${suivant}"] .btn-choix`).focus(); return; }
      if ($('#btn-valider-chasse').disabled) return;
    }
    if (!$('#btn-valider-chasse').disabled) verifierChasse();
  });

  function verifierChasse() {
    const s = session;
    q.verifie = true;
    let pts = 0, max = 0, trouvees = 0, total = 0;
    q.items.forEach((it, i) => {
      const li = $(`#liste-chasse li[data-i="${i}"]`);
      const inp = li.querySelector('input');
      inp.readOnly = true;
      li.querySelectorAll('.btn-choix').forEach((x) => { x.disabled = true; });
      const bonne = esc(VI.variantes(it.p.r).join(' / '));
      const expl = `<span class="tag-forme">${esc(VI.LIBELLE_FORME[it.p.f])}</span> ${esc(VI.explication(it.p.f, it.p.c))}`;
      let p = 0, m = 0, msg = '', classe = '';
      if (it.faux) {
        total++; m = 2;
        const repere = it.choix === 'faux';
        const corr = repere && VI.verifier('passe', inp.value, it.p.r);
        if (repere) { p++; trouvees++; }
        if (corr) p++;
        if (corr) { classe = 'ok'; msg = `✅ Bien vu et bien corrigé : <b>${bonne}</b>`; }
        else if (repere) { classe = 'moyen'; msg = `🟠 Bien repéré ! Mais la bonne forme est <b>${bonne}</b>. ${expl}`; }
        else { classe = 'ko'; msg = `❌ Il y avait une erreur : « ${esc(it.affiche)} » → <b>${bonne}</b>. ${expl}`; }
      } else {
        m = 1;
        if (it.choix === 'faux') { classe = 'ko'; msg = `⚠️ Ce verbe était déjà correct : il fallait choisir « ✓ Correct ». ${expl}`; }
        else { p = 1; classe = 'ok'; msg = '✅ Oui, ce verbe était correct.'; }
      }
      pts += p; max += m;
      li.classList.add(classe);
      li.querySelector('.retro-chasse').innerHTML = `<p>${msg}</p>`;
      s.resultats.push({ base: VI.premiere(it.p.verbe.base), tout: p === m, indice: false });
    });
    s.points += pts; s.max += max;
    const gain = pts * 3; s.xp += gain;
    majSerie(pts === max);
    animer($('#form-chasse'), pts === max);
    $('#retro-chasse').className = 'retro visible ' + (pts === max ? 'ok' : 'ko');
    $('#retro-chasse').innerHTML = `<p class="retro-titre">${pts === max ? '🕵️ Manche parfaite !' : '🔎 ' + trouvees + ' erreur' + (trouvees > 1 ? 's' : '') + ' repérée' + (trouvees > 1 ? 's' : '') + ' sur ' + total + '.'} <span class="xp">+${gain} XP</span></p>`;
    const btn = $('#btn-valider-chasse');
    btn.disabled = false;
    btn.innerHTML = (s.index + 1 >= s.total ? 'Voir mes résultats' : 'Manche suivante →') + ' <kbd>Entrée</kbd>';
    btn.focus();
  }

  /* ----- Vrai ou faux éclair ----- */
  function nouveauVF() {
    const s = session;
    let candidats = s.pool.filter((v) => !s.recents.includes(VI.cle(v)));
    if (!candidats.length) candidats = s.pool;
    const v = hasard(candidats);
    s.recents.push(VI.cle(v)); if (s.recents.length > Math.min(5, s.pool.length - 1)) s.recents.shift();
    const formes = { base: VI.premiere(v.base), passe: hasard(VI.variantes(v.passe)), participe: hasard(VI.variantes(v.participe)) };
    let fausse = null;
    if (Math.random() < 0.5) {
      const col = Math.random() < 0.5 ? 'passe' : 'participe';
      const f = VI.fausseForme(v, col) || VI.fausseForme(v, col === 'passe' ? 'participe' : 'passe');
      if (f) { fausse = VI.fausseForme(v, col) ? col : (col === 'passe' ? 'participe' : 'passe'); formes[fausse] = f; }
    }
    q = { type: 'vf', verbe: v, vrai: !fausse, formes, verifie: false };
    $('#vf-trio').innerHTML = ['base', 'passe', 'participe'].map((c) => `<span>${esc(formes[c])}</span>`).join('<i aria-hidden="true">→</i>');
    $('#vf-fr').textContent = VI.premiere(v.fr);
    $('#vf-correction').innerHTML = '';
    $('#carte-vf').classList.remove('vf-ok', 'vf-ko');
    $('#btn-vrai').disabled = false; $('#btn-faux').disabled = false;
  }
  function repondreVF(reponseVrai) {
    const s = session;
    if (!q || q.type !== 'vf' || q.verifie) return;
    q.verifie = true;
    const ok = reponseVrai === q.vrai;
    s.points += ok ? 1 : 0; s.max += 1;
    if (ok) s.xp += 3;
    majSerie(ok);
    s.resultats.push({ base: VI.premiere(q.verbe.base), tout: ok, indice: false });
    const carte = $('#carte-vf');
    carte.classList.add(ok ? 'vf-ok' : 'vf-ko');
    $('#btn-vrai').disabled = true; $('#btn-faux').disabled = true;
    if (!ok) $('#vf-correction').innerHTML = (q.vrai ? 'C\'était vrai : ' : 'Correct : ') + `<b class="mono">${esc([q.verbe.base, q.verbe.passe, q.verbe.participe].map((x) => VI.variantes(x).join('/')).join(' → '))}</b>`;
    tic();
    s.auto = setTimeout(() => { if (session === s) { if (Date.now() >= s.fin) terminer(true); else nouveauVF(); } }, ok ? 380 : 1700);
  }
  $('#btn-vrai').addEventListener('click', () => repondreVF(true));
  $('#btn-faux').addEventListener('click', () => repondreVF(false));
  document.addEventListener('keydown', (e) => {
    if (!session || session.type !== 'vf' || $('#ecran-exercice').hidden) return;
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'v') { e.preventDefault(); repondreVF(true); }
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'f') { e.preventDefault(); repondreVF(false); }
  });
  let toucheX = null;
  $('#carte-vf').addEventListener('touchstart', (e) => { toucheX = e.touches[0].clientX; }, { passive: true });
  $('#carte-vf').addEventListener('touchend', (e) => {
    if (toucheX == null) return;
    const dx = e.changedTouches[0].clientX - toucheX; toucheX = null;
    if (Math.abs(dx) > 60) repondreVF(dx > 0);
  });

  /* ---------------- Fin d'activité ---------------- */
  // complet = l'activité est allée jusqu'au bout (toutes les questions ou tout le temps).
  // Une activité interrompue avec « Quitter » est enregistrée, mais ne donne ni badge, ni record, ni jour de série.
  function terminer(complet) {
    const s = session; if (!s) return;
    clearInterval(s.minuterie); clearTimeout(s.auto);
    session = null; q = null;
    if (!s.resultats.length) { afficherAccueil(); return; }

    const duree = Math.round((Date.now() - s.debut) / 1000);
    const pct = s.max ? Math.round((s.points / s.max) * 100) : 0;
    const reussis = [...new Set(s.resultats.filter((r) => r.tout).map((r) => r.base))];
    const rates = [...new Set(s.resultats.filter((r) => !r.tout).map((r) => r.base))];

    // Profil
    profil.xp += s.xp;
    if (complet && !profil.jours.includes(VI.aujourdhui())) profil.jours.push(VI.aujourdhui());
    profil.jours = profil.jours.slice(-60);
    let record = false;
    const chrono = s.mode === 'sprint' || s.mode === 'vraifaux';
    const cleRecord = s.mode === 'vraifaux' ? 'vf' + s.bloc : s.bloc;
    if (complet && chrono && s.points > (profil.sprint[cleRecord] || 0)) { profil.sprint[cleRecord] = s.points; record = s.points > 0; }
    profil.historique.push({ d: Date.now(), bloc: s.bloc, mode: s.mode, pct });
    profil.historique = profil.historique.slice(-50);

    // Badges
    const nouveaux = [];
    const gagner = (id) => { if (!profil.badges.includes(id)) { profil.badges.push(id); nouveaux.push(BADGES.find((b) => b.id === id)); } };
    const sansIndice = !s.resultats.some((r) => r.indice);
    if (complet) {
      gagner('premier');
      if (s.mode === 'sprint' && s.points >= 15) gagner('eclair');
      if (s.mode === 'quiz' && s.resultats.length >= CONFIG.questionsQuiz && pct === 100 && sansIndice) gagner('parfait');
      if (s.mode === 'phrases' && s.resultats.length >= C.questionsPhrases && pct === 100 && sansIndice) gagner('contexte');
      if (s.mode === 'erreurs' && s.index + 1 >= C.manchesChasse && pct === 100) gagner('detective');
      if (s.mode === 'vraifaux' && s.points >= 20 && pct >= 90) gagner('lynx');
      if (serieJours() >= 3) gagner('constance');
    }
    if (s.serieMax >= 10) gagner('serie10'); // 10 bonnes réponses de suite, sans indice : mérité même si on quitte ensuite
    [1, 2, 3, 4].forEach((b) => { const m = maitrise(b); if (m.total && m.ok === m.total) gagner('maitre' + b); });
    sauverProfil();

    // Envoi à la feuille Google (avec file d'attente hors-ligne)
    envoyer({
      id: s.id, code: eleve.code, groupe: eleve.groupe, bloc: s.bloc, mode: s.mode,
      score: s.points, max: s.max, pct, duree, questions: s.resultats.length,
      reussis: reussis.join(','), rates: rates.join(',')
    });

    // Affichage
    const etatApres = maitrise(s.bloc);
    const mApres = etatApres.ok;
    const gain = mApres - s.maitriseAvant;
    $('#anneau').style.setProperty('--pct', pct);
    $('#res-pct').textContent = chrono ? s.points : pct + ' %';
    $('#anneau').classList.toggle('sprint', chrono);
    $('#res-titre').textContent = chrono
      ? (record ? 'Nouveau record ! 🏆' : s.points + ' bonne' + (s.points > 1 ? 's' : '') + ' réponse' + (s.points > 1 ? 's' : '') + ' en ' + Math.round(s.dureeMs / 1000) + ' s')
      : pct >= 90 ? 'Excellent travail ! 🌟' : pct >= 75 ? 'Très bien ! 👏' : pct >= 50 ? 'Beau progrès ! 💪' : 'Chaque essai te fait progresser 🌱';
    const E = etatApres;
    $('#res-message').innerHTML = (complet ? '' : '<span class="note-interrompue">⏸️ Activité interrompue : tes réponses comptent pour ta progression, mais les badges, les records et les jours de série se gagnent seulement en terminant l\'activité au complet.</span>') + (gain > 0 ? `<b>+${pluriel(gain, 'verbe')} maîtrisé${gain > 1 ? 's' : ''} ! 🎉</b><br>` : '') +
      `<span class="etat-titre">Bloc ${s.bloc} : ta progression</span>${barreEtat(E)}
      <span class="legende-etat">
        <span><i class="pt seg-ok"></i><b>${E.ok}</b> maîtrisé${E.ok > 1 ? 's' : ''}</span>
        <span><i class="pt seg-voie"></i><b>${E.voie}</b> en bonne voie</span>
        <span><i class="pt seg-revoir"></i><b>${E.revoir}</b> à revoir</span>
        ${E.nouveaux ? `<span><i class="pt seg-nouveau"></i><b>${E.nouveaux}</b> pas encore vu${E.nouveaux > 1 ? 's' : ''}</span>` : ''}
      </span>
      <span class="aide-etat">Un verbe devient « maîtrisé » après 3 bonnes réponses sans indice.${rates.length ? ' Les verbes ratés reviendront plus souvent, c\'est voulu.' : ''}</span>`;
    const min = Math.floor(duree / 60), sec = duree % 60;
    $('#res-stats').innerHTML = [
      ['Bonnes réponses', s.resultats.filter((r) => r.tout).length + ' / ' + s.resultats.length],
      ['XP gagnés', '+' + s.xp],
      ['Meilleure série', s.serieMax],
      ['Durée', (min ? min + ' min ' : '') + sec + ' s']
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');

    const aRevoir = rates.map((b) => s.pool.find((v) => VI.premiere(v.base) === b)).filter(Boolean);
    $('#res-revoir').innerHTML = aRevoir.length ? `<h2>À revoir</h2><ul class="liste-revoir">${aRevoir.map((v) => {
      const f = [v.base, v.passe, v.participe].map((x) => VI.variantes(x).join('/'));
      return `<li><span lang="en"><b>${esc(f[0])}</b> → ${esc(f[1])} → ${esc(f[2])}</span><span class="muted">${esc(VI.premiere(v.fr))}</span>${VI.audioDispo() ? `<button class="btn-icone btn-audio" data-dire="${esc(f.join(' → '))}" aria-label="Écouter">🔊</button>` : ''}</li>`;
    }).join('')}</ul><button class="btn btn-secondaire" id="btn-pratiquer-rates">🧠 Pratiquer ces verbes maintenant</button>` : '';

    $('#btn-res-rejouer').onclick = () => demarrer(s.mode);
    const bp = $('#btn-pratiquer-rates'); if (bp) bp.onclick = () => demarrer('difficiles');

    majEntete();
    afficher('ecran-resultats');
    if (pct >= 90 || record || nouveaux.length) VI.confettis();
    nouveaux.forEach((b, i) => setTimeout(() => VI.toast(`<span class="toast-icone">${b.icone}</span> Nouveau badge : <b>${esc(b.nom)}</b>`, 'trophee'), 400 + i * 900));
  }

  $('#btn-res-accueil').addEventListener('click', afficherAccueil);
  $('#res-revoir').addEventListener('click', (e) => { const a = e.target.closest('[data-dire]'); if (a) VI.parler(a.dataset.dire); });

  /* ---------------- Envoi et file d'attente hors-ligne ---------------- */
  let envoiEnCours = false;
  function envoyer(donnees) {
    if (LOCAL) { majSync(); return; }
    const file = VI.store.get('vi:file', []).filter((x) => x && x.data);   // ignore le format des versions précédentes
    file.push({ code: eleve.code, data: donnees });
    VI.store.set('vi:file', file.slice(-300));
    viderFile();
  }
  let avertiSession = false;
  async function viderFile() {
    if (LOCAL || envoiEnCours || !navigator.onLine) { majSync(); return; }
    let file = VI.store.get('vi:file', []).filter((x) => x && x.data);
    envoiEnCours = true; majSync(true);
    try {
      let i = 0;
      while (i < file.length) {
        const item = file[i];
        const tk = jeton(item.code);
        if (!tk) { i++; continue; }                  // cet élève devra se reconnecter : on passe aux autres
        try {
          await VI.api('submit', { code: item.code, token: tk, data: item.data });
          file.splice(i, 1);
        } catch (e) {
          if (!e.serveur) throw e;                   // réseau : on réessaiera plus tard
          if (/Session élève expirée/.test(e.message)) {
            VI.store.del('vi:jeton:' + item.code);
            if (eleve && item.code === eleve.code && !avertiSession) { avertiSession = true; VI.toast('🔒 Reconnecte-toi avec ton NIP pour envoyer tes résultats.', 'erreur'); }
            i++; continue;
          }
          item._essais = (item._essais || 0) + 1;
          if (item._essais >= 5) file.splice(i, 1); else throw e;
        } finally { VI.store.set('vi:file', file); }
      }
      await pousserProgression();
    } catch (e) { /* on réessaiera */ }
    finally { envoiEnCours = false; purgerJetons(); majSync(); }
  }
  // Sauvegarde la progression de l'élève connecté dans la feuille Google
  async function pousserProgression() {
    if (LOCAL || !eleve || !VI.store.get('vi:sale:' + eleve.code, false)) return;
    const tk = jeton(eleve.code); if (!tk) return;
    try {
      await VI.api('saveProgress', { code: eleve.code, token: tk, progression: profil });
      VI.store.del('vi:sale:' + eleve.code);
    } catch (e) {
      if (e.serveur && /Session élève expirée/.test(e.message)) VI.store.del('vi:jeton:' + eleve.code);
    }
  }
  function majSync(enCours) {
    const el = $('#sync');
    if (LOCAL) { el.textContent = '📴 Local'; el.title = 'Mode local : la progression reste sur cet appareil (aucune URL de script configurée).'; return; }
    const n = VI.store.get('vi:file', []).filter((x) => x && x.data).length;
    if (enCours) { el.textContent = '⏳ Envoi…'; el.title = 'Envoi des résultats en cours'; }
    else if (n) { el.textContent = '⏳ ' + n + ' en attente'; el.title = 'Les résultats seront envoyés automatiquement (réseau ou reconnexion requis).'; }
    else { el.textContent = '☁️ À jour'; el.title = 'Tous les résultats sont envoyés.'; }
  }
  window.addEventListener('online', viderFile);
  setInterval(viderFile, 60000);

  /* ---------------- Démarrage ---------------- */
  VI.initApparence($('#btn-theme'), $('#btn-lecture'));
  VI.store.del('vi:dernier'); // ancienne reconnexion automatique (remplacée par le NIP)
  const enCours = lireSessionOnglet();   // même onglet déjà connecté (ex. page actualisée)
  if (enCours && RX_CODE.test(enCours) && (LOCAL || jeton(enCours))) reussirConnexion(enCours, null, null);
  else afficherConnexion();
  majSync();
  viderFile();
  chargerEcoles().then(() => { if (eleve) eleve.nomEcole = nomEcole(eleve.ecole); });
  const rafraichirAccueil = () => { if (!session && eleve && !$('#ecran-accueil').hidden) afficherAccueil(); };
  VI.rafraichirVerbes().then((change) => { if (change) { VERBES = VI.verbesLocaux(); rafraichirAccueil(); } });
  VI.rafraichirPhrases().then((change) => { if (change) { PHRASES = VI.phrasesLocales(); rafraichirAccueil(); } });
})();
