/* BK+ — application technicien (iPhone / iPad) : fonctionne aussi sans réseau */
const C = window.BK_CONFIG, sb = supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = s => document.querySelector(s);
const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const lbl = s => new Date(s + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
const hh = t => t ? t.slice(0, 5).replace(':', 'h') : '';
const fin = (t, dur) => { if (!t) return ''; const [h, m] = t.split(':').map(Number), x = h * 60 + m + Math.round((+dur || 1) * 60); return pad(Math.floor(x / 60) % 24) + 'h' + pad(x % 60); };
const nowHHMM = () => { const d = new Date(); return pad(d.getHours()) + 'h' + pad(d.getMinutes()); };
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
const iOS = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
const scr = () => $('#screen');

/* ---------- Petite base locale (brouillons + envois en attente) ---------- */
const DB = { db: null,
  open() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open('bk-tech', 1); r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('queue', { keyPath: 'id' }); }; r.onsuccess = () => res(this.db = r.result); r.onerror = () => rej(r.error); }); },
  async tx(store, mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error); }); },
  get(k) { return this.tx('kv', 'readonly', s => s.get(k)); }, set(k, v) { return this.tx('kv', 'readwrite', s => s.put(v, k)); }, del(k) { return this.tx('kv', 'readwrite', s => s.delete(k)); },
  qAll() { return this.tx('queue', 'readonly', s => s.getAll()); }, qAdd(v) { return this.tx('queue', 'readwrite', s => s.put(v)); }, qDel(id) { return this.tx('queue', 'readwrite', s => s.delete(id)); },
};

/* ---------- État ---------- */
let lastLocal = 0, me = null, tech = null, team = [], preview = false, items = [], tab = 'jour', openId = null, online = navigator.onLine !== false, pending = 0, flushing = false, sun = false, reminderOn = false;
const drafts = {}; const matChk = {}; let navPref = null;
try { sun = localStorage.getItem('bk-sun') === '1'; navPref = localStorage.getItem('bk-nav'); } catch (e) { }
const T = id => team.find(t => t.id === id) || { nom: '?', couleur: '#8B8FA3' };
const stripe = ids => { const c = ids.map(id => T(id).couleur); if (c.length < 2) return c[0] || '#2239A9'; const s = 100 / c.length; return 'linear-gradient(to bottom,' + c.map((x, k) => `${x} ${k * s}% ${(k + 1) * s}%`).join(',') + ')'; };
const avatars = ids => ids.map(id => `<span class="av" style="background:${T(id).couleur}">${E(T(id).nom[0])}</span>`).join('');
function toast(m, undo) { let t = scr()?.querySelector('.toast') || $('#toast'); t.innerHTML = E(m) + (undo ? ' <button>Annuler</button>' : ''); if (undo) t.querySelector('button').onclick = () => { undo(); t.classList.remove('show'); }; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), undo ? 6000 : 2800); }
const ICON = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>' };
const telUrl = t => 'tel:' + String(t || '').replace(/\s/g, '');
const fullAddr = i => [i.adresse, [i.cp, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/* ---------- Connexion ---------- */
function loginView() {
  document.body.innerHTML = `<div class="login"><form id="lf"><img src="../logo-bk.png" alt="BK+"><h1>Bonjour </h1><p>Connectez-vous pour voir vos interventions.</p>
  <label for="em">E-mail</label><input id="em" type="email" autocomplete="username" required><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required>
  <button class="go" type="submit">Se connecter</button><button class="forgot" type="button" id="fg">Mot de passe oublié ?</button><div class="msg" id="m"></div></form></div><div class="toast" id="toast"></div>`;
  $('#fg').onclick = () => { const m = $('#m'); m.className = 'msg ok on'; m.textContent = 'Appelez le bureau : Alan, Julie ou Bastien vous crée un nouveau mot de passe depuis l’application.'; };
  $('#lf').onsubmit = async e => { e.preventDefault(); const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value }); if (error) { const m = $('#m'); m.className = 'msg err on'; m.textContent = online ? 'E-mail ou mot de passe incorrect.' : 'Pas de réseau : connectez-vous une première fois avec du réseau.'; } };
}

