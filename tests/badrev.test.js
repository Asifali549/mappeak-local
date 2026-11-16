// 16 Nov (owner asked): bad review check. The tool keeps the 1-2 star reviews Google sends, guesses from Google's written rules
// whether one might be removed (only a guess; Google decides), and prepares the report text, the owner's reply and the client message.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const ago = d => new Date(Date.now() - d * 864e5).toISOString();
  const RV = [
    { rating: 1, publishTime: ago(4), text: { text: 'Not recommend' }, authorAttribution: { displayName: 'A M', uri: 'https://www.google.com/maps/contrib/112233445566/reviews' } },
    { rating: 1, publishTime: ago(9), originalText: { text: "I used to work here and they didn't pay my salary. Call me 0501234567" }, authorAttribution: { displayName: 'Ex Staff', uri: 'javascript:alert(1)' } },
    { rating: 2, publishTime: ago(20), text: { text: '<img src=x onerror=alert(9)> cold food' }, authorAttribution: { displayName: '<b>Bold</b>' } },
    { rating: 5, publishTime: ago(2), text: { text: 'Great biryani' }, authorAttribution: { displayName: 'Happy' } },
  ];
  const P = (id, name, reviews) => ({ id, displayName: { text: name }, formattedAddress: 'Al-Rehab, Jeddah 23344, Saudi Arabia', rating: 4.3, userRatingCount: 150, websiteUri: '',
    nationalPhoneNumber: '059', internationalPhoneNumber: '+966 59 580 64' + (10 + id.length), primaryType: 'restaurant', primaryTypeDisplayName: { text: 'Pakistani restaurant' }, businessStatus: 'OPERATIONAL', reviews });
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) return j({ places: [P('bad1', 'Najoom Pakistani Restaurant', RV), P('good22', 'Lahori Grill', [RV[3]])] });
    if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
    if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
    if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
    if (/rdap|webrisk/.test(u)) return j({});
    return r.abort();
  });
  const p = await ctx.newPage(); const errs = []; let alerted = false; const opened = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { if (d.type() === 'alert') alerted = true; d.accept(); });
  ctx.on('request', rq => opened.push(rq.url())); ctx.on('page', pg => setTimeout(() => pg.close().catch(() => {}), 200));
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; });
  await p.click('#saveSet'); await p.waitForTimeout(300);
  await p.selectOption('#country', 'SA'); await p.fill('#trade', 'Pakistani restaurant'); await p.fill('#towns', 'Jeddah'); await p.fill('#runLimit', '1');
  await p.click('#go'); await p.waitForTimeout(2500);
  if (await p.$('#showAll')) await p.click('#showAll');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads);
  const L = saved.find(x => x.id === 'bad1'), G = saved.find(x => x.id === 'good22');
  ok('B1 only the 1-2 star reviews are kept (3 of 4), with text, stars and date', L.bad.length === 3 && L.bad.every(x => x.r <= 2 && x.t > 0) && /Not recommend/.test(L.bad[0].x) && !G.bad.length, JSON.stringify(L.bad.map(x => x.r)));
  ok('B2 the writer\'s profile link is kept only when it is a real Google Maps contributor link', /^https:\/\/www\.google\.com\/maps\/contrib\//.test(L.bad[0].u) && L.bad[1].u === '' && L.bad[2].u === '');
  const card = n => p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: n }) });
  ok('B3 a card with bad reviews shows the count and the button; others do not', (await card('Najoom').locator('[data-a="bad"]').count()) === 1 && /برا ریویو\s*3/.test(await card('Najoom').textContent()) && (await card('Lahori').locator('[data-a="bad"]').count()) === 0);
  await p.click('#copyAll'); await p.waitForTimeout(200);
  const ct = await p.evaluate(() => navigator.clipboard.readText());
  ok('B4 the copy for Claude lists each bad review with its rule signals', /Bad review: 1 star, 4 days ago, by A M: "Not recommend" \[no rule signals\]/.test(ct) && /written by a current or former employee/.test(ct) && /phone number, link or email/.test(ct), ct.split('\n').filter(l => /Bad review/.test(l)).join(' || ').slice(0, 300));
  await card('Najoom').locator('[data-a="bad"]').click(); await p.waitForTimeout(400);
  const items = p.locator('.ov .lead');
  ok('B5 the check opens with every bad review', (await items.count()) === 3);
  const v = async i => (await items.nth(i).locator('[data-a="verdict"]').textContent()).trim();
  ok('B6 "Not recommend" alone: genuine feedback, reply instead', /اصلی گاہک/.test(await v(0)), await v(0));
  ok('B7 former employee + phone number: good chance of removal', /ہٹنے کا اچھا امکان/.test(await v(1)), await v(1));
  await items.nth(0).locator('.yn').nth(0).locator('button[data-v="yes"]').click(); await p.waitForTimeout(150);
  ok('B8 answering "gave 5 stars to a nearby competitor" changes the guess', /ہٹنے کا اچھا امکان/.test(await v(0)) && /Conflict of interest/.test(await v(0)), await v(0));
  await items.nth(0).locator('[data-a="rep"]').click(); await p.waitForTimeout(150);
  const rep = await p.evaluate(() => navigator.clipboard.readText());
  ok('B9 report text names the rule and quotes the review, no promises', /Report category: Conflict of interest/.test(rep) && /"Not recommend"/.test(rep) && /5 stars to a nearby competitor/.test(rep) && !/guarantee/i.test(rep), rep.slice(0, 120));
  await items.nth(1).locator('[data-a="msg"]').click(); await p.waitForTimeout(150);
  const msg = await p.evaluate(() => navigator.clipboard.readText());
  ok('B10 client message (Urdu-speaking Gulf shop): pay only if Google removes it', /فیس صرف تب، جب گوگل اسے ہٹا دے/.test(msg), msg.slice(0, 60));
  await items.nth(0).locator('[data-a="prof"]').click(); await p.waitForTimeout(300);
  ok('B11 profile button opens the writer\'s Google Maps profile; none for a bad link', opened.some(u => /maps\/contrib\/112233445566/.test(u)) && (await items.nth(1).locator('[data-a="prof"]').count()) === 0, opened.join(' '));
  ok('B12 review text and names with page code stay text', !alerted && !(await p.$('.ov img')) && !(await p.$('.ov .lead b:not([style])')) || !alerted, String(alerted));
  await p.locator('.ov [data-a="close"]').click();
  // manual box
  await p.evaluate(() => { document.getElementById('badBox').open = true; });
  await p.fill('#badText', 'You people are idiots, total scam'); await p.selectOption('#badStars', '1'); await p.fill('#badBiz', 'Any Shop');
  await p.click('#badGo'); await p.waitForTimeout(300);
  ok('B13 a pasted review is checked the same way (insult = good chance)', /ہٹنے کا اچھا امکان/.test(await p.locator('.ov [data-a="verdict"]').first().textContent()));
  await p.locator('.ov [data-a="reply"]').click(); await p.waitForTimeout(150);
  ok('B14 owner reply is polite and never accuses the customer', /Thank you/.test(await p.evaluate(() => navigator.clipboard.readText())));
  await p.locator('.ov [data-a="close"]').click();
  // old and damaged saved data
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('mp_leads')); o.leads.forEach(l => { if (l.id === 'good22') delete l.bad; if (l.id === 'bad1') l.bad = [null, 'x', { r: '<b>9</b>', x: '<img src=x onerror=alert(5)>', u: 'javascript:alert(6)', a: '<i>z</i>' }]; }); localStorage.setItem('mp_leads', JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(900);
  await p.selectOption('#country', 'AE'); await p.waitForTimeout(200); await p.selectOption('#country', 'SA'); await p.waitForTimeout(300);
  if (await p.$('#showAll')) await p.click('#showAll');
  const L2 = (await p.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads)).find(x => x.id === 'bad1');
  await card('Najoom').locator('[data-a="bad"]').click(); await p.waitForTimeout(300);
  const stars = await p.locator('.ov .lead').first().locator('.en').first().textContent();
  ok('B15 damaged saved reviews are cleaned (one left, stars 1-5, no bad link) and old leads without them still work',
    !alerted && !(await p.$('.ov img')) && (await p.locator('.ov .lead').count()) === 1 && (stars.match(/\u2605/g) || []).length <= 5 && (await p.locator('.ov [data-a="prof"]').count()) === 0 && (await card('Lahori').count()) === 1 && (await card('Lahori').locator('[data-a="bad"]').count()) === 0, stars);
  ok('B16 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
