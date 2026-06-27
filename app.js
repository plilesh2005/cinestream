/* ============================================================
   CINESTREAM v13 — app.js  © DK
   ============================================================ */

const DEFAULT_SITE_NAME = 'CineStream';
const _DK = 'AIzaSyCBzZakkfsYC3k1Kw1rIhnzSn9cv-Af28Y';
const _DF = '1PydbnXY-aYQGlXlc02FD0RMnYRduP8cC';
function getDriveKey()    { return CFG.apiKey    || _DK; }
function getDriveFolder() { return CFG.folderId  || _DF; }

const VIDEO_EXTS = ['.mp4','.mkv','.avi','.mov','.webm','.wmv','.mpg','.mpeg','.m4v','.3gp','.flv','.ts','.m2ts','.vob'];
const CATS = [
  {id:'hollywood',label:'Hollywood',  pill:'pill-h',icon:'🎬'},
  {id:'bollywood',label:'Bollywood',  pill:'pill-b',icon:'🎭'},
  {id:'series',   label:'Series & TV',pill:'pill-s',icon:'📺'},
  {id:'other',    label:'Other',      pill:'pill-o',icon:'📁'},
];

let DB=[], CFG={};
let heroId=null, detailId=null, editId=null;
let currentCatView=null, _addPreset='';
let driveFiles=[], driveFolders=[], driveDetails={};
let seriesEpDriveFiles=[], currentSeriesEditId=null;
let posterData=null, localBlob=null, seriesPosterData=null;
let reviewStars=0, toastTimer=null;

function $(id){ return document.getElementById(id); }

/* ── TOAST ── */
function toast(msg,ms){
  const t=$('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),ms||2800);
}

/* ── UTILS ── */
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtSize(b){ if(!b||isNaN(b)) return ''; return b>=1e9?(b/1e9).toFixed(1)+' GB':(b/1e6).toFixed(1)+' MB'; }
function cat(id){ return CATS.find(c=>c.id===id)||CATS[3]; }
function isVid(f){ const n=(f.name||'').toLowerCase(); return VIDEO_EXTS.some(e=>n.endsWith(e))||(f.mimeType||'').startsWith('video/'); }
function isDir(f){ return f.mimeType==='application/vnd.google-apps.folder'; }
function fmtDate(){ return new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }

function cleanTitle(raw){
  if(!raw) return 'Untitled';
  return raw
    .replace(/\.(mp4|mkv|avi|mov|webm|wmv|mpg|mpeg|m4v|3gp|flv|ts|m2ts|vob)$/i,'')
    .replace(/[\s._-]+(1080p?|720p?|480p?|4k|2160p|uhd|hevc|x264|x265|h264|h265|bluray|bdrip|webrip|hdrip|dvdrip|hdr|esub|dub(bed)?|hindi|tamil|telugu|english|aac|yts|hdhub4u)[^a-z]*/gi,' ')
    .replace(/[-_.+]+/g,' ').replace(/\s{2,}/g,' ').trim()
    .split(' ').map(w=>w?w[0].toUpperCase()+w.slice(1).toLowerCase():'').join(' ').trim()||raw;
}

/* ── MODAL ── */
function openModal(id){  const e=$(id); if(e) e.classList.add('open'); }
function closeModal(id){ const e=$(id); if(e) e.classList.remove('open'); }

/* ── SETTINGS LOCK ── */
function getSpwd(){ return CFG.settingsPwd||hashPwd('cine1234'); }
function openSettingsLock(){
  const i=$('slock-inp'),e=$('slock-err');
  if(i) i.value=''; if(e) e.textContent='';
  const l=$('settings-lock'); if(l){l.classList.add('open');setTimeout(()=>i&&i.focus(),80);}
}
function closeSettingsLock(){ const l=$('settings-lock');if(l)l.classList.remove('open'); }
function checkSettingsPwd(){
  const i=$('slock-inp'); if(!i) return;
  if(hashPwd(i.value)===getSpwd()){ closeSettingsLock(); _openSettings(); }
  else{ const e=$('slock-err');if(e)e.textContent='Wrong password.';i.value='';i.focus(); }
}

/* ── VIEWS ── */
function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const el=$(id);if(el)el.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active',l.dataset.view===id));
  window.scrollTo({top:0,behavior:'instant'});
}
function showHome(){ const si=$('search-input');if(si)si.value=''; showView('home-view');setMobActive('mob-home'); }
function showSettings(){ openSettingsLock(); }
function showCatView(catId){
  currentCatView=catId;
  const c=cat(catId); const ct=$('cv-title');if(ct)ct.textContent=c.icon+' '+c.label;
  renderCatGrid(catId); showView('cat-view');
}

