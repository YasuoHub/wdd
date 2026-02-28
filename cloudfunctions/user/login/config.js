// cloudfunctions/config/index.js
// 全局配置文件

const CONFIG = {
  // 环境配置
  env: {
    id: 'wdd-2grpiy1r6f9f4cf2',
    region: 'ap-guangzhou'
  },

  // 管理员配置（需要修改为实际OpenID）
  admin: {
    openid: '123456',  // ⚠️ 请修改为实际管理员OpenID
    roles: ['super', 'support', 'operator'],
    permissions: {
      super: ['user_manage', 'need_manage', 'points_manage', 'support_handle', 'system_config'],
      support: ['support_handle', 'user_view', 'need_view'],
      operator: ['user_view', 'need_view', 'points_view']
    }
  },

  // 积分系统配置
  points: {
    NEW_USER: 100,
    COMPLETE_PROFILE: 30,
    SIGN_IN: {
      BASE: 5,
      STREAK_7: 10,
      STREAK_30: 20
    },
    INVITE: 50,
    MIN_PUBLISH: 10,
    BONUS_RATE: 0.05
  },

  // 防刷机制配置
  antiSpam: {
    deviceRegister: { max: 1, period: 86400000 },    // 1天
    ipPublish: { max: 3, period: 3600000 },          // 1小时
    inviteLimit: { max: 20, period: 2592000000 },    // 30天
    messageRate: { max: 30, period: 60000 },         // 1分钟
    loginAttempts: { max: 5, period: 600000 }        // 10分钟
  },

  // 模板消息ID
  templates: {
    match: 'Tt1s2ZZZ2E37RgomeB72-7qTdYBLJ8D0nJe06m_uMTI',
    points: 'IcjPTd6O7ggyNNn8fIMxrpMscKILYZtJwpZXV14_Uqo',
    signIn: 'm8090A6LOA_ZitbiDGOvF432keLBRGHpAjYF-djKmSA'
  },

  // 腾讯地图Key
  mapKey: 'LTXBZ-6QBEW-T7CRL-YCDUQ-WHXFK-GSFRJ',

  // 业务规则配置
  business: {
    AUTO_SETTLEMENT_HOURS: 24,  // 自动结算时间
    MIN_POINTS_PUBLISH: 10,     // 最低发布积分
    MAX_MATCH_NOTIFY: 3,        // 最多通知帮助者数
    MATCH_TIMEOUT_MINUTES: 30,  // 匹配超时时间
    NEED_MODIFY_LIMIT: 2,       // 需求修改次数限制
    MAX_MESSAGE_LENGTH: 500,    // 单条消息最大长度
    MAX_MESSAGE_RATE: 3,        // 每秒最大消息数
    MAX_IMAGE_SIZE: 10485760,   // 单张图片最大10MB
    MAX_IMAGES_PER_UPLOAD: 3,   // 单次最多上传图片数
    IMAGE_COMPRESS_WIDTH: 1080  // 图片压缩宽度
  },

  // 数据保留期限（天）
  retention: {
    messages: 90,
    completedNeeds: 1095,  // 3年
    pointsRecords: 1095,   // 3年
    images: 90,
    backups: 7
  },

  // 日志配置
  log: {
    level: 'info',  // debug, info, warn, error
    maxAge: 30      // 日志保留天数
  }
}

// 通用响应格式
const response = {
  success: (data = null, message = '操作成功') => ({
    code: 0,
    message,
    data,
    timestamp: Date.now()
  }),

  error: (message = '操作失败', code = -1, error = null) => ({
    code,
    message,
    error: error ? error.message || error : null,
    timestamp: Date.now()
  }),

  // 分页响应
  page: (list, pagination) => ({
    code: 0,
    message: '查询成功',
    data: {
      list,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.pageSize)
      }
    }
  })
}

// 工具函数
const utils = {
  // 生成订单号
  generateOrderNo: (prefix = 'N') => {
    const date = new Date()
    const dateStr = date.getFullYear() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0') +
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0')
    const random = Math.floor(Math.random() * 900000) + 100000
    return prefix + dateStr + random
  },

  // 计算两点距离（米）
  calculateDistance: (lat1, lng1, lat2, lng2) => {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  // 检查连续签到天数
  checkStreak: (lastSignIn) => {
    if (!lastSignIn) return 0
    const last = new Date(lastSignIn)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (last.toDateString() === today.toDateString()) {
      return -1  // 今日已签到
    } else if (last.toDateString() === yesterday.toDateString()) {
      return 1   // 连续签到
    } else {
      return 0   // 断签
    }
  },

  // 验证手机号
  validatePhone: (phone) => {
    return /^1[3-9]\d{9}$/.test(phone)
  },

  // 敏感词过滤（简化版）
  filterSensitiveWords: (text) => {
    const sensitiveWords = ['暴力', '色情', '赌博', '毒品', '诈骗']
    let filtered = text
    let hasSensitive = false

    sensitiveWords.forEach(word => {
      if (text.includes(word)) {
        hasSensitive = true
        filtered = filtered.replace(new RegExp(word, 'g'), '***')
      }
    })

    return { filtered, hasSensitive }
  },

  // 格式化时间
  formatTime: (date) => {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },

  // 分页参数处理
  pagination: (event) => {
    const page = Math.max(1, parseInt(event.page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize) || 20))
    return { page, pageSize, skip: (page - 1) * pageSize }
  }
}

module.exports = {
  CONFIG,
  response,
  utils
}