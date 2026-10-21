/* BK+ — Affaires (devis toutes sources → Isanet Fact) et Chantiers (gros travaux) */

/* ================= Outils ================= */
const ST_A = { a_chiffrer: ['À chiffrer', '#5E6680'], visite: ['Visite prévue', '#6D28D9'], envoye: ['Devis envoyé', '#2239A9'], accepte: ['Accepté · à facturer', '#0E9F6E'], refuse: ['Refusé', '#C62828'], facture: ['Facturé', '#0B1433'] };
const SRC = { telephone: '📞 Téléphone', site: '🌐 Site', email: '✉️ E-mail', bouche: '🗣 Bouche-à-oreille', passage: '🚪 Passage au bureau', partenaire: '🤝 Agence / syndic', autre: 'Autre' };
const UNITES = ['u', 'h', 'forfait', 'm', 'ml', 'm²', 'j'];
const ST_C = { preparation: ['En préparation', 't-aff'], en_cours: ['En cours', 't-new'], termine: ['Terminé', 't-pla'] };
const eur = n => (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const totalHT = l => Math.round(l.reduce((s, x) => s + num(x.q) * num(x.pu), 0) * 100) / 100;
const dfr = s => s ? new Date(s + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
const addr = o => [o.adresse, [o.cp, o.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
let affaires = [], qA = '', showClosed = false, chantiers = [], filtreC = 'actifs';

/* ================= Affaires ================= */
async function loadAffaires() { const { data, error } = await sb.from('affaires').select('*').order('updated_at', { ascending: false }).limit(1000); if (error) return toast('Erreur : ' + error.message); affaires = data || []; badgeA(); }
function badgeA() { const c = $('#ca'); if (!c) return; const t = iso(new Date()); c.textContent = affaires.filter(a => a.statut === 'a_chiffrer' || (a.statut === 'envoye' && a.relance_le && a.relance_le <= t)).length || ''; }
function listAffaires() {
  if (view !== 'affaires') return;
  const today = iso(new Date());
  const match = a => !qA || [a.ref, a.client, a.objet, a.ville, a.contact, a.tel, a.isanet_devis].join(' ').toLowerCase().includes(qA);
  const cols = showClosed ? Object.keys(ST_A) : ['a_chiffrer', 'visite', 'envoye', 'accepte'];
  const sum = s => affaires.filter(a => a.statut === s);
  const attente = sum('envoye'), afact = sum('accepte'), relances = attente.filter(a => a.relance_le && a.relance_le <= today);
  const kpi = (l, arr, extra) => `<div class="kpi"><small>${l}</small><b>${eur(arr.reduce((s, a) => s + +a.montant_ht, 0))}</b><span>${arr.length} affaire${arr.length > 1 ? 's' : ''} · HT${extra || ''}</span></div>`;
  $('#main').innerHTML = `<div class="head"><h1>Affaires</h1><span class="live"><i></i>En direct</span>
    <input class="search" id="qa" type="search" placeholder="Rechercher (client, ville, n°…)" value="${E(qA)}">
    <label class="tgl"><input type="checkbox" id="sc" ${showClosed ? 'checked' : ''}> Refusées / facturées</label>
    <button class="btn btn-line" id="exp" title="Fichier pour Isanet Fact">⬇ Prêt à facturer</button><button class="btn btn-grad" id="na">+ Nouvelle affaire</button></div>
  <div class="kpis">${kpi('En attente de réponse', attente)}${kpi('Accepté · à facturer dans Isanet', afact)}<div class="kpi ${relances.length ? 'warn' : ''}"><small>Relances à faire</small><b>${relances.length}</b><span>${relances.length ? 'devis à relancer aujourd’hui' : 'rien à relancer'}</span></div></div>
  <div class="kb">${cols.map(s => { const it = affaires.filter(a => a.statut === s && match(a)); return `<section class="kc" data-col="${s}"><h3><i style="background:${ST_A[s][1]}"></i>${ST_A[s][0]}<span>${it.length}</span></h3>
    ${it.length ? '' : '<p class="kv0">Glissez une affaire ici</p>'}${it.map(a => `<button class="ka" draggable="true" data-a="${a.id}" style="--c:${ST_A[a.statut][1]}">
      <small>${E(a.ref || '')} · ${E((SRC[a.source] || '').split(' ')[0])}${a.demande_id ? ' 📷' : ''}</small><b>${E(a.client)}</b><span class="o">${E(a.objet)}</span>
      <span class="m"><span>${E(a.ville || '')}</span><b>${+a.montant_ht ? eur(a.montant_ht) : '—'}</b></span>
      ${s === 'envoye' && a.relance_le && a.relance_le <= today ? '<em class="rel">⏰ À relancer</em>' : ''}${s === 'visite' && a.visite_le ? `<em>🗓 Visite ${dfr(a.visite_le)}</em>` : ''}${s === 'accepte' ? `<em class="okk">→ Facturer dans Isanet</em>` : ''}${s === 'facture' && a.isanet_facture ? `<em>Facture ${E(a.isanet_facture)}</em>` : ''}
    </button>`).join('')}</section>`; }).join('')}</div>`;
  $('#qa').oninput = e => { qA = e.target.value.trim().toLowerCase(); const p = e.target.selectionStart; listAffaires(); const q = $('#qa'); q.focus(); q.setSelectionRange(p, p); };
  $('#sc').onchange = e => { showClosed = e.target.checked; listAffaires(); };
  $('#na').onclick = () => affaireForm(null);
  $('#exp').onclick = exportIsanet;
  document.querySelectorAll('.ka').forEach(b => { b.onclick = () => affaireForm(affaires.find(a => a.id === b.dataset.a));
    b.ondragstart = e => { e.dataTransfer.setData('text/plain', b.dataset.a); b.classList.add('dragging'); }; b.ondragend = () => b.classList.remove('dragging'); });
  document.querySelectorAll('.kc').forEach(c => { c.ondragover = e => { e.preventDefault(); c.classList.add('over'); }; c.ondragleave = () => c.classList.remove('over');
    c.ondrop = async e => { e.preventDefault(); c.classList.remove('over'); const a = affaires.find(x => x.id === e.dataTransfer.getData('text/plain')); if (a && a.statut !== c.dataset.col) await setStatutA(a, c.dataset.col); }; });
}
function statutPatch(a, s) {
  const p = { statut: s }, t = iso(new Date());
  if (s === 'envoye') { if (!a.envoye_le) p.envoye_le = t; if (!a.relance_le) p.relance_le = iso(addDays(new Date(), 7)); }
  return p;
}
async function setStatutA(a, s) {
  const p = statutPatch(a, s); const { error } = await sb.from('affaires').update(p).eq('id', a.id);
  if (error) return toast('Erreur : ' + error.message);
  Object.assign(a, p); listAffaires(); badgeA();
  toast(s === 'accepte' ? '✓ Accepté : à facturer dans Isanet Fact' : s === 'envoye' ? 'Devis envoyé · relance prévue le ' + dfr(a.relance_le) : 'Affaire : ' + ST_A[s][0]);
}
function lignesHTML(l) {
  return l.map((x, k) => `<tr data-k="${k}"><td><input data-f="d" value="${E(x.d)}" placeholder="Désignation (ex. Remplacement chauffe-eau 200 L)"></td><td><input data-f="q" value="${E(x.q)}" inputmode="decimal"></td>
    <td><select data-f="u">${UNITES.map(u => `<option ${u === x.u ? 'selected' : ''}>${u}</option>`).join('')}</select></td><td><input data-f="pu" value="${E(x.pu)}" inputmode="decimal" placeholder="0,00"></td>
    <td class="tt">${eur(num(x.q) * num(x.pu))}</td><td><button type="button" class="lrm" data-rm="${k}" aria-label="Supprimer la ligne">×</button></td></tr>`).join('');
}
async function affaireForm(a, opts) {
  opts = opts || {}; const isNew = !a;
  a = a || { source: 'telephone', client: '', contact: '', tel: '', email: '', adresse: '', cp: '', ville: 'Istres', objet: '', description: '', lignes: [], tva: 10, statut: 'a_chiffrer', visite_le: null, envoye_le: null, relance_le: null, isanet_devis: '', isanet_facture: '', notes: '', demande_id: null, ...(opts.pre || {}) };
  let lignes = (a.lignes || []).map(x => ({ ...x })); if (!lignes.length) lignes.push({ d: '', q: 1, u: 'u', pu: '' });
  const [{ data: inters }, { data: ch }] = isNew ? [{ data: [] }, { data: [] }] : await Promise.all([
    sb.from('interventions').select('id,date,heure,statut,travaux,epingle,intervention_techs(tech_id)').eq('affaire_id', a.id).order('date'),
    sb.from('chantiers').select('id,nom,statut').eq('affaire_id', a.id)]);
  openPanel(`<header><div>${isNew ? '' : `<span class="tag" style="margin:0;background:${ST_A[a.statut][1]}1A;color:${ST_A[a.statut][1]}">${ST_A[a.statut][0]}</span>`}<h2 style="margin-top:6px">${isNew ? 'Nouvelle affaire' : E(a.ref) + ' · ' + E(a.client)}</h2>${a.demande_id ? '<div style="color:var(--mute);font-size:13px">📷 Issue d’une demande du site</div>' : ''}</div><button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="af"><div class="form">
    <label>Client *<input name="client" value="${E(a.client)}" required placeholder="Nom, agence, syndic…"></label>
    <label>Source<select name="source">${Object.entries(SRC).map(([k, v]) => `<option value="${k}" ${k === a.source ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Contact sur place<input name="contact" value="${E(a.contact)}"></label>
    <label>Téléphone<input name="tel" type="tel" value="${E(a.tel)}"></label>
    <label class="full">E-mail<input name="email" type="email" value="${E(a.email)}"></label>
    <label class="full">Adresse du chantier<input name="adresse" value="${E(a.adresse)}"></label>
    <label>Code postal<input name="cp" value="${E(a.cp)}" maxlength="5" inputmode="numeric"></label>
    <label>Ville<input name="ville" value="${E(a.ville)}" list="villes2"></label>
    <label class="full">Objet *<input name="objet" value="${E(a.objet)}" required placeholder="Ex. : Remplacement ballon d’eau chaude"></label>
    <label class="full">Description / relevé<textarea name="description">${E(a.description)}</textarea></label>
    <div class="full box lines"><h4>Chiffrage (pré-devis à reprendre dans Isanet Fact)</h4>
      <table><thead><tr><th>Désignation</th><th>Qté</th><th>Unité</th><th>PU HT</th><th>Total HT</th><th></th></tr></thead><tbody id="lt">${lignesHTML(lignes)}</tbody></table>
      <button type="button" class="btn btn-line" id="addl" style="margin-top:8px">+ Ligne</button>
      <div class="tot"><span>Total HT <b id="tht"></b></span><label class="inline">TVA <select name="tva">${[5.5, 10, 20].map(v => `<option value="${v}" ${+a.tva === v ? 'selected' : ''}>${String(v).replace('.', ',')} %</option>`).join('')}</select></label><span>TTC <b id="ttc"></b></span></div></div>
    <label>Statut<select name="statut">${Object.entries(ST_A).map(([k, v]) => `<option value="${k}" ${k === a.statut ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
    <label>Visite / relevé le<input type="date" name="visite_le" value="${a.visite_le || ''}"></label>
    <label>Devis envoyé le<input type="date" name="envoye_le" value="${a.envoye_le || ''}"></label>
    <label>Relancer le<input type="date" name="relance_le" value="${a.relance_le || ''}"></label>
    <label>N° devis Isanet<input name="isanet_devis" value="${E(a.isanet_devis)}" placeholder="Ex. D2026-0142"></label>
    <label>N° facture Isanet<input name="isanet_facture" value="${E(a.isanet_facture)}" placeholder="Ex. F2026-0098"></label>
    <label class="full">Notes internes<textarea name="notes" style="min-height:60px">${E(a.notes)}</textarea></label>
    ${!isNew && (inters.length || ch.length) ? `<div class="full box"><h4>Liés à cette affaire</h4>${ch.map(c => `<div>🏗 Chantier <b>${E(c.nom)}</b> · ${ST_C[c.statut][0]}</div>`).join('')}${inters.map(i => `<div>🗓 ${lbl(i.date)}${i.epingle ? '' : ' ' + hh(i.heure)} · ${E(names(i.intervention_techs.map(x => x.tech_id)))} · ${STAT_I[i.statut]}</div>`).join('')}</div>` : ''}
  </div><datalist id="villes2">${['Istres', 'Miramas', 'Martigues', 'Fos-sur-Mer', 'Port-de-Bouc', 'Saint-Chamas', 'Cornillon-Confoux', 'Grans', 'Salon-de-Provence', 'Vitrolles', 'Marignane', 'Sausset-les-Pins', 'Port-Saint-Louis-du-Rhône', 'Aix-en-Provence', 'Marseille'].map(v => `<option value="${v}">`).join('')}</datalist></form>
  <footer><button class="btn btn-grad" form="af" type="submit" id="asv">${isNew ? 'Créer l’affaire' : 'Enregistrer'}</button>
    ${isNew ? '' : `<button class="btn btn-line" id="acp" title="Copier client + lignes pour les coller dans Isanet">📋 Copier pour Isanet</button><button class="btn btn-line" id="apl">🗓 Planifier</button>${a.statut === 'accepte' || a.statut === 'facture' ? `<button class="btn btn-line" id="ach">🏗 ${ch.length ? 'Voir le chantier' : 'Créer le chantier'}</button>` : ''}<button class="btn btn-red" id="adl" style="margin-left:auto">Supprimer</button>`}</footer>`);
  $('#panel').classList.add('wide');
  const f = $('#af');
  const recalc = () => { const ht = totalHT(lignes), tv = num(f.tva.value); $('#tht').textContent = eur(ht); $('#ttc').textContent = eur(ht * (1 + tv / 100)); document.querySelectorAll('#lt tr').forEach(tr => { const x = lignes[+tr.dataset.k]; tr.querySelector('.tt').textContent = eur(num(x.q) * num(x.pu)); }); };
  const bindL = () => { document.querySelectorAll('#lt [data-f]').forEach(el => el.oninput = el.onchange = () => { lignes[+el.closest('tr').dataset.k][el.dataset.f] = el.value; recalc(); });
    document.querySelectorAll('#lt [data-rm]').forEach(b => b.onclick = () => { lignes.splice(+b.dataset.rm, 1); if (!lignes.length) lignes.push({ d: '', q: 1, u: 'u', pu: '' }); $('#lt').innerHTML = lignesHTML(lignes); bindL(); recalc(); }); };
  bindL(); recalc(); f.tva.onchange = recalc;
  $('#addl').onclick = () => { lignes.push({ d: '', q: 1, u: 'u', pu: '' }); $('#lt').innerHTML = lignesHTML(lignes); bindL(); recalc(); const ins = document.querySelectorAll('#lt [data-f="d"]'); ins[ins.length - 1].focus(); };
  f.statut.onchange = () => { const p = statutPatch({ envoye_le: f.envoye_le.value, relance_le: f.relance_le.value }, f.statut.value); if (p.envoye_le) f.envoye_le.value = p.envoye_le; if (p.relance_le) f.relance_le.value = p.relance_le; };
  const row = () => { const fd = new FormData(f), L = lignes.filter(x => String(x.d).trim() || num(x.pu)).map(x => ({ d: String(x.d).trim(), q: num(x.q), u: x.u || 'u', pu: num(x.pu) }));
    const o = {}; ['client', 'source', 'contact', 'tel', 'email', 'adresse', 'cp', 'ville', 'objet', 'description', 'statut', 'isanet_devis', 'isanet_facture', 'notes'].forEach(k => o[k] = String(fd.get(k) || '').trim());
    ['visite_le', 'envoye_le', 'relance_le'].forEach(k => o[k] = fd.get(k) || null);
    return { ...o, tva: num(fd.get('tva')), lignes: L, montant_ht: totalHT(L), demande_id: a.demande_id || null }; };
  const save = async () => {
    const r = row(); let res;
    if (isNew) res = await sb.from('affaires').insert({ ...r, created_by: me.id }).select().single(); else res = await sb.from('affaires').update(r).eq('id', a.id).select().single();
    if (res.error) throw res.error;
    if (isNew && opts.demande) await sb.from('demandes').update({ statut: 'affaire', traitee_par: me.id, traitee_le: new Date().toISOString() }).eq('id', opts.demande.id);
    return res.data;
  };
  f.onsubmit = async e => { e.preventDefault(); const b = $('#asv'); b.disabled = true;
    try { const d = await save(); closePanel(); await loadAffaires(); if (view === 'affaires') listAffaires(); else await go('affaires'); toast(isNew ? 'Affaire ' + d.ref + ' créée' : 'Affaire enregistrée'); }
    catch (er) { b.disabled = false; toast('Erreur : ' + (er.message || er)); } };
  if (isNew) return;
  $('#acp').onclick = async () => { const r = row(); const tv = r.tva, ht = r.montant_ht;
    const txt = [`Client : ${r.client}`, r.contact ? `Contact : ${r.contact}` : '', r.tel ? `Tél : ${r.tel}` : '', r.email ? `E-mail : ${r.email}` : '', `Adresse : ${addr(r)}`, `Objet : ${r.objet}`, `Réf. BK+ : ${a.ref}`, '',
      ['Désignation', 'Qté', 'Unité', 'PU HT', 'Total HT'].join('\t'), ...r.lignes.map(x => [x.d, String(x.q).replace('.', ','), x.u, x.pu.toFixed(2).replace('.', ','), (x.q * x.pu).toFixed(2).replace('.', ',')].join('\t')), '',
      `Total HT : ${eur(ht)}`, `TVA ${String(tv).replace('.', ',')} % : ${eur(ht * tv / 100)}`, `Total TTC : ${eur(ht * (1 + tv / 100))}`].filter((x, k, arr) => x !== '' || arr[k - 1] !== '').join('\n');
    try { await navigator.clipboard.writeText(txt); toast('📋 Copié : collez-le dans Isanet Fact'); } catch (e) { prompt('Copiez ce texte :', txt); } };
  $('#apl').onclick = async () => { try { await save(); } catch (er) { return toast('Erreur : ' + (er.message || er)); }
    const r = row(); form(null, { ctx: '💼 Affaire ' + a.ref, pre: { client: r.client, occupant: r.contact, tel: r.tel, adresse: r.adresse, cp: r.cp, ville: r.ville || 'Istres', travaux: (r.statut === 'a_chiffrer' || r.statut === 'visite' ? 'Visite / relevé pour devis : ' : '') + r.objet, affaire_id: a.id, demande_id: a.demande_id || null } }); };
  if ($('#ach')) $('#ach').onclick = async () => { try { await save(); } catch (er) { return toast('Erreur : ' + (er.message || er)); }
    if (ch.length) { await go('chantiers'); const c = chantiers.find(x => x.id === ch[0].id); if (c) chantierForm(c); return; }
    const r = row(); chantierForm(null, { pre: { nom: r.objet, client: r.client, tel: r.tel, adresse: r.adresse, cp: r.cp, ville: r.ville, affaire_id: a.id, notes: r.lignes.map(x => '• ' + x.d + (x.q !== 1 ? ' × ' + x.q + ' ' + x.u : '')).join('\n') } }); };
  $('#adl').onclick = async () => { if (!confirm('Supprimer définitivement l’affaire ' + a.ref + ' ?')) return; const { error } = await sb.from('affaires').delete().eq('id', a.id); if (error) return toast('Erreur : ' + error.message); closePanel(); await loadAffaires(); listAffaires(); toast('Affaire supprimée'); };
}
function exportIsanet() {
  const it = affaires.filter(a => a.statut === 'accepte');
  if (!it.length) return toast('Aucune affaire acceptée à facturer');
  const c = v => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }, n = v => (+v || 0).toFixed(2).replace('.', ',');
  const rows = [['Ref BK+', 'Client', 'Contact', 'Telephone', 'E-mail', 'Adresse', 'Code postal', 'Ville', 'Objet', 'N devis Isanet', 'Designation', 'Quantite', 'Unite', 'PU HT', 'Total HT', 'TVA %']];
  it.forEach(a => (a.lignes.length ? a.lignes : [{ d: a.objet, q: 1, u: 'forfait', pu: a.montant_ht }]).forEach(x => rows.push([a.ref, a.client, a.contact, a.tel, a.email, a.adresse, a.cp, a.ville, a.objet, a.isanet_devis, x.d, n(x.q), x.u, n(x.pu), n(x.q * x.pu), n(a.tva)])));
  const blob = new Blob(['﻿' + rows.map(r => r.map(c).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'BK-pret-a-facturer-' + iso(new Date()) + '.csv'; document.body.appendChild(l); l.click(); l.remove();
  toast(it.length + ' affaire(s) exportée(s) pour Isanet Fact');
}

/* ================= Chantiers ================= */
async function loadChantiers() {
  const { data, error } = await sb.from('chantiers').select('*, interventions(id,date,statut,intervention_techs(tech_id))').order('debut', { ascending: true, nullsFirst: false });
  if (error) return toast('Erreur : ' + error.message); chantiers = data || [];
}
function listChantiers() {
  if (view !== 'chantiers') return;
  const t = iso(new Date());
  const it = chantiers.filter(c => filtreC === 'tous' || (filtreC === 'actifs' ? c.statut !== 'termine' : c.statut === 'termine'));
  $('#main').innerHTML = `<div class="head"><h1>Chantiers en cours</h1><span class="live"><i></i>En direct</span>
    <div class="seg">${[['actifs', 'En cours / à venir'], ['termine', 'Terminés'], ['tous', 'Tous']].map(([k, l]) => `<button data-fc="${k}" class="${filtreC === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn btn-grad" id="nc">+ Nouveau chantier</button></div>
  ${it.length ? `<div class="chs">${it.map(c => { const tids = [...new Set(c.interventions.flatMap(i => i.intervention_techs.map(x => x.tech_id)))];
    const next = c.interventions.filter(i => i.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
    const late = c.statut !== 'termine' && c.fin_prevue && c.fin_prevue < t;
    return `<button class="ch" data-c="${c.id}"><div class="top"><span class="tag ${ST_C[c.statut][1]}" style="margin:0">${ST_C[c.statut][0]}</span>${late ? '<span class="tag t-urg">En retard</span>' : ''}</div>
      <h3>${E(c.nom)}</h3><p>${E(c.client || '')}${c.ville ? ' · ' + E(c.ville) : ''}</p>
      <div class="pg"><i style="width:${c.avancement}%"></i></div><div class="pgl"><b>${c.avancement} %</b><span>${c.debut ? dfr(c.debut) : '?'} → ${c.fin_prevue ? dfr(c.fin_prevue) : '?'}</span></div>
      <div class="ft"><span class="avs">${avatars(tids)}</span><span>${c.interventions.length} journée${c.interventions.length > 1 ? 's' : ''} planifiée${c.interventions.length > 1 ? 's' : ''}${next ? ' · prochaine ' + dfr(next.date) : ''}</span></div></button>`; }).join('')}</div>`
    : `<div class="empty">Aucun chantier ici. Créez-en un, ou depuis une affaire acceptée : « 🏗 Créer le chantier ».</div>`}`;
  document.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { filtreC = b.dataset.fc; listChantiers(); });
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => chantierForm(chantiers.find(c => c.id === b.dataset.c)));
  $('#nc').onclick = () => chantierForm(null);
}
async function chantierForm(c, opts) {
  opts = opts || {}; const isNew = !c;
  c = c || { nom: '', client: '', tel: '', adresse: '', cp: '', ville: 'Istres', debut: iso(new Date()), fin_prevue: '', statut: 'preparation', avancement: 0, notes: '', affaire_id: null, interventions: [], ...(opts.pre || {}) };
  const [{ data: jr }, { data: its }, { data: af }] = isNew ? [{ data: [] }, { data: [] }, { data: null }] : await Promise.all([
    sb.from('chantier_journal').select('*').eq('chantier_id', c.id).order('created_at', { ascending: false }),
    sb.from('interventions').select('id,date,heure,epingle,statut,travaux,commentaire,intervention_techs(tech_id)').eq('chantier_id', c.id).order('date'),
    c.affaire_id ? sb.from('affaires').select('id,ref,montant_ht,statut').eq('id', c.affaire_id).maybeSingle() : Promise.resolve({ data: null })]);
  openPanel(`<header><div>${isNew ? '' : `<span class="tag ${ST_C[c.statut][1]}" style="margin:0">${ST_C[c.statut][0]}</span>`}<h2 style="margin-top:6px">${isNew ? 'Nouveau chantier' : '🏗 ' + E(c.nom)}</h2>${af ? `<div style="color:var(--mute);font-size:13px">💼 Affaire ${E(af.ref)} · ${eur(af.montant_ht)} HT</div>` : ''}</div><button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="cf"><div class="form">
    <label class="full">Nom du chantier *<input name="nom" value="${E(c.nom)}" required placeholder="Ex. : Rénovation salle de bain Mme Martin"></label>
    <label>Client<input name="client" value="${E(c.client)}"></label><label>Téléphone<input name="tel" type="tel" value="${E(c.tel)}"></label>
    <label class="full">Adresse<input name="adresse" value="${E(c.adresse)}"></label>
    <label>Code postal<input name="cp" value="${E(c.cp)}" maxlength="5" inputmode="numeric"></label><label>Ville<input name="ville" value="${E(c.ville)}"></label>
    <label>Début<input type="date" name="debut" value="${c.debut || ''}"></label><label>Fin prévue<input type="date" name="fin_prevue" value="${c.fin_prevue || ''}"></label>
    <label>Statut<select name="statut">${Object.entries(ST_C).map(([k, v]) => `<option value="${k}" ${k === c.statut ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
    <label>Avancement : <span id="avl">${c.avancement} %</span><input type="range" name="avancement" min="0" max="100" step="5" value="${c.avancement}"></label>
    <label class="full">Notes (matériel, étapes, accès…)<textarea name="notes">${E(c.notes)}</textarea></label>
    ${isNew ? '' : `<div class="full box"><h4>🗓 Journées planifiées (${its.length})</h4>${its.length ? its.map(i => `<div class="jl"><b>${lbl(i.date)}</b>${i.epingle ? '' : ' ' + hh(i.heure)} · ${E(names(i.intervention_techs.map(x => x.tech_id)))} <span class="tag s-${i.statut}">${STAT_I[i.statut]}</span>${i.commentaire ? `<div class="jc">« ${E(i.commentaire)} »</div>` : ''}</div>`).join('') : '<span style="color:var(--mute)">Aucune pour l’instant.</span>'}
      <button type="button" class="btn btn-line" id="cpl" style="margin-top:10px">🗓 Planifier une journée</button></div>
    <div class="full box"><h4>📓 Journal de chantier</h4><div style="display:flex;gap:8px"><input id="jt" placeholder="Ex. : Placo posé, carreleur jeudi" style="flex:1;border:2px solid var(--line);border-radius:10px;padding:10px 12px"><button type="button" class="btn btn-grad" id="ja">Ajouter</button></div>
      <div id="jl">${jr.map(j => `<div class="jr"><small>${fdate(j.created_at)} · ${E(j.auteur || '')}</small>${E(j.texte)}</div>`).join('')}</div></div>`}
  </div></form>
  <footer><button class="btn btn-grad" form="cf" type="submit" id="csv">${isNew ? 'Créer le chantier' : 'Enregistrer'}</button>${isNew ? '' : '<button class="btn btn-red" id="cdl" style="margin-left:auto">Supprimer</button>'}</footer>`);
  const f = $('#cf');
  f.avancement.oninput = () => { $('#avl').textContent = f.avancement.value + ' %'; };
  const row = () => { const fd = new FormData(f), o = {}; ['nom', 'client', 'tel', 'adresse', 'cp', 'ville', 'statut', 'notes'].forEach(k => o[k] = String(fd.get(k) || '').trim());
    o.debut = fd.get('debut') || null; o.fin_prevue = fd.get('fin_prevue') || null; o.avancement = +fd.get('avancement') || 0; if (o.statut === 'termine') o.avancement = 100; o.affaire_id = c.affaire_id || null; return o; };
  const save = async () => { const r = row(); const res = isNew ? await sb.from('chantiers').insert(r).select().single() : await sb.from('chantiers').update(r).eq('id', c.id).select().single(); if (res.error) throw res.error; return res.data; };
  f.onsubmit = async e => { e.preventDefault(); const b = $('#csv'); b.disabled = true;
    try { const d = await save(); closePanel(); await loadChantiers(); if (view === 'chantiers') listChantiers(); else await go('chantiers'); toast(isNew ? 'Chantier créé : planifiez ses journées' : 'Chantier enregistré'); if (isNew) chantierForm(chantiers.find(x => x.id === d.id)); }
    catch (er) { b.disabled = false; toast('Erreur : ' + (er.message || er)); } };
  if (isNew) return;
  $('#cpl').onclick = async () => { try { await save(); } catch (er) { return toast('Erreur : ' + (er.message || er)); }
    const r = row(), last = its[its.length - 1], lastT = last ? last.intervention_techs.map(x => x.tech_id) : [];
    const d = r.debut && r.debut > iso(new Date()) ? r.debut : iso(new Date());
    form(null, { ctx: '🏗 Chantier ' + r.nom, pre: { date: d, heure: '07:30', duree: 8, client: r.client, tel: r.tel, adresse: r.adresse, cp: r.cp, ville: r.ville, travaux: 'Chantier : ' + r.nom, techs: lastT, chantier_id: c.id, affaire_id: r.affaire_id } }); };
  $('#ja').onclick = async () => { const t = $('#jt').value.trim(); if (!t) return; const { data, error } = await sb.from('chantier_journal').insert({ chantier_id: c.id, texte: t, auteur: me.nom }).select().single(); if (error) return toast('Erreur : ' + error.message);
    $('#jl').insertAdjacentHTML('afterbegin', `<div class="jr"><small>${fdate(data.created_at)} · ${E(data.auteur)}</small>${E(data.texte)}</div>`); $('#jt').value = ''; };
  $('#jt').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#ja').click(); } };
  $('#cdl').onclick = async () => { if (!confirm('Supprimer le chantier « ' + c.nom + ' » ? Les journées planifiées restent au planning.')) return; const { error } = await sb.from('chantiers').delete().eq('id', c.id); if (error) return toast('Erreur : ' + error.message); closePanel(); await loadChantiers(); listChantiers(); toast('Chantier supprimé'); };
}
