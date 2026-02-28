// cloudfunctions/points/getBalance/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response } = require('./config')

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

    // 获取最近7天的积分记录
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentRecords = await db.collection('points_records').where({
      userId: userData._id,
      createdAt: db.command.gte(weekAgo)
    }).orderBy('createdAt', 'desc').limit(7).get()

    // 计算7天内获得和消耗的积分
    let earnedInWeek = 0
    let spentInWeek = 0

    recentRecords.data.forEach(record => {
      if (record.amount > 0) {
        earnedInWeek += record.amount
      } else {
        spentInWeek += Math.abs(record.amount)
      }
    })

    // 安全获取积分数据（兼容旧数据）
    const points = userData.points || {}
    const balance = points.balance || 0
    const frozen = points.frozen || 0

    return response.success({
      balance: balance,
      frozen: frozen,
      available: balance - frozen,
      totalEarned: points.totalEarned || 0,
      totalSpent: points.totalSpent || 0,
      earnedInWeek: earnedInWeek,
      spentInWeek: spentInWeek,
      lastUpdated: userData.updatedAt
    }, '获取成功')

  } catch (error) {
    console.error('获取积分余额失败:', error)
    return response.error('获取失败', -1, error)
  }
}