function _openSettings(){
  const ak=$('s-api-key');if(ak)ak.value=CFG.apiKey||getDriveKey();
  const fi=$('s-folder-id');if(fi)fi.value=CFG.folderId||getDriveFolder();
  const sn=$('s-site-name');if(sn)sn.value=CFG.siteName||DEFAULT_SITE_NAME;
  const gt=$('s-gist-token');if(gt)gt.value=getToken();
  const gi=$('s-gist-id');if(gi)gi.value=getGistId();
  const su=$('s-sheet-url');if(su)su.value=getSheetUrl()||'';
  switchSetTab('general');
  renderSettingsLibrary();
  showView('settings-view');
  setMobActive('mob-settings');
  updateSyncStatusUI();
  updateDriveAuthUI();
}
function updateSyncStatusUI(){
  /* Drive auth UI is handled by updateDriveAuthUI() */
  const gi=$('s-gist-id');if(gi&&gi.value==='')gi.value=getGistId();
  const gt=$('s-gist-token');if(gt&&gt.value==='')gt.value=getToken();
  const su=$('s-sheet-url');if(su&&su.value==='')su.value=getSheetUrl()||'';
}
function switchSetTab(tab){
  document.querySelectorAll('.set-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.set-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tab));
}
function toggleCard(id){
  const body=$(id+'-body'),arrow=$(id+'-arrow');if(!body||!arrow) return;
  const open=body.classList.toggle('open');arrow.classList.toggle('open',open);
}

/* ── RENDER ── */
function render(){ renderHero(); renderRows(); renderTicker(); applySiteName(); }

function applySiteName(){
  const n=CFG.siteName||DEFAULT_SITE_NAME;
  document.title=n+' © DK';
  const nl=$('nav-logo');if(nl)nl.textContent=n;
  const fn=$('footer-site-name');if(fn)fn.textContent=n;
}

function renderHero(){
  const pool=DB.filter(m=>m.type!=='series');
  const withPoster=pool.filter(m=>m.poster);
  const m=(withPoster.length?withPoster:pool)[Math.floor(Math.random()*Math.max(withPoster.length,pool.length,1))]||null;
  if(!m){heroId=null;return;}
  heroId=m.id; const c=cat(m.category);
  const s=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  s('hero-tag',c.icon+' '+c.label); s('hero-title',m.title||'Untitled');
  s('hero-rating',m.rating?'★ '+m.rating:''); s('hero-year',m.year||'');
  s('hero-desc',m.desc||'');
  const img=$('hero-bg-img');
  if(img){img.classList.remove('vis');if(m.poster){img.onload=()=>img.classList.add('vis');img.src=m.poster;}else img.src='';}
}

function renderTicker(){
  const bar=$('ticker-bar'),track=$('ticker-track');if(!bar||!track) return;
  if(!DB.length){bar.classList.remove('vis');return;}
  bar.classList.add('vis');
  const html=DB.slice(0,30).map(m=>`<span class="ti" onclick="openDetail('${m.id}')"><span class="ti-dot"></span><span class="ti-name">${esc(m.title||'')}</span><span style="font-size:11px">${cat(m.category).icon}</span></span>`).join('');
  track.innerHTML=html+html;
}

function renderRows(){
  const wrap=$('home-rows');if(!wrap) return; wrap.innerHTML='';
  const newest=[...DB].sort((a,b)=>(b.addedAt||0)-(a.addedAt||0)).slice(0,20);
  if(newest.length) wrap.appendChild(buildRow({id:'newest',label:'Newly Added',icon:'🆕',pill:'pill-o'},newest,false,null));
  CATS.forEach(c=>{
    let items=DB.filter(m=>m.category===c.id);
    items=c.id==='series'?items.sort((a,b)=>(a.title||'').localeCompare(b.title||'')):items.sort((a,b)=>(parseInt(b.year)||0)-(parseInt(a.year)||0));
    wrap.appendChild(items.length?buildRow(c,items.slice(0,20),true,c.id):buildEmptyRow(c));
  });
}

function buildRow(c,items,showSeeAll,catId){
  const sec=document.createElement('div'); sec.className='cat-row'; if(catId) sec.id='row-'+catId;
  const pill=`<span class="row-pill ${c.pill||'pill-o'}">${items.length}</span>`;
  const sa=showSeeAll&&catId?`<button class="row-seeall" onclick="showCatView('${catId}')">See all ›</button>`:'';
  sec.innerHTML=`<div class="row-head"><div class="row-label">${c.icon} ${c.label} ${pill}</div><div style="display:flex;gap:8px;align-items:center">${sa}</div></div>
    <div class="row-wrap">
      <button class="row-arr l" onclick="scrollRow(this,'l')">‹</button>
      <div class="row-scroll">${items.map(m=>m.type==='series'?scardHTML(m):cardHTML(m)).join('')}</div>
      <button class="row-arr r" onclick="scrollRow(this,'r')">›</button>
    </div>`;
  return sec;
}
function buildEmptyRow(c){
  const sec=document.createElement('div'); sec.className='cat-row'; sec.id='row-'+c.id;
  const btn=c.id==='series'?`<button class="row-empty-btn" onclick="openSeriesCreateModal()">+ Create Series</button>`:`<button class="row-empty-btn" onclick="openAddModal('${c.id}')">+ Add ${c.label}</button>`;
  sec.innerHTML=`<div class="row-head"><div class="row-label">${c.icon} ${c.label} <span class="row-pill ${c.pill}">0</span></div></div><div class="row-empty">No ${c.label} yet. ${btn}</div>`;
  return sec;
}
function scrollRow(btn,dir){
  const row=btn.closest('.row-wrap').querySelector('.row-scroll');
  if(row) row.scrollBy({left:dir==='l'?-500:500,behavior:'smooth'});
}

function cardHTML(m){
  const img=m.poster?`<img src="${esc(m.poster)}" alt="${esc(m.title)}" loading="lazy" onerror="this.style.display='none'">`:`<div class="card-nop"><div class="nop-icon">🎬</div><div class="nop-title">${esc(m.title||'Untitled')}</div></div>`;
  const yr=m.year?`<div class="card-year">${esc(m.year)}</div>`:'';
  return `<div class="card" onclick="openDetail('${m.id}')">
    <div class="card-in">${img}${yr}
      <div class="card-ov"><div class="ov-title">${esc(m.title||'')}</div>
        <div class="ov-btns">
          <button class="ov-btn ov-play" onclick="event.stopPropagation();directPlay('${m.id}')">▶ Play</button>
          <button class="ov-btn ov-info" onclick="event.stopPropagation();openDetail('${m.id}')">ⓘ</button>
        </div>
      </div>
    </div>
  </div>`;
}
function scardHTML(m){
  const eps=(m.episodes||[]).length;
  const thumb=m.poster?`<img class="scard-thumb" src="${esc(m.poster)}" alt="${esc(m.title)}" loading="lazy" onerror="this.style.display='none'">`:`<div class="scard-ph">📺</div>`;
  return `<div class="scard" onclick="openSeriesEpisodes('${m.id}')">
    <div class="scard-in">${thumb}
      <div class="scard-info"><div class="scard-name">${esc(m.title||'')}</div><div class="scard-cnt">${eps} episode${eps!==1?'s':''}</div></div>
    </div>
    <div class="scard-ov"><button class="scard-play">▶ Episodes</button></div>
  </div>`;
}

function renderCatGrid(catId){
  const isSeries=catId==='series';
  let items=DB.filter(m=>m.category===catId);
  if(isSeries){
    items=items.sort((a,b)=>(a.title||'').localeCompare(b.title||''));
    const g=$('cv-grid');if(g)g.style.display='none';
    const sg=$('cv-series-grid');
    if(sg){ sg.style.display=''; sg.innerHTML=items.length?items.map(m=>m.type==='series'?scardHTML(m):cardHTML(m)).join(''):`<div style="color:var(--t3);padding:24px;text-align:center">No series yet.<br><br><button class="row-empty-btn" onclick="openSeriesCreateModal()">+ Create Series</button></div>`; }
  } else {
    items=items.sort((a,b)=>(parseInt(b.year)||0)-(parseInt(a.year)||0));
    const sg=$('cv-series-grid');if(sg)sg.style.display='none';
    const g=$('cv-grid');
    if(g){ g.style.display=''; g.innerHTML=items.length?items.map(cardHTML).join(''):`<div style="color:var(--t3);padding:24px;text-align:center">No ${cat(catId).label} yet.</div>`; }
  }
}

function handleSearch(q){
  if(!q.trim()){showHome();return;}
  showView('search-view');
  const st=$('sv-term');if(st)st.textContent=q;
  const qt=q.toLowerCase();
  const res=DB.filter(m=>(m.title||'').toLowerCase().includes(qt)||(m.desc||'').toLowerCase().includes(qt));
  const sg=$('sv-grid');
  if(sg) sg.innerHTML=res.length?res.map(m=>m.type==='series'?scardHTML(m):cardHTML(m)).join(''):`<div style="color:var(--t3);padding:24px;text-align:center">No results for "${esc(q)}".</div>`;
}

/* ── DETAIL MODAL ── */
function openDetail(id){
  const m=DB.find(x=>x.id===id);if(!m) return;
  detailId=id; const c=cat(m.category);
  const s=(eid,v)=>{const e=$(eid);if(e)e.textContent=v;};
  s('d-title',m.title||'Untitled'); s('d-desc',m.desc||'No description.');
  const dm=$('d-meta');
  if(dm) dm.innerHTML=(m.rating?`<span style="color:var(--gold);font-weight:700;font-size:13px">★ ${esc(m.rating)}</span>`:'')+(m.year?`<span>${esc(m.year)}</span>`:'')+`<span style="padding:2px 8px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;background:rgba(255,255,255,.1)">${c.icon} ${c.label}</span>`;
  const bg=$('d-banner-bg');if(bg){bg.src=m.poster||'';bg.style.display=m.poster?'block':'none';}
  const ti=$('d-thumb-img'),tw=$('d-thumb-wrap');
  if(ti&&tw){if(m.poster){ti.src=m.poster;ti.style.display='block';tw.style.fontSize='0';}else{ti.style.display='none';tw.textContent=c.icon;tw.style.fontSize='24px';}}
  const bp=$('btn-dp'),be=$('btn-dep');
  if(bp)bp.style.display=m.type==='series'?'none':'flex';
  if(be)be.style.display=m.type==='series'?'flex':'none';
  renderReviews(m); reviewStars=0; setStarUI(0);
  const rta=$('rv-ta-inp');if(rta)rta.value='';
  openModal('detail-modal');
  const ds=document.querySelector('#detail-modal .detail-scroll');if(ds)ds.scrollTop=0;
}
function closeDetail(){ closeModal('detail-modal'); detailId=null; }
function playFromDetail(){ if(!detailId)return; const id=detailId; closeDetail(); setTimeout(()=>{const m=DB.find(x=>x.id===id);if(m)_doPlay(m);},200); }
function epsFromDetail(){ if(!detailId)return; const id=detailId; closeDetail(); setTimeout(()=>openSeriesEpisodes(id),200); }
function editFromDetail(){ if(!detailId)return; const id=detailId; closeDetail(); setTimeout(()=>{ const m=DB.find(x=>x.id===id);if(m){if(m.type==='series')openSeriesCreateModal(id);else openEditModal(id);}},200); }
function directPlay(id){ ['detail-modal','ep-modal','edit-modal','drive-modal','series-create-modal','ep-drive-modal'].forEach(closeModal); setTimeout(()=>{const m=DB.find(x=>x.id===id);if(m)_doPlay(m);},60); }

/* Reviews */
function renderReviews(m){
  const rv=m.reviews||[]; const list=$('rv-list');if(!list)return;
  list.innerHTML=rv.length?rv.map(r=>`<div class="rv-item"><div class="rv-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</div><div class="rv-text">${esc(r.text)}</div><div class="rv-date">${r.date||''}</div></div>`).join(''):`<div style="color:var(--t3);font-size:13px;padding:6px 0">No reviews yet.</div>`;
}
function setStarUI(n){ reviewStars=n; document.querySelectorAll('.star-btn').forEach((b,i)=>b.classList.toggle('on',i<n)); }
async function submitReview(){
  const rta=$('rv-ta-inp');if(!rta)return;
  const text=rta.value.trim();
  if(!reviewStars){toast('Select a star rating.');return;}
  if(!text){toast('Write a review.');return;}
  const m=DB.find(x=>x.id===detailId);if(!m)return;
  if(!m.reviews)m.reviews=[];
  m.reviews.unshift({stars:reviewStars,text,date:fmtDate()});
  renderReviews(m); reviewStars=0; setStarUI(0); rta.value='';
  const res=await dataSave(DB,CFG);
  toast(res.ok?'✓ Review saved & synced!':'✓ Review saved locally');
}

/* ── PLAYER ── */
function _doPlay(m){
  ['detail-modal','ep-modal','edit-modal','drive-modal','series-create-modal','ep-drive-modal'].forEach(closeModal);
  const c=cat(m.category||'other');
  const s=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  s('pm-title',m.title||'Now Playing'); s('pm-meta',[m.year,m.rating?'★ '+m.rating:''].filter(Boolean).join('  ·  '));
  const pill=$('pm-pill');if(pill){pill.textContent=c.icon+' '+c.label;pill.className='pcpill '+c.pill;}
  const vid=$('main-video'),ifw=$('player-iframe-wrap'),ife=$('player-iframe'),dl=$('player-drive-link');
  if(vid){vid.pause();vid.src='';vid.style.display='block';}
  if(ifw)ifw.style.display='none'; if(ife)ife.src=''; if(dl)dl.style.display='none';
  if(m.localBlob&&vid){ vid.src=m.localBlob; }
  else if(m.driveId){
    if(vid) vid.src='https://www.googleapis.com/drive/v3/files/'+m.driveId+'?alt=media&key='+getDriveKey();
    if(dl){dl.href='https://drive.google.com/file/d/'+m.driveId+'/view';dl.style.display='flex';}
    if(vid){
      const t=setTimeout(()=>{if(vid.readyState<2)switchIframe(m.driveId);},7000);
      vid.addEventListener('canplay',()=>clearTimeout(t),{once:true});
      vid.addEventListener('error',()=>{clearTimeout(t);switchIframe(m.driveId);},{once:true});
    }
  } else if(m.videoUrl&&vid){ vid.src=m.videoUrl; }
  else{ toast('No video source set for this title.'); return; }
  if(vid){vid.load();vid.play().catch(()=>{});}
  openModal('player-modal');
}
function switchIframe(fileId){
  const vid=$('main-video');if(vid){vid.pause();vid.src='';vid.style.display='none';}
  const ife=$('player-iframe');if(ife)ife.src='https://drive.google.com/file/d/'+fileId+'/preview';
  const ifw=$('player-iframe-wrap');if(ifw)ifw.style.display='block';
  toast('Switched to Drive embed. Tap ⛶ for fullscreen.',4000);
}
function closePlayer(){
  const vid=$('main-video');if(vid){vid.pause();vid.src='';}
  const ife=$('player-iframe');if(ife)ife.src='';
  const ifw=$('player-iframe-wrap');if(ifw)ifw.style.display='none';
  const vid2=$('main-video');if(vid2)vid2.style.display='block';
  closeModal('player-modal');
}

/* ── ADD MODAL (shows movie/series choice) ── */
function openAddModal(presetCat){
  _addPreset=presetCat||'';
  if(presetCat==='series'){openSeriesCreateModal();return;}
  if(presetCat){openEditModal(null,presetCat);return;}
  openModal('add-choice-modal');
}

/* ── ADD/EDIT MOVIE ── */
function openEditModal(id,presetCat){
  closeModal('add-choice-modal');
  editId=id||null; posterData=null; localBlob=null;
  ['ef-title','ef-year','ef-rating','ef-desc','ef-drive-id','ef-video-url','ef-poster-url'].forEach(i=>{const e=$(i);if(e)e.value='';});
  const ec=$('ef-cat');if(ec)ec.value=presetCat||'';
  const es=$('ef-src');if(es)es.value='drive'; onSrcChange();
  const pi=$('ef-poster-img'),pp=$('ef-poster-ph');
  if(pi){pi.style.display='none';pi.src='';} if(pp)pp.style.display='flex';
  const vl=$('ef-vfile-lbl');if(vl)vl.textContent='📁 Choose Video File';
  const pf=$('ef-pfile');if(pf)pf.value='';
  const vf=$('ef-vfile');if(vf)vf.value='';
  const ht=$('em-head-title');if(ht)ht.textContent=id?'Edit Movie':'Add Movie';
  const bs=$('btn-em-save');if(bs)bs.textContent=id?'Update':'Save Movie';
  if(id){
    const m=DB.find(x=>x.id===id);if(!m)return;
    if(m.type==='series'){openSeriesCreateModal(id);return;}
    const sv=(eid,v)=>{const e=$(eid);if(e)e.value=v;};
    sv('ef-title',m.title||''); sv('ef-cat',m.category||'');
    sv('ef-year',m.year||''); sv('ef-rating',m.rating||''); sv('ef-desc',m.desc||'');
    if(m.driveId){const s=$('ef-src');if(s)s.value='drive';sv('ef-drive-id',m.driveId);}
    else if(m.videoUrl){const s=$('ef-src');if(s)s.value='url';sv('ef-video-url',m.videoUrl);}
    else if(m.localBlob){const s=$('ef-src');if(s)s.value='local';localBlob=m.localBlob;const vl=$('ef-vfile-lbl');if(vl)vl.textContent='✓ Local file set';}
    onSrcChange();
    if(m.poster)setPosterPrev(m.poster);
  }
  openModal('edit-modal');
  const eb=document.querySelector('#edit-modal .em-body');if(eb)eb.scrollTop=0;
}
function closeEditModal(){ closeModal('edit-modal'); }

function onSrcChange(){
  const v=$('ef-src');if(!v) return;
  document.querySelectorAll('.src-panel').forEach(p=>p.classList.toggle('on',p.dataset.src===v.value));
}
function handlePosterFile(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=ev=>setPosterPrev(ev.target.result);r.readAsDataURL(f);
}
function handlePosterUrl(){
  const u=$('ef-poster-url');if(!u)return;
  if(u.value.trim().startsWith('http'))setPosterPrev(u.value.trim());
}
function setPosterPrev(src){
  posterData=src;
  const pi=$('ef-poster-img'),pp=$('ef-poster-ph');
  if(pi){pi.src=src;pi.style.display='block';} if(pp)pp.style.display='none';
}
function handleVidFile(e){
  const f=e.target.files[0];if(!f)return;
  if(localBlob)URL.revokeObjectURL(localBlob);
  localBlob=URL.createObjectURL(f);
  const vl=$('ef-vfile-lbl');if(vl)vl.textContent='✓ '+f.name;
}

async function saveTitle(){
  const ti=$('ef-title'),ec=$('ef-cat');if(!ti||!ec)return;
  const title=ti.value.trim(),category=ec.value;
  if(!title){toast('Enter a title.');return;}
  if(!category){toast('Select a category.');return;}
  const srcEl=$('ef-src'); const srcType=srcEl?srcEl.value:'drive';
  const driveId=srcType==='drive'?($('ef-drive-id')?.value.trim()||''):'';
  const videoUrl=srcType==='url'?($('ef-video-url')?.value.trim()||''):'';
  const lb=srcType==='local'?(localBlob||''):'';
  const base={title,category,type:'movie',year:$('ef-year')?.value||'',rating:$('ef-rating')?.value||'',desc:$('ef-desc')?.value.trim()||'',poster:posterData||'',driveId,videoUrl,localBlob:lb};
  if(editId){
    const idx=DB.findIndex(m=>m.id===editId);
    if(idx>-1)DB[idx]={...DB[idx],...base,poster:posterData||DB[idx].poster||''};
    toast('Updating…',800);
  } else {
    DB.unshift({id:'mv_'+Date.now()+'_'+Math.random().toString(36).slice(2),...base,addedAt:Date.now()});
    toast('Saving…',800);
  }
  closeEditModal(); render(); renderSettingsLibrary();
  const res=await dataSave(DB,CFG);
  if(res.ok) toast('✓ "'+(DB[editId?DB.findIndex(m=>m.id===editId):0]?.title||title)+'" synced to Gist! ('+DB.length+' movies total)',3500);
  else toast('⚠ Saved locally only — check Settings → Sync → GitHub Gist',4000);
}

async function deleteTitle(id){
  if(!confirm('Remove this title from library?'))return;
  DB=DB.filter(m=>m.id!==id);
  closeDetail(); render(); renderSettingsLibrary();
  const res=await dataSave(DB,CFG);
  toast(res.ok?'Removed & synced.':'Removed locally.');
}
function editFromLibrary(id){
  const m=DB.find(x=>x.id===id);if(!m)return;
  if(m.type==='series')openSeriesCreateModal(id);else openEditModal(id);
}

/* ── SERIES ── */
function openSeriesCreateModal(editId_){
  currentSeriesEditId=editId_||null; seriesPosterData=null;
  const m=editId_?DB.find(x=>x.id===editId_):null;
  const sv=(id,v)=>{const e=$(id);if(e)e.value=v;};
  sv('sc-title-inp',m?m.title||'':''); sv('sc-desc-inp',m?m.desc||'':''); sv('sc-poster-url','');
  const si=$('sc-poster-img'),sp=$('sc-poster-ph');
  if(si){si.style.display='none';si.src='';} if(sp)sp.style.display='flex';
  const sf=$('sc-poster-file');if(sf)sf.value='';
  if(m&&m.poster)setSeriesPosterPreview(m.poster);
  const mt=$('sc-modal-title');if(mt)mt.textContent=editId_?'Edit Series Folder':'Create Series Folder';
  const sb=$('sc-save-btn');if(sb)sb.textContent=editId_?'Update Series':'Create Series';
  renderSeriesEpList(m?m.episodes||[]:[]);
  openModal('series-create-modal');
}
function closeSeriesCreateModal(){ closeModal('series-create-modal'); currentSeriesEditId=null; seriesPosterData=null; }

function handleSeriesPosterFile(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=ev=>setSeriesPosterPreview(ev.target.result);r.readAsDataURL(f);
}
function handleSeriesPosterUrl(){
  const u=$('sc-poster-url');if(!u)return;
  if(u.value.trim().startsWith('http'))setSeriesPosterPreview(u.value.trim());
}
function setSeriesPosterPreview(src){
  seriesPosterData=src;
  const si=$('sc-poster-img'),sp=$('sc-poster-ph');
  if(si){si.src=src;si.style.display='block';} if(sp)sp.style.display='none';
}

function renderSeriesEpList(eps){
  const list=$('sc-ep-list');if(!list)return;
  if(!eps.length){list.innerHTML=`<div style="color:var(--t3);font-size:12px;text-align:center;padding:12px">No episodes yet. Click "Add Episodes from Drive" above.</div>`;return;}
  list.innerHTML=eps.map((ep,i)=>`<div class="sc-ep-item"><div class="sc-ep-num">${i+1}</div><div class="sc-ep-info"><input class="sc-ep-title-inp fi" value="${esc(ep.title||'Episode '+(i+1))}" onchange="updateEpTitle(${i},this.value)" placeholder="Episode title"></div><button class="sc-ep-del" onclick="deleteEpFromList(${i})">✕</button></div>`).join('');
}
function updateEpTitle(idx,val){
  const m=DB.find(x=>x.id===currentSeriesEditId);if(!m||!m.episodes)return;
  if(m.episodes[idx])m.episodes[idx].title=val;
}
async function deleteEpFromList(idx){
  const m=DB.find(x=>x.id===currentSeriesEditId);if(!m||!m.episodes)return;
  m.episodes.splice(idx,1); renderSeriesEpList(m.episodes);
  await dataSave(DB,CFG); toast('Episode removed.');
}

async function saveSeries(){
  const ti=$('sc-title-inp');if(!ti)return;
  const title=ti.value.trim(); if(!title){toast('Enter a series name.');return;}
  const desc=($('sc-desc-inp')?.value||'').trim();
  if(currentSeriesEditId){
    const idx=DB.findIndex(m=>m.id===currentSeriesEditId);
    if(idx>-1){DB[idx].title=title;DB[idx].desc=desc;if(seriesPosterData)DB[idx].poster=seriesPosterData;}
    const res=await dataSave(DB,CFG); render();
    toast(res.ok?'✓ Series updated & synced!':'✓ Updated locally');
  } else {
    const newS={id:'sv_'+Date.now()+'_'+Math.random().toString(36).slice(2),title,type:'series',category:'series',desc,poster:seriesPosterData||'',episodes:[],addedAt:Date.now()};
    DB.unshift(newS); currentSeriesEditId=newS.id;
    const mt=$('sc-modal-title');if(mt)mt.textContent='Edit Series Folder';
    const sb=$('sc-save-btn');if(sb)sb.textContent='Update Series';
    renderSeriesEpList([]);
    const res=await dataSave(DB,CFG); render();
    toast('✓ Series created! Now add episodes from Drive below.');
  }
  renderSettingsLibrary();
}

/* ── SERIES EPISODES FROM DRIVE ── */
function openEpDriveModal(){
  if(!currentSeriesEditId){toast('Create/save series first.');return;}
  const ea=$('epdr-api');if(ea)ea.value=getDriveKey();
  const ef=$('epdr-folder');if(ef)ef.value='';
  const ei=$('epdr-items');if(ei)ei.innerHTML='';
  const ec=$('epdr-chips');if(ec)ec.innerHTML='';
  const es=$('epdr-status');if(es)es.textContent='';
  const el=$('epdr-loading');if(el)el.style.display='none';
  const ew=$('epdr-file-wrap');if(ew)ew.style.display='none';
  seriesEpDriveFiles=[];
  openModal('ep-drive-modal');
}
function closeEpDriveModal(){ closeModal('ep-drive-modal'); }

async function loadEpDriveFolder(){
  const key=($('epdr-api')?.value.trim())||getDriveKey();
  const folder=($('epdr-folder')?.value.trim())||getDriveFolder();
  const el=$('epdr-loading');if(el)el.style.display='flex';
  const ew=$('epdr-file-wrap');if(ew)ew.style.display='none';
  const es=$('epdr-status');if(es)es.textContent='Scanning…';
  seriesEpDriveFiles=[];
  try{
    const root=await driveList(key,folder);
    const ec=$('epdr-chips');
    if(ec)ec.innerHTML=root.folders.map(f=>`<button class="fchip" onclick="loadEpSubfolder('${esc(f.id)}','${esc(f.name)}')">${esc(f.name)}</button>`).join('');
    seriesEpDriveFiles=await driveDeep(key,folder,0);
    renderEpDriveList();
    const ew2=$('epdr-file-wrap');if(ew2)ew2.style.display='block';
    if(es)es.textContent='';
    toast('✓ Found '+seriesEpDriveFiles.length+' video'+(seriesEpDriveFiles.length!==1?'s':''));
  }catch(e){if(es)es.textContent='⚠ '+e.message;toast('Error: '+e.message);}
  finally{if(el)el.style.display='none';}
}
async function loadEpSubfolder(fId,fName){
  const key=($('epdr-api')?.value.trim())||getDriveKey();
  const el=$('epdr-loading');if(el)el.style.display='flex';
  const es=$('epdr-status');if(es)es.textContent='Scanning "'+fName+'"…';
  seriesEpDriveFiles=[];
  try{
    seriesEpDriveFiles=await driveDeep(key,fId,0); renderEpDriveList();
    if(es)es.textContent='';
    toast('✓ '+seriesEpDriveFiles.length+' episodes in "'+fName+'"');
  }catch(e){if(es)es.textContent='⚠ '+e.message;}
  finally{if(el)el.style.display='none';}
}
function renderEpDriveList(){
  const ul=$('epdr-items');if(!ul)return;
  if(!seriesEpDriveFiles.length){ul.innerHTML='<div style="padding:12px;text-align:center;color:var(--t3);font-size:12px">No video files found.</div>';return;}
  const sorted=[...seriesEpDriveFiles].sort((a,b)=>(a.name||'').localeCompare(b.name||'',undefined,{numeric:true}));
  seriesEpDriveFiles=sorted;
  ul.innerHTML=sorted.map(f=>`<label class="dfi"><input type="checkbox" value="${esc(f.id)}" data-name="${esc(cleanTitle(f.name||''))}" data-raw="${esc(f.name||'')}" checked><div class="dfi-info">${f._path?`<div class="dfi-path">📁 ${esc(f._path)}</div>`:''}<div class="dfi-name">${esc(f.name)}</div></div><div class="dfi-size">${fmtSize(+(f.size)||0)}</div></label>`).join('');
}
function selAllEpDrive(){ document.querySelectorAll('#epdr-items input[type=checkbox]').forEach(cb=>cb.checked=true); }
async function importEpisodesSelected(){
  const m=DB.find(x=>x.id===currentSeriesEditId);if(!m){toast('Series not found.');return;}
  const checks=[...document.querySelectorAll('#epdr-items input:checked')];
  if(!checks.length){toast('Select at least one episode.');return;}
  if(!m.episodes)m.episodes=[];
  let count=0;
  checks.forEach(cb=>{ m.episodes.push({title:cb.dataset.name||cleanTitle(cb.dataset.raw||cb.value),driveId:cb.value,desc:''}); count++; });
  const res=await dataSave(DB,CFG);
  closeEpDriveModal(); renderSeriesEpList(m.episodes); render();
  toast(res.ok?'✓ '+count+' episode'+(count!==1?'s':'')+' added & synced!':'✓ Added locally');
}

/* ── SERIES EPISODES VIEWER ── */
function openSeriesEpisodes(id){
  const m=DB.find(x=>x.id===id);if(!m||m.type!=='series')return;
  const et=$('ep-title');if(et)et.textContent=m.title||'Series';
  const eps=m.episodes||[];
  const el=$('ep-list');if(!el)return;
  el.innerHTML=eps.length
    ?eps.map((ep,i)=>`<div class="ep-item" onclick="playEpisode('${id}',${i})"><div class="ep-num">${i+1}</div><div class="ep-info"><div class="ep-name">${esc(ep.title||'Episode '+(i+1))}</div><div class="ep-desc">${esc(ep.desc||'')}</div></div><div class="ep-icon">▶</div></div>`).join('')
    :`<div style="color:var(--t3);font-size:13px;padding:24px;text-align:center">No episodes yet.<br><br><button class="row-empty-btn" onclick="closeEpModal();setTimeout(()=>openSeriesCreateModal('${id}'),200)">+ Add Episodes</button></div>`;
  openModal('ep-modal');
}
function closeEpModal(){ closeModal('ep-modal'); }
function playEpisode(seriesId,epIdx){
  const m=DB.find(x=>x.id===seriesId);if(!m)return;
  const ep=(m.episodes||[])[epIdx];if(!ep)return;
  closeEpModal();
  _doPlay({...ep,id:'__ep__',title:(m.title||'')+(ep.title?' — '+ep.title:''),category:m.category||'series',year:'',rating:''});
}

/* ── DRIVE IMPORT (movies) ── */
function openDriveModal(){
  const da=$('dr-api');if(da)da.value=getDriveKey();
  const df=$('dr-folder');if(df)df.value=getDriveFolder();
  const fw=$('dr-file-wrap');if(fw)fw.style.display='none';
  const ds=$('dr-detail-sec');if(ds)ds.style.display='none';
  const dc=$('dr-chips');if(dc)dc.innerHTML='';
  const di=$('dr-items');if(di)di.innerHTML='';
  const dst=$('dr-status');if(dst)dst.textContent='';
  const dl=$('dr-loading');if(dl)dl.style.display='none';
  driveFiles=[]; driveFolders=[]; driveDetails={};
  openModal('drive-modal');
}
function closeDriveModal(){ closeModal('drive-modal'); }

async function loadDriveRoot(){
  const key=($('dr-api')?.value.trim())||getDriveKey();
  const folder=($('dr-folder')?.value.trim())||getDriveFolder();
  CFG.apiKey=key; CFG.folderId=folder;
  const dl=$('dr-loading');if(dl)dl.style.display='flex';
  const fw=$('dr-file-wrap');if(fw)fw.style.display='none';
  const ds=$('dr-detail-sec');if(ds)ds.style.display='none';
  const dst=$('dr-status');if(dst)dst.textContent='Scanning…';
  driveFiles=[]; driveFolders=[]; driveDetails={};
  try{
    const root=await driveList(key,folder);
    driveFolders=root.folders;
    dst&&(dst.textContent='Found '+root.folders.length+' subfolder(s). Scanning all…');
    driveFiles=await driveDeep(key,folder,0);
    renderDriveList();
    if(fw)fw.style.display='block'; if(dst)dst.textContent='';
    toast('✓ Found '+driveFiles.length+' video'+(driveFiles.length!==1?'s':''));
  }catch(e){if(dst)dst.textContent='⚠ '+e.message; toast('Drive error: '+e.message);}
  finally{if(dl)dl.style.display='none';}
}
async function loadSub(fId,fName){
  const key=($('dr-api')?.value.trim())||getDriveKey();
  const dl=$('dr-loading');if(dl)dl.style.display='flex';
  const dst=$('dr-status');if(dst)dst.textContent='Scanning "'+fName+'"…';
  driveFiles=[]; driveDetails={};
  const ds=$('dr-detail-sec');if(ds)ds.style.display='none';
  try{
    driveFiles=await driveDeep(key,fId,0); renderDriveList();
    if(dst)dst.textContent=''; toast('✓ '+driveFiles.length+' videos in "'+fName+'"');
  }catch(e){if(dst)dst.textContent='⚠ '+e.message;}
  finally{if(dl)dl.style.display='none';}
}
function renderDriveList(){
  const dc=$('dr-chips');
  if(dc)dc.innerHTML=driveFolders.map(f=>`<button class="fchip" onclick="loadSub('${esc(f.id)}','${esc(f.name)}')">📁 ${esc(f.name)}</button>`).join('');
  const ul=$('dr-items');if(!ul)return;
  if(!driveFiles.length){ul.innerHTML='<div style="padding:12px;text-align:center;color:var(--t3);font-size:12px">No video files found in this folder.</div>';return;}
  const sorted=[...driveFiles].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  ul.innerHTML=sorted.map(f=>`<label class="dfi"><input type="checkbox" value="${esc(f.id)}" data-name="${esc(f.name)}" onchange="onFileCheck(this)"><div class="dfi-info">${f._path?`<div class="dfi-path">📁 ${esc(f._path)}</div>`:''}<div class="dfi-name">${esc(f.name)}</div></div><div class="dfi-size">${fmtSize(+(f.size)||0)}</div></label>`).join('');
}
function selAllDrive(){
  document.querySelectorAll('#dr-items input[type=checkbox]').forEach(cb=>{cb.checked=true;onFileCheck(cb);});
}
function onFileCheck(cb){
  const fid=cb.value;
  if(cb.checked&&!driveDetails[fid]){
    driveDetails[fid]={title:cleanTitle((cb.dataset.name||'').replace(/\.[^.]+$/,'')),category:'',poster:'',year:'',rating:'',desc:''};
  }
  if(!cb.checked)delete driveDetails[fid];
  updateDetailForms();
}
function updateDetailForms(){
  const ids=Object.keys(driveDetails);
  const sec=$('dr-detail-sec');if(!sec)return;
  if(!ids.length){sec.style.display='none';return;}
  sec.style.display='block';
  const df=$('dr-detail-forms');if(!df)return;
  df.innerHTML=ids.map(fid=>{
    const tf=driveFiles.find(f=>f.id===fid)||{};
    const d=driveDetails[fid];
    const prev=tf.thumbnailLink?`<img src="${tf.thumbnailLink.replace('=s220','=s400')}" style="width:52px;height:78px;object-fit:cover;border-radius:4px;flex-shrink:0" alt="">`:
      `<div style="width:52px;height:78px;border-radius:4px;background:var(--d3);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🎬</div>`;
    return `<div class="ddf"><div class="ddf-top">${prev}<div class="ddf-fields">
      <div class="ddf-fname">📄 ${esc(tf.name||fid)}</div>
      <input class="fi" placeholder="Title *" value="${esc(d.title)}" onchange="driveDetails['${esc(fid)}'].title=this.value">
      <select class="fs" onchange="driveDetails['${esc(fid)}'].category=this.value">
        <option value="">Category *</option>
        <option value="hollywood"${d.category==='hollywood'?' selected':''}>🎬 Hollywood</option>
        <option value="bollywood"${d.category==='bollywood'?' selected':''}>🎭 Bollywood</option>
        <option value="other"${d.category==='other'?' selected':''}>📁 Other</option>
      </select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <input class="fi" placeholder="Year" value="${esc(d.year)}" onchange="driveDetails['${esc(fid)}'].year=this.value">
        <input class="fi" placeholder="Rating" value="${esc(d.rating)}" onchange="driveDetails['${esc(fid)}'].rating=this.value">
      </div>
      <input class="fi" placeholder="Poster URL (optional)" value="${esc(d.poster)}" onchange="driveDetails['${esc(fid)}'].poster=this.value">
    </div></div></div>`;
  }).join('');
}
async function importSelected(){
  const ids=Object.keys(driveDetails);if(!ids.length){toast('Select files first.');return;}
  const errs=ids.filter(id=>!driveDetails[id].title||!driveDetails[id].category);
  if(errs.length){toast('Fill title & category for all '+errs.length+' selected file(s).');return;}
  const btn=$('dr-import-btn');if(btn){btn.textContent='Importing…';btn.disabled=true;}
  ids.forEach(fid=>{
    const d=driveDetails[fid]; const tf=driveFiles.find(f=>f.id===fid)||{};
    DB.unshift({id:'mv_'+Date.now()+'_'+Math.random().toString(36).slice(2),
      title:cleanTitle(d.title),category:d.category,type:'movie',
      year:d.year,rating:d.rating,desc:d.desc,
      poster:d.poster||(tf.thumbnailLink?.replace('=s220','=s640')||''),
      driveId:fid,videoUrl:'',localBlob:'',addedAt:Date.now()});
  });
  const res=await dataSave(DB,CFG);
  if(btn){btn.textContent='Import Selected';btn.disabled=false;}
  closeDriveModal(); render(); renderSettingsLibrary();
  if(res.ok) toast('✅ Imported & synced '+ids.length+' title'+(ids.length!==1?'s':'')+' to Gist! ('+DB.length+' total)',4000);
  else toast('⚠ Imported locally — check Settings → Sync → GitHub Gist to sync to cloud.',4000);
}

/* ── DRIVE API ── */
async function driveList(key,folderId){
  let items=[],token='';
  do{
    /* Use fields that actually work with Drive API v3 */
    const url='https://www.googleapis.com/drive/v3/files'
      +'?key='+encodeURIComponent(key)
      +'&q='+encodeURIComponent("'"+folderId+"' in parents and trashed=false")
      +'&fields='+encodeURIComponent('nextPageToken,files(id,name,mimeType,size,thumbnailLink,webContentLink)')
      +'&pageSize=200'
      +(token?'&pageToken='+encodeURIComponent(token):'');
    const r=await fetch(url);
    if(!r.ok){
      const err=await r.json().catch(()=>({}));
      throw new Error((err.error?.message||'Drive API error: HTTP '+r.status)+' — Make sure API key is valid and Drive API is enabled, and folder is shared publicly.');
    }
    const d=await r.json(); items=items.concat(d.files||[]); token=d.nextPageToken||'';
  }while(token);
  return{files:items.filter(isVid),folders:items.filter(isDir)};
}
async function driveDeep(key,folderId,depth){
  depth=depth||0; const r=await driveList(key,folderId); let files=r.files;
  if(depth<4) for(const f of r.folders){
    try{const sub=await driveDeep(key,f.id,depth+1);sub.forEach(x=>{x._path=x._path?f.name+'/'+x._path:f.name;});files=files.concat(sub);}catch{}
  }
  return files;
}

/* ── SETTINGS ACTIONS ── */
async function saveDriveSettings(){
  CFG.apiKey  =($('s-api-key')?.value.trim())||getDriveKey();
  CFG.folderId=($('s-folder-id')?.value.trim())||getDriveFolder();
  const res=await dataSave(DB,CFG);
  toast(res.ok?'✓ Drive settings saved & synced!':'✓ Saved locally');
}
async function saveSiteSettings(){
  CFG.siteName=($('s-site-name')?.value.trim())||DEFAULT_SITE_NAME;
  const res=await dataSave(DB,CFG); applySiteName();
  toast(res.ok?'✓ Site name updated & synced!':'✓ Updated locally');
}
async function saveGistSync(){
  const token=($('s-gist-token')?.value.trim())||'';
  const gistId=($('s-gist-id')?.value.trim())||'';
  if(!token){toast('Paste your GitHub token.');return;}
  if(!gistId){toast('Paste your Gist ID.');return;}
  setToken(token); setGistId(gistId);
  const btn=$('s-gist-save-btn');if(btn){btn.textContent='Testing…';btn.disabled=true;}
  const result=await testGistToken();
  if(btn){btn.textContent='Save & Test';btn.disabled=false;}
  const msg=$('gist-msg');
  if(msg){msg.style.display='block';msg.textContent=(result.ok?'✓ ':'⚠ ')+result.reason;msg.className='set-msg '+(result.ok?'ok':'err');}
  const el=$('s-sync-status');
  if(el){el.textContent=result.ok?'✓ '+result.reason:'⚠ Gist: '+result.reason;el.className='set-msg '+(result.ok?'ok':'warn');}
  if(result.ok){
    toast('✓ Token saved! Pushing to Gist…',2000);
    const res=await dataSave(DB,CFG);
    toast(res.ok?'✓ Synced to Gist! Open on any device → Sync Now to see movies.':'⚠ Push failed',4000);
  } else {toast('⚠ '+result.reason,5000);}
}
async function saveSheetSync(){
  const url=($('s-sheet-url')?.value.trim())||'';
  if(!url){toast('Paste your Apps Script URL.');return;}
  setSheetUrl(url);
  const msg=$('sheet-msg');
  if(msg){msg.style.display='block';msg.textContent='✓ URL saved. Sheets backup is write-only — Google blocks reads from browsers. Use GitHub Gist for Sync Now.';msg.className='set-msg ok';}
  toast('✓ Sheets URL saved. Data will auto-backup on every save.');
}
async function testSheetsOnly(){
  const msg=$('sheet-msg');
  if(msg){msg.style.display='block';msg.textContent='ℹ Sheets is write-only backup. Reading from Apps Script is blocked by Google CORS. Use Gist for cross-device sync.';msg.className='set-msg warn';}
}
/* ── Google Drive OAuth ── */
async function googleSignIn(){
  const btn=$('btn-google-signin');
  if(btn){btn.textContent='Signing in…';btn.disabled=true;}
  try{
    await ensureOAuth();
    updateDriveAuthUI();
    toast('✅ Signed in to Google! Auto-saving to your Drive now.',4000);
    // Auto push after sign in
    const res=await dataSave(DB,CFG);
    if(res.driveOk) toast('✅ '+DB.length+' movies saved to your Google Drive!',4000);
  }catch(e){
    toast('⚠ Sign-in failed: '+e.message,5000);
  }
  if(btn){btn.textContent='Sign in with Google';btn.disabled=false;}
}
function googleSignOut(){
  clearOAuth();
  updateDriveAuthUI();
  toast('Signed out from Google Drive.');
}
async function updateDriveAuthUI(){
  const st=$('drive-auth-status');
  const si=$('btn-google-signin');
  const so=$('btn-google-signout');
  const sb=$('drive-sync-btns');
  if(isOAuthValid()){
    if(si)si.style.display='none';
    if(so)so.style.display='block';
    if(sb)sb.style.display='flex';
    if(st){st.textContent='Checking Drive…';st.className='set-msg';}
    const r=await testDriveAuth();
    if(st){st.textContent=(r.ok?'✅ ':'⚠ ')+r.reason;st.className='set-msg '+(r.ok?'ok':'err');}
  } else {
    if(si)si.style.display='flex';
    if(so)so.style.display='none';
    if(sb)sb.style.display='none';
    if(st){st.textContent='Not signed in — click Sign in with Google above';st.className='set-msg warn';}
  }
}

async function syncNow(){
  const btn=$('sync-now-btn');if(btn){btn.textContent='Syncing…';btn.disabled=true;}
  const src=isOAuthValid()?'Google Drive':'GitHub Gist';
  const st=$('drive-auth-status');
  if(st){st.textContent='Pulling from '+src+'…';st.className='set-msg';}
  toast('🔄 Pulling from '+src+'…',8000);
  const result=await dataPull();
  if(btn){btn.textContent='🔄 Sync Now';btn.disabled=false;}
  const t=$('toast');if(t)t.classList.remove('show');
  if(result.ok){
    DB=result.movies; CFG={...CFG,...result.cfg};
    render(); renderSettingsLibrary();
    if(st){st.textContent='✅ Synced from '+result.source+' — '+DB.length+' movies';st.className='set-msg ok';}
    toast('✅ Synced! '+DB.length+' movie'+(DB.length!==1?'s':'')+' loaded from '+result.source+'.',4000);
  } else {
    if(st){st.textContent='⚠ '+( result.error||'Sync failed');st.className='set-msg err';}
    toast('⚠ Sync failed: '+(result.error||'Sign in with Google or set GitHub token'),5000);
  }
}
async function forcePush(){
  if(!isSyncEnabled()){toast('⚠ Sign in with Google or set GitHub token in Settings → Sync.');return;}
  const src=isOAuthValid()?'Google Drive':'GitHub Gist';
  const st=$('drive-auth-status');
  if(st){st.textContent='Pushing '+DB.length+' movies to '+src+'…';st.className='set-msg';}
  toast('⬆ Pushing '+DB.length+' movies to '+src+'…',8000);
  const res=await dataSave(DB,CFG);
  const t=$('toast');if(t)t.classList.remove('show');
  if(res.ok){
    if(st){st.textContent='✅ Pushed '+DB.length+' movies to '+src+'!';st.className='set-msg ok';}
    toast('✅ '+DB.length+' movies pushed to '+src+'! Open on another device → Sync Now.',5000);
  } else {
    if(st){st.textContent='⚠ Push failed';st.className='set-msg err';}
    toast('⚠ Push failed — sign in with Google in Settings → Sync.',5000);
  }
}
async function changeSettingsPwd(){
  const sc=$('s-spwd-cur'),sn=$('s-spwd-new'),scf=$('s-spwd-cf'),se=$('s-spwd-err');
  if(!sc||!sn||!scf)return; if(se)se.textContent='';
  if(hashPwd(sc.value)!==getSpwd()){if(se)se.textContent='Wrong current password.';return;}
  if(sn.value.length<4){if(se)se.textContent='Min 4 characters.';return;}
  if(sn.value!==scf.value){if(se)se.textContent='Passwords do not match.';return;}
  CFG.settingsPwd=hashPwd(sn.value); await dataSave(DB,CFG);
  sc.value='';sn.value='';scf.value=''; toast('✓ Password changed!');
}
async function exportData(){
  const blob=new Blob([JSON.stringify({movies:DB,cfg:CFG},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='cinestream-backup.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importData(e){
  const file=e.target.files[0];if(!file)return;
  try{
    const obj=JSON.parse(await file.text());
    DB=Array.isArray(obj)?obj:(Array.isArray(obj.movies)?obj.movies:[]);
    if(obj.cfg)CFG={...CFG,...obj.cfg};
    const res=await dataSave(DB,CFG); render(); renderSettingsLibrary();
    toast(res.ok?'✓ Imported '+DB.length+' titles & synced!':'✓ Imported '+DB.length+' titles locally');
  }catch(err){toast('Invalid backup file: '+err.message);}
  e.target.value='';
}
function renderSettingsLibrary(){
  const list=$('s-lib-list');if(!list)return;
  if(!DB.length){list.innerHTML='<div style="color:var(--t3);font-size:13px;padding:12px;text-align:center">No titles yet.</div>';return;}
  const sorted=[...DB].sort((a,b)=>{if(a.type==='series'&&b.type!=='series')return -1;if(b.type==='series'&&a.type!=='series')return 1;return(parseInt(b.year)||0)-(parseInt(a.year)||0);});
  list.innerHTML=sorted.map(m=>{
    const c=cat(m.category);
    const epLabel=m.type==='series'?` · 📺 ${(m.episodes||[]).length} eps`:'';
    return `<div class="lib-item"><div class="lib-thumb">${m.poster?`<img src="${esc(m.poster)}" alt="">`:c.icon}</div><div class="lib-info"><div class="lib-title">${esc(m.title||'Untitled')}</div><div class="lib-sub">${c.icon} ${c.label}${m.year?' · '+m.year:''}${epLabel}</div></div><div class="lib-btns"><button class="lib-btn e" onclick="editFromLibrary('${m.id}')">✏</button><button class="lib-btn d" onclick="deleteTitle('${m.id}')">✕</button></div></div>`;
  }).join('');
}

/* ── MOBILE ── */
function setMobActive(id){
  document.querySelectorAll('.mob-btn').forEach(b=>b.classList.remove('active'));
  const el=$(id);if(el)el.classList.add('active');
}
function focusMobileSearch(){
  const bar=$('mob-search-bar');if(bar)bar.style.display='block';
  setTimeout(()=>{const inp=$('mob-search-input');if(inp)inp.focus();},80);
  setMobActive('mob-search');
}
function closeMobileSearch(){
  const bar=$('mob-search-bar');if(bar)bar.style.display='none';
  const inp=$('mob-search-input');if(inp)inp.value='';
  showHome();
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded',async()=>{
  toast('Loading your library…',8000);
  try{const d=await dataLoad(); DB=d.movies||[]; CFG=d.cfg||{};}
  catch(e){console.error('Load error:',e); DB=[]; CFG={};}
  const t=$('toast');if(t)t.classList.remove('show');
  if(!CFG.apiKey)   CFG.apiKey   = _DK;
  if(!CFG.folderId) CFG.folderId = _DF;
  render();
  showView('home-view');

  window.addEventListener('scroll',()=>{
    const nb=$('navbar');if(nb)nb.classList.toggle('solid',window.scrollY>40);
  });

  /* Close modals on backdrop click */
  ['detail-modal','player-modal','edit-modal','drive-modal','ep-modal',
   'series-create-modal','ep-drive-modal','add-choice-modal'].forEach(id=>{
    const el=$(id);if(!el)return;
    el.addEventListener('click',function(e){
      if(e.target!==this)return;
      if(id==='player-modal')closePlayer();
      else if(id==='detail-modal')closeDetail();
      else closeModal(id);
    });
  });

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    closePlayer();closeDetail();closeEditModal();closeDriveModal();
    closeEpModal();closeSeriesCreateModal();closeEpDriveModal();
    closeModal('add-choice-modal');closeSettingsLock();
  });

  const si=$('slock-inp');
  if(si)si.addEventListener('keydown',e=>{if(e.key==='Enter')checkSettingsPwd();});
  onSrcChange();
});
