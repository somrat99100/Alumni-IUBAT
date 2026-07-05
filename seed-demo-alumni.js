// seed-demo-alumni.js
//
// Inserts 10 demo alumni profiles directly into Firestore so you can see the
// Explore Alumni page fully populated, without registering 10 real accounts.
//
// This uses the Firebase ADMIN SDK, which bypasses the security rules
// entirely (rules only apply to client-side requests) — so it can create
// approved profiles for made-up UIDs, which a normal signed-in client could
// never do (the rules only let you create your OWN doc, as "pending").
//
// ── Setup ─────────────────────────────────────────────────────────────────
// 1. npm install firebase-admin
// 2. Firebase Console → Project Settings → Service Accounts →
//    "Generate new private key" → save the downloaded file as
//    serviceAccountKey.json in this same folder.
//    NEVER commit this file to GitHub — it grants full admin access to your
//    project. (See the .gitignore included alongside this script.)
// 3. Run:  node seed-demo-alumni.js
//
// To remove the demo data later, run:  node seed-demo-alumni.js --remove
// (it only deletes docs marked isDemo: true, so your real alumni are safe.)

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

function avatarFor(name) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=6b9b5e&textColor=ffffff`;
}

const DEMO_ALUMNI = [
  {
    fullName: "Farhana Akter", studentId: "16108001", batch: "2016",
    jobTitle: "Agronomist", org: "BRAC Agriculture Programme",
    researchArea: "Crop Physiology",
    jobHistory: [
      { title: "Field Officer", org: "BRAC", startDate: "2016", endDate: "2019" },
      { title: "Agronomist", org: "BRAC Agriculture Programme", startDate: "2019", endDate: "Present" },
    ],
    contact: { email: "farhana.akter.demo@example.com", phone: "+8801710000001", whatsapp: "+8801710000001", facebookUrl: "https://facebook.com/farhana.demo", linkedinUrl: "https://linkedin.com/in/farhana-demo" },
  },
  {
    fullName: "Tanvir Ahmed", studentId: "15108014", batch: "2015",
    jobTitle: "Soil Scientist", org: "Bangladesh Agricultural Research Institute",
    researchArea: "Soil Fertility & Nutrient Management",
    jobHistory: [{ title: "Soil Scientist", org: "BARI", startDate: "2016", endDate: "Present" }],
    contact: { email: "tanvir.ahmed.demo@example.com", phone: "+8801710000002", whatsapp: "+8801710000002", facebookUrl: "https://facebook.com/tanvir.demo", linkedinUrl: "https://linkedin.com/in/tanvir-demo" },
  },
  {
    fullName: "Nusrat Jahan", studentId: "17108022", batch: "2017",
    jobTitle: "Agribusiness Manager", org: "Square Agro Ltd.",
    researchArea: "Agribusiness & Supply Chain",
    jobHistory: [
      { title: "Sales Executive", org: "Square Agro Ltd.", startDate: "2017", endDate: "2020" },
      { title: "Agribusiness Manager", org: "Square Agro Ltd.", startDate: "2020", endDate: "Present" },
    ],
    contact: { email: "nusrat.jahan.demo@example.com", phone: "+8801710000003", whatsapp: "+8801710000003", facebookUrl: "https://facebook.com/nusrat.demo", linkedinUrl: "https://linkedin.com/in/nusrat-demo" },
  },
  {
    fullName: "Rakibul Islam", studentId: "14108005", batch: "2014",
    jobTitle: "Assistant Professor", org: "Sher-e-Bangla Agricultural University",
    researchArea: "Plant Pathology",
    jobHistory: [
      { title: "Lecturer", org: "SAU", startDate: "2017", endDate: "2021" },
      { title: "Assistant Professor", org: "Sher-e-Bangla Agricultural University", startDate: "2021", endDate: "Present" },
    ],
    contact: { email: "rakibul.islam.demo@example.com", phone: "+8801710000004", whatsapp: "+8801710000004", facebookUrl: "https://facebook.com/rakibul.demo", linkedinUrl: "https://linkedin.com/in/rakibul-demo" },
  },
  {
    fullName: "Sadia Islam", studentId: "18108009", batch: "2018",
    jobTitle: "Horticulture Officer", org: "Department of Agricultural Extension",
    researchArea: "Horticulture & Post-harvest Technology",
    jobHistory: [{ title: "Horticulture Officer", org: "DAE", startDate: "2019", endDate: "Present" }],
    contact: { email: "sadia.islam.demo@example.com", phone: "+8801710000005", whatsapp: "+8801710000005", facebookUrl: "https://facebook.com/sadia.demo", linkedinUrl: "https://linkedin.com/in/sadia-demo" },
  },
  {
    fullName: "Mahmudul Hasan", studentId: "13108030", batch: "2013",
    jobTitle: "Country Director", org: "GreenHarvest Bangladesh (NGO)",
    researchArea: "Sustainable Agriculture & Rural Development",
    jobHistory: [
      { title: "Program Officer", org: "GreenHarvest Bangladesh", startDate: "2014", endDate: "2018" },
      { title: "Country Director", org: "GreenHarvest Bangladesh (NGO)", startDate: "2018", endDate: "Present" },
    ],
    contact: { email: "mahmudul.hasan.demo@example.com", phone: "+8801710000006", whatsapp: "+8801710000006", facebookUrl: "https://facebook.com/mahmudul.demo", linkedinUrl: "https://linkedin.com/in/mahmudul-demo" },
  },
  {
    fullName: "Israt Zahan", studentId: "19108041", batch: "2019",
    jobTitle: "Research Associate", org: "IRRI Bangladesh",
    researchArea: "Rice Breeding & Genetics",
    jobHistory: [{ title: "Research Associate", org: "IRRI Bangladesh", startDate: "2020", endDate: "Present" }],
    contact: { email: "israt.zahan.demo@example.com", phone: "+8801710000007", whatsapp: "+8801710000007", facebookUrl: "https://facebook.com/israt.demo", linkedinUrl: "https://linkedin.com/in/israt-demo" },
  },
  {
    fullName: "Shakil Ahmed", studentId: "12108018", batch: "2012",
    jobTitle: "Deputy General Manager", org: "ACI Agribusiness",
    researchArea: "Agricultural Economics",
    jobHistory: [
      { title: "Territory Manager", org: "ACI Agribusiness", startDate: "2013", endDate: "2019" },
      { title: "Deputy General Manager", org: "ACI Agribusiness", startDate: "2019", endDate: "Present" },
    ],
    contact: { email: "shakil.ahmed.demo@example.com", phone: "+8801710000008", whatsapp: "+8801710000008", facebookUrl: "https://facebook.com/shakil.demo", linkedinUrl: "https://linkedin.com/in/shakil-demo" },
  },
  {
    fullName: "Tasnim Rahman", studentId: "20108052", batch: "2020",
    jobTitle: "M.S. Student", org: "Bangladesh Agricultural University",
    researchArea: "Entomology",
    jobHistory: [{ title: "Graduate Research Assistant", org: "BAU", startDate: "2021", endDate: "Present" }],
    contact: { email: "tasnim.rahman.demo@example.com", phone: "+8801710000009", whatsapp: "+8801710000009", facebookUrl: "https://facebook.com/tasnim.demo", linkedinUrl: "https://linkedin.com/in/tasnim-demo" },
  },
  {
    fullName: "Imran Kabir", studentId: "21108063", batch: "2021",
    jobTitle: "Field Coordinator", org: "World Vision Bangladesh",
    researchArea: "Food Security & Nutrition",
    jobHistory: [{ title: "Field Coordinator", org: "World Vision Bangladesh", startDate: "2022", endDate: "Present" }],
    contact: { email: "imran.kabir.demo@example.com", phone: "+8801710000010", whatsapp: "+8801710000010", facebookUrl: "https://facebook.com/imran.demo", linkedinUrl: "https://linkedin.com/in/imran-demo" },
  },
];

async function seed() {
  console.log(`Seeding ${DEMO_ALUMNI.length} demo alumni…`);
  for (let i = 0; i < DEMO_ALUMNI.length; i++) {
    const { contact, ...profile } = DEMO_ALUMNI[i];
    const uid = `demo-${i + 1}`;

    await db.collection("alumni").doc(uid).set({
      ...profile,
      photoUrl: avatarFor(profile.fullName),
      visibility: { phone: "private", whatsapp: "private" },
      status: "approved",
      isDemo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("alumni").doc(uid).collection("private").doc("contact").set(contact);

    console.log(`  ✓ ${profile.fullName} (${uid})`);
  }
  console.log("Done. Refresh alumni.html to see them.");
}

async function remove() {
  console.log("Removing demo alumni (isDemo: true)…");
  const snap = await db.collection("alumni").where("isDemo", "==", true).get();
  for (const docSnap of snap.docs) {
    await docSnap.ref.collection("private").doc("contact").delete().catch(() => {});
    await docSnap.ref.delete();
    console.log(`  ✓ removed ${docSnap.id}`);
  }
  console.log("Done.");
}

const shouldRemove = process.argv.includes("--remove");
(shouldRemove ? remove() : seed())
  .catch((err) => { console.error(err); process.exit(1); })
  .then(() => process.exit(0));
