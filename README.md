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

## 晨报生成

`morning-briefing-tg/briefing.sh` 末尾加:
```bash
~/projects/frank-dashboard/scripts/push_briefing.sh "$MARKDOWN_FILE"
```

## 多源交叉验证

市场取多源中位数，偏差超阈值 `disagree=true`，前端角标告警。实现见 `updater/lib/xverify.py`。

## 视觉

Claude Artifact 暖石色 (stone neutrals)，12 栏 grid 严格填满，hash 路由 (`#/briefing/:date`)。
