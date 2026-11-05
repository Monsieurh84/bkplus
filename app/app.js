/* BK+ — application bureau (Supabase) */
const C = window.BK_CONFIG, sb = supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = s => document.querySelector(s), root = $('#root');
/* Fenêtres de confirmation de l'application (remplacent celles du navigateur, qui affichaient l'adresse du site) */
function dlgBox(msg, o) { o = o || {}; return new Promise(res => {
  const d = document.createElement('div'); d.className = 'bkdlg';
  d.innerHTML = `<div class="bkdlg-in" role="dialog" aria-modal="true"><p></p>${o.input ? `<${o.multi ? 'textarea rows="3"' : 'input'} class="bkdlg-f" ${o.password ? 'type="password"' : ''} autocomplete="off">${o.multi ? '</textarea>' : ''}` : ''}<div class="bkdlg-b"><button type="button" class="bkdlg-no">${o.cancel || 'Annuler'}</button><button type="button" class="bkdlg-ok ${o.danger ? 'red' : ''}">${o.ok || 'OK'}</button></div></div>`;
  d.querySelector('p').textContent = msg; const f = d.querySelector('.bkdlg-f'); if (f && o.value) f.value = o.value; if (f && o.placeholder) f.placeholder = o.placeholder;
  const end = v => { d.remove(); document.removeEventListener('keydown', key, true); res(v); };
  const ok = () => end(o.input ? f.value : true), no = () => end(o.input ? null : false);
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); no(); } else if (e.key === 'Enter' && !(o.multi && e.shiftKey) && !(e.target.tagName === 'BUTTON')) { e.preventDefault(); e.stopImmediatePropagation(); ok(); } };
  d.querySelector('.bkdlg-ok').onclick = ok; d.querySelector('.bkdlg-no').onclick = no; d.onclick = e => { if (e.target === d) no(); };
  document.addEventListener('keydown', key, true); document.body.appendChild(d); setTimeout(() => (f || d.querySelector('.bkdlg-ok')).focus(), 30); }); }
const ask = (msg, o) => dlgBox(msg, { danger: /supprim|retirer/i.test(msg), ...(o || {}) });
const askText = (msg, value, o) => dlgBox(msg, { input: true, value: value || '', ...(o || {}) });
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
const STAT_I = { planifiee: 'Planifiée', enroute: 'En route', encours: 'En cours', controle: 'À contrôler', attente: 'En attente', reprendre: 'À reprendre', cloturee: 'Clôturée' };
const SC = { planifiee: '#2239A9', enroute: '#6D28D9', encours: '#B45309', controle: '#C2410C', attente: '#64748B', reprendre: '#DC2626', cloturee: '#0E9F6E' };

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
  $('#fg').onclick = () => { const m = $('#m'); m.className = 'msg ok on'; m.textContent = 'Demandez à un membre du bureau (Alan, Julie ou Bastien) : dans l’application, menu « Équipe & accès », il vous crée un nouveau mot de passe en 10 secondes.'; };
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
  if (p && p.actif && p.role === 'technicien') { location.replace('tech.html'); return; }
  if (!p || p.role !== 'bureau' || !p.actif) { started = false; root.innerHTML = `<div class="login"><form><img src="../logo-bk.png" alt=""><h1>Accès non activé</h1><p>Votre compte (${E(session.user.email)}) n’a pas encore d’accès bureau.</p><button class="btn btn-line" type="button" id="out">Se déconnecter</button></form></div>`; $('#out').onclick = () => sb.auth.signOut(); return; }
  me = p; shell();
  const r = await sb.from('techniciens').select('*').eq('actif', true).order('ordre'); techs = r.data || [];
  await Promise.all([loadDemandes(), loadAffaires()]); const h = location.hash.slice(1); view = ['planning', 'recherche', 'demandes', 'controle', 'devis', 'affaires', 'chantiers', 'clients', 'articles'].includes(h) ? h : 'planning';
  await go(view); listen(); badgeC();
}
function shell() {
  root.innerHTML = `<div class="app"><aside class="side"><div class="brand"><img src="../logo-bk.png" alt=""><div><b>BK+</b><small>Application</small></div></div>
  <button class="nav srch" data-v="recherche">${ic('search')} Rechercher une intervention</button>
  <button class="nav" data-v="planning">${ic('calendar')} Planning</button>
  <button class="nav" data-v="demandes">${ic('inbox')} Demandes du site<span class="c" id="cn"></span></button>
  <button class="nav" data-v="affaires">${ic('briefcase')} Affaires<span class="c" id="ca"></span></button><button class="nav" data-v="chantiers">${ic('helmet')} Chantiers</button><button class="nav" data-v="clients">${ic('notebook')} Clients</button><button class="nav" data-v="articles">${ic('package')} Articles</button><button class="nav" data-v="controle">${ic('check-circle')} À contrôler<span class="c" id="cc"></span></button><button class="nav" data-v="devis">${ic('file')} Devis à faire<span class="c" id="cdv"></span></button>
  <a class="nav" href="tech.html" target="_blank" rel="noopener" style="text-decoration:none">${ic('smartphone')} App technicien<small>aperçu</small></a>
  <button class="nav" id="team">${ic('users')} Équipe & accès</button>
  <div class="who"><b>${E(me.nom)}</b>Accès bureau<br><button id="mdp">Mon mot de passe</button> · <button id="out">Se déconnecter</button></div></aside><main class="main" id="main"><div class="loading">Chargement…</div></main></div>`;
  $('#out').onclick = () => sb.auth.signOut(); $('#mdp').onclick = monMdp; $('#team').onclick = equipe;
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => go(b.dataset.v));
}
async function go(v) {
  view = v; history.replaceState(null, '', '#' + v);
  document.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'planning') { await loadPlanning(); planning(); } else if (v === 'controle' || v === 'devis') await listControle(); else if (v === 'affaires') { await loadAffaires(); listAffaires(); } else if (v === 'chantiers') { await loadChantiers(); listChantiers(); } else if (v === 'recherche') listRecherche(); else if (v === 'clients') listClients(); else if (v === 'articles') listArticles(); else listDemandes();
}
function listen() {
  if (chan) sb.removeChannel(chan);
  let tm = null; const refresh = () => { clearTimeout(tm); tm = setTimeout(async () => { badgeC(); if (view === 'planning') { await loadPlanning(); planning(); } else if (view === 'controle' || view === 'devis') await listControle(); else if (view === 'chantiers') { await loadChantiers(); listChantiers(); } }, 400); };
  chan = sb.channel('bk').on('postgres_changes', { event: '*', schema: 'public', table: 'demandes' }, p => {
    if (p.eventType === 'INSERT') { demandes.unshift(p.new); toast('Nouvelle demande : ' + p.new.service + ' · ' + p.new.ville); }
    else if (p.eventType === 'UPDATE') { const i = demandes.findIndex(x => x.id === p.new.id); if (i > -1) demandes[i] = p.new; }
    badge(); if (view === 'demandes') listDemandes();
  }).on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, p => { const n = p.new || {}, o = p.old || {};
    if (n.note_reponse && !n.note_rep_lue && n.note_rep_at && !(listen.rs = listen.rs || new Set()).has(n.id + n.note_rep_at) && listen.rs.add(n.id + n.note_rep_at)) { toast('✉ Réponse de ' + (n.note_rep_par ? T(n.note_rep_par).nom : 'un technicien') + ' (' + (n.client || n.occupant || n.adresse || 'intervention') + ') : « ' + String(n.note_reponse).slice(0, 80) + ' »'); }
    refresh(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'intervention_techs' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'affaires' }, () => { clearTimeout(listen.ta); listen.ta = setTimeout(async () => { await loadAffaires(); listAffaires(); }, 400); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suivi' }, () => { clearTimeout(listen.ts); listen.ts = setTimeout(async () => { if (view === 'chantiers' && !document.activeElement?.closest?.('.suivi')) { await loadChantiers(); listChantiers(); } }, 500); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chantiers' }, () => { clearTimeout(listen.tc); listen.tc = setTimeout(async () => { if (view === 'chantiers') { await loadChantiers(); listChantiers(); } }, 400); }).subscribe();
}

/* ================= Planning ================= */
const H0 = 7, H1 = 20;                     // plage horaire affichée
let showWE = false, hidden = new Set(), planKey = '', pxFit = 0;
window.addEventListener('resize', () => { clearTimeout(window.__fitT); window.__fitT = setTimeout(() => { if (view === 'planning') { pxFit = 0; planning(); } }, 200); });
try { showWE = localStorage.getItem('bk-we') === '1'; hidden = new Set(JSON.parse(localStorage.getItem('bk-hide') || '[]')); } catch (e) { }
const saveUI = () => { try { localStorage.setItem('bk-we', showWE ? '1' : '0'); localStorage.setItem('bk-hide', JSON.stringify([...hidden])); } catch (e) { } };
const nbDays = () => showWE ? 7 : 5;
function range() { return mode === 'semaine' ? [iso(week), iso(addDays(week, 6))] : [day, day]; }
const isWE = d => [0, 6].includes(new Date(d + 'T12:00').getDay());
const weOn = () => showWE || inter.some(i => { const g = new Date(i.date + 'T12:00').getDay(); return g === 0 || g === 6; });
async function loadPlanning() {
  const [a, b] = range();
  const [r1, r2] = await Promise.all([
    sb.from('interventions').select('*, intervention_techs(tech_id), pieces(id)').gte('date', a).lte('date', b),
    sb.from('absences').select('*').gte('date', a).lte('date', b)]);
  if (r1.error) return toast('Erreur : ' + r1.error.message);
  inter = (r1.data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id), nbPieces: i.pieces.length }));
  absences = r2.data || [];
}
/* Jours fériés (France métropolitaine) */
const FER = {};
function feries(y) { if (FER[y]) return FER[y];
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  const P = new Date(y, mo - 1, da, 12), o = {};
  [['01-01', 'Jour de l’an'], ['12-24', 'Veille de Noël'], ['12-31', 'Saint-Sylvestre'], ['05-01', 'Fête du Travail'], ['05-08', 'Victoire 1945'], ['07-14', 'Fête nationale'], ['08-15', 'Assomption'], ['11-01', 'Toussaint'], ['11-11', 'Armistice'], ['12-25', 'Noël']].forEach(([md, n]) => o[y + '-' + md] = n);
  o[iso(addDays(P, 1))] = 'Lundi de Pâques'; o[iso(addDays(P, 39))] = 'Ascension'; o[iso(addDays(P, 50))] = 'Lundi de Pentecôte';
  return FER[y] = o; }
