# Refund Ledger Data

The live ledger is stored in Firebase Cloud Firestore, not in this GitHub Pages directory. A browser cannot write files back into its deployed GitHub repository.

## Firebase Setup

1. Create a Firebase project on the Spark no-cost plan and register a Web app.
2. Enable **Authentication → Email/Password**.
3. Create a **Cloud Firestore** database.
4. Publish the rules from `firestore.rules` in Firebase Console → Firestore → Rules.
5. Copy the Web app config values into `firebase-config.js`. Firebase Web API keys identify the project; Firestore security rules and Authentication protect ledger records. Never put a Firebase Admin/service-account key in this file.
6. Add the deployed GitHub Pages domain under Authentication → Settings → Authorized domains.

The page loads Firebase's versioned compat SDK from `www.gstatic.com`; sign-in and cloud operations therefore require a network connection. The Firebase Web config is public client configuration, not a secret. The Firestore rules are the access boundary and must be published before saving records.

Records are isolated under `users/{uid}/refundRecords/{recordId}`. The app provides JSON export/import so a user can keep a backup in the iPhone Files app. The JSON structure is described by `refund-record.schema.json`.

When signed in, **匯出 JSON** backs up all records in that account and **匯入 JSON** adds backup records to that account. Without Firebase configuration, JSON export saves only the current calculation. Imported records receive new cloud IDs; importing the same backup more than once creates duplicates.

The **匯出記帳圖片** action captures the full calculation panel. On iPhone, use the share sheet's **儲存影像** action; browsers without file sharing download a PNG instead. The account panel is excluded from the image.

Without Firebase configuration, calculation remains available but cloud sign-in and record storage are disabled.