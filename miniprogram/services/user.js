/**
 * 用户服务
 */

const request = require('../utils/request')
const util = require('../utils/util')

module.exports = {
  /**
   * 登录
   * @param {object} userInfo 用户信息
   * @param {string} inviteCode 邀请码
   */
  login(userInfo, inviteCode = '') {
    const deviceId = util.getDeviceId()
    return request.callFunction('user_login', {
      userInfo,
      inviteCode,
      deviceId
    })
  },

  /**
   * 获取用户信息
   */
  getUserInfo() {
    return request.callFunction('user_getUserInfo')
  },

  /**
   * 完善信息
   * @param {object} data 信息数据
   */
  completeProfile(data) {
    return request.callFunction('user_completeProfile', data)
  },

  /**
   * 更新设置
   * @param {object} settings 设置项
   */
  updateSettings(settings) {
    return request.callFunction('user_updateSettings', { settings })
  },

  /**
   * 更新用户当前位置
   * @param {object} location 位置信息 {longitude, latitude}
   */
  updateLocation(location) {
    return request.callFunction('user_updateLocation', {
      longitude: location.longitude,
      latitude: location.latitude
    })
  },

  /**
   * 获取用户统计数据（发布需求数、完成任务数等）
   */
  getUserStats() {
    return request.callFunction('user_getUserStats')
  }
}
