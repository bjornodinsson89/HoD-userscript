// utils.js - Utils class module

class Utils {
    static async sleep(ms) {
        return new Promise(e => setTimeout(e, ms));
    }

    static formatTime(seconds, alternateFormat = false) {
        seconds = Math.max(0, seconds);

        let hours = parseInt(seconds/3600);
        seconds -= hours*3600;

        let minutes = parseInt(seconds/60);
        seconds -= minutes*60;

        if(alternateFormat) {
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
