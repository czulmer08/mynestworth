/* MUTATION TESTING — the strongest test-of-the-tests. Deliberately sabotage the app in controlled ways (each a KNOWN bad
   implementation of a real financial rule), run a targeted suite against the mutated app, and require it to turn RED for the
   RIGHT reason. A green suite only convinces once we've proven it catches known-wrong code.

   VALIDITY GATE (this is what makes the result trustworthy). For every mutation we require the full three-phase evidence:
     1. BASELINE  — the target suite must PASS CLEANLY on the unmutated app (ran to completion, 0 failures).
     2. MUTATED   — the target suite must FAIL BY ASSERTION: it must run to completion and report ≥1 failed check.
     3. RESTORED  — the target suite must PASS CLEANLY again after byte-exact restore.
   Anything that is NOT a clean pass / genuine assertion failure — a missing dependency (e.g. Playwright not installed), a
   browser-launch failure, a syntax error, a timeout, a process crash before the suite printed its summary — is classified as
   INVALID, never "caught". An INVALID run means we learned nothing and the harness says so, instead of green-washing a crash.
   The original app.html is always restored (finally). */
const {execSync}=require('child_process');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const BAK=APP+'.mutbak';
// SOURCE-POISONING GUARD. A killed process (e.g. a run that hit a timeout → SIGTERM) skips the `finally` restore, and could leave
// app.html holding a mutation. Two defenses make that structurally recoverable:
//  (1) SELF-HEAL on startup — a leftover .mutbak means a PRIOR run was interrupted (a clean run deletes it), so restore from it
//      BEFORE reading ORIG. An abnormal termination can therefore never carry a mutated source into the next run.
//  (2) Signal/exit handlers — restore app.html from the in-memory ORIG on SIGINT/SIGTERM/exit, so even the interrupting signal
//      itself best-effort-restores (SIGTERM is catchable; only SIGKILL isn't — and (1) covers that).
if(fs.existsSync(BAK)){try{fs.copyFileSync(BAK,APP);process.stderr.write('[mutation] recovered app.html from an interrupted prior run (.mutbak present)\n');}catch(e){}}
const ORIG=fs.readFileSync(APP,'utf8');
try{fs.writeFileSync(BAK,ORIG);}catch(e){}                 // durable clean backup for THIS run; removed on clean completion
function _restoreApp(){try{fs.writeFileSync(APP,ORIG);}catch(e){}}
process.on('SIGINT',function(){_restoreApp();process.exit(130);});
process.on('SIGTERM',function(){_restoreApp();process.exit(143);});
process.on('exit',function(){_restoreApp();});

