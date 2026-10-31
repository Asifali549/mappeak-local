// Auto search (tool picks city + trade), shared daily limit, no repeats, manual search unchanged, progress synced,
// plus the Europe/Turkey ad signals ("maybe ads" from a Tag Manager container, cookie-banner notice, prominent ad-library buttons).
const { chromium } = require('playwright');
const SYNC = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  let cloud = {}; const queries = [];
  const hash = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h.toString(36); };
  const placesFor = (q, eu) => [0, 1, 2].map(i => ({
    id: 'p' + hash(q) + i, displayName: { text: 'Biz ' + i + ' ' + q.slice(0, 18) }, formattedAddress: '1 Main St, ' + q.split(' in ')[1],
    rating: 4.1, userRatingCount: 12 + i, websiteUri: 'https://' + (eu ? 'eu' : 'us') + hash(q) + i + '.example/', nationalPhoneNumber: '(555) 010' + i,
    internationalPhoneNumber: '+971 50 000 00' + i, primaryType: 'plumber', primaryTypeDisplayName: { text: 'Plumber' }, businessStatus: 'OPERATIONAL',
    reviews: [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }] }));
  const psi = u => ({ lighthouseResult: { finalDisplayedUrl: u, categories: { performance: { score: 0.4 } }, audits: {
    'is-on-https': { score: 1 }, 'http-status-code': { score: 1 }, 'is-crawlable': { score: 1 }, 'meta-description': { score: 1 }, 'document-title': { score: 1 }, viewport: { score: 1 },
    'network-requests': { details: { items: /eu\w+0\./.test(u) ? [{ url: u }, { url: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABC123' }, { url: 'https://consent.cookiebot.com/uc.js' }]
      : /eu\w+1\./.test(u) ? [{ url: u }, { url: 'https://consent.cookiebot.com/uc.js' }] : [{ url: u }] } } } } });
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
      const u = r.request().url(), m = r.request().method(); const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if (u.startsWith(SYNC)) { if (m === 'POST') { cloud = JSON.parse(r.request().postData()); return j({ ok: 1 }); } return j(cloud); }
      if (/places:searchText/.test(u)) { const q = JSON.parse(r.request().postData()).textQuery; queries.push(q); await new Promise(x => setTimeout(x, 120)); return j({ places: placesFor(q, /Netherlands|Eindhoven|Tilburg/.test(q)) }); }
      if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
      if (/pagespeedonline/.test(u)) return j(psi(decodeURIComponent(u.match(/url=([^&]+)/)[1])));
      if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
      if (/rdap|webrisk/.test(u)) return j({});
      return r.abort();
    });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
    await p.evaluate(s => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; document.getElementById('syncUrl').value = s; }, SYNC);
    await p.click('#saveSet'); await p.waitForTimeout(1200);
    return p;
  };
  const A = await mk();
  // 1. auto run, United States
  await A.selectOption('#autoC', 'US'); await A.click('#autoGo');
  // 7. while auto runs, the manual button says "wait" and does not start a second search
  await A.waitForTimeout(250); const before = queries.length; await A.click('#go'); await A.waitForTimeout(200);
  ok('A7 manual search waits while auto runs', /پہلے والی تلاش ختم ہونے دیں/.test(await A.textContent('#toast')));
  await A.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 });
  const run1 = queries.slice(0, 8);
  ok('A1 auto made 8 searches by itself, no city typed', queries.length === 8 && run1.every(q => / in .*, [A-Z]{2}$/.test(q)), queries.length + ' | ' + run1[0]);
  ok('A1b progress remembered', JSON.parse(await A.evaluate(() => localStorage.getItem('mp_autoPos'))).US === 8);
  ok('A6 auto leads carry the "auto" mark', /خودکار/.test(await A.evaluate(() => { document.getElementById('urgentOnly').checked = false; document.getElementById('urgentOnly').onchange(); return document.getElementById('results').textContent; })));
  // 2. next run continues with new cities; 3. shared daily limit
  await A.fill('#dayLimit', '10'); await A.dispatchEvent('#dayLimit', 'change');
  await A.click('#autoGo'); await A.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 });
  const run2 = queries.slice(8);
  ok('A2 second run continues with new cities (no repeats)', run2.length > 0 && run2.every(q => run1.indexOf(q) < 0), run2.join(' ; '));
  ok('A3 manual + auto share one daily limit (8 + 2 = 10)', run2.length === 2 && (await A.textContent('#todayCount')).trim() === '10');
  await A.click('#autoGo'); await A.waitForTimeout(300);
  ok('A3b at the limit auto stops and says so', /حد پوری/.test(await A.textContent('#autoLog')) && queries.length === 10);
  // 4. manual search still works exactly as before (raise the limit for it)
  await A.fill('#dayLimit', '25'); await A.dispatchEvent('#dayLimit', 'change');
  await A.selectOption('#country', 'US'); await A.fill('#trade', 'plumber'); await A.fill('#towns', 'Abilene, TX'); await A.fill('#runLimit', '1');
  const leadsBefore = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads.length);
  await A.click('#go'); await A.waitForTimeout(2500);
  ok('A4 manual search unchanged (typed trade + town)', queries[queries.length - 1] === 'plumber in Abilene, TX');
  const leadsAfter = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads);
  ok('A4b manual search keeps the auto results', leadsAfter.filter(L => L.auto).length > 0 && leadsAfter.length >= leadsBefore, leadsBefore + ' -> ' + leadsAfter.length);
  ok('A5 no business twice', new Set(leadsAfter.map(L => L.id)).size === leadsAfter.length);
  // 8. progress synced: the laptop continues where the phone stopped
  await A.waitForTimeout(3000); const B = await mk(); await B.waitForTimeout(500);
  ok('A8 auto progress reaches the other device', JSON.parse(await B.evaluate(() => localStorage.getItem('mp_autoPos') || '{}')).US === 10);
  // 9. Gulf: WhatsApp country -> phone needed, shows all (not only urgent), main country switched to UAE
  await B.selectOption('#autoC', 'AE'); await B.click('#autoGo'); await B.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 });
  ok('A9 Gulf auto: UAE shown, all leads (not only urgent)', (await B.inputValue('#country')) === 'AE' && !(await B.isChecked('#urgentOnly')) && (await B.$$('#results .lead')).length > 0);
  // 10/11. Europe: Netherlands via "other country", maybe-ads + cookie notices + prominent ad buttons
  await B.selectOption('#autoC', 'NL'); await B.click('#autoGo'); await B.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 });
  ok('A11 Netherlands shown through "other country"', (await B.inputValue('#country')) === 'XX' && (await B.inputValue('#otherC')) === 'Netherlands');
  await B.evaluate(() => { document.getElementById('urgentOnly').checked = false; document.getElementById('urgentOnly').onchange(); });
  await B.waitForFunction(() => /شاید اشتہار/.test(document.getElementById('results').textContent), null, { timeout: 60000 }).catch(() => {});
  const txt = await B.textContent('#results');
  ok('A10 "maybe ads" badge from the Tag Manager container', /شاید اشتہار/.test(txt));
  ok('A10b cookie-banner notice when nothing else is visible', /کوکی خانہ ہے/.test(txt));
  ok('A10c ad-library buttons are prominent for Europe', (await B.$$eval('#results a.btn', a => a.filter(x => /اشتہار دیکھیں/.test(x.textContent)).length)) > 0);
  ok('A12 no page errors', !A.errs.length && !B.errs.length, [...A.errs, ...B.errs].join(' | '));
  console.log(res.join('\n')); await b.close();
})();
