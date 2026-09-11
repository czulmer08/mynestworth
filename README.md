# NestBest™

**The financial home for your household — plan, budget, build.**
Live at **[mynestbest.com](https://mynestbest.com)**.

NestBest is a private, browser-based budgeting and net-worth app for households. It brings your spending, paychecks, savings goals, cash flow, and net worth together in one place, with paycheck-aware planning and a plain-English assistant (Wren) that reads the same numbers the app computes. There's nothing to install — it runs in your browser and adds to your home screen as a PWA.

## About this repository

This repository hosts the **deployed static site** served via GitHub Pages: the landing page, the app, the supporting pages (About, Privacy, Terms), and the PWA assets. It is the published build, not the development source — application development, tests, and release tooling live in a separate private repository.

## Privacy by architecture

NestBest has no server that holds your money data. The app talks **directly from your browser to Google**, and your budget lives in **your own Google Drive**:

- It uses a single, narrow Google permission — **`drive.file`** — so it can only see the budget files it creates or that you explicitly open, never your whole Drive.
- There is **no NestBest database** of your household's numbers and **no advertising profile** built on your spending.
- App settings are stored **locally in your browser**. Optional receipt scanning uses Google's Gemini with a key **you** provide, and a shared key (if you use one) is stored in **your own** Drive.

Full details are in the [Privacy Policy](https://mynestbest.com/privacy.html). The OAuth client ID and Google Picker API key visible in the source are public-by-design browser credentials — the Picker key is restricted to approved website referrers, and the app requests only `drive.file`.

## Existing NestWorth users

NestBest is the continuation of NestWorth. **Your existing budgets stay in your Google Drive and keep working — no migration, no re-setup.** The app is backward-compatible with existing NestWorth budget folders and sheets.

## Tech

A single-file HTML/CSS/JavaScript progressive web app. No backend, no build step required to run it. Google Drive and Sheets are the only external services, reached directly from the browser.

## Author

Created by **Dr. Candice Z. Ulmer Holland, Ph.D.**, a product of **Ulmer Consulting LLC**.
Questions or feedback: [ulmer.holland.consulting@gmail.com](mailto:ulmer.holland.consulting@gmail.com)

---

NestBest™ is a trademark of Ulmer Consulting LLC.
© 2026 Ulmer Consulting LLC. All rights reserved.
