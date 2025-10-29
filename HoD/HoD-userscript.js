// ==UserScript==
// @name         HoD Tools
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Faction Tools For House of Dragonborn
// @author       BjornOdinsson89
// @match        https://www.torn.com/*
// @match        https://www2.torn.com/*
// @updateURL    https://github.com/Bjornodinsson89/main/HoD-userscript/HoD/HoD-userscript.js
// @downloadURL  https://github.com/Bjornodinsson89/main/HoD-userscript/HoD/HoD-userscript.js
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      github.com
// @connect      api.torn.com
// @connect      worldtimeapi.org
// ==/UserScript==

(async function() {
    'use strict';

    const dbName = "HoDDB";
    const dbVersion = 1;
    const maxTargets = 50;

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

    GM_addStyle(`#hod-overlay{color:#fff;background:#111;border-left:2px solid #444;border-radius:10px 0 0 10px;box-shadow:0 0 10px rgba(0,0,0,0.5);box-sizing:border-box;font-size:14px;line-height:1.5;font-family:Arial,sans-serif;overflow:hidden;}#hod-tab{transition:right 0.3s ease;background:#111;border:2px solid #444;border-right:none;border-radius:5px 0 0 5px;box-sizing:border-box;}#hod-menu{display:flex;justify-content:flex-start;border-bottom:1px solid #444;margin-bottom:0;overflow-x:auto;white-space:nowrap;padding-left:1.5%;}.hod-menu-btn{background:#222;color:#fff;border:1px solid #444;border-bottom:none;border-radius:5px 5px 0 0;padding:6px 9px;margin:0 2px 0 0;cursor:pointer;font-size:13px;font-family:Arial,sans-serif;transition:transform 0.1s,background-color 0.1s,box-shadow 0.1s;}.hod-menu-btn.active{background:#111;border:1px solid #444;border-bottom:none;box-shadow: 0 0 5px #4CAF50;}.hod-menu-btn:active{transform:scale(0.98);background-color:#333;}#hod-overlay button{background:#222;color:#fff;border:1px solid #444;padding:6px 12px;cursor:pointer;font-size:14px;font-family:Arial,sans-serif;transition:transform 0.1s,background-color 0.1s,box-shadow 0.1s;border-radius:4px;}#hod-overlay button:hover{background-color:#333;box-shadow:0 0 5px rgba(255,255,255,0.1);}#hod-overlay button:active{transform:scale(0.98);background-color:#333;}#hod-overlay input{background:#111;color:#fff;border:1px solid #444;padding:6px;font-size:14px;font-family:Arial,sans-serif;border-radius:4px;}#hod-overlay select{background:#111;color:#fff;border:1px solid #444;padding:4px;font-size:14px;font-family:Arial,sans-serif;cursor:pointer;border-radius:4px;}#hod-overlay table{color:#fff;min-width:200%;border-collapse:separate;border-spacing:0 2px;table-layout:fixed;}#hod-overlay h3{color:#fff;margin:12px 0 8px;font-family:Arial,sans-serif;text-align:center;}#hod-overlay p{color:#fff;margin:8px 0;font-family:Arial,sans-serif;text-align:center;}#hod-overlay table th,#hod-overlay table td{border:1px solid #444;padding:4px 6px;word-break:break-word;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-family:Arial,sans-serif;color:#fff !important;}#hod-section-content{margin-top:10px;}#hod-overlay a{color:#5dade2;text-decoration:none;}#hod-overlay a:visited{color:#5dade2;}@media (max-width: 300px){#hod-overlay .responsive-table{border:none;}#hod-overlay .responsive-table thead{display:none;}#hod-overlay .responsive-table tr{margin-bottom:10px;display:block;border:1px solid #444;border-radius:5px;}#hod-overlay .responsive-table td{display:block;text-align:right;font-size:13px;border:none;position:relative;padding-left:50%;}#hod-overlay .responsive-table td:before{content:attr(data-label);position:absolute;left:0;width:50%;padding-left:10px;font-weight:bold;text-align:left;}}.status-icon{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px;}.status-icon.online{background-color:green;}.status-icon.offline{background-color:red;}.status-icon.idle{background-color:yellow;}.table-container{overflow:auto;}#hod-content{display:flex;flex-direction:column;height:100%;overflow:hidden;}#hod-section-content{flex:1;overflow-y:auto;margin-top:10px;}.bar-container{width:100%;background:#333;height:10px;}.bar{height:100%;background:green;}.status-btn{width:12px;height:12px;border-radius:50%;border:none;cursor:pointer;margin-right:5px;}.status-btn.green{background:green;}.status-btn.yellow{background:yellow;}.status-btn.red{background:red;}.button-group{display:flex;justify-content:center;gap:10px;margin-bottom:10px;}.add-form{display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:10px;}.add-form input{flex:1;max-width:70%;}h4{display:flex;justify-content:center;align-items:center;gap:10px;margin:10px 0;}#tct-clock{text-align:center;color:#fff;font-size:16px;margin-bottom:10px;}
#hod-toggle-container { display: flex; gap: 20px; margin-left: 10px; }
.hod-toggle-group { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.hod-toggle-label { color: #fff; font-size: 12px; }
.hod-toggle { display: none; }
.hod-toggle + label { background-color: #444; border-radius: 50px; padding: 1px; transition: background-color 0.3s ease-in-out; width: 40px; height: 20px; position: relative; cursor: pointer; display: inline-block; }
.hod-toggle + label::before { content: ''; position: absolute; top: 1px; left: 1px; background-color: #fff; background-image: url('https://i.postimg.cc/CdyVTGnS/1761005079868.png'); background-size: contain; background-repeat: no-repeat; border-radius: 50%; width: 18px; height: 18px; transition: transform 0.3s ease-in-out; }
.hod-toggle:checked + label { background-color: #4CAF50; box-shadow: 0 0 5px #4CAF50; transition: box-shadow 0.3s ease-in-out; }
.hod-toggle:checked + label::before { transform: translateX(20px); }
`);

    // Utilities
    class Utils {
        static async sleep(ms) {
            return new Promise(e => setTimeout(e, ms));
        }

        static formatTime(seconds, alternateFormat = false) {
            seconds = Math.max(0, Math.floor(seconds));

            let hours = Math.floor(seconds / 3600);
            seconds -= hours * 3600;

            let minutes = Math.floor(seconds / 60);
            seconds -= minutes * 60;

            if (alternateFormat) {
                return (hours < 10 ? "0" : "") + hours + "h " + (minutes < 10 ? "0" : "") + minutes + "m " + (seconds < 10 ? "0" : "") + seconds + "s";
            } else {
                return "[" + (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds + "]";
            }
        }

        static debounce(fn, ms) {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => fn(...args), ms);
            };
        }
    }

    // AjaxModule
    class AjaxModule {
        constructor() {
            this.ajaxListeners = [];
            this._overrideXhr();
            this._overrideFetch();
        }

        _overrideXhr() {
            let base = this;

            (function(original) {
                window.XMLHttpRequest = function() {
                    let result = new original(...arguments);
                    let stub;

                    result.addEventListener("readystatechange", function() {
                        if(this.readyState == 4 && ["", "text", "json"].includes(this.responseType) && this.responseText.trimStart()[0] == "{") {
                            try {
                                let json = JSON.parse(this.responseText);
                                stub = base._runAjaxCallbacks(this.responseURL, false, json);
                                if(stub) {
                                    Object.defineProperty(this, "responseText", {
                                        get: function(){return JSON.stringify(stub)}
                                    });
                                    if (this.responseType === "json" || this.responseType === "") {
                                        Object.defineProperty(this, "response", {
                                            get: function(){return stub}
                                        });
                                    }
                                }
                            } catch(e) {
                                console.error("Failed to parse XHR response for URL " + this.responseURL, e);
                            }
                        }
                    });

                    return result;
                };
                window.XMLHttpRequest.prototype = original.prototype;
            })(window.XMLHttpRequest);
        }

        _overrideFetch() {
            let base = this;

            (function(original) {
                window.fetch = async function() {
                    let url = arguments[0];
                    if(!url.includes("page.php?sid=bhc")) {
                        let preCall = base._runAjaxCallbacks(url, true);
                        if(preCall){return new Response(JSON.stringify(preCall))};
                        let result = await original.apply(this, arguments);
                        try {
                            let json = await result.clone().json();
                            let stub = base._runAjaxCallbacks(url, false, json);
                            return stub ? new Response(JSON.stringify(stub)) : result;
                        } catch(e) {
                            console.error("Failed to parse fetch response for URL " + url, e);
                            return result;
                        }
                    } else {
                        return await original.apply(this, arguments);
                    }
                };
            })(window.fetch);
        }

        _runAjaxCallbacks(url, abortCall, json) {
            let stub;

            for(let listener of this.ajaxListeners) {
                if(url.toLowerCase().includes(listener.url.toLowerCase())) {
                    if(abortCall == listener.abortCall) {
                        stub = listener.callback(json);
                    }
                }
            }

            return stub;
        }
    }

    // ApiModule (optimized caching)
    class ApiModule {
        constructor() {
            this.callLog = [];
            this.cacheLog = {};
            this.maxCacheSize = 200; // Optimized: limit cache size to prevent memory issues
            this.apiKeyIsValid = false;
            this.alertedPermission = false;
            this.loadFromIDB();
            this.cleaningInterval = setInterval(async () => {
                const now = Date.now();
                for (const url of Object.keys(this.cacheLog)) {
                    if (this.cacheLog[url].time + this.cacheLog[url].cacheDuration < now) {
                        delete this.cacheLog[url];
                        try {
                            await deleteFromDB('cache', url);
                        } catch (e) {
                            console.error("Failed to delete from cache:", e);
                            GM_notification("Storage error - clear browser data or check quota.");
                        }
                    }
                }
                if (Object.keys(this.cacheLog).length > this.maxCacheSize) {
                    const sortedKeys = Object.keys(this.cacheLog).sort((a,b) => this.cacheLog[a].time - this.cacheLog[b].time);
                    while (Object.keys(this.cacheLog).length > this.maxCacheSize) {
                        const key = sortedKeys.shift();
                        delete this.cacheLog[key];
                        try {
                            await deleteFromDB('cache', key);
                        } catch (e) {
                            console.error("Failed to delete from cache:", e);
                            GM_notification("Storage error - clear browser data or check quota.");
                        }
                    }
                }
            }, 60000); // Clean cache every minute
        }

        static encrypt(text) {
            const key = 'hod_secret';
            return text.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
        }

        static decrypt(text) {
            return ApiModule.encrypt(text); // XOR is symmetric
        }

        async loadFromIDB() {
            try {
                this.callLog = await getFromDB('callLog', 'callLog') || [];
                const cacheEntries = await loadAllFromStore('cache');
                cacheEntries.forEach(entry => {
                    this.cacheLog[entry.key] = entry.value;
                });
            } catch (e) {
                console.error("Failed to load from IndexedDB:", e);
                HoDOverlay.logError(e);
                GM_notification('Database error: ' + e.message);
            }
        }

        async saveCallLog() {
            try {
                await setToDB('callLog', 'callLog', this.callLog);
            } catch (e) {
                console.error("Failed to save callLog to IndexedDB:", e);
                GM_notification("Storage error - clear browser data or check quota.");
            }
        }

        async saveCacheEntry(key, value) {
            try {
                await setToDB('cache', key, value);
            } catch (e) {
                console.error("Failed to save cache entry to IndexedDB:", e);
                GM_notification("Storage error - clear browser data or check quota.");
            }
        }

        async clearCache() {
            this.cacheLog = {};
            await clearStore('cache');
        }

        async fetch(url, cacheMs = 0, retries = 0) {
            const now = Date.now();
            this.callLog = this.callLog.filter(e => e + 60000 >= now);

            if (this.cacheLog.hasOwnProperty(url) && this.cacheLog[url].time + this.cacheLog[url].cacheDuration >= now) {
                return Promise.resolve(this.cacheLog[url].json);
            }

            if (retries > 5) {
                throw new Error('Max retries exceeded for rate limit');
            }

            let attempts = 0;
            let maxAttempts = 10;
            while (this.callLog.length >= this.throttleLimit && attempts < maxAttempts) {
                let delay = 1000 * Math.pow(2, attempts); // Exponential backoff
                await Utils.sleep(delay);
                const currentNow = Date.now();
                this.callLog = this.callLog.filter(e => e + 60000 >= currentNow);
                attempts++;
            }
            if (attempts >= maxAttempts) {
                GM_notification("API rate limit reached. Please wait a minute and try again.");
                throw new Error("API rate limit stuck; too many calls.");
            }

            this.callLog.push(now);
            this.saveCallLog();

            let response;
            let json;
            let retryCount = 0;
            const maxRetries = 3;
            while (retryCount < maxRetries) {
                try {
                    response = await fetch(`https://api.torn.com${url}&key=${this.apiKey}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    json = await response.json();
                    if (json.error) {
                        if (json.error.code === 6) {
                            throw new Error('Rate limit');
                        } else {
                            // Handle below
                        }
                    }
                    break;
                } catch (e) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        console.error("Fetch error after retries:", e);
                        HoDOverlay.logError(e);
                        throw e;
                    }
                    await Utils.sleep(1000 * Math.pow(2, retryCount)); // Exponential backoff for retries
                }
            }

            if (json.error) {
                if (json.error.code === 2) {
                    this.apiKeyIsValid = false;
                    alert("API key invalid.");
                }
                if (json.error.code === 14) {
                    this.apiKeyIsValid = false;
                    if (!this.alertedPermission) {
                        alert('API key lacks access to user profile. Please ensure full access or add "user" permission.');
                        this.alertedPermission = true;
                    }
                }
                console.error("API error:", json.error);
                HoDOverlay.logError(new Error("API error: " + json.error.error));
                throw new Error("API error: " + json.error.error);
            }
            const cacheDuration = cacheMs > 0 ? cacheMs : 0;
            if(!json.hasOwnProperty("error") && cacheDuration > 0) {
                const entry = {json: json, time: Date.now(), cacheDuration: cacheDuration};
                this.cacheLog[url] = entry;
                await this.saveCacheEntry(url, entry);
                if (Object.keys(this.cacheLog).length > this.maxCacheSize) {
                    // Evict oldest
                    const oldestKey = Object.keys(this.cacheLog).sort((a,b) => this.cacheLog[a].time - this.cacheLog[b].time)[0];
                    delete this.cacheLog[oldestKey];
                    await deleteFromDB('cache', oldestKey);
                }
            }

            return json;
        }

        setApiParams(apiKey, throttleLimit) {
            this.apiKey = apiKey;
            this.throttleLimit = throttleLimit;
        }

        async checkKeyValidity(key) {
            try {
                const response = await fetch(`https://api.torn.com/user/?selections=profile&key=${key}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const json = await response.json();
                if (json.error) {
                    return false;
                }
                return json;
            } catch (e) {
                console.error("Key validity check error:", e);
                HoDOverlay.logError(e);
                return false;
            }
        }
    }

    // BaseModule
    class BaseModule {
        static _ajaxModule = new AjaxModule();
        static _apiModule = new ApiModule();

        constructor() {
            this.user = {};

            this.addAjaxListener("TopBanner", false, json => {
                this.user = json.user;
                this.onUserLoaded();
            });
        }

        setApiParams(...params) {
            BaseModule._apiModule.setApiParams(...params);
        }

        isApiKeyValid() {
            return BaseModule._apiModule.apiKeyIsValid;
        }

        log(...data) {
            console.log(this.constructor.name + ":", ...data);
        }

        addAjaxListener(url, abortCall, callback) {
            BaseModule._ajaxModule.ajaxListeners.push({url: url, abortCall: abortCall, callback: callback});
        }

        async api() {
            return await BaseModule._apiModule.fetch(...arguments);
        }

        onUserLoaded() {}
    }

    // ChainTracker Module
    class ChainTracker extends BaseModule {
        constructor() {
            super();
            this.chainData = {current: 0, max: 0, timeout: 0, cooldown: 0};
            this.bonusLevels = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
            this.watcherEnabled = false;
            this.alertThreshold = parseInt(localStorage.getItem("HoD_chain_timeout_threshold") || "60");
            this.lastNotification = 0;
            this.lastBonusNotification = 0;
            this.lastCurrent = 0;
            this.approachingThreshold = parseInt(localStorage.getItem("HoD_chain_approaching_threshold") || "10");
            this.lastApproachingNotification = {};
            this.lastFetchTime = 0;
            this.timeoutTimer = null;
        }

        saveThresholds() {
            try {
                localStorage.setItem("HoD_chain_timeout_threshold", this.alertThreshold.toString());
                localStorage.setItem("HoD_chain_approaching_threshold", this.approachingThreshold.toString());
            } catch (e) {
                console.error("Failed to save chain thresholds to localStorage:", e);
                GM_notification("Storage error - clear browser data or check quota.");
            }
        }

        async fetchChainData() {
            try {
                const json = await this.api('/faction?selections=chain', 5000); // Cache for 5s
                if (!json.error) {
                    this.chainData = json.chain;
                    this.lastFetchTime = Date.now();
                }
            } catch (e) {
                console.error("Error fetching chain data:", e);
                HoDOverlay.logError(e);
            }
        }

        calculateNextBonus() {
            const current = this.chainData.current;
            for (let level of this.bonusLevels) {
                if (current < level) {
                    return { nextLevel: level, hitsNeeded: level - current };
                }
            }
            return { nextLevel: 'Max', hitsNeeded: 0 };
        }

        startWatcher() {
            this.watcherEnabled = true;
            this.lastCurrent = 0;
            this.watchInterval = setInterval(() => this.watchChain(), 5000);
            this.startLiveUpdate();
        }

        stopWatcher() {
            this.watcherEnabled = false;
            if (this.watchInterval) clearInterval(this.watchInterval);
            if (this.timeoutTimer) clearInterval(this.timeoutTimer);
            this.timeoutTimer = null;
        }

        async watchChain() {
            if (!hodOverlay.isPageVisible) return;
            await this.fetchChainData();
            const now = Date.now();
            if (this.chainData.timeout > 0 && this.chainData.timeout <= this.alertThreshold && now - this.lastNotification > 60000) {
                GM_notification({
                    title: "Chain Timeout Alert",
                    text: `Chain timeout in ${this.chainData.timeout} seconds!`
                });
                this.lastNotification = now;
            }
            let reached = [];
            if (this.chainData.current > this.lastCurrent) {
                for (let level of this.bonusLevels) {
                    if (this.lastCurrent < level && this.chainData.current >= level) {
                        reached.push(level);
                    }
                }
            }
            if (reached.length > 0 && now - this.lastBonusNotification > 60000) {
                GM_notification({
                    title: "Chain Bonuses Reached",
                    text: `Reached ${reached.join(', ')} chain bonus!`
                });
                this.lastBonusNotification = now;
            }
            const nextBonus = this.calculateNextBonus();
            if (nextBonus.hitsNeeded > 0 && nextBonus.hitsNeeded <= this.approachingThreshold) {
                const key = nextBonus.nextLevel;
                if (!this.lastApproachingNotification[key] || now - this.lastApproachingNotification[key] > 60000) {
                    GM_notification({
                        title: "Approaching Chain Bonus",
                        text: `Approaching ${nextBonus.nextLevel} bonus! Only ${nextBonus.hitsNeeded} hits needed.`
                    });
                    this.lastApproachingNotification[key] = now;
                }
            }
            this.lastCurrent = this.chainData.current;
        }

        startLiveUpdate() {
            if (this.timeoutTimer) clearInterval(this.timeoutTimer);
            this.timeoutTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.lastFetchTime) / 1000);
                this.chainData.timeout = Math.max(0, this.chainData.timeout - elapsed);
                this.lastFetchTime = Date.now();
                const timeoutSpan = document.getElementById('chain-timeout');
                if (timeoutSpan) {
                    timeoutSpan.textContent = this.chainData.timeout;
                }
            }, 1000);
        }

        renderUI() {
            let html = '<h3>Chain Tracker</h3>';
            html += `<p>Current: <span id="chain-current">${this.chainData.current}</span> / ${this.chainData.max}</p>`;
            html += `<div class="bar-container"><div class="bar" style="width: ${(this.chainData.current / this.chainData.max * 100).toFixed(2)}%;"></div></div>`;
            html += `<p>Timeout: <span id="chain-timeout">${this.chainData.timeout}</span> seconds</p>`;
            html += `<p>Cooldown: ${this.chainData.cooldown} seconds</p>`;
            const nextBonus = this.calculateNextBonus();
            html += `<p>Next Bonus: ${nextBonus.nextLevel} (Hits needed: ${nextBonus.hitsNeeded})</p>`;
            html += '<div class="button-group"><button id="toggle-watcher">' + (this.watcherEnabled ? 'Disable Watcher' : 'Enable Watcher') + '</button><button id="manual-sync">Sync Now</button></div>';
            return html;
        }
    }

    // HoD Overlay Module
    class HoDOverlay extends BaseModule {
        static errorLog;
        static {
            try {
                this.errorLog = JSON.parse(localStorage.getItem("HoD_errors") || "[]");
            } catch (e) {
                console.error("Failed to load errorLog from localStorage:", e);
                this.errorLog = [];
            }
        }

        static logError(err) {
            this.errorLog.push({ timestamp: Date.now(), message: err.message, stack: err.stack || '' });
            if (this.errorLog.length > 50) {
                this.errorLog.shift(); // Limit to last 50 errors
            }
            try {
                localStorage.setItem("HoD_errors", JSON.stringify(this.errorLog));
            } catch (e) {
                console.error("Failed to save errorLog to localStorage:", e);
                GM_notification("Storage error - clear browser data or check quota.");
            }
        }

        constructor() {
            super();
            this.isPageVisible = !document.hidden;
            document.addEventListener('visibilitychange', () => {
                this.isPageVisible = !document.hidden;
            });
            this.backgroundInterval = setInterval(() => this.backgroundRefresh(), 300000);
            this.targets = [];
            this.warTargets = [];
            this.rankedWars = {};
            this.enemyFactions = {};
            try {
                this.loadFromIDB();
            } catch (e) {
                console.error("Error loading from IDB:", e);
                HoDOverlay.logError(e);
            }
            this.addAjaxListeners();
            this.visitedProfileID = null;
            this.visitedProfileName = null;
            this.chainTracker = new ChainTracker();
            this.attackLog = {};
            this.factionMembers = {};
            this.factionName = 'Faction Members';
            this.width = parseInt(localStorage.getItem("HoD_Overlay_Width") || "350");
            this.serverTime = 0;
            this.serverTimeInterval = null;
            this.membersInterval = null;
            this.enemyInterval = null;
            this.targetsInterval = null;
            this.warTargetsInterval = null;
            this.fetchAttackLog();
            this.checkForUpdates();
            this.renderOverlay();
            this.debouncedAddButtons = Utils.debounce(this.addProfileButtons.bind(this), 300);
            this.observeProfileChanges();
            this.countdownIntervals = [];
            this.lastEnemyOnlineCheck = 0;
            this.lastEnemyOnlineNotification = 0;
            this.enemyOnlineThreshold = parseInt(localStorage.getItem("HoD_enemy_online_threshold") || "5");
            this.isAddEnemyFocused = false;
            this.isAddWarFocused = false;
        }

        async startServerTimeFetch() {
            if (this.serverTimeInterval) clearInterval(this.serverTimeInterval);
            await this.fetchServerTime();  // Immediate fetch for initial sync
            this.serverTimeInterval = setInterval(async () => await this.fetchServerTime(), 10000);  // Every 10 seconds
        }

        stopServerTimeFetch() {
            if (this.serverTimeInterval) {
                clearInterval(this.serverTimeInterval);
                this.serverTimeInterval = null;
            }
        }

        startMembersPoll(sectionContent) {
            if (this.membersInterval) clearInterval(this.membersInterval);
            this.membersInterval = setInterval(async () => {
                if (!this.isPageVisible) return;
                await this.fetchFactionMembers();
                if (document.querySelector('.hod-menu-btn.active')?.dataset.section === 'members') {
                    const scrollLeft = sectionContent.querySelector('.table-container')?.scrollLeft || 0;
                    sectionContent.innerHTML = this.renderMembersList();
                    sectionContent.querySelector('.table-container').scrollLeft = scrollLeft;
                    this.attachSortListeners(sectionContent);
                    sectionContent.querySelector('#member-search').addEventListener('input', Utils.debounce((e) => {
                        this.filterMembersTable(e.target.value);
                    }, 300));
                    this.attachStatusButtonListeners(sectionContent);
                    const table = sectionContent.querySelector('#members-table');
                    const sortCol = localStorage.getItem('HoD_members_sort_col') || 'status_icon';
                    const sortAsc = localStorage.getItem('HoD_members_sort_asc') === 'true';
                    const mode = localStorage.getItem('HoD_members_status_mode') || '0';
                    const btn = table.querySelector('.status-priority-btn');
                    btn.dataset.mode = mode;
                    btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');
                    this.sortTable(table, sortCol, sortAsc);
                    this.startCountdownTimers();
                    sectionContent.querySelector('#refresh-members').addEventListener('click', async () => {
                        const scrollLeft = sectionContent.querySelector('.table-container')?.scrollLeft || 0;
                        await this.fetchFactionMembers();
                        sectionContent.innerHTML = this.renderMembersList();
                        sectionContent.querySelector('.table-container').scrollLeft = scrollLeft;
                        this.attachSortListeners(sectionContent);
                        sectionContent.querySelector('#member-search').addEventListener('input', Utils.debounce((e) => {
                            this.filterMembersTable(e.target.value);
                        }, 300));
                        this.attachStatusButtonListeners(sectionContent);
                        const table = sectionContent.querySelector('#members-table');
                        const sortCol = localStorage.getItem('HoD_members_sort_col') || 'status_icon';
                        const sortAsc = localStorage.getItem('HoD_members_sort_asc') === 'true';
                        const mode = localStorage.getItem('HoD_members_status_mode') || '0';
                        const btn = table.querySelector('.status-priority-btn');
                        btn.dataset.mode = mode;
                        btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');
                        this.sortTable(table, sortCol, sortAsc);
                        this.startCountdownTimers();
                    });
                }
            }, 5000); // Every 5 seconds
        }

        startEnemyPoll(sectionContent) {
            if (this.enemyInterval) clearInterval(this.enemyInterval);
            this.enemyInterval = setInterval(async () => {
                if (!this.isPageVisible) return;
                if (this.isAddEnemyFocused) return;
                await this.fetchRankedWars();
                // Refresh all existing enemy factions
                for (const fid in this.enemyFactions) {
                    await this.fetchEnemyFactionMembers(fid);
                }
                if (document.querySelector('.hod-menu-btn.active')?.dataset.section === 'enemy') {
                    const scrollPositions = {};
                    sectionContent.querySelectorAll('.table-container').forEach(cont => {
                        const fid = cont.dataset.factionId;
                        if (fid) scrollPositions[fid] = cont.scrollLeft;
                    });
                    const addInputValue = sectionContent.querySelector('#add-enemy-faction')?.value || '';
                    const enemySearchValue = sectionContent.querySelector('#enemy-search')?.value || '';
                    sectionContent.innerHTML = this.renderEnemyList();
                    sectionContent.querySelector('#add-enemy-faction').value = addInputValue;
                    sectionContent.querySelector('#enemy-search').value = enemySearchValue;
                    sectionContent.querySelectorAll('.table-container').forEach(cont => {
                        const fid = cont.dataset.factionId;
                        if (fid && scrollPositions[fid] !== undefined) cont.scrollLeft = scrollPositions[fid];
                    });
                    this.attachSortListeners(sectionContent);
                    sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                        this.filterEnemyTables(e.target.value);
                    }, 300));
                    this.attachEnemyRemovalListeners(sectionContent);
                    this.attachEnemyImportExportListeners(sectionContent);
                    this.attachStatusButtonListeners(sectionContent);
                    sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                        const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                        const btn = table.querySelector('.status-priority-btn');
                        btn.dataset.mode = mode;
                        btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                        const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                        const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                        if (sortCol) {
                            this.sortTable(table, sortCol, sortAsc);
                        }
                    });
                    this.startCountdownTimers();
                    sectionContent.querySelector('#add-enemy-btn').addEventListener('click', async () => { /* ... */ });
                    sectionContent.querySelector('#auto-poll-enemy').addEventListener('click', async () => { /* ... */ });
                    sectionContent.querySelector('#refresh-enemy').addEventListener('click', async () => {
                        const scrollPositions = {};
                        sectionContent.querySelectorAll('.table-container').forEach(cont => {
                            const fid = cont.dataset.factionId;
                            if (fid) scrollPositions[fid] = cont.scrollLeft;
                        });
                        // Refresh all
                        for (const fid in this.enemyFactions) {
                            await this.fetchEnemyFactionMembers(fid);
                        }
                        sectionContent.innerHTML = this.renderEnemyList();
                        sectionContent.querySelectorAll('.table-container').forEach(cont => {
                            const fid = cont.dataset.factionId;
                            if (fid && scrollPositions[fid] !== undefined) cont.scrollLeft = scrollPositions[fid];
                        });
                        this.attachSortListeners(sectionContent);
                        sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                            this.filterEnemyTables(e.target.value);
                        }, 300));
                        this.attachEnemyRemovalListeners(sectionContent);
                        this.attachEnemyImportExportListeners(sectionContent);
                        this.attachStatusButtonListeners(sectionContent);
                        sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                            const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                            const btn = table.querySelector('.status-priority-btn');
                            btn.dataset.mode = mode;
                            btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                            const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                            const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                            if (sortCol) {
                                this.sortTable(table, sortCol, sortAsc);
                            }
                        });
                        this.startCountdownTimers();
                    });
                }
            }, 5000); // Every 5 seconds
        }

        startTargetsPoll(sectionContent) {
            // No ongoing poll; refresh on open if needed
        }

        startWarTargetsPoll(sectionContent) {
            // No ongoing poll; refresh on open if needed
        }

        observeProfileChanges() {
            const observer = new MutationObserver(() => {
                if (location.href.includes("profiles.php") && document.querySelector('.content-title') && !document.querySelector('#hod-toggle-container')) {
                    this.debouncedAddButtons();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        async loadFromIDB() {
            try {
                this.targets = await getFromDB('targets', 'targets') || [];
                this.warTargets = await getFromDB('warTargets', 'warTargets') || [];
                const factionData = await getFromDB('factionMembers', 'factionMembers') || { members: {}, name: 'Faction Members' };
                this.factionMembers = factionData.members || {};
                this.factionName = factionData.name || 'Faction Members';
                this.rankedWars = await getFromDB('rankedWars', 'rankedWars') || {};
                this.enemyFactions = await getFromDB('enemyFactions', 'enemyFactions') || {};
            } catch (e) {
                console.error("Failed to load from IndexedDB:", e);
                HoDOverlay.logError(e);
                GM_notification('Database error: ' + e.message);
            }
        }

        async saveToIDB() {
            try {
                await setToDB('targets', 'targets', this.targets);
                await setToDB('warTargets', 'warTargets', this.warTargets);
                await setToDB('factionMembers', 'factionMembers', { members: this.factionMembers, name: this.factionName });
                await setToDB('rankedWars', 'rankedWars', this.rankedWars);
                await setToDB('enemyFactions', 'enemyFactions', this.enemyFactions);
            } catch (e) {
                console.error("Failed to save to IndexedDB:", e);
                HoDOverlay.logError(e);
                GM_notification('Database error: ' + e.message);
            }
        }

        async backgroundRefresh() {
            if (!this.isPageVisible) return;
            if (!this.user || !this.user.factionID) {
                try {
                    const userJson = await this.api('/user?selections=basic');
                    if (!userJson.error) {
                        this.user = userJson;
                    }
                } catch (e) {
                    console.error('Failed to fetch user basic', e);
                    HoDOverlay.logError(e);
                }
            }
            if (this.user.factionID) {
                try {
                    await this.fetchFactionMembers();
                } catch (e) {
                    console.error('Failed to fetch faction members', e);
                    HoDOverlay.logError(e);
                }
                try {
                    await this.fetchRankedWars();
                } catch (e) {
                    console.error('Failed to fetch ranked wars', e);
                    HoDOverlay.logError(e);
                }
                // Refresh existing enemy factions only if needed
                const now = Date.now();
                for (const fid in this.enemyFactions) {
                    if (now - this.enemyFactions[fid].lastUpdate > 300000) {
                        try {
                            await this.fetchEnemyFactionMembers(fid);
                        } catch (e) {
                            console.error('Failed to fetch enemy faction members', e);
                            HoDOverlay.logError(e);
                        }
                    }
                }
            }
            try {
                await this.refreshTargets();
            } catch (e) {
                console.error('Failed to refresh targets', e);
                HoDOverlay.logError(e);
            }
            try {
                await this.refreshWarTargets();
            } catch (e) {
                console.error('Failed to refresh war targets', e);
                HoDOverlay.logError(e);
            }
            await this.saveToIDB();
            this.checkEnemyOnlineAlert();
        }

        async checkEnemyOnlineAlert() {
            const now = Date.now();
            if (now - this.lastEnemyOnlineCheck < 60000) return; // Check every minute
            this.lastEnemyOnlineCheck = now;

            let onlineCount = 0;
            Object.values(this.enemyFactions).forEach(faction => {
                Object.values(faction.members).forEach(member => {
                    if (member.last_action.status === 'Online') onlineCount++;
                });
            });
            if (onlineCount > this.enemyOnlineThreshold && now - this.lastEnemyOnlineNotification > 300000) { // Alert every 5 minutes if condition persists
                GM_notification({
                    title: "Enemy Push Alert",
                    text: `More than ${this.enemyOnlineThreshold} enemy faction members are online (${onlineCount}). Possible push incoming!`
                });
                this.lastEnemyOnlineNotification = now;
            }
        }

        async fetchServerTime() {
            if (!this.isPageVisible) return;
            try {
                const local_t1 = Date.now();
                const response = await fetch(`https://api.torn.com/user/?selections=basic&key=${BaseModule._apiModule.apiKey}`);
                const local_t2 = Date.now();
                const json = await response.json();
                if (json.error) {
                    throw new Error(`API error: ${json.error.error}`);
                }
                const rtt = local_t2 - local_t1;
                const estimated_server_at_t2 = json.server_time + (rtt / 1000 / 2);
                const newOffset = estimated_server_at_t2 - (local_t2 / 1000);
                this.offset = Math.max(this.offset || newOffset, newOffset);
            } catch (e) {
                console.error("Error fetching server time:", e);
                HoDOverlay.logError(e);
            }
        }

        getServerNow() {
            return Date.now() / 1000 + (this.offset || 0);
        }

        clearCountdownIntervals() {
            this.countdownIntervals.forEach(interval => clearInterval(interval));
            this.countdownIntervals = [];
        }

        startCountdownTimers() {
            this.clearCountdownIntervals();
            const countdowns = document.querySelectorAll('.countdown');
            if (countdowns.length === 0) return;
            const interval = setInterval(() => {
                const now = this.getServerNow();
                countdowns.forEach(span => {
                    const until = parseFloat(span.dataset.until);
                    const timer = until - now;
                    if (timer > 0) {
                        span.textContent = Utils.formatTime(timer, true);
                    } else {
                        span.textContent = '0s';
                        const td = span.closest('td');
                        if (td) td.textContent = 'Okay';
                    }
                });
            }, 1000);
            this.countdownIntervals.push(interval);
        }

        async fetchAttackLog(force = false) {
            try {
                if (force) {
                    const url = '/user?selections=attacks';
                    delete BaseModule._apiModule.cacheLog[url];
                    await deleteFromDB('cache', url);
                }
                const json = await this.api('/user?selections=attacks', force ? 0 : 60000);
                if (!json.error) {
                    Object.values(json.attacks).forEach(attack => {
                        if (attack.defender_id) {
                            this.attackLog[attack.defender_id] = attack;
                        }
                    });
                }
            } catch (e) {
                console.error("Error fetching attack log:", e);
                HoDOverlay.logError(e);
            }
        }

        checkForUpdates() {
            const updateURL = 'https://github.com/BjornOdinsson89/HoD/raw/main/HoD.user.js';
            const metaURL = updateURL.replace('.user.js', '.meta.js');
            GM_xmlhttpRequest({
                method: 'GET',
                url: metaURL,
                onload: (response) => {
                    const remoteVersionMatch = response.responseText.match(/@version\s+([\d.]+)/);
                    const remoteVersion = remoteVersionMatch ? remoteVersionMatch[1] : null;
                    const currentVersion = GM_info.script.version;
                    if (remoteVersion && remoteVersion > currentVersion) {
                        GM_notification({
                            title: 'HoD Update Available',
                            text: `Version ${remoteVersion} is available. Update now?`,
                            onclick: () => window.open(updateURL, '_blank')
                        });
                        BaseModule._apiModule.clearCache();
                    }
                },
                onerror: (err) => {
                    console.error('Update check failed:', err);
                    HoDOverlay.logError(err);
                }
            });
        }

        addAjaxListeners() {
            this.addAjaxListener("attacks", false, json => {
                this.updateAttackLog(json);
                return json;
            });
        }

        updateAttackLog(json) {
            Object.values(json.attacks).forEach(attack => {
                if (attack.defender_id) {
                    this.attackLog[attack.defender_id] = attack;
                }
            });
        }

        async loadTargets() {
            try {
                this.targets = await getFromDB('targets', 'targets') || [];
            } catch (e) {
                console.error("Error loading targets:", e);
                HoDOverlay.logError(e);
            }
        }

        async loadWarTargets() {
            try {
                this.warTargets = await getFromDB('warTargets', 'warTargets') || [];
            } catch (e) {
                console.error("Error loading war targets:", e);
                HoDOverlay.logError(e);
            }
        }

        async saveTargets() {
            try {
                await setToDB('targets', 'targets', this.targets);
            } catch (e) {
                console.error("Error saving targets:", e);
                HoDOverlay.logError(e);
            }
        }

        async saveWarTargets() {
            try {
                await setToDB('warTargets', 'warTargets', this.warTargets);
            } catch (e) {
                console.error("Error saving war targets:", e);
                HoDOverlay.logError(e);
            }
        }

        async refreshTargets(force = false) {
            await this.fetchAttackLog(force);
            const now = Date.now();
            const chunkSize = 5;
            const toRefresh = force ? this.targets : this.targets.filter(t => now - t.lastUpdate > 600000);
            for (let i = 0; i < toRefresh.length; i += chunkSize) {
                const chunk = toRefresh.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (target) => {
                    await this.updateTarget(target, force);
                }));
                await Utils.sleep(500);
            }
            this.saveTargets();
        }

        async refreshWarTargets(force = false) {
            await this.fetchAttackLog(force);
            const now = Date.now();
            const chunkSize = 5;
            const toRefresh = force ? this.warTargets : this.warTargets.filter(t => now - t.lastUpdate > 600000);
            for (let i = 0; i < toRefresh.length; i += chunkSize) {
                const chunk = toRefresh.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (target) => {
                    await this.updateTarget(target, force);
                }));
                await Utils.sleep(500);
            }
            this.saveWarTargets();
        }

        async refreshSpecificTargets(targetList, allList) {
            await this.fetchAttackLog();
            const chunkSize = 5;
            for (let i = 0; i < targetList.length; i += chunkSize) {
                const chunk = targetList.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (target) => {
                    await this.updateTarget(target);
                }));
                await Utils.sleep(500);
            }
            if (allList === this.targets) {
                this.saveTargets();
            } else if (allList === this.warTargets) {
                this.saveWarTargets();
            }
        }

        async updateTarget(target, force = false) {
            if (!this.isPageVisible) return;
            try {
                if (force) {
                    const url = `/user/${target.id}?selections=profile`;
                    delete BaseModule._apiModule.cacheLog[url];
                    await deleteFromDB('cache', url);
                }
                const profile = await this.api(`/user/${target.id}?selections=profile`, force ? 0 : 30000);
                if (profile.error) {
                    console.error(`Error fetching profile for ${target.id}: ${profile.error.error}`);
                    HoDOverlay.logError(new Error(`Error fetching profile for ${target.id}: ${profile.error.error}`));
                    if (profile.error.code === 7) {
                        const index = this.targets.findIndex(t => t.id === target.id);
                        if (index !== -1) this.targets.splice(index, 1);
                        const warIndex = this.warTargets.findIndex(t => t.id === target.id);
                        if (warIndex !== -1) this.warTargets.splice(warIndex, 1);
                    } else if (profile.error.code === 14) {
                        if (!BaseModule._apiModule.alertedPermission) {
                            alert('API key lacks access to user profile. Please ensure full access or add "user" permission.');
                            BaseModule._apiModule.alertedPermission = true;
                        }
                    }
                    target.name = 'Error fetching name';
                    return;
                }
                if (typeof profile !== 'object' || !profile) {
                    throw new Error('Invalid profile response');
                }
                if (!profile.name) {
                    console.log('Missing name in response for ID ' + target.id, profile);
                    target.name = 'Unidentified (ID: ' + target.id + ')';
                } else {
                    target.name = profile.name;
                }
                let respectGain = null;
                if (this.attackLog[target.id]) {
                    respectGain = this.attackLog[target.id].respect_gain;
                }
                target.lvl = profile.level;
                target.faction = profile.faction.faction_name;
                target.faction_id = profile.faction.faction_id;
                target.status = profile.status.state;
                target.status_description = profile.status.description;
                target.status_until = profile.status.until || 0;
                target.life = profile.life.current + '/' + profile.life.maximum;
                target.lastAction = profile.last_action.relative;
                target.respectGain = respectGain;
                target.lastUpdate = Date.now();
            } catch (e) {
                console.error(`Exception fetching profile for ${target.id}:`, e);
                HoDOverlay.logError(e);
                target.name = 'Error fetching name';
            }
        }

        async fetchFactionMembers() {
            if (!this.isPageVisible) return;
            try {
                const json = await this.api('/faction?selections=basic', 60000); // Cache 60s
                if (!json.error) {
                    this.factionMembers = json.members;
                    this.factionName = json.name || 'Faction Members';
                    await setToDB('factionMembers', 'factionMembers', {members: this.factionMembers, name: this.factionName});
                } else {
                    HoDOverlay.logError(new Error("Error fetching faction members: " + json.error.error));
                }
            } catch (e) {
                console.error("Error fetching faction members:", e);
                HoDOverlay.logError(e);
            }
        }

        async fetchRankedWars() {
            if (!this.isPageVisible) return;
            try {
                const json = await this.api('/faction?selections=rankedwars', 60000); // Cache 60s
                if (!json.error) {
                    this.rankedWars = json.rankedwars;
                    await setToDB('rankedWars', 'rankedWars', this.rankedWars);
                } else {
                    HoDOverlay.logError(new Error("Error fetching ranked wars: " + json.error.error));
                }
            } catch (e) {
                console.error("Error fetching ranked wars:", e);
                HoDOverlay.logError(e);
            }
        }

        async fetchEnemyFactionMembers(factionId) {
            if (!this.isPageVisible) return;
            try {
                const json = await this.api(`/faction/${factionId}?selections=basic`, 300000); // Cache 5min
                if (!json.error) {
                    this.enemyFactions[factionId] = {members: json.members, name: json.name, lastUpdate: Date.now()};
                    await this.saveToIDB();
                } else {
                    HoDOverlay.logError(new Error("Error fetching enemy faction members: " + json.error.error));
                }
            } catch (e) {
                console.error("Error fetching enemy faction members:", e);
                HoDOverlay.logError(e);
            }
        }

        async searchFactionByName(name) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://www.torn.com/factions.php?step=groupList&searchname=${encodeURIComponent(name)}`,
                    onload: (response) => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const links = doc.querySelectorAll('a[href*="factions.php?step=profile&ID="]');
                        if (links.length > 0) {
                            const idMatch = links[0].href.match(/ID=(\d+)/);
                            if (idMatch) {
                                resolve(idMatch[1]);
                            } else {
                                reject('No faction ID found');
                            }
                        } else {
                            reject('No faction found');
                        }
                    },
                    onerror: (err) => {
                        reject(err);
                    }
                });
            });
        }

        async fetchEnemyFromWar() {
            try {
                await this.fetchRankedWars();
                for (const war of Object.values(this.rankedWars)) {
                    const enemyId = Object.keys(war.factions).find(id => id != this.user.factionID);
                    if (enemyId && !this.enemyFactions[enemyId]) {
                        await this.fetchEnemyFactionMembers(enemyId);
                    }
                }
                await this.saveToIDB();
            } catch (e) {
                console.error("Error fetching enemy from war:", e);
                HoDOverlay.logError(e);
            }
        }

        saveEnemyOnlineThreshold() {
            try {
                localStorage.setItem("HoD_enemy_online_threshold", this.enemyOnlineThreshold.toString());
            } catch (e) {
                console.error("Failed to save enemy online threshold to localStorage:", e);
                GM_notification("Storage error - clear browser data or check quota.");
            }
        }

        addProfileButtons() {
            const contentTitle = document.querySelector('.content-title');
            if (contentTitle && !document.querySelector('#hod-toggle-container')) {
                const urlParams = new URLSearchParams(window.location.search);
                const profileId = parseInt(urlParams.get('XID'));
                if (!isNaN(profileId)) {
                    try {
                        (async () => {
                            const profile = await this.api(`/user/${profileId}?selections=profile`);
                            if (!profile.error) {
                                this.visitedProfileID = profileId;
                                this.visitedProfileName = profile.name;

                                const container = document.createElement('div');
                                container.id = 'hod-toggle-container';
                                container.style.display = 'flex';
                                container.style.gap = '20px';
                                container.style.marginLeft = '10px';

                                // Target toggle group
                                const targetGroup = document.createElement('div');
                                targetGroup.className = 'hod-toggle-group';

                                const targetText = document.createElement('span');
                                targetText.className = 'hod-toggle-label';
                                targetText.textContent = 'Target';

                                const targetToggle = document.createElement('input');
                                targetToggle.type = 'checkbox';
                                targetToggle.className = 'hod-toggle';
                                targetToggle.id = 'hod-target-toggle';
                                targetToggle.checked = this.targets.some(t => t.id === profileId);

                                const targetSwitchLabel = document.createElement('label');
                                targetSwitchLabel.htmlFor = 'hod-target-toggle';

                                targetGroup.appendChild(targetText);
                                targetGroup.appendChild(targetToggle);
                                targetGroup.appendChild(targetSwitchLabel);

                                targetToggle.addEventListener('change', async () => {
                                    const index = this.targets.findIndex(t => t.id === profileId);
                                    if (targetToggle.checked) {
                                        if (index === -1) {
                                            if (this.targets.length >= maxTargets) {
                                                alert(`Maximum targets reached (${maxTargets}). Remove some first.`);
                                                targetToggle.checked = false;
                                                return;
                                            }
                                            this.targets.push({
                                                id: profileId,
                                                name: profile.name,
                                                lvl: profile.level,
                                                faction: profile.faction.faction_name,
                                                faction_id: profile.faction.faction_id,
                                                status: profile.status.state,
                                                status_description: profile.status.description,
                                                status_until: profile.status.until || 0,
                                                life: profile.life.current + '/' + profile.life.maximum,
                                                lastAction: profile.last_action.relative,
                                                respectGain: null,
                                                lastUpdate: Date.now()
                                            });
                                        }
                                    } else {
                                        if (index !== -1) {
                                            this.targets.splice(index, 1);
                                        }
                                    }
                                    await this.refreshTargets();
                                    this.saveTargets();
                                });

                                // War Target toggle group
                                const warGroup = document.createElement('div');
                                warGroup.className = 'hod-toggle-group';

                                const warText = document.createElement('span');
                                warText.className = 'hod-toggle-label';
                                warText.textContent = 'War Target';

                                const warToggle = document.createElement('input');
                                warToggle.type = 'checkbox';
                                warToggle.className = 'hod-toggle';
                                warToggle.id = 'hod-war-toggle';
                                warToggle.checked = this.warTargets.some(t => t.id === profileId);

                                const warSwitchLabel = document.createElement('label');
                                warSwitchLabel.htmlFor = 'hod-war-toggle';

                                warGroup.appendChild(warText);
                                warGroup.appendChild(warToggle);
                                warGroup.appendChild(warSwitchLabel);

                                warToggle.addEventListener('change', async () => {
                                    const index = this.warTargets.findIndex(t => t.id === profileId);
                                    if (warToggle.checked) {
                                        if (index === -1) {
                                            if (this.warTargets.length >= maxTargets) {
                                                alert(`Maximum war targets reached (${maxTargets}). Remove some first.`);
                                                warToggle.checked = false;
                                                return;
                                            }
                                            this.warTargets.push({
                                                id: profileId,
                                                name: profile.name,
                                                lvl: profile.level,
                                                faction: profile.faction.faction_name,
                                                faction_id: profile.faction.faction_id,
                                                status: profile.status.state,
                                                status_description: profile.status.description,
                                                status_until: profile.status.until || 0,
                                                life: profile.life.current + '/' + profile.life.maximum,
                                                lastAction: profile.last_action.relative,
                                                respectGain: null,
                                                lastUpdate: Date.now()
                                            });
                                        }
                                    } else {
                                        if (index !== -1) {
                                            this.warTargets.splice(index, 1);
                                        }
                                    }
                                    await this.refreshWarTargets();
                                    this.saveWarTargets();
                                });

                                container.appendChild(targetGroup);
                                container.appendChild(warGroup);
                                contentTitle.appendChild(container);
                            }
                        })();
                    } catch (e) {
                        console.error("Error adding profile toggles:", e);
                        HoDOverlay.logError(e);
                    }
                }
            }
        }

        saveWidth() {
            try {
                localStorage.setItem("HoD_Overlay_Width", this.width.toString());
            } catch (e) {
                console.error("Failed to save overlay width to localStorage:", e);
                GM_notification("Storage error - clear browser data or check quota.");
            }
        }

        setWidth(newWidth) {
            this.width = Math.max(150, Math.min(400, newWidth));
            this.saveWidth();
            const overlay = document.getElementById('hod-overlay');
            const tab = document.getElementById('hod-tab');
            overlay.style.width = `${this.width}px`;
            const closedRight = `-${this.width + 2}px`;
            const isOpen = overlay.style.right === '0px';
            if (!isOpen) {
                overlay.style.right = closedRight;
            }
            tab.style.right = isOpen ? `${this.width + 2}px` : '0px';
        }

        renderOverlay() {
            const overlay = document.createElement('div');
            overlay.id = 'hod-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '20vh';
            overlay.style.height = '60vh';
            overlay.style.width = `${this.width}px`;
            overlay.style.background = '#1e1e1e';
            overlay.style.borderLeft = '2px solid #333';
            overlay.style.borderRadius = '10px 0 0 10px';
            overlay.style.transition = 'right 0.3s ease';
            overlay.style.zIndex = '100000';
            overlay.style.padding = '10px';
            overlay.style.overflowY = 'hidden';
            overlay.style.boxSizing = 'border-box';

            const closedRight = `-${this.width + 2}px`;
            overlay.style.right = closedRight;

            const tab = document.createElement('div');
            tab.id = 'hod-tab';
            tab.style.position = 'fixed';
            tab.style.right = '0px';
            tab.style.top = '50%';
            tab.style.transform = 'translateY(-50%)';
            tab.style.width = '35px';
            tab.style.height = '35px';
            tab.style.background = '#1e1e1e';
            tab.style.border = '2px solid #333';
            tab.style.borderRight = 'none';
            tab.style.borderRadius = '5px 0 0 5px';
            tab.style.cursor = 'pointer';
            tab.style.display = 'flex';
            tab.style.alignItems = 'center';
            tab.style.justifyContent = 'center';
            tab.style.zIndex = '100001';
            tab.innerHTML = '<img src="https://i.postimg.cc/CdyVTGnS/1761005079868.png" style="width: 26px; height: 26px;" alt="HoD Icon">';

            const contentWrapper = document.createElement('div');
            contentWrapper.id = 'hod-content';
            contentWrapper.style.height = '100%';
            contentWrapper.style.overflowY = 'hidden';

            overlay.appendChild(contentWrapper);
            document.body.appendChild(overlay);
            document.body.appendChild(tab);

            tab.addEventListener('click', async () => {
                const isOpen = overlay.style.right === '0px';
                overlay.style.right = isOpen ? closedRight : '0px';
                tab.style.right = isOpen ? '0px' : `${this.width + 2}px`;
                tab.innerHTML = isOpen ? '<img src="https://i.postimg.cc/CdyVTGnS/1761005079868.png" style="width: 26px; height: 26px;" alt="HoD Icon">' : '<span style="color: #fff;">Close</span>';
                if (!isOpen) {
                    // Opening
                    await this.startServerTimeFetch();
                    this.renderContent(contentWrapper);
                } else {
                    // Closing
                    this.clearCountdownIntervals();
                    this.chainTracker.stopWatcher();
                    if (this.membersInterval) clearInterval(this.membersInterval);
                    if (this.enemyInterval) clearInterval(this.enemyInterval);
                    if (this.targetsInterval) clearInterval(this.targetsInterval);
                    if (this.warTargetsInterval) clearInterval(this.warTargetsInterval);
                    this.stopServerTimeFetch();
                }
            });
        }

        async renderContent(container) {
            if (!this.isApiKeyValid()) {
                container.innerHTML = '<p>API key is invalid or missing. Limited functionality available. Please reload and enter a valid full access key.</p>';
                return;
            }
            let html = '<img src="https://i.ibb.co/tLmq7Kc/3-RD-ENTRY.gif" alt="Banner" style="width: 100%; height: auto; margin-bottom: 10px;">';
            html += '<div style="text-align: center;"><span id="tct-clock"></span><button id="refresh-clock" style="margin-left: 10px;">Refresh Clock</button></div>';
            html += '<div id="hod-menu"><button class="hod-menu-btn active" data-section="targets">Targets</button><button class="hod-menu-btn" data-section="wartargets">War Targets</button><button class="hod-menu-btn" data-section="chain">Chain Tracker</button><button class="hod-menu-btn" data-section="members">Members</button><button class="hod-menu-btn" data-section="enemy">Enemy</button><button class="hod-menu-btn" data-section="errors">Errors</button><button class="hod-menu-btn" data-section="settings">Settings</button></div>';
            html += '<div id="hod-section-content"></div>';
            container.innerHTML = html;

            this.clockInterval = setInterval(() => {
                const now = this.getServerNow();
                const date = new Date(now * 1000);
                const hh = String(date.getUTCHours()).padStart(2, '0');
                const mm = String(date.getUTCMinutes()).padStart(2, '0');
                const ss = String(date.getUTCSeconds()).padStart(2, '0');
                const clock = container.querySelector('#tct-clock');
                if (clock) {
                    clock.textContent = `${hh}:${mm}:${ss} TCT`;
                }
            }, 1000);

            const refreshClockBtn = container.querySelector('#refresh-clock');
            if (refreshClockBtn) {
                refreshClockBtn.addEventListener('click', async () => await this.fetchServerTime());
            }

            container.querySelectorAll('.hod-menu-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    container.querySelectorAll('.hod-menu-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    const sectionContent = container.querySelector('#hod-section-content');
                    this.clearCountdownIntervals();
                    if (this.membersInterval) clearInterval(this.membersInterval);
                    if (this.enemyInterval) clearInterval(this.enemyInterval);
                    if (this.targetsInterval) clearInterval(this.targetsInterval);
                    if (this.warTargetsInterval) clearInterval(this.warTargetsInterval);
                    if (e.target.dataset.section === 'targets') {
                        // Check and refresh if needed
                        const now = Date.now();
                        const hospitalTargets = this.targets.filter(t => t.status === 'Hospital' && now - t.lastUpdate > 10000); // 10s for hospital
                        const otherTargets = this.targets.filter(t => t.status !== 'Hospital' && now - t.lastUpdate > 120000); // 2 min for others
                        if (hospitalTargets.length > 0 || otherTargets.length > 0) {
                            await this.refreshSpecificTargets([...hospitalTargets, ...otherTargets], this.targets);
                        }
                        sectionContent.innerHTML = this.renderTargetList();
                        this.attachSortListeners(sectionContent);
                        this.attachTargetEventListeners(sectionContent);
                        this.attachImportExportListeners(sectionContent);
                        this.startCountdownTimers();
                        // No poll
                        sectionContent.querySelector('#refresh-targets').addEventListener('click', async () => {
                            const scrollLeft = sectionContent.querySelector('.table-container')?.scrollLeft || 0;
                            await this.refreshTargets(true).catch(e => {
                                console.error("Error refreshing targets on button click:", e);
                                HoDOverlay.logError(e);
                                alert('Error refreshing targets: ' + e.message);
                            });
                            sectionContent.innerHTML = this.renderTargetList();
                            sectionContent.querySelector('.table-container').scrollLeft = scrollLeft;
                            this.attachSortListeners(sectionContent);
                            this.attachTargetEventListeners(sectionContent);
                            this.attachImportExportListeners(sectionContent);
                            this.startCountdownTimers();
                        });
                        sectionContent.querySelector('#add-target-btn').addEventListener('click', async () => {
                            const idInput = sectionContent.querySelector('#add-target-id');
                            const id = parseInt(idInput.value);
                            if (!isNaN(id) && !this.targets.some(t => t.id === id)) {
                                if (this.targets.length >= maxTargets) {
                                    alert(`Maximum targets reached (${maxTargets}). Remove some first.`);
                                    return;
                                }
                                try {
                                    const profile = await this.api(`/user/${id}?selections=profile`, 30000); // Cache 30s
                                    if (profile.error) {
                                        if (profile.error.code === 7) {
                                            alert('Invalid user ID.');
                                        } else {
                                            alert('Invalid ID or API error: ' + profile.error.error);
                                        }
                                        HoDOverlay.logError(new Error('Invalid ID or API error when adding target: ' + id + ' - ' + profile.error.error));
                                        if (profile.error.code === 14) {
                                            if (!BaseModule._apiModule.alertedPermission) {
                                                alert('API key lacks access to user profile. Please ensure full access or add "user" permission.');
                                                BaseModule._apiModule.alertedPermission = true;
                                            }
                                        }
                                        return;
                                    }
                                    this.targets.push({
                                        id: id,
                                        name: profile.name,
                                        lvl: profile.level,
                                        faction: profile.faction.faction_name,
                                        faction_id: profile.faction.faction_id,
                                        status: profile.status.state,
                                        status_description: profile.status.description,
                                        status_until: profile.status.until || 0,
                                        life: profile.life.current + '/' + profile.life.maximum,
                                        lastAction: profile.last_action.relative,
                                        respectGain: null,
                                        lastUpdate: Date.now()
                                    });
                                    await this.refreshTargets().catch(e => {
                                        console.error("Error refreshing after adding target:", e);
                                        HoDOverlay.logError(e);
                                        alert('Error refreshing after adding target: ' + e.message);
                                    });
                                    this.saveTargets();
                                    sectionContent.innerHTML = this.renderTargetList();
                                    this.attachSortListeners(sectionContent);
                                    this.attachTargetEventListeners(sectionContent);
                                    this.attachImportExportListeners(sectionContent);
                                    this.startCountdownTimers();
                                } catch (e) {
                                    alert('Error adding target: ' + e.message);
                                    console.error("Error adding target:", e);
                                    HoDOverlay.logError(e);
                                }
                            }
                            idInput.value = '';
                        });
                    } else if (e.target.dataset.section === 'wartargets') {
                        // Check and refresh if needed
                        const now = Date.now();
                        const hospitalTargets = this.warTargets.filter(t => t.status === 'Hospital' && now - t.lastUpdate > 10000); // 10s for hospital
                        const otherTargets = this.warTargets.filter(t => t.status !== 'Hospital' && now - t.lastUpdate > 120000); // 2 min for others
                        if (hospitalTargets.length > 0 || otherTargets.length > 0) {
                            await this.refreshSpecificTargets([...hospitalTargets, ...otherTargets], this.warTargets);
                        }
                        sectionContent.innerHTML = this.renderWarTargetList();
                        this.attachSortListeners(sectionContent);
                        this.attachWarTargetEventListeners(sectionContent);
                        this.attachWarImportExportListeners(sectionContent);
                        this.startCountdownTimers();
                        // No poll
                        sectionContent.querySelector('#refresh-war-targets').addEventListener('click', async () => {
                            const scrollLeft = sectionContent.querySelector('.table-container')?.scrollLeft || 0;
                            await this.refreshWarTargets(true).catch(e => {
                                console.error("Error refreshing war targets on button click:", e);
                                HoDOverlay.logError(e);
                                alert('Error refreshing war targets: ' + e.message);
                            });
                            sectionContent.innerHTML = this.renderWarTargetList();
                            sectionContent.querySelector('.table-container').scrollLeft = scrollLeft;
                            this.attachSortListeners(sectionContent);
                            this.attachWarTargetEventListeners(sectionContent);
                            this.attachWarImportExportListeners(sectionContent);
                            this.startCountdownTimers();
                        });
                        const addWarInput = sectionContent.querySelector('#add-war-target-id');
                        addWarInput.addEventListener('focus', () => this.isAddWarFocused = true);
                        addWarInput.addEventListener('blur', () => this.isAddWarFocused = false);
                        sectionContent.querySelector('#add-war-target-btn').addEventListener('click', async () => {
                            const idInput = sectionContent.querySelector('#add-war-target-id');
                            const id = parseInt(idInput.value);
                            if (!isNaN(id) && !this.warTargets.some(t => t.id === id)) {
                                if (this.warTargets.length >= maxTargets) {
                                    alert(`Maximum war targets reached (${maxTargets}). Remove some first.`);
                                    return;
                                }
                                try {
                                    const profile = await this.api(`/user/${id}?selections=profile`, 30000); // Cache 30s
                                    if (profile.error) {
                                        if (profile.error.code === 7) {
                                            alert('Invalid user ID.');
                                        } else {
                                            alert('Invalid ID or API error: ' + profile.error.error);
                                        }
                                        HoDOverlay.logError(new Error('Invalid ID or API error when adding war target: ' + id + ' - ' + profile.error.error));
                                        if (profile.error.code === 14) {
                                            if (!BaseModule._apiModule.alertedPermission) {
                                                alert('API key lacks access to user profile. Please ensure full access or add "user" permission.');
                                                BaseModule._apiModule.alertedPermission = true;
                                            }
                                        }
                                        return;
                                    }
                                    this.warTargets.push({
                                        id: id,
                                        name: profile.name,
                                        lvl: profile.level,
                                        faction: profile.faction.faction_name,
                                        faction_id: profile.faction.faction_id,
                                        status: profile.status.state,
                                        status_description: profile.status.description,
                                        status_until: profile.status.until || 0,
                                        life: profile.life.current + '/' + profile.life.maximum,
                                        lastAction: profile.last_action.relative,
                                        respectGain: null,
                                        lastUpdate: Date.now()
                                    });
                                    await this.refreshWarTargets().catch(e => {
                                        console.error("Error refreshing after adding war target:", e);
                                        HoDOverlay.logError(e);
                                        alert('Error refreshing after adding war target: ' + e.message);
                                    });
                                    this.saveWarTargets();
                                    sectionContent.innerHTML = this.renderWarTargetList();
                                    this.attachSortListeners(sectionContent);
                                    this.attachWarTargetEventListeners(sectionContent);
                                    this.attachWarImportExportListeners(sectionContent);
                                    this.startCountdownTimers();
                                } catch (e) {
                                    alert('Error adding war target: ' + e.message);
                                    console.error("Error adding war target:", e);
                                    HoDOverlay.logError(e);
                                }
                            }
                            idInput.value = '';
                        });
                    } else if (e.target.dataset.section === 'chain') {
                        sectionContent.innerHTML = this.chainTracker.renderUI();
                        const toggleWatcher = () => {
                            if (this.chainTracker.watcherEnabled) {
                                this.chainTracker.stopWatcher();
                            } else {
                                this.chainTracker.startWatcher();
                            }
                            sectionContent.innerHTML = this.chainTracker.renderUI();
                            sectionContent.querySelector('#toggle-watcher').addEventListener('click', toggleWatcher);
                            sectionContent.querySelector('#manual-sync').addEventListener('click', () => this.chainTracker.fetchChainData());
                        };
                        sectionContent.querySelector('#toggle-watcher').addEventListener('click', toggleWatcher);
                        sectionContent.querySelector('#manual-sync').addEventListener('click', () => this.chainTracker.fetchChainData());
                        if (this.chainTracker.watcherEnabled) {
                            this.chainTracker.startLiveUpdate();
                        }
                    } else if (e.target.dataset.section === 'members') {
                        await this.fetchFactionMembers();
                        sectionContent.innerHTML = this.renderMembersList();
                        this.attachSortListeners(sectionContent);
                        sectionContent.querySelector('#member-search').addEventListener('input', Utils.debounce((e) => {
                            this.filterMembersTable(e.target.value);
                        }, 300));
                        this.attachStatusButtonListeners(sectionContent);
                        const table = sectionContent.querySelector('#members-table');
                        const sortCol = localStorage.getItem('HoD_members_sort_col') || 'status_icon';
                        const sortAsc = localStorage.getItem('HoD_members_sort_asc') === 'true';
                        const mode = localStorage.getItem('HoD_members_status_mode') || '0';
                        const btn = table.querySelector('.status-priority-btn');
                        btn.dataset.mode = mode;
                        btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');
                        this.sortTable(table, sortCol, sortAsc);
                        this.startCountdownTimers();
                        this.startMembersPoll(sectionContent);
                        sectionContent.querySelector('#refresh-members').addEventListener('click', async () => {
                            const scrollLeft = sectionContent.querySelector('.table-container')?.scrollLeft || 0;
                            await this.fetchFactionMembers();
                            sectionContent.innerHTML = this.renderMembersList();
                            sectionContent.querySelector('.table-container').scrollLeft = scrollLeft;
                            this.attachSortListeners(sectionContent);
                            sectionContent.querySelector('#member-search').addEventListener('input', Utils.debounce((e) => {
                                this.filterMembersTable(e.target.value);
                            }, 300));
                            this.attachStatusButtonListeners(sectionContent);
                            const table = sectionContent.querySelector('#members-table');
                            const sortCol = localStorage.getItem('HoD_members_sort_col') || 'status_icon';
                            const sortAsc = localStorage.getItem('HoD_members_sort_asc') === 'true';
                            const mode = localStorage.getItem('HoD_members_status_mode') || '0';
                            const btn = table.querySelector('.status-priority-btn');
                            btn.dataset.mode = mode;
                            btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');
                            this.sortTable(table, sortCol, sortAsc);
                            this.startCountdownTimers();
                        });
                    } else if (e.target.dataset.section === 'enemy') {
                        sectionContent.innerHTML = this.renderEnemyList();
                        this.attachSortListeners(sectionContent);
                        sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                            this.filterEnemyTables(e.target.value);
                        }, 300));
                        this.attachEnemyRemovalListeners(sectionContent);
                        this.attachEnemyImportExportListeners(sectionContent);
                        this.attachStatusButtonListeners(sectionContent);
                        sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                            const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                            const btn = table.querySelector('.status-priority-btn');
                            btn.dataset.mode = mode;
                            btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                            const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                            const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                            if (sortCol) {
                                this.sortTable(table, sortCol, sortAsc);
                            }
                        });
                        this.startCountdownTimers();
                        this.startEnemyPoll(sectionContent);
                        const addInput = sectionContent.querySelector('#add-enemy-faction');
                        addInput.addEventListener('focus', () => this.isAddEnemyFocused = true);
                        addInput.addEventListener('blur', () => this.isAddEnemyFocused = false);
                        sectionContent.querySelector('#add-enemy-btn').addEventListener('click', async () => {
                            const input = sectionContent.querySelector('#add-enemy-faction').value.trim();
                            if (input) {
                                try {
                                    let factionId;
                                    if (!isNaN(parseInt(input))) {
                                        factionId = input;
                                    } else {
                                        factionId = await this.searchFactionByName(input);
                                    }
                                    if (factionId) {
                                        await this.fetchEnemyFactionMembers(factionId);
                                        sectionContent.innerHTML = this.renderEnemyList();
                                        this.attachSortListeners(sectionContent);
                                        sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                                            this.filterEnemyTables(e.target.value);
                                        }, 300));
                                        this.attachEnemyRemovalListeners(sectionContent);
                                        this.attachEnemyImportExportListeners(sectionContent);
                                        this.attachStatusButtonListeners(sectionContent);
                                        sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                                            const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                                            const btn = table.querySelector('.status-priority-btn');
                                            btn.dataset.mode = mode;
                                            btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                                            const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                                            const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                                            if (sortCol) {
                                                this.sortTable(table, sortCol, sortAsc);
                                            }
                                        });
                                        this.startCountdownTimers();
                                    } else {
                                        alert('Faction not found.');
                                    }
                                } catch (e) {
                                    alert('Error adding enemy faction: ' + (e.message || e));
                                    console.error("Error adding enemy faction:", e);
                                    HoDOverlay.logError(e);
                                }
                            }
                        });
                        sectionContent.querySelector('#auto-poll-enemy').addEventListener('click', async () => {
                            await this.fetchEnemyFromWar();
                            sectionContent.innerHTML = this.renderEnemyList();
                            // reattach listeners
                            this.attachSortListeners(sectionContent);
                            sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                                this.filterEnemyTables(e.target.value);
                            }, 300));
                            this.attachEnemyRemovalListeners(sectionContent);
                            this.attachEnemyImportExportListeners(sectionContent);
                            this.attachStatusButtonListeners(sectionContent);
                            sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                                const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                                const btn = table.querySelector('.status-priority-btn');
                                btn.dataset.mode = mode;
                                btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                                const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                                const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                                if (sortCol) {
                                    this.sortTable(table, sortCol, sortAsc);
                                }
                            });
                            this.startCountdownTimers();
                        });
                        sectionContent.querySelector('#refresh-enemy').addEventListener('click', async () => {
                            const scrollPositions = {};
                            sectionContent.querySelectorAll('.table-container').forEach(cont => {
                                const fid = cont.dataset.factionId;
                                if (fid) scrollPositions[fid] = cont.scrollLeft;
                            });
                            // Refresh all
                            for (const fid in this.enemyFactions) {
                                await this.fetchEnemyFactionMembers(fid);
                            }
                            sectionContent.innerHTML = this.renderEnemyList();
                            sectionContent.querySelectorAll('.table-container').forEach(cont => {
                                const fid = cont.dataset.factionId;
                                if (fid && scrollPositions[fid] !== undefined) cont.scrollLeft = scrollPositions[fid];
                            });
                            this.attachSortListeners(sectionContent);
                            sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                                this.filterEnemyTables(e.target.value);
                            }, 300));
                            this.attachEnemyRemovalListeners(sectionContent);
                            this.attachEnemyImportExportListeners(sectionContent);
                            this.attachStatusButtonListeners(sectionContent);
                            sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                                const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                                const btn = table.querySelector('.status-priority-btn');
                                btn.dataset.mode = mode;
                                btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                                const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                                const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                                if (sortCol) {
                                    this.sortTable(table, sortCol, sortAsc);
                                }
                            });
                            this.startCountdownTimers();
                        });
                    } else if (e.target.dataset.section === 'errors') {
                        sectionContent.innerHTML = this.renderErrorLog();
                        sectionContent.querySelector('#refresh-errors').addEventListener('click', () => {
                            sectionContent.innerHTML = this.renderErrorLog();
                        });
                        sectionContent.querySelector('#clear-errors').addEventListener('click', () => {
                            if (confirm('Clear all errors?')) {
                                HoDOverlay.errorLog = [];
                                try {
                                    localStorage.setItem("HoD_errors", JSON.stringify(HoDOverlay.errorLog));
                                } catch (e) {
                                    console.error("Failed to clear errorLog in localStorage:", e);
                                    GM_notification("Storage error - clear browser data or check quota.");
                                }
                                sectionContent.innerHTML = this.renderErrorLog();
                            }
                        });
                    } else if (e.target.dataset.section === 'settings') {
                        sectionContent.innerHTML = this.renderSettings();
                        sectionContent.querySelector('#save-thresholds').addEventListener('click', () => {
                            const timeoutInput = sectionContent.querySelector('#timeout-threshold');
                            const approachingInput = sectionContent.querySelector('#approaching-threshold');
                            const enemyOnlineInput = sectionContent.querySelector('#enemy-online-threshold');
                            this.chainTracker.alertThreshold = parseInt(timeoutInput.value) || 60;
                            this.chainTracker.approachingThreshold = parseInt(approachingInput.value) || 10;
                            this.enemyOnlineThreshold = parseInt(enemyOnlineInput.value) || 5;
                            this.chainTracker.saveThresholds();
                            this.saveEnemyOnlineThreshold();
                            alert('Thresholds saved!');
                        });
                        sectionContent.querySelector('#change-api-key').addEventListener('click', async () => {
                            const newKey = prompt("Enter new full access API key");
                            if (newKey) {
                                const userJson = await BaseModule._apiModule.checkKeyValidity(newKey);
                                if (userJson) {
                                    if (userJson.faction.faction_id === 10877 || userJson.faction.faction_name === "House of Dragonborn") {
                                        localStorage.setItem("HoD_API_Key_Enc", ApiModule.encrypt(newKey));
                                        BaseModule._apiModule.setApiParams(newKey, 90);
                                        BaseModule._apiModule.clearCache();
                                        BaseModule._apiModule.apiKeyIsValid = true;
                                        alert(`Welcome ${userJson.name}, ${userJson.faction.position} of ${userJson.faction.faction_name}`);
                                        alert("API key updated.");
                                    } else {
                                        alert("You are not worthy of the House of Dragonborn");
                                    }
                                } else {
                                    alert("Invalid key.");
                                }
                            }
                        });
                        sectionContent.querySelector('#clear-cache').addEventListener('click', () => {
                            BaseModule._apiModule.clearCache();
                            alert("Cache cleared.");
                        });
                    }
                });
            });

            // Default to targets
            container.querySelector('.hod-menu-btn[data-section="targets"]').click();
        }

        attachSortListeners(sectionContent) {
            sectionContent.querySelectorAll('th[data-col]').forEach(th => {
                th.addEventListener('click', () => {
                    const table = th.closest('table');
                    const asc = th.dataset.asc !== 'true';
                    th.dataset.asc = asc ? 'true' : 'false';
                    this.sortTable(table, th.dataset.col, asc);

                    // Save based on table type
                    if (table.id === 'members-table') {
                        localStorage.setItem('HoD_members_sort_col', th.dataset.col);
                        localStorage.setItem('HoD_members_sort_asc', asc.toString());
                    } else if (table.classList.contains('enemy-members-table')) {
                        localStorage.setItem('HoD_enemy_sort_col', th.dataset.col);
                        localStorage.setItem('HoD_enemy_sort_asc', asc.toString());
                    }
                });
            });
        }

        attachTargetEventListeners(sectionContent) {
            sectionContent.querySelectorAll('.remove-target').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    const target = this.targets.find(t => t.id === id);
                    if (target && confirm(`Remove ${target.name} from targets?`)) {
                        this.targets = this.targets.filter(t => t.id !== id);
                        this.saveTargets();
                        sectionContent.innerHTML = this.renderTargetList();
                        this.attachSortListeners(sectionContent);
                        this.attachTargetEventListeners(sectionContent);
                        this.attachImportExportListeners(sectionContent);
                        this.startCountdownTimers();
                    }
                });
            });
        }

        attachWarTargetEventListeners(sectionContent) {
            sectionContent.querySelectorAll('.remove-war-target').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    const target = this.warTargets.find(t => t.id === id);
                    if (target && confirm(`Remove ${target.name} from war targets?`)) {
                        this.warTargets = this.warTargets.filter(t => t.id !== id);
                        this.saveWarTargets();
                        sectionContent.innerHTML = this.renderWarTargetList();
                        this.attachSortListeners(sectionContent);
                        this.attachWarTargetEventListeners(sectionContent);
                        this.attachWarImportExportListeners(sectionContent);
                        this.startCountdownTimers();
                    }
                });
            });
        }

        attachImportExportListeners(sectionContent) {
            sectionContent.querySelector('#export-targets').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(this.targets, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'hod_targets.json';
                a.click();
                URL.revokeObjectURL(url);
            });
            const importFile = sectionContent.querySelector('#import-file');
            sectionContent.querySelector('#import-targets').addEventListener('click', () => {
                importFile.click();
            });
            importFile.addEventListener('change', e => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => {
                        const backup = [...this.targets];
                        try {
                            const imported = JSON.parse(ev.target.result);
                            if (!Array.isArray(imported)) throw new Error('Invalid format: not an array');
                            imported.forEach(t => {
                                if (typeof t.id !== 'number' || typeof t.name !== 'string' || typeof t.lvl !== 'number' || typeof t.status_until !== 'number') {
                                    throw new Error('Invalid target format');
                                }
                            });
                            this.targets = imported.slice(0, maxTargets);
                            this.saveTargets();
                            this.refreshTargets().catch(err => {
                                this.targets = backup;
                                HoDOverlay.logError(err);
                            });
                            sectionContent.innerHTML = this.renderTargetList();
                            this.attachSortListeners(sectionContent);
                            this.attachTargetEventListeners(sectionContent);
                            this.attachImportExportListeners(sectionContent);
                            this.startCountdownTimers();
                        } catch (err) {
                            this.targets = backup;
                            alert('Invalid JSON: ' + err.message);
                            HoDOverlay.logError(err);
                        }
                    };
                    reader.readAsText(file);
                }
            });
        }

        attachWarImportExportListeners(sectionContent) {
            sectionContent.querySelector('#export-war-targets').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(this.warTargets, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'hod_war_targets.json';
                a.click();
                URL.revokeObjectURL(url);
            });
            const importFile = sectionContent.querySelector('#import-war-file');
            sectionContent.querySelector('#import-war-targets').addEventListener('click', () => {
                importFile.click();
            });
            importFile.addEventListener('change', e => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => {
                        const backup = [...this.warTargets];
                        try {
                            const imported = JSON.parse(ev.target.result);
                            if (!Array.isArray(imported)) throw new Error('Invalid format: not an array');
                            imported.forEach(t => {
                                if (typeof t.id !== 'number' || typeof t.name !== 'string' || typeof t.lvl !== 'number' || typeof t.status_until !== 'number') {
                                    throw new Error('Invalid target format');
                                }
                            });
                            this.warTargets = imported.slice(0, maxTargets);
                            this.saveWarTargets();
                            this.refreshWarTargets().catch(err => {
                                this.warTargets = backup;
                                HoDOverlay.logError(err);
                            });
                            sectionContent.innerHTML = this.renderWarTargetList();
                            this.attachSortListeners(sectionContent);
                            this.attachWarTargetEventListeners(sectionContent);
                            this.attachWarImportExportListeners(sectionContent);
                            this.startCountdownTimers();
                        } catch (err) {
                            this.warTargets = backup;
                            alert('Invalid JSON: ' + err.message);
                            HoDOverlay.logError(err);
                        }
                    };
                    reader.readAsText(file);
                }
            });
        }

        attachEnemyRemovalListeners(sectionContent) {
            sectionContent.querySelectorAll('.remove-enemy-faction').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const factionId = e.target.dataset.factionId;
                    if (confirm(`Remove faction ${factionId}?`)) {
                        delete this.enemyFactions[factionId];
                        this.saveToIDB();
                        sectionContent.innerHTML = this.renderEnemyList();
                        this.attachSortListeners(sectionContent);
                        sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                            this.filterEnemyTables(e.target.value);
                        }, 300));
                        this.attachEnemyRemovalListeners(sectionContent);
                        this.attachEnemyImportExportListeners(sectionContent);
                        this.attachStatusButtonListeners(sectionContent);
                        sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                            const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                            const btn = table.querySelector('.status-priority-btn');
                            btn.dataset.mode = mode;
                            btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                            const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                            const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                            if (sortCol) {
                                this.sortTable(table, sortCol, sortAsc);
                            }
                        });
                        this.startCountdownTimers();
                    }
                });
            });
        }

        attachEnemyImportExportListeners(sectionContent) {
            sectionContent.querySelector('#export-enemy').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(this.enemyFactions, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'hod_enemy_factions.json';
                a.click();
                URL.revokeObjectURL(url);
            });
            const importFile = sectionContent.querySelector('#import-enemy-file');
            sectionContent.querySelector('#import-enemy').addEventListener('click', () => {
                importFile.click();
            });
            importFile.addEventListener('change', e => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => {
                        const backup = {...this.enemyFactions};
                        try {
                            const imported = JSON.parse(ev.target.result);
                            if (typeof imported !== 'object' || imported === null) throw new Error('Invalid format: not an object');
                            Object.values(imported).forEach(f => {
                                if (!f.members || typeof f.members !== 'object' || typeof f.name !== 'string') throw new Error('Invalid faction format');
                            });
                            this.enemyFactions = imported;
                            this.saveToIDB();
                            sectionContent.innerHTML = this.renderEnemyList();
                            this.attachSortListeners(sectionContent);
                            sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                                this.filterEnemyTables(e.target.value);
                            }, 300));
                            this.attachEnemyRemovalListeners(sectionContent);
                            this.attachEnemyImportExportListeners(sectionContent);
                            this.attachStatusButtonListeners(sectionContent);
                            sectionContent.querySelectorAll('.enemy-members-table').forEach(table => {
                                const mode = localStorage.getItem('HoD_enemy_status_mode') || '0';
                                const btn = table.querySelector('.status-priority-btn');
                                btn.dataset.mode = mode;
                                btn.classList.add(mode === '0' ? 'green' : mode === '1' ? 'yellow' : 'red');

                                const sortCol = localStorage.getItem('HoD_enemy_sort_col');
                                const sortAsc = localStorage.getItem('HoD_enemy_sort_asc') === 'true';
                                if (sortCol) {
                                    this.sortTable(table, sortCol, sortAsc);
                                }
                            });
                            this.startCountdownTimers();
                        } catch (err) {
                            this.enemyFactions = backup;
                            alert('Invalid JSON: ' + err.message);
                            HoDOverlay.logError(err);
                        }
                    };
                    reader.readAsText(file);
                }
            });
        }

        attachStatusButtonListeners(sectionContent) {
            sectionContent.querySelectorAll('.status-priority-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let mode = parseInt(button.dataset.mode || '0');
                    mode = (mode + 1) % 3;
                    button.dataset.mode = mode.toString();
                    button.classList.remove('green', 'yellow', 'red');
                    if (mode === 0) button.classList.add('green');
                    else if (mode === 1) button.classList.add('yellow');
                    else button.classList.add('red');
                    const table = button.closest('table');
                    this.sortTable(table, 'status_icon', false);
                    // Save based on table type
                    if (table.id === 'members-table') {
                        localStorage.setItem('HoD_members_status_mode', mode.toString());
                        localStorage.setItem('HoD_members_sort_col', 'status_icon');
                        localStorage.setItem('HoD_members_sort_asc', 'false');
                    } else if (table.classList.contains('enemy-members-table')) {
                        localStorage.setItem('HoD_enemy_status_mode', mode.toString());
                        localStorage.setItem('HoD_enemy_sort_col', 'status_icon');
                        localStorage.setItem('HoD_enemy_sort_asc', 'false');
                    }
                });
            });
        }

        renderTargetList() {
            let html = '<div class="button-group"><button id="refresh-targets">Refresh Targets</button><button id="export-targets">Export Targets</button><button id="import-targets">Import Targets</button></div>';
            html += '<input type="file" id="import-file" accept=".json" style="display:none;">';
            html += '<div class="add-form"><input type="text" id="add-target-id" placeholder="Enter Target ID"><button id="add-target-btn">Add</button></div>';
            html += '<p>Note: Respect from last 100 attacks only.</p>';
            html += '<div class="table-container">';
            html += '<table id="target-table" class="responsive-table"><thead><tr><th data-col="name" >Name</th><th data-col="lvl" >Lvl</th><th data-col="faction" >Faction</th><th data-col="life" >Life</th><th data-col="status" >Status</th><th data-col="lastAction" >Last Action</th><th data-col="respectGain" >Respect</th><th data-col="lastUpdate" >Last Update</th><th >Action</th></tr></thead><tbody>';
            const now = this.getServerNow();
            const sortedTargets = [...this.targets].sort((a, b) => {
                function getPriority(t) {
                    const timer = Math.max(0, t.status_until - now);
                    if (t.status === 'Okay') {
                        return { group: 0, value: -(t.respectGain || 0) }; // descending respect
                    } else if (t.status === 'Hospital') {
                        return { group: 1, value: timer };
                    } else if (t.status === 'Jail') {
                        return { group: 2, value: timer };
                    } else if (t.status === 'Traveling') {
                        return { group: 3, value: timer };
                    } else {
                        return { group: 4, value: 0 };
                    }
                }
                const pa = getPriority(a);
                const pb = getPriority(b);
                if (pa.group !== pb.group) return pa.group - pb.group;
                return pa.value - pb.value;
            });
            sortedTargets.forEach(t => {
                const totalSeconds = Math.floor((Date.now() - t.lastUpdate) / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const timeAgo = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                const factionLink = t.faction_id && t.faction !== 'N/A' ? `<a href="https://www.torn.com/factions.php?step=profile&ID=${t.faction_id}" target="_blank">${t.faction}</a>` : (t.faction || 'N/A');
                const respectDisplay = t.respectGain !==null ? t.respectGain : 'N/A';
                let statusDisplay = t.status;
                if (t.status === 'Hospital' || t.status === 'Jail' || t.status === 'Traveling') {
                    let timer = t.status_until - now;
                    if (timer > 0) {
                        statusDisplay += ` (<span class="countdown" data-until="${t.status_until}">${Utils.formatTime(timer, true)}</span>)`;
                    }
                } else if (t.status_description) {
                    statusDisplay += ` - ${t.status_description}`;
                }
                html += `<tr data-id="${t.id}"><td data-label="Name"><a href="https://www.torn.com/profiles.php?XID=${t.id}" target="_blank">${t.name || 'Unidentified'}</a></td><td data-label="Lvl">${t.lvl || 'N/A'}</td><td data-label="Faction">${factionLink}</td><td data-label="Life">${t.life || 'N/A'}</td><td data-label="Status">${statusDisplay}</td><td data-label="Last Action">${t.lastAction || 'N/A'}</td><td data-label="Respect">${respectDisplay}</td><td data-label="Last Update">${timeAgo}</td><td data-label="Action"><button class="remove-target" data-id="${t.id}">Remove</button></td></tr>`;
            });
            html += '</tbody></table></div>';
            return html;
        }

        renderWarTargetList() {
            let html = '<div class="button-group"><button id="refresh-war-targets">Refresh War Targets</button><button id="export-war-targets">Export War Targets</button><button id="import-war-targets">Import War Targets</button></div>';
            html += '<input type="file" id="import-war-file" accept=".json" style="display:none;">';
            html += '<div class="add-form"><input type="text" id="add-war-target-id" placeholder="Enter War Target ID"><button id="add-war-target-btn">Add</button></div>';
            html += '<p>Note: Respect from last 100 attacks only.</p>';
            html += '<div class="table-container">';
            html += '<table id="war-target-table" class="responsive-table"><thead><tr><th data-col="name" >Name</th><th data-col="lvl" >Lvl</th><th data-col="faction" >Faction</th><th data-col="life" >Life</th><th data-col="status" >Status</th><th data-col="lastAction" >Last Action</th><th data-col="respectGain" >Respect</th><th data-col="lastUpdate" >Last Update</th><th >Action</th></tr></thead><tbody>';
            const now = this.getServerNow();
            const sortedWarTargets = [...this.warTargets].sort((a, b) => {
                function getPriority(t) {
                    const timer = Math.max(0, t.status_until - now);
                    if (t.status === 'Okay') {
                        return { group: 0, value: -(t.respectGain || 0) }; // descending respect
                    } else if (t.status === 'Hospital') {
                        return { group: 1, value: timer };
                    } else if (t.status === 'Jail') {
                        return { group: 2, value: timer };
                    } else if (t.status === 'Traveling') {
                        return { group: 3, value: timer };
                    } else {
                        return { group: 4, value: 0 };
                    }
                }
                const pa = getPriority(a);
                const pb = getPriority(b);
                if (pa.group !== pb.group) return pa.group - pb.group;
                return pa.value - pb.value;
            });
            sortedWarTargets.forEach(t => {
                const totalSeconds = Math.floor((Date.now() - t.lastUpdate) / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const timeAgo = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                const factionLink = t.faction_id && t.faction !== 'N/A' ? `<a href="https://www.torn.com/factions.php?step=profile&ID=${t.faction_id}" target="_blank">${t.faction}</a>` : (t.faction || 'N/A');
                const respectDisplay = t.respectGain !== null ? t.respectGain : 'N/A';
                let statusDisplay = t.status;
                if (t.status === 'Hospital' || t.status === 'Jail' || t.status === 'Traveling') {
                    let timer = t.status_until - now;
                    if (timer > 0) {
                        statusDisplay += ` (<span class="countdown" data-until="${t.status_until}">${Utils.formatTime(timer, true)}</span>)`;
                    }
                } else if (t.status_description) {
                    statusDisplay += ` - ${t.status_description}`;
                }
                html += `<tr data-id="${t.id}"><td data-label="Name"><a href="https://www.torn.com/profiles.php?XID=${t.id}" target="_blank">${t.name || 'Unidentified'}</a></td><td data-label="Lvl">${t.lvl || 'N/A'}</td><td data-label="Faction">${factionLink}</td><td data-label="Life">${t.life || 'N/A'}</td><td data-label="Status">${statusDisplay}</td><td data-label="Last Action">${t.lastAction || 'N/A'}</td><td data-label="Respect">${respectDisplay}</td><td data-label="Last Update">${timeAgo}</td><td data-label="Action"><button class="remove-war-target" data-id="${t.id}">Remove</button></td></tr>`;
            });
            html += '</tbody></table></div>';
            return html;
        }

        renderMembersList() {
            let html = '<h3>' + this.factionName + '</h3>';
            html += '<div class="button-group"><button id="refresh-members">Refresh Members</button></div>';
            html += '<input type="text" id="member-search" placeholder="Search members..." style="width: 100%; margin-bottom: 10px;">';
            html += '<div class="table-container">';
            html += '<table id="members-table" class="responsive-table"><thead><tr><th data-col="status_icon"><button class="status-priority-btn status-btn green" data-mode="0"></button></th><th data-col="name" >Name</th><th data-col="level" >Level</th><th data-col="position" >Position</th><th data-col="days_in_faction" >Days in Faction</th><th data-col="last_action" >Last Action</th><th data-col="status" >Status</th></tr></thead><tbody>';
            const now = this.getServerNow();
            Object.entries(this.factionMembers).forEach(([userId, member]) => {
                const statusClass = member.last_action.status.toLowerCase();
                let statusDisplay = member.status.state;
                if (member.status.state === 'Hospital' || member.status.state === 'Jail' || member.status.state === 'Traveling') {
                    let timer = member.status.until - now;
                    if (timer > 0) {
                        statusDisplay += ` (<span class="countdown" data-until="${member.status.until}">${Utils.formatTime(timer, true)}</span>)`;
                    }
                } else if (member.status.description) {
                    statusDisplay += ` - ${member.status.description}`;
                }
                html += `<tr><td data-label=""><span class="status-icon ${statusClass}"></span></td><td data-label="Name"><a href="https://${window.location.host}/profiles.php?XID=${userId}" target="_blank">${member.name}</a></td><td data-label="Level">${member.level}</td><td data-label="Position">${member.position}</td><td data-label="Days in Faction">${member.days_in_faction}</td><td data-label="Last Action">${member.last_action.relative}</td><td data-label="Status">${statusDisplay}</td></tr>`;
            });
            html += '</tbody></table></div>';
            return html;
        }

        renderEnemyList() {
            let html = '<h3>Enemy</h3>';
            html += '<div class="button-group"><button id="refresh-enemy">Refresh Enemy</button><button id="export-enemy">Export Enemy Factions</button><button id="import-enemy">Import Enemy Factions</button></div>';
            html += '<input type="file" id="import-enemy-file" accept=".json" style="display:none;">';
            html += '<div class="add-form"><input type="text" id="add-enemy-faction" placeholder="Enter Faction Name or ID"><button id="add-enemy-btn">Add</button></div>';
            html += '<div class="button-group"><button id="auto-poll-enemy">Auto-Poll from War</button></div>';
            html += '<input type="text" id="enemy-search" placeholder="Search enemy members..." style="width: 100%; margin-bottom: 10px;">';
            const now = this.getServerNow();
            Object.entries(this.enemyFactions).forEach(([factionId, data]) => {
                const members = data.members || {};
                let warInfo = '';
                let factionName = data.name || 'Unknown';
                for (const [warId, war] of Object.entries(this.rankedWars)) {
                    if (war.factions[factionId]) {
                        const enemy = war.factions[factionId];
                        factionName = enemy.name || factionName;
                        const ourFaction = war.factions[this.user.factionID];
                        if (ourFaction) {
                            const ourScore = ourFaction.score;
                            const enemyScore = enemy.score;
                            const difference = ourScore - enemyScore;
                            const diffColor = difference >= 0 ? 'green' : 'red';
                            warInfo = `<p>War vs ${factionName}: Score ${ourScore} - ${enemyScore} (Diff: <span style="color: ${diffColor};">${difference}</span>)</p>`;
                        }
                    }
                }
                html += `<h4>${warInfo ? warInfo : factionName}<button class="remove-enemy-faction" data-faction-id="${factionId}">Remove</button></h4>`;
                html += '<div class="table-container" data-faction-id="' + factionId + '">';
                html += '<table class="responsive-table enemy-members-table"><thead><tr><th data-col="status_icon"><button class="status-priority-btn status-btn green" data-mode="0"></button></th><th data-col="name" >Name</th><th data-col="level" >Level</th><th data-col="position" >Position</th><th data-col="days_in_faction" >Days in Faction</th><th data-col="last_action" >Last Action</th><th data-col="status" >Status</th></tr></thead><tbody>';
                Object.entries(members).forEach(([userId, member]) => {
                    const statusClass = member.last_action.status.toLowerCase();
                    let statusDisplay = member.status.state;
                    if (member.status.state === 'Hospital' || member.status.state === 'Jail' || member.status.state === 'Traveling') {
                        let timer = member.status.until - now;
                        if (timer > 0) {
                            statusDisplay += ` (<span class="countdown" data-until="${member.status.until}">${Utils.formatTime(timer, true)}</span>)`;
                        }
                    } else if (member.status.description) {
                        statusDisplay += ` - ${member.status.description}`;
                    }
                    html += `<tr><td data-label=""><span class="status-icon ${statusClass}"></span></td><td data-label="Name"><a href="https://${window.location.host}/profiles.php?XID=${userId}" target="_blank">${member.name}</a></td><td data-label="Level">${member.level}</td><td data-label="Position">${member.position}</td><td data-label="Days in Faction">${member.days_in_faction}</td><td data-label="Last Action">${member.last_action.relative}</td><td data-label="Status">${statusDisplay}</td></tr>`;
                });
                html += '</tbody></table></div>';
            });
            if (Object.keys(this.enemyFactions).length === 0) {
                html += '<p>No enemy factions added.</p>';
            }
            return html;
        }

        renderErrorLog() {
            let html = '<h3>Error Log</h3>';
            html += '<div class="button-group"><button id="refresh-errors">Refresh</button><button id="clear-errors">Clear</button></div>';
            html += '<div class="table-container">';
            html += '<table class="responsive-table"><thead><tr><th >Timestamp</th><th >Message</th><th >Stack</th></tr></thead><tbody>';
            const groups = new Map();
            HoDOverlay.errorLog.forEach(err => {
                const key = err.message + '||' + (err.stack || '');
                if (groups.has(key)) {
                    const group = groups.get(key);
                    group.count++;
                    if (err.timestamp > group.timestamp) group.timestamp = err.timestamp;
                } else {
                    groups.set(key, {timestamp: err.timestamp, message: err.message, stack: err.stack || '', count: 1});
                }
            });
            const sortedGroups = Array.from(groups.values()).sort((a, b) => b.timestamp - a.timestamp);
            sortedGroups.forEach(group => {
                const time = new Date(group.timestamp).toLocaleString();
                const stackDisplay = group.stack + (group.count > 1 ? ` (x${group.count})` : '');
                html += `<tr><td data-label="Timestamp">${time}</td><td data-label="Message">${group.message}</td><td data-label="Stack">${stackDisplay}</td></tr>`;
            });
            if (sortedGroups.length === 0) {
                html += '<tr><td colspan="3" >No errors logged.</td></tr>';
            }
            html += '</tbody></table></div>';
            return html;
        }

        renderSettings() {
            let html = '<h3>Settings</h3>';
            html += '<h4>Chain Alerts</h4>';
            html += '<div><label for="timeout-threshold">Timeout Alert Threshold (seconds):</label><input type="number" id="timeout-threshold" value="' + this.chainTracker.alertThreshold + '"></div>';
            html += '<div><label for="approaching-threshold">Approaching Bonus Threshold (hits):</label><input type="number" id="approaching-threshold" value="' + this.chainTracker.approachingThreshold + '"></div>';
            html += '<div><label for="enemy-online-threshold">Enemy Online Alert Threshold:</label><input type="number" id="enemy-online-threshold" value="' + this.enemyOnlineThreshold + '"></div>';
            html += '<div class="button-group"><button id="save-thresholds">Save Thresholds</button></div>';
            html += '<h4>API & Cache</h4>';
            html += '<div class="button-group"><button id="change-api-key">Change API Key</button><button id="clear-cache">Clear Cache</button></div>';
            return html;
        }

        parseLastAction(str) {
            if (str === 'Online') return 0;
            if (str === 'Offline') return Infinity;
            const match = str.match(/(\d+)\s+(\w+) ago/);
            if (!match) {
                console.log('Unexpected last_action format:', str);
                return Infinity;
            }
            let val = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            if (unit.startsWith('second')) val *= 1;
            else if (unit.startsWith('minute')) val *= 60;
            else if (unit.startsWith('hour')) val *= 3600;
            else if (unit.startsWith('day')) val *= 86400;
            else if (unit.startsWith('week')) val *= 604800;
            else if (unit.startsWith('month')) val *= 2592000;
            return val;
        }

        sortTable(table, col, asc = true) {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.rows);
            const header = table.querySelector('thead tr');
            const colIndex = Array.from(header.children).findIndex(th => th.dataset.col === col);
            rows.sort((a, b) => {
                let aText = a.querySelector(`td:nth-child(${colIndex + 1})`).textContent.trim();
                let bText = b.querySelector(`td:nth-child(${colIndex + 1})`).textContent.trim();
                let aVal, bVal;

                if (col === 'status_icon') {
                    const mode = parseInt(table.querySelector('.status-priority-btn')?.dataset.mode || '0');
                    const aStatus = a.querySelector('.status-icon').classList[1];
                    const bStatus = b.querySelector('.status-icon').classList[1];
                    aVal = getStatusValue(aStatus, mode);
                    bVal = getStatusValue(bStatus, mode);
                } else if (col === 'lvl' || col === 'level' || col === 'days_in_faction' || col === 'respectGain') {
                    aVal = parseFloat(aText) || 0;
                    bVal = parseFloat(bText) || 0;
                } else if (col === 'life') {
                    aVal = parseFloat(aText.split('/')[0]) || 0;
                    bVal = parseFloat(bText.split('/')[0]) || 0;
                } else if (col === 'lastUpdate') {
                    let aParts = aText.split(':');
                    let bParts = bText.split(':');
                    aVal = (parseInt(aParts[0]) * 60 + parseInt(aParts[1])) || 0;
                    bVal = (parseInt(bParts[0]) * 60 + parseInt(bParts[1])) || 0;
                } else if (col === 'lastAction' || col === 'last_action') {
                    aVal = this.parseLastAction(aText);
                    bVal = this.parseLastAction(bText);
                } else {
                    aVal = aText;
                    bVal = bText;
                }

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return asc ? aVal - bVal : bVal - aVal;
                } else {
                    return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
            });
            rows.forEach(row => tbody.appendChild(row));
        }

        filterMembersTable(query) {
            const table = document.getElementById('members-table');
            if (!table) return;
            const tr = table.getElementsByTagName('tr');
            for (let i = 1; i < tr.length; i++) {
                tr[i].style.display = "";
                const td = tr[i].getElementsByTagName('td');
                let found = false;
                for (let j = 0; j < td.length; j++) {
                    if (td[j].textContent.toUpperCase().indexOf(query.toUpperCase()) > -1) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    tr[i].style.display = "none";
                }
            }
        }

        filterEnemyTables(query) {
            const tables = document.querySelectorAll('.enemy-members-table');
            tables.forEach(table => {
                const tr = table.getElementsByTagName('tr');
                for (let i = 1; i < tr.length; i++) {
                    tr[i].style.display = "";
                    const td = tr[i].getElementsByTagName('td');
                    let found = false;
                    for (let j = 0; j < td.length; j++) {
                        if (td[j].textContent.toUpperCase().indexOf(query.toUpperCase()) > -1) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        tr[i].style.display = "none";
                    }
                }
            });
        }

        onUserLoaded() {
            if (document.location.href.includes("profiles.php")) {
                this.addProfileButtons();
            }
        }
    }

    function getStatusValue(status, mode) {
        if (mode === 0) { // online > idle > offline
            if (status === 'online') return 2;
            if (status === 'idle') return 1;
            if (status === 'offline') return 0;
        } else if (mode === 1) { // idle > online > offline
            if (status === 'idle') return 2;
            if (status === 'online') return 1;
            if (status === 'offline') return 0;
        } else if (mode === 2) { // offline > idle > online
            if (status === 'offline') return 2;
            if (status === 'idle') return 1;
            if (status === 'online') return 0;
        }
        return -1;
    }

    // Initialization
    let apiKeyEnc = localStorage.getItem("HoD_API_Key_Enc");
    let apiKey;
    if (apiKeyEnc) {
        apiKey = ApiModule.decrypt(apiKeyEnc);
    }
    if (!apiKey) {
        apiKey = prompt("Enter your Torn API key with full access: This key is stored locally and encrypted.");
        if (apiKey) {
            const userJson = await BaseModule._apiModule.checkKeyValidity(apiKey);
            if (userJson) {
                if (userJson.faction.faction_id === 10877 || userJson.faction.faction_name === "House of Dragonborn") {
                    localStorage.setItem("HoD_API_Key_Enc", ApiModule.encrypt(apiKey));
                    BaseModule._apiModule.clearCache();
                    BaseModule._apiModule.apiKeyIsValid = true;
                    BaseModule._apiModule.setApiParams(apiKey, 90);
                    alert(`Welcome ${userJson.name}, ${userJson.faction.position} of ${userJson.faction.faction_name}`);
                    const hodOverlay = new HoDOverlay();
                } else {
                    alert("You are not worthy of the House of Dragonborn");
                }
            } else {
                alert("Invalid API key. Script will run in limited mode.");
                const hodOverlay = new HoDOverlay();
            }
        } else {
            alert("API key is required for full functionality. Script will run in limited mode.");
            const hodOverlay = new HoDOverlay();
        }
    } else {
        const userJson = await BaseModule._apiModule.checkKeyValidity(apiKey);
        if (userJson) {
            BaseModule._apiModule.apiKeyIsValid = true;
            BaseModule._apiModule.setApiParams(apiKey, 90);
            if (userJson.faction.faction_id === 10877 || userJson.faction.faction_name === "House of Dragonborn") {
                const hodOverlay = new HoDOverlay();
            } else {
                alert("You are not worthy of the House of Dragonborn");
            }
        } else {
            BaseModule._apiModule.apiKeyIsValid = false;
            alert("Stored API key is invalid. Please update in settings for full functionality.");
            const hodOverlay = new HoDOverlay();
        }
    }
})();
