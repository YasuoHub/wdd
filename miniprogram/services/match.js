/*
 * 匹配服务
 */

const request = require('../utils/request')

module.exports = {
  /**
   * 查找帮助者
   * @param {string} needId 需求ID
   */
  findHelpers(needId) {
    return request.callFunction('match_findHelpers', { needId })
  },

  /**
   * 接受任务
   * @param {string} needId 需求ID
   */
  acceptTask(needId) {
    return request.callFunction('match_acceptTask', { needId })
  },

  /**
   * 拒绝任务
   * @param {string} needId 需求ID
   * @param {string} reason 原因
   */
  rejectTask(needId, reason) {
    return request.callFunction('match_rejectTask', { needId, reason })
  },

  /**
   * 获取任务列表
   * @param {object} params 参数
   */
  getTaskList(params = {}) {
    return request.callFunction('match_getTaskList', {
      longitude: params.longitude,
      latitude: params.latitude,
      type: params.type || 'nearby',
      status: params.status || '',
      page: params.page || 1,
      pageSize: params.pageSize || 20
    })
  }
}
