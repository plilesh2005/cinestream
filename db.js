/* ============================================================
   CINESTREAM v14 — db.js  © DK
   PRIMARY SYNC: Google Drive (OAuth) — saves cinestream-db.json
                 directly into YOUR Google Drive. Any device
                 that signs in sees the same data instantly.
   FALLBACK:     GitHub Gist (no login needed, baked-in token)
   LOCAL:        localStorage cache (always available offline)
   ============================================================ */

/* ── OAuth Client ID (safe to expose — it's a public identifier) ── */
const OAUTH_CLIENT_ID = '239840635237-uj84ob8ta204noglhdori2p6jnd79o2h.apps.googleusercontent.com';
const OAUTH_SCOPE     = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';
const DB_FILENAME     = 'cinestream-db.json';
const DB_FOLDER_NAME  = 'CineStream';

/* ── Drive / Streaming config ── */
const DRIVE_API_KEY   = 'AIzaSyCBzZakkfsYC3k1Kw1rIhnzSn9cv-Af28Y';
const DRIVE_FOLDER_ID = '1PydbnXY-aYQGlXlc02FD0RMnYRduP8cC';

/* ── GitHub Gist fallback ── */
const GIST_FILE     = 'cinestream-db.json';
const BAKED_GIST_ID = '07bb296ad3b5db773f0352db3d75d5c5';
const _tk = [77,66,90,117,18,67,121,109,110,65,102,91,114,110,29,91,
             122,67,18,114,65,120,95,65,19,93,25,66,96,114,78,30,26,
             97,26,64,115,96,18,115];
const _bt = () => String.fromCharCode(..._tk.map(c => c ^ 42));

/* ── localStorage keys ── */
const LS = {
  DB:       'cs_db_v14',
  CFG:      'cs_cfg_v14',
  TOKEN:    'cs_tok_v14',
  GIST:     'cs_gist_v14',
  SHEET:    'cs_sheet_v14',
  OAUTH:    'cs_oauth_v14',   /* Google OAuth access token */
  OEXP:     'cs_oexp_v14',    /* OAuth expiry timestamp */
  DBFILE:   'cs_dbfile_v14',  /* Drive file ID of cinestream-db.json */
};

/* ── Getters / Setters ── */
function getToken()    { return localStorage.getItem(LS.TOKEN) || _bt(); }
function getGistId()   { return localStorage.getItem(LS.GIST)  || BAKED_GIST_ID; }
function getSheetUrl() { return localStorage.getItem(LS.SHEET) || 'https://script.google.com/macros/s/AKfycby0y7PJAbxzQ0eXUrimyx2DoSIPHQz0vEbj9dHhykbXtIOEGXgM7E12I4SLBK_soXpZ/exec'; }
function setToken(t)   { if (t) localStorage.setItem(LS.TOKEN, t.trim()); }
function setGistId(g)  { if (g) localStorage.setItem(LS.GIST,  g.trim()); }
function setSheetUrl(u){ if (u) localStorage.setItem(LS.SHEET, u.trim()); }
function isTokenSet()  { const t = getToken(); return !!(t && t.length > 10); }

/* OAuth token helpers */
function getOAuthToken()  { return localStorage.getItem(LS.OAUTH) || ''; }
function getOAuthExpiry() { return parseInt(localStorage.getItem(LS.OEXP) || '0'); }
function setOAuthToken(t, expiresIn) {
  localStorage.setItem(LS.OAUTH, t);
  localStorage.setItem(LS.OEXP, (Date.now() + (expiresIn - 60) * 1000).toString());
}
function clearOAuth() {
  localStorage.removeItem(LS.OAUTH); localStorage.removeItem(LS.OEXP);
  localStorage.removeItem(LS.DBFILE);
}
function isOAuthValid() {
  const t = getOAuthToken(); const exp = getOAuthExpiry();
  return !!(t && exp > Date.now());
}
function getDriveFileId()  { return localStorage.getItem(LS.DBFILE) || ''; }
function setDriveFileId(id){ localStorage.setItem(LS.DBFILE, id); }

