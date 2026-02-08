# ZX2 (52youxi) API 接口文档

本文档基于 OpenAPI Specification 整理，描述了 ZX2 平台的异步生图接口。

## 1. 基本信息

- **Base URL**: `http://zx2.52youxi.cc` (或其他配置的地址)
- **认证方式**: Header `Authorization: Bearer <API_KEY>`

---

## 2. 创建任务 (异步)

提交生图任务，获取任务 ID。

- **接口地址**: `/api/generate`
- **请求方法**: `POST`
- **Content-Type**: `application/json`

### 请求参数 (Body)

| 参数名 | 类型 | 必填 | 描述 | 示例值 |
| :--- | :--- | :--- | :--- | :--- |
| `model` | string | 是 | 固定值 | `nano-banana-pro` |
| `prompt` | string | 是 | 提示词 | `一只猫` |
| `aspectRatio` | string | 是 | 图片比例 | `1:1`, `3:4`, `16:9` 等 |
| `imageSize` | string | 是 | 分辨率 (必须大写) | `1K`, `2K`, `4K` |
| `urls` | array | 否 | 参考图链接列表 | `["http://..."]` |

**示例请求:**

```json
{
  "model": "nano-banana-pro",
  "prompt": "将两个融合到一个图片上...",
  "aspectRatio": "1:1",
  "imageSize": "1K",
  "urls": [
    "https://static.json.cn/r/img/avatars/avatar_un_login.png"
  ]
}
```

### 响应参数

| 参数名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `code` | number | 状态码 (0 表示成功) |
| `msg` | string | 消息 |
| `data.id` | string | **任务 ID** (用于查询结果) |

**示例响应 (成功):**

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "fefe0bb7-6a37-4e1f-b4e1-c27b0153e33f"
  }
}
```

---

## 3. 查询任务结果 (异步)

根据任务 ID 查询生图结果。

- **接口地址**: `/api/result`
- **请求方法**: `POST` (注意不是 GET)
- **Content-Type**: `application/json`

### 请求参数 (Body)

| 参数名 | 类型 | 必填 | 描述 | 示例值 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | string | 是 | 任务 ID | `4c204491-0a6f-4185-bc16-6c60c791f8fa` |

**示例请求:**

```json
{
  "id": "4c204491-0a6f-4185-bc16-6c60c791f8fa"
}
```

### 响应参数

| 参数名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `code` | number | 状态码 (0 表示成功, 非 0 表示失败或处理中) |
| `msg` | string | 消息 |
| `url` | string | **图片链接** (成功时返回) |

> **注意**: 生成的图片务必及时保存，服务器不定期清理。

**示例响应 (成功):**

```json
{
  "code": 0,
  "msg": "成功",
  "url": "http://zx2.52youxi.cc/storage/img/20260204/....jpeg"
}
```

**示例响应 (失败):**

```json
{
  "code": -1,
  "msg": "生成失败，请重启 错误消息：..."
}
```
