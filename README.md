# ![Kasseo logo](public/default.png)

# Split the fund. Not the trust.

[![Hackatime Badge](https://hackatime-badge.hackclub.com/U0BDKTP2RR8/Kasseo)](https://hackatime.hackclub.com/@Zeti_1223/project/Kasseo)

A modern financial app for managing shared expenses and funds — built as a web app and packaged as a native Android app via Capacitor.

> ### *Pronunciation:* kaːsˈø

---

## Features

- **User authentication**: Sign in with Google OAuth, powered by Firebase Authentication (supports both Web and native Android login).
- **2 Fund Modes**:
  - **Kitty mode**: A shared pool that members deposit into and spend from.
  - **Split mode**: Settle expenses directly with each other, split evenly or by custom percentage shares.
- **Real-time transaction tracking**: Instant synchronization of deposits, expenses, and settlements across all members via Firebase Realtime Database.
- **Multi-currency support**: 13 currencies (USD, EUR, HUF, GBP, INR, CHF, JPY, CAD, AUD, CNY, PLN, CZK, RON) with historical exchange-rate conversion so past records retain their original value when a fund's primary currency changes.
- **Detailed analytics & interactive charts**:
  - Balance history over time
  - Member net balances over time (Split mode)
  - Expense breakdown by category
  - Category spending trends
  - Contribution breakdown by member
  - Monthly cash flow
- **AI Receipt scanning**: Capture or upload receipt images to automatically extract and categorize line items using Google Gemini (proxied securely via a Cloudflare Worker).
- **Roles & permissions (Admin vs. Member)**: Role-based permissions to protect fund configuration and manage members securely in groups of any size.
- **Push & browser notifications**: Real-time alerts via OneSignal whenever a member adds, edits, or deletes a transaction, joins/leaves a group, or modifies fund details — automatically translated into each recipient's chosen language.
- **Member invitations**: Invite others seamlessly with shareable join links and QR codes.
- **Custom fund styling & categories**: Personalize funds with custom icons/colors and create user-defined expense categories with custom icons.
- **Data export**: Export transaction history to CSV and JSON formats.
- **Internationalization**: Full multi-language UI supporting 6 languages: English, Hungarian, German, French, Spanish, and Chinese.
- **Dark mode**: Seamless Light, Dark, and System-matched themes.
- **Native Android app**: Cross-platform architecture packaged into a native Android app via Capacitor.

---

## Roles & Permissions

Kasseo supports role-based access control to keep funds organized and secure:

| Capability | Member | Admin | Owner |
|---|:---:|:---:|:---:|
| Add transactions, deposits & settlements | ✅ | ✅ | ✅ |
| Edit & delete own transactions | ✅ | ✅ | ✅ |
| Scan receipts with AI | ✅ | ✅ | ✅ |
| Set personal fund theme color | ✅ | ✅ | ✅ |
| View analytics, balance history & exports | ✅ | ✅ | ✅ |
| Invite members & add placeholder members | ✅ | ✅ | ✅ |
| Edit & delete other members' transactions | ❌ | ✅ | ✅ |
| Rename fund & change central fund icon | ❌ | ✅ | ✅ |
| Change fund currency (with historical recalculation) | ❌ | ✅ | ✅ |
| Change fund mode (*Kitty* / *Split*) | ❌ | ✅ | ✅ |
| Add & remove custom categories | ❌ | ✅ | ✅ |
| Promote members to Admin & demote Admins | ❌ | ✅ | ✅ |
| Remove members from fund | ❌ | ✅ | ✅ |
| Delete fund | ❌ | ❌ | ✅ |
| Transfer fund ownership | ❌ | ❌ | ✅ |

> - **Owner**: The fund creator (or designated successor) who holds the ownership crown. The Owner has full Admin permissions, is the only one who can delete the fund or transfer ownership.
> - **Admin**: Managers with permissions to configure the fund, manage categories, moderate transactions, and promote/remove members.
> - **Member**: Standard participants who can manage their own expenses, view analytics, and invite others.
> - **Last Admin protection**: A fund must always have at least one Admin. The last remaining admin cannot be demoted, removed, or leave the fund without first appointing another admin (or deleting the fund if Owner).

---

## Tech Stack

- **Frontend**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + PostCSS / Autoprefixer
- **Routing**: [Vue Router](https://router.vuejs.org/)
- **Internationalization**: [i18next](https://www.i18next.com/) / `i18next-vue`
- **Backend & Database**: [Firebase](https://firebase.google.com/) (Authentication & Realtime Database)
- **AI & Serverless Worker**: [Google Gemini API](https://ai.google.dev/) via [Cloudflare Workers](https://workers.cloudflare.com/) (Wrangler)
- **Charts & Visualization**: [Chart.js](https://www.chartjs.org/) + `vue-chartjs`
- **Icons & UI**: [Font Awesome](https://fontawesome.com/), `flag-icons`, `qrcode.vue`
- **Push Notifications**: [OneSignal](https://onesignal.com/) (Web Push + `onesignal-cordova-plugin`)
- **Native App Packaging**: [Capacitor](https://capacitorjs.com/) (Android)
- **Testing**: [Vitest](https://vitest.dev/) + `@vue/test-utils` + `jsdom`
- **Hosting & CI/CD**: Firebase Hosting, GitHub Actions

---

## Project Structure

```
.
├── src/
│   ├── assets/         # Global styles and static assets
│   ├── components/     # UI components organized by domain / feature
│   │   ├── charts/     # Chart.js visualizations
│   │   ├── common/     # Reusable UI primitives (dialogs, stat cards, etc.)
│   │   ├── features/   # Feature modules (auth, dashboard, groups, transactions, settings, export)
│   │   └── layouts/    # App layout components (Navbar, Footer)
│   ├── constants/      # App URLs, categories, currencies, fund style presets
│   ├── i18n/           # i18next configuration and locale translations
│   ├── router/         # Vue Router configuration and route guards
│   ├── services/       # Firebase, currency conversion, push notifications
│   ├── stores/         # Pinia stores (auth, groups, transactions, settings)
│   ├── utils/          # Formatting, chart helpers, export utils, receipt scanning
│   ├── views/          # Top-level views (Landing, Dashboard, Group)
│   └── App.vue         # Root application component
├── tests/              # Unit and component test suites (Vitest)
│   ├── components/     # Component tests
│   └── unit/           # Store, service, and utility tests
├── worker/             # Cloudflare Worker proxy for Gemini receipt scanning
├── android/            # Capacitor-generated native Android project
└── public/             # Static public assets (icons, logos, manifest)
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/zeti1223/Kasseo.git
cd Kasseo
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Google Authentication** under Authentication > Sign-in method.
3. Create a **Realtime Database** instance.
4. Deploy the rules from `database.rules.json` to your Realtime Database.

### 4. Optional Integrations

- **Google Gemini (Receipt Scanning)**:
  Receipt scanning runs via a serverless proxy on Cloudflare Workers so API keys remain secure. See [worker/README.md](worker/README.md) to set up and deploy the worker.
- **OneSignal (Push Notifications)**:
  Create an app in [OneSignal](https://onesignal.com/) and obtain your App ID and REST API Key.

### 5. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure your `.env` file:

```env
# Firebase Configuration (Required)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Cloudflare Worker for Receipt Scanning (Optional)
VITE_SCAN_WORKER_URL=https://your-worker-subdomain.workers.dev

# OneSignal Push Notifications (Optional)
VITE_ONESIGNAL_APP_ID=your_onesignal_app_id
VITE_ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

> [!NOTE]
> Integrations left unconfigured in `.env` are gracefully disabled at runtime. The core app remains fully functional without them.

---

## Scripts & Development

### Web App

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server with hot module replacement |
| `npm run build` | Build the optimized web application for production |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run test suites using Vitest |
| `npm run test:watch` | Run tests in interactive watch mode |

### Android (Capacitor)

| Command | Description |
|---|---|
| `npm run cap:build` | Build the web app and sync assets into the Android native project |
| `npm run cap:sync` | Sync web build output (`dist/`) to the native Android directory |
| `npm run cap:open` | Open the native Android project in Android Studio |

> Tagged commits (e.g., `v1.0.0`) trigger GitHub Actions to automatically build and publish signed release APKs.

### Receipt Scanner Worker

```bash
cd worker
npm install
npm run deploy    # Deploy to Cloudflare Workers via Wrangler
```

---

## Adding a Language

1. Add a new locale file in `src/i18n/locales/<code>.json` using `en.json` as a reference.
2. Register the language code and name in `src/i18n/index.js` in both `SUPPORTED_LANGUAGES` and `resources`.
3. Outgoing push notifications are automatically translated into all languages configured in `SUPPORTED_LANGUAGES`.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*This project has nothing to do with [KASSEO](https://open.spotify.com/artist/76UKhIGvZtS7jjb1muDTUM?si=U4IUSirBQDuLucBmK3mR0Q&utm_source=copy_link), but if you feel like it, give it a listen.*
