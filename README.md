# Frank 简报中心

个人信息门户，部署在 `dashboard.frank2019.me`。

## 架构

```
  Mac 本地 (morning-briefing-tg)             monitor 服务器
  ├── briefing.sh → TG                       ├── web (nginx)
  └── push_briefing.sh ─── scp ────────────► ├── data/ (shared volume)
                                             │   ├── briefing-*.json  ← 晨报由 Mac 推送
                                             │   ├── market.json      ← updater fetch
                                             │   └── ...
                                             └── updater (supercronic)
```

- **web** 容器：多阶段 build 前端 → nginx 托管 SPA + `/data/*.json`
- **updater** 容器：Python + supercronic，按 cron 跑各 fetcher 写共享 volume
- **晨报**：Mac 本地 `claude -p` 生成 Artifact JSON，scp 到服务器（走 Max 套餐，零 API 费用）

## 模块

| 模块 | 数据源 | 多源交叉 |
|---|---|---|
| 今日晨报 | Claude Artifact JSON（Mac 推送） | — |
| 市场速览 | Yahoo + Stooq + CoinGecko | ✅ |
| 经济日历 | 手工 YAML (`updater/data-seed/econ_events.yaml`) | — |
| 36氪热榜 | 官方 RSS | — |
| 知乎热榜 | `api.zhihu.com/topstory/hot-list` | — |
| 倒计时 | 手工 YAML（CN + US 分组） | — |
| 博客最新 | frank2019.me Halo RSS | — |
| 晨报存档 | 扫 data/briefing-*.json | — |
| 氛围 (Header) | 每日一图 + 一言 + LA/BJ 双时区 | — |

## 本地开发

```bash
cp .env.example .env
docker compose build
docker compose up -d
# 前端：http://localhost:18090
```

单跑 fetcher:
```bash
docker compose exec updater python -m fetchers.market
```

## 生产部署

```bash
# monitor 服务器
cd /opt/frank-dashboard
docker compose pull && docker compose up -d
```

Cloudflare DNS A `dashboard.frank2019.me` → 服务器 IP，TLS。

## 加新模块

改三处，框架不动:

1. `updater/fetchers/<name>.py` — 输出 `/data/<name>.json`
2. `web/src/modules/<Name>.tsx` — 读 JSON 渲染
3. `web/src/modules.json` — 加一条 `{id, title, component, size, enabled}`

## 晨报模块（可选 / 自带内容管线）

"今日晨报" 和 "晨报存档" 两个模块**依赖本地内容生成**，不是开箱即用：

- 原始晨报（markdown）由本地脚本生成（示例：`morning-briefing-tg/briefing.sh`，用 `claude -p` + Web Search）
- `scripts/push_briefing.sh` 把 markdown → Artifact JSON → scp 到服务器 `/data/briefing-*.json`
- 没配这条链路 → 前端该模块保持 404/空（不影响其他模块）

**接入方式**（Fork 使用者按需改）:
```bash
# 本地晨报脚本末尾加一行
/path/to/frank-news/scripts/push_briefing.sh "$MARKDOWN_FILE"

# 或设环境变量指定服务器路径
DASHBOARD_DEST=user@host:/opt/frank-news/data/ ./push_briefing.sh ...
```

**不想要这个模块**：改 `web/src/modules.json`，把 `briefing` 和 `archive` 的 `enabled` 设为 `false`，重新 build。

## 多源交叉验证

市场取多源中位数，偏差超阈值 `disagree=true`，前端角标告警。实现见 `updater/lib/xverify.py`。

## 视觉

Claude Artifact 暖石色 (stone neutrals)，12 栏 grid 严格填满，hash 路由 (`#/briefing/:date`)。
