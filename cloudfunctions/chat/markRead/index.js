// cloudfunctions/chat/markRead/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response } = require('./config')

exports.main = async (event, context) => {
  const { needId } = event
  const db = cloud.database()
  const wxContext = cloud.getWXContext()

  try {
    if (!needId) {
      return response.error('需求ID不能为空', 1001)
    }

    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    const result = await db.collection('messages').where({
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
      markedCount: result.stats.updated
    }, '标记成功')

  } catch (error) {
    console.error('标记已读失败:', error)
    return response.error('标记失败', -1, error)
  }
}