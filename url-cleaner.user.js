// ==UserScript==
// @name         URL Cleaner
// @namespace    https://github.com/mariverse/userscripts
// @version      1.0.3
// @license      MIT
// @description  使用参数白名单清理网址；在 X/Twitter 页面点击前读取原始链接解析 t.co，并支持菜单净化输入网址。
// @author       gemini-4-argon
// @match        *://*/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM.xmlHttpRequest
// @grant        GM.registerMenuCommand
// @grant        GM.setClipboard
// @grant        unsafeWindow
// @connect      t.co
// @connect      *
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    /* X link extraction adapted from psimaker/twitter-x-spy-link-remover.
     * MIT License
     * Copyright (c) psimaker
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     * The above copyright notice and this permission notice shall be included in all
     * copies or substantial portions of the Software.
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     * SOFTWARE.
     */

    const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const cache = new Map();
    const MAX_CACHE = 64;
    const genericAllowed = new Set([
        'q', 'query', 'search', 'keyword', 'keywords', 'id', 'sku', 'skuid', 'itemid',
        'page', 'pageno', 'pagesize', 'offset', 'limit', 'start', 'count', 'sort', 'order',
        'filter', 'filters', 'category', 'tag', 'lang', 'locale', 'hl', 'tab', 'type',
        'view', 'mode', 'date', 'year', 'month', 'day', 'v', 't', 'list', 'index',
        'width', 'height', 'format', 'size', 'quality', 'download', 'embed'
    ]);
    const googleAllowed = new Set([
        'q', 'num', 'start', 'newwindow', 'tbm', 'tbs', 'udm', 'hl', 'gl', 'lr', 'cr',
        'safe', 'nfpr', 'as_q', 'as_epq', 'as_oq', 'as_eq', 'as_sitesearch', 'as_filetype',
        'filter', 'btnk'
    ]);
    const bingAllowed = new Set([
        'q', 'count', 'first', 'filters', 'qft', 'mkt', 'setlang', 'cc', 'ensearch'
    ]);
    const bilibiliAllowed = new Set([
        'p', 'page', 't', 'bvid', 'aid', 'cid', 'ep_id', 'season_id'
    ]);
    const zhihuAllowed = new Set([
        'sort_by', 'order_by', 'page', 'page_size', 'limit', 'offset', 'include'
    ]);
    const taobaoAllowed = new Set([
        'id', 'itemid', 'skuid', 'q', 'sort', 'page', 'pageno', 'pagesize', 'shopid',
        'sellerid', 'category', 'tab'
    ]);
    const jdAllowed = new Set([
        'sku', 'skuid', 'id', 'keyword', 'q', 'page', 'pageno', 'pagesize', 'sort',
        'ev', 'stock', 'area', 'shopid', 'category', 'enc', 'wq', 'pid'
    ]);

    // Signed download/API URLs can use arbitrary parameter names. Preserve them
    // before applying the strict allowlist so cleaning never invalidates a URL.
    const protectedQueryKey = /^(?:access_token|api[_-]?key|auth|authorization|code|expires?|expiry|key|nonce|policy|sig(?:nature)?|state|token|x-amz-|oauth[_-])/i;

    function hostIs(host, domain) {
        return host === domain || host.endsWith('.' + domain);
    }

    function isProtectedUrl(url) {
        const host = url.hostname.toLowerCase();
        const path = url.pathname.toLowerCase();
        if (/^(login|signin|sign-in|passport|auth|oauth|account|accounts|checkout|payment|pay|secure|captcha|verify)([.-]|$)/.test(host)) return true;
        return /(^|\/)(login|signin|sign-in|logout|auth|oauth[^/]*|authorize[^/]*|checkout|payment|pay|captcha|verify|verification)(\/|$)/.test(path);
    }

    function allowedParams(host) {
        if (hostIs(host, 'bing.com')) return bingAllowed;
        if (hostIs(host, 'google.com') || /^www\.google\.[a-z.]+$/.test(host)) return googleAllowed;
        if (hostIs(host, 'bilibili.com') || hostIs(host, 'b23.tv')) return bilibiliAllowed;
        if (hostIs(host, 'zhihu.com') || hostIs(host, 'zhimg.com')) return zhihuAllowed;
        if (hostIs(host, 'taobao.com') || hostIs(host, 'tmall.com') || hostIs(host, 'tb.cn')) return taobaoAllowed;
        if (hostIs(host, 'jd.com') || hostIs(host, 'jd.hk') || hostIs(host, '3.cn')) return jdAllowed;
        return genericAllowed;
    }

    function clean(input) {
        let u;
        try { u = new URL(input, page.location.href); } catch (_) { return input; }
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return u.href;
        if (isProtectedUrl(u)) return u.href;
        if ([...u.searchParams.keys()].some((key) => protectedQueryKey.test(key))) return u.href;
        const host = u.hostname.toLowerCase();
        const allowed = allowedParams(host);
        for (const key of [...new Set(u.searchParams.keys())]) {
            if (!allowed.has(key.toLowerCase())) u.searchParams.delete(key);
        }
        return u.href;
    }

    function cleanCurrent() {
        const before = page.location.href;
        const after = clean(before);
        if (after === before) return;
        try {
            page.history.replaceState(page.history.state, '', after);
        } catch (_) {
            try { history.replaceState(history.state, '', after); } catch (_) { /* ignore */ }
        }
    }

    function isTco(input) {
        try { return new URL(input, page.location.href).hostname.toLowerCase() === 't.co'; } catch (_) { return false; }
    }

    function isXPage() {
        const host = page.location.hostname.toLowerCase();
        return host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com');
    }

    function normalizeDisplayedUrl(value) {
        const text = String(value || '').trim();
        // Reject strings with internal whitespace (e.g. "From openai.com" or card titles)
        if (!text || /\s/.test(text) || /t\.co/i.test(text) || /[…]/.test(text)) return null;
        const candidate = /^https?:\/\//i.test(text) ? text : 'https://' + text;
        try {
            const url = new URL(candidate);
            if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
            return url.href;
        } catch (_) {
            return null;
        }
    }

    function getRealUrlFromText(anchor) {
        if (!anchor) return null;
        const direct = normalizeDisplayedUrl(anchor.textContent || '');
        if (direct) return direct;
        // X renders truncated URLs with the full tail inside a hidden span right
        // before a trailing <span aria-hidden="true">…</span>:
        //   <span aria-hidden="true">https://</span>visible<span aria-hidden="true">hidden-tail</span><span aria-hidden="true">…</span>
        const nodes = anchor.childNodes ? [...anchor.childNodes] : [];
        if (nodes.length >= 3) {
            const last = nodes[nodes.length - 1];
            const prev = nodes[nodes.length - 2];
            if (
                last && (last.textContent || '').trim() === '…' &&
                prev && prev.nodeType === 1 && prev.getAttribute && prev.getAttribute('aria-hidden') === 'true' &&
                (prev.textContent || '').trim().length > 0
            ) {
                const reconstructed = nodes.slice(0, -1).map((n) => n.textContent || '').join('');
                return normalizeDisplayedUrl(reconstructed);
            }
        }
        return null;
    }

    function matchTcoUrl(candidateUrl, href) {
        if (!candidateUrl || typeof candidateUrl !== 'string') return false;
        const token = candidateUrl.replace(/^https?:\/\//i, '');
        return href.includes(candidateUrl) || (token.startsWith('t.co/') && href.includes(token));
    }

    const SKIP_FIBER_KEYS = new Set([
        'stateNode', 'return', 'child', 'sibling', 'alternate',
        'dependencies', 'updateQueue', 'memoizedState', 'ref', '_owner', '_store'
    ]);

    function extractRealUrlFromNode(root, href, maxDepth = 8) {
        const seen = new Set();
        const stack = [{ value: root, depth: 0 }];
        while (stack.length) {
            const current = stack.pop();
            const node = current.value;
            if (!node || typeof node !== 'object' || seen.has(node) || current.depth > maxDepth) continue;
            if (typeof node.nodeType === 'number' || node === page || node === document) continue;
            seen.add(node);

            if (typeof node.expandedUrl === 'string' && node.url && matchTcoUrl(node.url, href)) {
                return node.expandedUrl;
            }
            if (typeof node.expanded_url === 'string' && node.url && matchTcoUrl(node.url, href)) {
                return node.expanded_url;
            }
            if (node.hoverLabel && typeof node.hoverLabel.label === 'string' && node.link && matchTcoUrl(node.link, href)) {
                if (/^https?:\/\//i.test(node.hoverLabel.label)) return node.hoverLabel.label;
            }

            if (Array.isArray(node)) {
                for (let i = node.length - 1; i >= 0; i -= 1) {
                    if (node[i] && typeof node[i] === 'object') {
                        stack.push({ value: node[i], depth: current.depth + 1 });
                    }
                }
                continue;
            }

            for (const key of Object.keys(node)) {
                if (key.startsWith('_') || SKIP_FIBER_KEYS.has(key)) continue;
                const child = node[key];
                if (child && typeof child === 'object') {
                    stack.push({ value: child, depth: current.depth + 1 });
                }
            }
        }
        return null;
    }

    function getRealUrlFromFiber(anchor) {
        const href = anchor.href;
        const elements = [
            anchor,
            anchor.closest ? anchor.closest('[data-testid="tweet"]') : null
        ].filter(Boolean);

        for (const el of elements) {
            const rawEl = el.wrappedJSObject || el;
            const keys = Object.keys(rawEl).filter((key) => key.startsWith('__reactFiber$') || key.startsWith('__reactProps$'));
            for (const key of keys) {
                let fiber = rawEl[key];
                for (let depth = 0; depth < 50 && fiber; depth += 1) {
                    const sources = [fiber.memoizedProps, fiber.pendingProps].filter(Boolean);
                    for (const source of sources) {
                        const found = extractRealUrlFromNode(source, href);
                        if (found) return found;
                    }
                    fiber = fiber.return;
                }
            }
        }
        return null;
    }

    function getRealUrlFromX(anchor) {
        // Prefer the complete URL from tweet data over potentially truncated text.
        let candidate;
        try { candidate = getRealUrlFromFiber(anchor) || getRealUrlFromText(anchor); }
        catch (_) { return null; }
        if (!candidate || /[…\s]/.test(candidate)) return null;
        try {
            const url = new URL(candidate);
            return /^https?:$/.test(url.protocol) && !isTco(url.href) ? url.href : null;
        } catch (_) { return null; }
    }

    function processXLink(anchor) {
        if (!anchor || !anchor.href || !isTco(anchor.href)) return;
        const originalHref = anchor.href;
        const real = getRealUrlFromX(anchor);
        if (real) {
            const cleanReal = clean(real);
            if (anchor.dataset) anchor.dataset.cleanUrlOriginal = originalHref;
            anchor.href = cleanReal;
            return;
        }
        // Fallback: if a card/link on X has no expanded URL in Fiber or DOM text,
        // resolve the t.co URL asynchronously via GM_xmlhttpRequest and rewrite href.
        resolveTco(originalHref).then((resolved) => {
            if (resolved && resolved !== originalHref && !isTco(resolved) && anchor.href === originalHref) {
                if (anchor.dataset) anchor.dataset.cleanUrlOriginal = originalHref;
                anchor.href = clean(resolved);
            }
        });
    }

    function scanXLinks(root) {
        if (!isXPage() || !document.querySelectorAll) return;
        const scope = root && root.nodeType ? root : (page.document || document);
        if (scope.nodeType === 1 && scope.matches && scope.matches('a[href*="t.co"]')) processXLink(scope);
        if (scope.querySelectorAll) scope.querySelectorAll('a[href*="t.co"]').forEach(processXLink);
    }

    function installXLinkResolver() {
        if (!isXPage() || typeof MutationObserver === 'undefined') return;
        let pending = false;
        const roots = new Set();
        const scan = () => {
            if (pending) return;
            pending = true;
            const run = () => {
                pending = false;
                const queued = roots.size ? [...roots] : [page.document || document];
                roots.clear();
                queued.forEach(scanXLinks);
            };
            if (typeof page.requestAnimationFrame === 'function') page.requestAnimationFrame(run);
            else page.setTimeout(run, 0);
        };
        const start = () => {
            roots.add(page.document || document);
            scan();
            if (document.documentElement) {
                const observer = new MutationObserver((records) => {
                    for (const record of records) {
                        if (record.type === 'attributes') roots.add(record.target);
                        else for (const node of record.addedNodes) if (node.nodeType === 1) roots.add(node);
                    }
                    if (roots.size) scan();
                });
                observer.observe(document.documentElement, {
                    childList: true, subtree: true, attributes: true, attributeFilter: ['href']
                });
            }
        };
        if (document.documentElement) start();
        else document.addEventListener('DOMContentLoaded', start, { once: true });
    }

    function request(url, method, timeoutMs = 2500) {
        return new Promise((resolve, reject) => {
            const fn = typeof GM_xmlhttpRequest === 'function'
                ? GM_xmlhttpRequest
                : (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function' ? GM.xmlHttpRequest : null);
            if (!fn) return reject(new Error('GM request API unavailable'));
            let settled = false;
            const finish = (cb) => (val) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cb(val);
            };
            let req;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                try { if (req && typeof req.abort === 'function') req.abort(); } catch (_) { /* ignore */ }
                reject(new Error('GM request timeout'));
            }, timeoutMs);
            try {
                req = fn({
                    method,
                    url,
                    redirect: 'follow',
                    anonymous: true,
                    timeout: timeoutMs,
                    headers: { Accept: 'text/html,application/xhtml+xml' },
                    onload: finish(resolve),
                    onerror: finish(reject),
                    ontimeout: finish(reject),
                    onabort: finish(reject)
                });
            } catch (err) {
                finish(reject)(err);
            }
        });
    }

    function extractRedirectFromResponse(response, fallback) {
        if (response && response.finalUrl && response.finalUrl !== fallback) return response.finalUrl;
        if (response && response.responseURL && response.responseURL !== fallback) return response.responseURL;
        const html = response && response.responseText;
        if (!html) return fallback;
        const patterns = [
            /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url\s*=\s*([^"'>]+)[^"']*["']/i,
            /<meta[^>]+content=["'][^"']*url\s*=\s*([^"'>]+)[^"']*[^>]+http-equiv=["']?refresh["']?/i,
            /(?:window\.)?location\.replace\(\s*["']([^"']+)["']\s*\)/i,
            /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
            /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
            /<title>\s*(https?:\/\/[^<\s]+)\s*<\/title>/i
        ];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (!match || !match[1]) continue;
            const raw = match[1].trim().replace(/\\\//g, '/');
            try { return new URL(raw, fallback).href; } catch (_) { /* try next pattern */ }
        }
        return fallback;
    }

    async function resolveTco(input) {
        const original = new URL(input, page.location.href).href;
        if (!isTco(original)) return original;
        const old = cache.get(original);
        if (old) return old;
        const pending = (async () => {
            try {
                const r = await request(original, 'GET');
                return extractRedirectFromResponse(r, original);
            } catch (_) { return original; }
        })();
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
        cache.set(original, pending);
        const result = await pending;
        // A failed request returns the original t.co URL. Do not cache that
        // failure forever; a later click can succeed after a transient outage.
        if (result === original) cache.delete(original);
        else cache.set(original, result);
        return result;
    }

    async function copyText(text) {
        const legacy = typeof GM_setClipboard === 'function' ? GM_setClipboard : null;
        if (legacy) {
            legacy(text, 'text');
            return true;
        }
        if (typeof GM !== 'undefined' && typeof GM.setClipboard === 'function') {
            await GM.setClipboard(text, 'text');
            return true;
        }
        try {
            await page.navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            return false;
        }
    }

    function promptForUrl(message, defaultValue) {
        const promptFn = typeof page.prompt === 'function' ? page.prompt.bind(page) : null;
        return promptFn ? promptFn(message, defaultValue) : null;
    }

    function showResult(text, copied) {
        const message = copied
            ? `净化后的网址已复制到剪贴板：\n\n${text}`
            : `净化后的网址：\n\n${text}`;
        if (typeof page.alert === 'function') page.alert(message);
    }

    function extractUrlFromInput(input) {
        const text = String(input || '').trim();
        const markdown = text.match(/\]\((https?:\/\/[^)\s]+)\)/i);
        const match = markdown || text.match(/https?:\/\/[^\s<>"'`]+/i);
        if (!match) return text;
        const value = markdown ? markdown[1] : match[0];
        return value.replace(/[.,;:!?\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F)\]}>]+$/g, '');
    }

    async function sanitizeUserInput() {
        const input = promptForUrl('粘贴需要净化的网址：', '');
        if (!input || !input.trim()) return;
        let result = clean(extractUrlFromInput(input));
        if (isTco(result)) result = clean(await resolveTco(result));
        const copied = await copyText(result);
        showResult(result, copied);
    }

    function registerMenu() {
        const legacy = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : null;
        if (legacy) {
            legacy('净化输入网址（复制结果）', sanitizeUserInput);
            return;
        }
        if (typeof GM !== 'undefined' && typeof GM.registerMenuCommand === 'function') {
            GM.registerMenuCommand('净化输入网址（复制结果）', sanitizeUserInput);
        }
    }

    function anchorFrom(event) {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) if (node && node.tagName === 'A' && node.href) return node;
        const node = event.target;
        return node && node.closest ? node.closest('a[href]') : null;
    }

    function prepareAnchor(anchor) {
        if (!anchor || !anchor.href) return;
        const href = anchor.href;
        if (isXPage() && isTco(href)) {
            processXLink(anchor);
            return;
        }
        if (!isTco(href) && href.includes('?')) {
            const target = clean(href);
            if (target !== href) anchor.href = target;
        }
    }

    function onClick(event) {
        if (event.defaultPrevented || event.button !== 0) return;
        const a = anchorFrom(event);
        if (!a) return;
        prepareAnchor(a);
        const href = a.href;
        if (isXPage() && (isTco(href) || (a.dataset && a.dataset.cleanUrlOriginal))) {
            const real = isTco(href) ? getRealUrlFromX(a) : href;
            if (real) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const target = clean(real);
                if (a.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey) {
                    page.open(target, '_blank', 'noopener,noreferrer');
                } else {
                    page.location.assign(target);
                }
                return;
            }
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (isTco(href)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            resolveTco(href).then((target) => page.location.assign(clean(target)));
        } else prepareAnchor(a);
    }

    cleanCurrent();
    registerMenu();
    installXLinkResolver();
    // Prepare the href on hover and before the browser handles Ctrl/Meta/Shift/middle/right
    // clicks. This updates the bottom-left status bar URL preview and context-menu actions.
    document.addEventListener('pointerover', (event) => {
        prepareAnchor(anchorFrom(event));
    }, true);
    document.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
        prepareAnchor(anchorFrom(event));
    }, true);
    document.addEventListener('click', onClick, true);
    page.addEventListener('popstate', cleanCurrent, true);
    page.addEventListener('hashchange', cleanCurrent, true);

    for (const method of ['pushState', 'replaceState']) {
        try {
            const original = page.history[method];
            page.history[method] = function (state, title, url) {
                const next = url == null ? url : clean(new URL(url, page.location.href).href);
                return original.call(this, state, title, next);
            };
        } catch (_) { /* ignore */ }
    }

    if (isTco(page.location.href)) {
        resolveTco(page.location.href).then((target) => {
            if (target !== page.location.href) page.location.replace(clean(target));
        });
    }
})();
