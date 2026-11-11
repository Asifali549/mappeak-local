// 11 Nov (owner approved): "ریویو کیو آر کارڈ" on each lead card makes a printable review QR card (a free gift for the business).
// The QR code is made inside the tool (no outside code). Checked here by decoding it with OpenCV (python3 + cv2).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-'));
  const decode = file => { try { return execFileSync('python3', ['-I', '-c',
    'import sys,cv2\nimg=cv2.imread(sys.argv[1])\nd=cv2.QRCodeDetector()\nv,p,_=d.detectAndDecode(img)\nprint(v)', file]).toString().trim(); } catch (e) { return 'ERR ' + e.message.slice(0, 80); } };
  // 1) the encoder itself, many lengths (QR versions 1 to 10)
  const src = fs.readFileSync(path.join(__dirname, '..', 'finder.html'), 'utf8');
  const qrSrc = (src.match(/var QR = \(function\(\)\{[\s\S]*?\n\}\)\(\);/) || [''])[0];
  const QR = new Function(qrSrc + '\nreturn QR;')();
  const b = await chromium.launch(); const pg = await b.newPage();
  const texts = ['hi', 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4', 'x'.repeat(60), 'Ünïcode ✓ اردو', 'y'.repeat(120), 'z'.repeat(200)];
  let good = 0, bad = [];
  for (const t of texts) {
    const M = QR.encode(t), n = M.length, cell = 8, q = (n + 8) * cell;
    const png = await pg.evaluate(({ M, n, cell, q }) => { const c = document.createElement('canvas'); c.width = c.height = q; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, q, q); g.fillStyle = '#000';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (M[y][x]) g.fillRect((x + 4) * cell, (y + 4) * cell, cell, cell); return c.toDataURL('image/png').split(',')[1]; }, { M, n, cell, q });
    const f = path.join(tmp, 'm' + good + bad.length + '.png'); fs.writeFileSync(f, Buffer.from(png, 'base64'));
    const out = decode(f); if (out === t) good++; else bad.push(t.slice(0, 12) + ' -> ' + out.slice(0, 30) + ' (size ' + n + ')');
  }
  ok('Q1 the QR code reads back exactly, short to long text (versions 1-10)', good === texts.length, bad.join(' | '));
  let threw = false; try { QR.encode('w'.repeat(400)); } catch (e) { threw = true; }
  ok('Q2 text too long for a card: clear error, no broken code', threw);

  // 2) the button on a lead card
  const placeId = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }];
  const P = (id, name) => ({ id, displayName: { text: name }, formattedAddress: 'Al Quoz - Dubai - United Arab Emirates', rating: 3.9, userRatingCount: 12, websiteUri: '',
    nationalPhoneNumber: '050', internationalPhoneNumber: '+971 50 555 12' + name.length, primaryType: 'restaurant', primaryTypeDisplayName: { text: 'Pakistani restaurant' }, businessStatus: 'OPERATIONAL', reviews: recent });
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 }, acceptDownloads: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) return j({ places: [P(placeId, 'Lahori <b>Karahi</b> House'), Object.assign(P('short', 'No Id Grill'), { primaryTypeDisplayName: { text: 'Restaurant' } })] });
    if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
    if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
    if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
    if (/rdap|webrisk/.test(u)) return j({});
    return r.abort();
  });
  const p = await ctx.newPage(); const errs = []; let alerted = false; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { if (d.type() === 'alert') alerted = true; d.accept(); });
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; });
  await p.click('#saveSet'); await p.waitForTimeout(400);
  await p.selectOption('#country', 'AE'); await p.fill('#trade', 'restaurant'); await p.fill('#towns', 'Dubai'); await p.fill('#runLimit', '1');
  await p.click('#go'); await p.waitForTimeout(2500);
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  if (await p.$('#showAll')) await p.click('#showAll');
  const card = n => p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: n }) });
  ok('Q3 the button shows only when Google gave a real place id', (await card('Lahori').locator('[data-a="qr"]').count()) === 1 && (await card('No Id').locator('[data-a="qr"]').count()) === 0);
  await card('Lahori').locator('[data-a="qr"]').click(); await p.waitForTimeout(800);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.ov a[download]')]);
  const f = path.join(tmp, 'card.png'); await dl.saveAs(f);
  const got = decode(f);
  ok('Q4 the downloaded card opens the business\'s own Google review page', got === 'https://search.google.com/local/writereview?placeid=' + placeId, got);
  ok('Q5 file name is safe and readable', /^Review_QR_Lahori_b_Karahi_b_House\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  await p.locator('.ov [data-a="close"]').click();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await card('Lahori').locator('[data-a="urdu"]').click(); await p.waitForTimeout(200);
  const ur = await p.evaluate(() => navigator.clipboard.readText());
  await card('No Id').locator('[data-a="urdu"]').click(); await p.waitForTimeout(200);
  const en = await p.evaluate(() => navigator.clipboard.readText());
  ok('Q7 first WhatsApp message offers the free QR card (Urdu-speaking shop in Urdu, others in English)', /کیو آر کارڈ مفت/.test(ur) && /کارڈ بھیج دوں؟/.test(ur) && /گوگل بزنس پروفائل/.test(ur) && /تحفے کے طور پر/.test(ur) && /free review QR card/.test(en) && /work on Google Business Profiles/.test(en) && /only if you want/.test(en) && /won't message again/.test(en), ur.slice(0, 40) + ' / ' + en.slice(0, 40));
  ok('Q6 a name with page code stays text; no page errors', !alerted && !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
