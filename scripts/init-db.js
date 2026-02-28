// scripts/init-db.js
// 数据库初始化脚本 - 使用 tcb-admin-node

const tcb = require('tcb-admin-node')

// 环境配置
const CONFIG = {
  envId: 'wdd-2grpiy1r6f9f4cf2',
  region: 'ap-guangzhou'
}

const collections = [
  {
    name: 'users',
    description: '用户集合',
    indexes: [
      { name: 'openid_idx', key: { openid: 1 }, unique: true },
      { name: 'location_2dsphere', key: { 'helperInfo.locations': '2dsphere' } },
      { name: 'role_available_idx', key: { role: 1, 'helperInfo.isAvailable': 1 } },
      { name: 'banned_idx', key: { isBanned: 1 } },
      { name: 'created_idx', key: { createdAt: -1 } }
    ]
  },
  {
    name: 'needs',
    description: '需求集合',
    indexes: [
      { name: 'seeker_status_idx', key: { seekerId: 1, status: 1 } },
      { name: 'helper_status_idx', key: { helperId: 1, status: 1 } },
      { name: 'location_2dsphere', key: { location: '2dsphere' } },
      { name: 'status_created_idx', key: { status: 1, createdAt: -1 } },
      { name: 'needNo_idx', key: { needNo: 1 }, unique: true },
      { name: 'type_idx', key: { type: 1 } }
    ]
  },
  {
    name: 'matches',
    description: '匹配记录',
    indexes: [
      { name: 'need_priority_idx', key: { needId: 1, priority: 1 } },
      { name: 'helper_status_idx', key: { helperId: 1, status: 1 } },
      { name: 'need_helper_idx', key: { needId: 1, helperId: 1 }, unique: true }
    ]
  },
  {
    name: 'messages',
    description: '消息集合',
    indexes: [
      { name: 'need_created_idx', key: { needId: 1, createdAt: -1 } },
      { name: 'receiver_read_idx', key: { receiverId: 1, isRead: 1 } },
      { name: 'sender_created_idx', key: { senderId: 1, createdAt: -1 } }
    ]
  },
  {
    name: 'points_records',
    description: '积分记录',
    indexes: [
      { name: 'user_created_idx', key: { userId: 1, createdAt: -1 } },
      { name: 'user_type_idx', key: { userId: 1, type: 1 } },
      { name: 'related_idx', key: { relatedId: 1 } }
    ]
  },
  {
    name: 'sign_in_records',
    description: '签到记录',
    indexes: [
      { name: 'user_year_month_idx', key: { userId: 1, year: 1, month: 1 } },
      { name: 'user_created_idx', key: { userId: 1, createdAt: -1 } }
    ]
  },
  {
    name: 'invite_records',
    description: '邀请记录',
    indexes: [
      { name: 'inviter_idx', key: { inviterId: 1 } },
      { name: 'invited_idx', key: { invitedId: 1 }, unique: true },
      { name: 'created_idx', key: { createdAt: -1 } }
    ]
  },
  {
    name: 'reviews',
    description: '评价集合',
    indexes: [
      { name: 'touser_created_idx', key: { toUserId: 1, createdAt: -1 } },
      { name: 'need_idx', key: { needId: 1 } },
      { name: 'fromuser_idx', key: { fromUserId: 1 } }
    ]
  },
  {
    name: 'supports',
    description: '客服介入记录',
    indexes: [
      { name: 'need_idx', key: { needId: 1 } },
      { name: 'status_created_idx', key: { status: 1, createdAt: -1 } },
      { name: 'applicant_idx', key: { applicantId: 1 } }
    ]
  },
  {
    name: 'reports',
    description: '举报记录',
    indexes: [
      { name: 'reported_idx', key: { reportedId: 1 } },
      { name: 'reporter_idx', key: { reporterId: 1 } },
      { name: 'status_idx', key: { status: 1 } }
    ]
  },
  {
    name: 'login_logs',
    description: '登录日志',
    indexes: [
      { name: 'openid_created_idx', key: { openid: 1, createdAt: -1 } },
      { name: 'created_idx', key: { createdAt: -1 } }
    ],
    expire: 2592000  // 30天过期
  },
  {
    name: 'login_attempts',
    description: '登录尝试记录',
    indexes: [
      { name: 'openid_idx', key: { openid: 1 } },
      { name: 'created_idx', key: { createdAt: -1 } }
    ],
    expire: 600  // 10分钟过期
  }
]

async function initDatabase() {
  console.log('开始初始化数据库...')
  console.log('环境ID:', CONFIG.envId)
  console.log('')

  // 初始化 TCB
  const app = tcb.init({
    env: CONFIG.envId,
    region: CONFIG.region
  })

  const db = app.database()

  try {
    // 创建集合
    for (const coll of collections) {
      console.log(`创建集合: ${coll.name}`)

      try {
        // 创建集合
        await db.createCollection(coll.name)
        console.log(`  ✓ 集合 ${coll.name} 创建成功`)
      } catch (err) {
        if (err.code === 'DATABASE_COLLECTION_ALREADY_EXISTS' ||
            err.message?.includes('already exists') ||
            err.message?.includes('集合已存在')) {
          console.log(`  ℹ 集合 ${coll.name} 已存在`)
        } else {
          console.log(`  ✗ 创建失败:`, err.message || err)
          continue
        }
      }

      // 创建索引
      if (coll.indexes) {
        for (const index of coll.indexes) {
          try {
            await db.collection(coll.name).createIndex({
              name: index.name,
              key: index.key,
              unique: index.unique || false
            })
            console.log(`  ✓ 索引 "${index.name}" 创建成功`)
          } catch (err) {
            if (err.code === 'DATABASE_INDEX_ALREADY_EXISTS' ||
                err.message?.includes('already exists') ||
                err.message?.includes('索引已存在')) {
              console.log(`  ℹ 索引 "${index.name}" 已存在`)
            } else {
              console.log(`  ✗ 索引 "${index.name}" 创建失败:`, err.message || err)
            }
          }
        }
      }

      // 设置过期时间（TTL索引）
      if (coll.expire) {
        try {
          await db.collection(coll.name).createIndex({
            name: 'expire_at_idx',
            key: { createdAt: 1 },
            expireAfterSeconds: coll.expire
          })
          console.log(`  ✓ TTL 索引创建成功（${coll.expire}秒后过期）`)
        } catch (err) {
          if (err.code === 'DATABASE_INDEX_ALREADY_EXISTS' ||
              err.message?.includes('already exists') ||
              err.message?.includes('索引已存在')) {
            console.log(`  ℹ TTL 索引已存在`)
          } else {
            console.log(`  ✗ TTL 索引创建失败:`, err.message || err)
          }
        }
      }

      console.log('')
    }

    console.log('========================================')
    console.log('数据库初始化完成!')
    console.log('========================================')
    console.log('\n请记得：')
    console.log('1. 修改 cloudfunctions/config/index.js 中的管理员OpenID')
    console.log('2. 在微信开发者工具中部署云函数')
    console.log('3. 在小程序后台配置模板消息')

  } catch (error) {
    console.error('初始化失败:', error)
    process.exit(1)
  }
}

// 执行初始化
initDatabase()
