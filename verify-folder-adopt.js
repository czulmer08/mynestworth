/* FOLDER ADOPTION — getNwFolder renames a legacy "NestWorth" Drive folder to "NestBest" (one-time, best-effort) instead of leaving
   it under the old name, WITHOUT ever creating a duplicate or losing the folder on failure. Mocks the Drive api() so the folder-
   discovery/rename branch is exercised deterministically. Invariants: adopt-by-rename only when NO NestBest folder exists (collision-
   safe); an existing NestBest folder is used untouched (no legacy lookup, no rename); neither → create; a failed rename falls back to
   using the legacy folder as-is (nothing lost). */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const src=fs.readFileSync(APP,'utf8');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(src);return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof getNwFolder==='function',{timeout:8000});

  const R=await page.evaluate(async()=>{
    var out={};
    // A scriptable Drive api() mock. present = which folders "exist"; patchFails = rename throws.
    function install(present, patchFails){
      var calls=[];
      window.api=async function(url,opts){
        opts=opts||{}; var method=opts.method||'GET';
        calls.push({url:url,method:method,body:opts.body||null});
        if(/\/files\?q=/.test(url)){                                   // folder search by name
          var nm=decodeURIComponent(url).match(/name='([^']+)'/)[1];
          return {files: present[nm]?[{id:present[nm]}]:[]};
        }
        if(method==='PATCH'){ if(patchFails) throw new Error('rename failed'); return {id:'renamed'}; }
        if(method==='POST'){ return {id:'CREATED_NESTBEST'}; }
        if(/\/files\/[^?]+\?fields=id,trashed/.test(url)) return {trashed:false};
        return {};
      };
      try{localStorage.removeItem('nw_folder_id');}catch(e){}
      return ()=>calls;
    }
    var patchOf=function(calls){return calls.filter(function(c){return c.method==='PATCH';});};
    var searchNames=function(calls){return calls.filter(function(c){return /\/files\?q=/.test(c.url);}).map(function(c){return decodeURIComponent(c.url).match(/name='([^']+)'/)[1];});};

    // S1: legacy NestWorth exists, no NestBest → rename it, return that id
    var g=install({'NestWorth':'NW1'}, false); var id1=await getNwFolder(); var c1=g();
    var p1=patchOf(c1);
    out.s1={id:id1, renamedTo:(p1[0]&&/"name":"NestBest"/.test(p1[0].body))||false, patchedLegacy:(p1[0]&&/files\/NW1\?/.test(p1[0].url))||false, created:c1.some(function(c){return c.method==='POST';})};

    // S2: NestBest already exists → use it, no legacy lookup, no rename
    g=install({'NestBest':'NB1','NestWorth':'NWX'}, false); var id2=await getNwFolder(); var c2=g();
    out.s2={id:id2, searched:searchNames(c2), noPatch:patchOf(c2).length===0, noCreate:!c2.some(function(c){return c.method==='POST';})};

    // S3: neither exists → create NestBest, no rename
    g=install({}, false); var id3=await getNwFolder(); var c3=g();
    out.s3={id:id3, created:c3.some(function(c){return c.method==='POST'&&/"name":"NestBest"/.test(c.body);}), noPatch:patchOf(c3).length===0};

    // S4: legacy exists but rename FAILS → fall back to using it as-is (id returned, no duplicate created)
    g=install({'NestWorth':'NW2'}, true); var id4=await getNwFolder(); var c4=g();
    out.s4={id:id4, attemptedPatch:patchOf(c4).length===1, noCreate:!c4.some(function(c){return c.method==='POST';})};

    // A CACHED nw_folder_id (existing user) — the real-world path v0.68.99 bypassed, so the folder rename never ran live.
    function install5(nameNow){
      var calls=[];
      window.api=async function(url,opts){opts=opts||{};var method=opts.method||'GET';calls.push({url:url,method:method,body:opts.body||null});
        if(/\/files\/CACHED\?fields=id,trashed,name/.test(url))return {id:'CACHED',trashed:false,name:nameNow};
        if(method==='PATCH')return {id:'CACHED'};
        if(/\/files\?q=/.test(url))return {files:[]};
        if(method==='POST')return {id:'CREATED'};
        return {};
      };
      try{localStorage.setItem('nw_folder_id','CACHED');}catch(e){}
      return ()=>calls;
    }
    // S5: cached folder is STILL named "NestWorth" → re-check + PATCH-rename that SAME id in place, no discovery, no create.
    var g5=install5('NestWorth'); var id5=await getNwFolder(); var c5=g5();
    var p5=c5.filter(function(c){return c.method==='PATCH';});
    out.s5={id:id5, patchedSameId:(p5[0]&&/files\/CACHED\?/.test(p5[0].url)&&/"name":"NestBest"/.test(p5[0].body))||false,
      noDiscovery:!c5.some(function(c){return /\/files\?q=/.test(c.url);}), noCreate:!c5.some(function(c){return c.method==='POST';})};
    // S6: cached folder already "NestBest" → no rename, no discovery.
    var g6=install5('NestBest'); var id6=await getNwFolder(); var c6=g6();
    out.s6={id:id6, noPatch:c6.filter(function(c){return c.method==='PATCH';}).length===0, noDiscovery:!c6.some(function(c){return /\/files\?q=/.test(c.url);})};
    return out;
  });

  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});
  ck('legacy NestWorth + no NestBest → rename it to NestBest, return that id, create nothing',
     R.s1.id==='NW1'&&R.s1.renamedTo&&R.s1.patchedLegacy&&!R.s1.created, JSON.stringify(R.s1));
  ck('existing NestBest folder is used untouched — no legacy lookup, no rename, no create',
     R.s2.id==='NB1'&&JSON.stringify(R.s2.searched)===JSON.stringify(['NestBest'])&&R.s2.noPatch&&R.s2.noCreate, JSON.stringify(R.s2));
  ck('neither folder → create a fresh NestBest, no rename',
     R.s3.id==='CREATED_NESTBEST'&&R.s3.created&&R.s3.noPatch, JSON.stringify(R.s3));
  ck('rename failure → fall back to the legacy folder as-is (id kept, no duplicate created)',
     R.s4.id==='NW2'&&R.s4.attemptedPatch&&R.s4.noCreate, JSON.stringify(R.s4));
  ck('CACHED folder id still named NestWorth (existing-user path) → PATCH-rename that same id in place, no discovery, no create',
     R.s5.id==='CACHED'&&R.s5.patchedSameId&&R.s5.noDiscovery&&R.s5.noCreate, JSON.stringify(R.s5));
  ck('CACHED folder id already NestBest → no rename, no discovery (idempotent)',
     R.s6.id==='CACHED'&&R.s6.noPatch&&R.s6.noDiscovery, JSON.stringify(R.s6));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: a legacy NestWorth folder is adopted (renamed) as the NestBest folder exactly once, collision-safe, with a lossless fallback — existing users end up with a correctly-named folder and never a duplicate.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();
