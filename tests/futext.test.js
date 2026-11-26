// 26 Nov (owner asked): "Reminder کاپی کریں" copies a reminder that matches the first message's offer (free check + review QR card)
// in the lead's language: Arabic-named Gulf shops in Arabic, Urdu-speaking Gulf and Pakistan in Urdu, other Gulf in English;
// forum leads (manual cards) get a short note about their posted issue; email reminders are unchanged.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const NOW = new Date('2026-11-26T11:00:00Z').getTime(), D = 864e5;   // Thursday: a working day in Saudi, UAE and Pakistan
  const W = (id, n, c, o) => Object.assign({ id, n, c, phone: '055 000 00' + id.slice(-2), at: NOW - 5 * D, state: 'waiting' }, o);
  const seed = [
    W('ChIJa1', 'بنشر متنقل', 'SA'),
    W('ChIJa2', 'Riyadh Tyre Service', 'SA'),
    W('ChIJa3', 'Mehran Pakistani Restaurant', 'SA', { urd: true }),
    W('ChIJa4', 'Sun Solar Energy', 'PK', { phone: '0309 9899655' }),
    W('m_pw', 'PowerX Car Care Dammam', 'SA', { manual: true, contact: '+966 59 721 8485', phone: '+966 59 721 8485' }),
    W('m_bs', 'Bolt Solar Co.', 'PK', { manual: true, contact: '+92 310 5808205', phone: '+92 310 5808205' }),
    W('ChIJa7', 'Key City Septic', 'US', { contact: 'x@example.com', w: '', subj: 'Quick question about Key City Septic on Google Maps', first: 'Your listing has no recent reviews.' }),
  ];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.clock.install({ time: NOW });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(seed));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(800);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('myName').value = 'Muhammad Asif Raza'; });
  await p.click('#saveSet'); await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById('fuBox').open = true; });
  const txt = async n => {
    await p.evaluate(n => { const c = [...document.querySelectorAll('#fuList .lead')].find(l => l.querySelector('.name').textContent.includes(n)); c.querySelector('[data-a="copy"]').click(); }, n);
    await p.waitForTimeout(500); return p.evaluate(() => navigator.clipboard.readText());
  };
  const ar = await txt('بنشر متنقل');
  ok('T1 Arabic-named Saudi shop: Arabic reminder with the QR offer, question, opt-out and آصف', /^السلام عليكم، أرسلت لكم رسالة/.test(ar) && /بطاقة QR باسم محلكم/.test(ar) && /تبغى أرسلها لك؟/.test(ar) && /ما راح أراسلك/.test(ar) && /آصف، MapPeak Local$/.test(ar) && !/[A-Za-z]{3,}/.test(ar.replace('MapPeak Local', '').replace('QR', '')), ar);
  const en = await txt('Riyadh Tyre');
  ok('T2 English-named Gulf shop: English reminder with the same offer (no "fix one issue for free")', /free check of your whole profile/.test(en) && /review QR card/.test(en) && /Shall I send it\?/.test(en) && !/fix one issue/.test(en) && /Muhammad Asif Raza here/.test(en), en);
  const ur = await txt('Mehran');
  ok('T3 Urdu-speaking Gulf shop: Urdu reminder with the QR offer', /^السلام علیکم/.test(ur) && /کیو آر کارڈ مفت/.test(ur) && /کارڈ بھیج دوں؟/.test(ur) && /دوبارہ پیغام نہیں کروں گا/.test(ur), ur);
  const pk = await txt('Sun Solar');
  ok("T4 Pakistan: Urdu reminder signed in Urdu", /کارڈ بھیج دوں؟/.test(pk) && /Sun Solar Energy/.test(pk) && /محمد آصف رضا، MapPeak Local$/.test(pk), pk);
  const pw = await txt('PowerX');
  ok('T5 forum lead in the Gulf: short English note about their posted issue, no QR card', /issue you posted in the Google community/.test(pw) && !/QR/.test(pw), pw);
  const bs = await txt('Bolt Solar');
  ok('T6 forum lead in Pakistan: short Urdu note about their post', /گوگل کمیونٹی والی آپ کی پوسٹ/.test(bs) && !/کیو آر/.test(bs), bs);
  const em = await txt('Key City');
  ok('T7 email reminder unchanged (greeting, no subject, follow-up wording)', /^Hi Key City Septic team,/.test(em) && /Just following up on my note/.test(em));
  ok('T8 copying still marks the reminder as sent', await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).filter(f => f.state === 'followed').length === 7));
  ok('T9 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
