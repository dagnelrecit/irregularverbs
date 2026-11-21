/* ============================================================
   Espace enseignant
   ============================================================ */
'use strict';
(function () {
  const { $, $$ } = VI;
  const esc = VI.echapper;
  let nip = null;
  let lignes = [];             // résultats bruts de la feuille Google
  let tri = { cle: 'code', sens: 1 };
  const NOMS_MODES = { quiz: 'Quiz', entrainement: 'Entraînement', sprint: 'Sprint', difficiles: 'Difficiles' };

  const lireNip = () => { try { return sessionStorage.getItem('vi:nip'); } catch (e) { return null; } };
  const ecrireNip = (v) => { try { v ? sessionStorage.setItem('vi:nip', v) : sessionStorage.removeItem('vi:nip'); } catch (e) {} };

  VI.initApparence($('#btn-theme'), $('#btn-lecture'));

  function montrer(id) { ['#non-configure', '#ecran-nip', '#ecran-tdb'].forEach((s) => { $(s).hidden = s !== id; }); $('#btn-deconnexion').hidden = id !== '#ecran-tdb'; }

  /* ---------------- Connexion ---------------- */
  $('#form-nip').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = $('#in-nip').value.trim();
    if (!/^\d{4,8}$/.test(val)) { $('#erreur-nip').textContent = 'Le NIP contient de 4 à 8 chiffres.'; return; }
    $('#btn-nip').disabled = true; $('#btn-nip').textContent = 'Vérification…'; $('#erreur-nip').textContent = '';
    try {
      await VI.api('login', { pin: val });
      nip = val; ecrireNip(val);
      $('#in-nip').value = '';
      await ouvrirTableau();
    } catch (err) {
      $('#erreur-nip').textContent = err.serveur ? err.message : 'Impossible de joindre la feuille Google. Vérifie ta connexion ou l\'URL du script.';
      $('#in-nip').select();
    } finally { $('#btn-nip').disabled = false; $('#btn-nip').textContent = 'Entrer'; }
  });
  $('#btn-deconnexion').addEventListener('click', () => { nip = null; ecrireNip(null); lignes = []; montrer('#ecran-nip'); $('#in-nip').focus(); });

  async function appel(action, donnees = {}) {
    try { return await VI.api(action, Object.assign({ pin: nip }, donnees), 30000); }
    catch (err) {
      if (err.serveur && /NIP/i.test(err.message)) { ecrireNip(null); nip = null; montrer('#ecran-nip'); $('#erreur-nip').textContent = err.message; }
      throw err;
    }
  }

  /* ---------------- Chargement ---------------- */
  async function ouvrirTableau() {
    montrer('#ecran-tdb');
    await Promise.all([chargerResultats(), chargerVerbes()]);
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
    } catch (err) { VI.toast('Erreur : ' + esc(err.message), 'erreur'); }
    finally { $('#btn-actualiser').disabled = false; $('#btn-actualiser').textContent = '↻ Actualiser'; }
  }
  $('#btn-actualiser').addEventListener('click', chargerResultats);

  function groupesConnus() { return [...new Set(lignes.map((l) => l.groupe))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)); }
  function remplirGroupes() {
    const g = groupesConnus();
    const actuel = $('#f-groupe').value;
    $('#f-groupe').innerHTML = '<option value="">Tous les groupes</option>' + g.map((x) => `<option ${x === actuel ? 'selected' : ''}>${esc(x)}</option>`).join('');
    $('#sup-groupe').innerHTML = g.length ? g.map((x) => `<option>${esc(x)}</option>`).join('') : '<option value="">Aucun groupe</option>';
    majBoutonSupprimer();
  }

  /* ---------------- Filtres ---------------- */
  function filtrer(ignorerGroupe = false) {
    const g = $('#f-groupe').value, b = $('#f-bloc').value, m = $('#f-mode').value, p = Number($('#f-periode').value);
    const depuis = p ? Date.now() - p * 86400000 : 0;
    return lignes.filter((l) => (ignorerGroupe || !g || l.groupe === g) && (!b || l.bloc === Number(b)) && (!m || l.mode === m) && l.t >= depuis);
  }
  $$('#filtres select').forEach((s) => s.addEventListener('change', rendre));

  /* ---------------- Onglets ---------------- */
  $('.onglets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-onglet]'); if (!b) return;
    $$('.onglets button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('[data-panneau]').forEach((p) => { p.hidden = p.dataset.panneau !== b.dataset.onglet; });
    $('#filtres').hidden = b.dataset.onglet === 'liste'; // les filtres servent aussi à l'export CSV
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
        <td class="mono">${esc(e.code)}</td><td>${esc(e.groupe)}</td><td>${e.n}</td>
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
    $('#detail-sous-titre').textContent = 'Groupe ' + (toutes[0] ? toutes[0].groupe : '?') + ' · ' + tentatives.length + ' tentative' + (tentatives.length > 1 ? 's' : '') +
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
    const d = $('#detail-eleve');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    d.scrollTop = 0;
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
    $('#table-chaleur').innerHTML = `<thead><tr><th>Verbe</th>${groupes.map((g) => `<th style="text-align:center">Gr. ${esc(g)}</th>`).join('')}</tr></thead><tbody>${
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

  /* ---------------- Gestion ---------------- */
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

  function majBoutonSupprimer() { const g = $('#sup-groupe').value; $('#btn-supprimer').disabled = !g || $('#sup-confirm').value.trim() !== g; }
  $('#sup-groupe').addEventListener('change', majBoutonSupprimer);
  $('#sup-confirm').addEventListener('input', majBoutonSupprimer);
  $('#btn-supprimer').addEventListener('click', async () => {
    const g = $('#sup-groupe').value;
    const btn = $('#btn-supprimer'); btn.disabled = true; btn.textContent = 'Suppression…';
    try {
      const rep = await appel('deleteGroup', { groupe: g });
      VI.toast(`🗑️ Groupe ${esc(g)} : ${rep.supprimees} résultat(s) supprimé(s).`, 'succes');
      $('#sup-confirm').value = '';
      await chargerResultats();
    } catch (e) { VI.toast('Erreur : ' + esc(e.message), 'erreur'); }
    finally { btn.textContent = 'Supprimer'; majBoutonSupprimer(); }
  });

  $('#btn-nip-changer').addEventListener('click', async () => {
    const n = $('#nip-nouveau').value.trim(), c = $('#nip-confirm').value.trim();
    if (!/^\d{4,8}$/.test(n)) { VI.toast('Le NIP doit contenir de 4 à 8 chiffres.', 'erreur'); return; }
    if (n !== c) { VI.toast('Les deux NIP ne sont pas identiques.', 'erreur'); return; }
    try {
      await appel('changePin', { nouveau: n });
      nip = n; ecrireNip(n);
      $('#nip-nouveau').value = ''; $('#nip-confirm').value = '';
      VI.toast('🔑 NIP changé.', 'succes');
    } catch (e) { VI.toast('Erreur : ' + esc(e.message), 'erreur'); }
  });

  /* ---------------- Démarrage ---------------- */
  if (!VI.urlConfiguree()) { montrer('#non-configure'); return; }
  nip = lireNip();
  if (nip) ouvrirTableau().catch(() => {}); else { montrer('#ecran-nip'); $('#in-nip').focus(); }
})();
