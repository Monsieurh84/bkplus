/* BK+ — application bureau (Supabase) */
const C = window.BK_CONFIG, sb = supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = s => document.querySelector(s), root = $('#root');
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const JOURS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const lbl = (s, long) => { const d = new Date(s + 'T12:00'); return long ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : JOURS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + d.toLocaleDateString('fr-FR', { month: 'short' }); };
const hh = t => t ? t.slice(0, 5).replace(':', 'h') : '';
const fin = (t, dur) => { if (!t) return ''; const [h, m] = t.split(':').map(Number), x = h * 60 + m + Math.round((+dur || 1) * 60); return pad(Math.floor(x / 60) % 24) + 'h' + pad(x % 60); };
const fdate = d => new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 3000); }

const STAT_D = { nouvelle: ['Nouvelle', 't-new'], affaire: ['En affaire', 't-aff'], planifiee: ['Planifiée', 't-pla'], archivee: ['Archivée', 't-arc'] };
const STAT_I = { planifiee: 'Planifiée', enroute: 'En route', encours: 'En cours', controle: 'À contrôler', cloturee: 'Clôturée' };
const SC = { planifiee: '#2239A9', enroute: '#6D28D9', encours: '#B45309', controle: '#C2410C', cloturee: '#0E9F6E' };

let me = null, view = 'planning', techs = [], demandes = [], filtre = 'nouvelle', chan = null;
let mode = 'semaine', week = monday(new Date()), day = iso(new Date()), inter = [], absences = [];
const T = id => techs.find(t => t.id === id) || { nom: '?', couleur: '#8B8FA3' };
const stripe = ids => { const c = ids.map(id => T(id).couleur); if (c.length < 2) return c[0] || '#8B8FA3'; const s = 100 / c.length; return 'linear-gradient(to bottom,' + c.map((x, k) => `${x} ${k * s}% ${(k + 1) * s}%`).join(',') + ')'; };
const avatars = ids => ids.map(id => `<span class="av" style="background:${T(id).couleur}" title="${E(T(id).nom)}">${E(T(id).nom[0])}</span>`).join('');
const names = ids => ids.map(id => T(id).nom).join(' + ');

/* ================= Connexion ================= */
function loginView(msg) {
  root.innerHTML = `<div class="login"><form id="lf" autocomplete="on"><img src="../logo-bk.png" alt="BK+"><h1>Connexion</h1><p>Application BK+ · accès réservé à l’équipe.</p>
  <label for="em">E-mail</label><input id="em" type="email" autocomplete="username" required>
  <label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required>
  <button class="btn btn-grad" type="submit">Se connecter</button><button class="link" type="button" id="fg">Mot de passe oublié ?</button>
  <div class="msg ${msg ? 'err on' : ''}" id="m">${msg ? E(msg) : ''}</div></form></div>`;
  $('#lf').onsubmit = async e => { e.preventDefault(); const b = e.submitter; b.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    b.disabled = false; if (error) { const m = $('#m'); m.className = 'msg err on'; m.textContent = 'E-mail ou mot de passe incorrect.'; } };
  $('#fg').onclick = async () => { const em = $('#em').value.trim(), m = $('#m'); if (!em) { m.className = 'msg err on'; m.textContent = 'Indiquez d’abord votre e-mail.'; return; }
    await sb.auth.resetPasswordForEmail(em, { redirectTo: location.href.split('#')[0] }); m.className = 'msg ok on'; m.textContent = 'Si ce compte existe, un e-mail de réinitialisation vient d’être envoyé.'; };
}
function newPasswordView() {
  root.innerHTML = `<div class="login"><form id="np"><img src="../logo-bk.png" alt="BK+"><h1>Nouveau mot de passe</h1><p>Au moins 10 caractères.</p>
  <label for="pw">Nouveau mot de passe</label><input id="pw" type="password" autocomplete="new-password" minlength="10" required>
  <button class="btn btn-grad" type="submit">Enregistrer</button><div class="msg" id="m"></div></form></div>`;
  $('#np').onsubmit = async e => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: $('#pw').value }); const m = $('#m');
    if (error) { m.className = 'msg err on'; m.textContent = 'Impossible : ' + error.message; } else { history.replaceState(null, '', location.pathname); start(); } };
}

