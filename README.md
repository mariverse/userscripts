# Userscripts

| Script | Description |
| :--- | :--- |
| [`url-cleaner.user.js`](./url-cleaner.user.js) | Removes known tracking parameters, uses strict allowlists on supported product pages, and resolves X/Twitter `t.co` shortlinks before click. |

## 自定义参数规则

在 Tampermonkey 的「URL Cleaner」编辑器中，找到脚本开头的 `trackingParams` 和 `siteParamRules`。参数名一律用小写填写，脚本匹配时忽略大小写。

| 想做什么 | 编辑位置 |
| :--- | :--- |
| 在所有站点删除某个已知跟踪参数 | 把参数名加到 `trackingParams`。`utm_*` 已通用清理。 |
| 只在指定站点或路径删除 | 加到对应规则的 `remove`。例如 Bing `/search` 的 `remove` 包含 `pc`。 |
| 在指定站点明确放行 | 在该规则中添加 `keep: new Set(['参数名'])`。`keep` 优先于 `remove`、通用清理和 `allowOnly`。 |
| 在严格白名单商品页保留新的商品或规格参数 | 加到对应规则的 `allowOnly`。普通搜索页默认保留未知参数。 |

`siteParamRules` 按顺序使用第一个命中主机名和路径的规则。新增更具体的规则时放在宽泛规则前，并带上仍需使用的删除项。修改后保存，用同一条原始链接重新打开，再刷新一次确认页面功能和净化结果。本地自定义也可以保存在仓库中，方便日后合并脚本更新。
