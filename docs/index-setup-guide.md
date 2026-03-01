# 腾讯云开发数据库索引配置步骤

## 第一步：登录控制台

1. 打开 https://console.cloud.tencent.com/tcb
2. 登录你的腾讯云账号
3. 选择对应的环境（环境ID: wdd-2grpiy1r6f9f4cf2）

---

## 第二步：进入数据库页面

点击左侧菜单：
```
云开发 CloudBase
  └── 数据库
      └── 集合名称列表
```

---

## 第三步：创建索引（以 needs 集合为例）

### 1. 点击 needs 集合

![步骤示意]
在集合列表中找到 needs，点击进入

### 2. 进入索引管理

点击顶部标签：
- 数据
- **索引管理**  ← 点击这个
- 权限设置

### 3. 添加索引

点击 **添加索引** 按钮

### 4. 填写索引信息

**索引名称**：`location_2dsphere`

**索引属性**：
- [ ] 唯一（不勾选）
- [ ] 稀疏（不勾选）
- [ ] 后台创建（可选）

**索引字段**：
```
字段名        排序/类型
location      2dsphere  ← 关键是选这个类型
```

**步骤**：
1. 字段名输入：`location`
2. 排序选择：**2dsphere**（不是升序/降序）
3. 点击 **添加字段**
4. 点击 **确定**

---

## 第四步：needs 集合需要创建的全部索引

按上面的方法，逐个创建以下 8 个索引：

### 索引 1：求助者查询
- **名称**: `seeker_status_idx`
- **字段**:
  - `seekerId` → 升序 (1)
  - `status` → 升序 (1)

### 索引 2：帮助者查询
- **名称**: `helper_status_idx`
- **字段**:
  - `helperId` → 升序 (1)
  - `status` → 升序 (1)

### 索引 3：求助者openid
- **名称**: `seekerOpenid_idx`
- **字段**:
  - `seekerOpenid` → 升序 (1)

### 索引 4：帮助者openid
- **名称**: `helperOpenid_idx`
- **字段**:
  - `helperOpenid` → 升序 (1)

### 索引 5：地理索引（最重要）
- **名称**: `location_2dsphere`
- **字段**:
  - `location` → **2dsphere**

### 索引 6：状态排序
- **名称**: `status_created_idx`
- **字段**:
  - `status` → 升序 (1)
  - `createdAt` → 降序 (-1)

### 索引 7：需求编号（唯一）
- **名称**: `needNo_idx`
- **唯一**: ✅ 勾选
- **字段**:
  - `needNo` → 升序 (1)

### 索引 8：类型筛选
- **名称**: `type_idx`
- **字段**:
  - `type` → 升序 (1)

---

## 第五步：users 集合索引

进入 users 集合，创建 5 个索引：

### 索引 1：openid（唯一）
- **名称**: `openid_idx`
- **唯一**: ✅ 勾选
- **字段**:
  - `openid` → 升序 (1)

### 索引 2：帮助者位置（地理索引）
- **名称**: `location_2dsphere`
- **字段**:
  - `helperInfo.locations` → **2dsphere**

  > ⚠️ 注意：字段名要带引号或点号，输入 `helperInfo.locations`

### 索引 3：角色可用状态
- **名称**: `role_available_idx`
- **字段**:
  - `role` → 升序 (1)
  - `helperInfo.isAvailable` → 升序 (1)

### 索引 4：封禁状态
- **名称**: `banned_idx`
- **字段**:
  - `isBanned` → 升序 (1)

### 索引 5：创建时间
- **名称**: `created_idx`
- **字段**:
  - `createdAt` → 降序 (-1)

---

## 第六步：其他集合索引（快速清单）

### matches 集合（3个索引）

| 索引名 | 字段 |
|--------|------|
| need_priority_idx | needId(升), priority(升) |
| helper_status_idx | helperId(升), status(升) |
| need_helper_idx | needId(升), helperId(升) **唯一** |

### messages 集合（3个索引）

| 索引名 | 字段 |
|--------|------|
| need_created_idx | needId(升), createdAt(降) |
| receiver_read_idx | receiverId(升), isRead(升) |
| sender_created_idx | senderId(升), createdAt(降) |

### points_records 集合（3个索引）

| 索引名 | 字段 |
|--------|------|
| user_created_idx | userId(升), createdAt(降) |
| user_type_idx | userId(升), type(升) |
| related_idx | relatedId(升) |

### sign_in_records 集合（2个索引）

| 索引名 | 字段 |
|--------|------|
| user_year_month_idx | userId(升), year(升), month(升) |
| user_created_idx | userId(升), createdAt(降) |

### invite_records 集合（3个索引）

| 索引名 | 字段 |
|--------|------|
| inviter_idx | inviterId(升) |
| invited_idx | invitedId(升) **唯一** |
| created_idx | createdAt(降) |

### reviews 集合（3个索引）

| 索引名 | 字段 |
|--------|------|
| touser_created_idx | toUserId(升), createdAt(降) |
| need_idx | needId(升) |
| fromuser_idx | fromUserId(升) |

### supports 集合（3个索引）

| 索引名 | 字段 |
|--------|------|
| need_idx | needId(升) |
| status_created_idx | status(升), createdAt(降) |
| applicant_idx | applicantId(升) |

### reports 集合（3个索引）

| 索引名 | 字段 |
|--------|------|
| reported_idx | reportedId(升) |
| reporter_idx | reporterId(升) |
| status_idx | status(升) |

### login_logs 集合（2个索引 + 1个TTL）

| 索引名 | 字段 |
|--------|------|
| openid_created_idx | openid(升), createdAt(降) |
| created_idx | createdAt(降) |

**TTL 索引**（数据自动过期）：
- **名称**: `expire_at_idx`
- **字段**: createdAt(升)
- **过期时间**: 2592000 秒（30天）
- 在高级设置中配置

### login_attempts 集合（2个索引 + 1个TTL）

| 索引名 | 字段 |
|--------|------|
| openid_idx | openid(升) |
| created_idx | createdAt(降) |

**TTL 索引**：
- **名称**: `expire_at_idx`
- **字段**: createdAt(升)
- **过期时间**: 600 秒（10分钟）

---

## 常见问题

### Q: 为什么找不到 2dsphere 选项？
A: 在添加索引字段时：
1. 先输入字段名
2. 点击右侧的下拉框
3. 选择 **「地理位置」** 或 **2dsphere**

### Q: 复合字段怎么输入？如 helperInfo.locations？
A: 直接在字段名输入框输入：`helperInfo.locations`

### Q: 升序降序怎么选？
A:
- 升序 = 1 (从小到大)
- 降序 = -1 (从大到小)
- 一般时间字段用降序（最新的在前面）

### Q: 创建索引时报错？
A: 可能原因：
1. 集合里已经有不符合索引规则的数据
2. 索引名称重复了
3. 唯一索引字段有重复值

---

## 验证索引是否生效

创建完索引后，在索引列表中可以看到：
- 索引名称
- 索引类型（单字段/复合/地理/唯一）
- 状态（创建中/正常）

**测试 needs 的地理索引**：
进入帮助者首页，如果能正常加载附近需求，说明索引生效。
