// hodOverlay.js - HoDOverlay class module

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
        this.offsets = [];
        this.serverTimeInterval = null;
        this.backgroundInterval = null;
        this.startServerTimeFetch();
        this.backgroundInterval = setInterval(() => this.backgroundRefresh(), 300000);
        this.fetchAttackLog();
        this.checkForUpdates();
        this.renderOverlay();
        this.observeProfileChanges();
        this.countdownIntervals = [];
        this.lastEnemyOnlineCheck = 0;
        this.lastEnemyOnlineNotification = 0;
        this.enemyOnlineThreshold = parseInt(localStorage.getItem("HoD_enemy_online_threshold") || "5");
    }

    startServerTimeFetch() {
        if (this.serverTimeInterval) clearInterval(this.serverTimeInterval);
        this.serverTimeInterval = setInterval(() => this.fetchServerTime(), 3000);
    }

    stopServerTimeFetch() {
        if (this.serverTimeInterval) {
            clearInterval(this.serverTimeInterval);
            this.serverTimeInterval = null;
        }
    }

    observeProfileChanges() {
        const observer = new MutationObserver(() => {
            if (location.href.includes("profiles.php") && document.querySelector('.content-title') && !document.querySelector('#hod-toggle-container')) {
                this.addProfileButtons();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async loadFromIDB() {
        try {
            this.targets = await getFromDB('targets', 'targets') || [];
            this.warTargets = await getFromDB('warTargets', 'warTargets') || [];
            this.factionMembers = await getFromDB('factionMembers', 'factionMembers') || {};
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
            await setToDB('factionMembers', 'factionMembers', this.factionMembers);
            await setToDB('rankedWars', 'rankedWars', this.rankedWars);
            await setToDB('enemyFactions', 'enemyFactions', this.enemyFactions);
        } catch (e) {
            console.error("Failed to save to IndexedDB:", e);
            HoDOverlay.logError(e);
            GM_notification('Database error: ' + e.message);
        }
    }

    async backgroundRefresh() {
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
            for (const war of Object.values(this.rankedWars)) {
                const enemyId = Object.keys(war.factions).find(id => id != this.user.factionID);
                if (enemyId && !this.enemyFactions[enemyId]) {
                    try {
                        await this.fetchEnemyFactionMembers(enemyId);
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
        try {
            const local_t1 = Date.now();
            const response = await fetch(`https://api.torn.com/torn/?selections=timestamp&key=${BaseModule._apiModule.apiKey}`);
            const local_t2 = Date.now();
            const json = await response.json();
            if (!json.error) {
                const rtt = local_t2 - local_t1;
                const estimated_server_at_t2 = json.timestamp + (rtt / 2000);
                const newOffset = estimated_server_at_t2 - (local_t2 / 1000);
                this.offsets.push(newOffset);
                if (this.offsets.length > 10) this.offsets.shift();
                this.offset = this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length;
            }
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
                    span.textContent = Utils.formatTime(Math.ceil(timer), true);
                } else {
                    span.textContent = '0s';
                }
            });
        }, 1000);
        this.countdownIntervals.push(interval);
    }

    async fetchAttackLog() {
        try {
            const json = await this.api('/user?selections=attacks', 60000);
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
        const updateURL = 'https://raw.githubusercontent.com/bjornodinsson89/HoD/main/HoD.user.js';
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

    async refreshTargets() {
        await this.fetchAttackLog();
        const now = Date.now();
        const chunkSize = 5; // Process in chunks to avoid rate limiting
        const toRefresh = this.targets.filter(t => now - t.lastUpdate > 600000); // Refresh if >10 min old
        for (let i = 0; i < toRefresh.length; i += chunkSize) {
            const chunk = toRefresh.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (target, idx) => {
                try {
                    const profile = await this.api(`/user/${target.id}?selections=profile`, 60000); // Increased cache to 1 min
                    if (profile.error) {
                        console.error(`Error fetching profile for ${target.id}: ${profile.error.error}`);
                        HoDOverlay.logError(new Error(`Error fetching profile for ${target.id}: ${profile.error.error}`));
                        if (profile.error.code === 7) { // Invalid ID
                            const index = this.targets.findIndex(t => t.id === target.id);
                            if (index !== -1) this.targets.splice(index, 1); // Remove invalid
                        } else if (profile.error.code === 14) {
                            alert('API key lacks access to user profile. Please add "user" permission to your limited API key in Torn settings.');
                        }
                        toRefresh[idx].name = 'Error fetching name';
                        return;
                    }
                    if (!profile.name) {
                        console.log('Missing name in response for ID ' + target.id, profile);
                        toRefresh[idx].name = 'Unidentified (ID: ' + target.id + ')';
                    } else {
                        toRefresh[idx].name = profile.name;
                    }
                    let respectGain = null;
                    if (this.attackLog[target.id]) {
                        respectGain = this.attackLog[target.id].respect_gain;
                    }
                    toRefresh[idx] = {
                        ...target,
                        lvl: profile.level,
                        faction: profile.faction.faction_name,
                        faction_id: profile.faction.faction_id,
                        status: profile.status.state,
                        status_description: profile.status.description,
                        status_until: profile.status.until || 0,
                        life: profile.life.current + '/' + profile.life.maximum,
                        lastAction: profile.last_action.relative,
                        respectGain: respectGain,
                        lastUpdate: Date.now()
                    };
                } catch (e) {
                    console.error(`Exception fetching profile for ${target.id}:`, e);
                    HoDOverlay.logError(e);
                    toRefresh[idx].name = 'Error fetching name';
                }
            }));
            await Utils.sleep(500); // Delay between chunks
        }
        this.saveTargets();
    }

    async refreshWarTargets() {
        await this.fetchAttackLog();
        const now = Date.now();
        const chunkSize = 5; // Process in chunks to avoid rate limiting
        const toRefresh = this.warTargets.filter(t => now - t.lastUpdate > 600000); // Refresh if >10 min old
        for (let i = 0; i < toRefresh.length; i += chunkSize) {
            const chunk = toRefresh.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (target, idx) => {
                try {
                    const profile = await this.api(`/user/${target.id}?selections=profile`, 60000); // Increased cache to 1 min
                    if (profile.error) {
                        console.error(`Error fetching profile for ${target.id}: ${profile.error.error}`);
                        HoDOverlay.logError(new Error(`Error fetching profile for ${target.id}: ${profile.error.error}`));
                        if (profile.error.code === 7) { // Invalid ID
                            const index = this.warTargets.findIndex(t => t.id === target.id);
                            if (index !== -1) this.warTargets.splice(index, 1); // Remove invalid
                        } else if (profile.error.code === 14) {
                            alert('API key lacks access to user profile. Please add "user" permission to your limited API key in Torn settings.');
                        }
                        toRefresh[idx].name = 'Error fetching name';
                        return;
                    }
                    if (!profile.name) {
                        console.log('Missing name in response for ID ' + target.id, profile);
                        toRefresh[idx].name = 'Unidentified (ID: ' + target.id + ')';
                    } else {
                        toRefresh[idx].name = profile.name;
                    }
                    let respectGain = null;
                    if (this.attackLog[target.id]) {
                        respectGain = this.attackLog[target.id].respect_gain;
                    }
                    toRefresh[idx] = {
                        ...target,
                        lvl: profile.level,
                        faction: profile.faction.faction_name,
                        faction_id: profile.faction.faction_id,
                        status: profile.status.state,
                        status_description: profile.status.description,
                        status_until: profile.status.until || 0,
                        life: profile.life.current + '/' + profile.life.maximum,
                        lastAction: profile.last_action.relative,
                        respectGain: respectGain,
                        lastUpdate: Date.now()
                    };
                } catch (e) {
                    console.error(`Exception fetching profile for ${target.id}:`, e);
                    HoDOverlay.logError(e);
                    toRefresh[idx].name = 'Error fetching name';
                }
            }));
            await Utils.sleep(500); // Delay between chunks
        }
        this.saveWarTargets();
    }

    async fetchFactionMembers() {
        try {
            const json = await this.api('/faction?selections=basic', 60000); // Cache 1 min
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
        try {
            const json = await this.api('/faction?selections=rankedwars', 30000); // Cache 30s
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
        try {
            const json = await this.api(`/faction/${factionId}?selections=basic`, 60000); // Cache 1 min
            if (!json.error) {
                this.enemyFactions[factionId] = {members: json.members, name: json.name};
                await setToDB('enemyFactions', 'enemyFactions', this.enemyFactions);
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
                if (enemyId) {
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
        let intervalId = setInterval(async () => {
            const contentTitle = document.querySelector('.content-title');
            if (contentTitle && !document.querySelector('#hod-toggle-container')) {
                clearInterval(intervalId);
                const urlParams = new URLSearchParams(window.location.search);
                const profileId = parseInt(urlParams.get('XID'));
                if (!isNaN(profileId)) {
                    try {
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
                    } catch (e) {
                        console.error("Error adding profile toggles:", e);
                        HoDOverlay.logError(e);
                    }
                }
            }
        }, 100); // Poll every 100ms
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
        tab.style.right = isOpen ? `${this.width + 2}px` : '2px';
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
        tab.style.right = '4px';
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

        tab.addEventListener('click', () => {
            const isOpen = overlay.style.right === '0px';
            overlay.style.right = isOpen ? closedRight : '0px';
            tab.style.right = isOpen ? '4px' : `${this.width + 2}px`;
            tab.innerHTML = isOpen ? '<img src="https://i.postimg.cc/CdyVTGnS/1761005079868.png" style="width: 26px; height: 26px;" alt="HoD Icon">' : '<span style="color: #fff;">Close</span>';
            if (!isOpen) {
                // Opening
                this.renderContent(contentWrapper);
                this.backgroundInterval = setInterval(() => this.backgroundRefresh(), 300000);
                this.startServerTimeFetch();
            } else {
                // Closing
                this.clearCountdownIntervals();
                this.chainTracker.stopWatcher();
                if (this.backgroundInterval) {
                    clearInterval(this.backgroundInterval);
                    this.backgroundInterval = null;
                }
                this.stopServerTimeFetch();
            }
        });
    }

    async renderContent(container) {
        if (!this.isApiKeyValid()) {
            container.innerHTML = '<p>API key is invalid or missing. Limited functionality available. Please reload and enter a valid key with "user" permission for profile access.</p>';
            return;
        }
        let html = '<img src="https://i.ibb.co/tLmq7Kc/3-RD-ENTRY.gif" alt="Banner" style="width: 100%; height: auto; margin-bottom: 10px;">';
        html += '<p id="tct-clock"></p>';
        html += '<div id="hod-menu"><button class="hod-menu-btn active" data-section="targets">Targets</button><button class="hod-menu-btn" data-section="wartargets">War Targets</button><button class="hod-menu-btn" data-section="chain">Chain Tracker</button><button class="hod-menu-btn" data-section="members">Members</button><button class="hod-menu-btn" data-section="enemy">Enemy</button><button class="hod-menu-btn" data-section="errors">Errors</button><button class="hod-menu-btn" data-section="settings">Settings</button></div>';
        html += '<div id="hod-section-content"></div>';
        container.innerHTML = html;

        setInterval(() => {
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

        container.querySelectorAll('.hod-menu-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                container.querySelectorAll('.hod-menu-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const sectionContent = container.querySelector('#hod-section-content');
                this.clearCountdownIntervals();
                if (e.target.dataset.section === 'targets') {
                    sectionContent.innerHTML = this.renderTargetList();
                    this.attachSortListeners(sectionContent);
                    this.attachTargetEventListeners(sectionContent);
                    this.attachImportExportListeners(sectionContent);
                    this.startCountdownTimers();
                    sectionContent.querySelector('#refresh-targets').addEventListener('click', async () => {
                        await this.refreshTargets().catch(e => {
                            console.error("Error refreshing targets on button click:", e);
                            HoDOverlay.logError(e);
                            alert('Error refreshing targets: ' + e.message);
                        });
                        sectionContent.innerHTML = this.renderTargetList();
                        this.attachSortListeners(sectionContent);
                        this.attachTargetEventListeners(sectionContent);
                        this.attachImportExportListeners(sectionContent);
                        this.startCountdownTimers();
                    });
                    sectionContent.querySelector('#add-target-btn').addEventListener('click', async () => {
                        const idInput = sectionContent.querySelector('#add-target-id');
                        const id = parseInt(idInput.value);
                        if (!isNaN(id) && !this.targets.some(t => t.id === id)) {
                            try {
                                const profile = await this.api(`/user/${id}?selections=profile`, 0);
                                if (profile.error) {
                                    if (profile.error.code === 7) {
                                        alert('Invalid user ID.');
                                    } else {
                                        alert('Invalid ID or API error: ' + profile.error.error);
                                    }
                                    HoDOverlay.logError(new Error('Invalid ID or API error when adding target: ' + id + ' - ' + profile.error.error));
                                    if (profile.error.code === 14) {
                                        alert('API key lacks access to user profile. Please add "user" permission to your limited API key in Torn settings.');
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
                    sectionContent.innerHTML = this.renderWarTargetList();
                    this.attachSortListeners(sectionContent);
                    this.attachWarTargetEventListeners(sectionContent);
                    this.attachWarImportExportListeners(sectionContent);
                    this.startCountdownTimers();
                    sectionContent.querySelector('#refresh-war-targets').addEventListener('click', async () => {
                        await this.refreshWarTargets().catch(e => {
                            console.error("Error refreshing war targets on button click:", e);
                            HoDOverlay.logError(e);
                            alert('Error refreshing war targets: ' + e.message);
                        });
                        sectionContent.innerHTML = this.renderWarTargetList();
                        this.attachSortListeners(sectionContent);
                        this.attachWarTargetEventListeners(sectionContent);
                        this.attachWarImportExportListeners(sectionContent);
                        this.startCountdownTimers();
                    });
                    sectionContent.querySelector('#add-war-target-btn').addEventListener('click', async () => {
                        const idInput = sectionContent.querySelector('#add-war-target-id');
                        const id = parseInt(idInput.value);
                        if (!isNaN(id) && !this.warTargets.some(t => t.id === id)) {
                            try {
                                const profile = await this.api(`/user/${id}?selections=profile`, 0);
                                if (profile.error) {
                                    if (profile.error.code === 7) {
                                        alert('Invalid user ID.');
                                    } else {
                                        alert('Invalid ID or API error: ' + profile.error.error);
                                    }
                                    HoDOverlay.logError(new Error('Invalid ID or API error when adding war target: ' + id + ' - ' + profile.error.error));
                                    if (profile.error.code === 14) {
                                        alert('API key lacks access to user profile. Please add "user" permission to your limited API key in Torn settings.');
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
                    };
                    sectionContent.querySelector('#toggle-watcher').addEventListener('click', toggleWatcher);
                    if (this.chainTracker.watcherEnabled) {
                        this.chainTracker.startLiveUpdate();
                    }
                } else if (e.target.dataset.section === 'members') {
                    sectionContent.innerHTML = this.renderMembersList();
                    this.attachSortListeners(sectionContent);
                    sectionContent.querySelector('#member-search').addEventListener('input', Utils.debounce((e) => {
                        this.filterMembersTable(e.target.value);
                    }, 300));
                    this.attachStatusButtonListeners(sectionContent);
                    const table = sectionContent.querySelector('#members-table');
                    this.sortTable(table, 'status_icon', false); // Initial sort: online first
                    this.startCountdownTimers();
                    this.fetchFactionMembers().catch(e => {
                        console.error("Error refreshing members:", e);
                        HoDOverlay.logError(e);
                    });
                } else if (e.target.dataset.section === 'enemy') {
                    sectionContent.innerHTML = this.renderEnemyList();
                    this.attachSortListeners(sectionContent);
                    sectionContent.querySelector('#enemy-search').addEventListener('input', Utils.debounce((e) => {
                        this.filterEnemyTables(e.target.value);
                    }, 300));
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
                                    sectionContent.querySelector('#add-enemy-btn').addEventListener('click', async () => { /* recursive, but ok */ });
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
                                        sectionContent.querySelector('#add-enemy-btn').addEventListener('click', async () => { /* ... */ });
                                        sectionContent.querySelector('#auto-poll-enemy').addEventListener('click', async () => { /* ... */ });
                                        this.startCountdownTimers();
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
                        sectionContent.querySelector('#add-enemy-btn').addEventListener('click', async () => { /* ... */ });
                        sectionContent.querySelector('#auto-poll-enemy').addEventListener('click', async () => { /* ... */ });
                        this.startCountdownTimers();
                    });
                    this.attachEnemyRemovalListeners(sectionContent);
                    this.attachEnemyImportExportListeners(sectionContent);
                    this.attachStatusButtonListeners(sectionContent);
                    this.startCountdownTimers();
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
                        const newKey = prompt("Enter new API key");
                        if (newKey) {
                            const valid = await BaseModule._apiModule.checkKeyValidity(newKey);
                            if (valid) {
                                localStorage.setItem("HoD_API_Key", newKey);
                                BaseModule._apiModule.setApiParams(newKey, 90);
                                BaseModule._apiModule.clearCache();
                                BaseModule._apiModule.apiKeyIsValid = true;
                                alert("API key updated.");
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
                    try {
                        const imported = JSON.parse(ev.target.result);
                        if (!Array.isArray(imported)) throw new Error('Invalid format: not an array');
                        imported.forEach(t => {
                            if (typeof t.id !== 'number' || typeof t.name !== 'string' || typeof t.lvl !== 'number' || typeof t.status_until !== 'number') {
                                throw new Error('Invalid target format');
                            }
                        });
                        const backup = [...this.targets];
                        this.targets = imported;
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
                    try {
                        const imported = JSON.parse(ev.target.result);
                        if (!Array.isArray(imported)) throw new Error('Invalid format: not an array');
                        imported.forEach(t => {
                            if (typeof t.id !== 'number' || typeof t.name !== 'string' || typeof t.lvl !== 'number' || typeof t.status_until !== 'number') {
                                throw new Error('Invalid target format');
                            }
                        });
                        const backup = [...this.warTargets];
                        this.warTargets = imported;
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
                    try {
                        const imported = JSON.parse(ev.target.result);
                        if (typeof imported !== 'object' || imported === null) throw new Error('Invalid format: not an object');
                        Object.values(imported).forEach(f => {
                            if (!f.members || typeof f.members !== 'object' || typeof f.name !== 'string') throw new Error('Invalid faction format');
                        });
                        const backup = {...this.enemyFactions};
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
                this.sortTable(table, 'status_icon', false); // always desc for priority
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
        html += '<div class="button-group"><button id="export-enemy">Export Enemy Factions</button><button id="import-enemy">Import Enemy Factions</button></div>';
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
            html += '<div class="table-container">';
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
        if (!match) return Infinity;
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
