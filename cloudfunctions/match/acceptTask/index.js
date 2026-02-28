// cloudfunctions/match/acceptTask/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response } = require('./config')

exports.main = async (event, context) => {
  const { needId } = event
  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()

  try {
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const helperData = user.data[0]

    // 获取需求信息
    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    // 检查需求状态
    if (needData.status !== 'matching') {
      return response.error('该任务已被其他人接单', 1001)
    }

    // 检查是否为自己发布的需求
    if (needData.seekerId === helperData._id) {
      return response.error('不能接自己的任务', 1002)
    }

    // 使用事务
    const transaction = await db.startTransaction()

    try {
      // 1. 更新匹配记录
      await transaction.collection('matches').where({
        needId: needId,
        helperId: helperData._id
      }).update({
        data: {
          status: 'accepted',
          respondedAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })

      // 2. 更新需求状态
      await transaction.collection('needs').doc(needId).update({
        data: {
          status: 'executing',
          helperId: helperData._id,
          helperOpenid: helperData.openid,
          acceptedAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })

      // 3. 拒绝其他匹配
      await transaction.collection('matches').where({
        needId: needId,
        helperId: _.neq(helperData._id),
        status: 'pending'
      }).update({
        data: {
          status: 'expired',
          updatedAt: db.serverDate()
        }
      })

      await transaction.commit()

      // 通知求助者
      await cloud.openapi.subscribeMessage.send({
        touser: needData.seekerOpenid,
        templateId: CONFIG.templates.match,
        data: {
          thing1: { value: '有人接单了' },
          thing2: { value: needData.typeName },
          amount3: { value: needData.points + '积分' },
          thing4: { value: `${helperData.nickname}已接单，快去沟通吧！` }
        }
      })

      return response.success({
        needId: needId,
        status: 'executing',
        message: '接单成功'
      })

    } catch (error) {
      await transaction.rollback()
      throw error
    }

  } catch (error) {
    console.error('接单失败:', error)
    return response.error('接单失败', -1, error)
  }
}
