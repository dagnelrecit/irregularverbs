/* ============================================================
   Application élève
   ============================================================ */
'use strict';
(function () {
  const { $, $$ } = VI;
  const esc = VI.echapper;

  let VERBES = VI.verbesLocaux();
  let eleve = null;      // { code, groupe }
  let profil = null;     // progression locale de l'élève
  let session = null;    // activité en cours
  let q = null;          // question en cours
  const choix = { bloc: VI.store.get('vi:bloc', 1), forme: VI.store.get('vi:forme', 'hasard') };

  const MODES = {
    etude:        { titre: 'Étudier',              icone: '📖', desc: 'Découvre les verbes par familles et teste ta mémoire.' },
    entrainement: { titre: 'Entraînement',         icone: '🎯', desc: '15 questions qui ciblent tes erreurs. Indices permis.' },
    quiz:         { titre: 'Quiz',                 icone: '📝', desc: '20 questions notées. Un indice coûte la moitié des points.' },
    sprint:       { titre: 'Sprint 60 s',          icone: '⚡', desc: 'Le plus de verbes possible en une minute. Sans indice.' },
    difficiles:   { titre: 'Mes verbes difficiles', icone: '🧠', desc: 'Seulement les verbes qui te donnent du fil à retordre.' }
  };

  const BADGES = [
    { id: 'premier',   icone: '👣', nom: 'Premier pas', desc: 'Terminer une première activité' },
    { id: 'serie10',   icone: '🔥', nom: '10 de suite', desc: '10 bonnes réponses consécutives sans indice' },
    { id: 'eclair',    icone: '⚡', nom: 'Éclair',      desc: 'Au moins 15 verbes réussis en sprint' },
    { id: 'parfait',   icone: '💎', nom: 'Sans faute',  desc: 'Un quiz à 100 % sans indice' },
    { id: 'constance', icone: '📅', nom: 'Constance',   desc: 'Pratiquer 3 jours de suite' },
    { id: 'maitre1',   icone: '🥇', nom: 'Maître · bloc 1', desc: 'Maîtriser tous les verbes du bloc 1' },
    { id: 'maitre2',   icone: '🥇', nom: 'Maître · bloc 2', desc: 'Maîtriser tous les verbes du bloc 2' },
    { id: 'maitre3',   icone: '🥇', nom: 'Maître · bloc 3', desc: 'Maîtriser tous les verbes du bloc 3' },
    { id: 'maitre4',   icone: '🥇', nom: 'Maître · bloc 4', desc: 'Maîtriser tous les verbes du bloc 4' }
  ];

  const BRAVO = ['Excellent !', 'Parfait !', 'Bien joué !', 'Superbe !', 'Exactement !', 'Nice!', 'Great job!'];
  const PRESQUE = ['Presque ! Observe les corrections.', 'Pas encore… et c\'est comme ça qu\'on apprend.', 'Ton cerveau vient de noter cette erreur : tu le reverras bientôt.', 'Regarde bien la famille de ce verbe, ça aide !'];

  /* ---------------- Profil local (par élève, utile sur un Chromebook partagé) ---------------- */
  const chargerProfil = (code) => Object.assign(
    { xp: 0, boites: {}, badges: [], jours: [], sprint: {}, historique: [] },
    VI.store.get('vi:eleve:' + code, {})
  );
  const sauverProfil = () => VI.store.set('vi:eleve:' + eleve.code, profil);
  const boite = (v) => (profil.boites[VI.cle(v)] || { b: 0, vu: 0 }).b;
  const niveau = () => Math.floor(Math.sqrt(profil.xp / 40)) + 1;
  const verbesDuBloc = (b) => VERBES.filter((v) => v.bloc === b);
  const maitrise = (b) => { const l = verbesDuBloc(b); return { total: l.length, ok: l.filter((v) => boite(v) >= 4).length }; };
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
    $('#pastille-code').textContent = eleve.code;
  }

  /* ---------------- Connexion ---------------- */
  function lireCode() {
    const g = $('#in-groupe').value.replace(/\D/g, '');
    const i = $('#in-initiales').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return { g, i, code: g && i ? g + '-' + i : '' };
  }
  function afficherConnexion() {
    eleve = null; profil = null; majEntete();
    const codes = VI.store.get('vi:codes', []);
    $('#anciens-codes').innerHTML = codes.length
      ? '<p class="muted petit">Déjà utilisé sur cet appareil :</p>' + codes.map((c) =>
          `<span class="puce-code"><button type="button" data-code="${esc(c)}">${esc(c)}</button><button type="button" class="retirer" data-retirer="${esc(c)}" aria-label="Retirer ${esc(c)} de cet appareil">✕</button></span>`).join('')
      : '';
    afficher('ecran-connexion');
    $('#in-groupe').focus();
  }
  function connecter(code) {
    const [groupe] = code.split('-');
    eleve = { code, groupe };
    profil = chargerProfil(code);
    VI.store.set('vi:dernier', code);
    const codes = VI.store.get('vi:codes', []).filter((c) => c !== code);
    codes.unshift(code);
    VI.store.set('vi:codes', codes.slice(0, 8));
    afficherAccueil();
  }

  $('#form-connexion').addEventListener('input', () => { $('#apercu-code').textContent = lireCode().code || '—'; $('#erreur-connexion').textContent = ''; });
  $('#form-connexion').addEventListener('submit', (e) => {
    e.preventDefault();
    const { g, i, code } = lireCode();
    if (!/^\d{1,4}$/.test(g)) { $('#erreur-connexion').textContent = 'Entre ton numéro de groupe (des chiffres seulement).'; $('#in-groupe').focus(); return; }
    if (!/^[A-Z]{2,4}\d?$/.test(i)) { $('#erreur-connexion').textContent = 'Entre 2 à 4 initiales (lettres), suivies au besoin d\'un chiffre.'; $('#in-initiales').focus(); return; }
    connecter(code);
  });
  $('#anciens-codes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.code) connecter(b.dataset.code);
    if (b.dataset.retirer) {
      VI.store.set('vi:codes', VI.store.get('vi:codes', []).filter((c) => c !== b.dataset.retirer));
      VI.store.del('vi:eleve:' + b.dataset.retirer);
      afficherConnexion();
    }
  });
  $('#btn-changer-eleve').addEventListener('click', () => { VI.store.del('vi:dernier'); afficherConnexion(); });

  /* ---------------- Accueil ---------------- */
  function afficherAccueil() {
    majEntete();
    const totalM = [1, 2, 3, 4].reduce((s, b) => s + maitrise(b).ok, 0);
    $('#titre-accueil').textContent = 'Salut ' + eleve.code + ' !';
    const sj = serieJours();
    $('#message-accueil').textContent = !profil.historique.length
      ? 'Commence par « Étudier » pour découvrir les familles de verbes, puis teste-toi.'
      : totalM === 0 ? 'Un verbe est « maîtrisé » après 3 bonnes réponses sans indice, à des moments différents. Continue !'
      : `Tu maîtrises ${totalM} verbe${totalM > 1 ? 's' : ''} sur ${VERBES.length}.` + (sj > 1 ? ` ${sj} jours de suite, continue !` : ' Un peu chaque jour, c\'est la clé.');

    // Blocs
    $('#grille-blocs').innerHTML = [1, 2, 3, 4].map((b) => {
      const m = maitrise(b);
      const pct = m.total ? Math.round((m.ok / m.total) * 100) : 0;
      return `<button class="bloc b${b}" role="radio" aria-checked="${choix.bloc === b}" data-bloc="${b}" ${m.total ? '' : 'disabled'}>
        <span class="bloc-nom">Bloc ${b}</span>
        <span class="bloc-info">${m.total} verbes</span>
        <span class="jauge"><span style="width:${pct}%"></span></span>
        <span class="bloc-info">${m.ok} maîtrisé${m.ok > 1 ? 's' : ''} · ${pct} %</span>
      </button>`;
    }).join('');

    // Modes
    const nbDiff = difficilesDuBloc(choix.bloc).length;
    $('#grille-modes').innerHTML = Object.entries(MODES).map(([id, m]) => {
      let extra = '';
      if (id === 'sprint' && profil.sprint[choix.bloc]) extra = `<span class="mode-extra">Record : ${profil.sprint[choix.bloc]}</span>`;
      if (id === 'difficiles') extra = `<span class="mode-extra">${nbDiff ? nbDiff + ' à revoir' : 'Rien à revoir 🎉'}</span>`;
      const off = id === 'difficiles' && !nbDiff;
      return `<button class="mode" data-mode="${id}" ${off ? 'disabled' : ''}>
        <span class="mode-icone" aria-hidden="true">${m.icone}</span>
        <span class="mode-titre">${m.titre}</span>
        <span class="mode-desc">${m.desc}</span>${extra}
      </button>`;
    }).join('');

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
    const pool = mode === 'difficiles' ? difficilesDuBloc(choix.bloc) : verbesDuBloc(choix.bloc);
    if (!pool.length) { VI.toast('Aucun verbe disponible pour ce bloc.'); return; }
    session = {
      id: VI.uid(), mode, bloc: choix.bloc, pool, debut: Date.now(), index: 0,
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
      session.fin = Date.now() + CONFIG.dureeSprintSecondes * 1000;
      session.minuterie = setInterval(tic, 200);
    }
    afficher('ecran-exercice');
    nouvelleQuestion();
    if (mode === 'sprint') tic();
  }

  function tic() {
    const reste = Math.max(0, session.fin - Date.now());
    $('#compteur').textContent = '⏱ ' + Math.ceil(reste / 1000) + ' s · ' + session.points + ' ✓';
    $('#progression-barre').style.width = (reste / (CONFIG.dureeSprintSecondes * 1000)) * 100 + '%';
    $('#progression-barre').classList.toggle('urgent', reste < 10000);
    if (reste <= 0) terminer();
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
    if (s.mode === 'sprint' && Date.now() >= s.fin) return terminer();
    if (s.index >= s.total) return terminer();
    nouvelleQuestion();
  }

  $('#btn-quitter').addEventListener('click', () => {
    if (!session) return afficherAccueil();
    if (session.resultats.length) terminer();
    else { arreterSession(); afficherAccueil(); }
  });

  function arreterSession() {
    if (!session) return;
    clearInterval(session.minuterie); clearTimeout(session.auto);
    session = null; q = null;
  }

  /* ---------------- Fin d'activité ---------------- */
  function terminer() {
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
    if (!profil.jours.includes(VI.aujourdhui())) profil.jours.push(VI.aujourdhui());
    profil.jours = profil.jours.slice(-60);
    let record = false;
    if (s.mode === 'sprint' && s.points > (profil.sprint[s.bloc] || 0)) { profil.sprint[s.bloc] = s.points; record = s.points > 0; }
    profil.historique.push({ d: Date.now(), bloc: s.bloc, mode: s.mode, pct });
    profil.historique = profil.historique.slice(-50);

    // Badges
    const nouveaux = [];
    const gagner = (id) => { if (!profil.badges.includes(id)) { profil.badges.push(id); nouveaux.push(BADGES.find((b) => b.id === id)); } };
    gagner('premier');
    if (s.serieMax >= 10) gagner('serie10');
    if (s.mode === 'sprint' && s.points >= 15) gagner('eclair');
    if (s.mode === 'quiz' && pct === 100 && !s.resultats.some((r) => r.indice)) gagner('parfait');
    if (serieJours() >= 3) gagner('constance');
    [1, 2, 3, 4].forEach((b) => { const m = maitrise(b); if (m.total && m.ok === m.total) gagner('maitre' + b); });
    sauverProfil();

    // Envoi à la feuille Google (avec file d'attente hors-ligne)
    envoyer({
      id: s.id, code: eleve.code, groupe: eleve.groupe, bloc: s.bloc, mode: s.mode,
      score: s.points, max: s.max, pct, duree, questions: s.resultats.length,
      reussis: reussis.join(','), rates: rates.join(',')
    });

    // Affichage
    const mApres = maitrise(s.bloc).ok;
    const gain = mApres - s.maitriseAvant;
    $('#anneau').style.setProperty('--pct', pct);
    $('#res-pct').textContent = s.mode === 'sprint' ? s.points : pct + ' %';
    $('#anneau').classList.toggle('sprint', s.mode === 'sprint');
    $('#res-titre').textContent = s.mode === 'sprint'
      ? (record ? 'Nouveau record ! 🏆' : s.points + ' verbe' + (s.points > 1 ? 's' : '') + ' en ' + CONFIG.dureeSprintSecondes + ' s')
      : pct >= 90 ? 'Excellent travail ! 🌟' : pct >= 75 ? 'Très bien ! 👏' : pct >= 50 ? 'Beau progrès ! 💪' : 'Chaque essai te fait progresser 🌱';
    $('#res-message').textContent = (gain > 0 ? `+${gain} verbe${gain > 1 ? 's' : ''} maîtrisé${gain > 1 ? 's' : ''} ! ` : '') +
      `Bloc ${s.bloc} : ${mApres} / ${verbesDuBloc(s.bloc).length} verbes maîtrisés.` +
      (rates.length ? ' Les verbes ratés reviendront plus souvent, c\'est voulu.' : '');
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
    nouveaux.forEach((b, i) => setTimeout(() => VI.toast(`<span class="toast-icone">${b.icone}</span> Nouveau badge : <b>${esc(b.nom)}</b>`, 'badge'), 400 + i * 900));
  }

  $('#btn-res-accueil').addEventListener('click', afficherAccueil);
  $('#res-revoir').addEventListener('click', (e) => { const a = e.target.closest('[data-dire]'); if (a) VI.parler(a.dataset.dire); });

  /* ---------------- Envoi et file d'attente hors-ligne ---------------- */
  let envoiEnCours = false;
  function envoyer(donnees) {
    if (!VI.urlConfiguree()) { majSync(); return; }
    const file = VI.store.get('vi:file', []);
    file.push(donnees);
    VI.store.set('vi:file', file.slice(-300));
    viderFile();
  }
  async function viderFile() {
    if (!VI.urlConfiguree() || envoiEnCours) { majSync(); return; }
    let file = VI.store.get('vi:file', []);
    if (!file.length) { majSync(); return; }
    if (!navigator.onLine) { majSync(); return; }
    envoiEnCours = true; majSync(true);
    try {
      while (file.length) {
        try {
          await VI.api('submit', { data: file[0] });
          file.shift();
        } catch (e) {
          if (!e.serveur) throw e;                 // réseau : on réessaiera plus tard
          file[0]._essais = (file[0]._essais || 0) + 1;
          if (file[0]._essais >= 5) file.shift();  // refusé 5 fois : on abandonne cet envoi
          else throw e;
        } finally { VI.store.set('vi:file', file); }
      }
    } catch (e) { /* on réessaiera */ }
    finally { envoiEnCours = false; majSync(); }
  }
  function majSync(enCours) {
    const el = $('#sync');
    if (!VI.urlConfiguree()) { el.textContent = '📴 Local'; el.title = 'Mode local : la progression reste sur cet appareil (aucune URL de script configurée).'; return; }
    const n = VI.store.get('vi:file', []).length;
    if (enCours) { el.textContent = '⏳ Envoi…'; el.title = 'Envoi des résultats en cours'; }
    else if (n) { el.textContent = '⏳ ' + n + ' en attente'; el.title = 'Hors-ligne : les résultats seront envoyés automatiquement au retour du réseau.'; }
    else { el.textContent = '☁️ À jour'; el.title = 'Tous les résultats sont envoyés.'; }
  }
  window.addEventListener('online', viderFile);
  setInterval(viderFile, 60000);

  /* ---------------- Démarrage ---------------- */
  VI.initApparence($('#btn-theme'), $('#btn-lecture'));
  const dernier = VI.store.get('vi:dernier', null);
  if (dernier) connecter(dernier); else afficherConnexion();
  majSync();
  viderFile();
  VI.rafraichirVerbes().then((change) => {
    if (!change) return;
    VERBES = VI.verbesLocaux();
    if (!session && eleve && !$('#ecran-accueil').hidden) afficherAccueil();
  });
})();
