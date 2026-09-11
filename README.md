<div align="center">

# ![Kasseo logo](public/default.png)

# Split the fund. Not the trust.

[![Hackatime Badge](https://hackatime-badge.hackclub.com/U0BDKTP2RR8/Kasseo)](https://hackatime.hackclub.com/@Zeti_1223/project/Kasseo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883.svg?logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?logo=vite)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime%20DB-ffca28.svg?logo=firebase)](https://firebase.google.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-119eff.svg?logo=capacitor)](https://capacitorjs.com/)

A modern, offline-resilient financial application for managing shared expenses and funds.  
Built as a responsive web app and packaged as a native Android app via Capacitor.

> **Pronunciation:** *kaːsˈø*

</div>

---

## Table of Contents

- [Features](#features)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#1-prerequisites)
  - [Installation](#2-install-dependencies)
  - [Firebase Configuration](#3-configure-firebase)
  - [Optional Integrations](#4-optional-integrations)
  - [Environment Variables](#5-environment-configuration)
- [Scripts & Development](#scripts--development)
  - [Web Application](#web-app)
  - [Android (Capacitor)](#android-capacitor)
  - [Receipt Scanner Worker](#receipt-scanner-worker)
- [Internationalization](#internationalization)
- [License](#license)

---

## Features

### Fund Modes & Shared Finance

- **Kitty Mode**: A pooled shared fund where members make deposits and withdraw expenses together.
- **Split Mode**: Track shared purchases directly between members, splitting costs equally or by custom percentage shares with real-time settlement calculation.
- **Real-Time Synchronization**: Instant data sync across all group members via Firebase Realtime Database.

### Offline Mode & Resilient Sync

- **Instant Cold Starts**: Persistent IndexedDB storage caches funds, member data, and transaction history for immediate offline access.
- **Last Synced Freshness Indicator**: Live indicator showing the exact relative time since data was last synchronized with the cloud.
- **Offline Mutation Queue**: Add, update, or remove transactions even without an internet connection. Changes are safely queued in chronological order and automatically flushed to Firebase as soon as connectivity resumes.

### Per-Category Budgets & Rollover

- **Category Spending Limits**: Set target monthly budgets across standard or custom categories.
- **Visual Progress & Alerts**: Dynamic progress bars indicating budget usage with warning (80%) and exceeded (100%) thresholds.
- **Monthly Rollover**: Option to carry over unspent budget as additional spending credit in the following month (or carry forward deficits).

### Fund Recap ("Wrapped")

- **Periodic Financial Highlights**: Interactive, Spotify-Wrapped style recap cards highlighting annual or all-time spending trends.
- **Key Statistics**: Total spent and deposited, top spending categories, largest single expense, peak spending month, and top contributors.
- **Exportable Recap Cards**: Generate and download visually styled recap cards directly to your device to share with your group.

### AI Receipt Scanning

- **Automatic Line Item Extraction**: Upload receipt photos or capture them via camera to extract and categorize expense items automatically.
- **Secure Serverless Proxy**: Powered by Google Gemini through a Cloudflare Worker proxy, keeping API keys secure, verifying caller tokens, and enforcing daily quota limits.

### Seamless Data Import & Export

- **Multi-Source Import**: Migrate expense history directly from **Splitwise** (CSV), **Splital** (JSON), and **Kasseo backup files** (CSV & JSON) with automated category mapping, currency symbol normalization, and conflict resolution.
- **Data Export**: Export fund records and filtered transactions to clean **CSV** and **JSON** files anytime.

### Search & Multi-Facet Filtering

- **Live Search**: Rapidly find transactions by description, notes, or payer.
- **Filters**: Filter transaction history by type (*Expense*, *Deposit*, *Settlement*), category, member, or date intervals (*This Month*, *Last Month*, *This Year*, or custom date ranges).

### Detailed Analytics & Charts

- Dynamic visualizations powered by Chart.js:
  - Fund balance history over time
  - Member net balances and settlement flow (Split mode)
  - Expense breakdown by category
  - Category spending trends
  - Member contribution distribution
  - Monthly cash flow

### Multi-Currency & Historical Conversion

- **13 Global Currencies**: Full support for `USD`, `EUR`, `HUF`, `GBP`, `INR`, `CHF`, `JPY`, `CAD`, `AUD`, `CNY`, `PLN`, `CZK`, and `RON`.
- **Historical Recalculation**: Changing a fund's base currency preserves the historical purchasing power of existing transactions via recorded exchange rates.

### Notifications & Member Invites

- **Push & Web Notifications**: Real-time push alerts powered by OneSignal whenever transactions are added, edited, or deleted, or when fund details change.
- **Multilingual Delivery**: Outgoing notifications are automatically delivered in each member's chosen language.
- **Shareable Join Links & QR Codes**: Invite new members effortlessly using direct links or scannable QR codes.

### Personalization & Accessibility

- **Theming**: Full support for Light, Dark, and System-preferred color modes.
- **Custom Fund Identity**: Customize fund icons and theme colors, and define custom expense categories with custom icons.
- **6 Supported Languages**: English, Deutsch, Français, Español, Magyar, and 中文.
- **Cross-Platform Native Experience**: Built for modern browsers and packaged for native Android devices via Capacitor.

---

## Roles & Permissions

Kasseo enforces role-based access control (RBAC) to ensure group funds remain organized and protected against accidental modifications:

| Capability | Member | Admin | Owner |
|---|:---:|:---:|:---:|
| Add transactions, deposits & settlements | ✓ | ✓ | ✓ |
| Edit & delete own transactions | ✓ | ✓ | ✓ |
| Scan receipts with AI | ✓ | ✓ | ✓ |
| Set personal fund theme color | ✓ | ✓ | ✓ |
| View analytics, balance history, recap & exports | ✓ | ✓ | ✓ |
| Invite members & add placeholder members | ✓ | ✓ | ✓ |
| Edit & delete other members' transactions | – | ✓ | ✓ |
| Rename fund & change central fund icon | – | ✓ | ✓ |
| Change fund currency (with historical recalculation) | – | ✓ | ✓ |
| Change fund mode (*Kitty* / *Split*) | – | ✓ | ✓ |
| Add, edit & remove custom categories | – | ✓ | ✓ |
| Configure per-category budgets & rollover | – | ✓ | ✓ |
| Import external transactions (Splitwise, Splital, Kasseo) | – | ✓ | ✓ |
| Promote members to Admin & demote Admins | – | ✓ | ✓ |
| Remove members from fund | – | ✓ | ✓ |
| Delete fund | – | – | ✓ |
| Transfer fund ownership | – | – | ✓ |

> **Role Hierarchy Details:**
> - **Owner**: The fund creator or designated successor. Holds full administrative permissions and is the only role authorized to delete the fund or transfer ownership.
> - **Admin**: Managers with permissions to configure fund settings, manage categories, set budgets, moderate transactions, import data, and promote or remove members.
> - **Member**: Standard participants who can log transactions, scan receipts, view analytics, and invite others.
> - **Last Admin Protection**: A fund must always have at least one active Admin. The last remaining admin cannot be demoted, removed, or leave the fund without appointing another admin first.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`) |
| **Build & Tooling** | [Vite 6](https://vitejs.dev/) |
| **State Management** | [Pinia 2](https://pinia.vuejs.org/) |
| **Styling & UI** | [Tailwind CSS 3](https://tailwindcss.com/), PostCSS, Autoprefixer |
| **Routing** | [Vue Router 4](https://router.vuejs.org/) |
| **Internationalization** | [i18next](https://www.i18next.com/) & `i18next-vue` |
| **Backend & Auth** | [Firebase](https://firebase.google.com/) (Realtime Database & Authentication) |
| **Offline Storage** | IndexedDB (native browser persistence & custom replay queue) |
| **AI Receipt Scanning** | [Google Gemini API](https://ai.google.dev/) via [Cloudflare Workers](https://workers.cloudflare.com/) |
| **Charts & Visualization** | [Chart.js 4](https://www.chartjs.org/) & `vue-chartjs` |
| **Push Notifications** | [OneSignal](https://onesignal.com/) (Web Push & `onesignal-cordova-plugin`) |
| **Mobile Packaging** | [Capacitor 8](https://capacitorjs.com/) (Android) |
| **Testing** | [Vitest](https://vitest.dev/), `@vue/test-utils`, `jsdom` |
| **Hosting & CI/CD** | Firebase Hosting, GitHub Actions (Automated testing & APK release builds) |

---

## Project Structure

``` folder
.
├── src/
│   ├── assets/              # Global CSS stylesheets and static assets
│   ├── components/
│   │   ├── charts/          # Chart.js visualization components
│   │   ├── common/          # Reusable UI primitives (dialogs, stat cards, language selector)
│   │   ├── features/        # Domain-driven feature modules
│   │   │   ├── auth/        # Authentication and join screens
│   │   │   ├── dashboard/   # Main dashboard, fund cards, and recent activity
│   │   │   ├── export/      # CSV/JSON data export dialog
│   │   │   ├── groups/      # Group management, budget progress, balance panels
│   │   │   ├── import/      # Multi-platform data import dialog
│   │   │   ├── recap/       # Fund recap cards, animated stats, and visual generator
│   │   │   ├── settings/    # Fund & user settings tabs (budgets, categories, members, style)
│   │   │   └── transactions/# Transaction lists, forms, filters, and receipt scanner
│   │   └── layouts/         # Navigation bar, footer, and shell layouts
│   ├── composables/         # Shared composables (e.g., animated count-up)
│   ├── constants/           # Currency definitions, categories, and fund style presets
│   ├── i18n/                # Localization configuration and translation files
│   ├── router/              # Vue Router configuration and route guards
│   ├── services/            # Firebase client, notification service, and offline database/sync
│   │   ├── firebase/        # Firebase app and RTDB initialization
│   │   └── offline/         # IndexedDB caching, network watcher, and replay queue
│   ├── stores/              # Pinia stores (auth, groups, transactions, notifications, settings)
│   ├── utils/               # Currency calculations, chart data, budget logic, recap helpers, parsers
│   ├── views/               # Top-level view routes (Landing, Dashboard, Group)
│   └── App.vue              # Root Vue application
├── tests/                   # Vitest unit and component test suites
│   ├── components/          # Component mount and render tests
│   └── unit/                # Utilities, stores, constants, and offline service tests
├── worker/                  # Cloudflare Worker proxy for Gemini receipt scanning
├── android/                 # Capacitor native Android project
└── public/                  # Static assets (favicons, manifests, default logos)
```

---

## Getting Started

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (bundled with Node.js)
- A [Firebase](https://console.firebase.google.com/) account

### 2. Install dependencies

```bash
git clone https://github.com/zeti1223/Kasseo.git
cd Kasseo
npm install
```

### 3. Configure Firebase

1. Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Authentication** > **Sign-in method** and enable **Google**.
3. Create a **Realtime Database** instance.
4. Deploy the security rules defined in [database.rules.json](database.rules.json) to your Realtime Database.

### 4. Optional Integrations

- **Google Gemini Receipt Scanner**:  
  Receipt parsing runs through a serverless proxy on Cloudflare Workers to keep your Gemini API keys secure and enforce quotas. See the [worker setup guide](worker/README.md) for deployment instructions.
- **OneSignal Push Notifications**:  
  Create an app on [OneSignal](https://onesignal.com/) to obtain your App ID and REST API Key.

### 5. Environment Configuration

Copy the example environment configuration file:

```bash
cp .env.example .env
```

Populate `.env` with your project credentials:

```env
# Firebase Configuration (Required)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Cloudflare Worker for Receipt Scanning (Optional)
VITE_SCAN_WORKER_URL=https://kasseo-receipt-scan.your-subdomain.workers.dev

# OneSignal Push Notifications (Optional)
VITE_ONESIGNAL_APP_ID=your_onesignal_app_id
VITE_ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

> Optional integrations left blank in `.env` will be gracefully disabled at runtime. The core application remains fully operational.

---

## Scripts & Development

### Web App

| Command | Description |
|---|---|
| `npm run dev` | Start the local Vite development server with Hot Module Replacement |
| `npm run build` | Build the optimized production bundle into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the complete Vitest test suite once |
| `npm run test:watch` | Run Vitest in interactive watch mode |

### Android (Capacitor)

| Command | Description |
|---|---|
| `npm run cap:build` | Build the web application and sync web assets to the native Android directory |
| `npm run cap:sync` | Sync web build output (`dist/`) directly into Capacitor Android plugins and assets |
| `npm run cap:open` | Open the native project in Android Studio |

> Pushing a semantic version tag (e.g. `v0.3.0`) triggers the automated GitHub Actions release workflow to compile and publish signed Android APKs.

### Receipt Scanner Worker

```bash
cd worker
npm install
npm run deploy    # Deploys the proxy worker to Cloudflare using Wrangler
```

---

## Internationalization

Kasseo supports 6 languages out of the box: English (`en`), Deutsch (`de`), Français (`fr`), Español (`es`), Magyar (`hu`), and 中文 (`zh`).

To contribute a new language:

1. Create a new locale file in `src/i18n/locales/<language>.json` using `src/i18n/locales/en.json` as the reference template.
2. Register the language entry in `src/i18n/index.js` in both `SUPPORTED_LANGUAGES` and the `resources` dictionary.
3. Outgoing push notifications will automatically translate into your new language for users who have selected it.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

*This project has nothing to do with [KASSEO](https://open.spotify.com/artist/76UKhIGvZtS7jjb1muDTUM?si=U4IUSirBQDuLucBmK3mR0Q&utm_source=copy_link), but if you feel like it, give it a listen.*

</div>
