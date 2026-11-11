// ==UserScript==
// @name         Clean Redirects & Tracking URLs
// @namespace    https://example.invalid/clean-redirects
// @version      0.1.0
// @description  点击前解析 t.co 短链，并清理常见网址跟踪参数；支持直接打开和 SPA 导航。
// @author       Codex
// @match        *://*/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      *
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const MAX_CACHE_SIZE = 128;
    const redirectCache = new Map();

    // Bilibili-Evolved 的“网址参数清理”组件使用的主要参数，加上常见分享参数。
    const BILIBILI_PARAMS = new Set([
        'spm_id_from', 'from_source', 'from_spmid', 'from', 'seid', 'share_source',
        'share_medium', 'share_plat', 'share_tag', 'share_session_id', 'share_from',
        'bbid', 'ts', 'timestamp', 'unique_k', 'rt', 'tdsourcetag', 'accept_quality',
        'broadcast_type', 'current_qn', 'current_quality', 'playurl_h264',
        'playurl_h265', 'quality_description', 'network', 'network_status',
        'platform_network_status', 'p2p_type', 'referfrom', 'visit_id', 'bsource',
        'spm', 'hotrank', '-arouter', 'vd_source', 'is_story_h5', 'buvid', 'plat_id',
        'gofrom', 'jumplinktype', 'hasback', 'notitlebar', 'msource', 'live_from',
        'extra_jump_from', 'subarea_rank', 'popular_rank', 'launch_id', 'spmid',
        'trackid', 'from_avid', 'from_comid', 'share_token', 'share_id', 'share_code'
    ]);

    const GOOGLE_PARAMS = new Set([
        'ved', 'ei', 'oq', 'sourceid', 'gs_lcrp', 'sclient', 'iflsig', 'uule', 'gws_rd',
        'sei', 'bih', 'biw', 'num', 'filter', 'client', 'nfpr'
    ]);

    const BING_PARAMS = new Set([
        'cvid', 'form', 'pc', 'qs', 'sp', 'sk', 'ghsh', 'ghacc', 'ghpl', 'pq', 'sc',
        'lq', 'filters', 'mscc', 'pq', 'sm', 'ensearch'
    ]);

    const ZHIHU_PARAMS = new Set([
        'share_code', 'share_id', 'is_rec', 'is_share', 's_r', 's_t', 'share_source',
        'utm_content', 'utm_medium', 'utm_source', 'utm_campaign'
    ]);

    const TAOBAO_PARAMS = new Set([
        'ali_refid', 'ali_trackid', 'spm', 'scm', 'pvid', 'acm', 'utparam', 'xxc',
        'mi_id', 'mm_sceneid', 'pricetid', 'loginbonus', 'union_lens', 'un_site',
        'share_crt_v', 'shareurl', 'ut_sk', 'sourcetype', 'activity_id', 'from',
        'scene', 'source', 'share_token', 'share_id', 'share_code'
    ]);

    const JD_PARAMS = new Set([
        'cu', 'share_token', 'share_id', 'share_code', 'source', 'client', 'ad_od',
        'wq', 'abt', 'ext', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
        'utm_content', 'rid', 'pps', 'is_pop', 'babelChannel', 'log_id'
    ]);

    const COMMON_PARAMS = new Set([
        'gclid', 'dclid', 'fbclid', 'msclkid', 'yclid', 'igshid', 's_kwcid', 'epik',
        'mc_cid', 'mc_eid', 'vero_id', 'wickedid', 'oly_anon_id', 'ref_src', 'ref_url',
        'referrer', 'referrer_id', 'campaign', 'campaign_id', 'affiliate', 'affiliate_id',
        'aff_id', 'clickid', 'click_id', 'partner', 'tracking', 'tracking_id', 'trk',
        'adid', 'ad_id', 'adset', 'adset_id', 'share_token', 'share_id', 'share_code',
        'feature', 'si', '_ga', '_gl', '__s', '_hsenc', '_hsmi', 'hsctatracking'
    ]);

    function hostMatches(host, pattern) {
        return host === pattern || host.endsWith(`.${pattern}`);
    }

    function isTrackingParam(name, host) {
        const key = String(name).toLowerCase();
        if (key.startsWith('utm_')) return true;
        if (COMMON_PARAMS.has(key)) return true;

        if (hostMatches(host, 'bilibili.com') || hostMatches(host, 'b23.tv')) {
            if (BILIBILI_PARAMS.has(key)) return true;
        }
        if (host.includes('google.')) {
            if (GOOGLE_PARAMS.has(key)) return true;
        }
        if (hostMatches(host, 'bing.com')) {
            if (BING_PARAMS.has(key)) return true;
        }
        if (hostMatches(host, 'zhihu.com') || hostMatches(host, 'zhimg.com')) {
            if (ZHIHU_PARAMS.has(key)) return true;
        }
        if (hostMatches(host, 'taobao.com') || hostMatches(host, 'tmall.com') || hostMatches(host, 'tb.cn')) {
            if (TAOBAO_PARAMS.has(key)) return true;
        }
        if (hostMatches(host, 'jd.com') || hostMatches(host, '3.cn') || hostMatches(host, 'jd.hk')) {
            if (JD_PARAMS.has(key)) return true;
        }
        return false;
    }

    function sanitizeUrl(input) {
        let url;
        try {
            url = new URL(input, pageWindow.location.href);
        } catch (_) {
            return input;
        }

        if (!/^https?:$/.test(url.protocol)) return url.toString();

        const params = url.searchParams;
        for (const key of [...new Set(params.keys())]) {
            if (isTrackingParam(key, url.hostname.toLowerCase())) params.delete(key);
        }
        url.search = params.toString();
        return url.toString();
    }

    function isTcoUrl(input) {
        try {
            const url = new URL(input, pageWindow.location.href);
            return url.protocol === 'http:' || url.protocol === 'https:'
                ? url.hostname.toLowerCase() === 't.co'
                : false;
        } catch (_) {
            return false;
        }
    }

    function remember(key, value) {
        if (redirectCache.size >= MAX_CACHE_SIZE) {
            const first = redirectCache.keys().next().value;
            if (first) redirectCache.delete(first);
        }
        redirectCache.set(key, value);
    }

    function extractFinalUrl(response, fallback) {
        const candidate = response && (response.finalUrl || response.responseURL);
        return candidate || fallback;
    }

    function gmRequest(url, method) {
        return new Promise((resolve, reject) => {
            const request = typeof GM_xmlhttpRequest === 'function'
                ? GM_xmlhttpRequest
                : (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function' ? GM.xmlHttpRequest : null);
            if (!request) {
                reject(new Error('Tampermonkey GM_xmlhttpRequest API is unavailable'));
                return;
            }
            request({
                method,
                url,
                redirect: 'follow',
                anonymous: true,
                timeout: 5000,
                headers: { Accept: 'text/html,application/xhtml+xml' },
                onload: resolve,
                onerror: reject,
                ontimeout: reject,
                onabort: reject
            });
        });
    }

    async function resolveShortUrl(input) {
        const original = new URL(input, pageWindow.location.href).toString();
        if (!isTcoUrl(original)) return original;
        if (redirectCache.has(original)) return redirectCache.get(original);

        const pending = (async () => {
            try {
                const head = await gmRequest(original, 'HEAD');
                const headUrl = extractFinalUrl(head, original);
                if (headUrl && headUrl !== original) return headUrl;
            } catch (_) {
                // Some short-link servers reject HEAD; use GET below.
            }
            try {
                const get = await gmRequest(original, 'GET');
                return extractFinalUrl(get, original);
            } catch (_) {
                return original;
            }
        })();

        remember(original, pending);
        const result = await pending;
        remember(original, result);
        return result;
    }

    function navigateClean(url, anchor) {
        const clean = sanitizeUrl(url);
        const target = anchor && anchor.target;
        if (target && target !== '_self' && target !== '_top' && target !== '_parent') {
            pageWindow.open(clean, target, 'noopener');
        } else {
            pageWindow.location.assign(clean);
        }
    }

    function findAnchor(event) {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        for (const item of path) {
            if (item && item.nodeType === 1 && item.tagName === 'A' && item.href) return item;
        }
        const target = event.target;
        return target && target.closest ? target.closest('a[href]') : null;
    }

    function handleClick(event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = findAnchor(event);
        if (!anchor) return;

        let href;
        try {
            href = new URL(anchor.href, pageWindow.location.href).toString();
        } catch (_) {
            return;
        }

        if (isTcoUrl(href)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            resolveShortUrl(href).then((resolved) => navigateClean(resolved, anchor));
            return;
        }

        const clean = sanitizeUrl(href);
        if (clean !== href) anchor.href = clean;
    }

    function warmShortUrlCache(event) {
        const anchor = findAnchor(event);
        if (!anchor || !isTcoUrl(anchor.href)) return;
        void resolveShortUrl(anchor.href);
    }

    function cleanCurrentUrl() {
        const current = pageWindow.location.href;
        const clean = sanitizeUrl(current);
        if (clean !== current) {
            try {
                pageWindow.history.replaceState(pageWindow.history.state, '', clean);
            } catch (_) {
                // A page can reject replaceState for an unusual URL; navigation handling still works.
            }
        }
    }

    function patchHistory() {
        for (const method of ['pushState', 'replaceState']) {
            const original = pageWindow.history[method];
            if (typeof original !== 'function') continue;
            pageWindow.history[method] = function (state, title, url) {
                let nextUrl = url;
                if (url != null) {
                    try {
                        nextUrl = sanitizeUrl(new URL(url, pageWindow.location.href).toString());
                    } catch (_) {
                        nextUrl = url;
                    }
                }
                return original.call(this, state, title, nextUrl);
            };
        }
    }

    // t.co 直接打开时，在页面内容加载前解析并替换到真实地址。
    if (isTcoUrl(pageWindow.location.href)) {
        resolveShortUrl(pageWindow.location.href).then((resolved) => {
            if (resolved !== pageWindow.location.href) {
                pageWindow.location.replace(sanitizeUrl(resolved));
            }
        });
    } else {
        cleanCurrentUrl();
    }

    patchHistory();
    document.addEventListener('click', handleClick, true);
    document.addEventListener('pointerover', warmShortUrlCache, true);
    pageWindow.addEventListener('popstate', cleanCurrentUrl, true);
    pageWindow.addEventListener('hashchange', cleanCurrentUrl, true);
})();
