# mynestbest.com — iMessage / social preview fix

## Diagnosis (from what the live site actually serves)
Fetched `https://mynestbest.com` and read its head. Two problems, both on the **public landing page** (not the app):

1. **`og:image` and `twitter:image` are RELATIVE paths** (`nestbest-social-preview.png`), not absolute URLs, and `og:url` +
   `<link rel="canonical">` are **absent**. Apple Messages (and most scrapers) require an **absolute** `og:image` URL and
   won't resolve a relative one — that's the gray box. Title + domain still render because those are plain text.
   The image file itself **is** reachable at the absolute URL; only the *reference* is relative.
2. **The deployed preview image is stale** — the copy on the server (and one of our repo copies) still reads
   **"PLAN • BUDGET • GROW"**, the pre-rebrand tagline. The correct current image reads **"PLAN • BUDGET • BUILD"** (™).

Root cause of #1: the corrected `index.html` (this package's `index_public.html`, which already has absolute OG URLs +
canonical, dated from the rebrand) was **never deployed** — the live page is an older index with relative image URLs.

## The fix (two changes to the public repo)
### A. Serve the image reference ABSOLUTELY (the gray-box fix)
In the landing page `<head>`, the social tags must be exactly:

```html
<link rel="canonical" href="https://mynestbest.com/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NestBest">
<meta property="og:title" content="NestBest — Plan, Budget, Build">
<meta property="og:description" content="Your budget, your savings, and your net worth — quietly in your pocket. Private, no download, works right in your browser.">
<meta property="og:url" content="https://mynestbest.com/">
<meta property="og:image" content="https://mynestbest.com/nestbest-social-preview.png">
<meta property="og:image:secure_url" content="https://mynestbest.com/nestbest-social-preview.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="NestBest — Plan · Budget · Build">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="NestBest — Plan, Budget, Build">
<meta name="twitter:image" content="https://mynestbest.com/nestbest-social-preview.png">
<meta name="twitter:image:alt" content="NestBest — Plan · Budget · Build">
```

The essential change is that **`og:image` and `twitter:image` are full `https://mynestbest.com/...` URLs**. Everything else
(og:url, canonical, og:image:type/secure_url) hardens it. `index_public.html` in this package already contains exactly this —
you can deploy it wholesale IF it matches your current landing copy, or just apply the tags above surgically to the live file.

### B. Put the correct image on the server
Upload **`nestbest-social-preview.png`** from this package (1200×630, "PLAN • BUDGET • BUILD", sha256
`50b77f2a238f45df13643521c875705b777969581186e89e026040dc3276483e`) to the public repo root, replacing whatever
`nestbest-social-preview.png` is there now (which may still say GROW).

## Testing (don't judge by the cached URL)
Messages caches previews per URL. After deploying, **do NOT** re-send the identical link — it'll show the cached gray box.
Send a fresh URL so it re-scrapes: `https://mynestbest.com/?v=2` (any new query works). It should then show the
cream/green/gold NestBest lockup with "PLAN • BUDGET • BUILD". Optionally validate with a scraper-style tool before sharing.

## Scope
Public-site only — no app change, nothing to do with v0.68.105. Safe to ship independently.
