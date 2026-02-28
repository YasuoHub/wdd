// cloudfunctions/need/appendPoints/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, CONFIG } = require('./config')

exports.main = async (event, context) => {
  const { needId, points } = event
  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()

  try {
    if (!needId) {
      return response.error('需求ID不能为空', 1001)
    }

    if (!points || points <= 0) {
      return response.error('追加积分必须大于0', 1002)
    }

    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    if (userData.points.balance < points) {
      return response.error('积分余额不足', 1003)
    }

    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    if (needData.seekerId !== userData._id) {
      return response.error('无权操作该需求', 403)
    }

    if (needData.status !== 'matching') {
      return response.error('只有匹配中的需求可以追加积分', 1004)
    }

    const session = await db.startTransaction()

    try {
      await session.collection('needs').doc(needId).update({
        data: {
          extraPoints: _.inc(points),
          totalBounty: _.inc(points),
          updatedAt: db.serverDate()
        }
      })

      await session.collection('users').doc(userData._id).update({
        data: {
          'points.balance': _.inc(-points),
          'points.frozen': _.inc(points),
          'points.totalSpent': _.inc(points),
          updatedAt: db.serverDate()
        }
      })

      await session.collection('points_records').add({
        data: {
          userId: userData._id,
          type: 'append_need',
          amount: -points,
          balance: userData.points.balance - points,
          relatedId: needId,
          relatedType: 'need',
          description: '追加悬赏积分',
          createdAt: db.serverDate()
        }
      })

      await session.commit()

      return response.success({
        appendedPoints: points,
        totalBounty: needData.totalBounty + points
      }, '追加成功')

    } catch (err) {
      await session.rollback()
      throw err
    }

  } catch (error) {
    console.error('追加积分失败:', error)
    return response.error('追加失败', -1, error)
  }
}