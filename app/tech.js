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
const who = i => [i.client, i.occupant].filter(Boolean).join(' · ');
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
  await refreshPending(); render(); flush(); subscribe(); countCtrl();
}
const NBW = 6; let wk = 0; const addx = {};
async function load() {
  const a = iso(monday(new Date())), b = iso(addDays(monday(new Date()), 7 * NBW - 1));
  const { data, error } = await sb.from('interventions').select('*, mine:intervention_techs!inner(tech_id), pieces(*), demande:demandes(ref,message,photos)').eq('mine.tech_id', tech.id).gte('date', a).lte('date', b);
  if (error) throw error;
  const { data: ex } = await sb.from('interventions').select('*, mine:intervention_techs!inner(tech_id), pieces(*), demande:demandes(ref,message,photos)').eq('mine.tech_id', tech.id).or('statut.eq.reprendre,note_lue.eq.false');
  (ex || []).forEach(x => { if (!data.some(y => y.id === x.id)) data.push(x); });
  const ids = (data || []).map(i => i.id);
  const { data: it } = ids.length ? await sb.from('intervention_techs').select('*').in('intervention_id', ids) : { data: [] };
  items = (data || []).map(i => ({ ...i, techs: (it || []).filter(x => x.intervention_id === i.id).map(x => x.tech_id) }));
  await DB.set('cache', { team, tech, items, at: Date.now() });
  return alertNew();
}
/* Alerte : intervention à reprendre ou nouveau message du bureau */
const needsMe = i => i.statut === 'reprendre' || (i.note_bureau && !i.note_lue);
let seenA = null;
function alertNew() {
  const keys = items.filter(needsMe).map(i => i.id + '|' + i.statut + '|' + (i.note_at || ''));
  if (seenA === null) { seenA = new Set(keys); return false; }
  const fresh = items.filter(needsMe).filter(i => !seenA.has(i.id + '|' + i.statut + '|' + (i.note_at || ''))); keys.forEach(k => seenA.add(k)); if (!fresh.length) return false;
  const txt = fresh.map(i => (i.statut === 'reprendre' ? '↺ À reprendre : ' : '✉ Message : ') + (who(i) || i.adresse || i.travaux || '') + (i.note_bureau ? ' · « ' + i.note_bureau.slice(0, 80) + ' »' : '')).join('\n');
  try { navigator.vibrate && navigator.vibrate([300, 120, 300, 120, 300]); } catch (e) { }
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification('BK+ · Message du bureau', { body: txt, icon: '../icon-180.png', tag: 'bk-note' }); } catch (e) { }
  toast(fresh.length > 1 ? fresh.length + ' messages du bureau' : txt.split('\n')[0]); return true;
}
let chan = null;
function subscribe() {
  if (chan) sb.removeChannel(chan);
  let tm; const re = () => { clearTimeout(tm); tm = setTimeout(async () => { try { const al = await load(); countCtrl(); if (!openId && tab !== "controle" && tab !== "equipe") render(); if (!al && Date.now() - lastLocal > 8000) toast('Planning mis à jour par le bureau'); } catch (e) { } }, 600); };
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
      if (j.kind === 'completer') {
        const photos = [];
        for (let k = 0; k < j.photos.length; k++) { const p = j.photos[k], path = `${j.iid}/${j.id}-c${k + 1}.jpg`;
          const up = await sb.storage.from('retours').upload(path, p.blob, { contentType: 'image/jpeg', upsert: true }); if (up.error) throw up.error; photos.push({ path, tag: p.tag || 'Ajout' }); }
        const { error } = await sb.rpc('tech_completer', { p_id: j.iid, p_commentaire: j.commentaire, p_photos: photos });
        if (error) { if (/clôturée/.test(error.message)) toast('Trop tard : le bureau a déjà clôturé cette intervention'); else throw error; }
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
  const m0 = addDays(monday(new Date()), 7 * wk), days = tab === 'jour' ? [today] : [...Array(7)].map((_, k) => iso(addDays(m0, k))).filter((d, k) => k < 5 || mine.some(i => i.date === d));
  const job = i => `<button class="job ${i.type !== 'intervention' ? 'int' : ''} ${i.statut === 'controle' || i.statut === 'attente' ? 'done' : ''} ${needsMe(i) ? 'alrt' : ''}" data-id="${i.id}" style="--sc:${stripe(i.techs)}">
      <div class="h">${hh(i.heure)}<small>${fin(i.heure, i.duree)}</small></div>
      <div class="b"><div class="ad">${E(i.type === 'intervention' ? (who(i) || i.adresse || i.ville) : i.travaux)}</div><div class="vi">${E(i.type === 'intervention' ? (who(i) ? [i.adresse, i.ville].filter(Boolean).join(', ') : i.ville) : (i.type === 'interne' ? 'Interne' : 'Tâche'))}${i.pieces.length ? ' · ' + ic('paperclip') : ''}${i.statut === 'controle' ? ' · ✓ Terminée' : ''}</div>${i.techs.length > 1 ? `<div class="teamline"><span class="avs">${avatars(i.techs)}</span>${E(i.techs.map(x => T(x).nom).join(' + '))}</div>` : ''}</div>
      ${i.type === 'intervention' ? `<span class="st ${i.statut}">${i.statut === 'controle' ? 'Terminée' : { planifiee: 'Planifiée', enroute: 'En route', encours: 'En cours', attente: 'En attente', reprendre: 'À reprendre' }[i.statut] || ''}</span>` : ''}<span class="chev">›</span></button>`;
  const pin = i => { const ok = i.statut === 'controle', others = i.techs.filter(x => x !== tech.id);
    return `<div class="pin ${ok ? 'ok' : ''}"><div class="pt">${ok ? '✓ ' : ''}${E(i.travaux)}</div><div class="pm">${E(fullAddr(i))}${others.length ? ` · avec <span class="avs">${avatars(others)}</span> ${E(others.map(x => T(x).nom).join(', '))}` : ''}</div>
      ${ok ? '<div class="pm" style="color:var(--ok);font-weight:800">Fait ✓</div>' : `<div class="pa">${i.adresse ? `<button data-nav="${i.id}">${ICON.route}Itinéraire</button>` : ''}<button class="pdone" data-pin="${i.id}">✓ C’est fait</button></div>`}</div>`; };
  const block = d => { const it = timed.filter(i => i.date === d).sort((a, b) => (a.heure || '').localeCompare(b.heure || '')), pd = mine.filter(i => i.date === d && i.epingle);
    return (tab === 'semaine' ? `<div class="daytitle">${lbl(d)}${d === today ? ' · aujourd’hui' : ''}</div>` : '') + (tab === 'semaine' && pd.length ? pd.map(i => `<div class="pin mini"><div class="pt">${ic('pin')} ${E(i.travaux)}</div></div>`).join('') : '') +
      (it.length ? it.map(job).join('') : (pd.length && tab === 'semaine' ? '' : `<div class="panel"><p style="color:var(--mute)">Rien de prévu.</p></div>`)); };
  const al = items.filter(needsMe).sort((a, b) => (b.note_at || '').localeCompare(a.note_at || ''));
  scr().innerHTML = topBar(`Bonjour ${E(tech.nom)} `, lbl(today), false) + previewBar() + `<div class="scroll">
    ${al.length ? `<div class="bnote" role="alert"><h2>${ic('message')} Le bureau vous demande</h2>${al.map(i => `<button data-id="${i.id}"><b>${i.statut === 'reprendre' ? '↺ À reprendre' : '✉ Nouveau message'}</b><span>${E(who(i) || i.adresse || i.travaux || '')} · ${lbl(i.date)}</span>${i.note_bureau ? `<em>« ${E(i.note_bureau.slice(0, 140))} »</em>` : ''}</button>`).join('')}</div>` : ''}
    ${tab === 'jour' && reminderOn && pinsLeft.length ? `<div class="remind" role="alert">${ic('alarm')} <div><b>Avant la fin de journée</b>Il reste ${pinsLeft.length} tâche${pinsLeft.length > 1 ? 's' : ''} à faire aujourd’hui.</div></div>` : ''}
    ${tab === 'jour' && next ? `<div class="next"><div class="lbl">${next.statut === 'planifiee' ? 'Prochaine intervention' : 'En ce moment'} · ${hh(next.heure)}</div><div class="ad">${E(who(next) || next.adresse || next.ville)}</div><div class="vi">${E(who(next) ? [next.adresse, next.ville].filter(Boolean).join(', ') : next.ville)}</div>
      <div class="row2">${next.tel ? `<a href="${telUrl(next.tel)}">${ICON.phone}Appeler</a>` : '<span></span>'}<button data-nav="${next.id}">${ICON.route}Itinéraire</button><button class="go" data-id="${next.id}">${ICON.open}Ouvrir</button></div></div>` : ''}
    ${tab === 'jour' && pins.length ? `<div class="pins"><h2>${ic('pin')} À faire aujourd’hui <span>${pins.length - pinsLeft.length}/${pins.length}</span></h2><p>Pas d’heure précise : quand vous avez un moment dans la journée.</p>${pins.map(pin).join('')}</div>` : ''}
    ${tab === 'jour' && todayJobs.length ? `<div class="prog"><span>${done} / ${todayJobs.length} interventions</span><div class="bar"><i style="width:${done / todayJobs.length * 100}%"></i></div></div>` : ''}
    ${tab === 'jour' && todayJobs.length && !next && !pinsLeft.length ? `<div class="done-box">${ic('check-circle')} Journée terminée, tout est envoyé au bureau.</div>` : ''}
    ${tabsH()}
    ${tab === 'semaine' ? `<div class="wkn"><button id="wkp" ${wk ? '' : 'disabled'} aria-label="Semaine précédente">‹</button><span>${wk === 0 ? 'Cette semaine' : wk === 1 ? 'Semaine prochaine' : 'Semaine du ' + lbl(iso(m0))}</span><button id="wkn" ${wk < NBW - 1 ? '' : 'disabled'} aria-label="Semaine suivante">›</button></div>` : ''}
    ${days.map(block).join('')}
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:24px"><button class="btn" id="mdp">Mon mot de passe</button><button class="btn" id="out">Se déconnecter</button></div>
  </div>`;
  scr().querySelectorAll('[data-id]').forEach(b => b.onclick = () => { openId = b.dataset.id; render(); scr().querySelector('.scroll').scrollTop = 0; });
  scr().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; wk = 0; render(); });
  if ($('#wkp')) { $('#wkp').onclick = () => { wk = Math.max(0, wk - 1); render(); }; $('#wkn').onclick = () => { wk = Math.min(NBW - 1, wk + 1); render(); }; }
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
  const done = ['controle', 'cloturee', 'attente'].includes(i.statut), rep = i.statut === 'reprendre', others = i.techs.filter(x => x !== tech.id), step = { planifiee: 0, enroute: 1, encours: 2, reprendre: 2, controle: 3, attente: 3, cloturee: 3 }[i.statut];
  if (i.note_bureau && !i.note_lue && !preview && online) { i.note_lue = true; sb.rpc('tech_note_lue', { p_id: i.id }).then(() => DB.set('cache', { team, tech, items, at: Date.now() })); }
  const smsBody = encodeURIComponent(`Bonjour, c’est ${tech.nom} de BK+ Plomberie. Je suis en route pour votre intervention, j’arrive dans une vingtaine de minutes.`);
  const docs = [...i.pieces.map(p => ({ kind: p.type, name: (p.prive ? '🔒 ' : '') + p.nom, bucket: p.prive ? 'bureau' : 'pieces', path: p.path })), ...((i.demande?.photos) || []).map(p => ({ kind: 'photo', name: p.label, bucket: 'demandes', path: p.path }))];
  const isJob = i.type === 'intervention';
  scr().innerHTML = topBar(`${i.epingle ? ic('pin') : hh(i.heure)} · ${E(i.ville || 'Tâche')}`, lbl(i.date), true) + previewBar() + `<div class="scroll">
    ${i.note_bureau ? `<div class="bmsg ${rep ? 'rep' : ''}"><small>${rep ? '↺ À reprendre · message du bureau' : 'Message du bureau'}${i.note_at ? ' · ' + new Date(i.note_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small><p>${E(i.note_bureau)}</p></div>` : ''}
    ${rep && !i.note_bureau ? '<div class="bmsg rep"><small>↺ À reprendre</small><p>Le bureau vous demande de reprendre cette intervention.</p></div>' : ''}
    ${done ? `<div class="done-box">${i.statut === 'attente' ? '⏸ En attente côté bureau' : '✓ Terminée et envoyée au bureau'}</div>` : ''}
    ${isJob ? `<div class="step"><div class="${step >= 0 ? 'on' : ''}">Prévue</div><div class="${step >= 1 ? 'on' : ''}">En route</div><div class="${step >= 2 ? 'on' : ''}">Sur place</div><div class="${step >= 3 ? 'on' : ''}">Terminée</div></div>` : ''}
    ${isJob && who(i) ? `<div class="who2">${i.client ? `<div><small>Client</small><b>${E(i.client)}</b></div>` : ''}${i.occupant ? `<div><small>Occupant</small><b>${E(i.occupant)}</b></div>` : ''}</div>` : ''}
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
      ${done ? '' : `<div class="pbtns"><label class="photo-btn">${ICON.cam}Prendre une photo<input type="file" accept="image/*" capture="environment" class="sr" id="cam"></label><label class="photo-btn alt">${ic('image')}Mes photos<input type="file" accept="image/*" multiple class="sr" id="gal"></label></div>`}
      ${rep && (i.photos || []).length ? '<p style="color:var(--mute);margin:0 0 6px">Déjà envoyées :</p>' : ''}${(done || rep) && (i.photos || []).length ? `<div class="thumbs sent">${i.photos.map((p, k) => `<figure><img alt="Photo ${k + 1}" data-rph="${E(p.path)}" data-lb><figcaption>${E(p.tag || '')}</figcaption></figure>`).join('')}</div>` : ''}
      ${done && !(i.photos || []).length ? '<p style="color:var(--mute)">Aucune photo envoyée.</p>' : ''}
      <div class="thumbs">${d.photos.map((p, k) => `<figure><img src="${URL.createObjectURL(p.blob)}" alt="Photo ${k + 1}" data-lb>${done ? '' : `<button class="tg" data-tag="${k}">${p.tag || 'Avant / Après ?'}</button><button class="rm" data-rm="${k}" aria-label="Supprimer">×</button>`}</figure>`).join('')}</div></div>
    <div class="panel"><h3>${ic('pencil')} Commentaire${rep ? ' de la reprise' : ''}</h3>${rep && i.commentaire ? `<p style="color:var(--mute);white-space:pre-line;font-size:15px">Avant : ${E(i.commentaire)}</p>` : ''}${done ? `<p>${E(i.commentaire || '')}</p>` : `<div class="chips">${PHRASES.map(p => `<button data-ph="${E(p)}">+ ${E(p)}</button>`).join('')}</div><div class="cmt"><textarea id="cmt" placeholder="Ce qui a été fait, ce qui reste à prévoir…">${E(d.commentaire)}</textarea><button class="mic" id="mic">${ICON.mic}Dicter</button></div>`}</div>` : ''}
    ${isJob && i.statut === 'controle' ? `<div class="panel add"><h3>${ic('pencil')} Oublié quelque chose ?</h3><p style="color:var(--mute);margin:0 0 10px">Tant que le bureau n’a pas clôturé, vous pouvez encore ajouter des photos ou un commentaire.</p>
      <div class="pbtns"><label class="photo-btn">${ICON.cam}Prendre une photo<input type="file" accept="image/*" capture="environment" class="sr" id="cam2"></label><label class="photo-btn alt">${ic('image')}Mes photos<input type="file" accept="image/*" multiple class="sr" id="gal2"></label></div>
      <div class="thumbs">${(addx[i.id] || { photos: [] }).photos.map((p, k) => `<figure><img src="${URL.createObjectURL(p.blob)}" alt=""><button class="rm" data-rm2="${k}" aria-label="Supprimer">×</button></figure>`).join('')}</div>
      <div class="cmt"><textarea id="cmt2" placeholder="Ce que vous avez oublié de dire…">${E((addx[i.id] || {}).commentaire || '')}</textarea></div>
      <button class="primary-step" style="background:var(--ok);margin-top:12px" id="send2">Envoyer au bureau</button></div>` : ''}
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
    scr().querySelectorAll('[data-doc]').forEach(b => b.onclick = () => { const p = docs[+b.dataset.doc]; if (!p.url) return toast(online ? 'Document introuvable, prévenez le bureau' : 'Document disponible avec du réseau');
      if (p.kind === 'photo') { lb.innerHTML = `<img src="${p.url}" alt=""><button aria-label="Fermer">×</button>`; lb.classList.add('on'); }
      else if (p.kind === 'video') { lb.innerHTML = `<video src="${p.url}" controls autoplay playsinline style="max-width:100%;max-height:100%;border-radius:12px"></video><button aria-label="Fermer">×</button>`; lb.classList.add('on'); }
      else window.open(p.url, '_blank'); }); }
  const rp = [...scr().querySelectorAll('[data-rph]')];
  if (rp.length) signedMap('retours', rp.map(x => x.dataset.rph)).then(u => rp.forEach(img => { if (u[img.dataset.rph]) img.src = u[img.dataset.rph]; else img.alt = 'Photo disponible avec du réseau'; }));
  const go = $('#go'); if (go) go.onclick = async () => { i.statut = 'enroute'; fiche(); await enqueue({ kind: 'statut', iid: i.id, statut: 'enroute' }); toast('Le bureau voit que vous êtes en route'); };
  const here = $('#here'); if (here) here.onclick = async () => { i.statut = 'encours'; i.debut_at = new Date().toISOString(); fiche(); await enqueue({ kind: 'statut', iid: i.id, statut: 'encours' }); toast('Arrivée enregistrée à ' + nowHHMM()); };
  const pd = $('#pindone'); if (pd) pd.onclick = async () => { i.statut = 'controle'; await enqueue({ kind: 'valider', iid: i.id, commentaire: 'Tâche faite à ' + nowHHMM(), photos: [] }); openId = null; render(); toast('✓ Tâche faite, le bureau est prévenu'); };
  if (i.statut === 'controle' && isJob && $('#send2')) { const x = addx[i.id] = addx[i.id] || { photos: [], commentaire: '' };
    $('#cmt2').oninput = e => { x.commentaire = e.target.value; };
    $('#cam2').onchange = $('#gal2').onchange = async e => { const fl = [...e.target.files]; if (!fl.length) return; for (const f of fl) { try { x.photos.push({ blob: await shrink(f), tag: 'Ajout' }); } catch (er) { } } const y = scr().querySelector('.scroll').scrollTop; await fiche(); scr().querySelector('.scroll').scrollTop = y; };
    scr().querySelectorAll('[data-rm2]').forEach(b => b.onclick = async () => { x.photos.splice(+b.dataset.rm2, 1); await fiche(); });
    $('#send2').onclick = async () => { if (!x.photos.length && x.commentaire.trim().length < 2) return toast('Ajoutez une photo ou un commentaire');
      await enqueue({ kind: 'completer', iid: i.id, commentaire: x.commentaire.trim(), photos: x.photos.map(p => ({ blob: p.blob, tag: p.tag })) });
      delete addx[i.id]; openId = null; render(); toast(online ? '✓ Ajout envoyé au bureau' : '✓ Gardé sur l’appareil · partira au retour du réseau'); }; }
  if (done || !isJob) return;
  const saveDraft = () => DB.set('draft-' + i.id, d).catch(() => { });
  const upd = () => { const a = d.photos.length > 0, b = d.commentaire.trim().length > 1; $('#n1').className = a ? 'ok' : ''; $('#n1').textContent = (a ? '✓' : '○') + ' 1 photo minimum'; $('#n2').className = b ? 'ok' : ''; $('#n2').textContent = (b ? '✓' : '○') + ' Un commentaire'; $('#ok').classList.toggle('ready', a && b); if (a && b) $('#alert').classList.remove('show'); };
  upd();
  $('#cam').onchange = $('#gal').onchange = async e => { const fl = [...e.target.files]; if (!fl.length) return; for (const f of fl) { try { d.photos.push({ blob: await shrink(f), tag: d.photos.length ? 'Après' : 'Avant' }); } catch (er) { toast('Une photo n’a pas pu être lue'); } } await saveDraft();
    if (i.statut === 'planifiee' || i.statut === 'enroute') { i.statut = 'encours'; i.debut_at = i.debut_at || new Date().toISOString(); enqueue({ kind: 'statut', iid: i.id, statut: 'encours' }); }
    const y = scr().querySelector('.scroll').scrollTop; await fiche(); scr().querySelector('.scroll').scrollTop = y; toast(fl.length > 1 ? fl.length + ' photos ajoutées' : 'Photo enregistrée sur l’appareil'); };
  scr().querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const k = +b.dataset.rm, p = d.photos.splice(k, 1)[0]; await saveDraft(); await fiche(); toast('Photo supprimée', async () => { d.photos.splice(k, 0, p); await saveDraft(); fiche(); }); });
  scr().querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { const p = d.photos[+b.dataset.tag]; p.tag = p.tag === 'Avant' ? 'Après' : p.tag === 'Après' ? 'Pendant' : 'Avant'; b.textContent = p.tag; saveDraft(); });
  const ta = $('#cmt'); ta.oninput = () => { d.commentaire = ta.value; upd(); saveDraft(); };
  scr().querySelectorAll('[data-ph]').forEach(b => b.onclick = () => { const p = b.dataset.ph; ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '') + (/[.!?]$/.test(ta.value.trim()) ? ' ' : '. ') + p : p; ta.dispatchEvent(new Event('input')); });
  $('#mic').onclick = dictate;
  $('#ok').onclick = async () => {
    const miss = []; if (!d.photos.length) miss.push('au moins une photo'); if (d.commentaire.trim().length < 2) miss.push('un commentaire');
    if (miss.length) { const a = $('#alert'); a.classList.remove('show'); void a.offsetWidth; a.textContent = 'Ajoutez ' + miss.join(' et ') + ' pour valider.'; a.classList.add('show'); return; }
    const job = { kind: 'valider', iid: i.id, commentaire: d.commentaire.trim(), photos: d.photos.map(p => ({ blob: p.blob, tag: p.tag })) };
    i.statut = 'controle'; i.note_lue = true; i.commentaire = job.commentaire; delete drafts[i.id]; DB.del('draft-' + i.id); openId = null;
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

function render() { if (!tech || !scr()) return; scr().classList.toggle('sunmode', sun); openId ? fiche() : tab === 'equipe' && preview ? equipe() : tab === 'controle' && preview ? controleMob() : list(); }
const tabsH = () => `<div class="tabs"><button data-tab="jour" class="${tab === 'jour' ? 'on' : ''}">Aujourd’hui</button><button data-tab="semaine" class="${tab === 'semaine' ? 'on' : ''}">${preview ? 'Semaines' : 'Mes semaines'}</button>${preview ? `<button data-tab="equipe" class="${tab === 'equipe' ? 'on' : ''}">Équipe</button><button data-tab="controle" class="${tab === 'controle' ? 'on' : ''}">Contrôle${nCtrl ? ` <i class="tbn">${nCtrl}</i>` : ''}</button>` : ''}</div>`;
let nCtrl = 0, ctrlData = [];
async function countCtrl() { if (!preview || !online) return; const { count } = await sb.from('interventions').select('id', { count: 'exact', head: true }).eq('statut', 'controle'); if ((count || 0) !== nCtrl) { nCtrl = count || 0; const b = scr()?.querySelector('[data-tab=controle]'); if (b) b.innerHTML = 'Contrôle' + (nCtrl ? ` <i class="tbn">${nCtrl}</i>` : ''); } }
/* Bureau sur iPhone : retours des techniciens à contrôler, avec photos, puis clôture */
async function controleMob() {
  scr().innerHTML = topBar('À contrôler', 'Retours des techniciens', false) + previewBar() + `<div class="scroll eqs">${tabsH()}<div class="panel"><p>Chargement…</p></div></div><div class="lb" id="eqlb"></div>`; bindTop(); bindPreview();
  const { data, error } = await sb.from('interventions').select('id,date,heure,duree,epingle,type,client,occupant,tel,adresse,complement,cp,ville,travaux,statut,commentaire,photos,valide_par,fin_at,note_bureau,note_lue,intervention_techs(tech_id),pieces(nom,type,path,prive)').in('statut', ['controle', 'attente', 'reprendre']).order('fin_at', { ascending: false, nullsFirst: false });
  if (tab !== 'controle' || openId) return;
  if (error) { toast('Pas de réseau : liste indisponible'); tab = 'jour'; return list(); }
  ctrlData = (data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id) })); nCtrl = ctrlData.filter(i => i.statut === 'controle').length;
  const grp = [['controle', 'À contrôler'], ['reprendre', 'À reprendre (chez le technicien)'], ['attente', 'En attente']];
  scr().innerHTML = topBar('À contrôler', 'Retours des techniciens', false) + previewBar() + `<div class="scroll eqs">${tabsH()}
    ${ctrlData.length ? grp.map(([k, t]) => { const l = ctrlData.filter(i => i.statut === k); return l.length ? `<h2 class="cth">${t} <span>${l.length}</span></h2>` + l.map(i => `<button class="ctj" data-eq="${i.id}"><span class="ctp" data-cph="${E((i.photos || [])[0]?.path || '')}">${(i.photos || []).length ? `<b>${i.photos.length}</b>` : ic('camera')}</span><span class="ctb"><b>${E([i.client, i.occupant].filter(Boolean).join(' · ') || i.travaux || 'Intervention')}</b><small>${E(lbl(i.date))} · ${E((i.valide_par ? T(i.valide_par).nom : i.techs.map(x => T(x).nom).join(', ')) || '')}</small>${i.commentaire ? `<em>« ${E(i.commentaire.slice(0, 90))}${i.commentaire.length > 90 ? '…' : ''} »</em>` : ''}</span><span class="chev">›</span></button>`).join('') : ''; }).join('') : '<div class="done-box">✓ Rien à contrôler, tout est clôturé.</div>'}
    </div><div class="lb" id="eqlb"></div>`;
  bindTop(); bindPreview();
  scr().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; wk = 0; render(); });
  const lb = $('#eqlb'); lb.onclick = e => { if (e.target === lb || e.target.dataset.x !== undefined) lb.classList.remove('on'); };
  scr().querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const i = ctrlData.find(x => x.id === b.dataset.eq); if (i) eqCard(i, lb); });
  const th = [...scr().querySelectorAll('[data-cph]')].filter(x => x.dataset.cph);
  if (th.length) signedMap('retours', th.map(x => x.dataset.cph)).then(u => th.forEach(x => { if (u[x.dataset.cph]) x.style.backgroundImage = `url('${u[x.dataset.cph]}')`; }));
}
async function bureauStatut(i, st, lb) {
  const row = { statut: st };
  if (st === 'reprendre') { const t = (prompt('À reprendre : quel message pour ' + i.techs.map(x => T(x).nom).join(', ') + ' ?\n(il le reçoit directement sur son application)', '') || '').trim(); if (t.length < 2) return toast('Écrivez ce qu’il faut reprendre'); Object.assign(row, { note_bureau: t, note_at: new Date().toISOString(), note_lue: false }); }
  const { error } = await sb.from('interventions').update(row).eq('id', i.id); if (error) return toast('Erreur : ' + error.message);
  Object.assign(i, row); lb.classList.remove('on'); moData = null; eqData = null;
  toast(st === 'cloturee' ? '✓ Intervention clôturée' : st === 'reprendre' ? '↺ À reprendre · le technicien est prévenu' : 'Mise en attente');
  await countCtrl(); render();
}
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

