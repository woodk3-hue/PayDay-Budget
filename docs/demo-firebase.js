// Preview mode: stands in for Firebase so the app runs with sample data and nothing is saved.
// Used automatically while index.html still has the PASTE_ placeholders, or with ?demo in the address.
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const store = {
  income: [
    { date: day(-2), amount: 2450, source: "QR pay", note: "" },
    { date: day(-5), amount: 620, source: "Zane rent", note: "" },
    { date: day(-9), amount: 480, source: "Apartment rent", note: "" }
  ],
  expenses: [
    { date: day(-1), amount: 86.4, category: "Groceries", frequency: "once", description: "Woolworths" },
    { date: day(-3), amount: 52, category: "Fuel", frequency: "once", description: "Ampol" },
    { date: day(-4), amount: 34.5, category: "Eating out", frequency: "once", description: "Lunch" },
    { date: day(-30), amount: 1850, category: "Loan", frequency: "monthly", description: "Mortgage" },
    { date: day(-30), amount: 95, category: "Gym", frequency: "fortnightly", description: "Gym" },
    { date: day(-20), amount: 550, category: "Property", frequency: "quarterly", description: "Council rates" },
    { date: day(-10), amount: 180, category: "Property", frequency: "quarterly", description: "Water" },
    { date: day(-100), amount: 1200, category: "Bills", frequency: "yearly", description: "Car insurance" },
    { date: day(-2), amount: 60, category: "Groceries", frequency: "weekly", description: "Weekly shop" }
  ],
  goals: [
    { id: "g1", name: "Emergency fund", target: 10000, opening: 4200 },
    { id: "g2", name: "Holidays", target: 5000, opening: 1800, targetDate: day(400) },
    { id: "g3", name: "Tech", target: 4000, opening: 900 },
    { id: "g4", name: "Gear", target: 2000, opening: 300 }
  ],
  transfers: [
    { goalId: "g2", type: "add", amount: 300, date: day(-6), note: "Top-up" },
    { goalId: "g3", type: "spend", amount: 129, date: day(-12), note: "Keyboard" }
  ],
  subscriptions: [
    { name: "Spotify", amount: 13.99, type: "subscription", frequency: "monthly", dueDate: day(2), remindDays: 3 },
    { name: "Netflix", amount: 22.99, type: "subscription", frequency: "monthly", dueDate: day(9), remindDays: 3 },
    { name: "Car rego", amount: 780, type: "bill", frequency: "yearly", dueDate: day(40), remindDays: 7 },
    { name: "MacBook", amount: 2399, type: "purchase", frequency: "once", dueDate: day(60), remindDays: 7 }
  ],
  properties: [
    { id: "A", name: "12 Smith St", rates: 2200, water: 900, insurance: 1800, landTax: 1500 },
    { id: "B", name: "4/8 Park Rd", rates: 1400, water: 700, insurance: 1100, landTax: 0 }
  ],
  bills: [
    { category: "property", propertyId: "A", vendor: "Brisbane City Council", amount: 550, dueDate: day(12), frequency: "quarterly", paid: false, fileStatus: "filed" },
    { category: "property", propertyId: "B", vendor: "Allianz Insurance", amount: 1100, dueDate: day(25), paid: false, fileStatus: "pending" },
    { category: "maintenance", propertyId: "A", vendor: "Smith Plumbing", amount: 340, dueDate: day(-8), paid: true, fileStatus: "filed" },
    { category: "personal", propertyId: "", vendor: "Telstra", amount: 129, dueDate: day(5), frequency: "monthly", paid: false, fileStatus: "none" }
  ],
  incomeSources: [
    { name: "Job", amount: 2450, frequency: "fortnightly", nextDate: day(5) },
    { name: "Property 1 rent", amount: 310, frequency: "fortnightly", nextDate: day(3) },
    { name: "Property 2 rent", amount: 1350, frequency: "monthly", nextDate: day(12) }
  ],
  wishlist: [
    { name: "MacBook Pro", cost: 3500, kind: "want", perPay: 250, saved: 750, order: 0 },
    { name: "Japan trip", cost: 5000, kind: "want", perPay: 200, saved: 1200, order: 10 },
    { name: "Standing desk", cost: 900, kind: "want", perPay: 100, saved: 100, order: 20 },
    { name: "New phone", cost: 1800, kind: "want", perPay: 80, saved: 0, order: 30, neededBy: day(430) }
  ],
  settings: [{ id: "pay", baseline: 2450, updated: 1 }],
  banks: [{ id: "bk1", name: "Bank Australia" }, { id: "bk2", name: "Up" }],
  accounts: [
    { id: "acc1", name: "Big Savings", bank: "Bank Australia", bankId: "bk1", balance: 5200 },
    { id: "acc2", name: "Everyday", bank: "Up", bankId: "bk2", balance: 410 },
    { id: "acc3", name: "HouseAcc", bank: "Bank Australia", bankId: "bk1", balance: 1350 },
    { id: "acc4", name: "ApartmentAcc", bank: "Bank Australia", bankId: "bk1", balance: 900 }
  ],
  acctTransfers: [
    { name: "Up bills", fromId: "acc1", toId: "acc2", externalName: "", amount: 305, frequency: "fortnightly", nextApply: day(-1) },
    { name: "Rent to Cat", fromId: "acc1", toId: "", externalName: "Cat ING", amount: 400, frequency: "fortnightly", nextApply: day(6) }
  ],
  pushDevices: [], billFiles: []
};
let counter = 0;
Object.keys(store).forEach((n) => store[n].forEach((r) => { if (!r.id) r.id = n.slice(0, 2) + (++counter); }));
const listeners = [];

