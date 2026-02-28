/**
 * 积分服务
 */

const request = require('../utils/request')

module.exports = {
  /**
   * 获取积分余额
   */
  getBalance() {
    return request.callFunction('points_getBalance')
  },

  /**
   * 每日签到
   */
  signIn() {
    return request.callFunction('points_signIn')
  },

  /**
   * 检查签到状态
   */
  checkSignIn() {
    return request.callFunction('points_checkSignIn')
  },

  /**
   * 获取积分记录
   * @param {object} params 参数
   */
  getRecords(params = {}) {
    return request.callFunction('points_getRecords', {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      type: params.type || ''
    })
  },

  /**
   * 获取邀请记录
   */
  getInviteRecords() {
    return request.callFunction('points_getInviteRecords')
  }
}