/* ---------- Démarrage ---------- */
let started = false;
async function start() {
  if (started) return; started = true;
  const { data: { session } } = await sb.auth.getSession(); if (!session) { started = false; return loginView(); }
  document.body.innerHTML = `<div class="wrapper"><div class="screen" id="screen"><div class="scroll" style="padding:40px;text-align:center;color:var(--mute);font-weight:700">Chargement…</div></div></div><div class="toast" id="toast"></div>`;
  const cache = await DB.get('cache').catch(() => null);
  try {
    const { data: p } = await sb.from('profils').select('*').eq('id', session.user.id).maybeSingle();
    if (!p) throw new Error('profil');
    me = p; await DB.set('me', p);
    const { data: ts } = await sb.from('techniciens').select('*').eq('actif', true).order('ordre'); team = ts || [];
    if (p.role === 'bureau') { preview = true; let pv = null; try { pv = sessionStorage.getItem('bk-preview'); } catch (e) { } tech = team.find(t => t.id === pv) || team.find(t => t.profil_id === p.id) || team[0]; }
    else { tech = team.find(t => t.profil_id === p.id); if (!tech) { scr().innerHTML = `<div class="scroll"><div class="panel"><p>Votre compte n’est pas encore relié à une fiche technicien. Prévenez le bureau.</p></div><button class="btn" id="out">Se déconnecter</button></div>`; $('#out').onclick = () => sb.auth.signOut(); return; } }
    await load();
  } catch (e) {
    if (cache) { me = await DB.get('me'); team = cache.team; tech = cache.tech; items = cache.items; preview = me?.role === 'bureau'; online = false; toast('Hors connexion : dernières données enregistrées'); }
    else { scr().innerHTML = '<div class="scroll"><div class="panel"><p>Pas de réseau et aucune donnée enregistrée. Réessayez avec du réseau.</p></div></div>'; return; }
  }
  await refreshPending(); render(); flush(); subscribe();
}
async function load() {
  const a = iso(monday(new Date())), b = iso(addDays(monday(new Date()), 6));
  const { data, error } = await sb.from('interventions').select('*, mine:intervention_techs!inner(tech_id), pieces(*), demande:demandes(ref,message,photos)').eq('mine.tech_id', tech.id).gte('date', a).lte('date', b);
  if (error) throw error;
  const ids = (data || []).map(i => i.id);
  const { data: it } = ids.length ? await sb.from('intervention_techs').select('*').in('intervention_id', ids) : { data: [] };
  items = (data || []).map(i => ({ ...i, techs: (it || []).filter(x => x.intervention_id === i.id).map(x => x.tech_id) }));
  await DB.set('cache', { team, tech, items, at: Date.now() });
}
let chan = null;
function subscribe() {
  if (chan) sb.removeChannel(chan);
  let tm; const re = () => { clearTimeout(tm); tm = setTimeout(async () => { try { await load(); if (!openId) render(); if (Date.now() - lastLocal > 8000) toast('Planning mis à jour par le bureau'); } catch (e) { } }, 600); };
  chan = sb.channel('tech-' + tech.id).on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, re).on('postgres_changes', { event: '*', schema: 'public', table: 'intervention_techs' }, re).subscribe();
}

/* ---------- Envois (avec file d'attente hors connexion) ---------- */
async function refreshPending() { pending = (await DB.qAll().catch(() => [])).length; }
async function enqueue(job) { lastLocal = Date.now(); job.id = job.id || uid(); job.at = Date.now(); await DB.qAdd(job); await refreshPending(); flush(); }
async function flush() {
  if (flushing || !online) return; flushing = true;
  try {
    const jobs = (await DB.qAll()).sort((a, b) => a.at - b.at);
    for (const j of jobs) {
      if (j.kind === 'statut') { const { error } = await sb.rpc('tech_statut', { p_id: j.iid, p_statut: j.statut }); if (error && !/non autorisé|invalide/.test(error.message)) throw error; }
      if (j.kind === 'valider') {
        const photos = [];
        for (let k = 0; k < j.photos.length; k++) { const p = j.photos[k], path = `${j.iid}/${j.id}-${k + 1}.jpg`;
          const up = await sb.storage.from('retours').upload(path, p.blob, { contentType: 'image/jpeg', upsert: true }); if (up.error) throw up.error; photos.push({ path, tag: p.tag || '' }); }
        const { error } = await sb.rpc('tech_valider', { p_id: j.iid, p_commentaire: j.commentaire, p_photos: photos }); if (error) throw error;
      }
      await DB.qDel(j.id);
    }
  } catch (e) { console.warn('envoi reporté', e); }
  flushing = false; const before = pending; await refreshPending();
  if (before && !pending) { toast('✓ Tout est envoyé au bureau'); try { await load(); } catch (e) { } }
  if (!openId) render(); else { const s = $('#sync'); if (s) s.outerHTML = syncHtml(); bindTop(); }
}
window.addEventListener('online', () => { online = true; flush(); render(); });
window.addEventListener('offline', () => { online = false; render(); toast('Plus de réseau : l’app continue de fonctionner'); });
setInterval(() => { if (online && pending) flush(); }, 20000);

