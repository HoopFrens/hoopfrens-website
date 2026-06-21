# Hoop Frens

A modern Next.js application for Hoop Frens, the basketball media platform covering JUCO, NAIA, NCAA Division II, NCAA Division III, NCCAA, and USCAA.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Firebase Cloud Firestore

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.local.example .env.local
   ```

3. Add the Firebase web app values from the Firebase console to `.env.local`.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Firebase

The homepage newsletter form writes to the `newsletterSubscribers` collection. The `/submit` form writes to `spotlightSubmissions`.

Create both collections in Firestore and configure security rules before launch. Public client configuration belongs in `.env.local`; never commit service-account keys or private credentials.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

## Routes

- `/`
- `/juco`
- `/naia`
- `/d2`
- `/d3`
- `/nccaa`
- `/uscaa`
- `/submit`
- `/recruiting-resources`
- `/recruiting-resources/[slug]`
