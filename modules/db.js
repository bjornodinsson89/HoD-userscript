// db.js - Database functions module

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = (event) => reject("IndexedDB error: " + (event.target.error ? event.target.error.message : "Unknown"));
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore("cache", { keyPath: "key" });
            db.createObjectStore("callLog", { keyPath: "key" });
            db.createObjectStore("targets", { keyPath: "key" });
            db.createObjectStore("warTargets", { keyPath: "key" });
            db.createObjectStore("factionMembers", { keyPath: "key" });
            db.createObjectStore("rankedWars", { keyPath: "key" });
            db.createObjectStore("enemyFactions", { keyPath: "key" });
        };
    });
}

async function getFromDB(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onerror = (event) => reject("Get error: " + (event.target.error ? event.target.error.message : "Unknown"));
        request.onsuccess = (event) => resolve(event.target.result ? event.target.result.value : null);
    });
}

async function setToDB(storeName, key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put({ key, value });
        request.onerror = (event) => reject("Put error: " + (event.target.error ? event.target.error.message : "Unknown"));
        request.onsuccess = () => resolve();
    });
}

async function deleteFromDB(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onerror = (event) => reject("Delete error: " + (event.target.error ? event.target.error.message : "Unknown"));
        request.onsuccess = () => resolve();
    });
}

async function loadAllFromStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onerror = (event) => reject("GetAll error: " + (event.target.error ? event.target.error.message : "Unknown"));
        request.onsuccess = (event) => resolve(event.target.result);
    });
}

async function clearStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onerror = (event) => reject("Clear error: " + (event.target.error ? event.target.error.message : "Unknown"));
        request.onsuccess = () => resolve();
    });
}
