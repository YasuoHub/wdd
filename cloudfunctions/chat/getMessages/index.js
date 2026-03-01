// cloudfunctions/chat/getMessages/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, utils } = require('./config')

exports.main = async (event, context) => {
  const { needId, page = 1, pageSize = 20, lastId = '' } = event
  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()

  try {
    if (!needId) {
      return response.error('需求ID不能为空', 1001)
    }

    // 获取用户信息
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    // 获取需求信息
    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    // 检查权限
    if (needData.seekerId !== userData._id && needData.helperId !== userData._id) {
      return response.error('无权查看', 403)
    }

    // 构建查询
    let query = db.collection('messages').where({
      needId: needId
    })

    // 如果有lastId，查询该ID之后的消息（用于实时更新）
    if (lastId) {
      const lastMessage = await db.collection('messages').doc(lastId).get()
      if (lastMessage.data) {
        query = query.where({
          createdAt: _.gt(lastMessage.data.createdAt)
        })
      }
    }

    // 分页查询
    const { skip } = utils.pagination({ page, pageSize })

    const result = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    // 获取发送者信息（移除 .field()，使用完整查询）
    const userIds = [...new Set(result.data.map(m => m.senderId))]
    const users = await db.collection('users')
      .where({
        _id: _.in(userIds)
      })
      .get()

    const userMap = {}
    users.data.forEach(u => {
      userMap[u._id] = u
    })

    // 处理消息列表
    const messages = result.data.map(msg => ({
      ...msg,
      isMe: msg.senderId === userData._id,
      senderInfo: userMap[msg.senderId] || {},
      formattedTime: utils.formatTime(msg.createdAt, 'HH:mm')
    })).reverse() // 正序排列

    // 标记对方消息为已读
    await db.collection('messages').where({
      needId: needId,
      receiverId: userData._id,
      isRead: false
    }).update({
      data: {
        isRead: true,
        readAt: db.serverDate()
      }
    })

    return response.success({
      messages: messages,
      hasMore: messages.length === pageSize
    })

  } catch (error) {
    console.error('获取消息失败:', error)
    return response.error('获取失败', -1, error)
  }
}
