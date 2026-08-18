# ![Kasseo logo](public/default.png)

A modern financial app for managing shared expenses and funds.

## Functions

- **User authentication**: using Google OAuth
- **2 Modes**:
  - **Kitty mode**: A shared fund where everyone contributes and can spend money
  - **Split mode**: Allocating Expenses Equally or According to Specific Ratios
- **Transaction Tracking**: Real-time tracking of deposits and expenses
- **Detailed Analytics**:
  - Balance history over time
  - Expenses by category
  - Breakdown by member
  - Monthly cash flow
  - Category trends
- **Receipt scanning**: Automatic receipt recognition using Gemini
- **Inviting members**: Easily invite others with a shared link
- **Custom categories**: Create your own categories
- **Dark mode**: Supports dark theme

## Tech stack

- **Frontend**: Vue 3 (Composition API)
- **Build tool**: Vite
- **State management**: Pinia
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Authentication (Google OAuth)
- **Database**: Firebase Realtime Database
- **Charts**: Chart.js + vue-chartjs
- **Icons**: Font Awesome

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
   - Create a firebase project
   - Enable Google Auth and Realtime Database

4. Copy .env

```bash
cp .env.example .env
```

Fill out `.env` file with firebase credentials:

``` env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
```

## Run

Developer setup:

```bash
npm run dev
```

Building:

```bash
npm run build
```

## [LICENSE](LICENSE)