/* Password hash */
function hashPwd(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return 'h_' + Math.abs(h).toString(36);
}

/* localStorage helpers */
function _lsGet(k, fb) { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } }
function _lsSet(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function _cache(movies, cfg) { _lsSet(LS.DB, movies); _lsSet(LS.CFG, cfg); }

/* Strip base64 / blob before cloud save — keeps file tiny */
function _stripLocal(movies) {
  return movies.map(m => {
    const c = { ...m };
    if (c.poster    && c.poster.startsWith('data:'))  c.poster    = '';
    if (c.localBlob && c.localBlob.startsWith('blob:')) c.localBlob = '';
    return c;
  });
}

/* ════════════════════════════════════════════════════════════
   GOOGLE OAUTH — popup sign-in
   ════════════════════════════════════════════════════════════ */
function driveSignIn() {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      client_id:     OAUTH_CLIENT_ID,
      redirect_uri:  window.location.origin + window.location.pathname,
      response_type: 'token',
      scope:         OAUTH_SCOPE,
      prompt:        'consent',
    });
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
    const w = window.open(url, 'gauth', 'width=500,height=620,left=200,top=100');
    if (!w) { reject(new Error('Popup blocked — allow popups for this site')); return; }

    const timer = setInterval(() => {
      try {
        if (!w || w.closed) { clearInterval(timer); reject(new Error('Sign-in window closed')); return; }
        const hash = w.location.hash;
        if (hash && hash.includes('access_token')) {
          clearInterval(timer); w.close();
          const p = new URLSearchParams(hash.slice(1));
          const token = p.get('access_token');
          const exp   = parseInt(p.get('expires_in') || '3600');
          if (token) { setOAuthToken(token, exp); resolve(token); }
          else reject(new Error('No access_token in response'));
        }
      } catch { /* cross-origin — still loading */ }
    }, 300);

    setTimeout(() => { clearInterval(timer); if (!w.closed) w.close(); reject(new Error('Sign-in timed out')); }, 120000);
  });
}

async function ensureOAuth() {
  if (isOAuthValid()) return getOAuthToken();
  return await driveSignIn();
}

/* ════════════════════════════════════════════════════════════
   GOOGLE DRIVE FILE SYNC
   Saves cinestream-db.json to Drive App Data or root folder.
   Readable from any device that signs in with same Google account.
   ════════════════════════════════════════════════════════════ */

