// 19 Nov (owner asked): the first WhatsApp message names the 2-3 real problems that cost the business customers
// (one short line each, only problems a shop owner cares about), offers a free detailed check, and keeps the QR card gift.
// New check: a tow truck (name says tow/سطحة) whose main category is "Shipping service" / "Car dealer" gets a "wrong category" point.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now(), rv = (d, r = 5) => ({ publishTime: new Date(now - d * 864e5).toISOString(), rating: r });
  let k = 0;
  const P = (id, name, n, cat, o) => Object.assign({ id, displayName: { text: name }, formattedAddress: 'Al Manar, Dammam 32274, Saudi Arabia', rating: 4.3, userRatingCount: n, websiteUri: '',
    nationalPhoneNumber: '055', internationalPhoneNumber: '+966 55 96' + String(10000 + (k++)), primaryType: 'x', primaryTypeDisplayName: { text: cat },
    businessStatus: 'OPERATIONAL', reviews: [rv(20)], photos: [1, 2, 3, 4, 5, 6], regularOpeningHours: { x: 1 } }, o);
  const SA = [
    P('t1', 'سطحه الدمام', 47, 'Shipping service', { regularOpeningHours: undefined, photos: [1] }),   // wrong category + no hours + few photos
    P('t2', 'سطحة الدمام والخبر هيدروليك', 28, 'Car dealer'),                                         // wrong category
    P('t3', 'Dammam Towing 24', 60, 'Towing service'),                                                // right category
    P('d1', 'Al Majdouie Cars', 30, 'Car dealer'),                                                    // a real car dealer in a tow search: never flagged
    P('big', 'سطحه غرب الدمام', 600, 'Towing service'),                                               // competitor
    P('t5', 'Riyadh Tow Truck Service', 47, 'Shipping service', { regularOpeningHours: undefined, photos: [1] }),   // English name: English message
  ];
  const PK = [P('p1', 'Ali Plumbing Services', 12, 'Hardware store', { formattedAddress: 'Johar Town, Lahore, Pakistan', internationalPhoneNumber: '+92 300 1112233', nationalPhoneNumber: '0300 1112233' })];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) { const q = JSON.parse(r.request().postData()).textQuery; return j({ places: /Lahore/.test(q) ? PK : /garage door/.test(q) ? [P('g1', 'Garage Door Pros', 9, 'Car dealer')] : SA }); }
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
  const search = async (c, trade, town) => {
    await p.selectOption('#country', c); await p.fill('#trade', trade); await p.fill('#towns', town); await p.fill('#runLimit', '1');
    await p.evaluate(() => { const w = document.getElementById('needWeb'); if (w.checked) w.click(); const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
    await p.click('#go'); await p.waitForTimeout(2500);
    if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(150); }
  };
  const card = n => p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: n }) });
  const msg = async n => { const h = await card(n).first().locator('[data-a="wa"]').getAttribute('href'); return new URL(h).searchParams.get('text') || ''; };
  const bullets = t => (t.match(/^• /gm) || []).length;

  await search('SA', 'سطحة', 'Dammam');
  const m1 = await msg('Riyadh Tow Truck');
  ok('P1 wrong category is named with the right one', /main category is "Shipping service", not "Towing service"/.test(m1) && /search for a tow truck/.test(m1), m1.slice(0, 400));
  ok('P2 real problems as short lines, at most 3, wrong category first', bullets(m1) >= 2 && bullets(m1) <= 3 && /^• the main category/m.test(m1.split('\n').find(l => /^• /.test(l))), bullets(m1));
  ok('P3 missing hours named; no "no website" / payment-details noise', /working hours are not on the listing/.test(m1) && !/website link|no website|payment|accessibility/i.test(m1));
  ok('P4 offers a free detailed check and keeps the QR gift and opt-out', /check your whole profile in detail for free/.test(m1) && /free review QR card/.test(m1) && /Shall I send the card\?/.test(m1) && /won't message again/.test(m1) && /Asif, MapPeak Local/.test(m1));
  const m2 = await msg('هيدروليك');
  ok('P5 "Car dealer" tow truck flagged too (Arabic-name business: Arabic message)', /"Car dealer" وليس "Towing service"/.test(m2) && /يدوّر سطحة/.test(m2), m2.slice(0, 300));
  ok('P6 review gap against the real competitor', /عندكم 28 تقييم، و.* قريب منكم عنده \d+، فالزبون يشوفه أول/.test(m2), m2.slice(0, 400));
  // 22 Nov (owner asked): Arab-run business (name only in Arabic letters) gets the first message in Arabic
  const a1 = await msg('سطحه الدمام');
  ok('A1 Arabic name: Arabic message with intro, problems as lines, free check, QR gift, Urdu line, opt-out', /^السلام عليكم/.test(a1) && /أشتغل على صفحات المحلات/.test(a1) && /"Shipping service" وليس "Towing service"/.test(a1) && /أوقات العمل غير مكتوبة/.test(a1) && /أقدر أراجع صفحتكم كاملة مجاناً/.test(a1) && /بطاقة QR/.test(a1) && /تبغى أرسلها لك؟/.test(a1) && /اردو میں بات/.test(a1) && /ما راح أراسلك/.test(a1) && /آصف، MapPeak Local/.test(a1) && /أنا آصف/.test(a1) && bullets(a1) >= 2 && bullets(a1) <= 3, a1.slice(0, 500));
  ok('A2 no English sentences in the Arabic message; two problems read "شيئين"', !/I looked at|Shall I send|cost you customers/.test(a1) && /ولاحظت شيئين/.test(m2));
  const lbl = await card('سطحه الدمام').first().locator('[data-a="urdu"]').textContent();
  ok('A3 the copy button says Arabic, and no second Arabic button', /عربی پیغام/.test(lbl) && (await card('سطحه الدمام').first().locator('[data-a="arab"]').count()) === 0, lbl);
  ok('A4 an English-named Gulf business still gets English, with the Arabic option one tap away', /^Assalamu Alaikum/.test(m1) && (await card('Riyadh Tow Truck').first().locator('[data-a="arab"]').count()) === 1);
  const m3 = await msg('Dammam Towing 24');
  ok('P7 right category: no category point', !/main category/.test(m3));
  const m4 = await msg('Al Majdouie');
  ok('P8 a real car dealer found in a tow search is never told its category is wrong', !/main category/.test(m4));
  ok('P9 the lead card lists the new issue in Urdu', /بنیادی کیٹیگری اس کام کی نہیں/.test(await card('سطحه الدمام').first().textContent()));

  await search('PK', 'plumber', 'Lahore');
  const u1 = await msg('Ali Plumbing');
  ok('P10 Pakistan: Urdu message with the problems as lines, free check, QR gift', /ایک چیز نظر آئی جس سے/.test(u1) && /"Hardware store" لکھی ہے، "Plumber" نہیں/.test(u1) && /پلمبر ڈھونڈتا ہے/.test(u1) && /باریکی سے مفت جانچ/.test(u1) && /کارڈ بھیج دوں؟/.test(u1) && bullets(u1) >= 1, u1.slice(0, 300));

  await search('SA', 'garage door repair', 'Khobar');
  const t = await card('Garage Door Pros').first().textContent();
  ok('P11 garage door searches are not mixed up with car workshops', !/بنیادی کیٹیگری اس کام کی نہیں/.test(t));
  ok('P12 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
