/**
 * 需求服务
 */

const request = require('../utils/request')

module.exports = {
  /**
   * 创建需求
   * @param {object} data 需求数据
   */
  createNeed(data) {
    return request.callFunction('need_createNeed', data)
  },

  /**
   * 获取需求列表
   * @param {object} params 参数
   */
  getNeedList(params = {}) {
    return request.callFunction('need_getNeedList', {
      status: params.status || '',
      type: params.type || '',
      role: params.role || 'seeker',
      page: params.page || 1,
      pageSize: params.pageSize || 20
    })
  },

  /**
   * 获取需求详情
   * @param {string} needId 需求ID
   */
  getNeedDetail(needId) {
    return request.callFunction('need_getNeedDetail', { needId })
  },

  /**
   * 取消需求
   * @param {string} needId 需求ID
   */
  cancelNeed(needId) {
    return request.callFunction('need_cancelNeed', { needId })
  },

  /**
   * 追加悬赏
   * @param {string} needId 需求ID
   * @param {number} points 积分数
   */
  appendPoints(needId, points) {
    return request.callFunction('need_appendPoints', { needId, points })
  },

  /**
   * 修改需求
   * @param {string} needId 需求ID
   * @param {object} data 修改数据
   */
  modifyNeed(needId, data) {
    return request.callFunction('need_modifyNeed', {
      needId,
      ...data
    })
  },

  /**
   * 确认完成
   * @param {string} needId 需求ID
   */
  completeNeed(needId) {
    return request.callFunction('settlement_completeNeed', { needId })
  }
}
