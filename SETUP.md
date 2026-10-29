# Budget Sync – setup (about 15 minutes, no terminal needed)

## 1. Create the Firebase backend
1. Go to https://console.firebase.google.com → **Add project** → name it `budget-sync` → turn Analytics off → Create.
2. **Build → Authentication → Get started → Google** → Enable → pick your email → Save.
3. **Build → Firestore Database → Create database** → location **australia-southeast1 (Sydney)** → Start in **production mode**.
4. In Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`, then click **Publish**.
5. **Project settings (cog) → Your apps → Web (</>)** → nickname `budget` → Register. Copy the `firebaseConfig` values it shows.
6. Open `index.html`, find **1. FIREBASE CONFIG** near the bottom, and paste your values over the `PASTE_...` placeholders.

## 2. Host it free on GitHub Pages
1. On github.com, click **New repository** → name it `budget-sync` → Public → Create.
2. Click **uploading an existing file**, then drag in the six files from **budget-sync.zip**: `index.html`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `firestore.rules` → **Commit changes**. (Leave the notifier out; it goes on the OptiPlex.)
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch `main`, folder `/docs` → Save.
4. After about a minute, your app is live at `https://woodk3-hue.github.io/budget-sync/`.

## 3. Allow your site to sign in
Back in Firebase, go to **Authentication → Settings → Authorised domains → Add domain** → `woodk3-hue.github.io`.

## 4. Install it on each device
- **Phone (Chrome):** open the link → ⋮ menu → **Add to Home screen**.
- **Laptop/PC (Chrome or Edge):** open the link → click the install icon in the address bar.
- Sign in with the same Google account on each device and they sync automatically.

## Updating the app later
1. Edit `index.html` on GitHub (pencil icon) → Commit.
2. Also open `sw.js` and change `budget-v1` to `budget-v2` (then v3, and so on) → Commit. This makes your devices load the new version.

## 5. Turn on push alerts (runs on your OptiPlex)
The OptiPlex checks your Subs list every morning at 8am Brisbane time and alerts your devices 3 days before (and on the day) anything renews. It also moves each due date forward to the next cycle. The files are in **budget-notifier.zip**.

> ⚠️ Never upload `service-account.json` or `.env` to GitHub. They are keys to your database and stay on the OptiPlex only.

**a. Get the Firebase key**
Firebase console → cog → **Project settings → Service accounts → Generate new private key**. Rename the downloaded file to `service-account.json`.

**b. Copy the folder to the OptiPlex**
Unzip `budget-notifier.zip`, put `service-account.json` inside the `notifier` folder, then on your laptop (PowerShell or Terminal) run this, using your OptiPlex username and IP:
```
scp -r notifier YOUR_USER@OPTIPLEX_IP:~/
```

**c. On the OptiPlex, paste these one at a time**
```
ssh YOUR_USER@OPTIPLEX_IP
cd ~/notifier
cp .env.example .env
docker compose run --rm notifier node notifier.js --keys
```
The last command prints two lines (`VAPID_PUBLIC_KEY=…` and `VAPID_PRIVATE_KEY=…`). Then:
```
nano .env
```
Paste both keys into their lines, then press Ctrl+O, Enter, Ctrl+X to save.

**d. Add the public key to the app**
On GitHub, edit `index.html` → find `PASTE_VAPID_PUBLIC_KEY` → replace it with your **public** key. Edit `sw.js` and bump the version number (`budget-v3`). Commit both.

**e. Start it**
```
docker compose up -d --build
```
It restarts by itself after reboots.

**f. Turn on alerts on each device**
Open the app → **Subs** tab → **Turn on alerts** → Allow. Then test it from the OptiPlex:
```
docker compose run --rm notifier node notifier.js --test
```
Your phone should show "Test alert from your OptiPlex ✅", even with the app closed.

**Handy commands (run inside `~/notifier`)**
- Show what it's been doing: `docker logs budget-notifier`
- Run today's check right now: `docker compose run --rm notifier node notifier.js --now`
- Change the alert time: edit `REMIND_TIME` in `.env`, then `docker compose up -d`

On a computer, alerts only show while Chrome or Edge is running (it can be minimised). If you choose a different "Remind me" number on an item, it alerts that many days before instead of 3.

## How offline works
Anything you add without signal is saved on that device straight away (the top pill shows "Offline – saved on device"). It uploads by itself when you're back online, and your other devices update within seconds.

## Free-tier limits
Firestore's free plan allows 50,000 reads and 20,000 writes a day. One person's budget uses a tiny fraction of that.
