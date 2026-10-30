/* BK+ — Fichier clients et catalogue d'articles (repris d'Isanet) */
let qC = '', typeC = 'tous', qArt = '', typeArt = 'tous', clientsCount = null, articlesCount = null;
const pat = q => '*' + String(q).replace(/[%*_,().:"\\]/g, ' ').trim().replace(/\s+/g, '*') + '*';
const fmtAdr = c => [[c.adresse, c.complement].filter(Boolean).join(', '), [c.cp, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

function searchClients(q, limit, type) {
  let r = sb.from('clients').select('*', { count: 'exact' }).order('nom').limit(limit || 60);
  if (type && type !== 'tous') r = r.eq('type', type);
  if (q) { const l = pat(q); r = r.or(['nom', 'contact', 'email', 'adresse', 'cp', 'ville', 'tel', 'code_aux'].map(k => `${k}.ilike.${l}`).join(',')); }
  return r;
}
function searchArticles(q, limit, type) {
  let r = sb.from('articles').select('*', { count: 'exact' }).eq('actif', true).order('nom').limit(limit || 60);
  if (type && type !== 'tous') r = r.eq('type', type);
  if (q) { const l = pat(q); r = r.or(['nom', 'ref', 'description'].map(k => `${k}.ilike.${l}`).join(',')); }
  return r;
}

/* ---------- Autocomplétion réutilisable ---------- */
function attachAC(input, fetcher, render, onPick) {
  if (!input || input.dataset.ac) return; input.dataset.ac = '1'; input.setAttribute('autocomplete', 'off');
  const box = document.createElement('div'); box.className = 'ac'; box.hidden = true;
  input.insertAdjacentElement('afterend', box); input.parentElement.classList.add('acw');
  let items = [], sel = -1, tm = null, seq = 0;
  const close = () => { box.hidden = true; sel = -1; };
  const draw = () => { box.innerHTML = items.map((x, k) => `<button type="button" data-k="${k}" class="${k === sel ? 'on' : ''}">${render(x)}</button>`).join('') || '<p>Aucun résultat</p>'; box.hidden = false;
    box.querySelectorAll('[data-k]').forEach(b => b.onmousedown = e => { e.preventDefault(); pick(+b.dataset.k); }); };
  const pick = k => { const x = items[k]; if (!x) return; close(); onPick(x); };
  input.addEventListener('input', () => { clearTimeout(tm); const q = input.value.trim(); if (q.length < 2) return close();
    tm = setTimeout(async () => { const my = ++seq; const { data } = await fetcher(q, 8); if (my !== seq) return; items = data || []; sel = -1; draw(); }, 180); });
  input.addEventListener('keydown', e => { if (box.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter' && sel > -1) { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') close(); });
  input.addEventListener('blur', () => setTimeout(close, 150));
}
const clientLine = c => `<b>${E(c.nom)}</b>${c.type === 'entreprise' ? ' <i class="tg">Entreprise</i>' : ''}<small>${E(fmtAdr(c) || 'Adresse non renseignée')}${c.tel ? ' · ' + E(c.tel) : ''}</small>`;
const articleLine = a => `<b>${E(a.nom)}</b><small>${a.ref ? E(a.ref) + ' · ' : ''}${E(a.type)} · ${a.pu_ht != null ? eur(a.pu_ht) + ' HT' : 'sans prix'} · TVA ${String(a.tva).replace('.', ',')} %</small>`;

/* Formulaire d'intervention : choisir un client remplit l'adresse */
function acIntervention(f, i) {
  attachAC(f.client, q => searchClients(q, 8), clientLine, c => {
    f.client.value = c.nom; f.adresse.value = c.adresse || ''; if (f.complement) f.complement.value = c.complement || ''; f.cp.value = c.cp || ''; f.ville.value = c.ville || '';
    if (c.tel) f.tel.value = c.tel; if (c.type === 'entreprise' && c.contact && !f.occupant.value) f.occupant.value = c.contact;
    i.client_id = c.id; markLinked(f.client, true); toast('Fiche client reprise : ' + c.nom); });
  f.client.addEventListener('input', () => { i.client_id = null; markLinked(f.client, false); });
  markLinked(f.client, !!i.client_id);
}
/* Adresse : suggestions de la Base Adresse Nationale (comme Apple Plans), remplit CP et ville */
async function searchAdresse(q) {
  const qs = `q=${encodeURIComponent(q)}&limit=6&lat=43.514&lon=4.988&autocomplete=1`;
  for (const u of ['https://data.geopf.fr/geocodage/search?index=address&', 'https://api-adresse.data.gouv.fr/search/?']) {
    try { const r = await fetch(u + qs); if (!r.ok) continue; const j = await r.json(); return { data: (j.features || []).map(x => x.properties) }; } catch (e) { }
  }
  return { data: [] };
}
const adrLine = a => `<b>${E(a.name || a.label)}</b><small>${E([a.postcode, a.city].filter(Boolean).join(' '))}${a.context ? ' · ' + E(String(a.context).split(',').slice(-2).join(',').trim()) : ''}</small>`;
function acAdresse(f) {
  attachAC(f.adresse, q => q.length < 4 ? Promise.resolve({ data: [] }) : searchAdresse(q), adrLine, a => {
    f.adresse.value = a.type === 'municipality' ? '' : (a.name || ''); f.cp.value = a.postcode || ''; f.ville.value = a.city || '';
    (a.type === 'municipality' ? f.adresse : f.complement || f.adresse).focus(); });
}
/* Formulaire d'affaire : client + articles dans le chiffrage */
function acAffaire(f, a) {
  attachAC(f.client, q => searchClients(q, 8), clientLine, c => {
    f.client.value = c.nom; f.contact.value = c.contact || ''; f.tel.value = c.tel || ''; f.email.value = c.email || '';
    f.adresse.value = [c.adresse, c.complement].filter(Boolean).join(', '); f.cp.value = c.cp || ''; f.ville.value = c.ville || '';
    a.client_id = c.id; markLinked(f.client, true); toast('Fiche client reprise : ' + c.nom); });
  f.client.addEventListener('input', () => { a.client_id = null; markLinked(f.client, false); });
  markLinked(f.client, !!a.client_id);
}
function acLignes(lignes, redraw) {
  document.querySelectorAll('#lt [data-f="d"]').forEach(el => attachAC(el, q => searchArticles(q, 8), articleLine, art => {
    const k = +el.closest('tr').dataset.k; lignes[k].d = art.nom.trim(); if (art.pu_ht != null) lignes[k].pu = String(art.pu_ht).replace('.', ',');
    if (/forfait/i.test(art.nom)) lignes[k].u = 'forfait'; else if (art.type === 'Service' && /main|heure|déplacement/i.test(art.nom)) lignes[k].u = 'h';
    redraw(); }));
}
function markLinked(input, on) { const l = input.closest('label'); if (!l) return; l.classList.toggle('linked', on); }

/* ================= Vue Clients ================= */
async function listClients() {
  if (view !== 'clients') return;
  $('#main').innerHTML = `<div class="head"><h1>Clients</h1>
    <input class="search" id="qc" type="search" placeholder="Rechercher : nom, ville, adresse, e-mail…" value="${E(qC)}">
    <div class="seg">${[['tous', 'Tous'], ['particulier', 'Particuliers'], ['entreprise', 'Entreprises']].map(([k, l]) => `<button data-tc="${k}" class="${typeC === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn btn-line" id="xcl" title="Fichier .xlsx au format d’import d’Isanet">${ic('file')} Exporter pour Isanet <b id="xnc"></b></button><button class="btn btn-grad" id="ncl">+ Nouveau client</button></div><div id="clist"><div class="loading">Chargement…</div></div>`;
  const run = async () => {
    const { data, count, error } = await searchClients(qC, 80, typeC); if (error) return toast('Erreur : ' + error.message);
    if (!qC && typeC === 'tous') clientsCount = count;
    $('#clist').innerHTML = `<p class="cnt">${qC ? `${count} résultat${count > 1 ? 's' : ''} pour « ${E(qC)} »` : `${(count || 0).toLocaleString('fr-FR')} client${count > 1 ? 's' : ''}`}${count > data.length ? ` · ${data.length} affichés, affinez la recherche` : ''}</p>
      ${data.length ? `<div class="dt"><table><thead><tr><th>Client</th><th>Contact</th><th>Adresse</th><th class="n">C.A.</th></tr></thead><tbody>
      ${data.map(c => `<tr data-cl="${E(c.id)}"><td><b>${E(c.nom)}</b>${c.type === 'entreprise' ? ' <i class="tg">Entreprise</i>' : ''}</td><td>${E(c.contact || '')}${c.contact && (c.email || c.tel) ? '<br>' : ''}<small>${E([c.tel, c.email].filter(Boolean).join(' · '))}</small></td><td>${E(fmtAdr(c))}</td><td class="n">${c.ca ? eur(c.ca) : ''}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty">Aucun client trouvé. <button class="btn btn-line" id="ncl2" style="margin-left:8px">+ Créer « ${E(qC)} »</button></div>`}`;
    document.querySelectorAll('[data-cl]').forEach(tr => tr.onclick = () => clientForm(data.find(c => c.id === tr.dataset.cl)));
    if ($('#ncl2')) $('#ncl2').onclick = () => clientForm(null, { nom: qC });
  };
  $('#xcl').onclick = () => exportIsanet('clients'); nbExport('clients');
  let tm; $('#qc').oninput = e => { qC = e.target.value.trim(); clearTimeout(tm); tm = setTimeout(run, 220); };
  document.querySelectorAll('[data-tc]').forEach(b => b.onclick = () => { typeC = b.dataset.tc; document.querySelectorAll('[data-tc]').forEach(x => x.classList.toggle('on', x === b)); run(); });
  $('#ncl').onclick = () => clientForm(null);
  run();
}
async function clientForm(c, pre) {
  const isNew = !c; c = c || { id: 'bk-' + Date.now().toString(36), type: 'particulier', nom: '', contact: '', tel: '', email: '', adresse: '', complement: '', cp: '', ville: 'Istres', siret: '', notes: '', ...(pre || {}) };
  let inters = [], affs = [];
  if (!isNew) { const nm = c.nom.replace(/[%*,()]/g, ' ').trim();
    const [r1, r2] = await Promise.all([
      sb.from('interventions').select('id,date,heure,statut,travaux,epingle,intervention_techs(tech_id)').or(`client_id.eq.${c.id},client.ilike.${nm}`).order('date', { ascending: false }).limit(30),
      sb.from('affaires').select('id,ref,objet,statut,montant_ht,created_at').or(`client_id.eq.${c.id},client.ilike.${nm}`).order('created_at', { ascending: false }).limit(30)]);
    inters = r1.data || []; affs = r2.data || []; }
  openPanel(`<header><div><h2>${isNew ? 'Nouveau client' : E(c.nom)}</h2>${isNew ? '' : `<div style="color:var(--mute);font-size:13px">${c.code_aux ? 'Compte ' + E(c.code_aux) + ' · ' : ''}${c.ca ? 'C.A. ' + eur(c.ca) : 'Repris d’Isanet'}</div>`}</div><button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="cf"><div class="form">
    <label>Type<select name="type"><option value="particulier">Particulier</option><option value="entreprise" ${c.type === 'entreprise' ? 'selected' : ''}>Entreprise, agence, syndic</option></select></label>
    <label>Nom *<input name="nom" value="${E(c.nom)}" required></label>
    <label>Contact<input name="contact" value="${E(c.contact)}" placeholder="Personne à joindre"></label>
    <label>Téléphone<input name="tel" type="tel" value="${E(c.tel)}"></label>
    <label class="full">E-mail<input name="email" type="email" value="${E(c.email)}"></label>
    <label class="full">Adresse<input name="adresse" value="${E(c.adresse)}"></label>
    <label class="full">Complément (résidence, bâtiment, étage…)<input name="complement" value="${E(c.complement)}"></label>
    <label>Code postal<input name="cp" value="${E(c.cp)}" maxlength="5" inputmode="numeric"></label>
    <label>Ville<input name="ville" value="${E(c.ville)}"></label>
    <label>SIRET<input name="siret" value="${E(c.siret)}" inputmode="numeric"></label>
    <label class="full">Notes<textarea name="notes" style="min-height:60px" placeholder="Code portail, clés chez le gardien, habitudes…">${E(c.notes)}</textarea></label>
    ${isNew ? '' : `<div class="full box"><h4>Historique BK+</h4>
      ${affs.length || inters.length ? '' : '<p style="margin:0;color:var(--mute)">Rien encore dans l’application pour ce client.</p>'}
      ${affs.map(x => `<div class="hl" data-ha="${x.id}">${ic('briefcase')} <b>${E(x.ref || '')}</b> ${E(x.objet)} · ${ST_A[x.statut] ? ST_A[x.statut][0] : ''}${+x.montant_ht ? ' · ' + eur(x.montant_ht) : ''}</div>`).join('')}
      ${inters.map(x => `<div class="hl">${ic('calendar')} ${lbl(x.date)}${x.epingle ? '' : ' ' + hh(x.heure)} · ${E(x.travaux || '').slice(0, 70)} · ${E(names(x.intervention_techs.map(t => t.tech_id)))}</div>`).join('')}</div>`}
  </div></form>
  <footer><button class="btn btn-grad" form="cf" type="submit" id="csv">${isNew ? 'Créer le client' : 'Enregistrer'}</button>
    ${isNew ? '' : `<button class="btn btn-line" id="cpl">${ic('calendar')} Planifier</button><button class="btn btn-line" id="caf">${ic('briefcase')} Nouvelle affaire</button>`}</footer>`);
  const f = $('#cf');
  const row = () => { const fd = new FormData(f), o = { id: c.id }; ['type', 'nom', 'contact', 'tel', 'email', 'adresse', 'complement', 'cp', 'ville', 'siret', 'notes'].forEach(k => o[k] = String(fd.get(k) || '').trim()); return o; };
  const save = async () => { const r = row(); const res = isNew ? await sb.from('clients').insert(r).select().single() : await sb.from('clients').update(r).eq('id', c.id).select().single(); if (res.error) throw res.error; return res.data; };
  f.onsubmit = async e => { e.preventDefault(); const b = $('#csv'); b.disabled = true;
    try { const d = await save(); closePanel(); toast(isNew ? 'Client ' + d.nom + ' créé' : 'Fiche client enregistrée'); if (view === 'clients') listClients(); }
    catch (er) { b.disabled = false; toast('Erreur : ' + (er.message || er)); } };
  document.querySelectorAll('[data-ha]').forEach(d => d.onclick = async () => { await loadAffaires(); const x = affaires.find(y => y.id === d.dataset.ha); if (x) affaireForm(x); });
  if (isNew) return;
  const preC = r => ({ client: r.nom, client_id: c.id, tel: r.tel, adresse: [r.adresse, r.complement].filter(Boolean).join(', '), cp: r.cp, ville: r.ville || 'Istres' });
  $('#cpl').onclick = async () => { let r; try { r = await save(); } catch (er) { return toast('Erreur : ' + (er.message || er)); } form(null, { pre: { ...preC(r), occupant: r.type === 'entreprise' ? r.contact : '' } }); };
  $('#caf').onclick = async () => { let r; try { r = await save(); } catch (er) { return toast('Erreur : ' + (er.message || er)); } affaireForm(null, { pre: { ...preC(r), contact: r.contact, email: r.email } }); };
}

/* ================= Vue Articles ================= */
async function listArticles() {
  if (view !== 'articles') return;
  $('#main').innerHTML = `<div class="head"><h1>Articles</h1>
    <input class="search" id="qart" type="search" placeholder="Rechercher : désignation, référence…" value="${E(qArt)}">
    <div class="seg">${[['tous', 'Tous'], ['Produit', 'Produits'], ['Service', 'Services']].map(([k, l]) => `<button data-ta="${k}" class="${typeArt === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn btn-line" id="xart" title="Fichier .xlsx au format d’import d’Isanet">${ic('file')} Exporter pour Isanet <b id="xn"></b></button><button class="btn btn-grad" id="nart">+ Nouvel article</button></div><div id="alist"><div class="loading">Chargement…</div></div>`;
  const run = async () => {
    const { data, count, error } = await searchArticles(qArt, 100, typeArt); if (error) return toast('Erreur : ' + error.message);
    $('#alist').innerHTML = `<p class="cnt">${qArt ? `${count} résultat${count > 1 ? 's' : ''} pour « ${E(qArt)} »` : `${(count || 0).toLocaleString('fr-FR')} articles`}${count > data.length ? ` · ${data.length} affichés, affinez la recherche` : ''} · ils se proposent tout seuls dans le chiffrage des affaires</p>
      ${data.length ? `<div class="dt"><table><thead><tr><th>Désignation</th><th>Réf.</th><th>Type</th><th class="n">Prix HT</th><th class="n">TVA</th><th class="n">Stock</th></tr></thead><tbody>
      ${data.map(a => `<tr data-ar="${E(a.id)}"><td><b>${E(a.nom)}</b>${a.description ? `<br><small>${E(a.description.replace(/^-\s*/, '').split('\n')[0]).slice(0, 90)}</small>` : ''}</td><td><small>${E(a.ref || '')}</small></td><td><i class="tg ${a.type === 'Service' ? 'sv' : ''}">${E(a.type)}</i></td><td class="n">${a.pu_ht != null ? eur(a.pu_ht) : '—'}</td><td class="n">${String(a.tva).replace('.', ',')} %</td><td class="n">${a.stock != null ? (+a.stock).toLocaleString('fr-FR') : ''}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Aucun article trouvé.</div>'}`;
    document.querySelectorAll('[data-ar]').forEach(tr => tr.onclick = () => articleForm(data.find(a => a.id === tr.dataset.ar)));
  };
  $('#xart').onclick = () => exportIsanet('articles'); nbExport('articles');
  let tm; $('#qart').oninput = e => { qArt = e.target.value.trim(); clearTimeout(tm); tm = setTimeout(run, 220); };
  document.querySelectorAll('[data-ta]').forEach(b => b.onclick = () => { typeArt = b.dataset.ta; document.querySelectorAll('[data-ta]').forEach(x => x.classList.toggle('on', x === b)); run(); });
  $('#nart').onclick = () => articleForm(null);
  run();
}
function articleForm(a) {
  const isNew = !a; a = a || { id: 'bk-' + Date.now().toString(36), nom: '', ref: '', description: '', type: 'Produit', pu_ht: '', pu_fournisseur: '', tva: 10, stock: '' };
  openPanel(`<header><h2>${isNew ? 'Nouvel article' : E(a.nom)}</h2><button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="arf"><div class="form">
    <label class="full">Désignation *<input name="nom" value="${E(a.nom)}" required></label>
    <label>Référence<input name="ref" value="${E(a.ref)}"></label>
    <label>Type<select name="type"><option>Produit</option><option ${a.type === 'Service' ? 'selected' : ''}>Service</option></select></label>
    <label>Prix de vente HT<input name="pu_ht" value="${E(a.pu_ht ?? '')}" inputmode="decimal"></label>
    <label>Prix d’achat HT<input name="pu_fournisseur" value="${E(a.pu_fournisseur ?? '')}" inputmode="decimal"></label>
    <label>TVA<select name="tva">${[0, 5.5, 10, 20].map(v => `<option value="${v}" ${+a.tva === v ? 'selected' : ''}>${String(v).replace('.', ',')} %</option>`).join('')}</select></label>
    <label>Stock<input name="stock" value="${E(a.stock ?? '')}" inputmode="decimal"></label>
    <label class="full">Description (texte du devis)<textarea name="description">${E(a.description)}</textarea></label>
    <p class="full" id="mrg" style="margin:0;color:var(--mute)"></p>
  </div></form>
  <footer><button class="btn btn-grad" form="arf" type="submit" id="arsv">${isNew ? 'Créer l’article' : 'Enregistrer'}</button>${isNew ? '' : '<button class="btn btn-line" id="ardel" style="margin-left:auto">Retirer du catalogue</button>'}</footer>`);
  const f = $('#arf'), mrg = () => { const v = num(f.pu_ht.value), c = num(f.pu_fournisseur.value); $('#mrg').textContent = v && c ? `Marge : ${eur(v - c)} HT par unité (${Math.round((v - c) / v * 100)} %)` : ''; };
  f.pu_ht.oninput = f.pu_fournisseur.oninput = mrg; mrg();
  f.onsubmit = async e => { e.preventDefault(); const fd = new FormData(f), n = k => { const v = String(fd.get(k) || '').trim(); return v === '' ? null : num(v); };
    const r = { id: a.id, nom: String(fd.get('nom')).trim(), ref: String(fd.get('ref') || '').trim(), type: fd.get('type'), description: String(fd.get('description') || '').trim(), pu_ht: n('pu_ht'), pu_fournisseur: n('pu_fournisseur'), tva: num(fd.get('tva')), stock: n('stock') };
    const res = isNew ? await sb.from('articles').insert(r) : await sb.from('articles').update(r).eq('id', a.id);
    if (res.error) return toast('Erreur : ' + res.error.message); closePanel(); toast(isNew ? 'Article créé' : 'Article enregistré'); if (view === 'articles') listArticles(); };
  if ($('#ardel')) $('#ardel').onclick = async () => { const { error } = await sb.from('articles').update({ actif: false }).eq('id', a.id); if (error) return toast('Erreur : ' + error.message); closePanel(); toast('Article retiré du catalogue'); listArticles(); };
}

/* ================= Export vers Isanet (pas d'API chez Isanet : import par fichier, mêmes colonnes que leurs exports) ================= */
const ISANET = {
  articles: { titre: 'article', menu: 'Mes articles', badge: 'xn', head: ['ID', 'NOM', 'REFERENCE', 'DESCRIPTION', 'TYPE', 'PRIX UNITAIRE', 'PRIX UNITAIRE FOURNISSEUR (HT)', 'UNITÉ', 'STOCK', 'TVA (%)', 'CODE COMPTABLE', 'CATEGORIE'],
    row: a => [a.id.startsWith('bk-') ? '' : a.id, a.nom || '', a.ref || '', a.description || '', a.type || 'Produit', a.pu_ht ?? '', a.pu_fournisseur ?? '', '', a.stock ?? '', a.tva ?? 20, '', ''] },
  clients: { titre: 'client', menu: 'Mes contacts', badge: 'xnc', head: ['ID', 'STATUT', 'CATÉGORIE', 'TYPE', 'NOM', 'CONTACT PRÉNOM', 'CONTACT NOM', 'TÉLÉPHONE', 'E-MAIL', 'ADRESSE', "COMPLÉMENT D'ADRESSE", 'CODE POSTAL', 'VILLE', 'PAYS', 'N°SIRET', 'N°TVA INTRACOMMUNAUTAIRE', 'SITE WEB', 'COMMENTAIRES', 'REFERENCE CLIENT', 'IBAN', 'BIC', 'CODE AUXILIAIRE', 'C.A.'],
    row: c => { const ent = c.type === 'entreprise', ct = String(c.contact || '').trim().split(/\s+/);
      return [c.id.startsWith('bk-') ? '' : c.id, ent ? 'CLIENT ENTREPRISE' : 'CLIENT PARTICULIER', ent ? 'Entreprise' : 'Particulier', 'Client', c.nom || '', ent && c.contact ? ct[0] : '', ent && c.contact ? ct.slice(1).join(' ') : '', c.tel || '', c.email || '', c.adresse || '', c.complement || '', c.cp || '', c.ville || '', 'France', c.siret || '', '', '', c.notes || '', '', '', '', c.code_aux || '', '']; } }
};
let xlsxP = null;
const loadXLSX = () => xlsxP || (xlsxP = new Promise((ok, ko) => { if (window.XLSX) return ok(window.XLSX); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => ok(window.XLSX); s.onerror = () => { xlsxP = null; ko(new Error('Impossible de charger le module Excel')); }; document.head.appendChild(s); }));
async function nbExport(t) { const { count } = await sb.from(t).select('id', { count: 'exact', head: true }).eq('a_exporter', true); const el = $('#' + ISANET[t].badge); if (el) el.textContent = count ? '(' + count + ')' : ''; return count || 0; }
async function exportIsanet(t) {
  const cf = ISANET[t], { data, error } = await sb.from(t).select('*').eq('a_exporter', true).order('nom'); if (error) return toast('Erreur : ' + error.message);
  if (!data.length) return toast(`Rien à exporter : tous les ${cf.titre}s sont déjà dans Isanet`);
  const nv = data.filter(a => a.id.startsWith('bk-')).length, md = data.length - nv, s = n => n > 1 ? 's' : '';
  if (!confirm(`${data.length} ${cf.titre}${s(data.length)} à envoyer dans Isanet (${nv} nouveau${nv > 1 ? 'x' : ''}, ${md} modifié${s(md)}).\n\nLe fichier va se télécharger. Ensuite dans Isanet : ${cf.menu} › Importer › Choisir un fichier › Importer.`)) return;
  try {
    const X = await loadXLSX(), ws = X.utils.aoa_to_sheet([cf.head, ...data.map(cf.row)]), wb = X.utils.book_new();
    ws['!cols'] = cf.head.map(h => ({ wch: Math.max(10, Math.min(40, h.length + 4)) })); X.utils.book_append_sheet(wb, ws, 'Export');
    X.writeFile(wb, `import-${t}-BK-${iso(new Date())}.xlsx`);
    const r = await sb.from(t).update({ a_exporter: false }).in('id', data.map(a => a.id)); if (r.error) throw r.error;
    toast('Fichier prêt : importez-le dans Isanet'); nbExport(t);
  } catch (e) { toast('Erreur : ' + (e.message || e)); }
}
