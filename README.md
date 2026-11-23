# Userscripts

| Script | Description |
| :--- | :--- |
| [`url-cleaner.user.js`](./url-cleaner.user.js) | Removes known tracking parameters, uses strict allowlists on supported product pages, and resolves X/Twitter `t.co` shortlinks before click. |

## 自定义参数规则

在 Tampermonkey 的「URL Cleaner」编辑器中，找到脚本开头的规则。参数名用小写填写，脚本匹配时忽略大小写。

| 想做什么 | 编辑位置 |
| :--- | :--- |
| 在所有站点删除某个已知跟踪参数 | 把参数名加到 `trackingParams`。`utm_*` 已通用清理。 |
| 在同一业务的多个子域名上删除 | 在 `sharedParamRules` 写一份 `remove`，用主机名集合匹配这组站点。 |
| 只在指定站点或路径删除 | 在 `siteParamRules` 加一条规则，指定 `matches` 和 `remove`。 |
| 在指定站点或路径明确放行 | 在对应的 `siteParamRules` 规则里加 `keep: new Set(['参数名'])`。`keep` 优先于通用删除、共享删除、页面删除和 `allowOnly`。 |
| 在严格白名单商品页保留新的商品或规格参数 | 加到对应规则的 `allowOnly`。普通搜索页默认保留未知参数。 |

例如，只从 `shop.example.com/search` 删除 `ref_id`：

```js
{
    matches: (host, path) => host === 'shop.example.com' && path === '/search',
    remove: new Set(['ref_id'])
},
```

淘宝拍卖的 `zc-paimai.taobao.com`、`sf.taobao.com` 和 `sf-item.taobao.com` 共用一份删除规则。确认新的子域名也是拍卖业务时，把完整主机名加到 `taobaoAuctionHosts` 即可。若参数在整个子域树内都是跟踪用途，可用 `hostIs(host, 'market.example.com')` 匹配该域及其下属子域；像 `sf.taobao.com` 和 `sf-item.taobao.com` 这样的同级域名，用主机名集合更清楚。

所有命中的 `sharedParamRules` 会叠加；`siteParamRules` 只用第一条命中的页面规则，所以更具体的路径应放在前面。签名和登录链接整条保留。