const ferie = d => feries(+d.slice(0, 4))[d] || '';
const sortI = (a, b) => (b.epingle - a.epingle) || (a.heure || '').localeCompare(b.heure || '');
const isAllDay = i => i.epingle || !i.heure;
const mins = t => { const [h, m] = String(t || '00:00').split(':').map(Number); return h * 60 + (m || 0); };
const hm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const tint = (hex, a) => { const h = (hex || '#8B8FA3').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const icoOf = i => (i.demande_id ? ic('camera') : '') + (i.nbPieces ? ic('paperclip') : '') + (i.materiel.length ? ic('package') : '') + (i.recurrent ? '↻' : '') + (i.chantier_id ? ic('helmet') : '');
const visTechs = () => techs.filter(t => !hidden.has(t.id));
const isBureau = t => /bureau/i.test(t.fonction || '');

/* Une intervention placée dans la grille horaire */
function ev(i, t, px, col, cols) {
  const s = Math.max(mins(i.heure), H0 * 60), e = Math.min(mins(i.heure) + Math.round((+i.duree || 1) * 60), H1 * 60);
  const top = (s - H0 * 60) / 60 * px, h = Math.max((e - s) / 60 * px, 20), c = T(t).couleur;
  const short = h < 40, title = i.type === 'intervention' ? (i.client || i.occupant || i.ville || 'Intervention') : i.travaux;
  return `<div class="ev ${i.statut === 'cloturee' ? 'cl' : ''} ${short ? 'sh' : ''}" draggable="true" data-id="${i.id}" data-tech="${t}" title="${E(hh(i.heure) + '–' + fin(i.heure, i.duree) + ' · ' + title + (i.adresse ? ' · ' + i.adresse : ''))}"
    style="top:${top}px;height:${h - 2}px;left:calc(${col / cols * 100}% + 1px);width:calc(${100 / cols}% - 2px);--c:${c};--bg:${tint(c, .16)};--sc:${SC[i.statut]}">
    <b><i class="sd"></i>${i.devis ? '<em class="dvt">DEVIS</em>' : ''}${E(title)}</b>${short ? '' : `<span>${hh(i.heure)}–${fin(i.heure, i.duree)}${i.type === 'intervention' && i.ville ? ' · ' + E(i.ville) : ''}</span>`}
    ${h > 64 && i.type === 'intervention' ? `<span class="tr">${E(i.travaux || '')}</span>` : ''}${i.techs.length > 1 && h > 52 ? `<span class="avs">${avatars(i.techs)}</span>` : ''}<span class="ic2">${icoOf(i)}</span>${i.note_reponse && !i.note_rep_lue ? '<span class="nb rp" title="Nouvelle réponse du technicien">✉</span>' : i.note_bureau && !i.note_lue ? '<span class="nb" title="Message pas encore lu par le technicien">✉</span>' : ''}<i class="rzt" title="Glisser pour changer l’heure de début"></i><i class="rz" title="Glisser pour changer l’heure de fin"></i></div>`;
}
/* Répartit les interventions qui se chevauchent dans une même colonne */
function layout(list) {
  const out = [], ends = [];
  list.sort((a, b) => mins(a.heure) - mins(b.heure)).forEach(i => {
    const s = mins(i.heure), e = s + Math.round((+i.duree || 1) * 60);
    let c = ends.findIndex(x => x <= s); if (c < 0) { c = ends.length; ends.push(e); } else ends[c] = e;
    out.push([i, c]);
  });
  return out.map(([i, c]) => [i, c, Math.max(1, ends.length)]);
}
function lane(d, t, px, withHead) {
  const ab = absences.find(a => a.tech_id === t.id && a.date === d);
  const items = inter.filter(i => i.date === d && i.techs.includes(t.id) && !isAllDay(i));
  return `<div class="ln ${ab ? 'abs' : ''}" data-date="${d}" data-tech="${t.id}" style="--c:${t.couleur}">${withHead ? '' : `<span class="lh" style="background:${t.couleur}" title="${E(t.nom)}"></span>`}${layout(items).map(([i, c, n]) => ev(i, t.id, px, c, n)).join('')}</div>`;
}
function planning() {
  if (view !== 'planning') return;
  const today = iso(new Date()), nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const days = mode === 'semaine' ? [...Array(7)].map((_, k) => iso(addDays(week, k))) : [day];
  const px = Math.max(mode === 'semaine' ? 46 : 58, pxFit), vis = visTechs();
  const title = mode === 'semaine' ? `Semaine du ${lbl(days[0])}` : lbl(day, true) + (ferie(day) ? ' · ' + ferie(day) : '');
  let h = `<div class="head"><h1>Planning</h1><span class="live"><i></i>En direct</span>
   <div class="weeknav"><button id="prev" aria-label="Précédent">‹</button><span>${E(title)}</span><button id="next" aria-label="Suivant">›</button><button class="today" id="tod">Aujourd’hui</button></div>
   <div class="seg"><button data-m="jour" class="${mode === 'jour' ? 'on' : ''}">Jour</button><button data-m="semaine" class="${mode === 'semaine' ? 'on' : ''}">Semaine</button></div>
   <button class="btn btn-line" id="bkup" title="Télécharge tout le planning dans un fichier Excel">${ic('download')} Sauvegarde</button><button class="btn btn-line" id="npin">${ic('pin')} Rappel du jour</button><button class="btn btn-grad" id="nnew">+ Planifier</button></div>
   <div class="people">${techs.map(t => `<button data-who="${t.id}" class="${hidden.has(t.id) ? 'off' : ''}" style="--c:${t.couleur}"><i></i>${E(t.nom)}${isBureau(t) ? ' <small>bureau</small>' : ''}</button>`).join('')}<span class="hint">Cliquez pour afficher ou masquer · glissez deux doigts ou ← → pour changer de semaine · double-clic sur un créneau vide pour planifier · clic sur une intervention pour voir la fiche, double-clic pour la modifier · tirez le haut ou le bas d’une intervention pour changer ses horaires</span></div>`;
  if (!techs.length) { $('#main').innerHTML = h + `<div class="empty">Aucun membre de l’équipe enregistré.</div>`; return; }
  const hours = [...Array(H1 - H0)].map((_, k) => `<div class="hr" style="height:${px}px"><span>${pad(H0 + k)}:00</span></div>`).join('');
  const nLanes = d => Math.max(1, vis.filter(t => inter.some(i => i.date === d && i.techs.includes(t.id) && !isAllDay(i))).length);
  const colsTpl = mode === 'semaine' ? '46px ' + days.map(d => isWE(d) ? 'minmax(0,.42fr)' : 'minmax(0,1fr)').join(' ') : `56px repeat(${vis.length},minmax(0,1fr))`;
  h += `<div class="cal ${mode}" style="--px:${px}px;grid-template-columns:${colsTpl}">`;
  if (mode === 'semaine') {
    h += `<div class="ch ax"></div>${days.map(d => `<div class="ch ${d === today ? 'td' : ''} ${ferie(d) ? 'fer' : ''} ${isWE(d) ? 'we' : ''}"><b>${isWE(d) ? lbl(d).split(' ').slice(0, 2).join(' ') : lbl(d)}</b>${ferie(d) ? `<small class="fl">${E(ferie(d))}</small>` : ''}</div>`).join('')}`;
    h += `<div class="ad ax">rappels</div>${days.map(d => allDay(d, vis)).join('')}`;
    h += `<div class="ax hrs">${hours}</div>${days.map(d => { const who = vis.filter(t => inter.some(i => i.date === d && i.techs.includes(t.id) && !isAllDay(i)));
      return `<div class="dc ${d === today ? 'td' : ''} ${isWE(d) ? 'we' : ''}" data-date="${d}" style="height:${(H1 - H0) * px}px">${who.map(t => lane(d, t, px)).join('')}${!who.length ? `<div class="ln empty-ln" data-date="${d}"></div>` : ''}${d === today && nowM > H0 * 60 && nowM < H1 * 60 ? `<i class="now" style="top:${(nowM - H0 * 60) / 60 * px}px"></i>` : ''}</div>`; }).join('')}`;
  } else {
    h += `<div class="ch ax"></div>${vis.map(t => `<div class="ch who" style="--c:${t.couleur}"><b><i></i>${E(t.nom)}</b><small>${E(t.fonction || '')}</small>${isBureau(t) ? '' : `<button data-abs="${t.id}">+ absence</button>`}</div>`).join('')}`;
    h += `<div class="ad ax">rappels</div>${vis.map(t => allDay(day, [t], true)).join('')}`;
    h += `<div class="ax hrs">${hours}</div>${vis.map(t => `<div class="dc ${day === today ? 'td' : ''}" data-date="${day}" style="height:${(H1 - H0) * px}px">${lane(day, t, px, true)}${day === today && nowM > H0 * 60 && nowM < H1 * 60 ? `<i class="now" style="top:${(nowM - H0 * 60) / 60 * px}px"></i>` : ''}</div>`).join('')}`;
  }
  h += `</div>`;
  const key = mode + (mode === 'semaine' ? iso(week) : day), old = $('.cal'), keep = old && planKey === key ? [old.scrollLeft, old.scrollTop, $('#main').scrollTop, document.scrollingElement.scrollTop] : null;
  $('#main').innerHTML = h; planKey = key;
  const sc = $('.cal'); if (sc) { if (keep) { sc.scrollLeft = keep[0]; sc.scrollTop = keep[1]; $('#main').scrollTop = keep[2]; document.scrollingElement.scrollTop = keep[3]; } else { const first = Math.min(...inter.filter(i => !isAllDay(i)).map(i => mins(i.heure)), 8 * 60); sc.scrollTop = Math.max(0, (first - H0 * 60 - 30) / 60 * px); } }
  const nav = async n => { if (mode === 'semaine') week = addDays(week, 7 * n); else { let x = addDays(new Date(day + 'T12:00'), n); if (!showWE) while ([0, 6].includes(x.getDay())) x = addDays(x, n); day = iso(x); } await loadPlanning(); planning(); };
  $('#prev').onclick = () => nav(-1); $('#next').onclick = () => nav(1);
  /* Glisser deux doigts sur le trackpad (ou flèches ← → du clavier, ou balayage sur iPad) pour changer de semaine */
  const cal = $('.cal'); let acc = 0, busy = false, tmw;
  const go1 = async n => { if (busy) return; busy = true; acc = 0; await nav(n); setTimeout(() => { busy = false; }, 450); };
  if (cal) {
    cal.addEventListener('wheel', e => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
      const max = cal.scrollWidth - cal.clientWidth; if (max > 2 && ((e.deltaX > 0 && cal.scrollLeft < max - 1) || (e.deltaX < 0 && cal.scrollLeft > 1))) return;
      e.preventDefault(); acc += e.deltaX; clearTimeout(tmw); tmw = setTimeout(() => { acc = 0; }, 250);
      if (Math.abs(acc) > 140) go1(acc > 0 ? 1 : -1); }, { passive: false });
    let tx = null, ty = 0; cal.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    cal.addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null; if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) go1(dx < 0 ? 1 : -1); }); }
  document.onkeydown = e => { if (view !== 'planning' || $('#panel.on, .ctx') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return; if (e.key === 'ArrowRight') go1(1); else if (e.key === 'ArrowLeft') go1(-1); };
  $('#tod').onclick = async () => { week = monday(new Date()); day = iso(new Date()); await loadPlanning(); planning(); };
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => { mode = b.dataset.m; if (mode === 'jour' && (day < iso(week) || day > iso(addDays(week, 6)))) day = iso(week); await loadPlanning(); planning(); });
  if ($('#we')) $('#we').onchange = async e => { showWE = e.target.checked; saveUI(); await loadPlanning(); planning(); };
  document.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { const id = b.dataset.who; hidden.has(id) ? hidden.delete(id) : hidden.add(id); saveUI(); planning(); });
  $('#bkup').onclick = sauvegarde;
  $('#nnew').onclick = () => form(); $('#npin').onclick = () => form(null, { epingle: true, pre: { date: mode === 'jour' ? day : iso(new Date()) } });
  document.querySelectorAll('[data-abs]').forEach(b => b.onclick = () => absenceForm(b.dataset.abs));
  document.querySelectorAll('[data-delabs]').forEach(b => b.onclick = async e => { e.stopPropagation(); if (!await ask('Retirer cette absence ?')) return; await sb.from('absences').delete().eq('id', b.dataset.delabs); await loadPlanning(); planning(); });
  bindDnD(px);
  /* La grille des heures descend jusqu'en bas de la fenêtre (7h–20h), sans barre de défilement */
  const hrs = $('.cal .hrs'); if (hrs && innerWidth > 900) { const ideal = Math.floor((innerHeight - hrs.getBoundingClientRect().top + ($('.cal').scrollTop || 0) - 18) / (H1 - H0)); if (ideal > px + 1 && ideal !== pxFit) { pxFit = ideal; planning(); } }
}
const pinLbl = i => [...new Set([i.travaux, i.client, i.occupant].map(x => (x || '').trim()).filter(Boolean))].join(' · ') || 'Rappel';
function allDay(d, who, single) {
  const pins = inter.filter(i => i.date === d && isAllDay(i) && i.techs.some(t => who.some(w => w.id === t))).sort(sortI);
  const abs = absences.filter(a => a.date === d && who.some(w => w.id === a.tech_id));
  return `<div class="ad" data-date="${d}" ${single ? `data-tech="${who[0].id}"` : ''}>${!single && ferie(d) ? `<span class="ferb">${ic('calendar')} ${E(ferie(d))}</span>` : ''}${abs.map(a => `<span class="abl" style="--c:${T(a.tech_id).couleur}">${ic('calendar-x')} ${single ? '' : E(T(a.tech_id).nom) + ' · '}${E(a.motif)}<button data-delabs="${a.id}" aria-label="Retirer l’absence">×</button></span>`).join('')}
    ${pins.map(i => `<div class="pinr" draggable="true" data-id="${i.id}" data-tech="${single ? who[0].id : i.techs[0]}" style="--c:${T(i.techs[0]).couleur};--bg:${tint(T(i.techs[0]).couleur, .14)}">${ic('pin')}<span>${single ? '' : `<em>${E(names(i.techs))}</em> `}${E(pinLbl(i))}</span></div>`).join('')}</div>`;
}
/* Agrandir / rétrécir une intervention à la souris (poignée du haut ou du bas), par pas de 15 minutes */
let rzEnd = 0, clk = 0;
function resizeEv(e, c, px, top) {
  e.preventDefault(); e.stopPropagation(); const i = inter.find(x => x.id === c.dataset.id); if (!i) return;
  const y0 = e.clientY, s0 = mins(i.heure), d0 = Math.round((+i.duree || 1) * 60), e0 = s0 + d0, top0 = c.offsetTop; let s = s0, d = d0;
  c.draggable = false; c.classList.add('rzing'); document.body.classList.add('rzbody');
  const tip = document.createElement('div'); tip.className = 'rztip' + (top ? ' up' : ''); c.appendChild(tip);
  const show = () => { tip.textContent = hh(hm(s)) + ' – ' + hh(hm(s + d)) + ' · ' + (d >= 60 ? Math.floor(d / 60) + ' h' + (d % 60 ? ' ' + pad(d % 60) : '') : d + ' min'); };
  const mv = x => { const k = Math.round((x.clientY - y0) / px * 60 / 15) * 15;
    if (top) { s = Math.max(H0 * 60, Math.min(e0 - 15, s0 + k)); d = e0 - s; c.style.top = (top0 + (s - s0) / 60 * px) + 'px'; }
    else d = Math.max(15, Math.min(H1 * 60 - s, d0 + k));
    c.style.height = Math.max(18, d / 60 * px - 2) + 'px'; show(); };
  const up = async () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); rzEnd = Date.now(); c.classList.remove('rzing'); document.body.classList.remove('rzbody'); tip.remove(); c.draggable = true;
    if (d === d0 && s === s0) return; const row = { duree: Math.round(d / 60 * 10000) / 10000 }; if (s !== s0) row.heure = hm(s); Object.assign(i, row);
    const { error } = await sb.from('interventions').update(row).eq('id', i.id); if (error) { toast('Erreur : ' + error.message); }
    else toast((i.client || i.occupant || i.travaux || 'Intervention') + ' : ' + hh(hm(s)) + '–' + hh(hm(s + d)));
    await loadPlanning(); planning(); };
  show(); document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
}
function bindDnD(px) {
  let grab = 0;
  document.querySelectorAll('.ev,.pinr').forEach(c => {
    c.onclick = e => { e.stopPropagation(); if (Date.now() - rzEnd < 400 || e.detail > 1) return; clearTimeout(clk); clk = setTimeout(() => { const i = inter.find(x => x.id === c.dataset.id); if (i) detail(i.id); }, 240); };
    c.ondblclick = e => { e.stopPropagation(); clearTimeout(clk); const i = inter.find(x => x.id === c.dataset.id); if (i) form(i); };
    const rz = c.querySelector('.rz'); if (rz) rz.onmousedown = e => resizeEv(e, c, px); const rt = c.querySelector('.rzt'); if (rt) rt.onmousedown = e => resizeEv(e, c, px, true);
    c.oncontextmenu = e => { e.preventDefault(); ctxMenu(e, inter.find(x => x.id === c.dataset.id)); };
    c.ondragstart = e => { if (c.classList.contains('rzing')) return e.preventDefault(); grab = e.offsetY || 0; c.classList.add('dragging'); e.dataTransfer.setData('text/plain', c.dataset.id + '|' + c.dataset.tech); };
    c.ondragend = () => c.classList.remove('dragging');
  });
  const target = (el, e) => { const ln = el.closest('.ln'); return ln && ln.dataset.tech ? ln.dataset.tech : null; };
  document.querySelectorAll('.dc,.ad').forEach(z => {
    z.ondragover = e => { e.preventDefault(); z.classList.add('over'); };
    z.ondragleave = () => z.classList.remove('over');
    z.ondrop = async e => {
      e.preventDefault(); z.classList.remove('over');
      const [id, from] = e.dataTransfer.getData('text/plain').split('|'), i = inter.find(x => x.id === id); if (!i) return;
      const d = z.dataset.date, to = target(e.target, e) || z.dataset.tech || from;
      if (absences.find(a => a.tech_id === to && a.date === d)) return toast(T(to).nom + ' est absent ce jour-là');
      const patch = { date: d };
      if (z.classList.contains('dc') && !i.epingle) { const r = z.getBoundingClientRect(); let m = H0 * 60 + Math.round(((e.clientY - r.top - grab) / px * 60) / 15) * 15; m = Math.max(H0 * 60, Math.min(m, H1 * 60 - 15)); patch.heure = hm(m); }
      const ops = [sb.from('interventions').update(patch).eq('id', id)];
      if (from !== to && !i.techs.includes(to)) { ops.push(sb.from('intervention_techs').delete().match({ intervention_id: id, tech_id: from })); ops.push(sb.from('intervention_techs').insert({ intervention_id: id, tech_id: to })); }
      const res = await Promise.all(ops); const er = res.find(r => r.error); if (er) return toast('Erreur : ' + er.error.message);
      await loadPlanning(); planning(); const n = inter.find(x => x.id === id);
      toast('Déplacée : ' + lbl(d) + (patch.heure ? ' à ' + hh(patch.heure) : '') + ' · ' + names(n ? n.techs : [to]));
    };
  });
  document.querySelectorAll('.dc').forEach(z => z.ondblclick = e => {
    if (e.target.closest('.ev')) return; const r = z.getBoundingClientRect(); const m = H0 * 60 + Math.floor(((e.clientY - r.top) / px * 60) / 15) * 15;
    const t = target(e.target) || (mode === 'jour' ? null : null); const ln = e.target.closest('.ln');
    form(null, { pre: { date: z.dataset.date, heure: hm(m), duree: 1, techs: ln && ln.dataset.tech ? [ln.dataset.tech] : [] } });
  });
}
function ctxMenu(e, i) {
  if (!i) return; document.querySelectorAll('.ctx').forEach(x => x.remove());
  const m = document.createElement('div'); m.className = 'ctx';
  m.innerHTML = `<b>${E(i.type === 'intervention' ? (i.client || i.ville || 'Intervention') : i.travaux).slice(0, 40)}</b>
    <button data-a="fi">${ic('eye')} Voir la fiche (photos, retour)</button><button data-a="rep">↺ À reprendre…</button><button data-a="dup">${ic('clipboard')} Dupliquer…</button><button data-a="ed">${ic('pencil')} Modifier</button><button data-a="p7">${ic('repeat')} Même chose la semaine suivante</button><button data-a="del" class="red">Supprimer</button>`;
  document.body.appendChild(m); const w = 250; m.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - m.offsetHeight - 8) + 'px';
  const close = () => { m.remove(); document.removeEventListener('mousedown', out); }; const out = x => { if (!m.contains(x.target)) close(); }; setTimeout(() => document.addEventListener('mousedown', out), 0);
  m.querySelector('[data-a=fi]').onclick = () => { close(); detail(i.id); };
  m.querySelector('[data-a=rep]').onclick = () => { close(); aReprendre(i); };
  m.querySelector('[data-a=dup]').onclick = () => { close(); duplicate(i); };
  m.querySelector('[data-a=ed]').onclick = () => { close(); form(i); };
  m.querySelector('[data-a=p7]').onclick = () => { close(); duplicate(i, iso(addDays(new Date(i.date + 'T12:00'), 7))); };
  m.querySelector('[data-a=del]').onclick = async () => { close(); if (!await ask('Supprimer définitivement cette intervention ?')) return; const { error } = await sb.from('interventions').delete().eq('id', i.id); if (error) return toast('Erreur : ' + error.message); await refreshView(); toast('Intervention supprimée'); };
}
function duplicate(i, date) {
  const keep = ['type', 'devis', 'heure', 'duree', 'epingle', 'client', 'client_id', 'occupant', 'tel', 'adresse', 'complement', 'cp', 'ville', 'travaux', 'materiel', 'recurrent', 'demande_id', 'chantier_id', 'affaire_id'];
  const pre = {}; keep.forEach(k => pre[k] = i[k]); pre.materiel = [...(i.materiel || [])]; pre.techs = [...i.techs]; pre.date = date || i.date;
  form(null, { pre, ctx: 'Copie de l’intervention du ' + lbl(i.date) + ' · changez la date, l’horaire ou le technicien puis enregistrez' });
}

