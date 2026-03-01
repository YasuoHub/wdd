# 问当地 - 数据库结构文档

## 环境信息
- **环境ID**: `wdd-2grpiy1r6f9f4cf2`
- **区域**: `ap-guangzhou`

---

## 1. users (用户集合)

### 用途
存储用户基本信息、角色、积分、帮助者位置等

### 字段结构
```javascript
{
  _id: "ObjectId",           // 系统自动生成
  openid: "string",          // 微信openid (唯一)
  unionid: "string",         // 微信unionid (可选)
  nickname: "string",        // 昵称
  avatar: "string",          // 头像URL
  phone: "string",           // 手机号 (可选)

  // 角色信息
  role: "string",            // 枚举: 'seeker'(求助者) | 'helper'(帮助者) | 'both'(两者)

  // 求助者信息
  seekerInfo: {
    totalRequests: 0,        // 发布需求总数
    completedRequests: 0,    // 完成需求数
    cancelledRequests: 0     // 取消需求数
  },

  // 帮助者信息
  helperInfo: {
    locations: [             // 服务位置列表 (地理坐标，用于geoNear查询)
      {
        type: "Point",
        coordinates: [longitude, latitude]  // [经度, 纬度]
      }
    ],
    serviceTypes: [],        // 服务类型 ['weather', 'traffic', ...]
    isAvailable: true,       // 是否可接单
    completedTasks: 0,       // 完成任务数
    rating: 5.0,             // 平均评分
    totalReviews: 0          // 评价数量
  },

  // 积分信息
  points: {
    balance: 100,            // 当前积分余额
    totalEarned: 100,        // 累计获得
    totalSpent: 0            // 累计消费
  },

  // 邀请信息
  inviteCode: "string",      // 我的邀请码
  invitedBy: "string",       // 邀请人ID (可选)

  // 设置
  settings: {
    largeFont: false,        // 大字体模式
    notifications: true      // 通知开关
  },

  // 状态
  isBanned: false,           // 是否被封禁
  banReason: "string",       // 封禁原因 (可选)

  // 时间
  lastLoginAt: "Date",       // 最后登录时间
  createdAt: "Date",         // 创建时间
  updatedAt: "Date"          // 更新时间
}
```

### 必须创建的索引
```javascript
// 1. openid唯一索引 (用于登录查询)
{ openid: 1 }, unique: true

// 2. 帮助者位置地理索引 (用于匹配附近帮助者)
{ 'helperInfo.locations': '2dsphere' }

// 3. 角色和可用状态复合索引 (用于筛选可接单帮助者)
{ role: 1, 'helperInfo.isAvailable': 1 }

// 4. 封禁状态索引 (用于过滤)
{ isBanned: 1 }

// 5. 创建时间索引 (用于排序)
{ createdAt: -1 }
```

---

## 2. needs (需求集合)

### 用途
存储求助者发布的需求信息

### 字段结构
```javascript
{
  _id: "ObjectId",           // 系统自动生成
  needNo: "string",          // 需求编号 (如: N202403011230001234)

  // 关联用户
  seekerId: "string",        // 求助者用户ID
  seekerOpenid: "string",    // 求助者openid
  helperId: "string",        // 帮助者用户ID (可选，匹配后填充)
  helperOpenid: "string",    // 帮助者openid (可选)

  // 需求内容
  type: "string",            // 枚举: 'weather'(天气) | 'traffic'(交通) | 'shop'(店铺) | 'parking'(停车) | 'queue'(排队) | 'other'(其他)
  typeName: "string",        // 类型名称 (如: "实时天气")
  description: "string",     // 需求描述

  // 位置信息 (重要!用于附近查询)
  location: {                // GeoJSON Point 格式
    type: "Point",
    coordinates: [longitude, latitude]  // [经度, 纬度]
  },
  locationInfo: {            // 位置详情
    name: "string",          // 位置名称
    address: "string"        // 详细地址
  },

  // 悬赏积分
  points: 10,                // 基础悬赏积分
  bonusPoints: 0,            // 追加悬赏积分

  // 状态
  status: "string",          // 枚举: 'pending'(待支付) | 'matching'(匹配中) | 'executing'(进行中) | 'completed'(已完成) | 'cancelled'(已取消) | 'disputed'(纠纷中)

  // 时间
  deadline: "Date",          // 截止时间的ISO字符串
  acceptedAt: "Date",        // 接单时间
  completedAt: "Date",       // 完成时间
  cancelledAt: "Date",       // 取消时间
  createdAt: "Date",         // 创建时间
  updatedAt: "Date"          // 更新时间
}
```

