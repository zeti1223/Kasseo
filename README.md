# ![Kasseo logo](public/default.png)

[![Hackatime Badge](https://hackatime-badge.hackclub.com/U0BDKTP2RR8/Kasseo)](https://hackatime.hackclub.com/@Zeti_1223/project/Kasseo)

A modern financial app for managing shared expenses and funds — built as a web app, and packaged as a native Android app via Capacitor.

> ### *Pronunciation:* kaːsˈø

## Functions

- **User authentication**: sign in with Google OAuth, backed by Firebase Authentication (works both on the web and as a native login on Android)
- **2 Modes** per fund:
  - **Kitty mode**: a shared pool everyone deposits into and spends from
  - **Split mode**: members settle expenses directly with each other, split evenly or by custom percentage shares
- **Transaction tracking**: real-time sync of deposits, expenses, and settlements across all members via Firebase Realtime Database
- **Multi-currency support**: 13 currencies (USD, EUR, HUF, GBP, INR, CHF, JPY, CAD, AUD, CNY, PLN, CZK, RON), with automatic historical exchange-rate conversion so past transactions keep their original value when a fund's currency changes
- **Detailed analytics**:
  - Balance history over time
  - Expenses by category, with category trends
  - Breakdown by member
  - Monthly cash flow
- **Receipt scanning**: point the camera at a receipt and let Gemini automatically extract and categorize line items as individual transactions
- **Push & browser notifications**: real-time alerts (via OneSignal) whenever a fund member adds, edits, or deletes a transaction, joins/leaves a group, or renames/re-icons the fund — each recipient sees the notification in their **own** app language, regardless of which language the sender is using
- **Inviting members**: share a link (or QR code) to let others join a fund instantly
- **Custom categories**: create your own expense categories with custom icons
- **Data export**: export a fund's transactions for external use
- **Internationalization**: full UI in 6 languages — English, Hungarian, German, French, Spanish, and Chinese
- **Dark mode**: light, dark, or system-matched theme
- **Native Android app**: the same codebase is packaged into a native Android app via Capacitor, alongside the regular web app

## Tech stack

- **Frontend**: Vue 3 (Composition API)
- **Build tool**: Vite
- **State management**: Pinia
- **Styling**: Tailwind CSS
- **Routing**: Vue Router
- **Internationalization**: i18next / i18next-vue
- **Authentication**: Firebase Authentication (Google OAuth)
- **Database**: Firebase Realtime Database
- **Charts**: Chart.js + vue-chartjs
- **Icons**: Font Awesome, flag-icons
- **Receipt scanning**: Google Gemini API
- **Push notifications**: OneSignal (web push + native via `onesignal-cordova-plugin`)
- **Native app packaging**: Capacitor (Android)
- **Hosting / CI**: Firebase Hosting, GitHub Actions

## Project structure

```
src/
├── components/     # UI components, grouped by feature (dashboard, groups, transactions, settings, ...)
├── views/          # Top-level routed pages (Landing, Dashboard, Group)
├── stores/         # Pinia stores (auth, groups, transactions, notifications, settings)
├── services/       # Firebase config, currency conversion, push notification service
├── router/         # Vue Router setup
├── i18n/           # i18next setup + one JSON locale file per supported language
├── constants/      # Categories, currencies, fund style presets
└── utils/          # Formatting, chart data prep, export, receipt scanning helpers
android/            # Capacitor-generated native Android project
```

## Local dev setup

1. Clone the github repository:

```bash
git clone https://github.com/zeti1223/Kasseo.git
cd Kasseo
```

2. Download dependencies:

```bash
npm install
```

3. Configure Firebase:
   - Create a Firebase project
   - Enable **Google Auth** and **Realtime Database**
   - Deploy the included `database.rules.json` as your database's security rules

4. *(Optional)* Set up the integrations you want to use:
   - **[Google Gemini](https://ai.google.dev/)** — needed for automatic receipt scanning
   - **[OneSignal](https://onesignal.com/)** — needed for push notifications (create an app and grab its App ID and REST API key)

5. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill out the `.env` file:

``` env
# Firebase configuration (required)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

# Google Gemini (optional — needed for receipt scanning)
VITE_GEMINI_API_KEY=

# OneSignal (optional — needed for push notifications)
VITE_ONESIGNAL_APP_ID=
VITE_ONESIGNAL_REST_API_KEY=
```

Any integration whose keys are left blank is simply disabled at runtime — the app still runs without Gemini or OneSignal configured, just without receipt scanning or push notifications.

## Run

Developer setup (web, with hot reload):

```bash
npm run dev
```

Building for production (web):

```bash
npm run build
npm run preview   # preview the production build locally
```

### Android (via Capacitor)

Build the web app and sync it into the native Android project:

```bash
npm run cap:build
```

Open the project in Android Studio:

```bash
npm run cap:open
```

Or just sync an already-built `dist/` folder into the native project:

```bash
npm run cap:sync
```

Tagged pushes (`v*`) also trigger the `Build & Release Android APK` GitHub Actions workflow, which builds and publishes a signed release APK automatically.

## Adding a language

1. Add a new locale file under `src/i18n/locales/<code>.json`, using an existing file (e.g. `en.json`) as the key reference.
2. Register the language in `src/i18n/index.js`, in both `SUPPORTED_LANGUAGES` and the i18next `resources` map.
3. If it should also be used for translated push notifications, no further changes are needed — `notificationService.js` automatically translates outgoing push notifications into every language listed in `SUPPORTED_LANGUAGES`.

---

### [LICENSE](LICENSE)

---

This project has nothing to do with [KASSEO](https://open.spotify.com/artist/76UKhIGvZtS7jjb1muDTUM?si=U4IUSirBQDuLucBmK3mR0Q&utm_source=copy_link), but if you feel like it, give it a listen
