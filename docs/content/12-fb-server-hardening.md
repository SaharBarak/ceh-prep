# 12 — Facebook Share: Server Configuration vs Secure Code

- **Source:** Facebook share — https://www.facebook.com/share/1CrY4K7dd9/
  - Redirects to: `https://www.facebook.com/photo.php?fbid=26674232692242004&set=a.792990550792906&type=3`
- **Shared:** 2026-05-13
- **Media:** Facebook photo post (image — not a video)
- **GitHub repos:** unknown (full caption not accessible)
- **External links:** unknown

## Status: only the OG meta-description fragment is available

`yt-dlp` and `gallery-dl` do not support Facebook `share/photo` permalinks. The public OG meta `<description>` (truncated by FB to ~200 chars) reads:

> Most developers focus on writing secure code.
>
> But deploy that same code on a poorly configured server, and it doesn't matter how clean your code is; …

The remainder of the caption is JavaScript-injected and not present in static HTML for anonymous viewers.

## To capture this post

Open the URL in a logged-in browser, copy the full post text + author, and append below — then update this file.

```bash
# Best-effort cookie route (Chrome, while logged in to facebook.com):
curl -sL -A 'Mozilla/5.0' -b "$(/Users/saharbarak/...read FB cookies...)" \
  "https://www.facebook.com/share/1CrY4K7dd9/" \
  > /tmp/fb-share.html
```

## Inferred topic

Server hardening / "secure code on insecure infrastructure" — likely a list-style post about misconfigurations (TLS, headers, OS hardening, exposed services) that nullify secure code. No further evidence is available without an authenticated fetch.
