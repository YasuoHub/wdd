// cloudfunctions/config/index.js
// 全局配置云函数 - 提供配置查询接口

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CONFIG = {
  // 环境配置
  env: {
    id: 'wdd-2grpiy1r6f9f4cf2',
    region: 'ap-guangzhou'
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

  // 业务规则配置
  business: {
    AUTO_SETTLEMENT_HOURS: 24,
    MIN_POINTS_PUBLISH: 10,
    MAX_MATCH_NOTIFY: 3,
    MATCH_TIMEOUT_MINUTES: 30,
    NEED_MODIFY_LIMIT: 2,
    MAX_MESSAGE_LENGTH: 500,
    MAX_IMAGE_SIZE: 10485760
  }
}

exports.main = async (event, context) => {
  const { type } = event
  
  try {
    switch (type) {
      case 'points':
        return {
          code: 0,
          message: '获取成功',
          data: CONFIG.points
        }
      case 'business':
        return {
          code: 0,
          message: '获取成功',
          data: CONFIG.business
        }
      default:
        return {
          code: 0,
          message: '获取成功',
          data: {
            points: CONFIG.points,
            business: CONFIG.business
          }
        }
    }
  } catch (error) {
    return {
      code: -1,
      message: '获取配置失败',
      error: error.message
    }
  }
}