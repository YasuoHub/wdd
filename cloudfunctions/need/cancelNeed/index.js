// cloudfunctions/need/cancelNeed/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, CONFIG } = require('./config')

exports.main = async (event, context) => {
  const { needId } = event
  const db = cloud.database()
  const _ = db.command
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

    if (needData.seekerId !== userData._id) {
      return response.error('无权操作该需求', 403)
    }

    if (needData.status !== 'matching' && needData.status !== 'executing') {
      return response.error('当前状态不允许取消', 1002)
    }

    const session = await db.startTransaction()

    try {
      await session.collection('needs').doc(needId).update({
        data: {
          status: 'cancelled',
          cancelledAt: db.serverDate(),
          cancelReason: event.reason || '用户主动取消',
          updatedAt: db.serverDate()
        }
      })

      const totalPoints = needData.points + (needData.bonusPoints || 0)
      // 取消需求：解冻积分，从 frozen 转回 balance
      // 发布时: balance -10, frozen +10
      // 取消时: balance +10, frozen -10 (总额不变)
      await session.collection('users').doc(userData._id).update({
        data: {
          'points.balance': _.inc(totalPoints),
          'points.frozen': _.inc(-totalPoints),
          updatedAt: db.serverDate()
        }
      })

      // 记录积分变动（取消解冻：frozen 转回 balance）
      const newBalance = userData.points.balance + totalPoints
      const newFrozen = userData.points.frozen - totalPoints
      await session.collection('points_records').add({
        data: {
          userId: userData._id,
          type: 'cancel_refund',
          amount: totalPoints,
          balance: newBalance,
          frozen: newFrozen,
          relatedId: needId,
          relatedType: 'need',
          description: '取消需求返还积分',
          createdAt: db.serverDate()
        }
      })

      await session.commit()

      return response.success({
        returnedPoints: totalPoints
      }, '取消成功')

    } catch (err) {
      await session.rollback()
      throw err
    }

  } catch (error) {
    console.error('取消需求失败:', error)
    return response.error('取消失败', -1, error)
  }
}