/* Find existing cinestream-db.json in Drive */
async function _driveFindFile(token) {
  const q = encodeURIComponent(`name='${DB_FILENAME}' and trashed=false`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime)&spaces=drive`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!r.ok) throw new Error('Drive search error: HTTP ' + r.status);
  const d = await r.json();
  return (d.files || [])[0] || null;
}

/* Read file content from Drive */
async function _driveReadFile(token, fileId) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!r.ok) throw new Error('Drive read error: HTTP ' + r.status);
  const text = await r.text();
  let p; try { p = JSON.parse(text); } catch { p = {}; }
  return { movies: Array.isArray(p.movies) ? p.movies : [], cfg: p.cfg || {} };
}

/* Write/update file in Drive */
async function _driveWriteFile(token, fileId, data) {
  const body = JSON.stringify(data);
  let url, method;

  if (fileId) {
    /* Update existing file */
    url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    method = 'PATCH';
  } else {
    /* Create new file — multipart upload with metadata */
    const meta = JSON.stringify({ name: DB_FILENAME, mimeType: 'application/json' });
    const boundary = 'cs_boundary_' + Date.now();
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;

    const r = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipart
      }
    );
    if (!r.ok) throw new Error('Drive create error: HTTP ' + r.status);
    const j = await r.json();
    setDriveFileId(j.id);
    console.log('[db] Drive file created:', j.id);
    return j.id;
  }

  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body
  });
  if (!r.ok) throw new Error('Drive write error: HTTP ' + r.status);
  console.log('[db] Drive file updated:', fileId, '—', Math.round(body.length / 1024), 'KB');
  return fileId;
}

/* ── Public Drive functions ── */
async function driveSync_read() {
  const token = await ensureOAuth();
  let fileId = getDriveFileId();
  if (!fileId) {
    const f = await _driveFindFile(token);
    if (!f) throw new Error('No cinestream-db.json in Drive yet. Push data first.');
    fileId = f.id; setDriveFileId(fileId);
  }
  return await _driveReadFile(token, fileId);
}

async function driveSync_write(movies, cfg) {
  const token = await ensureOAuth();
  const data = { movies: _stripLocal(movies), cfg };
  let fileId = getDriveFileId();
  if (!fileId) {
    const f = await _driveFindFile(token);
    fileId = f ? f.id : '';
  }
  const newId = await _driveWriteFile(token, fileId, data);
  if (newId) setDriveFileId(newId);
}

async function testDriveAuth() {
  if (!isOAuthValid()) return { ok: false, reason: 'Not signed in — click "Sign in with Google" in Settings → Sync' };
  try {
    const token = getOAuthToken();
    const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!r.ok) { clearOAuth(); return { ok: false, reason: 'Session expired — sign in again' }; }
    const j = await r.json();
    const email = j.user?.emailAddress || 'unknown';
    const f = await _driveFindFile(token);
    const info = f ? ` · DB file: ${Math.round((f.size||0)/1024)}KB` : ' · No DB file yet (push to create)';
    return { ok: true, reason: `Signed in as ${email}${info}`, email };
  } catch (e) { return { ok: false, reason: e.message }; }
}

/* ════════════════════════════════════════════════════════════
   GITHUB GIST — fallback sync (no login needed)
   ════════════════════════════════════════════════════════════ */
function _ghHeaders() {
  return {
    Authorization: 'token ' + getToken(),
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}
async function _gistRead() {
  const r = await fetch('https://api.github.com/gists/' + getGistId(),
    { headers: _ghHeaders(), cache: 'no-store' });
  if (r.status === 401) throw new Error('Gist token invalid');
  if (r.status === 404) throw new Error('Gist not found');
  if (!r.ok) throw new Error('Gist HTTP ' + r.status);
  const j = await r.json();
  const fi = j.files?.[GIST_FILE];
  if (!fi) throw new Error('No cinestream-db.json in Gist');
  let raw = fi.content || '{}';
  if (fi.truncated) {
    const r2 = await fetch(fi.raw_url, { headers: _ghHeaders(), cache: 'no-store' });
    raw = await r2.text();
  }
  let p; try { p = JSON.parse(raw); } catch { p = {}; }
  return { movies: Array.isArray(p.movies) ? p.movies : [], cfg: p.cfg || {} };
}
async function _gistWrite(movies, cfg) {
  const r = await fetch('https://api.github.com/gists/' + getGistId(), {
    method: 'PATCH',
    headers: { ..._ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify({ movies: _stripLocal(movies), cfg }) } } })
  });
  if (!r.ok) throw new Error('Gist write HTTP ' + r.status);
}
async function testGistToken() {
  if (!isTokenSet()) return { ok: false, reason: 'No GitHub token set' };
  try {
    const r = await fetch('https://api.github.com/gists/' + getGistId(),
      { headers: _ghHeaders(), cache: 'no-store' });
    if (r.status === 401) return { ok: false, reason: 'Token invalid (401)' };
    if (r.status === 404) return { ok: false, reason: 'Gist not found (404)' };
    if (!r.ok) return { ok: false, reason: 'GitHub HTTP ' + r.status };
    const j = await r.json();
    const fi = j.files?.[GIST_FILE];
    let count = 0;
    try {
      let raw = fi?.content || '{}';
      if (fi?.truncated) { const r2 = await fetch(fi.raw_url, { headers: _ghHeaders() }); raw = await r2.text(); }
      count = JSON.parse(raw).movies?.length || 0;
    } catch {}
    return { ok: true, reason: 'Gist connected ✓ — ' + count + ' movies' };
  } catch (e) { return { ok: false, reason: e.message }; }
}

/* Google Sheets — write-only backup */
async function _sheetWrite(movies, cfg) {
  const url = getSheetUrl();
  if (!url || !url.startsWith('https://script.google')) return;
  try {
    await fetch(url, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ movies: _stripLocal(movies), cfg })
    });
  } catch {}
}
async function testSheetUrl() {
  const url = getSheetUrl();
  if (!url || !url.startsWith('https://script.google')) return { ok: false, reason: 'No URL set' };
  return { ok: true, reason: 'URL saved ✓ (write-only backup)' };
}

/* ════════════════════════════════════════════════════════════
   PUBLIC API — used by app.js
   ════════════════════════════════════════════════════════════ */

/* Load: Drive → Gist → localStorage */
async function dataLoad() {
  /* 1. Try Google Drive (best — tied to your Google account) */
  if (isOAuthValid()) {
    try {
      const d = await driveSync_read();
      const merged = _mergeLocal(d.movies);
      _cache(merged, d.cfg);
      console.log('[db] Loaded', merged.length, 'movies from Google Drive');
      return { movies: merged, cfg: d.cfg, source: 'Google Drive' };
    } catch (e) { console.warn('[db] Drive load:', e.message); }
  }
  /* 2. Try Gist */
  if (isTokenSet()) {
    try {
      const d = await _gistRead();
      const merged = _mergeLocal(d.movies);
      _cache(merged, d.cfg);
      console.log('[db] Loaded', merged.length, 'movies from Gist');
      return { movies: merged, cfg: d.cfg, source: 'GitHub Gist' };
    } catch (e) { console.warn('[db] Gist load:', e.message); }
  }
  /* 3. localStorage */
  console.log('[db] Using local cache');
  return { movies: _lsGet(LS.DB, []), cfg: _lsGet(LS.CFG, {}), source: 'local cache' };
}

/* Save: localStorage + Drive + Gist + Sheets */
async function dataSave(movies, cfg) {
  _cache(movies, cfg);
  let driveOk = false, gistOk = false;

  if (isOAuthValid()) {
    try { await driveSync_write(movies, cfg); driveOk = true; }
    catch (e) { console.warn('[db] Drive save:', e.message); }
  }
  if (isTokenSet()) {
    try { await _gistWrite(movies, cfg); gistOk = true; }
    catch (e) { console.warn('[db] Gist save:', e.message); }
  }
  _sheetWrite(movies, cfg).catch(() => {});

  return { ok: driveOk || gistOk, driveOk, gistOk, count: movies.length };
}

/* Pull: force re-read from best available source */
async function dataPull() {
  if (isOAuthValid()) {
    try {
      const d = await driveSync_read();
      const merged = _mergeLocal(d.movies);
      _cache(merged, d.cfg);
      return { ok: true, movies: merged, cfg: d.cfg, source: 'Google Drive' };
    } catch (e) { console.warn('[db] Drive pull:', e.message); }
  }
  if (isTokenSet()) {
    try {
      const d = await _gistRead();
      const merged = _mergeLocal(d.movies);
      _cache(merged, d.cfg);
      return { ok: true, movies: merged, cfg: d.cfg, source: 'GitHub Gist' };
    } catch (e) { return { ok: false, error: e.message }; }
  }
  return { ok: false, error: 'Sign in with Google or set GitHub token in Settings → Sync' };
}

/* Merge: restore local base64 posters that were stripped before cloud save */
function _mergeLocal(cloudMovies) {
  const local = _lsGet(LS.DB, []);
  return cloudMovies.map(cm => {
    const lm = local.find(x => x.id === cm.id);
    if (lm && lm.poster && lm.poster.startsWith('data:') && !cm.poster)
      return { ...cm, poster: lm.poster, localBlob: lm.localBlob || '' };
    return cm;
  });
}

function isSyncEnabled() { return isOAuthValid() || isTokenSet(); }
