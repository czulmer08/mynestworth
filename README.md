# NestBest™

**The financial home for your household.**

NestBest is a private, phone-first personal budgeting app. Your budget lives in a Google Sheets file in **your own Google Drive**; NestBest runs in your browser and communicates directly with Google APIs rather than sending your financial data through a NestBest server or database.

It brings budgeting, cash flow, goals, and net worth into one household financial view, with Wren providing scripted explanations of numbers the app has already calculated.

## Live site

**https://mynestbest.com**

The public site is hosted with GitHub Pages. This repository contains the files required to serve the production site, including:

- `index.html` — public landing page
- `app.html` — production NestBest application
- `about.html` — product overview
- `privacy.html` — privacy policy
- `terms.html` — terms of use
- `manifest.webmanifest` and icons — PWA metadata and assets
- `sw.js` — service worker
- `wren/` — Wren character artwork used by the app

## Privacy by design

NestBest is designed so household financial information remains in the user's Google account. The app requests Google's limited `drive.file` permission, which allows it to work with files it creates or that the user explicitly opens with it rather than providing general access to the user's Drive.

NestBest does not use advertising or third-party analytics. See [`privacy.html`](privacy.html) for the full privacy policy.

## Compatibility files

Some filenames and internal identifiers intentionally retain the original **NestWorth** name for backward compatibility with existing users and budgets. In particular, **do not rename or remove `nestworth-template.xlsx` solely for branding purposes**; the production application intentionally references that legacy filename.

## Development and deployment

This is the **public production repository**, not the authoritative development repository. Source development, automated verification, audit documentation, build provenance, and release gating are maintained separately. Production changes should come through the validated release process rather than by editing `app.html` directly.

---

NestBest™ is a product of **Ulmer Consulting LLC**. It is not financial, tax, or investment advice.
