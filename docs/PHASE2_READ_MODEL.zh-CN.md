# Phase 2：只读控制面（Read Model）

## 目标

Phase 2 的第一刀不做控制写入，也不急着做复杂多 Agent 调度。

本阶段目标只有一个：

> 把插件内部的 session 路由状态，投影成控制 UI 可读、可枚举、可稳定消费的 read model。

## 分层

### 1. State

内部事实源：

- `resolveRouteSessionKey(...)`
- `RoutingSessionStore`

职责：

- 存储内部路由状态
- 维护 route decision / task state
- 不直接暴露给 UI

### 2. DTO

对 UI 暴露稳定数据结构：

- `RuntimeRoutingDTO`
- `SessionSummaryDTO`
- `SessionDetailDTO`

职责：

- 不暴露内部 Map
- 不绑定任何前端框架
- 未来 HTTP / WS / CLI / control UI 都共用这套结构

### 3. Projector

负责把内部 state 转成 DTO：

- `projectSessionSummary(...)`
- `projectSessionDetail(...)`

### 4. Read Service

对外提供稳定读接口：

- `getRuntimeView()`
- `listSessions()`
- `getSession(sessionKey)`

## 当前交付

本阶段新增：

- store 枚举能力
- DTO 定义
- projector
- read service
- 对应单测

## 未来控制 UI 的粗 API

- `GET /routing/runtime`
- `GET /routing/sessions`
- `GET /routing/sessions/:sessionKey`

## 为什么这一步重要

因为后面的 Phase 2/3 如果要继续做：

- 多 Agent slot
- policy override
- 手动冻结 / 恢复 / 强制切换
- UI 活动面板

都应该建立在稳定的 read model 之上，而不是直接耦合插件内部状态结构。