const MUT=[
  {n:'annual surplus: income−budget → income+budget',           find:'surplus:r2(income-budget-goalSave)',                                    repl:'surplus:r2(income+budget-goalSave)',                                     by:'verify-decisions.js'},
  {n:'as-of cutoff removed (future-dated rows counted)',         find:'return !(iso&&iso>a);',                                                  repl:'return true;',                                                           by:'verify-audit-v56.js'},
  {n:'3-paycheck calendar ignores the check count',             find:'_perNet(_effAmt(i))*cnt[i]-keepM',                                       repl:'_perNet(_effAmt(i))*1-keepM',                                            by:'verify-percheck.js'},
  {n:'residual penny remainder → last element (can go negative)',find:'var cand=res.filter(function(g){return (g._resMo||0)>0.005;})',          repl:'var cand=[res[res.length-1]]',                                           by:'verify-property.js'},
  {n:'contingency coverage ignores the available buffer',        find:'r2(Math.min(availableBuffer,totalDeficit))',                             repl:'r2(totalDeficit)',                                                       by:'verify-contingency-coverage.js'},
  {n:'budget-used doubled (linked goal counted twice)',          find:'(c&&c.mused!=null)?c.mused:',                                            repl:'(c&&c.mused!=null)?c.mused*2:',                                          by:'verify-coverage.js'},
  {n:'net worth ignores debts (assets only)',                    find:'return r2(ta-td);',                                                      repl:'return r2(ta);',                                                         by:'verify-golden.js'},
  {n:'monthly actuals drops uncategorized spending',             find:'else if(isExpenseRow(r))exp+=amt;',                                      repl:'else if(isExpenseRow(r)&&(""+(r[4]||"")).trim())exp+=amt;',              by:'verify-property.js'},
  {n:'deposits miscounted as expense (income → 0)',              find:'if(isDepositRow(r))inc+=amt;',                                           repl:'if(isDepositRow(r))exp+=amt;',                                           by:'verify-property.js'},
  {n:'FIN-ASOF-001: as-of dropped from monthActualTotals',       find:'else if(typeof _asOfOK==="function"&&!_asOfOK(r))return;',                repl:'else if(false)return;',                                                  by:'verify-engine-invariants.js'},
  {n:'FIN-ASOF-002: as-of dropped from goalContribMonth',        find:'Number(r[1])!==mo||(typeof _asOfOK==="function"&&!_asOfOK(r)))return;',   repl:'Number(r[1])!==mo)return;',                                              by:'verify-engine-invariants.js'},
  {n:'FIN-NW-001: net worth drops stand-alone goals',            find:'reduce(function(a,x){return a+(x.bal||0);},0)+stTot;',                   repl:'reduce(function(a,x){return a+(x.bal||0);},0)+0;',                        by:'verify-engine-invariants.js'},
  {n:'GF gap: cross-category offset ignored (underRoom dropped)',   find:'underAvail=r2((cr.underRoom||0)+Math.max(0,-unb));',                     repl:'underAvail=r2(0+Math.max(0,-unb));',                                     by:'verify-goal-funding.js'},
  {n:'contingency temporal routing removed (WHEN answered as IS)', find:'if(_temporal){',                                                        repl:'if(false&&_temporal){',                                                  by:'verify-contingency-history.js'},
  {n:'cash-flow current month double-counts income (max→sum)',     find:'im=Math.max(ai[m],inc[m])',                                             repl:'im=ai[m]+inc[m]',                                                        by:'verify-cashflow-current-month.js'},
  {n:'$0-baseline cash-flow note suppressed',                      find:'if(Math.abs(start)<0.005){',                                            repl:'if(false){',                                                            by:'verify-cashflow-presentation.js'},
  {n:'contingency trend chart dropped from the money card',        find:'+(trend||"")+',                                                        repl:'+(""||"")+',                                                          by:'verify-contingency-trend.js'},
  {n:'unbudgeted consumption ignored in goal funding',             find:'var unb=r2((typeof unbudgetedConsumption==="function")?unbudgetedConsumption():0);', repl:'var unb=0;',                                        by:'verify-goal-funding.js'},
  {n:'deposit↔contingency causal answer removed',                  find:'/(deposit|paycheck|pay ?check|income|raise|got paid|direct deposit|money (came|coming) in)/.test(t)&&/(contingency|buffer|cushion)/.test(t)', repl:'false&&/(contingency|buffer|cushion)/.test(t)',                              by:'verify-contingency-history.js'},
  {n:'projected-cash routed back to spending pace',                find:'if(/\\bcash\\b/.test(t)&&/(projected cash|cash projection',                repl:'if(false&&/\\bcash\\b/.test(t)&&/(projected cash|cash projection',        by:'verify-wren-cash-alloc.js'},
  {n:'allocation follow-up loses its antecedent',                 find:'var _refPrior=wrenCtx.lastFact&&wrenCtx.lastFact.type==="projectedCash"&&', repl:'var _refPrior=false&&',                                                  by:'verify-wren-cash-alloc.js'},
  {n:'surplus allocation skips contingency repair (double-alloc)',find:'var afterRepair=r2(Math.max(0,preSurplus-contingencyRepair));',            repl:'var afterRepair=r2(Math.max(0,preSurplus));',                             by:'verify-cash-allocation.js'},
  {n:'safe-to-goal ignores the Nest Egg Floor (uses $0)',        find:'var safe=r2(Math.max(0,r2(fLow-floor)));',                              repl:'var safe=r2(Math.max(0,r2(fLow-0)));',                                   by:'verify-goal-safe.js'},
  {n:'safe-to-move answer no longer rendered on the Month tab',   find:'var gsEl=$("mGoalSafe");if(gsEl){',                                      repl:'var gsEl=$("xmGoalSafe");if(gsEl){',                                    by:'verify-tab-layout.js'},
  {n:'deposit progress measures vs $0 not the plan (above/below wrong)',find:'var delta=r2(dep-tgt);',                                                    repl:'var delta=r2(dep-0);',                                                    by:'verify-deposit-progress.js'},
  {n:'money-now reserve double-subtracts the floor (identity broken)',find:'reserve:r2(Math.max(0,r2(gs.currentProjected-gs.forwardLow))),',           repl:'reserve:r2(Math.max(0,r2(gs.currentProjected-gs.forwardLow-gs.floor))),',   by:'verify-money-now.js'},
  {n:'reserve breakdown mis-reconciles (running low not advanced)',find:'needed=r2(runMin-running); runMin=running;',                             repl:'needed=r2(runMin-running);',                                             by:'verify-money-now.js'},
  {n:'hybrid forecast stacks known bill on baseline (double-count)', find:'if(actC>budC)known+=(actC-budC);',                                          repl:'known+=actC;',                                                            by:'verify-hybrid-forecast.js'},
  {n:'contingency target build ignored (no positive cushion)',      find:'var contingencyBuild=r2(Math.min(afterRepair,target));',                 repl:'var contingencyBuild=0;',                                               by:'verify-cash-allocation.js'},
  {n:'cross-surface recon blinded to the repair (surfaces contradict again)',find:',repair=rc?r2(Math.max(0,rc.contingencyRepair||0)):0,',           repl:',repair=0,',                                                            by:'verify-cross-surface-recon.js'},
  {n:'sinking-fund note over-attributes (shows the whole bill as banked)',find:'var use=Math.min(envBanked[k],d.amt); d.banked=r2(use);',              repl:'var use=Math.min(envBanked[k],d.amt); d.banked=r2(d.amt);',              by:'verify-sinking-transparency.js'},
  {n:'sinking-fund note reuses a banked dollar for two bills (no consume)',find:'d.envelope=true; envBanked[k]=r2(envBanked[k]-use);',                   repl:'d.envelope=true;',                                                       by:'verify-sinking-transparency.js'},
  {n:'sinking contribution not clamped to the category budget',   find:'var bud=_catBudMonth(name,m);return r2(Math.min(v,bud));',               repl:'var bud=_catBudMonth(name,m);return r2(v);',                             by:'verify-sinking-foundation.js'},
  {n:'split-budget consumption ignores the contribution carve-out',find:'return r2(Math.max(0,_catBudMonth(name,m)-catContributionMonthly(name,m)));',repl:'return r2(Math.max(0,_catBudMonth(name,m)));',                        by:'verify-sinking-foundation.js'},
  {n:'sinking reinterpretation fires without the sinking/split purpose gate (inferred)',find:'var p=catPurpose(c.name);if(p!=="sinking"&&p!=="split")return;',      repl:'var p=catPurpose(c.name);',                                              by:'verify-sinking-engine.js'},
  {n:'future sinking contribution not freed from the baseline (double-count returns)',find:'if(sinkFree>0)base=r2(Math.max(0,base-sinkFree));',                       repl:'if(sinkFree>0)base=r2(base);',                                           by:'verify-sinking-engine.js'},
  {n:'checkup dry-run diff does not revert (scan mutates state)',   find:'if(had)state.meta.cats[k]=prev;else delete state.meta.cats[k];',         repl:'prev=prev;',                                                            by:'verify-forecast-checkup.js'},
  {n:'lumpy detector flags ordinary flat budgets (threshold gutted)',find:'if(med>0&&max>=2*med&&(max-med)>=2000){',                               repl:'if(med>0&&max>=0*med&&(max-med)>=0){',                                   by:'verify-forecast-checkup.js'},
  {n:'multi-bill allocation double-funds (pool not consumed by earlier bill)',find:'pool=r2(Math.max(0,pool-funded));',                                       repl:'pool=r2(Math.max(0,pool));',                                             by:'verify-multi-obligation.js'},
  {n:'checkup suggests current-month bills (already covered by the budget)',   find:'var mo=Number(r[1]);if(mo<=cm)return;',                                   repl:'var mo=Number(r[1]);if(mo<cm)return;',                                   by:'verify-forecast-checkup.js'},
  {n:'checkup re-nags a prompt the user already answered (ignores checkupDone)',find:'var cand=(linked||done)?null:',                                            repl:'var cand=(linked)?null:',                                               by:'verify-forecast-checkup.js'},
  {n:'Goals page drops the "safe to move to goals" banner',       find:"head=safeBanner+'<div class=\"goalsumm\">",                              repl:"head='<div class=\"goalsumm\">",                                         by:'verify-goals-safe-banner.js'},
  {n:'envelope-bills marks every upcoming bill covered (ignores the shortfall)',find:'covered:(short<0.005)',                                                  repl:'covered:true',                                                          by:'verify-envelope-bills.js'},
  {n:'add-screen relabels back to the count-like "unbudgeted"',    find:'money(unbud)+" spent outside budget"',                                   repl:'money(unbud)+" unbudgeted"',                                            by:'verify-unbudgeted-label.js'},
  {n:'lumpy prompt reverts to the action label (not a yes/no answer)',find:'It was a one-off</button>',                                              repl:'Adjust budget</button>',                                                by:'verify-forecast-checkup.js'},
  {n:'budgeted-name set omits itemized sub-items (double-counts sub-item spend as unbudgeted)',find:'if(bl){set[bl]=1;set["↳ "+bl]=1;}',                    repl:'if(bl){}',                                                              by:'verify-itemized-unbudgeted.js'},
  {n:'Spent formula loses its graceful blank-$AC$1 fallback (a blank helper re-zeroes the year)',find:',0),$AC$1))',                                            repl:',0))',                                                                  by:'verify-summary-spent.js'},
  {n:'checkup never asks an unclassified envelope its purpose',    find:'var needsPurpose=(!linked&&!cand&&!purposeDone&&catPurpose(c.name)==="ongoing");',repl:'var needsPurpose=false;',                                       by:'verify-checkup-classify.js'},
  {n:'checkup completion summary is suppressed (no before/after wrap-up)',find:'return _checkupSummaryHTML(ck);',                                        repl:'return "";',                                                            by:'verify-checkup-classify.js'},
  {n:'at-log link suggestion fires for within-budget (routine) bills',find:'if(amt<=bud+0.005)return null;',                                          repl:'if(amt<=bud+0.005){}',                                                  by:'verify-checkup-continuation.js'},
  {n:'multi-bill "also a match" never surfaces the extra bill',    find:'if(extra)counts.extraBills++;',                                          repl:'if(false)counts.extraBills++;',                                         by:'verify-checkup-continuation.js'},
  {n:'#5 decision-engine contingency note loses its direction (never says helps/hurts)',find:'var dir=(moDelta>0.005)?"helps":((moDelta<-0.005)?"hurts":"neutral");',repl:'var dir="neutral";',                                                    by:'verify-decision-contingency.js'},
  {n:'#7 recon→cash-flow bridge miscomputes "cash on hand today" (breaks the reconciliation)',find:'var today=r2(entering+ai-actualOut);',                          repl:'var today=r2(entering+ai-actualOut+1);',                                 by:'verify-recon-bridge.js'},
  {n:'budget-membership drops itemized children → reproduces "74% used yet over budget" (the screenshot bug)',find:'if(bl){set[bl]=1;set["↳ "+bl]=1;}',repl:'if(bl){}',                                                              by:'verify-item-ub.js'},
  {n:'Wren keeps its OWN top-level-only unbudgeted set (drifts from the Month headline)',find:'var _known=budgetedNameSet();',                                    repl:'var _known={};',                                                        by:'verify-item-ub.js'},
  {n:'#6 multi-month reconciliation ignores the floor cap (discretionary set-asides exceed floor-safe headroom)',find:'if(isFinite(headroom)&&r2(committed+disc)>headroom+0.005){',repl:'if(false){',                                                             by:'verify-multimonth-recon.js'},
  {n:'#6 multi-month reconciliation drops BUILD from the pool carry (contingency never reaches target)',find:'pool=r2(pool+repair+build);',                        repl:'pool=r2(pool+repair);',                                                 by:'verify-multimonth-recon.js'},
  {n:'#6 forward card shows even with no forward story (healthy plan gets clutter)',find:'if(!(overspent||building||floorPressure)||!activity)return "";',repl:'if(false)return "";',                                                    by:'verify-multimonth-surface.js'},
  {n:'#6 Wren forward-timing route never fires (no "when will my contingency be rebuilt" answer)',find:'if((_fwdCue||_fwdWhen)&&/(contingency|buffer|cushion|shortfall|deficit)/.test(t)&&!/(deposit|paycheck|pay ?check|income|raise|got paid|direct deposit|money (came|coming) in)/.test(t)){',repl:'if(false){',                                                             by:'verify-multimonth-surface.js'},
  {n:'WREN-043: "went toward <goal>" no longer reads as goal funding (drops to the balance-led default)',find:'||/(went|gone|goes|going) toward/.test(t))&&!/year|ytd|last month/.test(t))',repl:')&&!/year|ytd|last month/.test(t))',                                    by:'verify-wren-golden.js'},
  {n:'lumpy evidence table drops its category filter (unrelated rows pollute "What <month> was")',find:'if(!nameSet[cn])return;',repl:'if(false)return;',                                                           by:'verify-lumpy-itemized.js'},
  {n:'catNameSet drops the PARENT name (a parent-tagged row stops belonging to its own category)',find:'if(n)set[n]=1;',repl:'if(false)set[n]=1;',                                                        by:'verify-cat-membership.js'},
  {n:'resolver commit applies nothing (Apply no longer moves the forecast the preview promised)',find:'function _committable(a){return a&&(a.status==="resolved"||a.status==="unresolved");}',repl:'function _committable(a){return false;}',by:'verify-resolver-engine.js'},
  {n:'resolver preview leaks its staged cfg (staging no longer restored byte-exact)',find:'finally{state.meta.cats=snap;}',repl:'finally{}',                                                             by:'verify-resolver-engine.js'},
  {n:'resolver draft resume loses the staged answers (Save & finish later comes back empty)',find:'answers:(m.answers&&typeof m.answers==="object"&&!Array.isArray(m.answers))?m.answers:{}',repl:'answers:{}',by:'verify-resolver-engine.js'},
  {n:'resolver never flags a stale obligation link as needsReview',find:'return !found;});',repl:'return false;});',                                                            by:'verify-resolver-engine.js'},
  {n:'wizard never advances to the next decision (progress stuck on 1 of N)',find:'checkupSetStep((d.step||0)+1)',repl:'checkupSetStep((d.step||0))',                                       by:'verify-resolver-wizard.js'},
  {n:'wizard never surfaces a stale link as its own needs-review step',find:'if(ri&&ri.needsReview){var rid=',repl:'if(false){var rid=',                                                     by:'verify-resolver-wizard.js'},
  {n:'identify step inverts its upcoming filter (offers past charges, hides the real upcoming bill)',find:'if(today&&iso<today)return;',repl:'if(today&&iso>today)return;',                              by:'verify-identify-candidates.js'},
  {n:'identify header drops the category name (an empty step is indistinguishable from another envelope)',find:'_ckwProg(step,total,"What are you saving for in "+cat+"?")',repl:'_ckwProg(step,total,"What are you saving for?")',by:'verify-identify-candidates.js'},
  {n:'new-bill detection ignores already-linked (a linked obligation resurfaces as "new")',find:'if(_rowLinkedOwner(cn))return;',repl:'if(false&&_rowLinkedOwner(cn))return;',by:'verify-new-obligation.js'},
  {n:'new-bill identity uses content not the row id (an amount edit makes the same bill "new" again)',find:'function _newBillKey(cand){return (cand&&cand.srcId)?cand.srcId:("idx:"+(cand?cand.rowIdx:"?"));}',repl:'function _newBillKey(cand){return (cand?("c:"+cand.amount):"?");}',by:'verify-new-obligation.js'},
  {n:'OBLIGATION-MEMBERSHIP-UNIQUENESS dropped (one row funded by two envelopes)',find:'if(!_own)checkupAddObligation(cat,{name:ans.cand.name',repl:'if(true)checkupAddObligation(cat,{name:ans.cand.name',by:'verify-new-obligation.js'},
  {n:'Wren over-budget reverts to current-month only (ignores the month asked — the reported beta bug)',find:'return (!budYearOK)?[]:((scope==="year")?overCatsYear(pY):overCatsFor(pY,pM));',repl:'return overCats();',by:'verify-wren-scope.js'},
  {n:'Wren stops parsing "last month" (collapses to the current month)',find:'/\\b(last|previous) month\\b/.test(s)',repl:'false',by:'verify-wren-scope.js'},
  {n:'WREN-SCOPE-CONSISTENCY: period rows revert to the current month (every answer computes the current month)',find:'return r&&Number(r[0])===pY&&(scope==="year"||Number(r[1])===pM);',repl:'return r&&Number(r[0])===Y&&(scope==="year"||Number(r[1])===M);',by:'verify-wren-scope.js'},
  {n:'WREN-SCOPE-LABEL: the answer label is hardcoded to "this month" regardless of the period computed',find:'var when=_SC.label;',repl:'var when="this month";',by:'verify-wren-scope.js'},
  {n:'Month tab: per-month reserves ignore the viewed month (always current banked)',find:'return (y===curYear()&&m>=curMonth())?(curMonth()-1):m;',repl:'return curMonth()-1;',by:'verify-month-scope.js'},
  {n:'Month tab: category cards ignore the viewed month (always show the current month)',find:'isCur=_v.isCur,mo0=vm-1;',repl:'isCur=_v.isCur,mo0=curMonth()-1;',by:'verify-month-scope.js'},
  {n:'Month tab: current-state safe-to-move card leaks onto a past month',find:'(_gsh&&(typeof _mIsCurrentView!=="function"||_mIsCurrentView()))?"block":"none"',repl:'(_gsh)?"block":"none"',by:'verify-month-scope.js'},
  {n:'LINK-MIRROR-UNIQUENESS: mirror dedupe broken (a retry/edit adds a second household deposit)',find:'if(found<0&&isDepositRow(r)&&rowMirrorOf(r)===sid)found=i;',repl:'if(found<0&&isDepositRow(r)&&false)found=i;',by:'verify-linked-budgets.js'},
  {n:'LINK-NO-LOOP: the is-mirror guard removed in the planner (a mirrored row could mirror again)',find:'if(rowMirrorOf(srcRow))return {op:"none",reason:"is-mirror"};                                 // LINK-NO-LOOP: a mirrored row never mirrors again',repl:'if(false)return {op:"none",reason:"is-mirror"};                                 // LINK-NO-LOOP: a mirrored row never mirrors again',by:'verify-linked-budgets.js'},
  {n:'LINK-LIFECYCLE: delete no longer removes the mirror (orphaned household income)',find:'if(action==="delete")return (found>=0)?',repl:'if(false)return (found>=0)?',by:'verify-linked-budgets.js'},
  {n:'LINK-SOURCE-FIRST: executor no longer requires a committed source id (mirror/pending without a source)',find:'if(!sid)return {op:"none",reason:"no-src-id"};        // LINK-SOURCE-FIRST',repl:'if(false)return {op:"none",reason:"no-src-id"};        // LINK-SOURCE-FIRST',by:'verify-linked-executor.js'},
  {n:'mirror idempotency broken: executor stops re-reading the target (a lost-response retry duplicates the deposit)',find:'var targetRows=await mirrorReadTargetRows(cfg.budgetId);',repl:'var targetRows=[];',by:'verify-linked-executor.js'},
  {n:'MIRROR live-write drops mirrorOf (K): the deterministic add stops writing the source id into K → unlabeled + unfindable + duplicate on a narrow imported ledger',find:'d.desc,"N",id,d.mirrorOf];',repl:'d.desc,"N",id,""];',by:'verify-mirror-live-append.js'},
  {n:'LINK-LIFECYCLE dispatch: an edit no longer follows an existing pair after the category is UNLINKED (step-6 regression — mirror stops updating)',find:'if(newLinked||(hasPair&&catSame))return "edit";',repl:'if(newLinked)return "edit";',by:'verify-linked-executor.js'},
  {n:'LINK pair persistence: writeMeta stops persisting mirrorPairs (pair record never survives a meta save → un-followable mirror after unlink)',find:'mirrorPairs:_mergeMap(_metaBase.mirrorPairs||{},state.meta.mirrorPairs||{},remote.mirrorPairs||{})',repl:'mirrorPairs:_mergeMap(_metaBase.mirrorPairs||{},{},remote.mirrorPairs||{})',by:'verify-linked-meta-persist.js'},
  {n:'CONTINGENCY TARGET persistence: writeMeta drops contingencyTarget from the merged doc (the restored target input never reaches the Meta sheet)',find:'contingencyTarget:Math.max(0,Number((state.meta.contingencyTarget!==_metaBase.contingencyTarget)?state.meta.contingencyTarget:remote.contingencyTarget)||0),',repl:'',by:'verify-contingency-target-persist.js'},
  {n:'FOLDER ADOPT: legacy-folder branch loses fid=_legacy (a renamed NestWorth folder is dropped, so a DUPLICATE NestBest folder is created)',find:'fid=_legacy;',repl:'fid=null;',by:'verify-folder-adopt.js'},
  {n:'setup NOT fail-closed: an invalid link (unknown contributor) is saved anyway',find:'if(!v.ok)return {ok:false,msg:(v.reason==="not-writable"',repl:'if(false)return {ok:false,msg:(v.reason==="not-writable"',by:'verify-linked-ui.js'},
  {n:'mirror label dropped: a mirrored deposit no longer shows "Mirrored from Personal"',find:'if(typeof rowMirrorOf==="function"&&rowMirrorOf(r))_lt=',repl:'if(typeof rowMirrorOf==="function"&&false)_lt=',by:'verify-linked-ui.js'},
  {n:'ledger-date repair drops the ISO parse (text dates never normalize → Spent stays blank)',find:'return m[1]+"-"+pad2(m[2])+"-"+pad2(m[3]);',repl:'return "";',                                             by:'verify-parse-date.js'},
  {n:'wizard multi-bill link drops the obligations array (can only ever link one bill)',find:'var _obs=(ans.obligations&&ans.obligations.length)?ans.obligations:(ans.obligation?[ans.obligation]:null);',repl:'var _obs=(ans.obligation?[ans.obligation]:null);',by:'verify-identify-candidates.js'},
  {n:'"started banking in" month is ignored — envelope always banks from January',find:'else cfg.rollStart=bYear()*100+_selM;',repl:'else cfg.rollStart=bYear()*100+1;',                              by:'verify-rollstart.js'},
  {n:'Optimize keeps the existing formula that "looks optimized" (skips the canonical rebuild — the $AD$1 bug returns)',find:'rebuilt=await rebuildAllSummarySpentFormulas();',repl:'rebuilt=false;',                            by:'verify-optimize-regen.js'},
  {n:'safeToMoveOnHand keeps future income (safe-to-move never reveals it leans on scheduled deposits)',find:'for(var m=cm-1;m<12;m++)c.bud12[m]=0;',repl:'for(var m=cm-1;m<12;m++)c.bud12[m]=c.bud12[m];',              by:'verify-safe-income-dependency.js'},
  {n:'wizard commit of an "ongoing" purpose never marks it done (the envelope re-surfaces on every checkup)',find:'if(a&&a.type==="purpose"&&_committable(a)&&a.cat)checkupMarkDone("purpose",a.cat);',repl:'if(false)checkupMarkDone("purpose",a.cat);', by:'verify-checkup-classify.js'},
  {n:'identify "Show N more" is a no-op — the extra bills beyond 8 can never be revealed or linked',find:'function ckwShowMore(){if(!_ckw)return;_ckw.showAll=true;',repl:'function ckwShowMore(){if(!_ckw)return;_ckw.showAll=false;', by:'verify-identify-candidates.js'},
  {n:'identify selections are lost on Back (multi-select regression — re-entering an envelope forgets the bills you added)',find:'var saved=_ckwPicks[f.id]||{}',repl:'var saved={}',                    by:'verify-identify-candidates.js'},
  {n:'search parent-category filter stops including its children (a parent no longer matches its itemized rows)',find:'var s=(typeof catNameSet==="function")?catNameSet(n):{};for(var k in s)catUnion[k]=1;',repl:'var s={};for(var k in s)catUnion[k]=1;', by:'verify-search-multicat.js'},
  {n:'search panel stops flagging a child already covered by a selected parent (redundant pick no longer visible)',find:'_cov[n]?("in "+_cov[n]):""',repl:'""', by:'verify-search-multicat.js'},
  {n:'forward forecast drops the recurring budget baseline (ordinary spending vanishes from the projection)',find:'base+=budC;',repl:'base+=0;', by:'verify-cashflow-invariants.js'},
  {n:'repair prompt loses its "already current" gate — it would nag an up-to-date sheet on every sign-in',find:'(state.meta.repairedBuild||"")>=REPAIR_BUILD',repl:'false', by:'verify-repair-prompt.js'},
  {n:'"Review envelopes & bills" wipes ALL checkup answers (not just envelope/bill) — loses lumpy/unusual suppressions',find:'/^(purpose|match|newbill):/.test(k)',repl:'true', by:'verify-repair-prompt.js'},
  {n:'envelope over-credits self-coverage (adds the over back into the balance) — a $0-banked envelope appears to fully self-cover',find:'var self=Math.max(0,Math.min(over,e.balance||0));',repl:'var self=Math.max(0,Math.min(over,(e.balance||0)+over));', by:'verify-envelope-selfcover.js'},
  {n:'runRepairAll stamps repairedBuild even on a PARTIAL failure — a failed repair falsely marks the sheet up to date',find:'if(!failed){try{if(state.meta){state.meta.repairedBuild=BUILD;',repl:'if(true){try{if(state.meta){state.meta.repairedBuild=BUILD;', by:'verify-repair-prompt.js'},
  {n:'"Save & finish later" doesn\'t collapse the wizard (re-renders the same screen → the button looks dead)',find:'_ckwSnoozed=true;_ckwReset();',repl:'_ckwReset();', by:'verify-checkup-savelater.js'},
  {n:'envelope overage never becomes a deficit (the passed-onward amount is dropped) — a $0-banked overage vanishes from goal funding, breaking selfCovered+contingencyCovered+uncovered===overage',find:'envDeficit=r2(envDeficit+r2(over-self));',repl:'envDeficit=r2(envDeficit+0);', by:'verify-envelope-coverage-waterfall.js'},
  {n:'SURFACE: "Banked in envelopes" rendered from the WRONG field (contingency) while the engine stays correct — the number contradicts computeRollover().envTotal',find:"Set aside toward specific upcoming bills.',money(m.envelopesBanked)",repl:"Set aside toward specific upcoming bills.',money(m.contingencyAvailable)", by:'verify-surface-provenance.js'},
  {n:'SURFACE: $0-banked coverage sentence still claims envelope coverage ("covered by its $0 banked") though nothing was banked — wording contradicts the state, engine unchanged',find:'</b> is "+money(e.over)+" over budget — "+(bufOk?',repl:'</b> is "+money(e.over)+" over budget — covered by its "+money(bal)+" banked; "+(bufOk?', by:'verify-surface-provenance.js'},
  {n:'obligation schedule ignores banked funds in the required pace (cum−banked → cum−0, funds "from scratch")',find:'var rate=Math.max(0,r2((cum-banked)/opps));',repl:'var rate=Math.max(0,r2((cum-0)/opps));', by:'verify-obligation-schedule.js'},
  {n:'obligation schedule drops the behind-schedule checkpoint (minBankedToday/fundingGap forced to 0)',find:'var mb=Math.max(0,r2(cum-capacity*opps));if(mb>minBanked)minBanked=mb;',repl:'var mb=0;if(mb>minBanked)minBanked=mb;', by:'verify-obligation-schedule.js'},
  {n:'D3: saving capacity reverts to the FULL category budget (double-counts ordinary spend as saving room)',find:'budget-((opts.plannedNormalSpend!=null)?opts.plannedNormalSpend:_plannedNormalSpend(name))',repl:'budget-0', by:'verify-checkup-split-suggest.js'},
  {n:'Stage B: _cfSinkFree reintroduces the old due-month suppression (intermediate bill month no longer counts toward later bills)',find:'if(hasLater){var room=Math.max(0,r2(((c.bud12&&c.bud12[m])||0)-billThisMonth));free=r2(free+Math.min(catContributionMonthly(c.name,m),room));}',repl:'if(hasLater&&billThisMonth<=0){var room=Math.max(0,r2(((c.bud12&&c.bud12[m])||0)-billThisMonth));free=r2(free+Math.min(catContributionMonthly(c.name,m),room));}', by:'verify-stageb-sinkfree.js'},
  {n:'Stage B: _cfSinkFree drops the anti-understatement guard (this-month bill ignored → frees contribution over the bill)',find:'billThisMonth=r2(billThisMonth+(Number(o.amount)||0))',repl:'billThisMonth=r2(billThisMonth+0)', by:'verify-stageb-sinkfree.js'},
  {n:'TIMING-SINGLE-SOURCE: the shared _sinkOpps reverts to the D−cm+1 inclusive convention (would shift BOTH the schedule and sinkingSummary at once)',find:'var mu=(dy===bYear())?(dm-cm):((dy>bYear())?(12-cm+1):0);return Math.max(0,mu);',repl:'var mu=(dy===bYear())?(dm-cm):((dy>bYear())?(12-cm+1):0);return Math.max(0,mu+1);', by:'verify-obligation-schedule.js'},
  {n:'BRAND REFRESH: owned-only guard removed — a SHARED/family budget (owned by someone else) would get renamed and its Read me clobbered',find:'if(meta.ownedByMe!==false){',repl:'if(true){',by:'verify-brand-refresh.js'},
  {n:'BRAND REFRESH v100: owned legacy-name rename never fires (existing owned budgets keep the old NestWorth title)',find:'if(currentName){',repl:'if(false){',by:'verify-brand-refresh.js'},
  {n:'BRAND REFRESH v100: SUFFIXED owned rename dropped (NestWorth Budget - CZUH stays; only exact base renames)',find:'return SHEET_NAME+n.slice(LEGACY_SHEET_NAME.length)',repl:'return ""',by:'verify-brand-refresh.js'},
  {n:'BRAND REFRESH v100: Read-me text de-brand no-op (mixed-case NestWorth text is never rewritten in place)',find:'.replace(/NestWorth/g,"NestBest")',repl:'.replace(/NestWorth/g,"NestWorth")',by:'verify-brand-refresh.js'},
  {n:'BRAND REFRESH v100: damaged-99 signature made unconditional (a custom/intact Read me is wrongly destructively repaired)',find:'return /mynestbest\\.com\\/icon-512\\.png/i.test(at(1,1))&&/^NestBest$/i.test(at(2,1).trim())&&/Plan\\. Budget\\. Build\\./i.test(at(3,1))&&/product of Ulmer Consulting LLC/i.test(at(12,1));',repl:'return true;',by:'verify-brand-refresh.js'},
  {n:'BRAND REFRESH v100: repair restores only a truncated Read me (canonical content rows dropped)',find:'for(var r=14;r<=61;r++)rows.push([canon[r]||""]);',repl:'for(var r=14;r<=20;r++)rows.push([canon[r]||""]);',by:'verify-brand-refresh.js'},
  {n:'FOLDER ADOPT v100: cached NestWorth folder no longer re-checked/renamed (the real existing-user cache-bypass returns)',find:'else if(chk.name==="NestWorth"){',repl:'else if(false){',by:'verify-folder-adopt.js'},
  {n:'DUAL-NAME: orderBudgetsForOpen stops treating a legacy NestWorth-named budget as "your primary" (a renamed-pending budget loses its front-of-list slot)',find:'return n===SHEET_NAME.toLowerCase()||n===LEGACY_SHEET_NAME.toLowerCase();',repl:'return n===SHEET_NAME.toLowerCase();',by:'verify-brand-refresh.js'},
  {n:'DUAL-NAME: the last-resort discovery query drops the legacy name (a pre-folder NestWorth budget becomes unfindable by name)',find:'"(name=\'"+SHEET_NAME+"\' or name=\'"+LEGACY_SHEET_NAME+"\') and mimeType=\'application/vnd.google-apps.spreadsheet\' and trashed=false"',repl:'"name=\'"+SHEET_NAME+"\' and mimeType=\'application/vnd.google-apps.spreadsheet\' and trashed=false"',by:'verify-brand-refresh.js'},
];

