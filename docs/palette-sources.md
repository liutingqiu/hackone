# 拼豆色板数据来源调研（待审核）

> 整理时间：2026-11-07 11:05
> 用途：为产品选定「色号数据」的合法、可复现来源
> 状态：**待你审核**，未落地到代码

---

## 一、结论（先看这三条）

1. **没有任何一家拼豆厂商提供机器可读的色卡数据。** 官网只有 PDF 图例或商品页，色号与 HEX 的对应关系要靠人眼从图上取。这不是我们没找到，是行业现状（社区仓库 [bitbead](https://github.com/pomodiary/bitbead.app) 的 README 里也这么写："No bead manufacturer publishes machine-readable colour data."）

2. **可合法使用的机器可读数据只有两个来源**：`HansBug/pindou-color-data`（**MIT**）和 `Jett-Wu/Perler_Beads_Generator`（**MIT**）。其余要么无授权，要么是 GPL / AGPL 传染性协议，做正式产品有风险。

3. **建议：以 HansBug（MIT）为主数据源，用 HAMA 官方 PDF 做交叉校验，在「关于」页署名。** 具体见第五节。

---

## 二、官方渠道（权威，但不可直接机读）

| 品牌 | 官方材料 | 链接 | 形态 | 能拿到什么 |
| --- | --- | --- | --- | --- |
| **HAMA** | 官方色卡（按色号排序） | [colour-chart-number.pdf](https://cdn.shopify.com/s/files/1/0726/3771/0492/files/colour-chart-number.pdf) | PDF | Mini/Midi 全部色号 |
| **HAMA** | 官方色卡（按颜色排序） | [Midi_-_Colour_palette.pdf](https://cdn.shopify.com/s/files/1/0726/3771/0492/files/Midi_-_Colour_palette.pdf) | PDF | Midi 色板 |
| **HAMA** | Maxi / Nova 色卡 | [colour-palette-maxi.pdf](https://cdn.shopify.com/s/files/1/0726/3771/0492/files/colour-palette-maxi.pdf) · [nova.pdf](https://cdn.shopify.com/s/files/1/0726/3771/0492/files/farvekort_en_nova.pdf) | PDF | 其他规格 |
| **HAMA** | 色卡入口页 | https://hama.dk/en/pages/colour-chart | 网页 | 以上 PDF 的索引 |
| **Perler** | 官方「按颜色选购」 | https://perler.com/collections/shop-by-color | 商品集合页 | 色名 + 单品页，无统一色卡 |
| **Artkal** | 官方商店 | https://www.artkalfusebeads.com/ | 商品页 | 按色号售卖，无统一色卡 PDF |
| **DMC** | 官方色卡（刺绣线，配色参考） | https://www.dmc.com/PT/pt/products/floss-color-card-mouline-pearl-cotton | 商品/色卡页 | 官方色号体系 |

**判断**：HAMA 是唯一提供结构化 PDF 色卡的国际厂商；Perler、Artkal 只有商品页；**MARD / COCO / 漫漫 / 盼盼 / 咪小窝这些国内品牌，没有找到任何官方色卡发布渠道**——这正是国内社区仓库存在的理由。

---

## 三、社区数据仓库（可机读，关键看授权）

| 仓库 | 内容 | 格式 | 授权 | 星标 | 评价 |
| --- | --- | --- | --- | --- | --- |
| **[HansBug/pindou-color-data](https://github.com/HansBug/pindou-color-data)** | MARD 221/291、COCO 291、漫漫 278、盼盼 289、咪小窝、优肯 197/221/418 | JSON + XLSX + PDF | **MIT** | 33 | **最推荐**：格式规整、带「主流度」评分、MIT 可商用 |
| **[Jett-Wu/Perler_Beads_Generator](https://github.com/Jett-Wu/Perler_Beads_Generator)** | MARD 221 / 291 | TS 源文件 | **MIT** | 59 | 备选，可交叉校验 |
| [LunarXuan/Pindo](https://github.com/LunarXuan/Pindo) | Perler / Hama / Artkal + 五套中文色号 | JSON | **GPL-3.0** | 459 | ⚠️ 传染性协议，闭源商业产品需谨慎 |
| [Zippland/perler-beads](https://github.com/Zippland/perler-beads) | MARD 291 × 5 品牌色号映射 | JSON | **自定义「开源共创声明」+ AGPL-3.0** | 1064 | ⚠️ 明确要求「勿包装为闭源商业产品」 |
| [pomodiary/bitbead.app](https://github.com/pomodiary/bitbead.app) | Perler 117 / Hama 89 / Artkal 176+221 / MARD 221+291 / COCO 291，共 1406 色，含 CIEDE2000 跨品牌最近色 | JSON + CSV | **无（All rights reserved）** | 4 | ❌ 数据不能直接用；但**方法值得学** |
| [mypindou.com/colors/mard](https://mypindou.com/colors/mard/) | MARD 291 色 HEX/RGB | 网页 | 未声明 | — | 可人工核对，不建议抓取 |

### HansBug 仓库的额外价值

它给每个系列标了「主流度」，这是我们选品类的依据：

| 系列 | 主流度 | 色数 |
| --- | --- | --- |
| MARD 家（221） | **S / 5.0** | 221 |
| MARD 291 | **S / 4.7** | 291 |
| 优肯 418 / 197 / 221 | A / 4.2 · 4.1 · 3.9 | 418 / 197 / 221 |
| COCO | A- / 3.9 | 291 |
| 漫漫家 | B+ / 3.7 | 278 |
| 盼盼家 | B+ / 3.6 | 289 |

这说明「MARD 系是国内图纸覆盖率最高的」不是我们编的，是社区公认。

---

## 四、授权风险矩阵

| 用途 | MIT 数据（HansBug / Jett-Wu） | GPL-3.0（Pindo） | AGPL-3.0（Zippland） | 无授权（bitbead） |
| --- | --- | --- | --- | --- |
| 比赛演示 | ✅ | ✅ | ✅ | ⚠️ 灰色 |
| 开源发布 | ✅ 保留版权声明 | ✅ 需开源 | ✅ 需开源 | ❌ |
| 闭源商业上线 | ✅ | ❌ | ❌ 明确禁止 | ❌ |

> 注：色号与 HEX 属于事实性数据，通常不受著作权保护；但**数据汇编**和**色卡图片**可能受保护，各地司法实践不一。以上是工程判断，不是法律意见。

---

## 五、建议方案

**数据源组合：**

1. **主数据：HansBug/pindou-color-data（MIT）**
   - 覆盖 MARD 221/291、COCO、漫漫、盼盼、咪小窝、优肯
   - 直接以 submodule 或拷贝方式引入，保留 `LICENSE` 与版权声明
   - 用它的 `colors.json` 替换我们现在的 56 色占位

2. **交叉校验：HAMA 官方 PDF**
   - 把 HAMA 的官方色号表人工录入一份，与社区数据比对
   - 不一致的标记出来，不静默合并——这正是队友之前发现「两版 MARD 291 只有 17/291 HEX 相同」的同类问题

3. **备选：Jett-Wu（MIT）**
   - 用于第三方校验 MARD 数据，冲突时以两份 MIT 源的共识为准

4. **明确不采用**：bitbead（无授权）、Zippland / Pindo（传染性协议，与「正式商业产品」目标冲突）

**署名方式（必须做）：**

在产品「关于」页和仓库 README 里写：

```
色板数据来自 HansBug/pindou-color-data（MIT License）
交叉校验参考 Jett-Wu/Perler_Beads_Generator（MIT License）
HAMA 官方色卡用于人工核验（hama.dk）
```

---

## 六、需要你审核的 4 个问题

1. **是否接受 MIT 来源为主？** 这是唯一能同时满足「可商用 + 可机读」的选项。
2. **国内品牌要不要全上？** 全量 1751 色对新手是负担；建议默认 MARD 291，其余作为「高级选项」。
3. **要不要做跨品牌映射？** bitbead 的做法（CIEDE2000 最近色）体验好，但我们得自己算，不能抄它的数据。
4. **比赛期间是否注明「数据来自社区公开色卡」？** 我建议主动写在路演 PPT 和仓库里，比被问出来好。

---

## 七、链接清单（可直接点开核对）

- HAMA 官方色卡页：https://hama.dk/en/pages/colour-chart
- HAMA 数值序 PDF：https://cdn.shopify.com/s/files/1/0726/3771/0492/files/colour-chart-number.pdf
- Perler 官方按色选购：https://perler.com/collections/shop-by-color
- Artkal 官方商店：https://www.artkalfusebeads.com/
- DMC 官方色卡：https://www.dmc.com/PT/pt/products/floss-color-card-mouline-pearl-cotton
- HansBug 数据仓库（MIT）：https://github.com/HansBug/pindou-color-data
- Jett-Wu 编辑器（MIT）：https://github.com/Jett-Wu/Perler_Beads_Generator
- Pindo（GPL-3.0）：https://github.com/LunarXuan/Pindo
- Zippland（自定义 + AGPL）：https://github.com/Zippland/perler-beads
- bitbead（无授权）：https://github.com/pomodiary/bitbead.app
- mypindou MARD 291 查询：https://mypindou.com/colors/mard/
