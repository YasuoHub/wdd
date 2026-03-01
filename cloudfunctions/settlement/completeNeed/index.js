// cloudfunctions/settlement/completeNeed/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response } = require('./config')

exports.main = async (event, context) => {
  const { needId, rating, reviewContent, reviewImages } = event
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

    const userData = user.data[0]

    // 获取需求信息
    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    // 计算总积分（初始悬赏 + 追加悬赏）
    const totalPoints = (needData.points || 0) + (needData.bonusPoints || 0)

    // 检查权限
    if (needData.seekerId !== userData._id) {
      return response.error('无权操作', 403)
    }

    // 检查状态
    if (needData.status !== 'executing') {
      return response.error('任务不在执行中状态', 1001)
    }

    // 获取帮助者当前积分（用于计算新余额）
    const helper = await db.collection('users').doc(needData.helperId).get()
    const helperData = helper.data
    const helperCurrentBalance = helperData.points?.balance || 0
    const helperCurrentFrozen = helperData.points?.frozen || 0

    // 计算奖励积分（基于总悬赏）
    let totalReward = totalPoints
    let bonusPoints = 0

    // 好评额外5%奖励
    if (rating >= 4) {
      bonusPoints = Math.ceil(totalPoints * CONFIG.points.BONUS_RATE)
      totalReward += bonusPoints
    }

    // 使用事务
    const transaction = await db.startTransaction()

    try {
      // 1. 解冻求助者积分（解冻总悬赏积分）
      await transaction.collection('users').doc(needData.seekerId).update({
        data: {
          'points.frozen': _.inc(-totalPoints),
          'seekerInfo.completedRequests': _.inc(1),
          updatedAt: db.serverDate()
        }
      })

      // 2. 帮助者获得积分
      await transaction.collection('users').doc(needData.helperId).update({
        data: {
          'points.balance': _.inc(totalReward),
          'helperInfo.completedTasks': _.inc(1),
          'helperInfo.rating': db.command.set(
            db.command.divide([
              db.command.add([
                db.command.multiply(['$helperInfo.rating', '$helperInfo.completedTasks']),
                rating
              ]),
              db.command.add(['$helperInfo.completedTasks', 1])
            ])
          ),
          updatedAt: db.serverDate()
        }
      })

      // 计算帮助者新余额
      const newHelperBalance = helperCurrentBalance + totalReward

      // 3. 记录积分变动 - 任务奖励
      await transaction.collection('points_records').add({
        data: {
          userId: needData.helperId,
          type: 'task_reward',
          amount: totalPoints,
          balance: newHelperBalance - bonusPoints, // 扣除好评奖励前的余额
          frozen: helperCurrentFrozen,
          relatedId: needId,
          relatedType: 'need',
          description: `完成任务-${needData.typeName}`,
          createdAt: db.serverDate()
        }
      })

      // 4. 记录好评奖励（如果有）
      if (bonusPoints > 0) {
        await transaction.collection('points_records').add({
          data: {
            userId: needData.helperId,
            type: 'task_bonus',
            amount: bonusPoints,
            balance: newHelperBalance,
            frozen: helperCurrentFrozen,
            relatedId: needId,
            relatedType: 'need',
            description: '好评额外奖励',
            extra: { rating: rating },
            createdAt: db.serverDate()
          }
        })
      }

      // 5. 更新需求状态
      await transaction.collection('needs').doc(needId).update({
        data: {
          status: 'completed',
          completedAt: db.serverDate(),
          'review.seekerToHelper': {
            rating: rating,
            content: reviewContent || '',
            images: reviewImages || [],
            createdAt: db.serverDate()
          },
          updatedAt: db.serverDate()
        }
      })

      await transaction.commit()

      // 发送到账通知
      await cloud.openapi.subscribeMessage.send({
        touser: needData.helperOpenid,
        templateId: CONFIG.templates.points,
        data: {
          thing1: { value: '任务完成结算' },
          amount2: { value: totalReward + '积分' },
          time3: { value: new Date().toLocaleString() }
        }
      })

      return response.success({
        reward: needData.points,
        bonus: bonusPoints,
        total: totalReward,
        message: `结算成功，帮助者获得${totalReward}积分`
      })

    } catch (error) {
      await transaction.rollback()
      throw error
    }

  } catch (error) {
    console.error('结算失败:', error)
    return response.error('结算失败', -1, error)
  }
}
