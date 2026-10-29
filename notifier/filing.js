// Files bill PDFs into Seafile, then deletes the temporary copy from Firestore.
// The app saves each uploaded PDF in users/{uid}/billFiles/{billId}; the matching bill has fileStatus "pending".
// Seafile layout:  <Property name>/Bills            (fixed property bills)
//                  <Property name>/Receipts/<FY>    (maintenance receipts, FY = Jul–Jun e.g. 2026-27)
//                  Personal Bills                   (general bills)
const { SEAFILE_URL, SEAFILE_TOKEN, SEAFILE_REPO_ID, SEAFILE_BASE_DIR = "" } = process.env;
export const filingEnabled = !!(SEAFILE_URL && SEAFILE_TOKEN && SEAFILE_REPO_ID);

const base = (SEAFILE_URL || "").replace(/\/+$/, "");
const auth = { Authorization: "Token " + SEAFILE_TOKEN };
const clean = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const apiDir = (p) => base + "/api2/repos/" + SEAFILE_REPO_ID + "/dir/?p=" + encodeURIComponent(p);

async function ensureFolder(path) {
  let cur = "";
  for (const seg of path.split("/").filter(Boolean)) {
    cur += "/" + seg;
    const res = await fetch(apiDir(cur), { headers: auth });
    if (res.ok) continue;
    const made = await fetch(apiDir(cur), { method: "POST", headers: auth, body: new URLSearchParams({ operation: "mkdir" }) });
    if (!made.ok && made.status !== 400) throw new Error("mkdir " + cur + " failed: HTTP " + made.status);
  }
}
async function upload(folder, fileName, bytes) {
  const linkRes = await fetch(base + "/api2/repos/" + SEAFILE_REPO_ID + "/upload-link/?p=" + encodeURIComponent(folder), { headers: auth });
  if (!linkRes.ok) throw new Error("upload-link failed: HTTP " + linkRes.status);
  const link = await linkRes.json();
  const form = new FormData();
  form.append("parent_dir", folder);
  form.append("replace", "0");
  form.append("file", new Blob([bytes], { type: "application/pdf" }), fileName);
  const res = await fetch(link, { method: "POST", headers: auth, body: form });
  if (!res.ok) throw new Error("upload failed: HTTP " + res.status);
}

async function folderFor(userRef, bill) {
  const root = base_dir();
  if (bill.category === "personal") return root + "/Personal Bills";
  const prop = await userRef.collection("properties").doc(String(bill.propertyId)).get();
  const name = clean(prop.exists && prop.data().name) || "Property " + bill.propertyId;
  if (bill.category === "maintenance") {
    const y = Number(bill.dueDate.slice(0, 4)), m = Number(bill.dueDate.slice(5, 7)), start = m >= 7 ? y : y - 1;
    return root + "/" + name + "/Receipts/" + start + "-" + String(start + 1).slice(2);
  }
  return root + "/" + name + "/Bills";
}
const base_dir = () => (SEAFILE_BASE_DIR ? "/" + SEAFILE_BASE_DIR.replace(/^\/+|\/+$/g, "") : "");

async function fileOne(billDoc) {
  const bill = billDoc.data(), userRef = billDoc.ref.parent.parent;
  const fileRef = userRef.collection("billFiles").doc(billDoc.id);
  const file = await fileRef.get();
  if (!file.exists) { console.log("No PDF stored for", billDoc.id, "- marking as no file"); await billDoc.ref.update({ fileStatus: "none" }); return; }
  const folder = await folderFor(userRef, bill);
  const fileName = clean(bill.dueDate + " " + bill.vendor) + ".pdf";
  await ensureFolder(folder);
  await upload(folder, fileName, Buffer.from(file.data().data, "base64"));
  await billDoc.ref.update({ fileStatus: "filed", filedPath: folder + "/" + fileName });
  await fileRef.delete();
  console.log("Filed", folder + "/" + fileName);
}

// Watches every user's bills; files anything pending now, and retries failures every 10 minutes.
export function startFiling(db) {
  if (!filingEnabled) { console.log("Seafile not configured - bill PDFs will wait in Firestore."); return; }
  const queue = new Map();
  let running = false;
  async function drain() {
    if (running) return;
    running = true;
    for (const [id, snap] of [...queue]) {
      try { await fileOne(snap); queue.delete(id); }
      catch (e) { console.error("Filing failed for", snap.data().vendor, "-", e.message); }
    }
    running = false;
  }
  db.collectionGroup("bills").onSnapshot((snap) => {
    snap.docChanges().forEach((c) => {
      const pendingNow = c.type !== "removed" && c.doc.data().fileStatus === "pending";
      if (pendingNow) queue.set(c.doc.ref.path, c.doc); else queue.delete(c.doc.ref.path);
    });
    drain();
  }, (e) => console.error("Bill watcher error:", e.message));
  setInterval(drain, 10 * 60 * 1000);
  console.log("Filing bill PDFs to Seafile folder", base_dir() || "/");
}