/* ---------- Barre du haut ---------- */
function syncHtml() {
  if (!online) return `<button class="sync off" id="sync" aria-label="Hors connexion"><i></i>Hors ligne${pending ? ' · ' + pending : ''}</button>`;
  if (pending) return `<button class="sync busy" id="sync"><i></i>Envoi…</button>`;
  return `<button class="sync" id="sync" aria-label="Synchronisé"><i></i>Synchronisé</button>`;
}
function topBar(title, sub, back) { return `<div class="top">${back ? '<button class="back" id="back" aria-label="Retour">‹</button>' : ''}<div class="ttl"><h1>${title}</h1><small>${sub}</small></div><button class="sun" id="sun" aria-label="Mode plein soleil">${sun ? ic('contrast') : ic('sun')}</button>${syncHtml()}</div>`; }
function bindTop() {
  const s = $('#sync'); if (s) s.onclick = () => toast(!online ? 'Pas de réseau : tout est gardé sur l’appareil et partira tout seul' : pending ? 'Envoi en cours…' : 'Tout est envoyé au bureau');
  $('#sun').onclick = () => { sun = !sun; try { localStorage.setItem('bk-sun', sun ? '1' : '0'); } catch (e) { } scr().classList.toggle('sunmode', sun); $('#sun').innerHTML = sun ? ic('contrast') : ic('sun'); };
  const b = $('#back'); if (b) b.onclick = () => { openId = null; render(); };
}
function previewBar() { return preview ? `<div class="preview">${ic('eye')} Accès bureau · planning de <select id="pv">${team.map(t => `<option value="${t.id}" ${t.id === tech.id ? 'selected' : ''}>${E(t.nom)}</option>`).join('')}</select></div>` : ''; }
function bindPreview() { const s = $('#pv'); if (s) s.onchange = async () => { tech = team.find(t => t.id === s.value); try { sessionStorage.setItem('bk-preview', tech.id); } catch (e) { } openId = null; await load(); subscribe(); render(); }; }

