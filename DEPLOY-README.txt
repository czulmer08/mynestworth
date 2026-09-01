mynestworth — LIVE SITE (what users load)   ·   v0.68.82  Build 20260901.170
============================================================================
app.html  = the minified production build (~793 KB). Replace the served file with this one
            (rename to index.html if that's what your host loads).

production sha256: e22132858935fbf701906089616d0220606e57c952d464b48c615d6f6ac8ad76

AFTER YOU PUSH (important — keeps the ledger honest):
  In the dev repo's DEPLOYED.md, set the public.* rows to this build and confirm the deploy:
    public.version: 0.68.82
    public.build:   20260901.170
    public.sha256:  e22132858935fbf701906089616d0220606e57c952d464b48c615d6f6ac8ad76
    public.confirmed: <today's date, e.g. 2026-09-02>
  Then run:  node verify-build-provenance.js   (it will confirm public == production legitimately)

Until you do that, DEPLOYED.md correctly shows public still on the PREVIOUS build — the source
repo being at v0.68.82 does NOT mean the public site is. That separation is the point.

Verification (this minified file): engine/golden math 60/60; surface-provenance 13/13; all
Playwright suites green. (4 golden "source-text" lints apply to readable source only, not minified.)
