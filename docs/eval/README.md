# 评测

用虚构的金标准比较不同模型配置的提取质量：单模型、双模型（提取＋核验），以及两个模型分工对调。

| 文件 | 内容 |
|---|---|
| `test/fixtures/eval-mdd.mjs` | 金标准：25 份虚构 MDD 文书，13 位虚构病人，54 个字段逐份标注文书级结论（共 1,350 个格子） |
| `scripts/eval.mjs` | 跑评测：每种配置跑一个完整批次，按文书 × 字段打分，写 `results.json` |
| `scripts/eval-report.mjs` | 把 `results.json` 画成一页 HTML 报告（自包含；结论文字按结果生成） |
| `docs/eval/<日期>-<模板>.html` | 报告快照，留作以后对比 |

## 重跑

模型端点只从环境变量读，不进仓库：

```sh
export EVAL_A_URL=http://<端点A>/v1 EVAL_A_MODEL=<模型A>
export EVAL_B_URL=http://<端点B>/v1 EVAL_B_MODEL=<模型B>
node scripts/eval.mjs /tmp/dsh-extract-eval              # 全部配置；也可以只跑几个：… A-only BA-full
node scripts/eval-report.mjs /tmp/dsh-extract-eval docs/eval/$(date +%F)-mdd.html
```

配置：`A-only`、`B-only`（单模型）；`AB-default`（A 提取、B 核验，默认抽样 2%＋每字段至少 2 次）；`AB-full`、`BA-full`（全部核验，两种分工）。

运行目录（`_records`、模型缓存、`results.json`）不进仓库。同一个运行目录下各配置共用模型缓存：温度 0、提示相同时，同一模型第一遍的回答完全一样，配置之间的差别只来自核验和复查。改了提示或模板要比较前后差别时，换一个新的运行目录。

## 打分

- 按文书 × 字段比较插件的文书级结论（`lib/engine/shard.js` 的 `docLevel`／`sameConclusion`）：presence 为有／无／可疑／未提及，列表比各项的集合，数字按数值。
- 准确率按全部格子算；精确率＝有值的结论里对的比例；召回率＝金标准必须有值的格子里答对的比例。
- 金标准一格有两种合理读法时写成数组，答哪种都算对。
- "人工判断后"假设转人工的项都判对，是上限。

## 改金标准

- 只用虚构内容，不放任何病历派生的文字。
- 先按字段定义标注，跑完后只对着原文和定义复核出错的格子；不要照着某个模型的答案改。
- 样本小（1,350 个格子）：两个配置相差 1 个百分点左右不算有差别。

## 记录

| 日期 | 报告 | 要点 |
|---|---|---|
| 2026-11-16 | [2026-11-16-mdd.html](2026-11-16-mdd.html) | qwen3.6-35b-a3b 与 gemma-4-26b-a4b-it：单模型 F1 84.9／93.8；全部核验时 gemma 提取、qwen 核验最好，97.2（人工判断后 97.6）；默认抽样到大规模时接近提取模型的单模型水平 |