/* ---------- Liste ---------- */
function list() {
  const today = iso(new Date());
  const mine = items.filter(i => i.statut !== 'cloturee');
  const timed = mine.filter(i => !i.epingle);
  const todayJobs = timed.filter(i => i.date === today && i.type === 'intervention').sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
  const pins = mine.filter(i => i.date === today && i.epingle), pinsLeft = pins.filter(i => i.statut !== 'controle');
  const done = todayJobs.filter(i => i.statut === 'controle').length, next = todayJobs.find(i => i.statut !== 'controle');
  const days = tab === 'jour' ? [today] : [...Array(6)].map((_, k) => iso(addDays(monday(new Date()), k)));
  const job = i => `<button class="job ${i.type !== 'intervention' ? 'int' : ''} ${i.statut === 'controle' ? 'done' : ''}" data-id="${i.id}" style="--sc:${stripe(i.techs)}">
      <div class="h">${hh(i.heure)}<small>${fin(i.heure, i.duree)}</small></div>
      <div class="b"><div class="ad">${E(i.type === 'intervention' ? (i.adresse || i.ville) : i.travaux)}</div><div class="vi">${E(i.type === 'intervention' ? i.ville : (i.type === 'interne' ? 'Interne' : 'Tâche'))}${i.pieces.length ? ' · ' + ic('paperclip') : ''}${i.statut === 'controle' ? ' · ✓ Terminée' : ''}</div>${i.techs.length > 1 ? `<div class="teamline"><span class="avs">${avatars(i.techs)}</span>${E(i.techs.map(x => T(x).nom).join(' + '))}</div>` : ''}</div>
      ${i.type === 'intervention' ? `<span class="st ${i.statut}">${i.statut === 'controle' ? 'Terminée' : { planifiee: 'Planifiée', enroute: 'En route', encours: 'En cours' }[i.statut] || ''}</span>` : ''}<span class="chev">›</span></button>`;
  const pin = i => { const ok = i.statut === 'controle', others = i.techs.filter(x => x !== tech.id);
    return `<div class="pin ${ok ? 'ok' : ''}"><div class="pt">${ok ? '✓ ' : ''}${E(i.travaux)}</div><div class="pm">${E(fullAddr(i))}${others.length ? ` · avec <span class="avs">${avatars(others)}</span> ${E(others.map(x => T(x).nom).join(', '))}` : ''}</div>
      ${ok ? '<div class="pm" style="color:var(--ok);font-weight:800">Fait ✓</div>' : `<div class="pa">${i.adresse ? `<button data-nav="${i.id}">${ICON.route}Itinéraire</button>` : ''}<button class="pdone" data-pin="${i.id}">✓ C’est fait</button></div>`}</div>`; };
  const block = d => { const it = timed.filter(i => i.date === d).sort((a, b) => (a.heure || '').localeCompare(b.heure || '')), pd = mine.filter(i => i.date === d && i.epingle);
    return (tab === 'semaine' ? `<div class="daytitle">${lbl(d)}${d === today ? ' · aujourd’hui' : ''}</div>` : '') + (tab === 'semaine' && pd.length ? pd.map(i => `<div class="pin mini"><div class="pt">${ic('pin')} ${E(i.travaux)}</div></div>`).join('') : '') +
      (it.length ? it.map(job).join('') : (pd.length && tab === 'semaine' ? '' : `<div class="panel"><p style="color:var(--mute)">Rien de prévu.</p></div>`)); };
  scr().innerHTML = topBar(`Bonjour ${E(tech.nom)} `, lbl(today), false) + previewBar() + `<div class="scroll">
    ${tab === 'jour' && reminderOn && pinsLeft.length ? `<div class="remind" role="alert">${ic('alarm')} <div><b>Avant la fin de journée</b>Il reste ${pinsLeft.length} tâche${pinsLeft.length > 1 ? 's' : ''} à faire aujourd’hui.</div></div>` : ''}
    ${tab === 'jour' && next ? `<div class="next"><div class="lbl">${next.statut === 'planifiee' ? 'Prochaine intervention' : 'En ce moment'} · ${hh(next.heure)}</div><div class="ad">${E(next.adresse || next.ville)}</div><div class="vi">${E(next.ville)}${next.occupant ? ' · ' + E(next.occupant) : ''}</div>
      <div class="row2">${next.tel ? `<a href="${telUrl(next.tel)}">${ICON.phone}Appeler</a>` : '<span></span>'}<button data-nav="${next.id}">${ICON.route}Itinéraire</button><button class="go" data-id="${next.id}">${ICON.open}Ouvrir</button></div></div>` : ''}
    ${tab === 'jour' && pins.length ? `<div class="pins"><h2>${ic('pin')} À faire aujourd’hui <span>${pins.length - pinsLeft.length}/${pins.length}</span></h2><p>Pas d’heure précise : quand vous avez un moment dans la journée.</p>${pins.map(pin).join('')}</div>` : ''}
    ${tab === 'jour' && todayJobs.length ? `<div class="prog"><span>${done} / ${todayJobs.length} interventions</span><div class="bar"><i style="width:${done / todayJobs.length * 100}%"></i></div></div>` : ''}
    ${tab === 'jour' && todayJobs.length && !next && !pinsLeft.length ? `<div class="done-box">${ic('check-circle')} Journée terminée, tout est envoyé au bureau.</div>` : ''}
    <div class="tabs"><button data-tab="jour" class="${tab === 'jour' ? 'on' : ''}">Aujourd’hui</button><button data-tab="semaine" class="${tab === 'semaine' ? 'on' : ''}">Ma semaine</button></div>
    ${days.map(block).join('')}
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px"><button class="btn" id="mdp">Mon mot de passe</button><button class="btn" id="out">Se déconnecter</button></div>
  </div>`;
  scr().querySelectorAll('[data-id]').forEach(b => b.onclick = () => { openId = b.dataset.id; render(); scr().querySelector('.scroll').scrollTop = 0; });
  scr().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
  scr().querySelectorAll('[data-nav]').forEach(b => b.onclick = () => navTo(items.find(x => x.id === b.dataset.nav)));
  scr().querySelectorAll('[data-pin]').forEach(b => b.onclick = async () => { const i = items.find(x => x.id === b.dataset.pin); i.statut = 'controle'; render();
    await enqueue({ kind: 'valider', iid: i.id, commentaire: 'Tâche faite à ' + nowHHMM(), photos: [] }); toast('✓ Tâche faite, le bureau est prévenu'); });
  $('#out').onclick = () => sb.auth.signOut(); $('#mdp').onclick = monMdp;
  bindTop(); bindPreview();
}