// Run a suite; capture exit code + combined output so we can classify WHY it passed/failed (not just the exit code).
function runSuite(file){
  try{const out=execSync('node '+JSON.stringify(path.join(__dirname,file)),{cwd:__dirname,stdio:['ignore','pipe','pipe'],timeout:220000,encoding:'utf8'});
    return {code:0,out:out||'',timedOut:false};}
  catch(e){const timedOut=!!(e.killed||e.signal==='SIGTERM'||/ETIMEDOUT/.test(String(e.code||'')));
    return {code:(e.status==null?1:e.status),out:((e.stdout||'')+'\n'+(e.stderr||'')),timedOut};}
}
// A run counts as "reached its verdict" only if it printed one of the known suite summary lines. Parse the failure count.
function summarize(out){let m;
  if(m=out.match(/(\d+)\s+passed,\s+(\d+)\s+failed/))return {ran:true,failed:+m[2]};
  if(m=out.match(/"total":\s*\d+/)){const f=out.match(/"fail":\s*(\d+)/);return {ran:true,failed:f?+f[1]:null};}
  if(m=out.match(/OVERALL:\s*(\d+)\/(\d+)\s+cases passed/))return {ran:true,failed:(+m[2])-(+m[1])};
  return {ran:false,failed:null};
}
// HARNESS-level breakage (dependency/browser/env) — NOT the app being wrong. These make a run INVALID, never "caught".
function harnessBroken(out){return /Cannot find module|MODULE_NOT_FOUND|Executable doesn't exist|playwright install|browserType\.launch|EADDRINUSE|listen EACCES|npm ERR/i.test(out);}
function passedClean(r){const s=summarize(r.out);return r.code===0&&!r.timedOut&&!harnessBroken(r.out)&&s.ran&&s.failed===0;}
// Genuine assertion failure: ran to its verdict, reported ≥1 failed check (or finished nonzero with its summary printed),
// and did not hit a harness/timeout/dependency crash.
function failedByAssertion(r){const s=summarize(r.out);
  if(r.timedOut||harnessBroken(r.out)||!s.ran)return false;
  return (s.failed!=null&&s.failed>0)||(r.code!==0);}
function invalidReason(r){if(r.timedOut)return'timeout';if(harnessBroken(r.out))return'harness/dependency/browser failure';if(!summarize(r.out).ran)return'no suite summary (crashed before verdict)';return'';}

const suites=Array.from(new Set(MUT.map(m=>m.by)));
const results=[];const baseline={};const restored={};
try{
  // PHASE 1 — baseline: each unique suite must pass cleanly on the untouched app, else its mutations are INVALID.
  for(const s of suites)baseline[s]=runSuite(s);
  // PHASE 2 — per mutation
  for(const m of MUT){
    const occ=ORIG.split(m.find).length-1;
    if(occ!==1){results.push({m,status:'BADFIND',occ});continue;}
    if(!passedClean(baseline[m.by])){results.push({m,status:'INVALID',phase:'baseline',why:invalidReason(baseline[m.by])||'baseline not clean'});continue;}
    fs.writeFileSync(APP,ORIG.replace(m.find,m.repl));
    const mut=runSuite(m.by);
    fs.writeFileSync(APP,ORIG); // restore immediately
    if(failedByAssertion(mut))results.push({m,status:'CAUGHT'});
    else if(passedClean(mut))results.push({m,status:'SURVIVED'});
    else results.push({m,status:'INVALID',phase:'mutated',why:invalidReason(mut)||'mutation did not yield a clean assertion verdict'});
  }
  // PHASE 3 — restored: each unique suite must pass cleanly again (byte-exact app is back).
  for(const s of suites)restored[s]=runSuite(s);
}finally{fs.writeFileSync(APP,ORIG);}

const byteExact=fs.readFileSync(APP,'utf8')===ORIG;
let caught=0,survived=0,bad=0,invalid=0;
results.forEach(r=>{
  if(r.status==='CAUGHT'){caught++;console.log('  CAUGHT   ['+r.m.by+'] '+r.m.n);}
  else if(r.status==='SURVIVED'){survived++;console.log('  SURVIVED ['+r.m.by+'] '+r.m.n+'  ← COVERAGE GAP: this bad implementation passed the suite');}
  else if(r.status==='BADFIND'){bad++;console.log('  BAD-FIND '+r.m.n+'  ← mutation target not unique ('+r.occ+' occurrences) — app source moved, update the mutation');}
  else{invalid++;console.log('  INVALID  ['+r.m.by+'] '+r.m.n+'  ← '+r.phase+': '+r.why+' (learned nothing — NOT counted as caught)');}
});
// restore-phase verdicts
const restoreFails=suites.filter(s=>!passedClean(restored[s]));
console.log('');
suites.forEach(s=>{const okB=passedClean(baseline[s]),okR=passedClean(restored[s]);
  console.log('  suite '+(okB&&okR?'OK   ':'WARN ')+s+'  — baseline:'+(okB?'clean':('INVALID('+invalidReason(baseline[s])+')'))+'  restored:'+(okR?'clean':('INVALID('+invalidReason(restored[s])+')')));});
const realMut=MUT.length; // all entries should be genuine (no BADFIND) in a healthy tree
console.log('\n  '+caught+'/'+realMut+' mutations CAUGHT by a genuine assertion failure'
  +(survived?(' · '+survived+' SURVIVED (coverage gap)'):'')
  +(invalid?(' · '+invalid+' INVALID (harness/dependency — inconclusive)'):'')
  +(bad?(' · '+bad+' bad-find'):'')
  +'  · app.html restored byte-exact: '+byteExact);
if(invalid)console.log('  NOTE: INVALID runs mean the target suite could not produce a trustworthy verdict here (often Playwright not installed). Fix the environment and re-run — do not read INVALID as "caught".');
// This run completed normally (we reached here, not killed): remove the backup sentinel so the next run doesn't think it was interrupted.
try{fs.unlinkSync(BAK);}catch(e){}
// Trustworthy green requires: every mutation caught, all baselines+restores clean, byte-exact restore, and ZERO invalid/survived/bad.
process.exit((survived||bad||invalid||restoreFails.length||!byteExact||caught!==realMut)?1:0);
