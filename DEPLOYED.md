# NestWorth — Deployment Ledger

Three distinct facts, never conflated:

- **source** — the readable `app.html` this build came from (authoritative code).
- **production** — the generated minified `github-audit/app.production.html` handed off (the deployable artifact).
- **public** — what is ACTUALLY live in the public `mynestworth` repo. Only a human sets this, after pushing.

The build system can prove `production` corresponds to `source` (identical VERSION/BUILD; recorded hash matches the file).
It CANNOT know what is deployed. Until you push the artifact and set `public.confirmed` to the deploy date, `public`
stays on the PREVIOUS build — it is never bumped just because a newer artifact exists. That gap is the whole point of this
ledger: the readable source can be at v0.68.82 while the public site still serves an older minified build.

`source.*` and `production.*` are written automatically by `github-audit/build-production.py`.
`public.*` is human-maintained — edit it only when you have actually pushed to the public repo.

```provenance
source.version: 0.68.98
source.build: 20260907.3
source.sha256: 3fd3c94a84a2b0a819b911a08ebef8f8f1a2e23cdf88f3939d3b8e7205c1ce90
source.stamped: 2026-09-10

production.version: 0.68.98
production.build: 20260907.3
production.sha256: fdd5cd17e6e214d158f347e1631fe40852dd293fee9c6e109696dbf0aed5f172
production.stamped: 2026-09-10

public.version: 0.68.81
public.build: 20260901.169
public.sha256: unknown
public.confirmed: no
```

**Public row note (as of this handoff):** the last artifact handed off was **v0.68.81 (build 20260901.169)**; whether it
was pushed to the public `mynestworth` repo has not been confirmed here, so `public.confirmed: no`. When you deploy
v0.68.82, set `public.version`/`public.build` to `0.68.82`/`20260901.170`, `public.sha256` to the production hash below,
and `public.confirmed` to the deploy date.

## How to record a deploy

1. Push `github-audit/app.production.html` to the public `mynestworth` repo as the served file.
2. In the `provenance` block above, set the three `public.*` values to match the `production.*` you pushed, and set
   `public.confirmed` to today's date (ISO, e.g. `2026-09-02`).
3. Re-run `node verify-build-provenance.js` — it will now confirm `public == production` legitimately (confirmed), instead
   of flagging that public is claiming "current" without a deploy.
