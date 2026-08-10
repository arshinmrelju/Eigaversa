# EIGAVERSA — Movie Character Recreation

Official registration website for EIGAVERSA, a movie character recreation event at Pazhassiraja College Pulpally.

## Pages

- `index.html` — Landing page
- `solo.html` — Solo registration
- `group.html` — Group registration (2–10 members, shared department)
- `admin.html` — Admin dashboard (access-code login + registration management)

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Firebase Firestore (project: `eigaversa`)

## Firebase Setup

1. Firebase config lives in `js/firebase-config.js`. It is already filled in for the `eigaversa` project.
2. Firestore collections used:
   - `eigaversa_solo` — solo registrations
   - `eigaversa_groups` — group registrations
   - `system_config/eigaversa_admin` — admin access config
3. Deploy Firestore rules (`firestore.rules`) and hosting via the Firebase CLI:
   ```
   firebase login
   firebase deploy
   ```
4. The site must be served over HTTPS or `localhost` for Firebase SDK modules to load. Opening the HTML files directly via `file://` will not work.

## Admin Access Code

The admin dashboard is gated by an access code: **`ENGPRC1993`** (default).

On first login, the code is automatically stored in Firestore (`system_config/eigaversa_admin` → `accessCode`). You can change the code later by editing that document in the Firebase Console.

## Deploying

```
firebase login
firebase deploy
```

Firestore rules are currently open (public read/write) to keep registration simple; tighten them before public release if needed.
