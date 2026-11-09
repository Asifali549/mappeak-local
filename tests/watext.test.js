// "واٹس ایپ کھولیں" opens the chat with the business's own message already typed (9 Nov, owner asked):
// the same text as the card's main copy button - Urdu for Urdu-speaking businesses, English for the others, Urdu for Pakistan.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }];
  const P = (id, name, intl, addr, type) => ({ id, displayName: { text: name }, formattedAddress: addr, rating: 3.9, userRatingCount: 12, websiteUri: '',
    nationalPhoneNumber: '050 000 0000', internationalPhoneNumber: intl, primaryType: 'restaurant', primaryTypeDisplayName: { text: type }, businessStatus: 'OPERATIONAL', reviews: recent });
  const AE = 'Al Muqta - Umm Al Quwain - United Arab Emirates';
  const placesFor = q => /Multan/.test(q)
    ? [P('pk1', 'Madina Karahi', '+92 300 1234567', 'Hussain Agahi, Multan, Pakistan', 'Restaurant')]
    : [P('ae1', 'Lahori Karahi House', '+971 50 111 2210', AE, 'Pakistani restaurant'),
       P('ae2', 'Golden Fork Bistro', '+971 55 000 1111', AE, 'Restaurant'),
       P('ae3', 'Evil & Co ?x=1#y "quote"', '+971 56 222 3333', AE, 'Pakistani restaurant')];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const opened = [];
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) return j({ places: placesFor(JSON.parse(r.request().postData()).textQuery) });
    if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
    if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.5 } }, audits: { 'network-requests': { details: { items: [] } } } } });
    if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
    if (/rdap|webrisk/.test(u)) return j({});
    if (/wa\.me/.test(u)) opened.push(u);
    return r.abort();
  });
  const p = await ctx.newPage();
  ctx.on('page', pg => setTimeout(() => pg.close().catch(() => {}), 300));   // WhatsApp tabs (attached after the main page)
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; document.getElementById('myName').value = 'Asif'; });
  await p.click('#saveSet'); await p.waitForTimeout(400);
  await p.selectOption('#country', 'AE'); await p.fill('#trade', 'Pakistani restaurant'); await p.fill('#towns', 'Umm Al Quwain'); await p.fill('#runLimit', '1');
  await p.click('#go'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  const card = name => p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: name }) });
  const linkText = async name => {
    const href = await card(name).locator('[data-a="wa"]').getAttribute('href');
    const u = new URL(href); return { href, num: u.pathname, host: u.host, text: u.searchParams.get('text') || '' };
  };
  const copied = async name => { await card(name).locator('[data-a="urdu"]').click(); await p.waitForTimeout(150); return p.evaluate(() => navigator.clipboard.readText()); };
  let L = await linkText('Lahori Karahi');
  const cU = await copied('Lahori Karahi');
  ok('W1 Urdu-speaking UAE business: link carries the Urdu message', L.host === 'wa.me' && L.num === '/971501112210' && L.text === cU && /[؀-ۿ]/.test(L.text) && /Lahori Karahi/.test(L.text), L.text.slice(0, 60));
  L = await linkText('Golden Fork');
  const cE = await copied('Golden Fork');
  ok('W2 other UAE business: link carries the English message', L.text === cE && /^Hello,/.test(L.text) && /Golden Fork Bistro/.test(L.text), L.text.slice(0, 40));
  L = await linkText('Evil');
  ok('W3 symbols in a name stay inside the message (no extra link parts)', L.host === 'wa.me' && L.num === '/971562223333' && /Evil & Co \?x=1#y "quote"/.test(L.text) && L.href.indexOf('#') < 0);
  // tapping opens WhatsApp with the text and still marks it sent
  await card('Golden Fork').locator('[data-a="wa"]').click(); await p.waitForTimeout(800);
  ok('W4 the tap opens WhatsApp with that text', opened.some(u => decodeURIComponent(new URL(u).searchParams.get('text') || '') === cE || new URL(u).searchParams.get('text') === cE), opened.length);
  ok('W4b and still marks the business as messaged', (await p.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads.find(l => l.id === 'ae2').sent)) === true);
  // Pakistan: Urdu message
  await p.selectOption('#country', 'PK'); await p.fill('#trade', 'restaurant'); await p.fill('#towns', 'Multan'); await p.click('#go'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  L = await linkText('Madina Karahi');
  const cP = await copied('Madina Karahi');
  ok('W5 Pakistan: link carries the Urdu message', L.text === cP && /[؀-ۿ]/.test(L.text) && L.num === '/923001234567', L.num + ' ' + L.text.slice(0, 30));
  ok('W6 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