/* ================= Recherche d’interventions ================= */
let qS = '', fS = 'toutes';
async function listRecherche() {
  if (view !== 'recherche') return;
  $('#main').innerHTML = `<div class="head"><h1>Rechercher une intervention</h1></div>
    <div class="sbar"><input class="search big" id="qs" type="search" placeholder="Nom, prénom, adresse, ville, téléphone, travaux, n° d’affaire ou de devis…" value="${E(qS)}" autofocus>
    <div class="seg">${[['toutes', 'Toutes'], ['avenir', 'À venir'], ['passees', 'Passées']].map(([k, l]) => `<button data-fs="${k}" class="${fS === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><div id="rs"></div>`;
  const run = async () => {
    if (qS.length < 2) { $('#rs').innerHTML = '<p class="cnt">Tapez au moins 2 lettres. La recherche porte sur toutes les interventions : planifiées, en cours, clôturées.</p>'; return; }
    const l = pat(qS);
    const af = await sb.from('affaires').select('id').or(['ref', 'isanet_devis', 'isanet_facture', 'client'].map(k => `${k}.ilike.${l}`).join(',')).limit(60);
    const ors = ['client', 'occupant', 'adresse', 'complement', 'ville', 'cp', 'tel', 'travaux'].map(k => `${k}.ilike.${l}`); const ids = (af.data || []).map(a => a.id); if (ids.length) ors.push(`affaire_id.in.(${ids.join(',')})`);
    let r = sb.from('interventions').select('*, intervention_techs(tech_id), pieces(id), affaires(ref,isanet_devis)').or(ors.join(',')).order('date', { ascending: false }).limit(150);
    const t = iso(new Date()); if (fS === 'avenir') r = r.gte('date', t); if (fS === 'passees') r = r.lt('date', t);
    const { data, error } = await r; if (error) return toast('Erreur : ' + error.message);
    const list = (data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id), nbPieces: i.pieces.length }));
    $('#rs').innerHTML = `<p class="cnt">${list.length} intervention${list.length > 1 ? 's' : ''}${list.length === 150 ? ' (les 150 plus récentes)' : ''}</p>` + (list.length ? `<div class="dt"><table><thead><tr><th>Date</th><th>Client / occupant</th><th>Adresse</th><th>Travaux</th><th>Équipe</th><th>Statut</th></tr></thead><tbody>
      ${list.map(i => `<tr data-ri="${i.id}"><td><b>${lbl(i.date)}</b><br><small>${i.epingle ? 'dans la journée' : hh(i.heure) + '–' + fin(i.heure, i.duree)}</small></td><td><b>${E(i.client || '')}</b>${i.occupant ? '<br><small>' + E(i.occupant) + '</small>' : ''}${i.affaires ? `<br><small>${E(i.affaires.ref || '')}${i.affaires.isanet_devis ? ' · devis ' + E(i.affaires.isanet_devis) : ''}</small>` : ''}</td>
        <td>${E([i.adresse, [i.cp, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</td><td>${E((i.travaux || '').slice(0, 90))}</td><td><span class="avs">${avatars(i.techs)}</span></td><td><span class="tag s-${i.statut}" style="margin:0">${STAT_I[i.statut]}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Aucune intervention trouvée.</div>');
    document.querySelectorAll('[data-ri]').forEach(tr => tr.onclick = () => { const i = list.find(x => x.id === tr.dataset.ri); inter = inter.filter(x => x.id !== i.id).concat([i]); detail(i.id, i); });
  };
  let tm; $('#qs').oninput = e => { qS = e.target.value.trim(); clearTimeout(tm); tm = setTimeout(run, 250); };
  document.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { fS = b.dataset.fs; document.querySelectorAll('[data-fs]').forEach(x => x.classList.toggle('on', x === b)); run(); });
  $('#qs').focus(); run();
}

/* ================= Panneau ================= */
/* Empêche Chrome de proposer « Enregistrer l'adresse » / remplissage automatique dans les formulaires de l'appli */
function noFill(root) { root.querySelectorAll('form').forEach(f => f.setAttribute('autocomplete', 'off')); root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=date]):not([type=time]),textarea').forEach(x => { if (x.type !== 'password') x.setAttribute('autocomplete', 'bk-' + (x.name || 'x')); }); }
/* Chrome propose « Enregistrer l'adresse » quand il voit un formulaire envoyé avec une adresse.
   On n'envoie plus de vrai « submit » (le bouton appelle directement l'enregistrement) et on vide les champs à la fermeture. */
function noSubmit(root) { root.querySelectorAll('form').forEach(f => { if (f.dataset.ns) return; f.dataset.ns = 1;
  const run = btn => { if (!f.reportValidity()) return; if (typeof f.onsubmit === 'function') f.onsubmit({ preventDefault() { }, stopPropagation() { }, target: f, currentTarget: f, submitter: btn }); };
  const btns = [...f.querySelectorAll('button[type=submit],button:not([type])'), ...(f.id ? root.querySelectorAll(`button[form="${f.id}"]`) : [])];
  btns.forEach(b => { if (b.type !== 'submit') return; b.type = 'button'; b.addEventListener('click', e => setTimeout(() => { if (!e.defaultPrevented && !b.disabled) run(b); })); });
  f.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.defaultPrevented && e.target.tagName === 'INPUT' && !/checkbox|radio|file|button|submit/.test(e.target.type) && !e.isComposing) { e.preventDefault(); run(); } }); }); }
