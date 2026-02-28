// cloudfunctions/match/rejectTask/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response } = require('./config')

exports.main = async (event, context) => {
  const { needId, reason } = event
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

    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    if (needData.helperId !== userData._id) {
      return response.error('无权操作该任务', 403)
    }

    if (needData.status !== 'executing') {
      return response.error('当前状态不允许拒绝', 1002)
    }

    await db.collection('needs').doc(needId).update({
      data: {
        status: 'matching',
        helperId: '',
        helperInfo: null,
        matchedAt: null,
        rejectReason: reason || '帮助者放弃',
        updatedAt: db.serverDate()
      }
    })

    await db.collection('users').doc(userData._id).update({
      data: {
        'helperInfo.cancelledTasks': db.command.inc(1),
        updatedAt: db.serverDate()
      }
    })

    return response.success(null, '已放弃任务')

  } catch (error) {
    console.error('拒绝任务失败:', error)
    return response.error('操作失败', -1, error)
  }
}