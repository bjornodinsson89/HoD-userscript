// ==UserScript==
// @name         HoD
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  HoD member utilities
// @author       BjornOdinsson89
// @match        https://www.torn.com/*
// @match        https://www2.torn.com/*
// @updateURL    https://raw.githubusercontent.com/bjornodinsson89/HoD/main/HoD.meta.js
// @downloadURL  https://raw.githubusercontent.com/bjornodinsson89/HoD/main/HoD.user.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/db.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/utils.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/ajaxModule.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/apiModule.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/baseModule.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/chainTracker.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/hodOverlay.js
// @require      https://raw.githubusercontent.com/bjornodinsson89/HoD/main/helpers.js
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      github.com
// @connect      api.torn.com
// ==/UserScript==
/* global BaseModule, ApiModule, AjaxModule, ChainTracker, HoDOverlay, Utils, getStatusValue */
(async function() {
    'use strict';

    const dbName = "HoDDB";
    const dbVersion = 1;

    GM_addStyle(`#hod-overlay{color:#fff;background:#111;border-left:2px solid #444;border-radius:10px 0 0 10px;box-shadow:0 0 10px rgba(0,0,0,0.5);box-sizing:border-box;font-size:14px;line-height:1.5;font-family:Arial,sans-serif;overflow:hidden;}#hod-tab{transition:right 0.3s ease;background:#111;border:2px solid #444;border-right:none;border-radius:5px 0 0 5px;box-sizing:border-box;}#hod-menu{display:flex;justify-content:flex-start;border-bottom:1px solid #444;margin-bottom:0;overflow-x:auto;white-space:nowrap;padding-left:1.5%;}.hod-menu-btn{background:#222;color:#fff;border:1px solid #444;border-bottom:none;border-radius:5px 5px 0 0;padding:6px 9px;margin:0 2px 0 0;cursor:pointer;font-size:13px;font-family:Arial,sans-serif;transition:transform 0.1s,background-color 0.1s;}.hod-menu-btn.active{background:#111;border:1px solid #444;border-bottom:none;}.hod-menu-btn:active{transform:scale(0.98);background-color:#333;}#hod-overlay button{background:#222;color:#fff;border:1px solid #444;padding:6px 12px;cursor:pointer;font-size:14px;font-family:Arial,sans-serif;transition:transform 0.1s,background-color 0.1s,box-shadow 0.1s;border-radius:4px;}#hod-overlay button:hover{background-color:#333;box-shadow:0 0 5px rgba(255,255,255,0.1);}#hod-overlay button:active{transform:scale(0.98);background-color:#333;}#hod-overlay input{background:#111;color:#fff;border:1px solid #444;padding:6px;font-size:14px;font-family:Arial,sans-serif;border-radius:4px;}#hod-overlay select{background:#111;color:#fff;border:1px solid #444;padding:4px;font-size:14px;font-family:Arial,sans-serif;cursor:pointer;border-radius:4px;}#hod-overlay table{color:#fff;min-width:200%;border-collapse:separate;border-spacing:0 2px;table-layout:fixed;}#hod-overlay h3{color:#fff;margin:12px 0 8px;font-family:Arial,sans-serif;text-align:center;}#hod-overlay p{color:#fff;margin:8px 0;font-family:Arial,sans-serif;text-align:center;}#hod-overlay table th,#hod-overlay table td{border:1px solid #444;padding:4px 6px;word-break:break-word;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-family:Arial,sans-serif;color:#fff !important;}#hod-section-content{margin-top:10px;}#hod-overlay a{color:#5dade2;text-decoration:none;}#hod-overlay a:visited{color:#5dade2;}@media (max-width: 300px){#hod-overlay .responsive-table{border:none;}#hod-overlay .responsive-table thead{display:none;}#hod-overlay .responsive-table tr{margin-bottom:10px;display:block;border:1px solid #444;border-radius:5px;}#hod-overlay .responsive-table td{display:block;text-align:right;font-size:13px;border:none;position:relative;padding-left:50%;}#hod-overlay .responsive-table td:before{content:attr(data-label);position:absolute;left:0;width:50%;padding-left:10px;font-weight:bold;text-align:left;}}.status-icon{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:5px;}.status-icon.online{background-color:green;}.status-icon.offline{background-color:red;}.status-icon.idle{background-color:yellow;}.table-container{overflow:auto;}#hod-content{display:flex;flex-direction:column;height:100%;overflow:hidden;}#hod-section-content{flex:1;overflow-y:auto;margin-top:10px;}.bar-container{width:100%;background:#333;height:10px;}.bar{height:100%;background:green;}.status-btn{width:12px;height:12px;border-radius:50%;border:none;cursor:pointer;margin-right:5px;}.status-btn.green{background:green;}.status-btn.yellow{background:yellow;}.status-btn.red{background:red;}.button-group{display:flex;justify-content:center;gap:10px;margin-bottom:10px;}.add-form{display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:10px;}.add-form input{flex:1;max-width:70%;}h4{display:flex;justify-content:center;align-items:center;gap:10px;margin:10px 0;}#tct-clock{text-align:center;color:#fff;font-size:16px;margin-bottom:10px;}
#hod-toggle-container { display: flex; gap: 20px; margin-left: 10px; }
.hod-toggle-group { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.hod-toggle-label { color: #fff; font-size: 12px; }
.hod-toggle { display: none; }
.hod-toggle + label { background-color: #444; border-radius: 50px; padding: 1px; transition: background-color 0.3s ease-in-out; width: 40px; height: 20px; position: relative; cursor: pointer; display: inline-block; }
.hod-toggle + label::before { content: ''; position: absolute; top: 1px; left: 1px; background-color: #fff; background-image: url('https://i.postimg.cc/CdyVTGnS/1761005079868.png'); background-size: contain; background-repeat: no-repeat; border-radius: 50%; width: 18px; height: 18px; transition: transform 0.3s ease-in-out; }
.hod-toggle:checked + label { background-color: #4CAF50; box-shadow: 0 0 5px #4CAF50; transition: box-shadow 0.3s ease-in-out; }
.hod-toggle:checked + label::before { transform: translateX(20px); }
`);

    // Initialization
    let apiKey = localStorage.getItem("HoD_API_Key");
    if (!apiKey) {
        apiKey = prompt("Enter your Torn API key with at least 'limited' access or custom with 'user' permission: This key is stored locally.");
        if (apiKey) {
            try {
                const valid = await BaseModule._apiModule.checkKeyValidity(apiKey);
                if (valid) {
                    localStorage.setItem("HoD_API_Key", apiKey);
                    BaseModule._apiModule.clearCache();
                    BaseModule._apiModule.apiKeyIsValid = true;
                    BaseModule._apiModule.setApiParams(apiKey, 90);
                } else {
                    alert("Invalid API key or lacks 'user' permission. Please try again.");
                }
            } catch (e) {
                console.error("Error during API key validation:", e);
                alert("Error validating API key. Please try again.");
            }
        } else {
            alert("API key is required for full functionality. Script will run in limited mode.");
        }
    } else {
        try {
            const valid = await BaseModule._apiModule.checkKeyValidity(apiKey);
            if (valid) {
                BaseModule._apiModule.apiKeyIsValid = true;
                BaseModule._apiModule.setApiParams(apiKey, 90);
            } else {
                localStorage.removeItem("HoD_API_Key");
                alert("Stored API key is invalid or lacks 'user' permission. Please enter a new one.");
                window.location.reload();
            }
        } catch (e) {
            console.error("Error checking stored API key validity:", e);
            localStorage.removeItem("HoD_API_Key");
            alert("Error with stored API key. Please enter a new one.");
            window.location.reload();
        }
    }

    new HoDOverlay();
})();