const FER = {};
function feries(y) { if (FER[y]) return FER[y];
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  const P = new Date(y, mo - 1, da, 12), o = {};
  [['01-01', 'Jour de l’an'], ['05-01', 'Fête du Travail'], ['05-08', 'Victoire 1945'], ['07-14', 'Fête nationale'], ['08-15', 'Assomption'], ['11-01', 'Toussaint'], ['11-11', 'Armistice'], ['12-24', 'Veille de Noël'], ['12-25', 'Noël'], ['12-31', 'Saint-Sylvestre']].forEach(([md, n]) => o[y + '-' + md] = n);
  o[iso(addDays(P, 1))] = 'Lundi de Pâques'; o[iso(addDays(P, 39))] = 'Ascension'; o[iso(addDays(P, 50))] = 'Lundi de Pentecôte'; return FER[y] = o; }
const ferie = d => feries(+d.slice(0, 4))[d] || '';
/* ---------- Vue équipe (accès bureau) : la semaine de toute l'équipe, comme sur l'ordinateur ---------- */
let wkE = 0, eqData = null, eqKey = '', eqMode = 'mois', moE = 0, selD = null, moData = null, moKey = '';
try { eqMode = localStorage.getItem('bk-eqm') || 'mois'; if (eqMode === 'liste') eqMode = 'mois'; } catch (e) { }
const ini = n => String(n || '?').trim().slice(0, 1).toUpperCase();
async function equipe() {
  if (eqMode === 'mois') return equipeMois();
  const m0 = addDays(monday(new Date()), 7 * wkE), a = iso(m0), b = iso(addDays(m0, 6)), key = a;
  const H0 = 7, H1 = 20, today = iso(new Date());
  if (eqKey !== key || !eqData) { scr().innerHTML = topBar('Planning équipe', 'Semaine du ' + lbl(a), false) + previewBar() + '<div class="scroll"><div class="panel"><p>Chargement…</p></div></div>'; bindTop(); bindPreview();
    const { data, error } = await sb.from('interventions').select('id,date,heure,duree,epingle,type,client,occupant,tel,adresse,complement,cp,ville,travaux,statut,commentaire,photos,valide_par,fin_at,intervention_techs(tech_id),pieces(nom,type,path,prive)').gte('date', a).lte('date', b);
    if (error) { toast('Pas de réseau : vue équipe indisponible'); tab = 'jour'; return list(); }
    eqData = (data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id) })); eqKey = key; }
  const all = eqData, days = [...Array(7)].map((_, k) => iso(addDays(m0, k))).filter((d, k) => k < 5 || all.some(i => i.date === d));
  const lanes = d => team.filter(t => all.some(i => i.date === d && !i.epingle && i.heure && i.techs.includes(t.id)));
  const top0 = 210, px = Math.max(34, Math.floor((window.innerHeight - top0) / (H1 - H0)));
  const mm = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const col = d => { const ls = lanes(d); return `<div class="eqd ${d === today ? 'td' : ''}" data-day="${d}" style="height:${(H1 - H0) * px}px;background-image:repeating-linear-gradient(to bottom,#E6E8EF 0 1px,transparent 1px ${px}px)">${ls.map((t, k) => all.filter(i => i.date === d && !i.epingle && i.heure && i.techs.includes(t.id)).map(i => {
      const s0 = Math.max(mm(i.heure), H0 * 60), s1 = Math.min(mm(i.heure) + Math.round((+i.duree || 1) * 60), H1 * 60); if (s1 <= H0 * 60) return '';
      return `<button class="eqe ${i.statut}" data-eq="${i.id}" style="top:${(s0 - H0 * 60) / 60 * px}px;height:${Math.max(14, (s1 - s0) / 60 * px - 2)}px;left:${k / ls.length * 100}%;width:calc(${100 / ls.length}% - 2px);--c:${t.couleur}">${ls.length <= 2 ? E((i.client || i.occupant || i.travaux || '').slice(0, 18)) : ''}</button>`; }).join('')).join('')}</div>`; };
  const pins = d => all.filter(i => i.date === d && (i.epingle || !i.heure)).length;
  scr().innerHTML = topBar('Planning équipe', 'Semaine du ' + lbl(a), false) + previewBar() + `<div class="scroll eqs">
    ${tabsH()}
    <div class="wkn"><button id="ep" aria-label="Semaine précédente">‹</button><span>${wkE === 0 ? 'Cette semaine' : wkE === 1 ? 'Semaine prochaine' : 'Semaine du ' + lbl(a).replace(/^\S+ /, '')}</span><button id="en" aria-label="Semaine suivante">›</button></div>
    <div class="eqseg"><button data-em="mois">Mois</button><button data-em="grille" class="${eqMode === 'grille' ? 'on' : ''}">Grille semaine</button></div>
    ${false ? days.map(d => { const its = all.filter(i => i.date === d), x = new Date(d + 'T12:00'), fr = ferie(d);
      return `<div class="eqday ${d === today ? 'td' : ''}"><h3>${lbl(d)}${d === today ? ' · aujourd’hui' : ''}${fr ? `<span class="fer">${E(fr)}</span>` : ''}</h3>
        ${team.map(t => { const mi = its.filter(i => i.techs.includes(t.id)).sort((a, b) => (b.epingle - a.epingle) || String(a.heure || '').localeCompare(String(b.heure || '')));
          return `<div class="eqp" style="--c:${t.couleur}"><div class="nm"><i></i>${E(t.nom)}${mi.length ? '' : ' <small>libre</small>'}</div>${mi.map(i => `<button class="eqit ${i.statut}" data-eq="${i.id}"><span class="t">${i.epingle || !i.heure ? ic('pin') : hh(i.heure) + '<small>' + fin(i.heure, i.duree) + '</small>'}</span><span class="b"><b>${E([i.client, i.occupant].filter(Boolean).join(' · ') || i.travaux || 'Intervention')}</b><small>${E([i.adresse, i.ville].filter(Boolean).join(', ') || (i.travaux || '').slice(0, 60))}</small></span></button>`).join('')}</div>`; }).join('')}</div>`; }).join('') : `
    <div class="eqleg">${team.map(t => `<span><i style="background:${t.couleur}"></i>${E(t.nom)}</span>`).join('')}</div>
    <div class="eqg" style="grid-template-columns:30px repeat(${days.length},minmax(0,1fr))">
      <div></div>${days.map(d => { const x = new Date(d + 'T12:00'); return `<div class="eqh ${d === today ? 'td' : ''} ${ferie(d) ? 'fer' : ''}" title="${E(ferie(d))}"><b>${x.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</b> ${x.getDate()}${pins(d) ? `<small>${ic('pin')}${pins(d)}</small>` : ''}</div>`; }).join('')}
      <div class="eqax">${[...Array(H1 - H0)].map((_, k) => `<div style="height:${px}px">${H0 + k}h</div>`).join('')}</div>${days.map(col).join('')}
    </div>`}<button class="primary-step" id="eqnew" style="margin-top:14px">+ Planifier une intervention</button>
    <p class="eqhint">Touchez un créneau vide pour y planifier · glissez à gauche ou à droite pour changer de semaine</p>
    </div><div class="lb" id="eqlb"></div>`;
  bindTop(); bindPreview();
  scr().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; wk = 0; render(); });
  const go = n => { wkE = Math.max(-8, Math.min(26, wkE + n)); eqData = null; equipe(); };
  $('#ep').onclick = () => go(-1); $('#en').onclick = () => go(1);
  const g = scr().querySelector('.eqs'); let tx = null, ty = 0;
  g.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  g.addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); });
  const lb = $('#eqlb'); lb.onclick = e => { if (e.target === lb || e.target.dataset.x !== undefined) lb.classList.remove('on'); };
  scr().querySelectorAll('[data-em]').forEach(b => b.onclick = () => { eqMode = b.dataset.em; try { localStorage.setItem('bk-eqm', eqMode); } catch (e) { } equipe(); });
  $('#eqnew').onclick = () => quickNew(days.includes(today) ? today : days[0], '08:00');
  scr().querySelectorAll('.eqd').forEach(c => c.onclick = e => { if (e.target.closest('[data-eq]')) return; const r = c.getBoundingClientRect(), m = H0 * 60 + Math.floor((e.clientY - r.top) / px * 4) * 15;
    quickNew(c.dataset.day, String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); });
  scr().querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const i = all.find(x => x.id === b.dataset.eq); if (i) eqCard(i, lb); });
}

