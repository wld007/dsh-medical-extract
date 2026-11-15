# 抽取模板格式（`extract-template/1`）

> 模板是插件的唯一"病种知识"入口。插件代码里不写任何病种内容。
> 模板是一个 JSON 文件，放在 `templates/<id>.json`（插件内置模板）或用户的模板库（`<stateDir>/templates/`）。
> 字段只增不改；改动升 `format` 版本。

## 1. 顶层

```json
{
  "format": "extract-template/1",
  "id": "mdd",
  "name": "抑郁障碍（MDD）",
  "version": "0.1.0",
  "description": "一句话说明用途",
  "documents": { "recordTypes": [], "excludeRecordTypes": ["护理记录"] },
  "groups": [{ "id": "A", "name": "诊断与分型" }],
  "lexicon": { "negation": [], "uncertain": [], "history": [], "family": [], "plan": [] },
  "fields": []
}
```

| 键 | 必填 | 含义 |
|---|---|---|
| `format` | 是 | 固定 `extract-template/1` |
| `id` | 是 | `^[a-z][a-z0-9-]*$`，模板库内唯一 |
| `name`、`version`、`description` | 是 | 版本用 semver；报告、manifest 会记下 |
| `documents` | 否 | 全模板的文书类型过滤（`recordTypes` 为空＝全部；`excludeRecordTypes` 排除）；字段级 `sources` 再细分。只对文书起作用：检验、医嘱、处方、诊断明细、收费等结构化记录本来就不进抽取，不必排除 |
| `groups` | 否 | 字段分组（界面、宽表列顺序） |
| `lexicon` | 否 | 追加到通用断言词表的词（见 §4），不替换 |
| `domain` | 否 | 学科／病种分类（界面分组用），如 `精神`、`神经`、`心血管` |
| `references` | 否 | 依据：`[{title, url?}]`，如指南名称与链接 |
| `fields` | 是 | 字段数组，顺序即宽表列顺序 |

## 2. 字段

```json
{
  "id": "C1",
  "name": "情绪低落",
  "group": "C",
  "priority": "P0",
  "type": "presence",
  "definition": "患者当前（本次发作）存在持续的情绪低落、心情差、高兴不起来。",
  "include": ["心情差", "开心不起来"],
  "exclude": ["既往发作时的情绪低落", "家属情绪低落"],
  "examples": [{ "text": "近1月来情绪低落，高兴不起来", "value": "有" }],
  "sources": { "recordTypes": ["入院记录", "门诊病历"], "sections": ["主诉", "现病史", "精神检查"] },
  "recall": { "terms": ["情绪低落", "心情差", "高兴不起来"], "regex": ["情绪(?:较|很)?低"] },
  "rules": [],
  "accept": ["阳性"],
  "granularity": "encounter",
  "pick": "any",
  "model": "auto"
}
```

| 键 | 必填 | 含义 |
|---|---|---|
| `id` | 是 | `^[A-Za-z][A-Za-z0-9_]*$`，模板内唯一；宽表列名＝`id`，表头另给 `name` |
| `name` | 是 | 中文名 |
| `group`、`priority` | 否 | 分组 id；`P0`／`P1`／`P2`（默认 `P1`）。设置 `priorities` 可只跑部分优先级 |
| `type` | 是 | 见 §3 |
| `definition` | 是 | 给人和模型看的定义：算什么 |
| `include`、`exclude` | 否 | 算／不算的写法或情形；给模型看 |
| `examples` | 否 | `[{text, value}]`，给模型看的例子（虚构） |
| `sources` | 否 | `recordTypes`、`sections`：只在这些文书类型、栏目里召回；空＝全部。栏目名按数据源层切出的栏目名匹配（包含即可，如 `史` 不建议） |
| `recall` | 否* | `terms`（字面量；英文缩写按整词匹配，4 个字母以上不分大小写，更短的按原样大小写，如 AVF 不匹配 aVF）、`regex`（JS 正则源码，无分隔符；隐含 `u` 标志）。命中句才是候选。*派生字段不需要；其他类型没写 `recall` 时，用 `name`、`include` 当召回词 |
| `rules` | 否 | 规则抽取，见 §5 |
| `accept` | 否 | 哪些断言算"有该值"，默认 `["阳性"]`。既往史类字段写 `["阳性","既往"]`，家族史字段写 `["家族"]` |
| `granularity` | 否 | `document`／`encounter`（默认）／`patient`／`timepoint` |
| `pick` | 否 | 汇总规则，见 §6；默认按类型 |
| `range` | 否 | 数值类 `{min, max}`；越界的值验收门②不过 |
| `model` | 否 | `auto`（默认：规则定不了才送模型）／`always`（召回到就送）／`never` |
| `derive` | 派生字段必填 | 见 §7 |

## 3. 值类型 `type`

| 类型 | 值 | 规则怎么定 | 宽表写法 |
|---|---|---|---|
| `presence` | `有`／`无`／`可疑` | 召回词命中＋断言（§4）：阳性→有，否认→无，可疑→可疑；不在 `accept` 里的断言（如既往、家族）不算 | `有`、`无`、`可疑`、`未提及` |
| `enum` | `options[].value` 之一 | `options: [{value, terms[], regex[]}]`，命中哪个选项的词就是哪个；同句命中多个→送模型 | 选项值 |
| `number` | 数值＋`unit` | `rules` 捕获 `v`（必要时 `unit`）；`units: {"斤": 0.5}` 换算到 `unit` | 数值 |
| `score` | 量表分 | 同 `number`；另有 `scale`（如 `HAMD-17`）和 `variants`（同一量表的不同版本名，命中就记版本） | 数值（时间点级时进 `timepoints.csv`） |
| `date` | `YYYY-MM-DD`（可只到年、月） | 捕获日期或相对时间（"2年前"按文书写成时间换算，`precision` 记精度） | 日期 |
| `text` | 短文本（≤ 200 字） | `rules` 捕获 `v`；否则送模型 | 文本 |
| `list` | 多个短文本 | 每个命中一个值（如药名）；`options` 可给规范名与别名 | `；` 连接 |
| `derived` | 由 `derive` 算 | 不读原文 | 视 `derive.output` |

