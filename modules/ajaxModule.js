// ajaxModule.js - AjaxModule class module

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
