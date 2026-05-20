# 05 — Instagram Post DWX1Jk1k-UK

- **Source:** Instagram post — https://www.instagram.com/p/DWX1Jk1k-UK/
- **Shared:** 2026-04-22
- **GitHub repos:** unknown
- **External links:** unknown

## Status: inaccessible without login

This post (an IG image carousel, not a reel) requires an authenticated Instagram session to fetch caption + media. yt-dlp and gallery-dl both returned `Instagram sent an empty media response` / `400 Bad Request` when accessed anonymously and with available browser cookies.

### What we tried

- `yt-dlp` (anonymous) — empty media response
- `yt-dlp --cookies-from-browser chrome` — empty media response (cookies present but not authenticated for this account)
- `gallery-dl --cookies-from-browser chrome` — `HTTP 400` from `/api/v1/media/3861788959987459338/info/`
- `instaloader` (no session) — `Fetching Post metadata failed`
- IG public embed (`/embed/captioned/`) — JS-rendered shell, no static caption in HTML

### To capture this post

Provide an authenticated session via one of:

```bash
# Option A — log in to instagram.com in Chrome, then:
gallery-dl --cookies-from-browser chrome \
  https://www.instagram.com/p/DWX1Jk1k-UK/

# Option B — instaloader with stored session
instaloader --login <username> -- -DWX1Jk1k-UK
```

Once captured, re-run the analysis pipeline and update this file.
