# The Board

Shared workout tracker for a small group. No accounts, no passwords — a name and a group code.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page |
| `app.js` | The whole app |
| `config.js` | Supabase URL, public key, group code, default lifts |
| `styles.css` | Design tokens and base styles |
| `schema.sql` | Run this once in Supabase |

## Setup

1. **Supabase → SQL Editor** (third icon in the left rail, the `>_` one). Paste all of `schema.sql`, press Run.
2. Nothing else. `config.js` already has this project's URL and public key.

## Deploy

Upload these five files to the repo root (GitHub → Add file → Upload files → drag the folder in → Commit), then at [vercel.com](https://vercel.com): Add New → Project → import `Shared_Fitness_Tracker_WIP` → Deploy. No framework, no build command — it's a static site.

Every later commit redeploys automatically.

## Using it

- First person to enter a name creates their account. Same for everyone after.
- Group code is in `config.js` as `GROUP_CODE`. Change it there and commit to rotate it.
- Points: 1 per session, +2 for hitting your weekly goal. Week resets Monday.
- Set rows that beat your current best for that exercise become a PR automatically. Spell exercise names consistently or you'll get duplicate PR rows.
- Tell everyone to Add to Home Screen — it opens full screen like an app.

## Security

Deliberately minimal. Anyone with the URL and the group code can read and write everything. That is fine for a workout log between friends and not fine for anything else.

The only key in this repo is the `anon` / publishable key, which is meant to be public. Never commit a `service_role` or `sb_secret_` key.