### 必须创建的索引
```javascript
// 1. 求助者ID+状态复合索引 (用于查询我的需求)
{ seekerId: 1, status: 1 }

// 2. 帮助者ID+状态复合索引 (用于查询我的任务)
{ helperId: 1, status: 1 }

// 3. 求助者openid索引 (用于权限验证)
{ seekerOpenid: 1 }

// 4. 帮助者openid索引 (用于权限验证)
{ helperOpenid: 1 }

// 5. 位置地理索引 (★★★ 最重要!用于附近需求查询)
{ location: '2dsphere' }

// 6. 状态+创建时间复合索引 (用于列表排序)
{ status: 1, createdAt: -1 }

// 7. 需求编号唯一索引
{ needNo: 1 }, unique: true

// 8. 类型索引 (用于筛选)
{ type: 1 }
```

---

## 3. matches (匹配记录)

### 用途
存储需求与帮助者的匹配记录

### 字段结构
```javascript
{
  _id: "ObjectId",
  needId: "string",          // 需求ID
  helperId: "string",        // 帮助者ID
  priority: 0,               // 匹配优先级分数
  distance: 1000,            // 距离(米)
  typeMatch: true,           // 类型是否匹配
  status: "string",          // 'pending'(待响应) | 'accepted'(已接受) | 'rejected'(已拒绝) | 'expired'(已过期)
  notifiedAt: "Date",        // 通知时间
  respondedAt: "Date",       // 响应时间
  createdAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 需求ID+优先级 (用于查询候选帮助者)
{ needId: 1, priority: 1 }

// 2. 帮助者ID+状态 (用于查询我的匹配)
{ helperId: 1, status: 1 }

// 3. 需求+帮助者唯一索引 (防止重复匹配)
{ needId: 1, helperId: 1 }, unique: true
```

---

## 4. messages (消息集合)

### 用途
存储需求相关的聊天消息

### 字段结构
```javascript
{
  _id: "ObjectId",
  needId: "string",          // 所属需求ID
  senderId: "string",        // 发送者ID
  receiverId: "string",      // 接收者ID
  type: "string",            // 'text'(文字) | 'image'(图片) | 'location'(位置)
  content: "string",         // 消息内容
  isRead: false,             // 是否已读
  readAt: "Date",            // 阅读时间
  createdAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 需求ID+创建时间 (用于查询聊天记录)
{ needId: 1, createdAt: -1 }

// 2. 接收者+已读状态 (用于查询未读消息)
{ receiverId: 1, isRead: 1 }

// 3. 发送者+创建时间 (用于查询我的消息)
{ senderId: 1, createdAt: -1 }
```

---

## 5. points_records (积分记录)

### 用途
存储积分变动记录

### 字段结构
```javascript
{
  _id: "ObjectId",
  userId: "string",          // 用户ID
  type: "string",            // 'earn'(获得) | 'spend'(消费) | 'refund'(退款)
  amount: 10,                // 变动数量 (正数增加,负数减少)
  balance: 110,              // 变动后余额
  reason: "string",          // 变动原因
  relatedId: "string",       // 关联ID (如需求ID)
  description: "string",     // 描述
  createdAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 用户ID+创建时间 (用于查询我的记录)
{ userId: 1, createdAt: -1 }

// 2. 用户ID+类型 (用于分类统计)
{ userId: 1, type: 1 }

// 3. 关联ID索引 (用于反向查询)
{ relatedId: 1 }
```

---

## 6. sign_in_records (签到记录)

### 用途
存储每日签到记录

### 字段结构
```javascript
{
  _id: "ObjectId",
  userId: "string",          // 用户ID
  year: 2024,                // 年份
  month: 3,                  // 月份
  day: 1,                    // 日期
  points: 5,                 // 获得积分
  continuousDays: 3,         // 连续签到天数
  createdAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 用户+年月复合索引 (用于查询月度签到)
{ userId: 1, year: 1, month: 1 }

// 2. 用户+创建时间 (用于查询记录)
{ userId: 1, createdAt: -1 }
```

---

## 7. invite_records (邀请记录)

### 用途
存储邀请好友记录

### 字段结构
```javascript
{
  _id: "ObjectId",
  inviterId: "string",       // 邀请人ID
  invitedId: "string",       // 被邀请人ID (唯一)
  points: 50,                // 邀请奖励积分
  createdAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 邀请人ID (用于查询我的邀请)
{ inviterId: 1 }

// 2. 被邀请人唯一索引 (防止重复)
{ invitedId: 1 }, unique: true

// 3. 创建时间 (用于排序)
{ createdAt: -1 }
```

---

## 8. reviews (评价集合)

### 用途
存储用户评价

