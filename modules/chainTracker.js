// chainTracker.js - ChainTracker class module

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
            const json = await this.api('/faction?selections=chain', 5000); // Optimized cache 5s for chain
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
        this.watchChain();
    }

    stopWatcher() {
        this.watcherEnabled = false;
        if (this.timeoutTimer) {
            clearInterval(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }

    async watchChain() {
        if (!this.watcherEnabled) return;
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
        setTimeout(() => this.watchChain(), 3000); // Poll every 3 seconds
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
        html += '<div class="button-group"><button id="toggle-watcher">' + (this.watcherEnabled ? 'Disable Watcher' : 'Enable Watcher') + '</button></div>';
        return html;
    }
}
