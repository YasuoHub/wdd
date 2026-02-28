// cloudfunctions/points/checkSignIn/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response } = require('./config')

exports.main = async (event, context) => {
  const db = cloud.database()
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

    const hasSigned = todayRecord.data.length > 0

    // 计算今日应得积分
    let todayReward = CONFIG.points.SIGN_IN.BASE
    const streak = userData.pointsStats.signInStreak || 0
    if (streak >= 30) todayReward = CONFIG.points.SIGN_IN.STREAK_30
    else if (streak >= 7) todayReward = CONFIG.points.SIGN_IN.STREAK_7

    // 获取本月签到记录
    const monthRecord = await db.collection('sign_in_records').where({
      userId: userData._id,
      year: year,
      month: month
    }).get()

    const monthlyDays = monthRecord.data.length > 0 ? monthRecord.data[0].totalDays : 0

    return response.success({
      hasSigned: hasSigned,
      streak: streak,
      todayReward: todayReward,
      monthlyDays: monthlyDays,
      year: year,
      month: month
    })

  } catch (error) {
    console.error('检查签到状态失败:', error)
    return response.error('检查失败', -1, error)
  }
}