### 字段结构
```javascript
{
  _id: "ObjectId",
  needId: "string",          // 关联需求ID
  fromUserId: "string",      // 评价人ID
  toUserId: "string",        // 被评价人ID
  rating: 5,                 // 评分 1-5
  content: "string",         // 评价内容
  tags: [],                  // 标签
  createdAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 被评价人+创建时间 (用于查询我的评价)
{ toUserId: 1, createdAt: -1 }

// 2. 需求ID (用于查询需求评价)
{ needId: 1 }

// 3. 评价人ID (用于查询我的评价)
{ fromUserId: 1 }
```

---

## 9. supports (客服介入记录)

### 用途
存储客服申诉记录

### 字段结构
```javascript
{
  _id: "ObjectId",
  needId: "string",          // 关联需求ID
  applicantId: "string",     // 申请人ID
  type: "string",            // 'dispute'(纠纷) | 'complaint'(投诉)
  reason: "string",          // 原因
  status: "string",          // 'pending'(处理中) | 'resolved'(已解决) | 'rejected'(已驳回)
  result: "string",          // 处理结果
  handledBy: "string",       // 处理人ID
  createdAt: "Date",
  handledAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 需求ID (用于关联查询)
{ needId: 1 }

// 2. 状态+创建时间 (用于客服后台查询)
{ status: 1, createdAt: -1 }

// 3. 申请人ID (用于查询我的申诉)
{ applicantId: 1 }
```

---

## 10. reports (举报记录)

### 用途
存储举报记录

### 字段结构
```javascript
{
  _id: "ObjectId",
  reporterId: "string",      // 举报人ID
  reportedId: "string",      // 被举报人ID
  needId: "string",          // 关联需求ID (可选)
  reason: "string",          // 举报原因
  status: "string",          // 'pending'(待处理) | 'resolved'(已处理)
  createdAt: "Date"
}
```

### 必须创建的索引
```javascript
// 1. 被举报人ID (用于查询某人被举报记录)
{ reportedId: 1 }

// 2. 举报人ID (用于查询我的举报)
{ reporterId: 1 }

// 3. 状态索引 (用于处理)
{ status: 1 }
```

---

## 11. login_logs (登录日志)

### 用途
存储登录历史

### 字段结构
```javascript
{
  _id: "ObjectId",
  openid: "string",
  deviceInfo: "string",      // 设备信息
  ip: "string",              // IP地址
  createdAt: "Date"          // 30天后自动删除
}
```

### 必须创建的索引
```javascript
// 1. openid+创建时间 (用于查询登录历史)
{ openid: 1, createdAt: -1 }

// 2. 创建时间 (用于TTL删除)
{ createdAt: -1 }

// 3. TTL索引 (30天过期)
{ createdAt: 1 }, expireAfterSeconds: 2592000
```

---

## 12. login_attempts (登录尝试记录)

### 用途
存储失败登录尝试（防暴力破解）

### 字段结构
```javascript
{
  _id: "ObjectId",
  openid: "string",
  count: 1,                  // 失败次数
  lastAttemptAt: "Date",     // 最后尝试时间
  createdAt: "Date"          // 10分钟后自动删除
}
```

### 必须创建的索引
```javascript
// 1. openid (用于查询某用户尝试记录)
{ openid: 1 }

// 2. 创建时间 (用于TTL删除)
{ createdAt: -1 }

// 3. TTL索引 (10分钟过期)
{ createdAt: 1 }, expireAfterSeconds: 600
```

---

## 索引创建脚本

如果需要在 CloudBase 控制台手动创建索引，可以使用以下命令：

```javascript
// 在 CloudBase 控制台 - 数据库 - 索引管理 中创建

// ===== users 集合 =====
{ openid: 1 }  // 唯一
{ 'helperInfo.locations': '2dsphere' }
{ role: 1, 'helperInfo.isAvailable': 1 }
{ isBanned: 1 }
{ createdAt: -1 }

// ===== needs 集合 (最重要) =====
{ seekerId: 1, status: 1 }
{ helperId: 1, status: 1 }
{ seekerOpenid: 1 }
{ helperOpenid: 1 }
{ location: '2dsphere' }  // ★★★ 必须创建!
{ status: 1, createdAt: -1 }
{ needNo: 1 }  // 唯一
{ type: 1 }
```

---

## 常见问题

### Q: 为什么附近需求查询失败，报错 "unable to find index for $geoNear query"?
A: `needs` 集合缺少 `{ location: '2dsphere' }` 索引，必须在 CloudBase 控制台手动创建。

### Q: 为什么无法匹配附近的帮助者?
A: `users` 集合缺少 `{ 'helperInfo.locations': '2dsphere' }` 索引。

### Q: 如何验证索引是否生效?
A: 在 CloudBase 控制台 - 数据库 - 集合 - 索引管理 中查看索引列表。