## 4. 断言（通用层，模板可追加词）

插件对每个命中在**所在分句**（以 `。；;\n` 切）判断语境：

| 断言 | 判据（通用词表，`lexicon` 可追加） |
|---|---|
| `否认` | 命中前同分句内有 无、否认、未、未见、没有、不伴、未诉、未述、排除；或命中后紧跟 （-）、阴性、否认 |
| `可疑` | 疑似、可疑、待排、不除外、？ |
| `家族` | 在"家族史"栏目；或同分句前有亲属称谓（父、母、兄、弟、姐、妹、子、女、祖、外祖、舅、姨、叔、伯、姑、家族中） |
| `既往` | 在"既往史"栏目；或同分句前有 既往、曾、以往、多年前、年轻时、幼时、病史 |
| `计划` | 拟、计划、建议、必要时、如有、若、警惕、预防、宣教、告知、注意 |
| `阳性` | 以上都不是 |

优先级：否认 ＞ 家族 ＞ 可疑 ＞ 计划 ＞ 既往 ＞ 阳性（否认＋家族，如"否认家族中精神病史"，记 `否认`，`subject` 为家族）。
模型返回的断言必须是上表之一。

## 5. 规则 `rules`

```json
{ "id": "hamd-total", "regex": "HAMD(?:-?(?<variant>17|24))?\\s*(?:总分|评分)?\\s*[:：为]?\\s*(?<v>\\d{1,2})\\s*分", "value": null }
```

| 键 | 含义 |
|---|---|
| `id` | 模板内唯一；证据里记 `rule:<id>` |
| `regex` | JS 正则源码；命名分组 `v`＝值，`unit`＝单位，`variant`＝量表版本，`date`＝日期文本 |
| `value` | 固定值（如命中"自杀未遂"时值为 `有`）；与 `v` 二选一 |
| `assertion` | 可选：强制断言（不再按 §4 判） |
| `map` | 可选：捕获值到规范值的映射（如 `{"Ⅲ": "III", "3": "III"}`），先映射再按类型归一 |
| `factor` | 可选：数值换算系数（如 LVEF 写成 0.35 时 `factor: 100` 记为 35） |
| `sections` | 可选：只在这些栏目生效 |

规则命中就定值，不送模型（`model: "always"` 时规则结果作第二票）。

## 6. 汇总 `pick`

| pick | 用于 | 含义 |
|---|---|---|
| `any`（presence 默认） | presence | 有任一 `有`→有；否则有 `可疑`→可疑；否则有 `无`→无；否则 `未提及` |
| `first`／`last` | 任何 | 按文书写成时间取最早／最晚的值 |
| `max`／`min` | number、score | 最大／最小 |
| `earliest`／`latest`（date 默认 `earliest`） | date | 最早／最晚的日期值 |
| `all`（list、text 默认） | 任何 | 去重后全部 |
| `mode` | enum（默认） | 出现最多的值；并列时登记冲突 |

除 `all` 外，同一格子出现互斥值（presence 同时有"有"和"无"、enum 不同值、数值不同）都登记冲突，宽表仍按 `pick` 给值，冲突另列。

## 7. 派生 `derive`

| op | 参数 | 输出 |
|---|---|---|
| `ageAt` | `at`：日期字段 id，或 `$encounter.start`、`$document.written` | 年龄（整岁），出生日期取数据源层的 `person.birth` |
| `monthsBetween` | `from`、`to`：日期字段 id 或 `$encounter.start` | 月数（一位小数） |
| `reduction` | `field`：score 字段（时间点级） | 同一格子里同量表同版本的 (首次−末次)/首次，百分比 |
| `threshold` | `field`、`cmp`（`>=` `<=` `>` `<` `==`）、`value` | `是`／`否`／`无法判断` |
| `anyOf` | `fields`：presence 字段 id 数组 | 任一为 `有`→`有`；全为 `无`→`无`；否则 `未提及` |
| `countOf` | `field`：list 字段 | 去重后个数 |

派生字段的出处＝其输入值的证据并集。输入缺失时输出 `无法判断`，不推断。

## 8. 校验

加载模板时检查：必填键、id 唯一、`type` 合法、正则能编译、`options` 值唯一、`derive` 引用的字段存在且类型匹配、`pick` 与类型兼容。不通过就拒绝运行，并列出所有问题。

## 9. 用 Excel 编写

模板页的「下载 Excel」「空白模板」「导入 Excel」与 Agent 工具 `extract_template_excel` 用同一种 xlsx 格式（`lib/template/excel.js`），导出再导入不丢信息：

| 表 | 内容 |
|---|---|
| 模板 | 两列"键／值"：id、名称、版本、学科、说明；"分组"每行一个（`ID=名称`）；"依据"每行一个（`指南名称 | 链接`）；排除／限定文书类型；`词表·<类>` |
| 字段 | 一行一个字段。列表类用"、"分隔；正则一行一条；选项一行一个，写成 `规范值：写法1、写法2`；派生写 JSON；值域写最小值、最大值两列 |
| 规则 | 一行一条：字段ID、规则ID、正则、固定值、断言、栏目、映射（JSON）、系数 |
| 填写说明 | 每列怎么填、可选值（导入时忽略） |

导入时先解析再按 §8 校验，问题指到"某表第几行、哪一列"；不通过不保存。
