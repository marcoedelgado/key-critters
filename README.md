# 🎹 Key Critters

A tiny web app that teaches a 5–6 year old to play a real keyboard. It listens through the
iPhone's microphone, so the keyboard needs no MIDI or USB. Each note has a colour and an animal:

| Note | Colour | Animal |
|------|--------|--------|
| C | red | 🐱 Cat |
| D | orange | 🐶 Dog |
| E | yellow | 🐘 Elephant |
| F | green | 🐸 Frog |
| G | cyan | 🦒 Giraffe |
| A | indigo | 🐜 Ant |
| B | pink | 🐻 Bear |

Put matching coloured stickers on the real keys, starting from **middle C**. On a 61-key keyboard
that's the **3rd C from the left**. A C is the white key just left of each pair of black keys.

## Files

- `index.html`: the whole app (inline CSS + JS, no external requests)
- `manifest.webmanifest`: home-screen app settings
- `icon-180.png`, `icon-192.png`, `icon-512.png`: icons (regenerate with `python make_icons.py`)
- `test/pitch-test.js`: offline check of the pitch detector (`node test/pitch-test.js`)

## Deploy to GitHub Pages

1. Sign in at <https://github.com> and click **New repository**. Name it e.g. `key-critters`,
   set it to **Public** and click **Create repository**.
2. On the empty repo page, click **uploading an existing file**. Drag in `index.html`,
   `manifest.webmanifest`, the three `icon-*.png` files and this `README.md`.
   Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set **Source** to
   *Deploy from a branch*, **Branch** to `main` and the folder to `/ (root)`. Click **Save**.
4. Wait a minute, then refresh the page. It shows your URL, e.g.
   `https://<your-username>.github.io/key-critters/`.

The page must be served over HTTPS (GitHub Pages is), or the microphone won't work.

Or, with git:

```sh
git init && git add . && git commit -m "Key Critters"
git branch -M main
git remote add origin https://github.com/<your-username>/key-critters.git
git push -u origin main
```

## Add to the iPhone home screen

1. Open the Pages URL in **Safari**. It must be Safari, not Chrome.
2. Tap the **Share** button (square with an up arrow), then **Add to Home Screen**, then **Add**.
3. Launch **Key Critters** from the home screen. It opens full screen with no browser bars.
4. Tap **Let's play!** and allow microphone access when asked.

If you tapped "Don't Allow" by mistake, go to Settings → Safari → Microphone (or remove and re-add
the home-screen app). The on-screen keys still work without the mic.

## Keyboard set-up tips

- Choose the **Piano** voice.
- Keep **rhythm, accompaniment and chord mode off**.
- Use a **medium volume**, with the phone on the music stand.
- If notes are missed, raise **Mic sensitivity** in the Grown-ups section. If noise triggers notes, lower it.
- Any octave counts, so a C anywhere on the keyboard counts as C.
