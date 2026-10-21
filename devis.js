/* BK+ — demande de devis guidée par photos */
(function(){
  const DATA = window.BK_DEVIS, $ = s => document.querySelector(s), root = $('#wizard');
  const E = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>';
  const SNOW = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M4.9 6l14.2 12M19.1 6L4.9 18M9 4l3 2 3-2M9 20l3-2 3 2"/></svg>';
  const STEPS = ['Votre besoin','Les photos','Les détails','Vos coordonnées'];
  const st = { step:0, cat:'tous', svc:null, shots:{}, skipped:{}, extra:[], info:{ urgence:'semaine', profil:'Particulier' } };
  const S = id => DATA.services.find(s=>s.id===id);
  const tile = (s,k) => `guides/g${String(s.img).padStart(2,'0')}-${k+1}.webp`;

  // Pré-sélection depuis un lien (devis.html?type=chauffe-eau)
  const pre = new URLSearchParams(location.search).get('type'); if(pre && S(pre)){ st.svc=pre; st.step=1; }

  function head(){ return `<div class="wz-steps">${STEPS.map((t,i)=>`<div class="${i<=st.step?'on':''}">${i+1}. ${t}</div>`).join('')}</div>`; }
  function go(n){ st.step=n; render(); root.scrollIntoView({behavior:'smooth',block:'start'}); }

  /* 1 — Choix du besoin */
  function step0(){
    const list = DATA.services.filter(s=>st.cat==='tous'||s.cat===st.cat);
    return `<h2>De quoi avez-vous besoin ?</h2><p class="sub">Choisissez la demande la plus proche. Pour chacune, nous vous indiquons les photos à prendre.</p>
    <div class="chips" role="group" aria-label="Catégories"><button data-cat="tous" class="${st.cat==='tous'?'on':''}">Tout voir</button>${DATA.categories.map(c=>`<button data-cat="${c.id}" class="${st.cat===c.id?'on':''}">${E(c.nom)}</button>`).join('')}</div>
    <div class="svc">${list.map(s=>`<button data-svc="${s.id}">${s.img?`<img src="${tile(s,0)}" alt="" width="64" height="56" loading="lazy">`:`<span class="ph">${s.id==='climatisation'?SNOW:ICON}</span>`}<span>${E(s.nom)}<small>${s.photos.length?s.photos.length+' photo'+(s.photos.length>1?'s':'')+' guidée'+(s.photos.length>1?'s':''):'Photos libres'}</small></span></button>`).join('')}</div>`;
  }

  /* 2 — Photos guidées */
  function reqCount(s){ return s.photos.filter(p=>!p[2]).length; }
  function doneReq(s){ return s.photos.filter((p,k)=>!p[2] && (st.shots[k]||st.skipped[k])).length; }
  function step1(){
    const s=S(st.svc), total=reqCount(s), done=doneReq(s);
    const slots = s.photos.map((p,k)=>{
      const shot=st.shots[k], sk=st.skipped[k];
      return `<div class="slot ${shot?'done':''} ${sk?'skip':''}">
        <div class="ex"><img src="${tile(s,k)}" alt="Exemple : ${E(p[0])}" loading="lazy"><span>Exemple</span></div>
        <div><h3>${k+1}. ${E(p[0])}${p[2]?'<span class="opt">Facultative</span>':''}</h3><p class="hint">${E(p[1]||'Cadrez comme sur l’exemple.')}</p>
        ${shot?`<div class="mine"><img src="${shot}" alt="Votre photo"><div><b>✓ Photo ajoutée</b><br><label class="gal" style="display:inline-flex;margin-top:6px;border-radius:10px;padding:8px 12px;font:800 14px Manrope,sans-serif;cursor:pointer;border:2px solid var(--line)">Refaire<input type="file" accept="image/*" capture="environment" class="sr" data-k="${k}"></label></div></div>`
        : sk ? `<div class="acts"><b style="color:var(--mute);padding:12px 0">Photo impossible, c’est noté.</b><button class="no" data-unskip="${k}">Annuler</button></div>`
        : `<div class="acts"><label class="take">${CAM}Prendre la photo<input type="file" accept="image/*" capture="environment" class="sr" data-k="${k}"></label><label class="gal">Galerie<input type="file" accept="image/*" class="sr" data-k="${k}"></label>${p[2]?'':`<button class="no" data-skip="${k}">Je ne peux pas</button>`}</div>`}
        </div></div>`;
    }).join('');
    return `<div class="chosen">${s.img?`<img src="${tile(s,0)}" alt="" style="width:46px;height:40px;border-radius:9px;object-fit:cover">`:''}${E(s.nom)}<button data-back>Changer</button></div>
    <h2>${s.photos.length?'Prenez ces photos':'Ajoutez des photos si vous le pouvez'}</h2>
    <p class="sub">${s.photos.length?'Cadrez comme sur l’exemple. Elles nous permettent de vous faire un devis précis sans nous déplacer.':'Photographiez l’équipement et le problème : ça nous aide à préparer l’intervention.'}</p>
    ${total?`<div class="counter"><span>${done} / ${total} photos obligatoires</span><div class="bar"><i style="width:${total?done/total*100:0}%"></i></div></div>`:''}
    <div class="slots">${slots}</div>
    <div class="extra" style="margin-top:12px"><div><b>${s.photos.length?'Une autre photo utile ?':'Vos photos'}</b><div style="color:var(--mute);font-size:14px">Facultatif · jusqu’à ${s.photos.length?4:8} photos</div></div>
      <div class="thumbs">${st.extra.map((src,i)=>`<div><img src="${src}" alt="Photo ajoutée"><button data-rmx="${i}" aria-label="Retirer">×</button></div>`).join('')}</div>
      ${st.extra.length<(s.photos.length?4:8)?`<label class="btn btn-line" style="margin-left:auto;padding:12px 16px">${CAM}Ajouter<input type="file" accept="image/*" multiple class="sr" id="xin"></label>`:''}</div>
    <div class="err" id="err"></div>
    <div class="nav"><button class="btn btn-line" data-back>← Retour</button><button class="btn btn-grad" id="next">Continuer →</button></div>`;
  }

  /* 3 — Détails */
  function step2(){
    const s=S(st.svc), i=st.info;
    const ph = { 'climatisation':'Ex. : installation d’une clim réversible dans un salon de 30 m², ou clim qui ne refroidit plus…', 'autre':'Décrivez votre besoin ou la panne…' }[s.id] || 'Ex. : le chauffe-eau fuit par le dessous depuis ce matin, il a environ 10 ans…';
    return `<div class="chosen">${E(s.nom)}<button data-goto="1">Photos (${Object.keys(st.shots).length+st.extra.length})</button></div>
    <h2>Quelques détails</h2><p class="sub">Plus vous en dites, plus le devis sera juste.</p>
    <div class="form">
      <label class="full">Votre message<textarea id="msg" placeholder="${E(ph)}">${E(i.msg||'')}</textarea></label>
      <div class="full"><div style="font-weight:800;font-size:14.5px;margin-bottom:8px">C’est urgent ?</div><div class="radios">
        ${[['urgent','Oui, fuite ou panne en cours'],['semaine','Dans la semaine'],['pas-presse','Pas pressé, je prévois']].map(([v,l])=>`<label><input type="radio" name="urg" value="${v}" ${i.urgence===v?'checked':''}>${l}</label>`).join('')}</div></div>
      <div class="full"><div style="font-weight:800;font-size:14.5px;margin-bottom:8px">Vous êtes</div><div class="radios">
        ${['Particulier','Agence immobilière / syndic','Professionnel / collectivité'].map(v=>`<label><input type="radio" name="prof" value="${E(v)}" ${i.profil===v?'checked':''}>${E(v)}</label>`).join('')}</div></div>
    </div>
    ${i.urgence==='urgent'?`<div class="demo-note" style="background:#FDECEC;border-color:#F8C9C9;color:#991B1B">Fuite en cours ? Coupez l’eau au compteur et appelez-nous directement : <a href="tel:+33484489551" style="color:#991B1B;font-weight:800">04 84 48 95 51</a>.</div>`:''}
    <div class="nav"><button class="btn btn-line" data-goto="1">← Retour</button><button class="btn btn-grad" id="next">Continuer →</button></div>`;
  }

  /* 4 — Coordonnées */
  function step3(){
    const s=S(st.svc), i=st.info, pics=[...Object.values(st.shots),...st.extra];
    return `<div class="chosen" style="flex-wrap:wrap">${E(s.nom)}<div class="recap" style="flex-basis:100%">${pics.map(p=>`<img src="${p}" alt="">`).join('')}</div></div>
    <h2>Où et comment vous joindre ?</h2><p class="sub">Nous vous rappelons pendant nos horaires : du lundi au jeudi de 7h30 à 18h, le vendredi de 7h30 à 12h30.</p>
    <form class="form" id="f" novalidate>
      <label>Nom et prénom *<input name="nom" autocomplete="name" required value="${E(i.nom||'')}"></label>
      <label>Téléphone *<input name="tel" type="tel" autocomplete="tel" inputmode="tel" required value="${E(i.tel||'')}"></label>
      <label class="full">E-mail<input name="email" type="email" autocomplete="email" value="${E(i.email||'')}"></label>
      <label class="full">Adresse de l’intervention<input name="adresse" autocomplete="street-address" value="${E(i.adresse||'')}"></label>
      <label>Code postal *<input name="cp" inputmode="numeric" autocomplete="postal-code" maxlength="5" required value="${E(i.cp||'')}"></label>
      <label>Ville *<input name="ville" autocomplete="address-level2" required value="${E(i.ville||'')}" list="villes"></label>
      <datalist id="villes">${['Istres','Miramas','Martigues','Fos-sur-Mer','Port-de-Bouc','Saint-Chamas','Cornillon-Confoux','Grans','Salon-de-Provence','Vitrolles','Marignane','Sausset-les-Pins','Port-Saint-Louis-du-Rhône','Aix-en-Provence','Marseille'].map(v=>`<option value="${v}">`).join('')}</datalist>
      <label class="full consent"><input type="checkbox" name="ok" ${i.ok?'checked':''} required>J’accepte que BK+ utilise ces informations et mes photos uniquement pour traiter ma demande. Elles ne sont ni vendues ni transmises.</label>
    </form>
    <div class="err" id="err"></div>
    <div class="nav"><button class="btn btn-line" data-goto="2">← Retour</button><button class="btn btn-grad" id="send">Envoyer ma demande</button></div>`;
  }

  function done(ref){
    return `<div class="okbox"><div class="big">✓</div><h2>Demande envoyée</h2><p class="sub" style="margin:8px 0 0">Merci ! Le bureau l’a reçue avec vos photos et vous rappelle rapidement.</p><div class="ref">N° ${E(ref)}</div>
    <p style="color:var(--mute);margin:0 0 20px">Une question en attendant ? <a href="tel:+33484489551" style="font-weight:800">04 84 48 95 51</a></p>
    <a class="btn btn-line" href="index.html">Retour à l’accueil</a>
    <div class="demo-note">Version de travail : la demande est enregistrée sur cet appareil et apparaît dans la démo de l’application (onglet « Demandes du site »). La connexion au vrai serveur arrive à l’étape suivante.</div></div>`;
  }

  function render(){
    if(st.step===4) return;
    root.innerHTML = head() + [step0,step1,step2,step3][st.step]();
    bind();
  }

  /* Photos : redimensionnement avant envoi (rapide même en 4G) */
  function shrink(file, max){
    return new Promise((res,rej)=>{ const r=new FileReader(); r.onerror=rej; r.onload=()=>{ const img=new Image(); img.onerror=rej; img.onload=()=>{ const k=Math.min(1,(max||1280)/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',.72)); }; img.src=r.result; }; r.readAsDataURL(file); });
  }
  const err = m => { const e=$('#err'); if(!e) return; e.textContent=m; e.classList.add('on'); e.scrollIntoView({behavior:'smooth',block:'center'}); };
  function saveInfo(){
    const g=n=>document.querySelector(`[name="${n}"]`);
    if($('#msg')) st.info.msg=$('#msg').value;
    const u=document.querySelector('[name=urg]:checked'); if(u) st.info.urgence=u.value;
    const p=document.querySelector('[name=prof]:checked'); if(p) st.info.profil=p.value;
    ['nom','tel','email','adresse','cp','ville'].forEach(n=>{ if(g(n)) st.info[n]=g(n).value.trim(); });
    if(g('ok')) st.info.ok=g('ok').checked;
  }

  function bind(){
    root.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{ st.cat=b.dataset.cat; render(); });
    root.querySelectorAll('[data-svc]').forEach(b=>b.onclick=()=>{ if(st.svc!==b.dataset.svc){ st.shots={}; st.skipped={}; } st.svc=b.dataset.svc; history.replaceState(null,'','?type='+st.svc); go(1); });
    root.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>go(0));
    root.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{ saveInfo(); go(+b.dataset.goto); });
    root.querySelectorAll('input[type=file][data-k]').forEach(inp=>inp.onchange=()=>{ const f=inp.files[0]; if(!f) return; const k=+inp.dataset.k; shrink(f).then(src=>{ st.shots[k]=src; delete st.skipped[k]; const y=scrollY; render(); scrollTo(0,y); }).catch(()=>err('Cette photo n’a pas pu être lue. Essayez une autre photo.')); });
    root.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>{ st.skipped[+b.dataset.skip]=true; const y=scrollY; render(); scrollTo(0,y); });
    root.querySelectorAll('[data-unskip]').forEach(b=>b.onclick=()=>{ delete st.skipped[+b.dataset.unskip]; const y=scrollY; render(); scrollTo(0,y); });
    root.querySelectorAll('[data-rmx]').forEach(b=>b.onclick=()=>{ st.extra.splice(+b.dataset.rmx,1); render(); });
    const xin=$('#xin'); if(xin) xin.onchange=()=>{ const max=S(st.svc).photos.length?4:8; Promise.all([...xin.files].slice(0,max-st.extra.length).map(f=>shrink(f))).then(l=>{ st.extra=st.extra.concat(l); render(); }); };
    root.querySelectorAll('[name=urg]').forEach(r=>r.onchange=()=>{ saveInfo(); render(); });
    const next=$('#next'); if(next) next.onclick=()=>{
      if(st.step===1){ const s=S(st.svc), miss=s.photos.map((p,k)=>(!p[2]&&!st.shots[k]&&!st.skipped[k])?k+1:0).filter(Boolean);
        if(miss.length) return err(`Il manque ${miss.length>1?'les photos':'la photo'} n° ${miss.join(', ')}. Si vous ne pouvez pas la prendre, touchez « Je ne peux pas ».`); }
      if(st.step===2){ saveInfo(); if(!st.info.msg || st.info.msg.trim().length<5) return err('Décrivez votre besoin en quelques mots.'); }
      go(st.step+1);
    };
    const send=$('#send'); if(send) send.onclick=submit;
  }

  function submit(){
    saveInfo(); const i=st.info;
    if(!i.nom) return err('Indiquez votre nom.');
    if((i.tel||'').replace(/\D/g,'').length<10) return err('Indiquez un numéro de téléphone valide.');
    if(!/^\d{5}$/.test(i.cp||'')) return err('Indiquez un code postal à 5 chiffres.');
    if(!i.ville) return err('Indiquez la ville.');
    if(i.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.email)) return err('L’adresse e-mail semble incorrecte.');
    if(!i.ok) return err('Merci d’accepter l’utilisation de vos informations pour traiter la demande.');
    const s=S(st.svc), ref='BK-'+Date.now().toString(36).toUpperCase().slice(-6);
    const photos = s.photos.map((p,k)=>st.shots[k]?{label:p[0],src:st.shots[k]}:null).filter(Boolean).concat(st.extra.map((src,k)=>({label:'Photo complémentaire '+(k+1),src})));
    const manquantes = s.photos.map((p,k)=>st.skipped[k]?p[0]:null).filter(Boolean);
    const d=new Date(), iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const demande = { id:ref, ref, date:iso, source:'Site', nom:i.nom, tel:i.tel, email:i.email||'', adresse:i.adresse||'', cp:i.cp, ville:i.ville, service:s.nom, serviceId:s.id, message:i.msg, urgence:i.urgence, profil:i.profil, photos, manquantes, traitee:false };
    // Version de travail : enregistrement local (même adresse que la démo de l’application). Étape suivante : envoi au serveur.
    try{ const k='bkplus-demandes', a=JSON.parse(localStorage.getItem(k)||'[]'); a.push(demande); localStorage.setItem(k, JSON.stringify(a)); }
    catch(e){ try{ demande.photos=demande.photos.map(p=>({label:p.label,src:''})); const k='bkplus-demandes', a=JSON.parse(localStorage.getItem(k)||'[]'); a.push(demande); localStorage.setItem(k, JSON.stringify(a)); }catch(_){} }
    st.step=4; window.onbeforeunload=null;
    root.innerHTML = done(ref); root.scrollIntoView({behavior:'smooth'});
  }

  window.onbeforeunload = () => (Object.keys(st.shots).length||st.extra.length) && st.step<4 ? 'Vos photos ne sont pas encore envoyées.' : undefined;
  render();
})();
