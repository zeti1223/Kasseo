<div align="center">

# ![Kasseo logo](public/default.png)

# Split the fund. Not the trust.

[![Hackatime Badge](https://hackatime-badge.hackclub.com/U0BDKTP2RR8/Kasseo)](https://hackatime.hackclub.com/@Zeti_1223/project/Kasseo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883.svg?logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime%20DB-ffca28.svg?logo=firebase)](https://firebase.google.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-119eff.svg?logo=capacitor)](https://capacitorjs.com/)

An app for keeping track of money you share with other people: a flat's grocery fund, a trip, a friend group's kitty.
It runs in the browser, ships as an Android app, and keeps working when your connection doesn't.

> **How to say it:** *kaːsˈø*

</div>

---

## What it does

- **Two modes.** *Kitty* is one shared pot that people pay into and spend from. *Split* is for "I paid, you owe me": costs are split equally or by custom percentages, and the app works out who owes whom.
- **Live sync.** Everything updates instantly for all members through Firebase.
- **Offline support.** Data is cached locally, and changes you make without a connection are queued and sent once you're back online.
- **Budgets.** Monthly limits per category, with warnings at 80% and 100%, and optional rollover of what's left (or overspent).
- **Receipt scanning.** Snap a photo and Gemini pulls out the items and categories. It runs through a small Cloudflare Worker so your API key stays private.
- **Recap.** A Spotify-Wrapped-style summary of your fund that you can download as images and share.
- **Charts.** Balance history, spending by category, who contributed what, monthly cash flow, and settlements in Split mode.
- **Import and export.** Bring your history over from Splitwise, Splital or a Kasseo backup, and export to CSV or JSON any time.
- **Search and filters** by text, type, category, member and date.
- **13 currencies**, with old transactions keeping their value if you change the base currency.
- **Push notifications** through OneSignal, in each member's own language, plus invite links and QR codes.
- **Themes and languages.** Light, dark or system theme, custom icons, colors and categories, and six languages: English, Deutsch, Français, Español, Magyar and 中文.

---

## Roles

| What you can do | Member | Admin | Owner |
|---|:---:|:---:|:---:|
| Add transactions, scan receipts, view stats, invite people | ✓ | ✓ | ✓ |
| Edit and delete your own transactions | ✓ | ✓ | ✓ |
| Edit and delete other people's transactions | – | ✓ | ✓ |
| Change fund settings (name, icon, currency, mode, categories, budgets) | – | ✓ | ✓ |
| Import data, promote, demote and remove members | – | ✓ | ✓ |
| Delete the fund or transfer ownership | – | – | ✓ |

A fund always needs at least one Admin, so the last one can't be demoted, removed or leave until someone else takes over.

---

## Built with

Vue 3, Vite, Pinia, Tailwind CSS, Firebase (Realtime Database and Auth), IndexedDB, Chart.js, i18next, OneSignal, Capacitor for Android, and Vitest for tests. Receipt scanning uses the Gemini API behind a Cloudflare Worker.

---

## Running it yourself

You'll need Node.js (v18+) and a Firebase account.

```bash
git clone https://github.com/zeti1223/Kasseo.git
cd Kasseo
npm install
cp .env.example .env
```

1. Create a Firebase project, enable **Google** sign-in under Authentication, and create a **Realtime Database**.
2. Deploy the rules from [database.rules.json](database.rules.json).
3. Fill in your Firebase details in `.env`.
4. Optional: set up the receipt scanner using the [worker guide](worker/README.md), and add your OneSignal keys for push notifications. Anything you leave blank is just switched off.

Then:

```bash
npm run dev      # start the dev server
npm run build    # production build
npm test         # run the tests
```

For Android, `npm run cap:build` builds and syncs the app, and `npm run cap:open` opens it in Android Studio. Pushing a version tag like `v0.3.0` triggers a GitHub Actions workflow that publishes signed APKs.

---

## Adding a language

Copy `src/i18n/locales/en.json` to a new file for your language, translate it, and register it in `src/i18n/index.js` (in `SUPPORTED_LANGUAGES` and `resources`). Push notifications will pick it up automatically.

---

## License

[MIT](LICENSE)

---

<div align="center">

*This project has nothing to do with [KASSEO](https://open.spotify.com/artist/76UKhIGvZtS7jjb1muDTUM?si=U4IUSirBQDuLucBmK3mR0Q&utm_source=copy_link), but if you feel like it, give it a listen.*

</div>