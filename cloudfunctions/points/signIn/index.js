// cloudfunctions/points/signIn/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response, utils } = require('./config')

exports.main = async (event, context) => {
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
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const day = today.getDate()

    // 检查今日是否已签到
    const todayRecord = await db.collection('sign_in_records').where({
      userId: userData._id,
      year: year,
      month: month,
      days: day
    }).get()

    if (todayRecord.data.length > 0) {
      return response.error('今日已签到', 1001)
    }

    // 计算连续签到天数
    let newStreak = 1
    const lastSignIn = userData.pointsStats.lastSignIn

    if (lastSignIn) {
      const lastDate = new Date(lastSignIn)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      if (lastDate.toDateString() === yesterday.toDateString()) {
        newStreak = (userData.pointsStats.signInStreak || 0) + 1
      }
    }

    // 计算签到积分
    let points = CONFIG.points.SIGN_IN.BASE
    if (newStreak >= 30) {
      points = CONFIG.points.SIGN_IN.STREAK_30
    } else if (newStreak >= 7) {
      points = CONFIG.points.SIGN_IN.STREAK_7
    }

    // 更新或创建签到记录
    const monthRecord = await db.collection('sign_in_records').where({
      userId: userData._id,
      year: year,
      month: month
    }).get()

    if (monthRecord.data.length === 0) {
      await db.collection('sign_in_records').add({
        data: {
          userId: userData._id,
          year: year,
          month: month,
          days: [day],
          totalDays: 1,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
    } else {
      await db.collection('sign_in_records').doc(monthRecord.data[0]._id).update({
        data: {
          days: _.push(day),
          totalDays: _.inc(1),
          updatedAt: db.serverDate()
        }
      })
    }

    // 增加用户积分
    const newBalance = userData.points.balance + points
    await db.collection('users').doc(userData._id).update({
      data: {
        'points.balance': _.inc(points),
        'pointsStats.signInStreak': newStreak,
        'pointsStats.lastSignIn': db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    // 记录积分变动
    await db.collection('points_records').add({
      data: {
        userId: userData._id,
        type: 'sign_in',
        amount: points,
        balance: newBalance,
        extra: {
          streak: newStreak,
          year: year,
          month: month,
          day: day
        },
        description: `连续签到${newStreak}天奖励`,
        createdAt: db.serverDate()
      }
    })

    // 发送签到成功通知
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: userData.openid,
        templateId: CONFIG.templates.signIn,
        data: {
          thing1: { value: '签到成功' },
          time2: { value: utils.formatTime(new Date()) },
          thing3: { value: `恭喜获得${points}积分，连续签到${newStreak}天！` }
        }
      })
    } catch (err) {
      console.log('发送签到通知失败:', err)
    }

    return response.success({
      points: points,
      streak: newStreak,
      balance: newBalance,
      message: `连续签到${newStreak}天，获得${points}积分！`
    }, '签到成功')

  } catch (error) {
    console.error('签到失败:', error)
    return response.error('签到失败', -1, error)
  }
}