function wipe(root) { root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not([type=password]),textarea').forEach(x => { x.value = ''; }); }
function openPanel(html) { const P = $('#panel'); P.classList.remove('wide'); P.innerHTML = html; noFill(P); noSubmit(P); P.classList.add('on'); P.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on'); P.querySelector('.x').onclick = closePanel; }
function closePanel() { const P = $('#panel'); wipe(P); P.classList.remove('on'); P.setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }
$('#scrim').onclick = closePanel; document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/mp4', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
/* Copie le fichier en mémoire tout de suite (une photo glissée depuis Messages ou WhatsApp peut disparaître juste après le dépôt) et corrige son type s'il est vide */
async function fixFile(f, quiet) {
  if (!f) return null; const ext = (f.name.split('.').pop() || '').toLowerCase(), type = f.type || MIME[ext] || 'application/octet-stream';
  if (/heic|heif/.test(type) || /^(heic|heif)$/.test(ext)) { try { const j = await heicToJpeg(f); return new File([j], (f.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' }); } catch (e) { } }
  try { const buf = await f.arrayBuffer(); if (!buf.byteLength) throw new Error('vide'); const nm = !f.name || /^image\.(png|tiff?|jpe?g)$/i.test(f.name) ? 'photo-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '-' + Math.random().toString(36).slice(2, 5) + '.' + (type.split('/')[1] || 'png').replace('jpeg', 'jpg') : f.name; return new File([buf], nm, { type }); }
  catch (e) { if (!quiet) toast('Cette photo ne peut pas être glissée depuis Messages : faites clic droit › Copier sur la photo, puis Cmd + V ici'); return null; }
}
/* Coller (Cmd+V) une photo copiée depuis Messages, WhatsApp, Aperçu… dans le formulaire ouvert */
/* Messages (Mac) met dans le presse-papiers un lien vers son fichier, que Chrome n'a pas le droit de lire : on récupère alors l'image elle-même via l'API presse-papiers */
async function clipImages() {
  if (!navigator.clipboard || !navigator.clipboard.read) return [];
  const out = []; for (const it of await navigator.clipboard.read()) { const t = it.types.find(x => x.startsWith('image/')); if (!t) continue; const b = await it.getType(t);
    out.push(new File([b], 'photo-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '-' + Math.random().toString(36).slice(2, 5) + '.' + (t.split('/')[1] || 'png'), { type: t })); }
  return out;
}
const jlog = (quoi, detail) => { try { sb.from('journal').insert({ quoi, detail, ua: navigator.userAgent.slice(0, 200) }).then(() => { }, () => { }); } catch (e) { } };
async function pasteFiles(fl) { const ok = (await Promise.all(fl.map(f => fixFile(f, true)))).filter(Boolean); if (ok.length === fl.length && ok.length) return ok;
  try { const c = await clipImages(); jlog('cmdv-clip', { n: c.length }); if (c.length) return ok.concat(c); } catch (e) { jlog('cmdv-clip', { err: e.name + ': ' + e.message }); toast('Autorisez l’accès au presse-papiers (bouton « Autoriser » en haut de Chrome), puis refaites Cmd + V'); return ok; }
  if (!ok.length) toast('Impossible de lire cette photo. Dans Messages : clic droit › Copier, puis Cmd + V ici'); return ok; }
document.addEventListener('paste', e => { if (!window.__bkPaste) return; const fl = [...(e.clipboardData?.files || [])], img = [...(e.clipboardData?.items || [])].some(x => x.kind === 'file' || x.type.startsWith('image/'));
  jlog('cmdv', { types: [...(e.clipboardData?.types || [])], items: [...(e.clipboardData?.items || [])].map(x => x.kind + ':' + x.type), files: fl.map(f => f.name + '|' + f.type + '|' + f.size) });
  if (!fl.length && !img) return; e.preventDefault(); pasteFiles(fl).then(ok => { if (ok.length) window.__bkPaste(ok, true); }); });
/* Photos HEIC (iPhone) : Chrome ne sait pas les afficher, on les convertit à la volée */
const isHeic = n => /\.(heic|heif)$/i.test(String(n || '').split('?')[0]);
let heicP = null; const HEICJS = ['https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js', 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'];
const loadHeic = () => heicP || (heicP = new Promise((ok, ko) => { if (window.heic2any) return ok(window.heic2any); let k = 0; const nx = () => { if (k >= HEICJS.length) { heicP = null; return ko(new Error('convertisseur HEIC indisponible')); } const sc = document.createElement('script'); sc.src = HEICJS[k++]; sc.onload = () => ok(window.heic2any); sc.onerror = nx; document.head.appendChild(sc); }; nx(); }));
const heicCache = {};
async function heicToJpeg(blob) { const h = await loadHeic(); const r = await h({ blob, toType: 'image/jpeg', quality: .85 }); return Array.isArray(r) ? r[0] : r; }
async function viewUrl(u, path) { if (!isHeic(path)) return u; if (heicCache[path]) return heicCache[path]; const b = await fetch(u).then(r => r.blob()); return heicCache[path] = URL.createObjectURL(await heicToJpeg(b)); }
function setThumb(a, u, path) { const im = a.querySelector('img'); if (!im) return; if (!isHeic(path)) { im.src = u; return; } viewUrl(u, path).then(x => { im.src = x; }).catch(() => { im.replaceWith(Object.assign(document.createElement('span'), { className: 'ic', innerHTML: ic('image') })); }); }
/* Télécharger / copier / glisser une photo vers Mail */
const fname = (name, path) => { let n = String(name || path || 'fichier').split('/').pop().split('?')[0].trim(); return isHeic(n) ? n.replace(/\.(heic|heif)$/i, '.jpg') : n; };
async function fileBlob(url, path) { if (isHeic(path)) { const u = await viewUrl(url, path); return fetch(u).then(r => r.blob()); } return fetch(url).then(r => r.blob()); }
async function dlFile(url, path, name) { try { const b = await fileBlob(url, path), u = URL.createObjectURL(b), a = Object.assign(document.createElement('a'), { href: u, download: fname(name, path) }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (e) { toast('Téléchargement impossible : ' + (e.message || e)); } }
async function copyPhoto(url, path) {
  try { const b = await fileBlob(url, path), bmp = await createImageBitmap(b), k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const png = await new Promise(r => c.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); toast('Photo copiée : faites Cmd + V dans votre mail'); }
  catch (e) { toast('Copie impossible, utilisez « Télécharger » (' + (e.message || e) + ')'); }
}
/* Glisser une pièce jointe hors de l'appli (vers Mail, le Bureau…) : Chrome la transmet comme un vrai fichier */
document.addEventListener('dragstart', e => { const a = e.target.closest && e.target.closest('#panel .ph a[href]'); if (!a) return; const h = a.getAttribute('href'); if (!h || h === '#') return;
  const path = a.dataset.p || a.dataset.pb || a.dataset.dp || a.dataset.rp || h, n = fname((a.textContent || '').trim() || 'photo.jpg', path), im = a.querySelector('img'), src = im && im.src.startsWith('blob:') ? im.src : h;
  const ext = n.split('.').pop().toLowerCase(), mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', mov: 'video/quicktime', mp4: 'video/mp4' }[ext] || 'application/octet-stream';
  try { e.dataTransfer.setData('DownloadURL', `${mime}:${n.replace(/:/g, '-')}:${new URL(src, location.href).href}`); } catch (x) { } });
/* Visionneuse intégrée : photos, vidéos et PDF s'ouvrent dans l'application */
let vGal = null;
function viewer(url, path, name, gal) {
  vGal = gal || null;
  let v = $('#viewer'); if (!v) { v = document.createElement('div'); v.id = 'viewer'; document.body.appendChild(v); v.onclick = e => { if (e.target.closest('[data-vp]')) return vStep(-1); if (e.target.closest('[data-vn]')) return vStep(1); if (e.target === v || e.target.classList.contains('vbody') || e.target.classList.contains('vload') || e.target.closest('[data-vx]')) { v.classList.remove('on'); const m = v.querySelector('video'); if (m) m.pause(); } };
    document.addEventListener('keydown', e => { if (!v.classList.contains('on')) return; if (e.key === 'Escape') { e.stopImmediatePropagation(); v.classList.remove('on'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); vStep(e.key === 'ArrowRight' ? 1 : -1); } }, true);
    let acc = 0, tw; v.addEventListener('wheel', e => { if (!vGal || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); acc += e.deltaX; clearTimeout(tw); tw = setTimeout(() => { acc = 0; }, 220); if (Math.abs(acc) > 90) { vStep(acc > 0 ? 1 : -1); acc = 0; } }, { passive: false }); }
  const ext = String(path || name || '').split('?')[0].split('.').pop().toLowerCase(), img = /^(jpe?g|png|webp|gif|heic|heif)$/.test(ext), vid = /^(mp4|mov|m4v|webm)$/.test(ext), pdf = ext === 'pdf';
  v.innerHTML = `<div class="vbar"><b>${E(name || '')}</b>${img ? `<button class="btn btn-line" data-vc>${ic('clipboard')} Copier la photo</button>` : ''}<button class="btn btn-line" data-vd>${ic('download')} Télécharger</button><button class="btn btn-line" data-vx>Fermer ×</button></div><div class="vbody">${img ? '<p class="vload">Chargement…</p>' : vid ? `<video src="${url}" controls autoplay playsinline></video>` : pdf ? `<iframe src="${url}#toolbar=1" title="${E(name || '')}"></iframe>` : `<p class="vload">Aperçu indisponible pour ce type de fichier. Utilisez « Télécharger ».</p>`}</div>`;
  if (vGal && vGal.list.length > 1) { v.insertAdjacentHTML('beforeend', `<button class="varr l" data-vp aria-label="Photo précédente">‹</button><button class="varr r" data-vn aria-label="Photo suivante">›</button><div class="vcount">${vGal.k + 1} / ${vGal.list.length} · flèches ← → ou glisser deux doigts</div>`); }
  v.classList.add('on');
  v.querySelector('[data-vd]').onclick = () => dlFile(url, path, name);
  if (v.querySelector('[data-vc]')) v.querySelector('[data-vc]').onclick = () => copyPhoto(url, path);
  if (img) viewUrl(url, path).then(x => { const b = v.querySelector('.vbody'); if (b) b.innerHTML = `<img src="${x}" alt="${E(name || '')}">`; }).catch(e => { const b = v.querySelector('.vbody'); if (b) b.innerHTML = '<p class="vload">Impossible d’afficher cette photo (' + E(e.message || e) + '). Utilisez « Télécharger ».</p>'; });
}
const vInfo = a => [a.getAttribute('href'), a.dataset.p || a.dataset.pb || a.dataset.dp || a.dataset.rp || a.getAttribute('href'), (a.textContent || '').trim()];
function vStep(n) { if (!vGal || vGal.list.length < 2) return; vGal.k = (vGal.k + n + vGal.list.length) % vGal.list.length; const [h, p, nm] = vInfo(vGal.list[vGal.k]); viewer(h, p, nm, vGal); }
document.addEventListener('click', e => { const a = e.target.closest('#panel .ph a[href]'); if (!a || e.target.closest('.rm') || e.metaKey || e.ctrlKey) return; const h = a.getAttribute('href'); if (!h || h === '#') return; e.preventDefault();
  const list = [...a.closest('.ph').querySelectorAll('a[href]')].filter(x => x.getAttribute('href') && x.getAttribute('href') !== '#' && x.querySelector('img'));
  const [hh2, p, nm] = vInfo(a); viewer(hh2, p, nm, list.includes(a) && list.length > 1 ? { list, k: list.indexOf(a) } : null); });
/* Une pièce jointe peut être partagée par toutes les dates d'une série : on ne supprime le fichier que s'il n'est plus utilisé */
async function rmIfAlone(bucket, paths) { paths = [...new Set(paths)]; if (!paths.length) return; const { data } = await sb.from('pieces').select('path').in('path', paths); const used = new Set((data || []).map(x => x.path)); const free = paths.filter(p => !used.has(p)); if (free.length) await sb.storage.from(bucket).remove(free); }
const kindOf = f => f.type.startsWith('image/') ? 'photo' : f.type.startsWith('video/') ? 'video' : f.type === 'application/pdf' ? 'pdf' : 'autre';
async function signed(bucket, paths) { if (!paths.length) return {}; const { data } = await sb.storage.from(bucket).createSignedUrls(paths, 3600); const o = {}; (data || []).forEach(u => o[u.path] = u.signedUrl); return o; }

async function detail(id, given) {
  const i = given || inter.find(x => x.id === id); if (!i) return;
  const [{ data: pieces }, dem] = await Promise.all([sb.from('pieces').select('*').eq('intervention_id', id).order('created_at'), i.demande_id ? sb.from('demandes').select('*').eq('id', i.demande_id).maybeSingle() : Promise.resolve({ data: null })]);
  const d = dem.data;
  openPanel(`<header><div><span class="tag s-${i.statut}" style="margin:0">${STAT_I[i.statut]}</span>${i.devis ? `<span class="tag t-dv">${ic('file')} Devis${i.devis_fait ? ' fait' : ''}</span>` : ''}${i.epingle ? '<span class="tag t-aff">' + ic('pin') + ' Dans la journée</span>' : ''}<h2 style="margin-top:8px">${E(i.type === 'intervention' ? ([i.client, i.occupant].filter(Boolean).join(' · ') || i.adresse || i.ville || 'Intervention') : i.travaux)}</h2>
    ${i.type === 'intervention' && (i.client || i.occupant) ? `<div style="font-weight:700;font-size:14px;margin-top:2px">${E([i.adresse, [i.cp, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</div>` : ''}
    <div style="color:var(--mute);font-size:13.5px">${E(i.client || i.occupant ? '' : (i.ville || '') + ' · ')}${lbl(i.date, true)}${i.epingle ? '' : ' · ' + hh(i.heure) + '–' + fin(i.heure, i.duree)}</div></div><button class="x" aria-label="Fermer">×</button></header>
  <div class="body">
    <div class="chips">${i.techs.map(t => `<span><i style="background:${T(t).couleur}"></i>${E(T(t).nom)}</span>`).join('')}${i.recurrent ? '<span>↻ Récurrente</span>' : ''}</div>
    ${i.type === 'intervention' ? `<dl class="kv"><dt>Client</dt><dd>${E(i.client || '—')}</dd><dt>Occupant</dt><dd>${E(i.occupant || '—')}</dd><dt>Téléphone</dt><dd>${i.tel ? `<a href="tel:${E(i.tel.replace(/\s/g, ''))}">${E(i.tel)}</a>` : '—'}</dd><dt>Adresse</dt><dd>${(() => { const ad = [i.adresse, [i.cp, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '); return ad ? `<a class="plans" href="maps://?q=${encodeURIComponent(ad + ', France')}" title="Ouvrir dans Plans">${ic('map')} ${E(ad)}</a> <a class="gmaps" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ad + ', France')}" target="_blank" rel="noopener">Google Maps</a>` : '—'; })()}${i.complement ? `<br><span style="color:var(--mute)">${E(i.complement)}</span>` : ''}</dd></dl>` : ''}
    <div class="box"><h4>Travaux à effectuer</h4>${E(i.travaux || '—')}</div>
    ${i.materiel.length ? `<div class="box"><h4>${ic('package')} Matériel nécessaire</h4><ul class="mat">${i.materiel.map(m => `<li>${E(m)}</li>`).join('')}</ul></div>` : ''}
    ${(pieces || []).filter(p => p.prive).length ? `<div class="box priv"><h4>${ic('file')} Devis et documents du bureau <small>(non visibles par les techniciens)</small></h4><div class="ph" id="pjb">${pieces.filter(p => p.prive).map(p => `<a target="_blank" rel="noopener" data-pb="${E(p.path)}">${p.type === 'photo' ? '<img alt="">' : `<span class="ic">${ic('file')}</span>`}${E(p.nom)}</a>`).join('')}</div></div>` : ''}
    ${(pieces || []).filter(p => !p.prive).length ? `<div class="box"><h4>${ic('paperclip')} Pièces jointes pour le technicien</h4><div class="ph" id="pj">${pieces.filter(p => !p.prive).map(p => `<a target="_blank" rel="noopener" data-p="${E(p.path)}">${p.type === 'photo' ? '<img alt="">' : `<span class="ic">${p.type === 'video' ? ic('film') : ic('file')}</span>`}${E(p.nom)}</a>`).join('')}</div></div>` : ''}
    ${d ? `<div class="box"><h4>${ic('camera')} Demande du site ${E(d.ref)}</h4><div style="margin-bottom:8px">${E(d.message || '')}</div><div class="ph" id="dph">${d.photos.map(p => `<a target="_blank" rel="noopener" data-dp="${E(p.path)}"><img alt="">${E(p.label)}</a>`).join('')}</div></div>` : ''}
    ${i.commentaire || (i.photos || []).length ? `<div class="box" style="border-color:#BFE8D6;background:#F3FBF7"><h4>${ic('check-circle')} Validée par ${i.valide_par ? `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${T(i.valide_par).couleur}"></i> ${E(T(i.valide_par).nom)}` : 'le technicien'}${i.fin_at ? ' · ' + fdate(i.fin_at) : ''}</h4><div style="white-space:pre-line">${E(i.commentaire || '')}</div>${(i.photos || []).length ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-line" id="rpall" type="button">${ic('download')} Télécharger les ${i.photos.length} photo${i.photos.length > 1 ? 's' : ''}</button><span style="font-size:12.5px;color:var(--mute);align-self:center">ou glissez une photo directement dans votre mail</span></div><div class="ph" id="rph" style="margin-top:10px">${i.photos.map(p => `<a target="_blank" rel="noopener" data-rp="${E(p.path)}"><img alt="">${E(p.tag || 'Photo')}</a>`).join('')}</div>` : ''}</div>` : ''}
    <div class="box note ${i.note_bureau ? (i.note_lue ? 'lu' : 'nonlu') : ''}"><h4>${ic('message')} Message pour ${i.techs.length > 1 ? 'les techniciens' : 'le technicien'} <small>(reçu directement sur son application)</small></h4>
      ${i.note_bureau ? `<div class="nlast"><div style="white-space:pre-line">${E(i.note_bureau)}</div><small>Envoyé ${i.note_at ? fdate(i.note_at) : ''} · ${i.note_lue ? '✓ Lu par le technicien' : 'Pas encore lu'}</small></div>` : ''}
      ${i.note_reponse ? `<div class="nrep ${i.note_rep_lue ? '' : 'new'}"><small>${i.note_rep_lue ? '' : '● '}Réponse de ${E(i.note_rep_par ? T(i.note_rep_par).nom : 'technicien')}${i.note_rep_at ? ' · ' + fdate(i.note_rep_at) : ''}</small><div style="white-space:pre-line">${E(i.note_reponse)}</div></div>` : ''}
      <textarea id="nbw" rows="3" placeholder="Ex. : Merci de repasser chez l’occupant pour resserrer le raccord, il reste une goutte."></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn btn-line" id="nbs" type="button">${ic('message')} Envoyer le message</button><button class="btn btn-line" id="nbr" type="button" style="color:#DC2626;border-color:#FCA5A5">↺ Envoyer et mettre « À reprendre »</button></div></div>
    <label style="font-size:13px;font-weight:800;color:var(--mute)">Statut<select id="st" style="display:block;width:100%;margin-top:6px;border:2px solid var(--line);border-radius:10px;padding:10px">${[...new Set([i.statut, 'attente', 'reprendre', 'cloturee'])].map(k => `<option value="${k}" ${k === i.statut ? 'selected' : ''}>${STAT_I[k]}</option>`).join('')}</select></label>
  </div>
  <footer>${['controle', 'attente', 'reprendre'].includes(i.statut) ? `<button class="btn btn-grad" id="clo" style="background:var(--ok,#0E9F6E)">${i.devis && i.statut === 'controle' ? '✓ Devis fait' : '✓ Clôturer'}</button>` : ''}${i.statut === 'controle' ? '<button class="btn btn-line" id="rep" style="color:#DC2626">↺ À reprendre</button><button class="btn btn-line" id="att">En attente</button>' : ''}<button class="btn ${['controle', 'attente', 'reprendre'].includes(i.statut) ? 'btn-line' : 'btn-grad'}" id="ed">Modifier</button><button class="btn btn-line" id="dup">Dupliquer</button><button class="btn btn-line" id="p7">+7 jours</button><button class="btn btn-red" id="del" style="margin-left:auto">Supprimer</button></footer>`);
  if (i.note_reponse && !i.note_rep_lue) { i.note_rep_lue = true; sb.from('interventions').update({ note_rep_lue: true }).eq('id', id).then(() => { const c = document.querySelector(`.ev[data-id="${id}"] .nb`); if (c) c.remove(); }); }
  const urls = await signed('pieces', (pieces || []).filter(p => !p.prive).map(p => p.path));
  signed('bureau', (pieces || []).filter(p => p.prive).map(p => p.path)).then(ub => document.querySelectorAll('#pjb [data-pb]').forEach(a => { const u = ub[a.dataset.pb]; if (u) { a.href = u; setThumb(a, u, a.dataset.pb); } }));
  document.querySelectorAll('#pj [data-p]').forEach(a => { const u = urls[a.dataset.p]; if (u) { a.href = u; setThumb(a, u, a.dataset.p); } });
  if (d) { const u2 = await signed('demandes', d.photos.map(p => p.path)); document.querySelectorAll('#dph [data-dp]').forEach(a => { const u = u2[a.dataset.dp]; if (u) { a.href = u; a.querySelector('img').src = u; } }); }
  if ((i.photos || []).length) signed('retours', i.photos.map(p => p.path)).then(u3 => { document.querySelectorAll('#rph [data-rp]').forEach(a => { const u = u3[a.dataset.rp]; if (u) { a.href = u; setThumb(a, u, a.dataset.rp); } });
    const b = $('#rpall'); if (b) b.onclick = async () => { b.disabled = true; let k = 0; for (const p of i.photos) { const u = u3[p.path]; if (u) { k++; await dlFile(u, p.path, `${(i.client || i.occupant || 'intervention').replace(/[^\w\- ]+/g, '').trim()}-${i.date}-${k}${(p.tag ? '-' + p.tag : '')}.jpg`); await new Promise(r => setTimeout(r, 350)); } } b.disabled = false; toast(k + ' photo' + (k > 1 ? 's' : '') + ' téléchargée' + (k > 1 ? 's' : '') + ' (dossier Téléchargements)'); }; });
  if ($('#clo')) $('#clo').onclick = () => cloturer(id, i.devis && i.statut === 'controle');
  $('#st').onchange = async e => { const v = e.target.value; if (v === 'reprendre') { if (!(await aReprendre(i, $('#nbw').value))) e.target.value = i.statut; return; }
    if (v === 'cloturee') return cloturer(id);
    const row = v === 'attente' ? await attenteRow() : { statut: v }; if (!row) { e.target.value = i.statut; return; }
    const { error } = await sb.from('interventions').update(row).eq('id', id); if (error) return toast('Erreur : ' + error.message); i.statut = v; await refreshView(); detail(id); toast(v === 'attente' ? 'En attente · visible dans Chantiers & suivi' : 'Statut : ' + STAT_I[v]); };
  $('#nbs').onclick = async () => { const t = $('#nbw').value.trim(); if (t.length < 2) return toast('Écrivez le message'); await noteTech(i, t); detail(id); };
  $('#nbr').onclick = async () => { if (await aReprendre(i, $('#nbw').value)) detail(id); };
  if ($('#rep')) $('#rep').onclick = async () => { if (await aReprendre(i, $('#nbw').value)) detail(id); };
  if ($('#att')) $('#att').onclick = async () => { const row = await attenteRow(); if (!row) return; const { error } = await sb.from('interventions').update(row).eq('id', id); if (error) return toast('Erreur : ' + error.message); Object.assign(i, row); await refreshView(); detail(id); toast('En attente · visible dans Chantiers & suivi'); };
  $('#ed').onclick = () => form(i); $('#dup').onclick = () => duplicate(i);
  $('#p7').onclick = async () => { await sb.from('interventions').update({ date: iso(addDays(new Date(i.date + 'T12:00'), 7)) }).eq('id', id); closePanel(); await refreshView(); toast('Reprogrammée la semaine suivante'); };
  $('#del').onclick = async () => { let ids = [id];
    if (i.serie) { const { data: nx } = await sb.from('interventions').select('id').eq('serie', i.serie).gt('date', i.date); if ((nx || []).length && await ask(`Cette intervention fait partie d’une série (${nx.length} date${nx.length > 1 ? 's' : ''} après celle-ci).`, { ok: `Supprimer aussi les ${nx.length} suivantes`, cancel: 'Seulement celle-ci', danger: true })) ids = ids.concat(nx.map(x => x.id)); else if (!await ask('Supprimer seulement cette date ?')) return; }
    else if (!await ask('Supprimer définitivement cette intervention ?')) return;
    const { data: pcs } = await sb.from('pieces').select('path,prive').in('intervention_id', ids);
    if ((i.photos || []).length) await sb.storage.from('retours').remove(i.photos.map(p => p.path));
    const { error } = await sb.from('interventions').delete().in('id', ids); if (error) return toast('Erreur : ' + error.message);
    await rmIfAlone('pieces', (pcs || []).filter(p => !p.prive).map(p => p.path)); await rmIfAlone('bureau', (pcs || []).filter(p => p.prive).map(p => p.path));
    closePanel(); await refreshView(); toast(ids.length > 1 ? ids.length + ' interventions supprimées' : 'Intervention supprimée'); };
}

/* ================= Formulaire intervention ================= */
async function form(i, opts) {
  opts = opts || {}; const isNew = !i || !i.id;
  i = { type: opts.epingle ? 'tache' : 'intervention', date: mode === 'jour' ? day : iso(new Date()), heure: '09:00', duree: 1, epingle: !!opts.epingle, statut: 'planifiee', client: '', occupant: '', tel: '', adresse: '', complement: '', cp: '', ville: '', travaux: '', materiel: [], recurrent: false, techs: [], demande_id: null, ...(i || {}), ...(opts.pre || {}) };
  let existing = []; if (!isNew) { const { data } = await sb.from('pieces').select('*').eq('intervention_id', i.id); existing = data || []; }
  const add = { tech: [], bur: [] }; let removed = [];
  const debut = (i.heure || '09:00').slice(0, 5), finH = hm(Math.min(mins(debut) + Math.round((+i.duree || 1) * 60), 23 * 60 + 45));
  const who = (list, label) => list.length ? `<div class="whog"><small>${label}</small><div class="checks">${list.map(t => `<label><input type="checkbox" name="techs" value="${t.id}" ${i.techs.includes(t.id) ? 'checked' : ''}><i style="width:10px;height:10px;border-radius:50%;background:${t.couleur};display:inline-block"></i>${E(t.nom)}</label>`).join('')}</div></div>` : '';
  const upl = (k, title, help) => `<div class="full upl ${k === 'bur' ? 'priv' : ''}"><div class="ut">${title} <span>${help}</span></div><div class="ph" id="pj-${k}"></div><div class="dz"><label class="btn btn-line">+ Ajouter des fichiers<input type="file" id="in-${k}" multiple accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" class="sr"></label><button type="button" class="btn btn-line" data-clip="${k}">${ic('paperclip')} Coller la photo copiée</button><span>ou glissez-les ici</span></div></div>`;
  openPanel(`<header><h2>${isNew ? (i.epingle ? ic('pin') + ' Rappel dans la journée' : opts.ctx && /^Copie/.test(opts.ctx) ? 'Dupliquer l’intervention' : 'Planifier') : 'Modifier'}</h2>${isNew ? '' : `<button type="button" class="btn btn-line" id="tofi" style="margin-left:auto;margin-right:8px">${ic('eye')} Fiche, photos, retour</button>`}<button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="f"><div class="form">
    ${opts.ctx ? `<div class="full box" style="background:var(--soft);border:0"><b>${E(opts.ctx)}</b></div>` : ''}
    ${opts.demande ? `<div class="full box" style="background:var(--soft);border:0"><b>${ic('camera')} Depuis la demande ${E(opts.demande.ref)}</b> · ${E(opts.demande.service)}. Ses photos seront visibles par le technicien.</div>` : ''}
    <label>Type<select name="type"><option value="intervention">Intervention</option><option value="devis" ${i.devis ? 'selected' : ''}>Devis (visite pour faire un devis)</option><option value="tache" ${i.type === 'tache' ? 'selected' : ''}>Tâche (matériel, déchetterie…)</option><option value="interne" ${i.type === 'interne' ? 'selected' : ''}>Rendez-vous / bureau (devis, réunion…)</option></select></label>
    <label>Date<input type="date" name="date" value="${i.date}" required></label>
    <label class="full inline pinbox"><input type="checkbox" name="epingle" ${i.epingle ? 'checked' : ''}> ${ic('pin')} Rappel dans la journée, sans heure précise (affiché en haut du planning)</label>
    <label class="hr">De<input type="time" name="heure" value="${debut}" step="60"></label>
    <label class="hr">À<input type="time" name="fin" value="${finH}" step="60"></label>
    <div class="full"><div style="font-size:13px;font-weight:800;color:var(--mute);margin-bottom:6px">Qui ? <span style="font-weight:600">· plusieurs = équipe</span></div>${who(techs.filter(t => !isBureau(t)), 'Techniciens')}${who(techs.filter(isBureau), 'Bureau')}</div>
    <label>Client (agence, syndic, particulier)<input name="client" value="${E(i.client)}"></label>
    <label>Occupant<input name="occupant" value="${E(i.occupant)}"></label>
    <label class="full">Adresse<input name="adresse" value="${E(i.adresse)}" autocomplete="off" placeholder="Tapez le début de l’adresse, puis choisissez dans la liste"></label>
    <label class="full">Complément d’adresse (facultatif)<input name="complement" value="${E(i.complement || '')}" autocomplete="off" placeholder="Résidence, bâtiment, étage, n° d’appartement, code…"></label>
    <label>Code postal<input name="cp" value="${E(i.cp)}" inputmode="numeric" maxlength="5"></label>
    <label>Ville<input name="ville" value="${E(i.ville)}" list="villes"></label>
    <label class="full">Téléphone de l’occupant<input name="tel" type="tel" value="${E(i.tel)}"></label>
    <label class="full">Travaux à effectuer<textarea name="travaux">${E(i.travaux)}</textarea></label>
    <label class="full">${ic('package')} Matériel nécessaire <span style="font-weight:600">(une ligne par élément)</span><textarea name="materiel" placeholder="Ex. : Siphon PVC Ø40&#10;Flexible inox 50 cm">${E((i.materiel || []).join('\n'))}</textarea></label>
    ${upl('tech', ic('paperclip') + ' Pièces jointes pour le technicien', '(photos, vidéos, PDF · facultatif)')}
    ${upl('bur', ic('file') + ' Devis et documents du bureau', '(visibles uniquement par le bureau, jamais par les techniciens)')}
    ${isNew ? `<div class="full rep"><label>Répéter<select name="rep"><option value="">Non, une seule fois</option><option value="j">Chaque jour, du lundi au vendredi (chantier sur plusieurs jours)</option><option value="s1">Chaque semaine</option><option value="s2">Toutes les 2 semaines</option><option value="m1">Chaque mois (relevé de compteur…)</option><option value="m3">Tous les 3 mois</option><option value="m6">Tous les 6 mois</option><option value="a1">Chaque année (contrat d’entretien)</option></select></label>
      <label class="repu" hidden>Jusqu’au<input type="date" name="jusqu"></label><p class="repn" hidden></p></div>`
    : (i.serie ? `<p class="full" style="margin:0;color:var(--mute);font-size:13px">↻ Fait partie d’une série : seule cette date est modifiée.</p>` : '')}
  </div><datalist id="villes">${['Istres', 'Miramas', 'Martigues', 'Fos-sur-Mer', 'Port-de-Bouc', 'Saint-Chamas', 'Cornillon-Confoux', 'Grans', 'Salon-de-Provence', 'Vitrolles', 'Marignane', 'Sausset-les-Pins', 'Port-Saint-Louis-du-Rhône', 'Aix-en-Provence', 'Marseille'].map(v => `<option value="${v}">`).join('')}</datalist></form>
  <footer><button class="btn btn-grad" form="f" type="submit" id="sv">${isNew ? 'Planifier' : 'Enregistrer'}</button><button class="btn btn-line" type="button" id="cc">Annuler</button></footer>`);
  const f = $('#f'); acIntervention(f, i); acAdresse(f); if ($('#tofi')) $('#tofi').onclick = () => detail(i.id);
  const occ = () => { const rp = f.rep ? f.rep.value : '', start = f.date.value; if (!rp || !start) return [start];
    const end = f.jusqu.value, out = [], d0 = new Date(start + 'T12:00'), lim = end ? new Date(end + 'T12:00') : null;
    if (!lim || lim < d0) return [start];
    const u = rp[0], n = +rp.slice(1) || 1;
    for (let k = 0; out.length < 400; k++) { let d;
      if (u === 'j') d = addDays(d0, k); else if (u === 's') d = addDays(d0, 7 * n * k);
      else { const mm = u === 'a' ? 12 * k : n * k, y = d0.getFullYear(), m = d0.getMonth() + mm, last = new Date(y, m + 1, 0).getDate(); d = new Date(y, m, Math.min(d0.getDate(), last), 12); }
      if (d > lim) break; if (u === 'j' && [0, 6].includes(d.getDay())) continue; out.push(iso(d)); }
    return out; };
  if (f.rep) { const upd = () => { const on = !!f.rep.value; f.querySelector('.repu').hidden = !on; const n = f.querySelector('.repn'); const o = on ? occ() : []; n.hidden = !on;
      n.textContent = !on ? '' : !f.jusqu.value ? 'Choisissez la date de fin.' : o.length > 1 ? `${o.length} dates seront créées : du ${lbl(o[0])} au ${lbl(o[o.length - 1])}.` : 'La date de fin doit être après la date de début.'; };
    f.rep.onchange = () => { if (f.rep.value && !f.jusqu.value) { const d = new Date(f.date.value + 'T12:00'), u = f.rep.value[0]; f.jusqu.value = iso(u === 'j' ? addDays(d, 4) : u === 's' ? addDays(d, 7 * 8) : new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1, 12)); } upd(); };
    f.jusqu.onchange = upd; f.date.addEventListener('change', upd); }
  const syncPin = () => f.querySelectorAll('.hr').forEach(l => l.style.display = f.epingle.checked ? 'none' : ''); f.epingle.onchange = syncPin; syncPin();
  let dur = mins(f.fin.value) - mins(f.heure.value);
  f.heure.onchange = () => { f.fin.value = hm(Math.min(mins(f.heure.value) + Math.max(dur, 15), 23 * 60 + 45)); };
  f.fin.onchange = () => { dur = mins(f.fin.value) - mins(f.heure.value); };
  const icon = (t, n) => t === 'photo' ? '<span class="ic">' + ic('image') + '</span>' : `<span class="ic">${t === 'video' ? ic('film') : ic('file')}</span>`;
  const draw = k => { const ex = existing.filter(p => !!p.prive === (k === 'bur') && !removed.includes(p.id));
    $('#pj-' + k).innerHTML = ex.map(p => `<a data-${p.prive ? 'pb' : 'p'}="${E(p.path)}" ${exU[p.path] ? `href="${exU[p.path]}"` : ''}>${p.type === 'photo' ? '<img alt="">' : icon(p.type)}${E(p.nom)}<button type="button" class="rm" data-rme="${p.id}">×</button></a>`).join('') + add[k].map((x, n) => `<a>${kindOf(x) === 'photo' ? `<img src="${URL.createObjectURL(x)}" alt="">` : icon(kindOf(x))}${E(x.name)}<button type="button" class="rm" data-rma="${k}:${n}">×</button></a>`).join('') || '<span style="font-size:13px;color:var(--mute)">Aucun.</span>';
    $('#pj-' + k).querySelectorAll('a[href]').forEach(a => setThumb(a, a.getAttribute('href'), a.dataset.p || a.dataset.pb));
    $('#pj-' + k).querySelectorAll('[data-rme]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); removed.push(b.dataset.rme); draw(k); });
    $('#pj-' + k).querySelectorAll('[data-rma]').forEach(b => b.onclick = () => { const [kk, n] = b.dataset.rma.split(':'); add[kk].splice(+n, 1); draw(kk); }); };
  const addFiles = async (k, list) => { const all = (await Promise.all([...list].map(fixFile))).filter(Boolean), big = all.filter(x => x.size > 50 * 1024 * 1024); if (big.length) toast('Fichier trop lourd (50 Mo max) : ' + big[0].name); const ok = all.filter(x => x.size <= 50 * 1024 * 1024); add[k] = add[k].concat(ok); draw(k); if (ok.length) toast(ok.length > 1 ? ok.length + ' fichiers ajoutés' : 'Fichier ajouté : ' + ok[0].name); };
  const exU = {}; ['pieces', 'bureau'].forEach(bk => { const ps = existing.filter(p => !!p.prive === (bk === 'bureau')).map(p => p.path); if (ps.length) signed(bk, ps).then(u => { Object.assign(exU, u); draw(bk === 'bureau' ? 'bur' : 'tech'); }); });
  ['tech', 'bur'].forEach(k => { draw(k); $('#in-' + k).onchange = e => { addFiles(k, e.target.files); e.target.value = ''; };
    const z = $('#pj-' + k).closest('.upl'); let dc = 0;
    z.addEventListener('dragenter', e => { e.preventDefault(); dc++; z.classList.add('drop'); });
    z.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    z.addEventListener('dragleave', () => { if (--dc <= 0) { dc = 0; z.classList.remove('drop'); } });
    z.addEventListener('drop', e => { e.preventDefault(); dc = 0; z.classList.remove('drop'); addFiles(k, e.dataTransfer.files); }); });
  let pasteK = 'tech'; ['tech', 'bur'].forEach(k => $('#pj-' + k).closest('.upl').addEventListener('pointerdown', () => { pasteK = k; }));
  window.__bkPaste = (fl, ready) => { if (!document.body.contains(f)) return false; ready ? addReady(pasteK, fl) : addFiles(pasteK, fl); return true; };
  f.querySelectorAll('[data-clip]').forEach(b => b.onclick = async () => { const k = b.dataset.clip; let c = [], err = '';
    try { c = await clipImages(); } catch (e) { err = e.name || 'Erreur'; }
    if (c.length) return addReady(k, c);
    toast(err === 'NotAllowedError' ? 'Chrome bloque l’accès au presse-papiers : cliquez sur le cadenas à gauche de l’adresse › Presse-papiers › Autoriser, puis recommencez'
      : err ? 'Erreur presse-papiers (' + err + ')' : 'Aucune photo dans le presse-papiers : faites d’abord clic droit sur la photo › Copier');
    jlog('bouton', { err: err || null, n: c.length }); });
  const addReady = (k, ok) => { add[k] = add[k].concat(ok); draw(k); toast(ok.length > 1 ? ok.length + ' photos ajoutées' : 'Photo ajoutée'); };
  $('#cc').onclick = closePanel;
  f.onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(f), ts = fd.getAll('techs'); if (!ts.length) return toast('Choisissez au moins une personne');
    const pin = !!fd.get('epingle'), d1 = mins(fd.get('heure') || '09:00'), d2 = mins(fd.get('fin') || '10:00');
    if (!pin && d2 <= d1) return toast('L’heure de fin doit être après l’heure de début');
    const btn = $('#sv'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    const ty = fd.get('type');
    const row = { type: ty === 'devis' ? 'intervention' : ty, devis: ty === 'devis', date: fd.get('date'), epingle: pin, heure: pin ? null : hm(d1), duree: pin ? 0 : Math.round((d2 - d1) / 60 * 10000) / 10000, travaux: fd.get('travaux'), adresse: fd.get('adresse'), complement: fd.get('complement') || null, cp: fd.get('cp'), ville: fd.get('ville'), client: fd.get('client'), occupant: fd.get('occupant'), tel: fd.get('tel'),
      materiel: String(fd.get('materiel') || '').split('\n').map(x => x.trim()).filter(Boolean), recurrent: !!fd.get('rep') || !!i.recurrent, demande_id: i.demande_id || null, chantier_id: i.chantier_id || null, affaire_id: i.affaire_id || null, client_id: i.client_id || null };
    try {
      let id = i.id, ids = [];
      const dates = isNew ? occ() : [row.date];
      if (isNew && dates.length > 1 && !await ask(`Créer ${dates.length} interventions, du ${lbl(dates[0])} au ${lbl(dates[dates.length - 1])} ?`)) { btn.disabled = false; btn.textContent = 'Planifier'; return; }
      if (isNew) { const serie = dates.length > 1 ? (crypto.randomUUID ? crypto.randomUUID() : null) : null;
        const r = await sb.from('interventions').insert(dates.map(dt => ({ ...row, date: dt, serie, created_by: me.id, updated_by: me.id }))).select('id,date'); if (r.error) throw r.error;
        ids = r.data.sort((a, b) => a.date.localeCompare(b.date)).map(x => x.id); id = ids[0]; }
      else { const r = await sb.from('interventions').update(row).eq('id', id); if (r.error) throw r.error; }
      const cur = isNew ? [] : i.techs, plus = ts.filter(t => !cur.includes(t)), moins = cur.filter(t => !ts.includes(t));
      if (plus.length) { const r = await sb.from('intervention_techs').insert((ids.length ? ids : [id]).flatMap(x => plus.map(t => ({ intervention_id: x, tech_id: t })))); if (r.error) throw r.error; }
      for (const t of moins) await sb.from('intervention_techs').delete().match({ intervention_id: id, tech_id: t });
      for (const pid of removed) { const p = existing.find(x => x.id === pid); await sb.from('pieces').delete().eq('id', pid); await rmIfAlone(p.prive ? 'bureau' : 'pieces', [p.path]); }
      const files = add.tech.map(x => [x, false]).concat(add.bur.map(x => [x, true]));
      for (let k = 0; k < files.length; k++) { const [file, prive] = files[k]; btn.textContent = `Envoi des fichiers ${k + 1}/${files.length}…`;
        const path = `${id}/${Date.now()}-${k}-${file.name.normalize('NFD').replace(/[^\w.\-]+/g, '_')}`;
        const up = await sb.storage.from(prive ? 'bureau' : 'pieces').upload(path, file, { contentType: file.type || 'application/octet-stream' }); if (up.error) throw new Error('envoi de « ' + file.name + ' » impossible (' + up.error.message + ')');
        const r = await sb.from('pieces').insert((ids.length ? ids : [id]).map(x => ({ intervention_id: x, nom: file.name, type: kindOf(file), path, prive }))); if (r.error) throw r.error; }
      if (opts.demande) await sb.from('demandes').update({ statut: 'planifiee', traitee_par: me.id, traitee_le: new Date().toISOString() }).eq('id', opts.demande.id);
      closePanel(); week = monday(new Date(row.date + 'T12:00')); if (mode === 'jour') day = row.date; await go('planning');
      toast((pin ? 'Rappel ajouté' : (isNew ? (ids.length > 1 ? ids.length + ' dates planifiées' : 'Planifié') : 'Enregistré')) + ' pour ' + names(ts));
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
  <footer><button class="btn btn-grad" id="plan">${ic('calendar')} Planifier</button>${d.statut !== 'affaire' ? `<button class="btn btn-line" id="toaff">${ic('briefcase')} Créer l’affaire (devis)</button>` : `<button class="btn btn-line" id="toaff">${ic('briefcase')} Voir l’affaire</button>`}${d.statut !== 'archivee' ? `<button class="btn btn-line" data-s="archivee">Archiver</button>` : `<button class="btn btn-line" data-s="nouvelle">Remettre en nouvelle</button>`}</footer>`);
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
async function badgeC() { const [a, b] = await Promise.all([sb.from('interventions').select('id', { count: 'exact', head: true }).eq('statut', 'controle').eq('devis', false), sb.from('interventions').select('id', { count: 'exact', head: true }).eq('statut', 'controle').eq('devis', true)]);
  const c = $('#cc'); if (c) c.textContent = a.count || ''; const d = $('#cdv'); if (d) d.textContent = b.count || ''; }
async function refreshView() { badgeC(); if (view === 'controle' || view === 'devis') await listControle(); else if (view === 'recherche') await listRecherche(); else { await loadPlanning(); planning(); } }
/* Message du bureau : le technicien le reçoit en direct sur son application */
async function noteTech(i, t, extra) {
  const row = { note_bureau: t, note_at: new Date().toISOString(), note_lue: false, note_reponse: null, note_rep_at: null, note_rep_lue: true, ...(extra || {}) };
  const { error } = await sb.from('interventions').update(row).eq('id', i.id); if (error) { toast('Erreur : ' + error.message); return false; }
  Object.assign(i, row); await refreshView(); toast(extra && extra.statut === 'reprendre' ? '↺ À reprendre · ' + names(i.techs) + ' est prévenu sur son application' : 'Message envoyé à ' + names(i.techs)); return true;
}
/* Mise en attente : on note pourquoi (affiché dans « À suivre » de Chantiers) */
async function attenteRow() { const m = await askText('Mise en attente : pourquoi ? (facultatif)\nEx. : pièce à commander, attente validation agence, SAV à prévoir', ''); if (m === null) return null; return { statut: 'attente', attente_motif: m.trim() || null, attente_at: new Date().toISOString() }; }
async function aReprendre(i, txt) {
  let t = (txt || '').trim(); if (t.length < 2) t = (await askText('À reprendre : quel message pour ' + names(i.techs) + ' ?\n(il le reçoit directement sur son application)', '', { multi: true }) || '').trim();
  if (t.length < 2) { toast('Écrivez ce qu’il faut reprendre'); return false; }
  return noteTech(i, t, { statut: 'reprendre' });
}
async function cloturer(id, devisFait) {
  const { error } = await sb.from('interventions').update(devisFait ? { statut: 'cloturee', devis_fait: true, devis_fait_at: new Date().toISOString(), devis_fait_par: me.nom } : { statut: 'cloturee' }).eq('id', id);
  if (error) return toast('Erreur : ' + error.message);
  closePanel(); toast(devisFait ? '✓ Devis fait · c’est noté' : '✓ Intervention clôturée'); badgeC();
  await refreshView();
}
async function listControle() {
  if (view !== 'controle' && view !== 'devis') return; const dv = view === 'devis';
  const [{ data, error }, nx] = await Promise.all([sb.from('interventions').select('*, intervention_techs(tech_id), pieces(id)').eq('statut', 'controle').eq('devis', dv).order('fin_at', { ascending: false }),
    dv ? sb.from('interventions').select('*, intervention_techs(tech_id)').eq('devis', true).in('statut', ['planifiee', 'enroute', 'encours', 'reprendre']).order('date').limit(60) : Promise.resolve({ data: [] })]);
  if (error) return toast('Erreur : ' + error.message);
  ctrl = (data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id), nbPieces: i.pieces.length }));
  const soon = (nx.data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id) }));
  $('#main').innerHTML = `<div class="head"><h1>${dv ? 'Devis à faire' : 'À contrôler'}</h1><span class="live"><i></i>En direct</span></div>
   <p style="color:var(--mute);margin:-6px 0 16px">${dv ? 'Visites « Devis » faites par les techniciens (photos + commentaire). Faites le devis, puis cliquez sur « ✓ Devis fait ».' : 'Interventions validées par les techniciens (photos + commentaire). Vérifiez puis clôturez.'}</p>
   ${ctrl.length ? `<div class="list">${ctrl.map(i => `<button class="d" data-c="${i.id}"><span class="th" data-th="${E((i.photos || [])[0]?.path || '')}">${(i.photos || []).length ? '' : ic('pin')}</span>
     <span><h3>${E(i.type === 'intervention' ? ([i.client, i.occupant].filter(Boolean).join(' · ') || i.adresse || i.ville || 'Intervention') : i.travaux)}${i.epingle ? '<span class="tag t-aff">' + ic('pin') + ' Tâche</span>' : ''}</h3>${i.type === 'intervention' && (i.client || i.occupant) && (i.adresse || i.ville) ? `<p class="cad">${E([i.adresse, [i.cp, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '))}</p>` : ''}<p>${i.valide_par ? `<b>Validée par ${E(T(i.valide_par).nom)}</b>${i.techs.length > 1 ? ' (équipe : ' + E(names(i.techs)) + ')' : ''}` : i.techs.map(t => `<i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${T(t).couleur};margin-right:4px"></i>${E(T(t).nom)}`).join(' · ')} · ${(i.photos || []).length} photo${(i.photos || []).length > 1 ? 's' : ''}${i.commentaire ? ' · « ' + E(i.commentaire.slice(0, 70)) + (i.commentaire.length > 70 ? '…' : '') + ' »' : ''}</p></span>
     <span class="r" style="color:var(--mute);font-size:13px;font-weight:700">${i.fin_at ? fdate(i.fin_at) : lbl(i.date, true)}${dv ? `<span class="dvok" data-dvok="${i.id}" role="button">✓ Devis fait</span>` : ''}</span></button>`).join('')}</div>` : `<div class="empty">${dv ? 'Aucun devis à faire pour l’instant' : 'Rien à contrôler : tout est à jour'} ${ic('check-circle')}</div>`}
   ${dv && soon.length ? `<h2 class="chh" style="margin-top:22px">${ic('calendar')} Visites devis prévues</h2><div class="list soon">${soon.map(i => `<button class="d" data-c="${i.id}"><span><h3>${E([i.client, i.occupant].filter(Boolean).join(' · ') || i.adresse || 'Visite devis')}</h3><p>${lbl(i.date)}${i.heure && !i.epingle ? ' · ' + hh(i.heure) : ''} · ${E(names(i.techs))}${i.adresse ? ' · ' + E([i.adresse, i.ville].filter(Boolean).join(', ')) : ''}</p></span><span class="tag s-${i.statut}" style="margin:0">${STAT_I[i.statut]}</span></button>`).join('')}</div>` : ''}`;
  document.querySelectorAll('[data-dvok]').forEach(b => b.onclick = async e => { e.stopPropagation(); await cloturer(b.dataset.dvok, true); });
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => detail(b.dataset.c, ctrl.find(x => x.id === b.dataset.c) || soon.find(x => x.id === b.dataset.c)));
  const paths = [...document.querySelectorAll('[data-th]')].map(e => e.dataset.th).filter(Boolean);
  signed('retours', paths).then(u => document.querySelectorAll('[data-th]').forEach(el => { if (u[el.dataset.th]) el.style.backgroundImage = `url('${u[el.dataset.th]}')`; }));
}

/* ================= Mots de passe ================= */
const APP_URL = 'https://monsieurh84.github.io/bkplus/app/', TECH_URL = APP_URL + 'tech.html';
const genMdp = () => { const a = 'abcdefghjkmnpqrstuvwxyz', A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', d = '23456789', r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const p = () => A[r(A.length)] + a[r(a.length)] + a[r(a.length)] + a[r(a.length)]; return p() + '-' + p() + '-' + d[r(8)] + d[r(8)]; };
function monMdp() {
  openPanel(`<header><h2>Mon mot de passe</h2><button class="x" aria-label="Fermer">×</button></header>
  <form class="body" id="mf"><div class="form"><label class="full">Nouveau mot de passe (8 caractères minimum)<input type="password" name="a" minlength="8" autocomplete="new-password" required></label>
  <label class="full">Confirmer<input type="password" name="b" minlength="8" autocomplete="new-password" required></label></div></form>
  <footer><button class="btn btn-grad" form="mf" type="submit">Enregistrer</button></footer>`);
  $('#mf').onsubmit = async e => { e.preventDefault(); const f = e.target; if (f.a.value !== f.b.value) return toast('Les deux mots de passe ne correspondent pas');
    const { error } = await sb.auth.updateUser({ password: f.a.value }); if (error) return toast('Erreur : ' + error.message); closePanel(); toast('Mot de passe modifié'); };
}
async function equipe() {
  const { data, error } = await sb.rpc('bureau_comptes'); if (error) return toast('Erreur : ' + error.message);
  const rl = { bureau: 'Bureau', technicien: 'Technicien' };
  openPanel(`<header><div><h2>Équipe & accès</h2><div style="color:var(--mute);font-size:13px">Créez un nouveau mot de passe pour un membre de l’équipe, puis envoyez-lui le message par SMS.</div></div><button class="x" aria-label="Fermer">×</button></header>
  <div class="body">${data.map(u => `<div class="acc"><div><b>${E(u.nom)}</b><span class="tag ${u.role === 'bureau' ? 't-new' : 't-pla'}">${rl[u.role] || u.role}</span><small>${E(u.email)} · ${u.derniere_connexion ? 'dernière connexion ' + fdate(u.derniere_connexion) : 'jamais connecté'}</small></div>
    <button class="btn btn-line" data-u="${u.id}">Nouveau mot de passe</button><div class="nm" id="nm-${u.id}"></div></div>`).join('')}</div>`);
  document.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => {
    const u = data.find(x => x.id === b.dataset.u), mdp = genMdp();
    if (!await ask('Créer un nouveau mot de passe pour ' + u.nom + ' ? L’ancien ne fonctionnera plus.')) return;
    b.disabled = true; const { error } = await sb.rpc('bureau_mdp', { p_user: u.id, p_mdp: mdp }); b.disabled = false;
    if (error) return toast('Erreur : ' + error.message);
    const lien = u.role === 'bureau' ? APP_URL : TECH_URL;
    const msg = `Bonjour ${u.nom.split(' ')[0]}, voici ton accès à l’application BK+ :\n${lien}\nIdentifiant : ${u.email}\nMot de passe : ${mdp}\nTu pourras le changer dans l’application (« Mon mot de passe »).`;
    $('#nm-' + u.id).innerHTML = `<div class="newpw"><span>Nouveau mot de passe : <b>${E(mdp)}</b></span><button class="btn btn-grad" type="button">${ic('clipboard')} Copier le message à envoyer</button></div>`;
    $('#nm-' + u.id).querySelector('button').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('Message copié : collez-le dans un SMS ou WhatsApp'); } catch (e) { askText('Copiez ce message :', msg, { multi: true }); } };
  });
}

/* Sauvegarde complète du planning dans un fichier Excel (en plus des sauvegardes automatiques de la base) */
async function sauvegarde() {
  toast('Préparation de la sauvegarde…'); const rows = []; let from = 0;
  for (;;) { const { data, error } = await sb.from('interventions').select('*, intervention_techs(tech_id)').order('date').order('heure').range(from, from + 999); if (error) return toast('Erreur : ' + error.message); rows.push(...data); if (data.length < 1000) break; from += 1000; }
  const ST = { planifiee: 'Planifiée', enroute: 'En route', encours: 'En cours', controle: 'À contrôler', cloturee: 'Clôturée' };
  const head = ['Date', 'Début', 'Fin', 'Rappel du jour', 'Type', 'Qui', 'Client', 'Occupant', 'Téléphone', 'Adresse', 'Complément', 'Code postal', 'Ville', 'Travaux', 'Matériel', 'Statut', 'Commentaire technicien', 'Validée par', 'Terminée le'];
  const data = rows.map(i => [i.date, i.epingle ? '' : hh(i.heure), i.epingle ? '' : fin(i.heure, i.duree), i.epingle ? 'oui' : '', i.type, names(i.intervention_techs.map(x => x.tech_id)), i.client || '', i.occupant || '', i.tel || '', i.adresse || '', i.complement || '', i.cp || '', i.ville || '', i.travaux || '', (i.materiel || []).join(' / '), ST[i.statut] || i.statut, i.commentaire || '', i.valide_par ? T(i.valide_par).nom : '', i.fin_at ? new Date(i.fin_at).toLocaleString('fr-FR') : '']);
  try { const X = await loadXLSX(), ws = X.utils.aoa_to_sheet([head, ...data]), wb = X.utils.book_new(); ws['!cols'] = head.map((h, k) => ({ wch: [11, 7, 7, 8, 12, 18, 22, 18, 14, 30, 22, 8, 16, 50, 30, 12, 40, 12, 18][k] })); ws['!autofilter'] = { ref: 'A1:S1' };
    X.utils.book_append_sheet(wb, ws, 'Planning'); X.writeFile(wb, `BK-planning-sauvegarde-${iso(new Date())}.xlsx`); toast(rows.length + ' interventions sauvegardées'); }
  catch (e) { toast('Erreur : ' + (e.message || e)); }
}
