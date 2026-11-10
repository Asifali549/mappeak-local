// Canada and Australia span several time zones: reminder cards show the Pakistan send time for both sides (10 Nov: a BC business got the Toronto time).
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res=[]; const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
  const ctx = await b.newContext({viewport:{width:400,height:900}}); await ctx.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  await ctx.clock.install({ time: new Date('2026-11-10T07:00:00Z') });   // Tuesday 12:00 PKT (US/Canada on winter time, Sydney on summer time)
  const old = new Date('2026-11-03T07:00:00Z').getTime();
  await ctx.addInitScript(o=>{ if(!localStorage.getItem('seeded')){ localStorage.setItem('mp_follow', JSON.stringify([
    {id:'c',n:'Lake Country Pets (Ellen)',c:'CA',contact:'hello@example.ca',at:o,la:o,state:'waiting',manual:true},
    {id:'a',n:'Perth Plumbing',c:'AU',contact:'info@example.com.au',at:o,la:o,state:'waiting',manual:true},
    {id:'u',n:'Pizzazz',c:'US',contact:'info@example.com',at:o,la:o,state:'waiting',manual:true},
    {id:'g',n:'Cakery',c:'GB',contact:'hi@example.co.uk',at:o,la:o,state:'waiting',manual:true}])); localStorage.setItem('seeded','1'); } }, old);
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(700); await p.evaluate(()=>document.getElementById('fuBox').open=true);
  const pills = async n => (await p.locator('#fuList .lead',{hasText:n}).locator('.pill').allTextContents()).join(' | ');
  const ca = await pills('Lake Country'), au = await pills('Perth'), us = await pills('Pizzazz'), gb = await pills('Cakery');
  ok('Z1 Canada: east 7 PM and British Columbia 10 PM', /مشرقی کینیڈا شام سات بجے/.test(ca) && /برٹش کولمبیا رات دس بجے/.test(ca), ca);
  ok('Z2 Australia: east 3 AM and west 6 AM PKT', /مشرقی آسٹریلیا رات تین بجے/.test(au) && /مغربی آسٹریلیا صبح چھ بجے/.test(au), au);
  ok('Z3 US unchanged', /مشرقی امریکہ شام سات بجے/.test(us) && /کیلیفورنیا رات دس بجے/.test(us), us);
  ok('Z4 single-zone country unchanged', /وقت: دوپہر دو بجے/.test(gb) && !/مشرقی/.test(gb), gb);
  ok('Z5 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
