// config.js - 云函数配置文件

const CONFIG = {
  // 环境配置
  env: {
    id: 'wdd-2grpiy1r6f9f4cf2',
    region: 'ap-guangzhou'
  },

  // 腾讯地图Key
  mapKey: 'LTXBZ-6QBEW-T7CRL-YCDUQ-WHXFK-GSFRJ',

  // 日志配置
  log: {
    level: 'info',
    maxAge: 30
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
  })
}

module.exports = {
  CONFIG,
  response
}
