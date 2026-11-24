/* ============================================================
   Espace enseignant (administrateur + enseignants)
   ============================================================ */
'use strict';
(function () {
  const { $, $$ } = VI;
  const esc = VI.echapper;
  let auth = null;             // { token, session: { id, role, nom } }
  let lignes = [];             // résultats visibles (déjà filtrés par le serveur selon le rôle)
  let infoGroupes = { groupes: [], orphelins: [], enseignants: [] };
  let tri = { cle: 'code', sens: 1 };
  const NOMS_MODES = { quiz: 'Quiz', entrainement: 'Entraînement', sprint: 'Sprint', difficiles: 'Difficiles', phrases: 'Phrases', erreurs: 'Chasse aux erreurs', vraifaux: 'Vrai ou faux' };
  const nomEcole = (id) => ((infoGroupes.ecoles || []).find((e) => e.id === id) || {}).nom || id;
  const libGroupe = (g) => { const i = String(g).lastIndexOf('-'); return i > 0 ? nomEcole(g.slice(0, i)) + ' · ' + g.slice(i + 1) : g; };
  const estAdmin = () => auth && auth.session.role === 'admin';

  const lireAuth = () => { try { return JSON.parse(sessionStorage.getItem('vi:auth')); } catch (e) { return null; } };
  const ecrireAuth = (v) => { try { v ? sessionStorage.setItem('vi:auth', JSON.stringify(v)) : sessionStorage.removeItem('vi:auth'); } catch (e) {} };

  VI.initApparence($('#btn-theme'), $('#btn-lecture'));

  function montrer(id) {
    ['#non-configure', '#ecran-nip', '#ecran-tdb'].forEach((s) => { $(s).hidden = s !== id; });
    const connecte = id === '#ecran-tdb';
    $('#btn-deconnexion').hidden = !connecte;
    $('#qui').hidden = !connecte;
  }

  /* ---------------- Connexion ---------------- */
  $('#form-nip').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#in-id').value.trim().toLowerCase();
    const nip = $('#in-nip').value.trim();
    if (!id) { $('#erreur-nip').textContent = 'Entre ton identifiant.'; $('#in-id').focus(); return; }
    if (!/^\d{4,12}$/.test(nip)) { $('#erreur-nip').textContent = 'Le NIP contient seulement des chiffres.'; $('#in-nip').focus(); return; }
    $('#btn-nip').disabled = true; $('#btn-nip').textContent = 'Vérification…'; $('#erreur-nip').textContent = '';
    try {
      const rep = await VI.api('login', { identifiant: id, pin: nip });
      auth = { token: rep.token, session: rep.session };
      ecrireAuth(auth);
      $('#in-nip').value = '';
      await ouvrirTableau();
      if (rep.nipFaible) VI.toast('🔐 Ton NIP est trop court pour les nouvelles règles de sécurité. Change-le dans « ⚙️ Mon compte » (' + (estAdmin() ? '8 à 12' : '6 à 10') + ' chiffres).', 'erreur');
    } catch (err) {
      $('#erreur-nip').textContent = err.serveur ? err.message : 'Impossible de joindre la feuille Google. Vérifie ta connexion ou l\'URL du script.';
      $('#in-nip').select();
    } finally { $('#btn-nip').disabled = false; $('#btn-nip').textContent = 'Entrer'; }
  });

  function deconnecter(message) {
    if (auth) VI.api('logout', { token: auth.token }).catch(() => {});
    auth = null; ecrireAuth(null); lignes = [];
    montrer('#ecran-nip');
    $('#erreur-nip').textContent = message || '';
    $('#in-id').focus();
  }
  $('#btn-deconnexion').addEventListener('click', () => deconnecter());

  async function appel(action, donnees = {}) {
    try { return await VI.api(action, Object.assign({ token: auth && auth.token }, donnees), 30000); }
    catch (err) {
      if (err.serveur && /Session expirée/i.test(err.message)) { auth = null; ecrireAuth(null); deconnecter(err.message); }
      throw err;
    }
  }

  /* ---------------- Chargement ---------------- */
  async function ouvrirTableau() {
    const admin = estAdmin();
    $('#qui').textContent = (admin ? '🛡️ ' : '🧑‍🏫 ') + auth.session.nom;
    $('#titre-tdb').textContent = admin ? 'Tableau de bord · Administration' : 'Tableau de bord';
    $('#onglet-groupes').textContent = admin ? '🏫 Groupes' : '🏫 Mes groupes';
    $$('[data-admin]').forEach((el) => { el.hidden = !admin; });
    // revenir au premier onglet
    $$('.onglets button').forEach((x, i) => x.setAttribute('aria-selected', String(i === 0)));
    $$('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== 'eleves'; });
    $('#filtres').hidden = false;
    montrer('#ecran-tdb');
    const taches = [chargerResultats(), chargerGroupes()];
    if (admin) taches.push(chargerVerbes(), chargerEnseignants(), chargerEtatPhrases());
    await Promise.all(taches);
  }
  async function chargerResultats() {
    $('#btn-actualiser').disabled = true; $('#btn-actualiser').textContent = '↻ Chargement…';
    try {
      const rep = await appel('getResults');
      lignes = (rep.lignes || []).map((l) => Object.assign(l, {
        t: new Date(l.date).getTime(), bloc: Number(l.bloc), pct: Number(l.pct), score: Number(l.score),
        duree: Number(l.duree) || 0, groupe: String(l.groupe),
        reussis: String(l.reussis || '').split(',').filter(Boolean), rates: String(l.rates || '').split(',').filter(Boolean)
      }));
      remplirGroupes();
      rendre();
    } catch (err) { if (auth) VI.toast('Erreur : ' + esc(err.message), 'erreur'); }
    finally { $('#btn-actualiser').disabled = false; $('#btn-actualiser').textContent = '↻ Actualiser'; }
  }
  $('#btn-actualiser').addEventListener('click', () => { chargerResultats(); chargerGroupes(); if (estAdmin()) chargerEnseignants(); });

  function groupesConnus() {
    const ens = new Set(lignes.map((l) => l.groupe));
    infoGroupes.groupes.forEach((g) => ens.add(g.groupe));
    return [...ens].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  }
  function remplirGroupes() {
    const ecoleActuelle = $('#f-ecole').value;
    const ecoles = [...new Set(groupesConnus().map((g) => g.slice(0, g.lastIndexOf('-'))))].filter(Boolean);
    $('#f-ecole').innerHTML = '<option value="">Toutes les écoles</option>' +
      ecoles.map((e) => `<option value="${esc(e)}" ${e === ecoleActuelle ? 'selected' : ''}>${esc(nomEcole(e))}</option>`).join('');
    const g = groupesConnus().filter((x) => !$('#f-ecole').value || x.indexOf($('#f-ecole').value + '-') === 0);
    const actuel = $('#f-groupe').value;
    $('#f-groupe').innerHTML = '<option value="">' + (estAdmin() ? 'Tous les groupes' : 'Tous mes groupes') + '</option>' +
      g.map((x) => `<option value="${esc(x)}" ${x === actuel ? 'selected' : ''}>${esc(libGroupe(x))}</option>`).join('');
  }
  $('#f-ecole').addEventListener('change', () => { $('#f-groupe').value = ''; remplirGroupes(); rendre(); });

  /* ---------------- Filtres ---------------- */
  function filtrer(ignorerGroupe = false) {
    const ec = $('#f-ecole').value, g = $('#f-groupe').value, b = $('#f-bloc').value, m = $('#f-mode').value, p = Number($('#f-periode').value);
    const depuis = p ? Date.now() - p * 86400000 : 0;
    return lignes.filter((l) => (ignorerGroupe || !ec || l.groupe.indexOf(ec + '-') === 0) && (ignorerGroupe || !g || l.groupe === g) && (!b || l.bloc === Number(b)) && (!m || l.mode === m) && l.t >= depuis);
  }
  $$('#filtres select').forEach((s) => s.addEventListener('change', rendre));

  /* ---------------- Onglets ---------------- */
  $('.onglets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-onglet]'); if (!b) return;
    $$('.onglets button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== b.dataset.onglet; });
    $('#filtres').hidden = ['liste', 'groupes', 'enseignants', 'ecoles'].includes(b.dataset.onglet); // ils servent aussi à l'export CSV
  });

  /* ---------------- Rendu ---------------- */
  const classeNote = (p) => (p >= 80 ? 'haute' : p >= 60 ? 'moy' : 'basse');
  const duree = (s) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + ' h ' + m + ' min' : m + ' min'; };
  const dateCourte = (t) => new Date(t).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) + ' ' + new Date(t).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  function rendre() { rendreEleves(); rendreDifficiles(); }

  function rendreEleves() {
    const f = filtrer();
    const notes = f.filter((l) => l.mode !== 'sprint');
    const moy = notes.length ? Math.round(notes.reduce((s, l) => s + l.pct, 0) / notes.length) : null;
    $('#kpis').innerHTML = [
      ['Élèves actifs', new Set(f.map((l) => l.code)).size],
      ['Activités', f.length],
      ['Moyenne', moy == null ? '—' : moy + ' %'],
      ['Temps de pratique', duree(f.reduce((s, l) => s + l.duree, 0))]
    ].map(([k, v]) => `<div class="kpi"><small>${k}</small><b>${v}</b></div>`).join('');

    const parEleve = {};
    f.forEach((l) => {
      const e = parEleve[l.code] || (parEleve[l.code] = { code: l.code, groupe: l.groupe, n: 0, somme: 0, nNotes: 0, sprint: 0, temps: 0, dernier: 0, rates: {} });
      e.n++; e.temps += l.duree; e.dernier = Math.max(e.dernier, l.t);
      if (l.mode === 'sprint') e.sprint = Math.max(e.sprint, l.score); else { e.somme += l.pct; e.nNotes++; }
      l.rates.forEach((v) => { e.rates[v] = (e.rates[v] || 0) + 1; });
    });
    const eleves = Object.values(parEleve).map((e) => Object.assign(e, {
      moy: e.nNotes ? Math.round(e.somme / e.nNotes) : -1,
      revoir: Object.entries(e.rates).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v]) => v).join(', ')
    }));
    const k = tri.cle;
    eleves.sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k], 'fr', { numeric: true }) : a[k] - b[k]) * tri.sens);

    const cols = [['code', 'Élève'], ['groupe', 'Groupe'], ['n', 'Activités'], ['moy', 'Moyenne'], ['sprint', 'Meilleur sprint'], ['temps', 'Temps'], ['dernier', 'Dernière activité'], ['revoir', 'Verbes à revoir']];
    $('#table-eleves').innerHTML = `<thead><tr>${cols.map(([c, n]) => `<th data-tri="${c}" ${tri.cle === c ? `aria-sort="${tri.sens > 0 ? 'ascending' : 'descending'}"` : ''}>${n}</th>`).join('')}</tr></thead>
      <tbody>${eleves.length ? eleves.map((e) => `<tr class="cliquable" tabindex="0" data-code="${esc(e.code)}" title="Voir toutes les tentatives de ${esc(e.code)}">
        <td class="mono">${esc(e.code)}</td><td>${esc(libGroupe(e.groupe))}</td><td>${e.n}</td>
        <td>${e.moy < 0 ? '—' : `<span class="note ${classeNote(e.moy)}">${e.moy} %</span>`}</td>
        <td>${e.sprint || '—'}</td><td>${duree(e.temps)}</td><td>${dateCourte(e.dernier)}</td>
        <td class="wrap mono" lang="en">${esc(e.revoir) || '<span class="muted">—</span>'}</td></tr>`).join('')
        : `<tr><td colspan="8" class="vide">Aucun résultat pour ces filtres.</td></tr>`}</tbody>`;
  }
  $('#table-eleves').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-code]'); if (tr) { ouvrirDetail(tr.dataset.code); return; }
    const th = e.target.closest('[data-tri]'); if (!th) return;
    tri = { cle: th.dataset.tri, sens: tri.cle === th.dataset.tri ? -tri.sens : (['n', 'moy', 'sprint', 'temps', 'dernier'].includes(th.dataset.tri) ? -1 : 1) };
    rendreEleves();
  });

  $('#table-eleves').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-code]');
    if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrirDetail(tr.dataset.code); }
  });

  /* ---------------- Fiche détaillée d'un élève ---------------- */
  function ouvrirDetail(code) {
    const toutes = lignes.filter((l) => l.code === code);
    const tentatives = filtrer().filter((l) => l.code === code).sort((a, b) => b.t - a.t);
    const notes = tentatives.filter((l) => l.mode !== 'sprint');
    const sprints = tentatives.filter((l) => l.mode === 'sprint');
    const moy = notes.length ? Math.round(notes.reduce((s, l) => s + l.pct, 0) / notes.length) : null;
    const filtresActifs = toutes.length !== tentatives.length;

    $('#detail-titre').textContent = 'Élève ' + code;
    $('#detail-sous-titre').textContent = (toutes[0] ? libGroupe(toutes[0].groupe) : libGroupe(code.slice(0, code.lastIndexOf('-')))) + ' · ' + tentatives.length + ' tentative' + (tentatives.length > 1 ? 's' : '') +
      (filtresActifs ? ' (selon les filtres ; ' + toutes.length + ' au total)' : '');

    // Verbes ratés le plus souvent
    const compte = {};
    tentatives.forEach((l) => l.rates.forEach((v) => { compte[v] = (compte[v] || 0) + 1; }));
    const rates = Object.entries(compte).sort((a, b) => b[1] - a[1]).slice(0, 12);

    // Progression par bloc (moyenne des 3 dernières tentatives notées)
    const parBloc = [1, 2, 3, 4].map((b) => {
      const n = notes.filter((l) => l.bloc === b);
      const recentes = n.slice(0, 3);
      return { b, n: n.length, moy: recentes.length ? Math.round(recentes.reduce((s, l) => s + l.pct, 0) / recentes.length) : null };
    });

    $('#detail-contenu').innerHTML = !tentatives.length ? '<p class="vide">Aucune tentative pour ces filtres.</p>' : `
      <div class="kpis">
        <div class="kpi"><small>Moyenne (hors sprint)</small><b>${moy == null ? '—' : moy + ' %'}</b></div>
        <div class="kpi"><small>Meilleur sprint</small><b>${sprints.length ? Math.max(...sprints.map((l) => l.score)) : '—'}</b></div>
        <div class="kpi"><small>Temps de pratique</small><b>${duree(tentatives.reduce((s, l) => s + l.duree, 0))}</b></div>
        <div class="kpi"><small>Jours de pratique</small><b>${new Set(tentatives.map((l) => new Date(l.t).toDateString())).size}</b></div>
      </div>
      <h3>Progression</h3>
      ${graphique(notes.slice().reverse())}
      <div class="detail-blocs">${parBloc.map((x) => `<div class="kpi"><small>Bloc ${x.b} · ${x.n} tentative${x.n > 1 ? 's' : ''}</small>
        <b>${x.moy == null ? '—' : `<span class="note ${classeNote(x.moy)}">${x.moy} %</span>`}</b></div>`).join('')}</div>
      <p class="aide">Par bloc : moyenne des 3 dernières tentatives notées, pour refléter le niveau actuel.</p>
      <h3>Verbes ratés le plus souvent</h3>
      <div class="puces-verbes" lang="en">${rates.length ? rates.map(([v, n]) => `<span class="puce-verbe">${esc(v)} <b>×${n}</b></span>`).join('') : '<span class="muted">Aucun 🎉</span>'}</div>
      <h3>Toutes les tentatives</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Bloc</th><th>Activité</th><th>Résultat</th><th>Questions</th><th>Durée</th><th>Verbes ratés</th></tr></thead>
        <tbody>${tentatives.map((l) => `<tr>
          <td>${dateCourte(l.t)}</td><td>${l.bloc}</td><td>${esc(NOMS_MODES[l.mode] || l.mode)}</td>
          <td>${l.mode === 'sprint' ? '⚡ ' + l.score + ' verbes' : `<span class="note ${classeNote(l.pct)}">${l.pct} %</span>`}</td>
          <td>${esc(l.questions)}</td><td>${l.duree < 60 ? l.duree + ' s' : Math.round(l.duree / 60) + ' min'}</td>
          <td class="wrap mono" lang="en">${l.rates.length ? esc(l.rates.join(', ')) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody>
      </table></div>`;
    $('#detail-contenu').insertAdjacentHTML('afterbegin', '<div id="detail-compte" class="carte detail-compte"><p class="muted">Chargement du compte…</p></div>');
    const d = $('#detail-eleve');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    d.scrollTop = 0;
    chargerCompteEleve(code);
  }

  async function chargerCompteEleve(code) {
    const zone = $('#detail-compte');
    try {
      const info = await appel('studentInfo', { code });
      if (!zone.isConnected) return;
      const verbes = VI.verbesLocaux();
      const boites = (info.progression && info.progression.boites) || {};
      const blocs = [1, 2, 3, 4].map((b) => {
        const l = verbes.filter((v) => v.bloc === b);
        const e = { total: l.length, ok: 0, voie: 0, revoir: 0 };
        l.forEach((v) => { const st = boites[VI.cle(v)]; const n = st ? st.b : 0; if (n >= 4) e.ok++; else if (n >= 2) e.voie++; else if (st && st.vu > 0) e.revoir++; });
        return e;
      });
      const w = (n, t) => (t ? (n / t) * 100 : 0).toFixed(1) + '%';
      zone.innerHTML = `<div class="compte-tete">
          <div><b>Compte élève</b> · ${info.nipDefini ? '🔒 NIP défini' : (info.existe ? '🔓 NIP réinitialisé : l\'élève en choisira un nouveau' : 'Aucun compte (première connexion à venir)')}
          ${info.maj ? `<br><span class="muted petit">Progression sauvegardée le ${new Date(info.maj).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}</span>` : ''}</div>
          ${info.nipDefini ? `<button class="btn btn-fantome btn-petit btn-texte-danger" id="btn-reset-nip" data-code="${esc(code)}">Réinitialiser le NIP</button>` : ''}
        </div>
        ${info.progression ? `<div class="detail-maitrise">${blocs.map((e, i) => `<div><small>Bloc ${i + 1}</small>
          <span class="jauge jauge-etat"><span class="seg-ok" style="width:${w(e.ok, e.total)}"></span><span class="seg-voie" style="width:${w(e.voie, e.total)}"></span><span class="seg-revoir" style="width:${w(e.revoir, e.total)}"></span></span>
          <small><b>${e.ok}</b> maîtrisés · ${e.voie} en bonne voie · ${e.revoir} à revoir</small></div>`).join('')}</div>` : ''}`;
      const btn = $('#btn-reset-nip');
      if (btn) btn.addEventListener('click', async () => {
        if (!btn.dataset.arme) { btn.dataset.arme = '1'; btn.textContent = 'Confirmer la réinitialisation ?'; btn.classList.add('arme'); setTimeout(() => { if (btn.isConnected && btn.dataset.arme) { delete btn.dataset.arme; btn.textContent = 'Réinitialiser le NIP'; btn.classList.remove('arme'); } }, 4000); return; }
        btn.disabled = true;
        try { await appel('resetStudentPin', { code }); VI.toast('🔓 NIP réinitialisé. L\'élève en choisira un nouveau à sa prochaine connexion (sa progression est conservée).', 'succes'); chargerCompteEleve(code); }
        catch (err) { VI.toast(esc(err.message), 'erreur'); btn.disabled = false; }
      });
    } catch (err) { if (zone.isConnected) zone.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  }

  function graphique(points) {
    if (points.length < 2) return '<p class="muted petit">Le graphique apparaîtra après au moins 2 quiz ou entraînements.</p>';
    const pts = points.slice(-30), L = 640, H = 170, g = 34, d = 12;
    const x = (i) => g + (i * (L - g - d)) / (pts.length - 1);
    const y = (p) => d + ((100 - p) * (H - 2 * d)) / 100;
    const ligne = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
    return `<svg class="graphique" viewBox="0 0 ${L} ${H}" role="img" aria-label="Évolution des résultats en pourcentage">
      ${[0, 50, 80, 100].map((v) => `<line x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}" class="${v === 80 ? 'seuil' : 'grille'}"/><text x="${g - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      <polyline points="${ligne}" class="trace"/>
      ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="4.5" class="point ${classeNote(p.pct)}"><title>${dateCourte(p.t)} · Bloc ${p.bloc} · ${NOMS_MODES[p.mode] || p.mode} : ${p.pct} %</title></circle>`).join('')}
    </svg><p class="aide">Chaque point est une tentative (les 30 plus récentes). Ligne pointillée : seuil de 80 %.</p>`;
  }
  $('#detail-fermer').addEventListener('click', () => { const d = $('#detail-eleve'); d.close ? d.close() : d.removeAttribute('open'); });
  $('#detail-eleve').addEventListener('click', (e) => { if (e.target.id === 'detail-eleve') $('#detail-fermer').click(); }); // clic hors de la fiche

  function statsVerbes(liste) {
    const s = {};
    liste.forEach((l) => {
      const add = (v, err) => { const k = l.bloc + '|' + v; const o = s[k] || (s[k] = { verbe: v, bloc: l.bloc, essais: 0, erreurs: 0 }); o.essais++; if (err) o.erreurs++; };
      l.reussis.forEach((v) => add(v, false));
      l.rates.forEach((v) => add(v, true));
    });
    return Object.values(s).map((o) => Object.assign(o, { taux: o.essais ? o.erreurs / o.essais : 0 }));
  }

  function rendreDifficiles() {
    const st = statsVerbes(filtrer()).filter((o) => o.erreurs > 0).sort((a, b) => b.taux - a.taux || b.erreurs - a.erreurs).slice(0, 40);
    const verbes = VI.verbesLocaux();
    const formes = (o) => { const v = verbes.find((x) => x.bloc === o.bloc && VI.norm(VI.premiere(x.base)) === VI.norm(o.verbe)); return v ? [v.base, v.passe, v.participe].map(VI.premiere).join(' → ') : o.verbe; };
    $('#table-diff').innerHTML = `<thead><tr><th>Verbe</th><th>Bloc</th><th>Essais</th><th>Erreurs</th><th>Taux d'erreur</th></tr></thead><tbody>${
      st.length ? st.map((o) => `<tr><td class="mono" lang="en">${esc(formes(o))}</td><td>${o.bloc}</td><td>${o.essais}</td><td>${o.erreurs}</td>
        <td><span class="barre-h" style="width:${Math.round(o.taux * 120)}px"></span>${Math.round(o.taux * 100)} %</td></tr>`).join('')
      : '<tr><td colspan="5" class="vide">Aucune erreur pour ces filtres. 🎉</td></tr>'}</tbody>`;

    // Carte de chaleur (tous les groupes, mêmes autres filtres)
    const base = filtrer(true);
    const groupes = [...new Set(base.map((l) => l.groupe))].sort((a, b) => Number(a) - Number(b));
    const top = statsVerbes(base).filter((o) => o.erreurs > 0).sort((a, b) => b.taux - a.taux || b.erreurs - a.erreurs).slice(0, 15);
    if (!top.length || !groupes.length) { $('#table-chaleur').innerHTML = '<tbody><tr><td class="vide">Pas encore assez de données.</td></tr></tbody>'; return; }
    const parGroupe = {};
    groupes.forEach((g) => { parGroupe[g] = {}; statsVerbes(base.filter((l) => l.groupe === g)).forEach((o) => { parGroupe[g][o.bloc + '|' + o.verbe] = o; }); });
    $('#table-chaleur').innerHTML = `<thead><tr><th>Verbe</th>${groupes.map((g) => `<th style="text-align:center">${esc(libGroupe(g))}</th>`).join('')}</tr></thead><tbody>${
      top.map((o) => `<tr><td class="mono" lang="en">${esc(o.verbe)} <small class="muted">B${o.bloc}</small></td>${groupes.map((g) => {
        const c = parGroupe[g][o.bloc + '|' + o.verbe];
        if (!c) return '<td class="c muted">·</td>';
        const t = c.taux;
        return `<td class="c" style="background:rgba(224,70,76,${(0.08 + t * 0.75).toFixed(2)});color:${t > 0.55 ? '#fff' : 'inherit'}" title="${c.erreurs} erreur(s) sur ${c.essais}">${Math.round(t * 100)} %</td>`;
      }).join('')}</tr>`).join('')}</tbody>`;
  }

  /* ---------------- Éditeur des listes de verbes ---------------- */
  function rendreEditeurs(liste) {
    $('#editeurs').innerHTML = [1, 2, 3, 4].map((b) => {
      const txt = liste.filter((v) => v.bloc === b).map((v) => [v.base, v.passe, v.participe, v.fr].join(' ; ')).join('\n');
      return `<div class="carte"><h3>Bloc ${b} <span class="compte" id="compte-${b}"></span></h3>
        <textarea id="ed-${b}" spellcheck="false" aria-label="Verbes du bloc ${b}">${esc(txt)}</textarea></div>`;
    }).join('');
    [1, 2, 3, 4].forEach((b) => { $('#ed-' + b).addEventListener('input', () => compter(b)); compter(b); });
  }
  function analyser(b) {
    const erreurs = [], verbes = [];
    $('#ed-' + b).value.split('\n').forEach((ligne, i) => {
      const t = ligne.trim(); if (!t || t.startsWith('#')) return;
      const p = t.split(/\t|;/).map((x) => x.trim());
      if (p.length !== 4 || p.some((x) => !x)) erreurs.push(`Bloc ${b}, ligne ${i + 1} : il faut 4 parties séparées par « ; »`);
      else verbes.push({ bloc: b, base: p[0], passe: p[1], participe: p[2], fr: p[3] });
    });
    return { erreurs, verbes };
  }
  function compter(b) { const r = analyser(b); $('#compte-' + b).textContent = r.verbes.length + ' verbes' + (r.erreurs.length ? ' · ⚠️ ' + r.erreurs.length : ''); }

  async function chargerVerbes() {
    try {
      const rep = await appel('getVerbs');
      const liste = VI.nettoyerVerbes(rep.verbes);
      rendreEditeurs(liste.length ? liste : VI.verbesDefaut());
      if (!liste.length) $('#erreur-verbes').textContent = 'La feuille ne contient pas encore de verbes : la liste par défaut est affichée. Clique sur « Enregistrer » pour la copier dans la feuille.';
    } catch (e) { rendreEditeurs(VI.verbesLocaux()); }
  }
  $('#btn-verbes-defaut').addEventListener('click', () => { rendreEditeurs(VI.verbesDefaut()); $('#erreur-verbes').textContent = 'Liste par défaut chargée (pas encore enregistrée).'; });
  $('#btn-verbes-sauver').addEventListener('click', async () => {
    const res = [1, 2, 3, 4].map(analyser);
    const erreurs = res.flatMap((r) => r.erreurs);
    if (erreurs.length) { $('#erreur-verbes').textContent = erreurs.slice(0, 5).join(' · '); return; }
    const verbes = res.flatMap((r) => r.verbes);
    if (!verbes.length) { $('#erreur-verbes').textContent = 'Aucun verbe à enregistrer.'; return; }
    const btn = $('#btn-verbes-sauver'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      await appel('saveVerbs', { verbes });
      VI.store.set('vi:verbes', verbes);
      $('#erreur-verbes').textContent = '';
      VI.toast('✅ ' + verbes.length + ' verbes enregistrés.', 'succes');
    } catch (e) { $('#erreur-verbes').textContent = 'Erreur : ' + e.message; }
    finally { btn.disabled = false; btn.textContent = '💾 Enregistrer les listes'; }
  });

  /* ---------------- Groupes ---------------- */
  async function chargerGroupes() {
    try {
      const rep = await appel('listGroups');
      infoGroupes = { groupes: rep.groupes || [], orphelins: rep.orphelins || [], enseignants: rep.enseignants || [], ecoles: rep.ecoles || [] };
      remplirGroupes();
      rendreGroupes();
      if (estAdmin()) rendreEcoles();
      rendre();
    } catch (err) { if (auth) VI.toast('Erreur : ' + esc(err.message), 'erreur'); }
  }

  const optionsProprio = (choisi) => [{ identifiant: 'admin', nom: 'Administrateur', actif: true }].concat(infoGroupes.enseignants)
    .map((e) => `<option value="${esc(e.identifiant)}" ${e.identifiant === choisi ? 'selected' : ''}>${esc(e.nom)}${e.actif ? '' : ' (inactif)'}</option>`).join('');

  function rendreGroupes() {
    const admin = estAdmin();
    if (admin) $('#nouveau-proprio').innerHTML = optionsProprio('admin');
    const ecolesActives = infoGroupes.ecoles.filter((e) => e.actif);
    const ecoleChoisie = $('#nouveau-ecole').value || VI.store.get('vi:ens-ecole', '');
    $('#nouveau-ecole').innerHTML = ecolesActives.length
      ? ecolesActives.map((e) => `<option value="${esc(e.id)}" ${e.id === ecoleChoisie ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')
      : '<option value="">Aucune école (l\'administrateur doit en créer une)</option>';
    const gs = infoGroupes.groupes.slice().sort((a, b) => a.groupe.localeCompare(b.groupe, 'fr', { numeric: true }));
    $('#table-groupes').innerHTML = `<thead><tr><th>École</th><th>Groupe</th>${admin ? '<th>Propriétaire</th>' : ''}<th>Résultats</th><th>Actions</th></tr></thead><tbody>${
      gs.length ? gs.map((g) => `<tr>
        <td>${esc(nomEcole(g.groupe.slice(0, g.groupe.lastIndexOf('-'))))}</td><td class="mono">${esc(g.groupe.slice(g.groupe.lastIndexOf('-') + 1))}</td>
        ${admin ? `<td><select class="sel-proprio" data-groupe="${esc(g.groupe)}" aria-label="Propriétaire du groupe ${esc(g.groupe)}">${optionsProprio(g.enseignant)}</select></td>` : ''}
        <td>${g.resultats}</td>
        <td><div class="actions" style="margin:0">
          <button class="btn btn-fantome btn-petit" data-confirmer data-action="vider" data-groupe="${esc(g.groupe)}" ${g.resultats ? '' : 'disabled'}>Effacer les résultats</button>
          <button class="btn btn-fantome btn-petit btn-texte-danger" data-confirmer data-action="supprimer" data-groupe="${esc(g.groupe)}">Supprimer le groupe</button>
        </div></td></tr>`).join('')
      : `<tr><td colspan="${admin ? 5 : 4}" class="vide">${admin ? 'Aucun groupe.' : 'Tu n\'as pas encore de groupe : crée-le ci-dessus pour que tes élèves puissent se connecter.'}</td></tr>`}</tbody>`;

    if (admin) {
      const o = infoGroupes.orphelins;
      $('#zone-orphelins').innerHTML = o.length ? `<div class="carte zone-danger" style="margin-top:1rem">
        <h2>⚠️ Résultats sans groupe enregistré</h2>
        <p class="muted petit">Des résultats ont été reçus pour ces numéros de groupe, qui n'appartiennent à personne (ex. groupe supprimé, ancien envoi hors-ligne). Attribue-les à un enseignant ou efface-les.</p>
        <div class="table-wrap"><table><thead><tr><th>Groupe</th><th>Résultats</th><th>Attribuer à</th><th></th></tr></thead><tbody>
        ${o.map((g) => `<tr><td class="mono">${esc(libGroupe(g.groupe))}</td><td>${g.resultats}</td>
          <td><select id="orph-${esc(g.groupe.replace(/[^A-Za-z0-9]/g, '_'))}">${optionsProprio('admin')}</select></td>
          <td><div class="actions" style="margin:0"><button class="btn btn-secondaire btn-petit" data-attribuer="${esc(g.groupe)}">Attribuer</button>
          <button class="btn btn-fantome btn-petit btn-texte-danger" data-confirmer data-action="vider" data-groupe="${esc(g.groupe)}">Effacer</button></div></td></tr>`).join('')}
        </tbody></table></div></div>` : '';
    }
  }

  $('#btn-creer-groupe').addEventListener('click', async () => {
    const g = $('#nouveau-groupe').value.trim(), ecole = $('#nouveau-ecole').value;
    if (!ecole) { VI.toast('Choisis une école.', 'erreur'); return; }
    if (!/^\d{1,4}$/.test(g)) { VI.toast('Le numéro de groupe contient de 1 à 4 chiffres.', 'erreur'); $('#nouveau-groupe').focus(); return; }
    const btn = $('#btn-creer-groupe'); btn.disabled = true;
    try {
      await appel('createGroup', { ecole, numero: g, proprietaire: estAdmin() ? $('#nouveau-proprio').value : undefined });
      VI.store.set('vi:ens-ecole', ecole);
      $('#nouveau-groupe').value = '';
      VI.toast('✅ Groupe ' + esc(g) + ' créé (' + esc(nomEcole(ecole)) + ').', 'succes');
      await chargerGroupes();
    } catch (err) { VI.toast(esc(err.message), 'erreur'); }
    finally { btn.disabled = false; }
  });
  $('#nouveau-groupe').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-creer-groupe').click(); });

  // Confirmation en deux clics (aucune fenêtre surgissante)
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-confirmer]'); if (!b || b.disabled) return;
    if (!b.dataset.arme) {
      b.dataset.arme = '1'; b.dataset.texte = b.textContent;
      b.textContent = b.dataset.action === 'supprimer' ? 'Confirmer la suppression ?' : 'Confirmer ?';
      b.classList.add('arme');
      setTimeout(() => { if (b.isConnected && b.dataset.arme) { delete b.dataset.arme; b.textContent = b.dataset.texte; b.classList.remove('arme'); } }, 4000);
      return;
    }
    delete b.dataset.arme; b.disabled = true; b.textContent = '…';
    const g = b.dataset.groupe;
    try {
      const rep = await appel('deleteGroup', { groupe: g, resultatsSeulement: b.dataset.action === 'vider' });
      VI.toast(b.dataset.action === 'vider' ? `🗑️ ${esc(libGroupe(g))} : ${rep.supprimees} résultat(s) effacé(s).` : `🗑️ ${esc(libGroupe(g))} supprimé (${rep.supprimees} résultat(s)).`, 'succes');
      await Promise.all([chargerGroupes(), chargerResultats()]);
    } catch (err) { VI.toast(esc(err.message), 'erreur'); b.disabled = false; b.textContent = b.dataset.texte; b.classList.remove('arme'); }
  });

  $('#table-groupes').addEventListener('change', async (e) => {
    const s = e.target.closest('.sel-proprio'); if (!s) return;
    try { await appel('reassignGroup', { groupe: s.dataset.groupe, proprietaire: s.value }); VI.toast('✅ Groupe ' + esc(s.dataset.groupe) + ' réattribué.', 'succes'); await chargerGroupes(); if (estAdmin()) chargerEnseignants(); }
    catch (err) { VI.toast(esc(err.message), 'erreur'); chargerGroupes(); }
  });
  $('#zone-orphelins').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-attribuer]'); if (!b) return;
    const g = b.dataset.attribuer;
    try { await appel('reassignGroup', { groupe: g, proprietaire: $('#orph-' + g.replace(/[^A-Za-z0-9]/g, '_')).value }); VI.toast('✅ Groupe ' + esc(g) + ' attribué.', 'succes'); await chargerGroupes(); chargerEnseignants(); }
    catch (err) { VI.toast(esc(err.message), 'erreur'); }
  });


  /* ---------------- Écoles (administrateur) ---------------- */
  function rendreEcoles() {
    const ec = infoGroupes.ecoles || [];
    $('#table-ecoles').innerHTML = `<thead><tr><th>Code</th><th>Nom (visible par les élèves)</th><th>Groupes</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${
      ec.length ? ec.map((e) => `<tr>
        <td class="mono">${esc(e.id)}</td>
        <td><div class="ligne-nip" style="margin:0"><input value="${esc(e.nom)}" data-nom-ecole="${esc(e.id)}" aria-label="Nom de l'école ${esc(e.id)}" maxlength="80" style="max-width:none">
          <button class="btn btn-secondaire btn-petit" data-ecole-renommer="${esc(e.id)}">Renommer</button></div></td>
        <td>${e.groupes}</td>
        <td><span class="note ${e.actif ? 'haute' : 'basse'}">${e.actif ? 'Active' : 'Inactive'}</span></td>
        <td><div class="actions" style="margin:0">
          <button class="btn btn-fantome btn-petit" data-ecole-actif="${esc(e.id)}" data-val="${e.actif ? '0' : '1'}" title="Une école inactive n'apparaît plus à la connexion des élèves">${e.actif ? 'Désactiver' : 'Réactiver'}</button>
          <button class="btn btn-fantome btn-petit btn-texte-danger" data-ecole-suppr="${esc(e.id)}" ${e.groupes ? 'disabled title="Supprime d\'abord ses groupes"' : ''}>Supprimer</button>
        </div></td></tr>`).join('')
      : '<tr><td colspan="5" class="vide">Aucune école. Ajoute la première ci-dessus : les enseignants pourront ensuite y créer leurs groupes.</td></tr>'}</tbody>`;
  }
  $('#ecole-nom').addEventListener('input', () => { // suggère un code : initiales des mots importants
    if ($('#ecole-id').dataset.touche) return;
    const mots = VI.norm($('#ecole-nom').value).replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter((m) => m.length > 2 && !['des', 'les', 'aux', 'une', 'ecole', 'secondaire', 'polyvalente', 'college'].includes(m));
    let code = mots.map((m) => m[0]).join('');
    if (code.length < 2) { const m = mots[0] || VI.norm($('#ecole-nom').value).replace(/[^a-z]/g, ''); code = m.slice(0, 3); }
    $('#ecole-id').value = code.toUpperCase().slice(0, 6);
  });
  $('#ecole-id').addEventListener('input', () => { $('#ecole-id').dataset.touche = '1'; });
  $('#btn-ajouter-ecole').addEventListener('click', async () => {
    const nom = $('#ecole-nom').value.trim(), id = $('#ecole-id').value.trim().toUpperCase();
    if (!nom) { VI.toast('Entre le nom de l\'école.', 'erreur'); return; }
    if (!/^[A-Z0-9]{2,6}$/.test(id)) { VI.toast('Code court : 2 à 6 lettres ou chiffres.', 'erreur'); return; }
    try {
      await appel('saveSchool', { nouveau: true, id, nom });
      $('#ecole-nom').value = ''; $('#ecole-id').value = ''; delete $('#ecole-id').dataset.touche;
      VI.toast(`✅ École ajoutée : ${esc(nom)} (${esc(id)})`, 'succes');
      await chargerGroupes();
    } catch (err) { VI.toast(esc(err.message), 'erreur'); }
  });
  $('#table-ecoles').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.ecoleRenommer) {
        const nom = $(`[data-nom-ecole="${b.dataset.ecoleRenommer}"]`).value.trim();
        await appel('saveSchool', { id: b.dataset.ecoleRenommer, nom }); VI.toast('✅ École renommée.', 'succes');
      } else if (b.dataset.ecoleActif) {
        await appel('saveSchool', { id: b.dataset.ecoleActif, actif: b.dataset.val === '1' }); VI.toast('✅ Statut modifié.', 'succes');
      } else if (b.dataset.ecoleSuppr) {
        if (!b.dataset.arme) { b.dataset.arme = '1'; b.textContent = 'Confirmer ?'; b.classList.add('arme'); setTimeout(() => { if (b.isConnected) { delete b.dataset.arme; b.textContent = 'Supprimer'; b.classList.remove('arme'); } }, 4000); return; }
        await appel('deleteSchool', { id: b.dataset.ecoleSuppr }); VI.toast('🗑️ École supprimée.', 'succes');
      } else return;
      await chargerGroupes();
    } catch (err) { VI.toast(esc(err.message), 'erreur'); }
  });

  /* ---------------- Phrases (administrateur) ---------------- */
  async function chargerEtatPhrases() {
    try {
      const n = VI.nettoyerPhrases((await appel('getPhrases')).phrases).length;
      $('#etat-phrases').innerHTML = n ? `La feuille contient <b>${n} phrases</b> : ce sont celles que les élèves utilisent.`
        : `La feuille ne contient pas encore de phrases : les élèves utilisent les <b>${VI.nettoyerPhrases(PHRASES_DEFAUT).length} phrases par défaut</b>. Copie-les dans la feuille pour pouvoir les relire et les modifier.`;
    } catch (e) { $('#etat-phrases').textContent = ''; }
  }
  $('#btn-phrases-defaut').addEventListener('click', async () => {
    const b = $('#btn-phrases-defaut');
    if (!b.dataset.arme) { b.dataset.arme = '1'; b.dataset.texte = b.textContent; b.textContent = 'Confirmer ? (remplace les phrases de la feuille)'; b.classList.add('arme'); setTimeout(() => { if (b.dataset.arme) { delete b.dataset.arme; b.textContent = b.dataset.texte; b.classList.remove('arme'); } }, 5000); return; }
    delete b.dataset.arme; b.textContent = b.dataset.texte; b.classList.remove('arme'); b.disabled = true;
    try { const r = await appel('savePhrases', { phrases: VI.nettoyerPhrases(PHRASES_DEFAUT) }); VI.toast(`✅ ${r.nombre} phrases copiées dans l'onglet « Phrases ».`, 'succes'); VI.store.del('vi:phrases'); chargerEtatPhrases(); }
    catch (err) { VI.toast(esc(err.message), 'erreur'); }
    finally { b.disabled = false; }
  });

  /* ---------------- Enseignants (administrateur) ---------------- */
  let enseignants = [];
  async function chargerEnseignants() {
    try { enseignants = (await appel('listTeachers')).enseignants || []; rendreEnseignants(); }
    catch (err) { if (auth) VI.toast('Erreur : ' + esc(err.message), 'erreur'); }
  }
  function rendreEnseignants() {
    $('#table-ens').innerHTML = `<thead><tr><th>Nom</th><th>Identifiant</th><th>Groupes</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${
      enseignants.length ? enseignants.map((x) => `<tr>
        <td>${esc(x.nom)}</td><td class="mono">${esc(x.identifiant)}</td>
        <td class="mono">${x.groupes.length ? esc(x.groupes.join(', ')) : '<span class="muted">—</span>'}</td>
        <td><span class="note ${x.actif ? 'haute' : 'basse'}">${x.actif ? 'Actif' : 'Inactif'}</span></td>
        <td><div class="actions" style="margin:0">
          <button class="btn btn-fantome btn-petit" data-ens-actif="${esc(x.identifiant)}" data-val="${x.actif ? '0' : '1'}">${x.actif ? 'Désactiver' : 'Réactiver'}</button>
          <button class="btn btn-fantome btn-petit" data-ens-nip="${esc(x.identifiant)}">Nouveau NIP</button>
          <button class="btn btn-fantome btn-petit btn-texte-danger" data-ens-suppr="${esc(x.identifiant)}" ${x.groupes.length ? 'disabled title="Réattribue ou supprime d\'abord ses groupes"' : ''}>Supprimer</button>
        </div>
        <div class="ligne-nip" id="nip-${esc(x.identifiant)}" hidden>
          <input inputmode="numeric" maxlength="10" placeholder="Nouveau NIP (6 à 10 chiffres)" aria-label="Nouveau NIP pour ${esc(x.nom)}">
          <button class="btn btn-secondaire btn-petit" data-ens-nip-ok="${esc(x.identifiant)}">Enregistrer</button>
        </div></td></tr>`).join('')
      : '<tr><td colspan="5" class="vide">Aucun enseignant pour l\'instant. Ajoute le premier ci-dessus.</td></tr>'}</tbody>`;
  }
  $('#btn-ajouter-ens').addEventListener('click', async () => {
    const nom = $('#ens-nom').value.trim(), id = $('#ens-id').value.trim().toLowerCase(), nip = $('#ens-nip').value.trim();
    if (!nom) { VI.toast('Entre le nom.', 'erreur'); return; }
    if (!/^[a-z0-9._-]{2,20}$/.test(id)) { VI.toast('Identifiant : 2 à 20 caractères (minuscules, chiffres, point, tiret).', 'erreur'); return; }
    if (!/^\d{6,10}$/.test(nip)) { VI.toast('Le NIP doit contenir de 6 à 10 chiffres.', 'erreur'); return; }
    const btn = $('#btn-ajouter-ens'); btn.disabled = true;
    try {
      await appel('saveTeacher', { nouveau: true, identifiant: id, nom, pin: nip });
      ['#ens-nom', '#ens-id', '#ens-nip'].forEach((s) => { $(s).value = ''; });
      delete $('#ens-id').dataset.touche;
      VI.toast(`✅ ${esc(nom)} ajouté·e. Identifiant : <b>${esc(id)}</b>`, 'succes');
      await Promise.all([chargerEnseignants(), chargerGroupes()]);
    } catch (err) { VI.toast(esc(err.message), 'erreur'); }
    finally { btn.disabled = false; }
  });
  $('#ens-nom').addEventListener('input', () => { // suggère un identifiant : initiale + nom de famille
    if ($('#ens-id').dataset.touche) return;
    const p = VI.norm($('#ens-nom').value).replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean);
    $('#ens-id').value = p.length > 1 ? (p[0][0] + p[p.length - 1]).slice(0, 20) : (p[0] || '');
  });
  $('#ens-id').addEventListener('input', () => { $('#ens-id').dataset.touche = '1'; });
  $('#table-ens').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.ensActif) {
        await appel('saveTeacher', { identifiant: b.dataset.ensActif, actif: b.dataset.val === '1' });
        VI.toast('✅ Statut modifié.', 'succes'); await chargerEnseignants(); chargerGroupes();
      } else if (b.dataset.ensNip) {
        const z = $('#nip-' + b.dataset.ensNip); z.hidden = !z.hidden; if (!z.hidden) z.querySelector('input').focus();
      } else if (b.dataset.ensNipOk) {
        const v = $('#nip-' + b.dataset.ensNipOk + ' input').value.trim();
        if (!/^\d{6,10}$/.test(v)) { VI.toast('Le NIP doit contenir de 6 à 10 chiffres.', 'erreur'); return; }
        await appel('saveTeacher', { identifiant: b.dataset.ensNipOk, pin: v });
        VI.toast('🔑 Nouveau NIP enregistré. Transmets-le à l\'enseignant.', 'succes'); rendreEnseignants();
      } else if (b.dataset.ensSuppr) {
        if (!b.dataset.arme) { b.dataset.arme = '1'; b.textContent = 'Confirmer ?'; b.classList.add('arme'); setTimeout(() => { if (b.isConnected) { delete b.dataset.arme; b.textContent = 'Supprimer'; b.classList.remove('arme'); } }, 4000); return; }
        await appel('deleteTeacher', { identifiant: b.dataset.ensSuppr });
        VI.toast('🗑️ Compte supprimé.', 'succes'); await chargerEnseignants(); chargerGroupes();
      }
    } catch (err) { VI.toast(esc(err.message), 'erreur'); }
  });

  /* ---------------- Mon compte ---------------- */
  $('#btn-csv').addEventListener('click', () => {
    const f = filtrer();
    if (!f.length) { VI.toast('Rien à exporter pour ces filtres.'); return; }
    const entetes = ['Date', 'Code', 'Groupe', 'Bloc', 'Activité', 'Score', 'Maximum', 'Pourcentage', 'Durée (s)', 'Questions', 'Réussis', 'Ratés'];
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [entetes.map(q).join(';')].concat(f.map((l) => [new Date(l.t).toLocaleString('fr-CA'), l.code, l.groupe, l.bloc, NOMS_MODES[l.mode] || l.mode, l.score, l.max, l.pct, l.duree, l.questions, l.reussis.join(', '), l.rates.join(', ')].map(q).join(';'))).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'resultats-verbes-' + VI.aujourdhui() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  });

  $('#btn-nip-changer').addEventListener('click', async () => {
    const n = $('#nip-nouveau').value.trim(), c = $('#nip-confirm').value.trim();
    const regle = estAdmin() ? /^\d{8,12}$/ : /^\d{6,10}$/;
    if (!regle.test(n)) { VI.toast('Le NIP doit contenir de ' + (estAdmin() ? '8 à 12' : '6 à 10') + ' chiffres.', 'erreur'); return; }
    if (n !== c) { VI.toast('Les deux NIP ne sont pas identiques.', 'erreur'); return; }
    try {
      await appel('changePin', { nouveau: n });
      $('#nip-nouveau').value = ''; $('#nip-confirm').value = '';
      VI.toast('🔑 NIP changé.', 'succes');
    } catch (e) { VI.toast('Erreur : ' + esc(e.message), 'erreur'); }
  });

  /* ---------------- Démarrage ---------------- */
  if (!VI.urlConfiguree()) { montrer('#non-configure'); return; }
  auth = lireAuth();
  if (auth && auth.token) ouvrirTableau().catch(() => {}); else { montrer('#ecran-nip'); $('#in-id').focus(); }
})();