/* Planifier depuis le téléphone (bureau) */
function quickNew(date, heure, ex) {
  const lb = $('#eqlb'), [h, m] = heure.split(':').map(Number), dm = ex && ex.heure ? h * 60 + m + Math.round((+ex.duree || 1) * 60) : Math.min(h + 1, 19) * 60 + m, fin2 = String(Math.floor(dm / 60)).padStart(2, '0') + ':' + String(dm % 60).padStart(2, '0'), v = k => E(ex && ex[k] || '');
  lb.innerHTML = `<form class="eqcard eqf" id="qf"><button type="button" data-x aria-label="Fermer">×</button><h3>${ex ? 'Modifier' : 'Planifier'}</h3>
    <label>Date<input type="date" name="date" value="${date}" required></label>
    <div class="r2"><label>De<input type="time" name="h1" value="${heure}" step="60" required></label><label>À<input type="time" name="h2" value="${fin2}" step="60" required></label></div>
    <div class="qwho">${team.map(t => `<label><input type="checkbox" name="t" value="${t.id}" ${ex && ex.techs.includes(t.id) ? 'checked' : ''}><i style="background:${t.couleur}"></i>${E(t.nom)}</label>`).join('')}</div>
    <div class="r2"><label>Client<input name="client" autocomplete="off" value="${v('client')}"></label><label>Occupant<input name="occupant" autocomplete="off" value="${v('occupant')}"></label></div>
    <label>Téléphone<input name="tel" type="tel" value="${v('tel')}"></label>
    <label>Adresse<input name="adresse" autocomplete="off" value="${v('adresse')}" placeholder="Tapez le début, puis choisissez"><div class="qac" hidden></div></label>
    <label>Complément<input name="complement" value="${v('complement')}" placeholder="Résidence, bâtiment…"></label>
    <div class="r2"><label>Code postal<input name="cp" inputmode="numeric" maxlength="5" value="${v('cp')}"></label><label>Ville<input name="ville" value="${v('ville')}"></label></div>
    <label>Travaux à effectuer<textarea name="travaux">${v('travaux')}</textarea></label>
    <button class="primary-step" type="submit" id="qsv">${ex ? 'Enregistrer' : 'Planifier'}</button><button type="button" class="eqback" data-x>Annuler</button></form>`;
  lb.classList.add('on'); lb.scrollTop = 0; pullClose(lb);
  lb.querySelectorAll('input:not([type=checkbox]):not([type=date]):not([type=time]),textarea').forEach(x => x.setAttribute('autocomplete', 'bk-' + x.name)); $('#qf').setAttribute('autocomplete', 'off');
  const f = $('#qf'), box = f.querySelector('.qac'); let tm, seq = 0;
  f.adresse.oninput = () => { clearTimeout(tm); const q = f.adresse.value.trim(); if (q.length < 4) return box.hidden = true;
    tm = setTimeout(async () => { const my = ++seq; let r = [];
      try { const j = await fetch('https://data.geopf.fr/geocodage/search?index=address&limit=5&lat=43.514&lon=4.988&autocomplete=1&q=' + encodeURIComponent(q)).then(x => x.json()); r = (j.features || []).map(x => x.properties); } catch (e) { }
      if (my !== seq) return; const n = ((q.match(/^\s*(\d+\s*(?:bis|ter|quater|[a-d])?)\b[\s,]*/i) || [])[1] || '').trim(), nm = a => a.type === 'street' && n && !/^\d/.test(a.name || '') ? n + ' ' + a.name : a.name;
      box.innerHTML = r.map((a, k) => `<button type="button" data-k="${k}"><b>${E(nm(a))}</b><small>${E(a.postcode + ' ' + a.city)}</small></button>`).join(''); box.hidden = !r.length;
      box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const a = r[+b.dataset.k]; f.adresse.value = a.type === 'municipality' ? '' : nm(a); f.cp.value = a.postcode || ''; f.ville.value = a.city || ''; box.hidden = true; f.complement.focus(); }); }, 250); };
  f.onsubmit = async e => { e.preventDefault(); const fd = new FormData(f), ts = fd.getAll('t'); if (!ts.length) return toast('Choisissez au moins une personne');
    const mm = t => { const [a, b] = t.split(':').map(Number); return a * 60 + b; }, d1 = mm(fd.get('h1')), d2 = mm(fd.get('h2')); if (d2 <= d1) return toast('L’heure de fin doit être après le début');
    const btn = $('#qsv'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    if (ex) { const up = { date: fd.get('date'), heure: ex.epingle ? null : fd.get('h1'), duree: ex.epingle ? 0 : Math.round((d2 - d1) / 60 * 10000) / 10000, client: fd.get('client'), occupant: fd.get('occupant'), tel: fd.get('tel'), adresse: fd.get('adresse'), complement: fd.get('complement') || null, cp: fd.get('cp'), ville: fd.get('ville'), travaux: fd.get('travaux'), updated_by: me.id };
      const r = await sb.from('interventions').update(up).eq('id', ex.id); if (r.error) { btn.disabled = false; btn.textContent = 'Enregistrer'; return toast('Erreur : ' + r.error.message); }
      const plus = ts.filter(t => !ex.techs.includes(t)), moins = ex.techs.filter(t => !ts.includes(t));
      if (plus.length) await sb.from('intervention_techs').insert(plus.map(t => ({ intervention_id: ex.id, tech_id: t })));
      for (const t of moins) await sb.from('intervention_techs').delete().match({ intervention_id: ex.id, tech_id: t });
      lb.classList.remove('on'); eqData = null; moData = null; equipe(); return toast('Intervention enregistrée'); }
    const row = { type: 'intervention', date: fd.get('date'), heure: fd.get('h1'), duree: Math.round((d2 - d1) / 60 * 10000) / 10000, epingle: false, statut: 'planifiee', client: fd.get('client'), occupant: fd.get('occupant'), tel: fd.get('tel'), adresse: fd.get('adresse'), complement: fd.get('complement') || null, cp: fd.get('cp'), ville: fd.get('ville'), travaux: fd.get('travaux'), materiel: [], recurrent: false, created_by: me.id, updated_by: me.id };
    const r = await sb.from('interventions').insert(row).select('id').single();
    if (r.error) { btn.disabled = false; btn.textContent = 'Planifier'; return toast('Erreur : ' + r.error.message); }
    const r2 = await sb.from('intervention_techs').insert(ts.map(t => ({ intervention_id: r.data.id, tech_id: t })));
    if (r2.error) return toast('Erreur : ' + r2.error.message);
    lb.classList.remove('on'); eqData = null; moData = null; equipe(); toast('Planifié pour ' + ts.map(t => T(t).nom).join(', ')); };
}