/* ================= Démarrage ================= */
let started = false;
async function start() {
  if (started) return; started = true;
  const { data: { session } } = await sb.auth.getSession(); if (!session) { started = false; return loginView(); }
  const { data: p } = await sb.from('profils').select('*').eq('id', session.user.id).maybeSingle();
  if (!p || p.role !== 'bureau' || !p.actif) { started = false; root.innerHTML = `<div class="login"><form><img src="../logo-bk.png" alt=""><h1>Accès non activé</h1><p>Votre compte (${E(session.user.email)}) n’a pas encore d’accès bureau.</p><button class="btn btn-line" type="button" id="out">Se déconnecter</button></form></div>`; $('#out').onclick = () => sb.auth.signOut(); return; }
  me = p; shell();
  const r = await sb.from('techniciens').select('*').eq('actif', true).order('ordre'); techs = r.data || [];
  await Promise.all([loadDemandes(), loadAffaires()]); const h = location.hash.slice(1); view = ['planning', 'demandes', 'controle', 'affaires', 'chantiers'].includes(h) ? h : 'planning';
  await go(view); listen(); badgeC();
}
function shell() {
  root.innerHTML = `<div class="app"><aside class="side"><div class="brand"><img src="../logo-bk.png" alt=""><div><b>BK+</b><small>Application</small></div></div>
  <button class="nav" data-v="planning">🗓 Planning</button>
  <button class="nav" data-v="demandes">📥 Demandes du site<span class="c" id="cn"></span></button>
  <button class="nav" data-v="affaires">💼 Affaires<span class="c" id="ca"></span></button><button class="nav" data-v="chantiers">🏗 Chantiers</button><button class="nav" data-v="controle">✅ À contrôler<span class="c" id="cc"></span></button>
  <a class="nav" href="tech.html" target="_blank" rel="noopener" style="text-decoration:none">📱 App technicien<small>aperçu</small></a>
  <div class="who"><b>${E(me.nom)}</b>Accès bureau<br><button id="out">Se déconnecter</button></div></aside><main class="main" id="main"><div class="loading">Chargement…</div></main></div>`;
  $('#out').onclick = () => sb.auth.signOut();
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
}
async function go(v) {
  view = v; history.replaceState(null, '', '#' + v);
  document.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'planning') { await loadPlanning(); planning(); } else if (v === 'controle') await listControle(); else if (v === 'affaires') { await loadAffaires(); listAffaires(); } else if (v === 'chantiers') { await loadChantiers(); listChantiers(); } else listDemandes();
}
function listen() {
  if (chan) sb.removeChannel(chan);
  let tm = null; const refresh = () => { clearTimeout(tm); tm = setTimeout(async () => { badgeC(); if (view === 'planning') { await loadPlanning(); planning(); } else if (view === 'controle') await listControle(); else if (view === 'chantiers') { await loadChantiers(); listChantiers(); } }, 400); };
  chan = sb.channel('bk').on('postgres_changes', { event: '*', schema: 'public', table: 'demandes' }, p => {
    if (p.eventType === 'INSERT') { demandes.unshift(p.new); toast('📥 Nouvelle demande : ' + p.new.service + ' · ' + p.new.ville); }
    else if (p.eventType === 'UPDATE') { const i = demandes.findIndex(x => x.id === p.new.id); if (i > -1) demandes[i] = p.new; }
    badge(); if (view === 'demandes') listDemandes();
  }).on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'intervention_techs' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'affaires' }, () => { clearTimeout(listen.ta); listen.ta = setTimeout(async () => { await loadAffaires(); listAffaires(); }, 400); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chantiers' }, () => { clearTimeout(listen.tc); listen.tc = setTimeout(async () => { if (view === 'chantiers') { await loadChantiers(); listChantiers(); } }, 400); }).subscribe();
}