/* ---------- Fiche intervention ---------- */
const PHRASES = ['Fuite réparée', 'Pièce remplacée', 'Testé, aucune fuite', 'Pièce à commander', 'Prévoir un retour', 'Occupant absent', 'Devis complémentaire à faire'];
async function signedMap(bucket, paths) { if (!paths.length || !online) return {}; const { data } = await sb.storage.from(bucket).createSignedUrls(paths, 3600); const o = {}; (data || []).forEach(u => o[u.path] = u.signedUrl); return o; }
async function fiche() {
  const i = items.find(x => x.id === openId); if (!i) { openId = null; return list(); }
  const d = drafts[i.id] = drafts[i.id] || (await DB.get('draft-' + i.id).catch(() => null)) || { photos: [], commentaire: '' };
  const done = i.statut === 'controle' || i.statut === 'cloturee', others = i.techs.filter(x => x !== tech.id), step = { planifiee: 0, enroute: 1, encours: 2, controle: 3, cloturee: 3 }[i.statut];
  const smsBody = encodeURIComponent(`Bonjour, c’est ${tech.nom} de BK+ Plomberie. Je suis en route pour votre intervention, j’arrive dans une vingtaine de minutes.`);
  const docs = [...i.pieces.map(p => ({ kind: p.type, name: p.nom, bucket: 'pieces', path: p.path })), ...((i.demande?.photos) || []).map(p => ({ kind: 'photo', name: p.label, bucket: 'demandes', path: p.path }))];
  const isJob = i.type === 'intervention';
  scr().innerHTML = topBar(`${i.epingle ? ic('pin') : hh(i.heure)} · ${E(i.ville || 'Tâche')}`, lbl(i.date), true) + previewBar() + `<div class="scroll">
    ${done ? '<div class="done-box">✓ Terminée et envoyée au bureau</div>' : ''}
    ${isJob ? `<div class="step"><div class="${step >= 0 ? 'on' : ''}">Prévue</div><div class="${step >= 1 ? 'on' : ''}">En route</div><div class="${step >= 2 ? 'on' : ''}">Sur place</div><div class="${step >= 3 ? 'on' : ''}">Terminée</div></div>` : ''}
    <div class="addr"><div class="a">${E(isJob ? (i.adresse || i.ville) : i.travaux)}</div><div class="v">${E(isJob ? [i.cp, i.ville].filter(Boolean).join(' ') : fullAddr(i))}</div>${isJob && i.complement ? `<div class="v" style="font-weight:700">${E(i.complement)}</div>` : ''}</div>
    ${others.length ? `<div class="binome"><span class="avs">${avatars(i.techs)}</span> En équipe avec ${E(others.map(x => T(x).nom).join(', '))}</div>` : ''}
    ${isJob ? `<div class="big-actions">${i.tel ? `<a class="bigbtn call" href="${telUrl(i.tel)}">${ICON.phone}Appeler</a>` : '<span></span>'}<button class="bigbtn route" data-nav="${i.id}">${ICON.route}Itinéraire</button></div>` : ''}
    ${isJob && i.statut === 'planifiee' ? `<button class="primary-step" id="go">${ic('truck')} Je pars</button>` : ''}
    ${isJob && i.statut === 'enroute' ? `${i.tel ? `<a class="sms" href="sms:${String(i.tel).replace(/\s/g, '')}${iOS ? '&' : '?'}body=${smsBody}">${ic('message')} Prévenir l’occupant par SMS</a>` : ''}<button class="primary-step here" id="here">${ic('map-pin')} Je suis sur place</button>` : ''}
    ${isJob && i.statut === 'encours' && i.debut_at ? `<div class="since">${ic('timer')} Sur place depuis ${new Date(i.debut_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}</div>` : ''}
    ${isJob ? `<div class="panel"><dl class="facts">${i.occupant ? `<dt>Occupant</dt><dd>${E(i.occupant)}</dd>` : ''}${i.tel ? `<dt>Téléphone</dt><dd><a href="${telUrl(i.tel)}">${E(i.tel)}</a></dd>` : ''}${i.client ? `<dt>Client</dt><dd>${E(i.client)}</dd>` : ''}<dt>Horaires</dt><dd>${hh(i.heure)} – ${fin(i.heure, i.duree)}</dd></dl></div>` : ''}
    ${isJob ? `<div class="panel"><h3>${ic('wrench')} Travaux à faire</h3><p>${E(i.travaux)}</p></div>` : ''}
    ${i.materiel.length ? `<div class="panel"><h3>${ic('package')} Matériel à prendre</h3><ul class="mat">${i.materiel.map((m, k) => `<li><label><input type="checkbox" data-mat="${k}" ${(matChk[i.id] || {})[k] ? 'checked' : ''}>${E(m)}</label></li>`).join('')}</ul></div>` : ''}
    ${docs.length ? `<div class="panel"><h3>${ic('paperclip')} Documents${i.demande ? ' · photos du client' : ''}</h3><div class="docs">${docs.map((p, k) => `<button data-doc="${k}"><div class="m ${p.kind === 'video' ? 'v' : ''}" data-dm="${k}">${p.kind === 'pdf' ? ic('file') : p.kind === 'video' ? '' : ''}</div><span>${E(p.name)}</span></button>`).join('')}</div>${i.demande?.message ? `<p style="font-size:16px;margin-top:10px;color:var(--mute)">« ${E(i.demande.message)} »</p>` : ''}</div>` : ''}
    ${isJob ? `<div class="panel"><h3>${ic('camera')} Photos</h3>
      ${done ? '' : `<label class="photo-btn">${ICON.cam}Prendre une photo<input type="file" accept="image/*" capture="environment" class="sr" id="cam"></label>`}
      <div class="thumbs">${d.photos.map((p, k) => `<figure><img src="${URL.createObjectURL(p.blob)}" alt="Photo ${k + 1}" data-lb>${done ? '' : `<button class="tg" data-tag="${k}">${p.tag || 'Avant / Après ?'}</button><button class="rm" data-rm="${k}" aria-label="Supprimer">×</button>`}</figure>`).join('')}</div></div>
    <div class="panel"><h3>${ic('pencil')} Commentaire</h3>${done ? `<p>${E(i.commentaire || '')}</p>` : `<div class="chips">${PHRASES.map(p => `<button data-ph="${E(p)}">+ ${E(p)}</button>`).join('')}</div><div class="cmt"><textarea id="cmt" placeholder="Ce qui a été fait, ce qui reste à prévoir…">${E(d.commentaire)}</textarea><button class="mic" id="mic">${ICON.mic}Dicter</button></div>`}</div>` : ''}
    ${!isJob && !done ? `<button class="primary-step" style="background:var(--ok)" id="pindone">✓ C’est fait</button>` : ''}
  </div>
  ${done || !isJob ? '' : `<div class="validate"><div class="alert" id="alert" role="alert"></div><div class="need"><span id="n1">○ 1 photo minimum</span><span id="n2">○ Un commentaire</span></div><button id="ok">Valider l’intervention</button></div>`}
  <div class="lb" id="lb"></div>`;
  bindTop(); bindPreview();
  scr().querySelectorAll('[data-nav]').forEach(b => b.onclick = () => navTo(i));
  scr().querySelectorAll('[data-mat]').forEach(c => c.onchange = () => { (matChk[i.id] = matChk[i.id] || {})[c.dataset.mat] = c.checked; });
  const lb = $('#lb'); lb.onclick = e => { if (e.target.tagName === 'VIDEO') return; lb.classList.remove('on'); lb.innerHTML = ''; };
  scr().querySelectorAll('[data-lb]').forEach(img => img.onclick = () => { lb.innerHTML = `<img src="${img.src}" alt=""><button aria-label="Fermer">×</button>`; lb.classList.add('on'); });
  if (docs.length) { const byB = {}; docs.forEach(x => (byB[x.bucket] = byB[x.bucket] || []).push(x.path)); const urls = {}; for (const b in byB) Object.assign(urls, await signedMap(b, byB[b]));
    docs.forEach((p, k) => { p.url = urls[p.path]; const m = scr().querySelector(`[data-dm="${k}"]`); if (m && p.kind === 'photo' && p.url) m.style.backgroundImage = `url('${p.url}')`; });
    scr().querySelectorAll('[data-doc]').forEach(b => b.onclick = () => { const p = docs[+b.dataset.doc]; if (!p.url) return toast('Document disponible avec du réseau');
      if (p.kind === 'photo') { lb.innerHTML = `<img src="${p.url}" alt=""><button aria-label="Fermer">×</button>`; lb.classList.add('on'); }
      else if (p.kind === 'video') { lb.innerHTML = `<video src="${p.url}" controls autoplay playsinline style="max-width:100%;max-height:100%;border-radius:12px"></video><button aria-label="Fermer">×</button>`; lb.classList.add('on'); }
      else window.open(p.url, '_blank'); }); }
  const go = $('#go'); if (go) go.onclick = async () => { i.statut = 'enroute'; fiche(); await enqueue({ kind: 'statut', iid: i.id, statut: 'enroute' }); toast('Le bureau voit que vous êtes en route'); };
  const here = $('#here'); if (here) here.onclick = async () => { i.statut = 'encours'; i.debut_at = new Date().toISOString(); fiche(); await enqueue({ kind: 'statut', iid: i.id, statut: 'encours' }); toast('Arrivée enregistrée à ' + nowHHMM()); };
  const pd = $('#pindone'); if (pd) pd.onclick = async () => { i.statut = 'controle'; await enqueue({ kind: 'valider', iid: i.id, commentaire: 'Tâche faite à ' + nowHHMM(), photos: [] }); openId = null; render(); toast('✓ Tâche faite, le bureau est prévenu'); };
  if (done || !isJob) return;
  const saveDraft = () => DB.set('draft-' + i.id, d).catch(() => { });
  const upd = () => { const a = d.photos.length > 0, b = d.commentaire.trim().length > 1; $('#n1').className = a ? 'ok' : ''; $('#n1').textContent = (a ? '✓' : '○') + ' 1 photo minimum'; $('#n2').className = b ? 'ok' : ''; $('#n2').textContent = (b ? '✓' : '○') + ' Un commentaire'; $('#ok').classList.toggle('ready', a && b); if (a && b) $('#alert').classList.remove('show'); };
  upd();
  $('#cam').onchange = async e => { const f = e.target.files[0]; if (!f) return; const blob = await shrink(f); d.photos.push({ blob, tag: d.photos.length ? 'Après' : 'Avant' }); await saveDraft();
    if (i.statut === 'planifiee' || i.statut === 'enroute') { i.statut = 'encours'; i.debut_at = i.debut_at || new Date().toISOString(); enqueue({ kind: 'statut', iid: i.id, statut: 'encours' }); }
    const y = scr().querySelector('.scroll').scrollTop; await fiche(); scr().querySelector('.scroll').scrollTop = y; toast('Photo enregistrée sur l’appareil'); };
  scr().querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const k = +b.dataset.rm, p = d.photos.splice(k, 1)[0]; await saveDraft(); await fiche(); toast('Photo supprimée', async () => { d.photos.splice(k, 0, p); await saveDraft(); fiche(); }); });
  scr().querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { const p = d.photos[+b.dataset.tag]; p.tag = p.tag === 'Avant' ? 'Après' : p.tag === 'Après' ? 'Pendant' : 'Avant'; b.textContent = p.tag; saveDraft(); });
  const ta = $('#cmt'); ta.oninput = () => { d.commentaire = ta.value; upd(); saveDraft(); };
  scr().querySelectorAll('[data-ph]').forEach(b => b.onclick = () => { const p = b.dataset.ph; ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '') + (/[.!?]$/.test(ta.value.trim()) ? ' ' : '. ') + p : p; ta.dispatchEvent(new Event('input')); });
  $('#mic').onclick = dictate;
  $('#ok').onclick = async () => {
    const miss = []; if (!d.photos.length) miss.push('au moins une photo'); if (d.commentaire.trim().length < 2) miss.push('un commentaire');
    if (miss.length) { const a = $('#alert'); a.classList.remove('show'); void a.offsetWidth; a.textContent = 'Ajoutez ' + miss.join(' et ') + ' pour valider.'; a.classList.add('show'); return; }
    const job = { kind: 'valider', iid: i.id, commentaire: d.commentaire.trim(), photos: d.photos.map(p => ({ blob: p.blob, tag: p.tag })) };
    i.statut = 'controle'; i.commentaire = job.commentaire; delete drafts[i.id]; DB.del('draft-' + i.id); openId = null;
    await enqueue(job); render();
    toast(online ? '✓ Envoyée au bureau' : '✓ Gardée sur l’appareil · partira au retour du réseau');
  };
}
function shrink(file) { return new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(b => res(b), 'image/jpeg', .75); }; img.onerror = rej; img.src = u; }); }
let rec = null;
function dictate() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, b = $('#mic'), ta = $('#cmt');
  if (!SR) { ta.focus(); toast('Touchez le micro du clavier pour dicter'); return; }
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = false; b.classList.add('rec');
  rec.onresult = e => { const t = [...e.results].map(r => r[0].transcript).join(' '); ta.value = (ta.value.trim() ? ta.value.trim() + ' ' : '') + t.charAt(0).toUpperCase() + t.slice(1); ta.dispatchEvent(new Event('input')); };
  rec.onend = () => { rec = null; const m = $('#mic'); if (m) m.classList.remove('rec'); };
  rec.onerror = () => { ta.focus(); toast('Utilisez le micro du clavier'); };
  try { rec.start(); } catch (e) { rec = null; b.classList.remove('rec'); }
}

