// PayDay Budget notifier — runs on the OptiPlex in Docker.
// Every day at REMIND_TIME (Brisbane time) it:
//   1. rolls past due dates forward to the next billing cycle,
//   2. sends a push alert for anything due in exactly `remindDays` days, or due today,
//   3. removes devices whose push registration has expired.
// It also files uploaded bill PDFs into Seafile as they arrive (filing.js).
// Commands:  node notifier.js          → run on schedule (keeps running)
//            node notifier.js --now    → run the daily check once, then exit
//            node notifier.js --test   → send a test alert to every device, then exit
//            node notifier.js --keys   → print a new VAPID key pair, then exit
import fs from "node:fs";
import cron from "node-cron";
import webpush from "web-push";
import admin from "firebase-admin";
import { startFiling } from "./filing.js";

const TZ = "Australia/Brisbane";
const arg = process.argv[2];

if (arg === "--keys") {
  const k = webpush.generateVAPIDKeys();
  console.log("VAPID_PUBLIC_KEY=" + k.publicKey + "\nVAPID_PRIVATE_KEY=" + k.privateKey);
  process.exit(0);
}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT = "mailto:you@example.com",
        REMIND_TIME = "08:00", APP_URL = "./" } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env");
webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const serviceAccount = JSON.parse(fs.readFileSync("/app/service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ---- dates (all YYYY-MM-DD in Brisbane time) ----
const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
function addCycle(dateStr, freq) {
  const d = new Date(dateStr + "T00:00:00Z"), day = d.getUTCDate();
  if (freq === "weekly") d.setUTCDate(day + 7);
  else if (freq === "fortnightly") d.setUTCDate(day + 14);
  else {
    const months = { monthly: 1, quarterly: 3, yearly: 12 }[freq] || 0;
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const money = (n) => "$" + Number(n).toFixed(2);

// ---- sending ----
async function sendToUser(uid, payload) {
  const devices = await db.collection("users").doc(uid).collection("pushDevices").get();
  let sent = 0;
  for (const d of devices.docs) {
    try { await webpush.sendNotification(d.data().subscription, JSON.stringify(payload)); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await d.ref.delete(); console.log("Removed expired device", d.id); }
      else console.error("Push failed", d.id, e.statusCode, e.body || e.message);
    }
  }
  return sent;
}

// ---- the daily check ----
async function dailyCheck() {
  const today = todayStr();
  const snap = await db.collectionGroup("subscriptions").get();
  console.log(new Date().toISOString(), "checking", snap.size, "items for", today);
  for (const docSnap of snap.docs) {
    const s = docSnap.data(), uid = docSnap.ref.parent.parent.id;
    let due = s.dueDate;
    if (!due) continue;
    // 1. Roll recurring items forward once their due date has passed.
    if (s.frequency !== "once") {
      let rolled = due;
      for (let i = 0; rolled < today && i < 500; i++) rolled = addCycle(rolled, s.frequency);
      if (rolled !== due) { await docSnap.ref.update({ dueDate: rolled, lastNotified: null }); due = rolled; }
    }
    // 2. Remind on the chosen day before, and on the day itself.
    const left = daysBetween(today, due), remind = Number(s.remindDays ?? 3);
    if ((left === remind || left === 0) && s.lastNotified !== today) {
      const when = left === 0 ? "today" : left === 1 ? "tomorrow" : "in " + left + " days";
      const verb = s.type === "purchase" ? "is planned" : "renews";
      const sent = await sendToUser(uid, {
        title: s.name + " " + verb + " " + when,
        body: money(s.amount) + (s.frequency !== "once" ? " · " + s.frequency : "") + " · due " + due,
        tag: docSnap.id, url: APP_URL
      });
      await docSnap.ref.update({ lastNotified: today });
      console.log("Alert:", s.name, when, "→", sent, "device(s)");
    }
  }
}

// ---- entry ----
if (arg === "--test") {
  const users = await db.collection("users").listDocuments();
  for (const u of users) console.log(u.id, "→", await sendToUser(u.id, { title: "PayDay Budget", body: "Test alert from your OptiPlex ✅", tag: "test", url: APP_URL }), "device(s)");
  process.exit(0);
} else if (arg === "--now") {
  await dailyCheck(); process.exit(0);
} else {
  const [h, m] = REMIND_TIME.split(":").map(Number);
  cron.schedule(m + " " + h + " * * *", () => dailyCheck().catch((e) => console.error(e)), { timezone: TZ });
  console.log("Notifier running. Daily check at", REMIND_TIME, TZ);
  startFiling(db);
  dailyCheck().catch((e) => console.error(e)); // catch up on start (safe: never double-alerts the same day)
}
