// cloudfunctions/settlement/autoSettlement/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG } = require('./config')

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command

  try {
    // 查找超过24小时未自动结算的执行中需求
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const needs = await db.collection('needs').where({
      status: 'executing',
      acceptedAt: _.lt(twentyFourHoursAgo),
      pointsStatus: 'paid',
      'support.isInvolved': false
    }).get()

    console.log(`找到 ${needs.data.length} 个待自动结算需求`)

    for (const need of needs.data) {
      try {
        await settleNeed(db, need)
      } catch (error) {
        console.error(`结算需求 ${need._id} 失败:`, error)
      }
    }

    return {
      code: 0,
      message: '自动结算完成',
      data: { processedCount: needs.data.length }
    }

  } catch (error) {
    console.error('自动结算失败:', error)
    return {
      code: -1,
      message: '自动结算失败',
      error: error.message
    }
  }
}

async function settleNeed(db, need) {
  const _ = db.command

  const transaction = await db.startTransaction()

  try {
    // 1. 解冻求助者积分
    await transaction.collection('users').doc(need.seekerId).update({
      data: {
        'points.frozen': _.inc(-need.points),
        'seekerInfo.completedRequests': _.inc(1),
        updatedAt: db.serverDate()
      }
    })

    // 2. 帮助者获得积分
    await transaction.collection('users').doc(need.helperId).update({
      data: {
        'points.balance': _.inc(need.points),
        'points.totalEarned': _.inc(need.points),
        'helperInfo.completedTasks': _.inc(1),
        updatedAt: db.serverDate()
      }
    })

    // 3. 记录积分变动
    await transaction.collection('points_records').add({
      data: {
        userId: need.helperId,
        type: 'task_reward',
        amount: need.points,
        relatedId: need._id,
        relatedType: 'need',
        description: '自动结算任务奖励',
        createdAt: db.serverDate()
      }
    })

    // 4. 更新需求状态
    await transaction.collection('needs').doc(need._id).update({
      data: {
        status: 'completed',
        completedAt: db.serverDate(),
        'review.seekerToHelper': {
          rating: 5,
          content: '系统自动好评',
          images: [],
          createdAt: db.serverDate()
        },
        updatedAt: db.serverDate()
      }
    })

    await transaction.commit()

    // 发送通知
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: need.helperOpenid,
        templateId: CONFIG.templates.points,
        data: {
          thing1: { value: '任务自动结算' },
          amount2: { value: need.points + '积分' },
          time3: { value: new Date().toLocaleString() }
        }
      })
    } catch (err) {
      console.log('发送通知失败:', err)
    }

    console.log(`需求 ${need._id} 自动结算完成`)

  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
