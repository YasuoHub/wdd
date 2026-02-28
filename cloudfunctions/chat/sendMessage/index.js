// cloudfunctions/chat/sendMessage/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response, utils } = require('./config')

exports.main = async (event, context) => {
  const { needId, type, content, extra = {} } = event
  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()

  try {
    // 参数验证
    if (!needId || !type || !content) {
      return response.error('参数不完整', 1001)
    }

    // 验证消息类型
    if (!['text', 'image', 'voice'].includes(type)) {
      return response.error('不支持的消息类型', 1002)
    }

    // 验证文字长度
    if (type === 'text' && content.length > CONFIG.business.MAX_MESSAGE_LENGTH) {
      return response.error(`消息不能超过${CONFIG.business.MAX_MESSAGE_LENGTH}字`, 1003)
    }

    // 获取用户信息
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    // 防刷检查：消息频率
    const recentMessages = await db.collection('messages').where({
      senderId: userData._id,
      createdAt: _.gte(new Date(Date.now() - 60000))
    }).count()

    if (recentMessages.total >= CONFIG.business.MAX_MESSAGE_RATE) {
      return response.error('发送消息过于频繁，请稍后再试', 1004)
    }

    // 获取需求信息
    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    // 检查权限
    if (needData.seekerId !== userData._id && needData.helperId !== userData._id) {
      return response.error('无权发送消息', 403)
    }

    // 检查需求状态
    if (!['executing', 'completed'].includes(needData.status)) {
      return response.error('当前状态不能发送消息', 1005)
    }

    // 确定接收者
    const isSeeker = needData.seekerId === userData._id
    const receiverId = isSeeker ? needData.helperId : needData.seekerId
    const receiverOpenid = isSeeker ? needData.helperOpenid : needData.seekerOpenid

    if (!receiverId) {
      return response.error('对方尚未接单', 1006)
    }

    // 敏感词过滤
    if (type === 'text') {
      const { filtered, hasSensitive } = utils.filterSensitiveWords(content)
      if (hasSensitive) {
        return response.error('消息包含敏感词', 1007)
      }
    }

    // 创建消息
    const messageData = {
      needId: needId,
      senderId: userData._id,
      senderRole: isSeeker ? 'seeker' : 'helper',
      receiverId: receiverId,
      receiverRole: isSeeker ? 'helper' : 'seeker',
      type: type,
      content: content,
      extra: extra,
      isRead: false,
      readAt: null,
      isRecalled: false,
      recalledAt: null,
      createdAt: db.serverDate()
    }

    const result = await db.collection('messages').add({
      data: messageData
    })

    // 发送推送通知
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: receiverOpenid,
        templateId: CONFIG.templates.match,
        data: {
          thing1: { value: '收到新消息' },
          thing2: { value: needData.typeName },
          amount3: { value: '' },
          thing4: { value: type === 'text' ? content.substring(0, 20) : '[图片]' }
        }
      })
    } catch (err) {
      console.log('发送通知失败:', err)
    }

    return response.success({
      messageId: result._id,
      ...messageData
    }, '发送成功')

  } catch (error) {
    console.error('发送消息失败:', error)
    return response.error('发送失败', -1, error)
  }
}
