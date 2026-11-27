# Userscripts

| Script | Description |
| :--- | :--- |
| [`url-cleaner.user.js`](./url-cleaner.user.js) | Removes known tracking parameters, uses strict allowlists on supported product pages, and resolves X/Twitter `t.co` shortlinks before click. |

## url-cleaner

### 修改网址参数过滤规则
> [!NOTE]
> 规则中的参数采用小写，脚本匹配时忽略大小写。

#### match 模式
有 4 种站点 match 模式，**全局**、**网址匹配**、**站点匹配**和**集合匹配**。
命中优先级从高到低依次是：`keep` 放行 > 全局 `trackingParams` > 集合匹配 `sharedParamRules` > 网址/站点匹配 `siteParamRules`（`remove`/`allowOnly`）。
| match 模式 | 想做什么 | 编辑位置 |
| :--- | :--- | :--- |
| **全局** | 在所有站点应用通用过滤规则 | 添加参数名到 [Line 48](https://github.com/mariverse/userscripts/blob/main/url-cleaner.user.js#L48) `trackingParams` 内，不需要写 `matches` 函数。 |
| **网址匹配** | 只在指定网址应用过滤规则 | 在 [Line 62](https://github.com/mariverse/userscripts/blob/main/url-cleaner.user.js#L62) `siteParamRules` 内添加规则，matches 使用 `host === specified.domain.site` 或  `host === 'specified.domain.site' && path === '/deeper/path'`|
| **站点匹配** | 对指定站点下的所有子域名和路径均应用过滤规则 | 在 [Line 62](https://github.com/mariverse/userscripts/blob/main/url-cleaner.user.js#L62) `siteParamRules` 内添加规则，matches 使用 `hostIs(host, 'domain.site')`|
| **集合匹配** | 在同一业务的多个子域名上删除 | 在 [Line 56](https://github.com/mariverse/userscripts/blob/main/url-cleaner.user.js#L56) `sharedParamRules` 内添加规则，用子域名集合匹配这组网站。|

#### 过滤规则
网址参数过滤规则有 3 种模式，`keep`、`remove`、`allowOnly`。
| 过滤模式 | 想做什么 | 编辑位置 |
| :--- | :--- | :--- |
| **keep** | 添加参数保留例外 | 在对应的 `siteParamRules` 规则里加 `keep: new Set(['参数名'])`。`keep` 优先于全局 `trackingParams`、集合匹配 `sharedParamRules`，以及网址/站点匹配的 `remove` 和 `allowOnly`。 |
| **remove** | 滤除跟踪参数 | 在对应的 `siteParamRules` 规则里加 `remove: new Set(['参数名'])`。 |
| **allowOnly** | 严格白名单，例如在线商品页时只保留商品 id 或规格参数 | 在对应的 `siteParamRules` 规则里加 `allowOnly: new Set(['参数名'])`。 |

#### 示例
例如，只从 `shop.example.com/search` 删除 `ref_id` 和 `spy_id`：

```js
{
    matches: (host, path) => host === 'shop.example.com' && path === '/search',
    remove: new Set(['ref_id', 'spy_id'])
},
```

使用 `hostIs(host, 'szlcsc.com')` 对 `*.szlcsc.com/*` 的所有主域名和所有子域名都删除 `jlc_vid`：

```js
{
    matches: (host, path) => hostIs(host, 'szlcsc.com'),
    remove: new Set(['jlc_vid'])
}
```

对京东商品页采用白名单模式，仅保留商品 id 和规格 skuid
```js
{
    matches: (host, path) => host === 'item.jd.com' && /^\/\d+\.html$/.test(path),
    allowOnly: new Set(['id', 'skuid'])
}
```

淘宝拍卖（原淘宝司法）的 `zc-paimai.taobao.com`、`sf.taobao.com` 和 `sf-item.taobao.com` 共用一份删除规则。确认新的子域名也是拍卖业务时，把完整主机名加到 `taobaoAuctionHosts` 即可。若参数在整个子域树内都是跟踪用途，可用 `hostIs(host, 'market.example.com')` 匹配该域及其下属子域；像 `sf.taobao.com` 和 `sf-item.taobao.com` 这样的同级域名，用主机名集合更清楚。

所有命中的 `sharedParamRules` 会叠加；`siteParamRules` 只用第一条命中的页面规则，所以更具体的路径应放在前面。签名和登录链接整条保留。
