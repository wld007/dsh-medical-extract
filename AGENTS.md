# 给开发代理的约定

## 开始前

1. 读 `docs/brief.md`（定位与产线）和 `docs/template.md`（模板格式，引擎与模板之间的契约）。
2. 插件家族的共同约定见 `../dsh-medical-event/docs/family.md`。实现方式（Node、`index.js`、`lib/`、`client.js`、`cordis.patch.yml`、`scripts/build.mjs`）和页面风格都参照 `../dsh-medical-event`。

## 必须遵守

- **通用插件为主**：引擎里不写任何病种内容。病种内容只放在模板里（`templates/src/*.mjs` → `templates/*.json`）。内置模板（MDD、卒中、AD、心衰、糖尿病、CKD/血透、肺癌）和用户模板一样，都只是模板。
- 绝不修改输入。输出写到输出根目录，记录放 `_records/`。
- 病历内容只发往用户设置里的模型端点；Agent 工具不能选择端点、模型、Key。
- 每个值都要能回到原文（引语＋起止位置），模型给的位置一律不采用；编号稳定；每个值写明出处（规则编号或模型）。
- 面向千万级文书：不要一次性载入全部输入，不要逐条写记录库，汇总要能分桶；新功能先想清楚 7,000 万份时会怎样。
- 测试只用虚构数据（`test/fixtures/`）；不把病历派生内容复制进仓库。
- 改模板格式要升 `format` 版本，同步改 `docs/template.md` 和校验（`lib/template/load.js`）。

## 更新本机安装的插件

- 有批次在运行时，不要重装、启用或停用插件；操作前先用 `extract_runs` 确认没有 `running` 的批次。
- 运行 `node scripts/build.mjs <版本>` 生成 `dist/<版本>`，再从 profile 安装；版本号按 `0.x.y-dev.N` 递增。
