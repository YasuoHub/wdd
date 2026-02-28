/**
 * 聊天服务
 */

const request = require('../utils/request')

module.exports = {
  /**
   * 发送消息
   * @param {string} needId 需求ID
   * @param {string} type 消息类型
   * @param {string} content 内容
   * @param {object} extra 额外信息
   */
  sendMessage(needId, type, content, extra = {}) {
    return request.callFunction('chat_sendMessage', {
      needId,
      type,
      content,
      extra
    })
  },

  /**
   * 获取消息列表
   * @param {string} needId 需求ID
   * @param {object} params 参数
   */
  getMessages(needId, params = {}) {
    return request.callFunction('chat_getMessages', {
      needId,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      lastId: params.lastId || ''
    })
  },

  /**
   * 标记已读
   * @param {string} needId 需求ID
   */
  markRead(needId) {
    return request.callFunction('chat_markRead', { needId })
  }
}