/* ================= Planning ================= */
function range() { return mode === 'semaine' ? [iso(week), iso(addDays(week, 5))] : [day, day]; }
async function loadPlanning() {
  const [a, b] = range();
  const [r1, r2] = await Promise.all([
    sb.from('interventions').select('*, intervention_techs(tech_id), pieces(id)').gte('date', a).lte('date', b),
    sb.from('absences').select('*').gte('date', a).lte('date', b)]);
  if (r1.error) return toast('Erreur : ' + r1.error.message);
  inter = (r1.data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id), nbPieces: i.pieces.length }));
  absences = r2.data || [];
}
const sortI = (a, b) => (b.epingle - a.epingle) || (a.heure || '').localeCompare(b.heure || '');
function card(i, techId) {
  const team = i.techs.length > 1;
  const ico = (i.demande_id ? '<span title="Demande du site (photos)">📷</span>' : '') + (i.nbPieces ? '<span title="Pièces jointes">📎</span>' : '') + (i.materiel.length ? '<span title="Matériel">🧰</span>' : '') + (i.recurrent ? '<span title="Récurrente">↻</span>' : '') + (i.chantier_id ? '<span title="Chantier">🏗</span>' : '') + (i.affaire_id && !i.chantier_id ? '<span title="Affaire">💼</span>' : '');
  return `<button class="card ${i.epingle ? 'pin' : ''} ${i.type === 'interne' ? 'interne' : ''} ${i.statut === 'cloturee' ? 'cl' : ''}" draggable="true" data-id="${i.id}" data-tech="${techId}" style="--stripe:${stripe(i.techs)};--sc:${SC[i.statut]}">
    <div class="t"><span class="dot" title="${STAT_I[i.statut]}"></span>${i.epingle ? '📌 Dans la journée' : hh(i.heure) + '–' + fin(i.heure, i.duree)}<span class="ico">${ico}</span></div>
    <div class="a">${E(i.epingle || i.type !== 'intervention' ? i.travaux : i.ville)}</div>${!i.epingle && i.type === 'intervention' ? `<div class="g">${E(i.client || i.occupant || '')}</div>` : ''}
    ${team ? `<div class="team"><span class="avs">${avatars(i.techs)}</span>${i.techs.length > 2 ? i.techs.length + ' techniciens' : E(names(i.techs))}</div>` : ''}</button>`;
}
function planning() {
  if (view !== 'planning') return;
  const today = iso(new Date()), days = [...Array(6)].map((_, k) => iso(addDays(week, k)));
  const title = mode === 'semaine' ? `Semaine du ${lbl(days[0])}` : lbl(day, true);
  let h = `<div class="head"><h1>Planning</h1><span class="live"><i></i>En direct</span>
   <div class="weeknav"><button id="prev" aria-label="Précédent">‹</button><span>${E(title)}</span><button id="next" aria-label="Suivant">›</button><button class="today" id="tod">Aujourd’hui</button></div>
   <div class="seg"><button data-m="jour" class="${mode === 'jour' ? 'on' : ''}">Jour</button><button data-m="semaine" class="${mode === 'semaine' ? 'on' : ''}">Semaine</button></div>
   <button class="btn btn-line" id="npin">📌 Tâche du jour</button><button class="btn btn-grad" id="nnew">+ Intervention</button></div>
   <div class="legend">${techs.map(t => `<span><i style="background:${t.couleur}"></i>${E(t.nom)}</span>`).join('')}<span>▌▌ équipe = une bande par technicien</span><span>📷 demande du site</span><span>📎 pièces jointes</span><span>🧰 matériel</span></div>`;
  if (!techs.length) h += `<div class="empty">Aucun technicien enregistré.</div>`;
  else if (mode === 'semaine') {
    h += `<div class="grid"><div class="gh"></div>${days.map(d => `<div class="gh ${d === today ? 'today' : ''}">${d === today ? '<span>' + lbl(d) + '</span>' : lbl(d)}</div>`).join('')}`;
    techs.forEach(t => {
      h += `<div class="tn"><b><i style="background:${t.couleur}"></i>${E(t.nom)}</b><small>${E(t.fonction)}</small><button data-abs="${t.id}">+ absence</button></div>`;
      days.forEach(d => {
        const ab = absences.find(a => a.tech_id === t.id && a.date === d);
        const it = inter.filter(i => i.date === d && i.techs.includes(t.id)).sort(sortI);
        h += `<div class="cell ${d === today ? 'today' : ''} ${ab ? 'abs' : ''}" data-date="${d}" data-tech="${t.id}">${ab ? `<div class="abs-l">🌴 ${E(ab.motif)}<button data-delabs="${ab.id}" aria-label="Retirer l’absence">×</button></div>` : ''}${it.map(i => card(i, t.id)).join('')}</div>`;
      });
    });
    h += `</div>`;
  } else {
    h += `<div class="dayv">${techs.map(t => { const ab = absences.find(a => a.tech_id === t.id && a.date === day); const it = inter.filter(i => i.date === day && i.techs.includes(t.id)).sort(sortI);
      return `<div class="dcol cell" data-date="${day}" data-tech="${t.id}"><h3><i style="background:${t.couleur}"></i>${E(t.nom)}</h3>${ab ? `<div class="abs-l">🌴 ${E(ab.motif)}</div>` : ''}${it.map(i => card(i, t.id)).join('') || (ab ? '' : '<div style="color:var(--mute);font-size:13px;padding:6px">Disponible</div>')}</div>`; }).join('')}</div>`;
  }
  $('#main').innerHTML = h;
  const nav = async n => { if (mode === 'semaine') week = addDays(week, 7 * n); else day = iso(addDays(new Date(day + 'T12:00'), n)); await loadPlanning(); planning(); };
  $('#prev').onclick = () => nav(-1); $('#next').onclick = () => nav(1);
  $('#tod').onclick = async () => { week = monday(new Date()); day = iso(new Date()); await loadPlanning(); planning(); };
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => { mode = b.dataset.m; if (mode === 'jour' && (day < iso(week) || day > iso(addDays(week, 6)))) day = iso(week); await loadPlanning(); planning(); });
  $('#nnew').onclick = () => form(); $('#npin').onclick = () => form(null, { epingle: true });
  document.querySelectorAll('[data-abs]').forEach(b => b.onclick = () => absenceForm(b.dataset.abs));
  document.querySelectorAll('[data-delabs]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (!confirm('Retirer cette absence ?')) return; await sb.from('absences').delete().eq('id', b.dataset.delabs); await loadPlanning(); planning(); });
  bindDnD();
}
function bindDnD() {
  document.querySelectorAll('.card').forEach(c => {
    c.onclick = () => detail(c.dataset.id);
    c.ondragstart = e => { c.classList.add('dragging'); e.dataTransfer.setData('text/plain', c.dataset.id + '|' + c.dataset.tech); };
    c.ondragend = () => c.classList.remove('dragging');
  });
  document.querySelectorAll('.cell').forEach(cell => {
    cell.ondragover = e => { e.preventDefault(); cell.classList.add('over'); };
    cell.ondragleave = () => cell.classList.remove('over');
    cell.ondrop = async e => {
      e.preventDefault(); cell.classList.remove('over');
      const [id, from] = e.dataTransfer.getData('text/plain').split('|'), to = cell.dataset.tech, d = cell.dataset.date, i = inter.find(x => x.id === id); if (!i) return;
      if (absences.find(a => a.tech_id === to && a.date === d)) return toast(T(to).nom + ' est absent ce jour-là');
      const ops = [];
      if (i.date !== d) ops.push(sb.from('interventions').update({ date: d }).eq('id', id));
      if (from !== to && !i.techs.includes(to)) { ops.push(sb.from('intervention_techs').delete().match({ intervention_id: id, tech_id: from })); ops.push(sb.from('intervention_techs').insert({ intervention_id: id, tech_id: to })); }
      else if (from !== to) ops.push(sb.from('intervention_techs').delete().match({ intervention_id: id, tech_id: from }));
      const res = await Promise.all(ops); const er = res.find(r => r.error); if (er) return toast('Erreur : ' + er.error.message);
      await loadPlanning(); planning(); toast('Reprogrammée : ' + lbl(d) + ' · ' + names(inter.find(x => x.id === id)?.techs || []));
    };
  });
}