/* Vue mois façon Agenda Apple : grille du mois + liste du jour choisi */
const telLink = t => t ? `<a class="eqtel" href="${telUrl(t)}">${ICON.phone} ${E(t)}</a>` : '';
function eqZoom(html, list, k) { let z = $('#eqz'); if (!z) { z = document.createElement('div'); z.id = 'eqz'; z.className = 'lb'; scr().appendChild(z); }
  const close = () => { z.classList.remove('on'); z.innerHTML = ''; };
  if (!list) { z.innerHTML = html + '<button aria-label="Fermer">×</button>'; z.classList.add('on'); z.onclick = close; return; }
  let i = k || 0;
  const draw = () => { z.innerHTML = `<img class="zimg" src="${list[i].u}" alt="" draggable="false"><button aria-label="Fermer" data-zx>×</button>${list.length > 1 ? `<button class="zar l" data-zp aria-label="Photo précédente">‹</button><button class="zar r" data-zn aria-label="Photo suivante">›</button>` : ''}<div class="znav">${list.length > 1 ? (i + 1) + ' / ' + list.length : ''}${list[i].t ? `<small>${E(list[i].t)}</small>` : ''}<small>${list.length > 1 ? 'Glissez ← → pour changer · ' : ''}tirez vers le bas pour fermer</small></div>`; };
  const go = n => { if (list.length < 2) return; i = (i + n + list.length) % list.length; draw(); };
  draw(); z.classList.add('on');
  z.onclick = e => { if (e.target.closest('[data-zp]')) return go(-1); if (e.target.closest('[data-zn]')) return go(1); if (e.target.closest('[data-zx]') || e.target === z) close(); };
  let x0 = null, y0 = 0, dx = 0, dy = 0;
  z.ontouchstart = e => { if (e.touches.length > 1) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = dy = 0; const im = z.querySelector('.zimg'); if (im) im.style.transition = 'none'; };
  z.ontouchmove = e => { if (x0 === null) return; e.preventDefault(); dx = e.touches[0].clientX - x0; dy = e.touches[0].clientY - y0; const im = z.querySelector('.zimg'); if (!im) return;
    if (Math.abs(dy) > Math.abs(dx) && dy > 0) { im.style.transform = `translateY(${dy}px) scale(${Math.max(.75, 1 - dy / 900)})`; z.style.background = `rgba(0,0,0,${Math.max(.3, .92 - dy / 500)})`; } else im.style.transform = `translateX(${dx}px)`; };
  z.ontouchend = () => { if (x0 === null) return; x0 = null; const im = z.querySelector('.zimg'); z.style.background = ''; if (im) { im.style.transition = ''; im.style.transform = ''; }
    if (dy > 110 && Math.abs(dy) > Math.abs(dx)) return close(); if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); };
}
/* Tirer la fiche vers le bas (quand on est tout en haut) pour la fermer, comme Instagram */
function pullClose(lb) { if (lb.dataset.pull) return; lb.dataset.pull = 1; let y0 = null, dy = 0, card = null;
  lb.addEventListener('touchstart', e => { card = lb.querySelector('.eqcard'); y0 = lb.scrollTop <= 0 && card && !lb.querySelector('.eqf') ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  lb.addEventListener('touchmove', e => { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy <= 0) { card.style.transform = ''; return; } if (e.cancelable) e.preventDefault(); card.style.transition = 'none'; card.style.transform = `translateY(${dy * .8}px)`; }, { passive: false });
  lb.addEventListener('touchend', () => { if (y0 === null || !card) return; y0 = null; card.style.transition = ''; if (dy > 120) { card.style.transform = 'translateY(100vh)'; setTimeout(() => { lb.classList.remove('on'); card.style.transform = ''; }, 180); } else card.style.transform = ''; }); }
function eqCard(i, lb) {
  lb.innerHTML = `<div class="eqcard"><button data-x aria-label="Fermer">×</button>${['controle', 'attente', 'reprendre', 'cloturee'].includes(i.statut) ? `<span class="st ${i.statut}" style="display:inline-block;font-size:13px;padding:4px 10px;margin-bottom:6px">${{ controle: 'À contrôler', attente: 'En attente', reprendre: 'À reprendre', cloturee: 'Clôturée' }[i.statut]}</span><br>` : ''}<small>${lbl(i.date)}${i.epingle || !i.heure ? ' · dans la journée' : ' · ' + hh(i.heure) + ' – ' + fin(i.heure, i.duree)}</small>
    <h3>${E([i.client, i.occupant].filter(Boolean).join(' · ') || i.travaux || 'Intervention')}</h3>${i.adresse || i.ville ? `<a class="eqmap" href="https://maps.apple.com/?q=${encodeURIComponent(fullAddr(i) + ', France')}">${ICON.route}<span>${E([[i.adresse, i.complement].filter(Boolean).join(', '), [i.cp, i.ville].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}<small>Voir dans Plans · accès, stationnement</small></span></a>` : ''}
    ${i.travaux ? `<p style="color:var(--mute)">${E(i.travaux.slice(0, 300))}</p>` : ''}<div class="eqw">${i.techs.map(t => `<span><i style="background:${T(t).couleur}"></i>${E(T(t).nom)}</span>`).join('')}</div>
    ${telLink(i.tel)}
    ${i.commentaire || (i.photos || []).length ? `<div class="eqret"><h4>${ic('check-circle')} Retour ${i.valide_par ? 'de ' + E(T(i.valide_par).nom) : 'du technicien'}</h4>${i.commentaire ? `<p style="white-space:pre-line">${E(i.commentaire)}</p>` : ''}
      <div class="eqph">${(i.photos || []).map(p => `<img alt="${E(p.tag || 'Photo')}" data-b="retours" data-ph="${E(p.path)}">`).join('')}</div></div>` : ''}
    ${(i.pieces || []).length ? `<div class="eqret"><h4>${ic('paperclip')} Pièces jointes</h4><div class="eqph">${i.pieces.map(p => p.type === 'photo' ? `<img alt="${E(p.nom)}" data-b="${p.prive ? 'bureau' : 'pieces'}" data-ph="${E(p.path)}">` : `<a class="eqdoc" data-b="${p.prive ? 'bureau' : 'pieces'}" data-doc2="${E(p.path)}">${ic('file')}<span>${E((p.prive ? '🔒 ' : '') + p.nom)}</span></a>`).join('')}</div></div>` : ''}
    ${preview && ['controle', 'attente', 'reprendre'].includes(i.statut) ? `<div class="eqact"><button class="primary-step" id="eqclo" style="background:var(--ok)">✓ Clôturer</button><div class="r2"><button class="eqback" id="eqrep" style="color:#DC2626">↺ À reprendre</button>${i.statut !== 'attente' ? '<button class="eqback" id="eqatt">En attente</button>' : ''}</div></div>` : ''}
    <button class="primary-step" id="eqed" style="margin-top:14px;${['controle', 'attente', 'reprendre'].includes(i.statut) ? 'background:#fff;color:#0E1630;border:2px solid var(--line)' : ''}">Modifier</button><button type="button" class="eqback" data-x>‹ Retour</button></div>`;
  lb.classList.add('on'); lb.scrollTop = 0; pullClose(lb);
  if ($('#eqclo')) { $('#eqclo').onclick = () => bureauStatut(i, 'cloturee', lb); $('#eqrep').onclick = () => bureauStatut(i, 'reprendre', lb); if ($('#eqatt')) $('#eqatt').onclick = () => bureauStatut(i, 'attente', lb); } $('#eqed').onclick = () => quickNew(i.date, String(i.heure || '08:00').slice(0, 5), i);
  const els = [...lb.querySelectorAll('[data-ph],[data-doc2]')], byB = {}; els.forEach(x => (byB[x.dataset.b] = byB[x.dataset.b] || []).push(x.dataset.ph || x.dataset.doc2));
  (async () => { const urls = {}; for (const bk in byB) Object.assign(urls, await signedMap(bk, byB[bk]));
    els.forEach(x => { const u = urls[x.dataset.ph || x.dataset.doc2]; if (!u) return; if (x.tagName === 'IMG') { x.src = u; x.onclick = ev => { ev.stopPropagation(); const gal = [...x.closest('.eqph').querySelectorAll('img')].filter(y => y.getAttribute('src')).map(y => ({ u: y.src, t: y.alt })); eqZoom('', gal, Math.max(0, gal.findIndex(g => g.u === x.src))); }; } else x.onclick = ev => { ev.stopPropagation(); window.open(u, '_blank'); }; }); })();
}
async function equipeMois() {
  const now = new Date(), first = new Date(now.getFullYear(), now.getMonth() + moE, 1, 12), last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
  const g0 = monday(first), g1 = addDays(monday(last), 6), a = iso(g0), b = iso(g1), today = iso(now);
  if (!selD || selD < iso(first) || selD > iso(last)) selD = moE === 0 ? today : iso(first);
  const title = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
  if (moKey !== a || !moData) { scr().innerHTML = topBar('Planning équipe', title, false) + previewBar() + '<div class="scroll"><div class="panel"><p>Chargement…</p></div></div>'; bindTop(); bindPreview();
    const { data, error } = await sb.from('interventions').select('id,date,heure,duree,epingle,type,client,occupant,tel,adresse,complement,cp,ville,travaux,statut,commentaire,photos,valide_par,fin_at,intervention_techs(tech_id),pieces(nom,type,path,prive)').gte('date', a).lte('date', b);
    if (error) { toast('Pas de réseau : vue équipe indisponible'); tab = 'jour'; return list(); }
    moData = (data || []).map(i => ({ ...i, techs: i.intervention_techs.map(x => x.tech_id) })); moKey = a; }
  const all = moData, nW = Math.round((g1 - g0) / 864e5 / 7);
  const bar = d => { const its = all.filter(i => i.date === d), segs = its.flatMap(i => i.techs.length ? i.techs : ['?']).slice(0, 8); return segs.length ? `<span class="mbar">${segs.map(t => `<i style="background:${T(t).couleur}"></i>`).join('')}</span>` : ''; };
  const cells = [...Array(nW * 7)].map((_, k) => { const d = iso(addDays(g0, k)), x = new Date(d + 'T12:00'), out = x.getMonth() !== first.getMonth(), we = [0, 6].includes(x.getDay());
    return `<button class="mday ${out ? 'out' : ''} ${we ? 'we' : ''} ${d === today ? 'td' : ''} ${d === selD ? 'sel' : ''} ${ferie(d) ? 'fer' : ''}" data-d="${d}"><b>${x.getDate()}</b>${out ? '' : bar(d)}${!out && ferie(d) ? '<span class="mfd"></span>' : ''}</button>`; }).join('');
  const its = all.filter(i => i.date === selD).sort((x, y) => (y.epingle - x.epingle) || String(x.heure || '').localeCompare(String(y.heure || '')));
  const strip = i => i.techs.length > 1 ? `linear-gradient(${i.techs.map((t, k) => `${T(t).couleur} ${k / i.techs.length * 100}% ${(k + 1) / i.techs.length * 100}%`).join(',')})` : T(i.techs[0]).couleur;
  scr().innerHTML = topBar('Planning équipe', title, false) + previewBar() + `<div class="scroll eqs">
    ${tabsH()}
    <div class="eqseg"><button data-em="mois" class="on">Mois</button><button data-em="grille">Grille semaine</button></div>
    <div class="wkn"><button id="mp" aria-label="Mois précédent">‹</button><span>${title}</span><button id="mn" aria-label="Mois suivant">›</button></div>
    <div class="mgrid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span class="mh">${x}</span>`).join('')}${cells}</div>
    <div class="mlist"><h3>${lbl(selD)}${ferie(selD) ? ` <span class="fer">${E(ferie(selD))}</span>` : ''}</h3>
      ${ferie(selD) ? `<div class="mfer">${ic('calendar')} Jour férié · ${E(ferie(selD))}</div>` : ''}
      ${its.length ? its.map(i => `<button class="mit" data-eq="${i.id}" style="--s:${strip(i)}"><span class="b"><b>${E([i.client, i.occupant].filter(Boolean).join(' · ') || i.travaux || 'Intervention')}</b><small>${E([i.adresse, i.ville].filter(Boolean).join(', ') || i.techs.map(t => T(t).nom).join(', '))}</small><em>${E(i.techs.map(t => T(t).nom).join(' + '))}</em></span><span class="t">${i.epingle || !i.heure ? ic('pin') : hh(i.heure) + '<br>' + fin(i.heure, i.duree)}</span></button>`).join('') : '<p class="mempty">Rien de prévu ce jour-là.</p>'}
    </div>
    <button class="primary-step" id="eqnew" style="margin-top:14px">+ Planifier le ${new Date(selD + 'T12:00').getDate()}</button>
    </div><div class="lb" id="eqlb"></div>`;
  bindTop(); bindPreview();
  scr().querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; wk = 0; render(); });
  scr().querySelectorAll('[data-em]').forEach(b => b.onclick = () => { eqMode = b.dataset.em; try { localStorage.setItem('bk-eqm', eqMode); } catch (e) { } equipe(); });
  const goM = n => { moE += n; moData = null; selD = null; equipeMois(); };
  $('#mp').onclick = () => goM(-1); $('#mn').onclick = () => goM(1);
  scr().querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const d = b.dataset.d; if (d < iso(first)) return goM(-1); if (d > iso(last)) return goM(1); selD = d; const y = scr().querySelector('.scroll').scrollTop; equipeMois().then(() => { scr().querySelector('.scroll').scrollTop = y; }); });
  const g = scr().querySelector('.mgrid'); let tx = null, ty = 0;
  g.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  g.addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goM(dx < 0 ? 1 : -1); });
  const lb = $('#eqlb'); lb.onclick = e => { if (e.target === lb || e.target.dataset.x !== undefined) lb.classList.remove('on'); };
  $('#eqnew').onclick = () => quickNew(selD, '08:00');
  scr().querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const i = all.find(x => x.id === b.dataset.eq); if (i) eqCard(i, lb); });
}
