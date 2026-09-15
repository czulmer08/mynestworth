# NestBest v0.68.100 / build 20260915.2 — live-repair gate verdict

**VERDICT: PASS — cleared to deploy.** All four live-smoke fixes verified against the exact v0.68.100 source
(`1d993328…`), with new behavioral cases for the real-world conditions the v0.68.99 gate missed, an expanded
mutation set (122 → **126**), and a CSP-verified minified artifact smoke-tested on its shipping bytes.

## Why v0.68.99 passed but failed live — and what changed in the harness
The v0.68.99 mocks used idealized state: an exact file name `"NestWorth Budget"` and a **cleared** `nw_folder_id`.
Real accounts have a **cached folder id** (so `getNwFolder` never entered the discovery/rename branch) and **suffixed
names** (`NestWorth Budget - CZUH`). The tests were green but never exercised those paths. The v0.68.100 harness now does.

## Fixes verified
- **Fix A — cached folder rename.** `getNwFolder` re-checks a cached `nw_folder_id`'s Drive name and PATCH-renames it in
  place when still `NestWorth`. New folder-adopt cases S5 (cached→rename, same id, no discovery/create) and S6 (cached
  already NestBest → no-op) pass.
- **Fix B — suffixed owned rename.** `legacyBudgetCurrentName` maps `NestWorth Budget` and `NestWorth Budget - <suffix>`
  (space/en/em dashes) → NestBest, preserving the suffix, while excluding `NestWorth Budget Backup`. Shared/non-owned files
  untouched.
- **Fix C — preservation-first Read me (shipped as-is, per your call).** Intact legacy tabs are de-branded cell-by-cell
  (text + contact only); sheet, formatting, widths, unrelated content, and the floating **device** logo are preserved; no
  `deleteSheet`, no `:clear`, no added in-cell logo. Confirmed the floating image is the symbol-only mark (no "NestWorth"
  wordmark), so leaving it is correct.
- **Fix D — repair v0.68.99 damage.** A narrow signature (`icon-512` formula in A1, `NestBest` A2, `Plan. Budget. Build.`
  A3, product line A12) triggers an in-place repair that restores the full canonical Read me + in-cell logo; a custom
  Read me that merely says "NestBest" does **not** trigger it (false-positive guard passes).

## Gate results (source `1d993328…`)
- brand-refresh **10/10** (B1 preserve+de-brand, B2 suffix, B3 shared untouched, B4 Backup excluded, B6 repair, B7
  false-positive guard, B8 idempotence, dual-name); folder-adopt **6/6** (incl. cached S5/S6); security **18/18**;
  golden 12/12, wren-golden 123/123·134/134, money-now 23/23, migration 22/22, version 9/9, discover 4/4, tab-layout 9/9,
  cash-recon-card 6/6, contingency-target-persist 6/6, linked-meta-persist 4/4.
- **Mutation gate: 126/126 caught** (6 new v0.68.100 mutations — cached recheck, exact+suffix rename, in-place text
  de-brand, damaged-99 signature, repair completeness — all break-audited), byte-exact restore.
- **Build:** 2 inline scripts minified, 2 CSP `script-src-elem` hashes injected from post-terser bytes and independently
  re-verified. Markers: VERSION `0.68.100`, BUILD `20260915.2`, `TEMPLATE_URL="nestbest-template.xlsx"`.
- **Minified-artifact smoke** (shipping bytes, enforced CSP): brand-refresh 10/10, folder-adopt 6/6, golden 12/12,
  money-now 23/23. (security shows 16/18 on the minified file — the two are source-only checks terser strips; 18/18 on
  readable source — not regressions.)

## SHA-256 / CSP hashes
| File | SHA-256 |
|---|---|
| dev source (input) | `1d993328e20f51c0d1ca6f0d79a04c738bacadd271053025fa404a523a5caad7` |
| **`app.production.html` (deploy as public `app.html`)** | `dda5babf67a51fb083a1a9fd86ea2f821c1f6d2a5e975cdd0470c1680cd04713` |
| `nestbest-template.xlsx` | `73ae971d0df80afe3101dff7deb357bff21523a7c653eeeff5b8bda196cb259d` |

CSP `script-src-elem` hashes in the artifact (verified against its own bytes):
- `'sha256-bqgCQ4bYB0uWoFyi036rVdbrDcEfahmRxFdGFTUwiyw='` (loader)
- `'sha256-0DSSi8LMszvmFoRbzZ3tSphuvQCql7E8xomjXU5tvDs='` (app block — new for v0.68.100)

## Deploy notes
1. Deploy `app.production.html` (`dda5babf…`) as the public `app.html` (your env has no terser; this artifact is
   self-consistent and behavior-verified on its own bytes).
2. Ship **both** templates: `nestbest-template.xlsx` + `nestworth-template.xlsx` (transition alias) until the new `sw.js`
   cache propagates.
3. Use the **126-mutation** `verify-mutation.js` + the updated `verify-brand-refresh.js` / `verify-folder-adopt.js` in this
   package for your private test repo.
4. Still open from v0.68.99: the rewritten `build-production.py` does not stamp `DEPLOYED.md` provenance — handle that row
   manually or re-add stamping.
5. Live re-smoke after deploy, on a real existing account: cached NestWorth **folder** renames; owned `... - CZUH` file
   renames; shared `... - Holland House` untouched; an intact legacy Read me keeps its layout + device logo with only text
   de-branded; a v0.68.99-damaged Read me gets the full content restored.