function notify() {
  listeners.forEach((l) => {
    const rows = store[l.name].slice().sort((a, b) => {
      const x = a[l.field], y = b[l.field], c = x < y ? -1 : x > y ? 1 : 0;
      return l.dir === "desc" ? -c : c;
    });
    l.cb({ docs: rows.map((r) => ({ id: r.id, data: () => { const { id, ...rest } = r; return rest; } })),
      metadata: { fromCache: false, hasPendingWrites: false } });
  });
}
function write(ref, data, merge) {
  const rows = store[ref.name] || (store[ref.name] = []);
  const i = rows.findIndex((r) => r.id === ref.id);
  const clean = JSON.parse(JSON.stringify(data));
  Object.keys(clean).forEach((k) => { if (clean[k] && clean[k].__inc !== undefined) clean[k] = ((i >= 0 && rows[i][k]) || 0) + clean[k].__inc; });
  if (i < 0) rows.push({ ...clean, id: ref.id });
  else rows[i] = merge ? { ...rows[i], ...clean } : { ...clean, id: ref.id };
}

export const initializeApp = () => ({});
export const getAuth = () => ({});
export class GoogleAuthProvider {}
export const signInWithPopup = () => Promise.resolve();
export const signInWithRedirect = () => Promise.resolve();
export const signOut = () => Promise.resolve();
export const onAuthStateChanged = (auth, cb) => { setTimeout(() => cb({ uid: "demo" }), 0); return () => {}; };

export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const serverTimestamp = () => Date.now();
export const increment = (n) => ({ __inc: n });
export const runTransaction = async (db, fn) => {
  const pending = [];
  const tx = {
    get: async (ref) => { const row = (store[ref.name] || []).find((r) => r.id === ref.id); return { exists: () => !!row, data: () => { const { id, ...rest } = row || {}; return rest; } }; },
    update: (ref, data) => pending.push(() => write(ref, data, true))
  };
  await fn(tx); pending.forEach((f) => f()); notify();
};
export const collection = (db, ...p) => ({ name: p[p.length - 1] });
export const doc = (a, ...p) => a && a.name && !p.length ? { name: a.name, id: "n" + (++counter) } : { name: p[p.length - 2], id: p[p.length - 1] };
export const orderBy = (field, dir = "asc") => ({ field, dir });
export const query = (c, o) => ({ name: c.name, field: o.field, dir: o.dir });
export const setDoc = (ref, data, opts) => { write(ref, data, !!(opts && opts.merge)); notify(); return Promise.resolve(); };
export const updateDoc = (ref, data) => { write(ref, data, true); notify(); return Promise.resolve(); };
export const deleteDoc = (ref) => { store[ref.name] = (store[ref.name] || []).filter((r) => r.id !== ref.id); notify(); return Promise.resolve(); };
export const writeBatch = () => {
  const ops = [];
  return {
    set(ref, data) { ops.push(() => write(ref, data, false)); },
    update(ref, data) { ops.push(() => write(ref, data, true)); },
    commit() { ops.forEach((f) => f()); notify(); return Promise.resolve(); }
  };
};
export const onSnapshot = (q, opts, cb) => {
  const l = { name: q.name, field: q.field, dir: q.dir, cb };
  listeners.push(l);
  setTimeout(notify, 0);
  return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
};