/* ================= Panneau ================= */
function openPanel(html) { const P = $('#panel'); P.innerHTML = html; P.classList.add('on'); P.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on'); P.querySelector('.x').onclick = closePanel; }
function closePanel() { const P = $('#panel'); P.classList.remove('on'); P.setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }
$('#scrim').onclick = closePanel; document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
const kindOf = f => f.type.startsWith('image/') ? 'photo' : f.type.startsWith('video/') ? 'video' : f.type === 'application/pdf' ? 'pdf' : 'autre';
async function signed(bucket, paths) { if (!paths.length) return {}; const { data } = await sb.storage.from(bucket).createSignedUrls(paths, 3600); const o = {}; (data || []).forEach(u => o[u.path] = u.signedUrl); return o; }

async function detail(id, given) {
  const i = given || inter.find(x => x.id === id); if (!i) return;
  const [{ data: pieces }, dem] = await Promise.all([sb.from('pieces').select('*').eq('intervention_id', id).order('created_at'), i.demande_id ? sb.from('demandes').select('*').eq('id', i.demande_id).maybeSingle() : Promise.resolve({ data: null })]);
  const d = dem.data;
  openPanel(`<header><div><span class="tag s-${i.statut}" style="margin:0">${STAT_I[i.statut]}</span>${i.epingle ? '<span class="tag t-aff">📌 Dans la journée</span>' : ''}<h2 style="margin-top:8px">${E(i.type === 'intervention' ? (i.adresse || i.ville || 'Intervention') : i.travaux)}</h2>
    <div style="color:var(--mute);font-size:13.5px">${E(i.ville || '')} · ${lbl(i.date, true)}${i.epingle ? '' : ' · ' + hh(i.heure) + '–' + fin(i.heure, i.duree)}</div></div><button class="x" aria-label="Fermer">×</button></header>
  <div class="body">
    <div class="chips">${i.techs.map(t => `<span><i style="background:${T(t).couleur}"></i>${E(T(t).nom)}</span>`).join('')}${i.recurrent ? '<span>↻ Récurrente</span>' : ''}</div>
    ${i.type === 'intervention' ? `<dl class="kv"><dt>Client</dt><dd>${E(i.client || '—')}</dd><dt>Occupant</dt><dd>${E(i.occupant || '—')}</dd><dt>Téléphone</dt><dd>${i.tel ? `<a href="tel:${E(i.tel.replace(/\s/g, ''))}">${E(i.tel)}</a>` : '—'}</dd><dt>Adresse</dt><dd>${E([i.adresse, [i.cp, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—')}</dd></dl>` : ''}
    <div class="box"><h4>Travaux à effectuer</h4>${E(i.travaux || '—')}</div>
    ${i.materiel.length ? `<div class="box"><h4>🧰 Matériel nécessaire</h4><ul class="mat">${i.materiel.map(m => `<li>${E(m)}</li>`).join('')}</ul></div>` : ''}
    ${(pieces || []).length ? `<div class="box"><h4>📎 Pièces jointes pour le technicien</h4><div class="ph" id="pj">${pieces.map(p => `<a target="_blank" rel="noopener" data-p="${E(p.path)}">${p.type === 'photo' ? '<img alt="">' : `<span class="ic">${p.type === 'video' ? '🎬' : '📄'}</span>`}${E(p.nom)}</a>`).join('')}</div></div>` : ''}
    ${d ? `<div class="box"><h4>📷 Demande du site ${E(d.ref)}</h4><div style="margin-bottom:8px">${E(d.message || '')}</div><div class="ph" id="dph">${d.photos.map(p => `<a target="_blank" rel="noopener" data-dp="${E(p.path)}"><img alt="">${E(p.label)}</a>`).join('')}</div></div>` : ''}
    ${i.commentaire || (i.photos || []).length ? `<div class="box" style="border-color:#BFE8D6;background:#F3FBF7"><h4>✅ Retour du technicien${i.fin_at ? ' · ' + fdate(i.fin_at) : ''}</h4>${E(i.commentaire || '')}${(i.photos || []).length ? `<div class="ph" id="rph" style="margin-top:10px">${i.photos.map(p => `<a target="_blank" rel="noopener" data-rp="${E(p.path)}"><img alt="">${E(p.tag || 'Photo')}</a>`).join('')}</div>` : ''}</div>` : ''}
    <label style="font-size:13px;font-weight:800;color:var(--mute)">Statut<select id="st" style="display:block;width:100%;margin-top:6px;border:2px solid var(--line);border-radius:10px;padding:10px">${Object.entries(STAT_I).map(([k, v]) => `<option value="${k}" ${k === i.statut ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  </div>
  <footer>${i.statut === 'controle' ? '<button class="btn btn-grad" id="clo" style="background:var(--ok,#0E9F6E)">✓ Clôturer</button>' : ''}<button class="btn ${i.statut === 'controle' ? 'btn-line' : 'btn-grad'}" id="ed">Modifier</button><button class="btn btn-line" id="p7">+7 jours</button><button class="btn btn-red" id="del" style="margin-left:auto">Supprimer</button></footer>`);
  const urls = await signed('pieces', (pieces || []).map(p => p.path));
  document.querySelectorAll('#pj [data-p]').forEach(a => { const u = urls[a.dataset.p]; if (u) { a.href = u; const im = a.querySelector('img'); if (im) im.src = u; } });
  if (d) { const u2 = await signed('demandes', d.photos.map(p => p.path)); document.querySelectorAll('#dph [data-dp]').forEach(a => { const u = u2[a.dataset.dp]; if (u) { a.href = u; a.querySelector('img').src = u; } }); }
  if ((i.photos || []).length) signed('retours', i.photos.map(p => p.path)).then(u3 => document.querySelectorAll('#rph [data-rp]').forEach(a => { const u = u3[a.dataset.rp]; if (u) { a.href = u; a.querySelector('img').src = u; } }));
  if ($('#clo')) $('#clo').onclick = () => cloturer(id);
  $('#st').onchange = async e => { const { error } = await sb.from('interventions').update({ statut: e.target.value }).eq('id', id); if (error) return toast('Erreur : ' + error.message); await refreshView(); toast('Statut mis à jour'); };
  $('#ed').onclick = () => form(i);
  $('#p7').onclick = async () => { await sb.from('interventions').update({ date: iso(addDays(new Date(i.date + 'T12:00'), 7)) }).eq('id', id); closePanel(); await refreshView(); toast('Reprogrammée la semaine suivante'); };
  $('#del').onclick = async () => { if (!confirm('Supprimer définitivement cette intervention ?')) return; if ((pieces || []).length) await sb.storage.from('pieces').remove(pieces.map(p => p.path)); if ((i.photos || []).length) await sb.storage.from('retours').remove(i.photos.map(p => p.path)); const { error } = await sb.from('interventions').delete().eq('id', id); if (error) return toast('Erreur : ' + error.message); closePanel(); await refreshView(); toast('Intervention supprimée'); };
}

/* ================= Formulaire intervention ================= */
async function form(i, opts) {
  opts = opts || {}; const isNew = !i;
  i = i || { type: opts.epingle ? 'tache' : 'intervention', date: mode === 'jour' ? day : iso(new Date()), heure: '09:00', duree: 2, epingle: !!opts.epingle, statut: 'planifiee', client: '', occupant: '', tel: '', adresse: '', cp: '', ville: 'Istres', travaux: '', materiel: [], recurrent: false, techs: [], demande_id: null, ...(opts.pre || {}) };
  let existing = []; if (!isNew) { const { data } = await sb.from('pieces').select('*').eq('intervention_id', i.id); existing = data || []; }
  let added = [], removed = [];
  openPanel(`<header><h2>${isNew ? (i.epingle ? '📌 Tâche à faire dans la journée' : 'Nouvelle intervention') : 'Modifier'}</h2><button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="f"><div class="form">
    ${opts.ctx ? `<div class="full box" style="background:var(--soft);border:0"><b>${E(opts.ctx)}</b> · cette journée y sera rattachée.</div>` : ''}
    ${opts.demande ? `<div class="full box" style="background:var(--soft);border:0"><b>📷 Depuis la demande ${E(opts.demande.ref)}</b> · ${E(opts.demande.service)}. Ses photos seront visibles par le technicien.</div>` : ''}
    <label>Type<select name="type"><option value="intervention">Intervention</option><option value="tache" ${i.type === 'tache' ? 'selected' : ''}>Tâche (matériel, déchetterie…)</option><option value="interne" ${i.type === 'interne' ? 'selected' : ''}>Interne (réunion…)</option></select></label>
    <label>Date<input type="date" name="date" value="${i.date}" required></label>
    <label class="full inline pinbox"><input type="checkbox" name="epingle" ${i.epingle ? 'checked' : ''}> 📌 À faire dans la journée, sans heure précise (rappel au technicien avant la fin de journée)</label>
    <label class="hr">Heure<input type="time" name="heure" value="${(i.heure || '09:00').slice(0, 5)}" step="900"></label>
    <label class="hr">Durée (heures)<input type="number" name="duree" value="${i.duree}" min="0.5" step="0.5"></label>
    <div class="full"><div style="font-size:13px;font-weight:800;color:var(--mute);margin-bottom:6px">Technicien(s) · plusieurs = équipe</div><div class="checks">${techs.map(t => `<label><input type="checkbox" name="techs" value="${t.id}" ${i.techs.includes(t.id) ? 'checked' : ''}><i style="width:10px;height:10px;border-radius:50%;background:${t.couleur};display:inline-block"></i>${E(t.nom)}</label>`).join('')}</div></div>
    <label class="full">Travaux à effectuer<textarea name="travaux" required>${E(i.travaux)}</textarea></label>
    <label class="full">Adresse<input name="adresse" value="${E(i.adresse)}" autocomplete="off"></label>
    <label>Code postal<input name="cp" value="${E(i.cp)}" inputmode="numeric" maxlength="5"></label>
    <label>Ville<input name="ville" value="${E(i.ville)}" list="villes"></label>
    <label>Client (agence, syndic, particulier)<input name="client" value="${E(i.client)}"></label>
    <label>Occupant<input name="occupant" value="${E(i.occupant)}"></label>
    <label class="full">Téléphone de l’occupant<input name="tel" type="tel" value="${E(i.tel)}"></label>
    <label class="full">🧰 Matériel nécessaire <span style="font-weight:600">(une ligne par élément)</span><textarea name="materiel" placeholder="Ex. : Siphon PVC Ø40&#10;Flexible inox 50 cm">${E(i.materiel.join('\n'))}</textarea></label>
    <div class="full"><div style="font-size:13px;font-weight:800;color:var(--mute);margin-bottom:6px">📎 Pièces jointes pour le technicien <span style="font-weight:600">(photos, vidéos, PDF · facultatif)</span></div><div class="ph" id="pjl"></div><label class="btn btn-line" style="margin-top:8px;width:max-content">+ Ajouter des fichiers<input type="file" id="pjin" multiple accept="image/*,video/*,application/pdf" class="sr"></label></div>
    <label class="full inline"><input type="checkbox" name="recurrent" ${i.recurrent ? 'checked' : ''}> Intervention récurrente (contrat d’entretien)</label>
  </div><datalist id="villes">${['Istres', 'Miramas', 'Martigues', 'Fos-sur-Mer', 'Port-de-Bouc', 'Saint-Chamas', 'Cornillon-Confoux', 'Grans', 'Salon-de-Provence', 'Vitrolles', 'Marignane', 'Sausset-les-Pins', 'Port-Saint-Louis-du-Rhône', 'Aix-en-Provence', 'Marseille'].map(v => `<option value="${v}">`).join('')}</datalist></form>
  <footer><button class="btn btn-grad" form="f" type="submit" id="sv">${isNew ? 'Planifier' : 'Enregistrer'}</button><button class="btn btn-line" type="button" id="cc">Annuler</button></footer>`);
  const f = $('#f');
  const syncPin = () => f.querySelectorAll('.hr').forEach(l => l.style.display = f.epingle.checked ? 'none' : ''); f.epingle.onchange = syncPin; syncPin();
  const drawPj = () => { $('#pjl').innerHTML = existing.filter(p => !removed.includes(p.id)).map(p => `<a>${p.type === 'photo' ? '<span class="ic">🖼</span>' : `<span class="ic">${p.type === 'video' ? '🎬' : '📄'}</span>`}${E(p.nom)}<button type="button" class="rm" data-rme="${p.id}">×</button></a>`).join('') + added.map((f, k) => `<a>${kindOf(f) === 'photo' ? `<img src="${URL.createObjectURL(f)}" alt="">` : `<span class="ic">${kindOf(f) === 'video' ? '🎬' : '📄'}</span>`}${E(f.name)}<button type="button" class="rm" data-rma="${k}">×</button></a>`).join('') || '<span style="font-size:13px;color:var(--mute)">Aucune.</span>';
    $('#pjl').querySelectorAll('[data-rme]').forEach(b => b.onclick = () => { removed.push(b.dataset.rme); drawPj(); });
    $('#pjl').querySelectorAll('[data-rma]').forEach(b => b.onclick = () => { added.splice(+b.dataset.rma, 1); drawPj(); }); };
  drawPj();
  $('#pjin').onchange = e => { const big = [...e.target.files].filter(x => x.size > 50 * 1024 * 1024); if (big.length) toast('Fichier trop lourd (50 Mo max) : ' + big[0].name); added = added.concat([...e.target.files].filter(x => x.size <= 50 * 1024 * 1024)); e.target.value = ''; drawPj(); };
  $('#cc').onclick = closePanel;
  f.onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(f), ts = fd.getAll('techs'); if (!ts.length) return toast('Choisissez au moins un technicien');
    const btn = $('#sv'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    const pin = !!fd.get('epingle');
    const row = { type: fd.get('type'), date: fd.get('date'), epingle: pin, heure: pin ? null : (fd.get('heure') || '09:00'), duree: pin ? 0 : (+fd.get('duree') || 1), travaux: fd.get('travaux'), adresse: fd.get('adresse'), cp: fd.get('cp'), ville: fd.get('ville'), client: fd.get('client'), occupant: fd.get('occupant'), tel: fd.get('tel'),
      materiel: String(fd.get('materiel') || '').split('\n').map(x => x.trim()).filter(Boolean), recurrent: !!fd.get('recurrent'), demande_id: i.demande_id || null, chantier_id: i.chantier_id || null, affaire_id: i.affaire_id || null };
    try {
      let id = i.id;
      if (isNew) { const r = await sb.from('interventions').insert({ ...row, created_by: me.id, updated_by: me.id }).select('id').single(); if (r.error) throw r.error; id = r.data.id; }
      else { const r = await sb.from('interventions').update(row).eq('id', id); if (r.error) throw r.error; }
      const cur = isNew ? [] : i.techs, plus = ts.filter(t => !cur.includes(t)), moins = cur.filter(t => !ts.includes(t));
      if (plus.length) { const r = await sb.from('intervention_techs').insert(plus.map(t => ({ intervention_id: id, tech_id: t }))); if (r.error) throw r.error; }
      for (const t of moins) await sb.from('intervention_techs').delete().match({ intervention_id: id, tech_id: t });
      for (const pid of removed) { const p = existing.find(x => x.id === pid); await sb.storage.from('pieces').remove([p.path]); await sb.from('pieces').delete().eq('id', pid); }
      for (let k = 0; k < added.length; k++) { const file = added[k]; btn.textContent = `Envoi des fichiers ${k + 1}/${added.length}…`;
        const path = `${id}/${Date.now()}-${k}-${file.name.normalize('NFD').replace(/[^\w.\-]+/g, '_')}`;
        const up = await sb.storage.from('pieces').upload(path, file, { contentType: file.type || 'application/octet-stream' }); if (up.error) throw up.error;
        const r = await sb.from('pieces').insert({ intervention_id: id, nom: file.name, type: kindOf(file), path }); if (r.error) throw r.error; }
      if (opts.demande) await sb.from('demandes').update({ statut: 'planifiee', traitee_par: me.id, traitee_le: new Date().toISOString() }).eq('id', opts.demande.id);
      closePanel(); week = monday(new Date(row.date + 'T12:00')); if (mode === 'jour') day = row.date; await go('planning');
      toast((pin ? 'Tâche épinglée' : 'Intervention enregistrée') + ' pour ' + names(ts));
    } catch (er) { btn.disabled = false; btn.textContent = isNew ? 'Planifier' : 'Enregistrer'; toast('Erreur : ' + (er.message || er)); }
  };
}
function absenceForm(techId) {
  openPanel(`<header><h2>Absence · ${E(T(techId).nom)}</h2><button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="fa"><div class="form"><label>Du<input type="date" name="du" value="${iso(new Date())}" required></label><label>Au<input type="date" name="au" value="${iso(new Date())}" required></label>
  <label class="full">Motif<select name="motif"><option>Congé</option><option>Maladie</option><option>Formation</option><option>Récupération</option><option>Autre</option></select></label></div></form>
  <footer><button class="btn btn-grad" form="fa" type="submit">Enregistrer</button></footer>`);
  $('#fa').onsubmit = async e => { e.preventDefault(); const fd = new FormData(e.target); let d = new Date(fd.get('du') + 'T12:00'); const end = new Date(fd.get('au') + 'T12:00'); const rows = [];
    while (d <= end && rows.length < 60) { if (d.getDay() !== 0) rows.push({ tech_id: techId, date: iso(d), motif: fd.get('motif') }); d = addDays(d, 1); }
    const { error } = await sb.from('absences').upsert(rows, { onConflict: 'tech_id,date' }); if (error) return toast('Erreur : ' + error.message);
    closePanel(); await loadPlanning(); planning(); toast('Absence enregistrée'); };
}

/* ================= Demandes du site ================= */
async function loadDemandes() { const { data, error } = await sb.from('demandes').select('*').order('created_at', { ascending: false }).limit(300); if (error) return toast('Erreur : ' + error.message); demandes = data || []; badge(); }
function badge() { const c = $('#cn'); if (c) c.textContent = demandes.filter(d => d.statut === 'nouvelle').length || ''; }
function listDemandes() {
  if (view !== 'demandes') return;
  const it = demandes.filter(d => filtre === 'toutes' || d.statut === filtre);
  $('#main').innerHTML = `<div class="head"><h1>Demandes du site</h1><span class="live"><i></i>En direct</span>
   <div class="seg">${[['nouvelle', 'Nouvelles'], ['affaire', 'En affaire'], ['planifiee', 'Planifiées'], ['archivee', 'Archivées'], ['toutes', 'Toutes']].map(([k, l]) => `<button data-f="${k}" class="${filtre === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
   ${it.length ? `<div class="list">${it.map(d => `<button class="d ${d.statut === 'nouvelle' ? 'new' : ''}" data-id="${d.id}"><span class="th" data-th="${E(d.photos[0]?.path || '')}">${d.photos.length ? '' : '—'}</span>
     <span><h3>${E(d.service)}${d.urgence === 'urgent' ? '<span class="tag t-urg">Urgent</span>' : ''}<span class="tag ${STAT_D[d.statut][1]}">${STAT_D[d.statut][0]}</span></h3><p>${E(d.nom)} · ${E(d.ville)} · ${d.photos.length} photo${d.photos.length > 1 ? 's' : ''}</p></span>
     <span class="r" style="color:var(--mute);font-size:13px;font-weight:700">${fdate(d.created_at)}</span></button>`).join('')}</div>` : `<div class="empty">Aucune demande ici pour le moment.</div>`}`;
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; listDemandes(); });
  document.querySelectorAll('.d[data-id]').forEach(b => b.onclick = () => detailDemande(b.dataset.id));
  const paths = [...document.querySelectorAll('[data-th]')].map(e => e.dataset.th).filter(Boolean);
  signed('demandes', paths).then(u => document.querySelectorAll('[data-th]').forEach(el => { if (u[el.dataset.th]) el.style.backgroundImage = `url('${u[el.dataset.th]}')`; }));
}
async function detailDemande(id) {
  const d = demandes.find(x => x.id === id); if (!d) return;
  openPanel(`<header><div><span class="tag ${STAT_D[d.statut][1]}" style="margin:0">${STAT_D[d.statut][0]}</span>${d.urgence === 'urgent' ? '<span class="tag t-urg">Urgent</span>' : ''}<h2 style="margin-top:8px">${E(d.service)}</h2><div style="color:var(--mute);font-size:13.5px">N° ${E(d.ref)} · ${fdate(d.created_at)}</div></div><button class="x" aria-label="Fermer">×</button></header>
  <div class="body">
    <dl class="kv"><dt>Client</dt><dd>${E(d.nom)} <span style="color:var(--mute);font-weight:600">· ${E(d.profil || '')}</span></dd><dt>Téléphone</dt><dd><a href="tel:${E(d.tel.replace(/\s/g, ''))}">${E(d.tel)}</a></dd>${d.email ? `<dt>E-mail</dt><dd><a href="mailto:${E(d.email)}">${E(d.email)}</a></dd>` : ''}<dt>Adresse</dt><dd>${E([d.adresse, d.cp + ' ' + d.ville].filter(Boolean).join(', '))}</dd><dt>Délai</dt><dd>${{ urgent: 'Urgent', semaine: 'Dans la semaine', 'pas-presse': 'Pas pressé' }[d.urgence] || '—'}</dd></dl>
    <div class="box"><h4>Message</h4>${E(d.message) || '—'}</div>
    ${d.photos.length ? `<div class="box"><h4>Photos (${d.photos.length})</h4><div class="ph" id="ph">${d.photos.map(p => `<a target="_blank" rel="noopener" data-p="${E(p.path)}"><img alt="">${E(p.label)}</a>`).join('')}</div></div>` : ''}
    ${d.manquantes.length ? `<div class="box" style="border-color:#FDE68A;background:#FFFBEB"><h4>Photos impossibles à prendre</h4>${d.manquantes.map(E).join(' · ')}</div>` : ''}
  </div>
  <footer><button class="btn btn-grad" id="plan">🗓 Planifier</button>${d.statut !== 'affaire' ? `<button class="btn btn-line" id="toaff">💼 Créer l’affaire (devis)</button>` : `<button class="btn btn-line" id="toaff">💼 Voir l’affaire</button>`}${d.statut !== 'archivee' ? `<button class="btn btn-line" data-s="archivee">Archiver</button>` : `<button class="btn btn-line" data-s="nouvelle">Remettre en nouvelle</button>`}</footer>`);
  $('#plan').onclick = () => form(null, { demande: d, pre: { client: d.profil === 'Particulier' ? 'Particulier' : '', occupant: d.nom, tel: d.tel, adresse: d.adresse || '', cp: d.cp || '', ville: d.ville || '', travaux: d.service + (d.message ? ' : ' + d.message : ''), demande_id: d.id } });
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { b.disabled = true; const s = b.dataset.s;
    const { error } = await sb.from('demandes').update({ statut: s, traitee_par: me.id, traitee_le: new Date().toISOString() }).eq('id', d.id);
    if (error) { toast('Erreur : ' + error.message); b.disabled = false; return; } d.statut = s; closePanel(); badge(); listDemandes(); toast('Demande mise à jour'); });
  $('#toaff').onclick = async () => { const ex = affaires.find(a => a.demande_id === d.id); if (ex) return affaireForm(ex);
    affaireForm(null, { demande: d, pre: { source: 'site', client: d.nom, contact: d.nom, tel: d.tel, email: d.email || '', adresse: d.adresse || '', cp: d.cp || '', ville: d.ville || '', objet: d.service, description: [d.message, d.manquantes.length ? 'Photos non fournies : ' + d.manquantes.join(', ') : ''].filter(Boolean).join('\n\n'), demande_id: d.id } }); };
  const u = await signed('demandes', d.photos.map(p => p.path));
  document.querySelectorAll('#ph [data-p]').forEach(a => { if (u[a.dataset.p]) { a.href = u[a.dataset.p]; a.querySelector('img').src = u[a.dataset.p]; } });
}

sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') newPasswordView(); else if (ev === 'SIGNED_IN') start(); else if (ev === 'SIGNED_OUT') { me = null; started = false; loginView(); } });
if (/type=recovery/.test(location.hash)) newPasswordView(); else start();

/* ================= À contrôler (retours terrain) ================= */
let ctrl = [];
async function badgeC() { const { count } = await sb.from('interventions').select('id', { count: 'exact', head: true }).eq('statut', 'controle'); const c = $('#cc'); if (c) c.textContent = count || ''; }
async function refreshView() { badgeC(); if (view === 'controle') await listControle(); else { await loadPlanning(); planning(); } }
async function cloturer(id) {
  const { error } = await sb.from('interventions').update({ statut: 'cloturee' }).eq('id', id);
  if (error) return toast('Erreur : ' + error.message);
  closePanel(); toast('✓ Intervention clôturée'); badgeC();
  await refreshView();
}
async function listControle() {
  if (view !== 'controle') return;
  const { data, error } = await sb.from('interventions').select('*, intervention_techs(tech_id), pieces(id)').eq('statut', 'controle').order('fin_at', { ascending: false });
  if (error) return toast('Erreur : ' + error.message);
  ctrl = (data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id), nbPieces: i.pieces.length }));
  $('#main').innerHTML = `<div class="head"><h1>À contrôler</h1><span class="live"><i></i>En direct</span></div>
   <p style="color:var(--mute);margin:-6px 0 16px">Interventions validées par les techniciens (photos + commentaire). Vérifiez puis clôturez.</p>
   ${ctrl.length ? `<div class="list">${ctrl.map(i => `<button class="d" data-c="${i.id}"><span class="th" data-th="${E((i.photos || [])[0]?.path || '')}">${(i.photos || []).length ? '' : '📌'}</span>
     <span><h3>${E(i.type === 'intervention' ? (i.adresse || i.ville || 'Intervention') : i.travaux)}${i.epingle ? '<span class="tag t-aff">📌 Tâche</span>' : ''}</h3><p>${i.techs.map(t => `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${T(t).couleur};margin-right:4px"></i>${E(T(t).nom)}`).join(' · ')} · ${(i.photos || []).length} photo${(i.photos || []).length > 1 ? 's' : ''}${i.commentaire ? ' · « ' + E(i.commentaire.slice(0, 70)) + (i.commentaire.length > 70 ? '…' : '') + ' »' : ''}</p></span>
     <span class="r" style="color:var(--mute);font-size:13px;font-weight:700">${i.fin_at ? fdate(i.fin_at) : lbl(i.date, true)}</span></button>`).join('')}</div>` : `<div class="empty">Rien à contrôler : tout est à jour 👍</div>`}`;
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => detail(b.dataset.c, ctrl.find(x => x.id === b.dataset.c)));
  const paths = [...document.querySelectorAll('[data-th]')].map(e => e.dataset.th).filter(Boolean);
  signed('retours', paths).then(u => document.querySelectorAll('[data-th]').forEach(el => { if (u[el.dataset.th]) el.style.backgroundImage = `url('${u[el.dataset.th]}')`; }));
}
