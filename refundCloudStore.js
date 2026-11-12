(function (root) {
    let auth = null;
    let db = null;
    let initializationError = '';

    function configIsReady() {
        const config = root.REFUND_FIREBASE_CONFIG;
        return Boolean(config && config.apiKey && config.authDomain && config.projectId && config.appId);
    }

    function initialize() {
        if (!configIsReady()) return false;
        if (!root.firebase || !root.firebase.initializeApp) {
            initializationError = 'Firebase SDK 尚未載入。';
            return false;
        }
        try {
            const app = root.firebase.apps.length ? root.firebase.app() : root.firebase.initializeApp(root.REFUND_FIREBASE_CONFIG);
            auth = app.auth();
            db = app.firestore();
            return true;
        } catch (_error) {
            initializationError = 'Firebase 初始化失敗，請檢查設定。';
            return false;
        }
    }

    const initialized = initialize();
    const unavailableMessage = !configIsReady()
        ? '尚未設定雲端資料庫。請依 data/README.md 設定 Firebase。'
        : initializationError;

    function requireReady() {
        if (!initialized || !auth || !db) throw new Error(initializationError || 'Firebase 尚未設定。');
        if (!auth.currentUser) throw new Error('請先登入雲端記帳。');
        return db.collection('users').doc(auth.currentUser.uid).collection('refundRecords');
    }

    function subscribeAuth(callback) {
        if (!initialized) {
            callback(null);
            return function () { };
        }
        return auth.onAuthStateChanged(callback);
    }

    async function signIn(email, password) {
        if (!initialized) throw new Error(initializationError || '請先完成 Firebase 設定。');
        await auth.signInWithEmailAndPassword(email, password);
    }

    async function createAccount(email, password) {
        if (!initialized) throw new Error(initializationError || '請先完成 Firebase 設定。');
        await auth.createUserWithEmailAndPassword(email, password);
    }

    async function signOut() {
        if (!initialized) return;
        await auth.signOut();
    }

    async function listRecords() {
        const snapshot = await requireReady().orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((document) => ({ ...document.data(), id: document.id }));
    }

    async function saveRecord(record) {
        const collection = requireReady();
        const document = collection.doc();
        await document.set({ ...record, id: document.id });
        return document.id;
    }

    async function deleteRecord(recordId) {
        await requireReady().doc(recordId).delete();
    }

    async function importRecords(records) {
        const collection = requireReady();
        const batch = db.batch();
        records.forEach((record) => {
            const document = collection.doc();
            batch.set(document, { ...record, id: document.id });
        });
        await batch.commit();
        return records.length;
    }

    root.refundCloudStore = {
        configured: initialized,
        message: unavailableMessage,
        subscribeAuth,
        signIn,
        createAccount,
        signOut,
        listRecords,
        saveRecord,
        deleteRecord,
        importRecords,
    };
})(globalThis);