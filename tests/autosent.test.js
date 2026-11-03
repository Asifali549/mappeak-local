// One number per business (#17) that never changes and is the same on both devices; find box by number or name;
// tapping WhatsApp / copying the email or the reminder marks the step done by itself, with a one-tap undo.
const { chromium } = require('playwright');
const SYNC = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  let cloud = {};
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }];
  const words = ['Afridi','Bannu','Chitral','Dawood','Ehsan','Farooq','Ghazi','Hamza','Iqbal','Jalal','Kamran','Latif'];
  const P = (id, name, intl, addr, web) => ({ id, displayName: { text: name }, formattedAddress: addr, rating: 4.1, userRatingCount: 20, websiteUri: web || '',
    nationalPhoneNumber: '050 000 0000', internationalPhoneNumber: intl, primaryType: 'restaurant', primaryTypeDisplayName: { text: 'Pakistani restaurant' }, businessStatus: 'OPERATIONAL', reviews: recent });
  const placesFor = q => /, TX/.test(q)
    ? [P('us1', 'Lone Star Plumbing', '+1 325-555-0101', '1 Main St, Abilene, TX 79601, USA', 'https://lonestar.example/')]
    : words.map((w, i) => P('ae' + i, w + ' Karahi House', '+971 50 111 22' + (10 + i), 'Al Muqta - Umm Al Quwain - United Arab Emirates'));
  const mk = async (seedFollow) => {
    const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    if (seedFollow) await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(seedFollow));
    await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
      const u = r.request().url(), m = r.request().method(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if (u.startsWith(SYNC)) { if (m === 'POST') { cloud = JSON.parse(r.request().postData()); return j({ ok: 1 }); } return j(cloud); }
      if (/places:searchText/.test(u)) return j({ places: placesFor(JSON.parse(r.request().postData()).textQuery) });
      if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
      if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.3 } }, audits: { 'network-requests': { details: { items: [] } } } } });
      if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
      if (/rdap|webrisk/.test(u)) return j({});
      return r.abort();   // wa.me and everything else
    });
    const p = await ctx.newPage();
    ctx.on('page', pg => pg.close().catch(() => {}));   // WhatsApp tabs p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
    await p.evaluate(s => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; document.getElementById('syncUrl').value = s; }, SYNC);
    await p.click('#saveSet'); await p.waitForTimeout(1200);
    return p;
  };
  const now = Date.now();
  const A = await mk([{ id: 'r1', n: 'InfoTank (Avery Sellers)', c: 'US', contact: 'avery@example.com', manual: true, at: now - 8 * 864e5, state: 'waiting' }]);
  await A.selectOption('#country', 'AE'); await A.fill('#trade', 'Pakistani restaurant'); await A.fill('#towns', 'Umm Al Quwain'); await A.fill('#runLimit', '1');
  await A.click('#go'); await A.waitForTimeout(3000);
  const nums = async P_ => P_.$$eval('#results .lead .name', ns => ns.map(n => n.textContent));
  let shown = await nums(A);
  const noOf = t => +(/#(\d+)/.exec(t) || [])[1];
  ok('N1 every card shows a number', shown.length === 10 && shown.every(t => /^#\d+/.test(t)), shown.slice(0, 3).join(' / '));
  ok('N1b numbers are unique', new Set(shown.map(noOf)).size === shown.length);
  await A.click('#copyAll'); await A.waitForTimeout(300);
  const t = await A.evaluate(() => navigator.clipboard.readText());
  const first = shown[0], firstNo = noOf(first), firstName = first.replace(/^#\d+/, '');
  ok('N2 the copy for Claude uses the same numbers', t.indexOf('#' + firstNo + ' ' + firstName) >= 0, '#' + firstNo + ' ' + firstName);
  // find box
  await A.fill('#leadFind', String(noOf(shown[4]))); await A.waitForTimeout(200);
  let f = await nums(A);
  ok('N3 find by number shows that one business', f.length === 1 && f[0] === shown[4], f.join(' / '));
  await A.fill('#leadFind', 'kamran'); await A.waitForTimeout(200); f = await nums(A);
  ok('N3b find by part of the name (any case)', f.length === 1 && /Kamran/.test(f[0]));
  await A.fill('#leadFind', ''); await A.waitForTimeout(200);
  ok('N3c clearing the box brings the best 10 back', (await nums(A)).length === 10);
  // WhatsApp tap marks it sent
  const before = +(await A.textContent('#sentToday'));
  await A.locator('#results .lead').first().locator('[data-a="wa"]').click(); await A.waitForTimeout(900);
  let leadsNow = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads);
  const tapped = leadsNow.find(L => L.no === firstNo);
  ok('S1 tapping WhatsApp marks the business as messaged', tapped && tapped.sent === true);
  ok('S1b it joins Client Follow-up and today\'s count', (await A.evaluate(id => JSON.parse(localStorage.getItem('mp_follow')).some(f => f.id === id), tapped.id)) && +(await A.textContent('#sentToday')) === before + 1);
  ok('S1c a bar names it and offers undo', !(await A.$eval('#undoBar', e => e.hidden)) && (await A.textContent('#undoTx')).indexOf('#' + firstNo) >= 0);
  shown = await nums(A);
  ok('S1d the list refills to 10 without it', shown.length === 10 && !shown.includes(first));
  await A.click('#undoBtn'); await A.waitForTimeout(400);
  leadsNow = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads);
  ok('S2 undo takes it all back', leadsNow.find(L => L.no === firstNo).sent === false && +(await A.textContent('#sentToday')) === before &&
    !(await A.evaluate(id => JSON.parse(localStorage.getItem('mp_follow')).some(f => f.id === id), tapped.id)) && (await nums(A)).includes(first));
  ok('S2b number unchanged after all this', (await nums(A)).includes('#' + firstNo + firstName));
  // email country: copying the email marks it sent
  await A.selectOption('#country', 'US'); await A.fill('#trade', 'plumber'); await A.fill('#towns', 'Abilene, TX');
  await A.click('#go'); await A.waitForTimeout(3000);
  await A.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  await A.locator('#results .lead').first().locator('[data-a="email"]').click(); await A.waitForTimeout(700);
  leadsNow = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads);
  ok('S3 copying the email marks it sent, with undo', leadsNow.find(L => L.id === 'us1').sent === true && /ای میل بھیج دیا/.test(await A.textContent('#undoTx')));
  // reminder: copying marks it done
  await A.evaluate(() => { document.getElementById('fuBox').open = true; });
  const card = A.locator('#fuList .lead').filter({ hasText: 'InfoTank' });
  await card.locator('[data-a="copy"]').click(); await A.waitForTimeout(700);
  let st = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === 'r1').state);
  ok('S4 copying a reminder marks it sent', st === 'followed' && /Reminder کاپی ہو گئی/.test(await A.textContent('#undoTx')));
  await A.click('#undoBtn'); await A.waitForTimeout(400);
  st = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === 'r1').state);
  ok('S4b undo puts the reminder back', st === 'waiting' && (await A.locator('#fuList .lead').filter({ hasText: 'InfoTank' }).count()) === 1);
  // second device gets the same numbers
  await A.waitForTimeout(3000);
  const aNos = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads.map(L => L.id + '=' + L.no).sort().join(','));
  const B = await mk(); await B.waitForTimeout(800);
  const bNos = await B.evaluate(() => JSON.parse(localStorage.getItem('mp_leads') || '{"leads":[]}').leads.map(L => L.id + '=' + L.no).sort().join(','));
  ok('N4 the laptop shows the same numbers', aNos.length > 0 && aNos === bNos, bNos.slice(0, 60));
  await A.reload(); await A.waitForTimeout(800);
  const aNos2 = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads.map(L => L.id + '=' + L.no).sort().join(','));
  ok('N5 numbers survive closing and reopening', aNos2 === aNos);
  const errs = [...(A.errs || []), ...(B.errs || [])]; ok('N6 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