/* ---------- GPS : Waze, Plans, Google Maps ---------- */
const NAV = { waze: { n: 'Waze', c: '#33CCFF', e: ic('navigation'), u: q => 'https://waze.com/ul?q=' + q + '&navigate=yes' }, plans: { n: 'Plans (Apple)', c: '#34C759', e: ic('map'), u: q => 'https://maps.apple.com/?daddr=' + q }, google: { n: 'Google Maps', c: '#4285F4', e: ic('map-pin'), u: q => 'https://www.google.com/maps/dir/?api=1&destination=' + q } };
function navTo(i) {
  if (!i) return; const q = encodeURIComponent(fullAddr(i) || i.ville || '');
  if (navPref && NAV[navPref]) { window.open(NAV[navPref].u(q), '_blank'); return; }
  let sh = scr().querySelector('.sheet'); if (!sh) { sh = document.createElement('div'); sh.className = 'sheet'; scr().appendChild(sh); }
  sh.innerHTML = `<div class="in"><h3>Itinéraire</h3><p>${E(fullAddr(i))}</p><div class="apps">${Object.entries(NAV).map(([k, v]) => `<a href="${v.u(q)}" target="_blank" rel="noopener" data-app="${k}"><i style="background:${v.c}">${v.e}</i>${v.n}</a>`).join('')}</div><label><input type="checkbox" id="rememb" checked> Toujours utiliser cette application</label><button class="cancel">Annuler</button></div>`;
  sh.classList.add('on'); sh.onclick = e => { if (e.target === sh || e.target.classList.contains('cancel')) sh.classList.remove('on'); };
  sh.querySelectorAll('[data-app]').forEach(a => a.onclick = () => { if ($('#rememb').checked) { navPref = a.dataset.app; try { localStorage.setItem('bk-nav', navPref); } catch (e) { } } sh.classList.remove('on'); });
}

