# AI LeetCode 私教

> 像墨墨背单词一样系统化刷 LeetCode：计划驱动 → 间隔重复 → 每日推送 → 评分复盘。
> MVP 已本地跑通：Next.js 14 + PostgreSQL + DeepSeek AI 教练。

---

## 1. 产品定位

**一句话**：给准备技术面试的人一个「不用想今天刷什么」的刷题教练。

**解决三个痛点**

| 痛点 | 现状 | 本产品 |
|---|---|---|
| 不知道刷什么 | 收藏一堆题单，打开就迷茫 | 按专题顺序 + 每日固定题量推送 |
| 刷完就忘 | 做过的题两周后归零 | SM-2 间隔重复 + 到期复习 |
| 卡住没人管 | 看题解 = 直接抄答案 | AI 教练分层提示，只给方向不给答案 |

**核心方法论**

- **墨墨背单词**：SM-2 间隔重复、每日复习上限
- **灵茶山艾府**：题目按专题系统刷通，专题内 Easy → Medium → Hard
- **Hot 100**：MVP 唯一计划，205 题 / 12 专题

---

## 2. 已实现功能

### 学习闭环

```
选计划 → 每日推送 → 做题 → AI 教练 → 评分 → SM-2 复习 → 仪表盘
```

- **计划**：Hot 100（205 题，12 专题），专题内按难度递进
- **每日推送**：昨日未完成 + 到期复习（≤ 每日题量 30%）+ 新题
- **评分**：0–5 分写入 SM-2，计算下次复习时间
- **遗忘检测**：超期 14 天未复习 → 重置为新题
- **仪表盘**：总进度、专题热力图、30 天打卡、连续天数、预计完成时间

### AI 教练（DeepSeek，流式）

- **分层提示**：L1 方向 → L2 思路 → L3 边界/复杂度，始终不给可提交答案
- **复盘模式**：学生先讲思路，教练指出漏洞与面试表达问题
- **Prompt 版本化**：响应头带 `coach-v1.2`，便于灰度与回滚
- **Bad Case 闭环**：每条回答可 👍/👎，写入 `data/coach-feedback.jsonl`
- **可观测**：前端显示首字延迟 / 总耗时；服务端 60s 超时保护

### 数据与账号

- 205 题题库 + 前置依赖图（`data/`）
- Dev 自动登录（`test-user-001`），无需微信 OAuth
- Chrome 扩展（MV3）：监听 LeetCode 提交、评分弹窗、任务侧栏
- Stripe 订阅骨架（未接真实支付）

---

## 3. 快速启动

前置：Node 18+、Docker Desktop。

```bash
# 1. 安装依赖
npm install

# 2. 启动 PostgreSQL + Redis
docker compose up -d postgres redis

# 3. 环境变量（.env）
DATABASE_URL="postgresql://aitoearn:aitoearn_dev@localhost:5432/aitoearn"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
DEEPSEEK_API_KEY="<your key>"

# 4. 建表 + 题库种子
npx prisma generate
npx prisma db push
npm run db:seed

# 5. （可选）30 天演示用户：56% 进度 / 12 天打卡 / 今日 2/5
npx tsx scripts/seed-demo.ts

# 6. 启动
npm run dev
```

打开 http://localhost:3000 → 「进入产品演示」→ 自动以 `test-user-001` 登录。

---

## 4. 目录结构

```
app/                 页面 + API 路由
  api/coach/         DeepSeek 流式教练 + 反馈日志
  api/daily-push/    每日推送生成 / 完成评分
  api/dashboard/     仪表盘聚合
components/
  coach/             AI 教练抽屉（分层提示、点赞点踩、延迟）
  daily/             题目卡片、评分弹窗、庆祝动画
  dashboard/         进度环、热力图、打卡日历
lib/
  scheduler/         SM-2 选题引擎
  date.ts            本地日 → UTC 日期键（修时区错位）
prisma/              Schema + 种子
data/                题库、依赖图、反馈日志
scripts/             种子 / 演示数据
extension/           Chrome 扩展（MV3）
docs/                面试材料
```

---

## 5. 设计决策（为什么这样做）

1. **复习上限 30%**：刷一题 15–30 分钟，复习不能挤爆新题。
2. **14 天遗忘阈值**：背单词忘了 30 秒能恢复，刷题忘了要重学。
3. **规则引擎选题 + LLM 讲解**：选题要确定、可解释、零 token；讲解要个性化，才用 LLM。
4. **提示分层而非直接问答**：保护「自己想出来」的学习效果，也降低 token 成本。
5. **反馈落 JSONL 而非只存 DB**：Bad Case 需要能快速导出做 eval，不阻塞主流程。

---

## 6. 已知限制

- 微信 OAuth / Stripe 只有骨架，演示用 Dev 自动登录
- 题目描述未入库，AI 教练依赖标题 + 专题上下文（DeepSeek 熟悉 Hot 100）
- 演示数据脚本会重置 `test-user-001` 的进度
- Python 调度微服务与 TS 引擎逻辑重复，尚未合并

---

## 7. 面试材料

- [`docs/interview-ai-pm.md`](docs/interview-ai-pm.md)：按 AI 产品经理 JD 准备的讲法、指标、ROI、Q&A
