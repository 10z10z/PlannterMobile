# Plant Growspace Tracker

A React Native (Expo) app for tracking plants across growspaces, with local push
notifications for watering reminders. Backed by Supabase (Postgres + Auth).

## Features

- Email/password authentication
- Create growspaces and organize plants within them
- Track each plant's watering interval and last-watered date
- Local notification reminders when a plant is due for watering
- Inventory across six tabs: fertilizers (NPK/micronutrient specs, foliar and
  fertigation doses), seed packs, containers, seed trays, growing mediums and
  grow lights
- Seed trays sized by their cell grid — a 4 x 6 tray is 24 cells — tracked by
  quantity and how many currently hold a sowing
- Germination stations in swipeable tabs, indoor or outdoor, with the
  temperature and humidity they're kept at, each holding sowings made from a
  seed pack into a tray or a single container
- Sowing subtracts the seeds it uses from the pack, and draws the tray as a grid
  of cells reading "germinated / sown", with days since each cell came up
- Tap a cell to record how many of its seeds germinated, or hold the card to
  mark a whole tray at once; anything above zero tints the cell green
- Grow lights assigned to a station, set when it's created and edited from the
  station's own header along with its name, environment and conditions — a light
  group's "in use" count sums its growspaces and its germination stations
- Transplant a cell or a whole sowing into a growspace — several seedlings can
  share a container, and each container becomes a plant on its watering schedule
- Grow lights with type, wattage, colour temperature and optional spec-sheet
  figures (PPF, efficacy, PPFD at distance, coverage, beam angle, IP rating),
  tracked by quantity and how many are assigned to growspaces and germination
  stations
- Container occupancy derived from plant assignments — "8/10 in use, 2 free"
- NPK calculator fed by the fertilizer inventory: mix several products with a
  dose slider each, and read the resulting ppm against growth-stage target
  bands for macros and micronutrients
- Per-fertilizer contribution shown as colour-coded segments in every bar
- Reverse calculation — what a tank that has already been poured delivered
- Source water accounted for, from a hardness reading or a water report's Ca/Mg
- Metric/imperial unit preference — values are stored metric (litres,
  centimetres, Celsius) and converted for display
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
2. Create a free project at [supabase.com](https://supabase.com), then run the
   files in `supabase/migrations/` in filename order in its SQL Editor to set up
   the tables, storage bucket, and RLS policies.
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
screens/        Login/Signup, Growspaces, Plant detail, Germination, Inventory, NPK calculator, Settings
components/     Reusable cards, image picker, nutrient and date inputs
supabase/       Database migrations
```

## Roadmap

- Plants tab — every plant across growspaces in one list