/* ---------- Rappel avant la fin de journée (16h30) ---------- */
function checkReminder() {
  const d = new Date(), today = iso(d); if (reminderOn || !(d.getHours() > 16 || (d.getHours() === 16 && d.getMinutes() >= 30)) || d.getDay() === 5 && d.getHours() < 12) return;
  const left = items.filter(i => i.epingle && i.date === today && i.statut !== 'controle' && i.statut !== 'cloturee'); if (!left.length) return;
  reminderOn = true; if (!openId) render(); toast('' + left.length + ' tâche' + (left.length > 1 ? 's' : '') + ' à faire avant ce soir');
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification('BK+ · Tâches du jour', { body: left.map(x => '• ' + x.travaux).join('\n'), icon: '../icon-180.png' }); } catch (e) { }
}
setInterval(checkReminder, 60000);

function render() { if (!tech || !scr()) return; scr().classList.toggle('sunmode', sun); openId ? fiche() : list(); }
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN') start(); else if (ev === 'SIGNED_OUT') { started = false; tech = null; loginView(); } });
start();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
if ('Notification' in window && Notification.permission === 'default') document.addEventListener('click', () => { try { Notification.requestPermission(); } catch (e) { } }, { once: true });

/* ---------- Changer son mot de passe ---------- */
function monMdp() {
  const a = prompt('Nouveau mot de passe (8 caractères minimum) :'); if (a == null) return;
  if (a.length < 8) return toast('Trop court : 8 caractères minimum');
  const b = prompt('Retapez le nouveau mot de passe :'); if (b !== a) return toast('Les deux mots de passe ne correspondent pas');
  sb.auth.updateUser({ password: a }).then(({ error }) => toast(error ? 'Impossible (réseau ?) : réessayez' : 'Mot de passe modifié'));
}
