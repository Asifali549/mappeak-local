// 19 Nov (owner asked): after a new search the list shows only that search's businesses (best 10 of them);
// older unsent leads stay saved, one tap away ("باقی بھی دکھائیں"); the copy for Claude has only the new ones;
// a search with nothing new says so clearly; old saved data without a "last search" behaves as before.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 4 }];
  let k = 0, calls = 0;
  const P = (id, name, reviews) => ({ id, displayName: { text: name }, formattedAddress: 'Al Manar, Dammam 32274, Saudi Arabia', rating: 4.2, userRatingCount: reviews, websiteUri: '',
    nationalPhoneNumber: '055', internationalPhoneNumber: '+966 55 357 ' + (6100 + (k++)), primaryType: 'car_repair', primaryTypeDisplayName: { text: 'Car repair' }, businessStatus: 'OPERATIONAL', reviews: recent });
  const OLD = ['Design One', 'Design Two', 'Design Three', 'Design Four', 'Design Five'].map((n, i) => P('old' + i, n + ' Studio', 30 + i));
  const NEW = ['Sathah Ali', 'Sathah Bilal', 'Sathah Kashif'].map((n, i) => P('new' + i, n + ' Towing', 20 + i));
  const NAMED = P('named1', 'Karachi Tyre Shop', 40);
  let mode = 'old';
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) { calls++; const q = JSON.parse(r.request().postData()).textQuery;
      if (/Karachi Tyre/.test(q)) return j({ places: [NAMED] });
      if (mode === 'old') { const x = OLD; mode = 'none'; return j({ places: x }); }
      if (mode === 'new') { const x = NEW; mode = 'none'; return j({ places: x }); }
      if (mode === 'again') return j({ places: OLD.concat(NEW) });   // nothing new: all already found
      return j({ places: [] }); }
    if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
    if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
    if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
    if (/rdap|webrisk/.test(u)) return j({});
    return r.abort();
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; document.getElementById('dayLimit').value = '50'; });
  await p.click('#saveSet'); await p.waitForTimeout(400);
  const names = () => p.$$eval('#results .lead .name', ns => ns.map(n => n.textContent.replace(/^#\d+/, '')));
  const auto = async m => { mode = m; await p.selectOption('#autoC', 'SA'); await p.click('#autoGo');
    await p.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 }); await p.waitForTimeout(800); };

  await auto('old');
  let s = await names();
  ok('R1 first search shows its own businesses', s.length === 5 && s.every(n => /Design/.test(n)), s.join(' / '));
  await auto('new');
  s = await names();
  ok('R2 a new search shows ONLY the new businesses, not the old unsent ones', s.length === 3 && s.every(n => /Sathah/.test(n)), s.join(' / '));
  ok('R3 a line says these are the last search\'s best, older ones are behind the button', /آخری سرچ/.test(await p.textContent('#results')) && /باقی بھی دکھائیں \(5\)/.test(await p.textContent('#showAll')));
  await p.click('#copyAll'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  ok('R4 the copy for Claude has only the new search', (t.match(/^#\d+ /gm) || []).length === 3 && /Sathah/.test(t) && !/Design/.test(t), t.slice(0, 160));
  await p.click('#showAll'); await p.waitForTimeout(200);
  s = await names();
  ok('R5 "show the rest" brings the old ones back (nothing deleted)', s.length === 8 && s.some(n => /Design One/.test(n)), s.length);
  await p.click('#showTop'); await p.waitForTimeout(200);
  ok('R6 back to the last search only', (await names()).length === 3);
  // messaging one: the next one from the SAME search fills in, never an old one
  await p.$$eval('#results .lead', ls => ls[0].querySelector('[data-a="sent"]').click()); await p.waitForTimeout(300);
  s = await names();
  ok('R7 after messaging one, only the rest of that search stays (no old ones slip in)', s.length === 2 && s.every(n => /Sathah/.test(n)), s.join(' / '));
  // the number box still finds an old lead
  const oldNo = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads.find(l => l.id === 'old2').no);
  await p.fill('#leadFind', String(oldNo)); await p.waitForTimeout(300);
  ok('R8 the number box still finds an old lead', (await names()).some(n => /Design Three/.test(n)));
  await p.fill('#leadFind', ''); await p.waitForTimeout(300);
  // closing and reopening the app keeps the last search
  await p.reload(); await p.waitForTimeout(1200);
  await p.selectOption('#autoC', 'SA').catch(() => {});
  s = await names();
  ok('R9 after reopening the app it still shows the last search', s.length === 2 && s.every(n => /Sathah/.test(n)), s.join(' / '));
  // a search that finds nothing new says so
  await auto('again');
  ok('R10 a search with nothing new says so clearly', /کوئی نئی لیڈ نہیں ملی/.test(await p.textContent('#results')) && (await names()).length === 0);
  // name search: shows the business looked up
  await p.fill('#byName', 'Karachi Tyre Shop Dammam'); await p.click('#goName');
  await p.waitForFunction(() => !/جاری/.test(document.getElementById('goName').textContent), null, { timeout: 20000 }); await p.waitForTimeout(500);
  s = await names();
  ok('R11 a name search shows the business it found', s.length === 1 && /Karachi Tyre/.test(s[0]), s.join(' / '));
  // old saved data (no "last search" stored, e.g. before this update or on the other device) behaves as before
  await p.evaluate(() => localStorage.removeItem('mp_lastRun')); await p.reload(); await p.waitForTimeout(1200);
  s = await names();
  ok('R12 without a saved last search, all unsent leads show as before', s.length >= 8, s.length);
  // the last search is not synced (each device shows its own)
  ok('R13 the last-search list is device-only (not in the Sync keys)', await p.evaluate(() => !/mp_lastRun/.test(document.documentElement.innerHTML.split('SYNC_KEYS')[1].split(']')[0])));
  ok('R14 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
