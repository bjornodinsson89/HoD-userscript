// baseModule.js - BaseModule class module

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
