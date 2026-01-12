# 👶 Baby Tracker

A mobile-friendly baby tracking app for feeds and diapers with Firebase sync.

## Features

- 🍼 **Feed Tracking** - Log feeding times and ounces
- 🧷 **Diaper Tracking** - Track wet, dirty, or both
- 📊 **14-Day Analytics** - Visual bar charts for trends
- 🔐 **Firebase Auth** - Secure login/signup
- ☁️ **Cloud Sync** - Data syncs across all devices
- 📱 **Mobile-First** - Scroll wheel pickers for easy input

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run locally
```bash
npm run dev
```

### 3. Build for production
```bash
npm run build
```

## Deploy to Vercel (Easiest)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project" → Select your repo
4. Click "Deploy"
5. Done! You'll get a live URL

## Deploy to Netlify

1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your repo
5. Build command: `npm run build`
6. Publish directory: `dist`
7. Click "Deploy"

## Deploy to GitHub Pages

1. Install gh-pages: `npm install -D gh-pages`
2. Add to package.json scripts:
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```
3. Run: `npm run deploy`

## Firebase Setup

Make sure you have:

1. **Email/Password Auth enabled** in Firebase Console:
   - Authentication → Sign-in method → Enable Email/Password

2. **Database Rules** set for security:
   ```json
   {
     "rules": {
       "users": {
         "$uid": {
           ".read": "$uid === auth.uid",
           ".write": "$uid === auth.uid"
         }
       }
     }
   }
   ```

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Recharts
- Firebase Realtime Database & Auth

## License

MIT
