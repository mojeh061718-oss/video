# KidTube 📺

A kid-safe YouTube viewer you control. Built for one little viewer and the
grown-up who curates her world.

- **Her feed only shows channels you approve.** No algorithm, no rabbit holes.
- **Block anything**: whole channels, single videos, or words — add "whining"
  or "Elmo" and every matching video disappears instantly, even from favorites.
- **She can favorite videos** with big heart buttons and find them in her own
  Favorites tab.
- **Parent area locked behind a PIN** (hold the little gear for 3 seconds).
- **Never touches your YouTube account** — your recommendations and watch
  history stay exactly as they are.
- Installs on an iPad like a real app (it's a PWA — no App Store needed).

## One-time setup

### 1. Turn on GitHub Pages

In this repository: **Settings → Pages → Source → "GitHub Actions"**.
After the next push to `main`, the app is live at
`https://<your-username>.github.io/video/`.

### 2. Get a free YouTube API key (~2 minutes)

The app needs its own key to list videos, so it never uses your account:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. Create a project (call it "KidTube").
3. **APIs & Services → Library** → search **"YouTube Data API v3"** → **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key** — copy it.
5. Recommended: edit the key and under **Website restrictions** add your
   Pages address (`https://<your-username>.github.io/*`). The key is visible
   to anyone who inspects the app, and this restriction makes it useless to them.

The free quota is 10,000 units/day; this app uses roughly 1,000 on a heavy day.
The app walks you through this again on first launch, and you can skip it and
add the key later in Settings.

### 3. Install it on the iPad

1. Open the app's address in **Safari**.
2. Complete the setup wizard (PIN → API key → approve her first channels).
3. Tap **Share → Add to Home Screen → Add**.
4. Open it from the home screen and hand it over. 🎉

## Ad-free playback with your YouTube Premium

YouTube Premium removes ads only inside YouTube's own apps, so KidTube has two
playback modes (parent **Settings → Playback**):

- **Locked-In** (default): videos play inside KidTube. She can't wander off,
  but "made for kids" pre-roll ads can appear.
- **Ad-Free**: tapping a video opens it in the **YouTube app**, which plays it
  with zero ads on her Premium profile. Setup:
  1. Add her to your Premium **family plan** at
     [families.google.com](https://families.google.com) (create her child
     account with Family Link if needed).
  2. Install the YouTube app on the iPad and sign in as **her profile — never
     yours**. Her watching goes to *her* history; your feed is untouched.
  3. In her YouTube settings, turn **autoplay off** and set her supervised
     content level.

  Trade-off: during playback she's in the real YouTube app, so she can tap
  around there until she comes back to KidTube.

## Everyday parenting controls

- **Open the parent area**: press and hold the faint ⚙️ in the top corner for
  3 seconds, then enter your PIN.
- **Quick-block from her feed**: long-press any video (or tap its ⋯ button),
  enter your PIN, then choose *Block this video*, *Block this channel*, or
  *Block a word…*. It vanishes immediately.
- **Blocked words** match titles, descriptions, and channel names,
  case-insensitively. "cry" also catches "crying".
- **Backup**: Settings → *Copy backup* copies all your channels, blocklists,
  and favorites as text. Paste it into *Restore backup* on a new device.

**Forgot your PIN?** Everything is stored on the device only. In Safari:
Settings → Safari → Advanced → Website Data → delete this site's data (or
uninstall/reinstall the home-screen app), then run setup again. Restore from a
backup afterwards if you have one.

## Development

```bash
npm install
npm run dev            # local dev server
npm test               # unit tests (vitest)
npm run test:e2e       # e2e tests (playwright, fully mocked — no API key needed)
npm run build          # production build to dist/
node scripts/make-icons.mjs   # regenerate the PWA icons
```

Open `http://localhost:5173/video/?mock=1` to run against deterministic mock
data with no API key (add `?mock=0` to turn it off; `?mock=quota` simulates a
quota-exhausted day).

### Notes

- Streaming uses YouTube's official embedded player (`youtube-nocookie.com`)
  with no sign-in. KidTube deliberately has **no video downloading** —
  YouTube's terms only allow downloads inside YouTube's own apps.
- All data lives on the device (localStorage + IndexedDB). There is no backend
  and no analytics.
