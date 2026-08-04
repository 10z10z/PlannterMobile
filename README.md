# Plant Growspace Tracker

A React Native (Expo) app for tracking plants across growspaces, with local push
notifications for watering reminders. Backed by Supabase (Postgres + Auth).

## Features

- Email/password authentication
- Create growspaces and organize plants within them
- Track each plant's watering interval and last-watered date
- Local notification reminders when a plant is due for watering
- Inventory across four tabs: fertilizers (NPK/micronutrient specs, foliar and
  fertigation doses), seed packs, containers and growing mediums
- Container occupancy derived from plant assignments — "8/10 in use, 2 free"
- NPK calculator fed by the fertilizer inventory: mix several products with a
  dose slider each, and read the resulting ppm against growth-stage target
  bands for macros and micronutrients
- Per-fertilizer contribution shown as colour-coded segments in every bar
- Reverse calculation — what a tank that has already been poured delivered
- Source water accounted for, from a hardness reading or a water report's Ca/Mg
- Metric/imperial unit preference — values are stored metric and converted for display
- Row-level security in Supabase — each user only sees their own data

## Tech stack

- [Expo](https://expo.dev) (React Native, SDK 54)
- [React Navigation](https://reactnavigation.org) (native stack)
- [React Native Paper](https://callstack.github.io/react-native-paper/) (Material Design UI)
- [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security)
- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) (local watering reminders)

## Getting started

1. Install dependencies:
   ```
   npm install
   ```
2. Create a free project at [supabase.com](https://supabase.com), then run
   `supabase/migrations/0001_init.sql` in its SQL Editor to set up the tables,
   storage bucket, and RLS policies.
3. Copy your Supabase Project URL and anon public key (Project Settings → API)
   into a `.env` file at the project root:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Start the dev server:
   ```
   npx expo start
   ```
5. Scan the QR code with [Expo Go](https://expo.dev/go) on your Android/iOS device.

## Project structure

```
lib/            Supabase client, storage uploads, unit conversion, notifications
contexts/       Auth, theme and unit-preference providers
navigation/     Root navigator (auth stack vs. bottom tabs)
screens/        Login/Signup, Growspaces, Plant detail, Inventory, NPK calculator, Settings
components/     Reusable cards, image picker, nutrient and date inputs
supabase/       Database migrations
```

## Roadmap

- Germination station — germinate a seed pack into a plant
