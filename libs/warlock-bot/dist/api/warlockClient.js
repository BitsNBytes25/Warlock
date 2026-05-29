"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarlockClient = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const fetch_cookie_1 = __importDefault(require("fetch-cookie"));
const tough_cookie_1 = require("tough-cookie");
const cheerio = __importStar(require("cheerio"));
const speakeasy = __importStar(require("speakeasy"));
class WarlockClient {
    baseUrl;
    jar;
    fetchWithCookies;
    isAuthenticated = false;
    constructor() {
        this.baseUrl = process.env.WARLOCK_API_URL || 'http://127.0.0.1:8080';
        this.jar = new tough_cookie_1.CookieJar();
        // Wrap global fetch to automatically handle Set-Cookie and Cookie headers
        this.fetchWithCookies = (0, fetch_cookie_1.default)(node_fetch_1.default, this.jar);
    }
    async authenticate() {
        const username = (process.env.WARLOCK_USERNAME || '').trim();
        const password = (process.env.WARLOCK_PASSWORD || '').trim();
        const secret = (process.env.WARLOCK_2FA_SECRET || '').trim();
        if (!username || !password) {
            throw new Error('WARLOCK_USERNAME or WARLOCK_PASSWORD is not set.');
        }
        console.log('[WarlockClient] Fetching login page to grab CSRF token...');
        let getRes;
        try {
            getRes = await this.fetchWithCookies(`${this.baseUrl}/login`, { method: 'GET' });
        }
        catch (err) {
            console.error('[WarlockClient] Network error during GET /login:', err);
            throw err;
        }
        const html = await getRes.text();
        const $ = cheerio.load(html);
        const csrfToken = $('input[name="_csrf"]').val();
        if (!csrfToken) {
            throw new Error('Could not extract CSRF token from login page.');
        }
        let authcode = '';
        if (secret) {
            authcode = speakeasy.totp({
                secret: secret,
                encoding: 'base32'
            });
        }
        console.log('[WarlockClient] Submitting login form...');
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);
        if (authcode)
            params.append('authcode', authcode);
        params.append('_csrf', csrfToken);
        const postRes = await this.fetchWithCookies(`${this.baseUrl}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString(),
            redirect: 'manual'
        });
        console.log(`[WarlockClient] Login response: ${postRes.status} Location: ${postRes.headers.get('location')} URL: ${postRes.url}`);
        const loc = postRes.headers.get('location') || '';
        if (postRes.status === 302 && !loc.includes('/login')) {
            console.log('[WarlockClient] Authentication successful. Redirected to:', loc);
            this.isAuthenticated = true;
        }
        else {
            if (postRes.url.includes('/dashboard') || postRes.url.includes('/2fa-setup') || postRes.url === this.baseUrl + '/') {
                console.log('[WarlockClient] Authentication successful.');
                this.isAuthenticated = true;
            }
            else {
                console.log('[WarlockClient] Authentication failed.');
                this.isAuthenticated = false;
                throw new Error('Authentication failed (invalid credentials or 2FA).');
            }
        }
    }
    async ensureAuthenticated() {
        if (!this.isAuthenticated) {
            await this.authenticate();
        }
    }
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
    async request(url, options) {
        await this.ensureAuthenticated();
        let res = await this.fetchWithCookies(url, options);
        // Detect session expiration and redirect to login
        if (res.url.includes('/login') || res.status === 401 || res.status === 403) {
            console.log('[WarlockClient] Session expired or unauthorized. Re-authenticating...');
            this.isAuthenticated = false;
            await this.authenticate();
            res = await this.fetchWithCookies(url, options); // Retry once
        }
        if (!res.ok && !res.url.includes('/login')) {
            throw new Error(`Failed request to ${url}: ${res.status} ${res.statusText}`);
        }
        return res;
    }
    async controlService(guid, host, service, action) {
        const url = `${this.baseUrl}/api/service/control/${guid}/${host}/${service}`;
        const res = await this.request(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ action })
        });
        return await res.json();
    }
    async customCommand(guid, host, service, command) {
        const url = `${this.baseUrl}/api/service/cmd/${guid}/${host}/${service}`;
        const res = await this.request(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ command })
        });
        return await res.text();
    }
    async getServiceDetails(guid, host, service) {
        const url = `${this.baseUrl}/api/service/${guid}/${host}/${service}`;
        const res = await this.request(url, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return await res.json();
    }
}
exports.WarlockClient = WarlockClient;
//# sourceMappingURL=warlockClient.js.map