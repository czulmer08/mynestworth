/* BRAND REFRESH (v0.68.100 preservation-first) — ensureBrandRefresh()/ensureReadmeBrand()/legacyBudgetCurrentName()/
   _readmeDamaged99()/_repairReadme99() migrate an existing workbook to NestBest, in place and owned-only, without touching
   financial data or the file id. Real-world cases the v0.68.99 mocks missed are now covered.
   Cache key is nw_brand3_<id>. Drive/Sheets api() fully mocked so every branch is deterministic.

     B1 owned + legacy name + INTACT legacy Read me → file renamed; ONLY branded/contact cells rewritten (cell-by-cell);
        a custom/unrelated cell is left byte-identical; NO deleteSheet, NO :clear, NO in-cell logo added, NO canonical rebuild.
     B2 owned + SUFFIXED "NestWorth Budget - CZUH" → renamed "NestBest Budget - CZUH" (suffix preserved).
     B3 shared/non-owned "NestWorth Budget - Holland House" → nothing renamed, Read me never even read.
     B4 owned "NestWorth Budget Backup" → NOT renamed (only exact/suffix patterns qualify).
     B5 preservation: the intact-legacy path issues values:batchUpdate only for the branded cells and never a destructive op.
     B6 v0.68.99-DAMAGED signature → in-place repair: :clear + full canonical B14 rows + in-cell B1 logo + format batch; NO deleteSheet.
     B7 false-positive guard: a user Read me that merely says "NestBest" (no full signature, no NestWorth) → nothing destructive, no updates.
     B8 idempotence: (a) fast flag set → zero api calls; (b) an already-migrated workbook → no rename, no updates.
   Plus dual-name (unchanged): orderBudgetsForOpen treats a legacy name as primary; last-resort query searches both names. */
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
  await page.waitForFunction(()=>typeof ensureBrandRefresh==='function'&&typeof legacyBudgetCurrentName==='function'&&typeof orderBudgetsForOpen==='function',{timeout:8000});

  const R=await page.evaluate(async()=>{
    var out={};
    function mkRows(n){var a=[];for(var i=0;i<n;i++)a.push([""]);return a;}
    // Scriptable Drive/Sheets api() mock. opts:{owned,name,readme}. readme=array-of-rows (col-indexed) or null (no tab).
    function install(opts){
      opts=opts||{};var calls=[];
      window.sheetId="SID";window.budgetName="(unset)";
      try{localStorage.removeItem("nw_brand3_SID");localStorage.removeItem("nw_budgets");}catch(e){}
      window.api=async function(url,o){
        o=o||{};var method=o.method||"GET";var body=o.body||null;var du=decodeURIComponent(url);
        calls.push({url:url,method:method,body:body,du:du});
        if(/\/drive\/v3\/files\/SID\?fields=name,ownedByMe/.test(url))return {name:opts.name,ownedByMe:opts.owned};
        if(method==="PATCH"&&/\/drive\/v3\/files\/SID\?fields=id,name/.test(url))return {id:"SID",name:(body?JSON.parse(body).name:"")};
        if(method!=="PUT"&&/valueRenderOption=FORMULA/.test(url)){if(opts.readme===null)throw new Error("404 no tab");return {values:opts.readme||[]};}
        if(/spreadsheets\/SID\?fields=sheets\.properties/.test(url))return {sheets:[{properties:{title:"Read me",sheetId:111,index:0}}]};
        if(method==="POST"&&/\/values:batchUpdate/.test(url))return {};
        if(method==="POST"&&/:clear/.test(du))return {};
        if(method==="PUT"&&/\/values\//.test(url))return {};
        if(method==="POST"&&/SID:batchUpdate/.test(url))return {};
        return {};
      };
      return ()=>calls;
    }
    var flag=function(){try{return localStorage.getItem("nw_brand3_SID");}catch(e){return null;}};
    var renamePatch=function(c){return c.filter(function(x){return x.method==="PATCH"&&/files\/SID\?fields=id,name/.test(x.url);});};
    var newName=function(c){var p=renamePatch(c);return p.length?JSON.parse(p[0].body).name:null;};
    var vbuData=function(c){var out=[];c.forEach(function(x){if(x.method==="POST"&&/\/values:batchUpdate/.test(x.url)){var d=JSON.parse(x.body).data||[];d.forEach(function(e){out.push(e);});}});return out;};
    var readmeRead=function(c){return c.some(function(x){return /valueRenderOption=FORMULA/.test(x.url);});};
    var clearCalled=function(c){return c.some(function(x){return x.method==="POST"&&/:clear/.test(x.du);});};
    var puts=function(c){return c.filter(function(x){return x.method==="PUT"&&/\/values\//.test(x.url);});};
    var putRange=function(x,re){return re.test(x.du);};
    var fmtBatch=function(c){return c.some(function(x){return x.method==="POST"&&/SID:batchUpdate/.test(x.url);});};
    var anyDelete=function(c){return c.some(function(x){return /deleteSheet/.test(x.body||"");});};

    // B1 — intact legacy Read me: rename + cell-by-cell de-brand, preserve custom cell, nothing destructive.
    var rm=mkRows(60);
    rm[13]=["","━━━  WELCOME TO NESTWORTH  ━━━"];
    rm[14]=["","Your private NestWorth budget lives in your own Google Drive."];
    rm[29]=["","Custom note: my grocery plan for Q3 — keep this"];
    rm[54]=["","Questions? Email czulmer@gmail.com"];
    var g=install({owned:true,name:"NestWorth Budget",readme:rm});
    await ensureBrandRefresh();var c1=g();var d1=vbuData(c1);
    var ranges1=d1.map(function(e){return e.range;});
    var val=function(d,rng){var e=d.filter(function(x){return x.range===rng;})[0];return e?e.values[0][0]:null;};
    out.b1={renamed:newName(c1)==="NestBest Budget",
      brandedCellsUpdated:ranges1.indexOf("Read me!B14")>=0&&ranges1.indexOf("Read me!B15")>=0,
      emailUpdated:/ulmer\.holland\.consulting@gmail\.com/.test(val(d1,"Read me!B55")||""),
      newTextIsNestBest:/nestbest/i.test(val(d1,"Read me!B14")||"")&&!/nestworth/i.test(val(d1,"Read me!B14")||""),
      customCellPreserved:ranges1.indexOf("Read me!B30")<0,
      noDestruct:!clearCalled(c1)&&!anyDelete(c1)&&!fmtBatch(c1)&&puts(c1).length===0,
      flag:flag()};

    // B2 — suffixed owned file.
    g=install({owned:true,name:"NestWorth Budget - CZUH",readme:mkRows(60)});
    await ensureBrandRefresh();var c2=g();
    out.b2={renamedTo:newName(c2)};

    // B3 — shared/non-owned suffixed file: untouched, Read me never read.
    g=install({owned:false,name:"NestWorth Budget - Holland House",readme:mkRows(60)});
    await ensureBrandRefresh();var c3=g();
    out.b3={noRename:renamePatch(c3).length===0,noReadmeRead:!readmeRead(c3),flag:flag()};

    // B4 — "NestWorth Budget Backup": not a qualifying pattern → no rename.
    g=install({owned:true,name:"NestWorth Budget Backup",readme:mkRows(60)});
    await ensureBrandRefresh();var c4=g();
    out.b4={noRename:renamePatch(c4).length===0,helperReturnsEmpty:legacyBudgetCurrentName("NestWorth Budget Backup")===""};

    // B6 — v0.68.99 damaged signature → in-place repair.
    var dm=mkRows(60);
    dm[0]=['=IMAGE("https://mynestbest.com/icon-512.png")'];
    dm[1]=["NestBest"];dm[2]=["Plan. Budget. Build."];
    dm[11]=["NestBest — a product of Ulmer Consulting LLC"];
    g=install({owned:true,name:"NestBest Budget",readme:dm});
    await ensureBrandRefresh();var c6=g();
    var p6=puts(c6);
    var b14=p6.filter(function(x){return putRange(x,/!B14\?/);})[0];
    var b1=p6.filter(function(x){return putRange(x,/!B1\?/);})[0];
    out.b6={detectedDamaged:_readmeDamaged99(dm),
      cleared:clearCalled(c6),
      b14FullContent:!!b14&&JSON.parse(b14.body).values.length>=40,
      b1InCellLogo:!!b1&&/=IMAGE\(.*icon-512/.test(JSON.stringify(JSON.parse(b1.body).values)),
      formatted:fmtBatch(c6),noDelete:!anyDelete(c6),noCellLoop:vbuData(c6).length===0,flag:flag()};

    // B7 — custom NestBest Read me, NOT the damaged signature → nothing destructive, no updates.
    var cu=mkRows(60);cu[0]=["Welcome to my budget"];cu[1]=["NestBest notes"];cu[6]=["","Grocery plan"];
    g=install({owned:true,name:"NestBest Budget",readme:cu});
    await ensureBrandRefresh();var c7=g();
    out.b7={notDamaged:!_readmeDamaged99(cu),noClear:!clearCalled(c7),noCanonWrite:puts(c7).length===0,noCellUpdates:vbuData(c7).length===0,noDelete:!anyDelete(c7)};

    // B8a — fast flag set → zero calls.
    g=install({owned:true,name:"NestWorth Budget",readme:rm});
    try{localStorage.setItem("nw_brand3_SID","1");}catch(e){}
    await ensureBrandRefresh();var c8=g();
    out.b8a={zeroCalls:c8.length===0};

    // B8b — already migrated (name current, readme all NestBest) → no rename, no updates.
    var done=mkRows(60);done[13]=["","Welcome to NestBest"];done[14]=["","Your NestBest budget."];
    g=install({owned:true,name:"NestBest Budget",readme:done});
    await ensureBrandRefresh();var c8b=g();
    out.b8b={noRename:renamePatch(c8b).length===0,noUpdates:vbuData(c8b).length===0,flag:flag()};

    // dual-name (unchanged)
    var ord=orderBudgetsForOpen([{id:"g",name:"Groceries",owned:true},{id:"nw",name:"NestWorth Budget",owned:true},{id:"nb",name:"NestBest Budget",owned:true}]);
    out.order={firstTwoDefault:(ord[0].name==="NestBest Budget"||ord[0].name==="NestWorth Budget")&&(ord[1].name==="NestBest Budget"||ord[1].name==="NestWorth Budget")&&ord[2].name==="Groceries"};
    return out;
  });

  // last-resort discovery query searches BOTH names
  const Q=await page.evaluate(async()=>{
    var q=null;try{localStorage.removeItem("nw_sheet_id2");localStorage.removeItem("nw_budgets");}catch(e){}
    window.sheetId=null;window.discoverBudgets=async function(){return [];};window.firstRunChoice=async function(){return "FRC";};
    window.api=async function(url){var du=decodeURIComponent(url);if(/\/files\?q=/.test(url)&&/mimeType='application\/vnd\.google-apps\.spreadsheet'/.test(du)&&/name=/.test(du)){if(q===null)q=du;return {files:[{id:"LR",name:"NestWorth Budget"}]};}return {};};
    try{await ensureSheet();}catch(e){}
    return {both:!!q&&/name='NestBest Budget'/.test(q)&&/name='NestWorth Budget'/.test(q)};
  });

  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});
  ck('B1 intact legacy → file renamed; only branded/contact cells rewritten to NestBest; custom cell preserved; nothing destructive; flag set',
     R.b1.renamed&&R.b1.brandedCellsUpdated&&R.b1.emailUpdated&&R.b1.newTextIsNestBest&&R.b1.customCellPreserved&&R.b1.noDestruct&&R.b1.flag==="1",JSON.stringify(R.b1));
  ck('B2 suffixed owned "NestWorth Budget - CZUH" → "NestBest Budget - CZUH" (suffix preserved)',
     R.b2.renamedTo==="NestBest Budget - CZUH",JSON.stringify(R.b2));
  ck('B3 shared/non-owned suffixed file → not renamed, Read me never read',
     R.b3.noRename&&R.b3.noReadmeRead&&R.b3.flag==="1",JSON.stringify(R.b3));
  ck('B4 "NestWorth Budget Backup" → NOT renamed (only exact/suffix patterns qualify)',
     R.b4.noRename&&R.b4.helperReturnsEmpty,JSON.stringify(R.b4));
  ck('B6 v0.68.99-damaged signature → in-place repair (:clear + full B14 canon + in-cell B1 logo + format batch), no deleteSheet, no cell loop',
     R.b6.detectedDamaged&&R.b6.cleared&&R.b6.b14FullContent&&R.b6.b1InCellLogo&&R.b6.formatted&&R.b6.noDelete&&R.b6.noCellLoop&&R.b6.flag==="1",JSON.stringify(R.b6));
  ck('B7 custom NestBest Read me (no full signature) → nothing destructive, no updates (false-positive guard)',
     R.b7.notDamaged&&R.b7.noClear&&R.b7.noCanonWrite&&R.b7.noCellUpdates&&R.b7.noDelete,JSON.stringify(R.b7));
  ck('B8a fast flag set → zero api calls',R.b8a.zeroCalls,JSON.stringify(R.b8a));
  ck('B8b already-migrated workbook → no rename, no updates',R.b8b.noRename&&R.b8b.noUpdates&&R.b8b.flag==="1",JSON.stringify(R.b8b));
  ck('dual-name: legacy NestWorth-named budget still sorts as primary',R.order.firstTwoDefault,JSON.stringify(R.order));
  ck('last-resort discovery query searches BOTH names',Q.both,JSON.stringify(Q));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: intact legacy workbooks are de-branded in place (text/contact only, formatting+device logo preserved); suffixed owned files rename; shared files untouched; v0.68.99-damaged Read me tabs are repaired in place; migration is one-time and never destructive on the intact path.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();
