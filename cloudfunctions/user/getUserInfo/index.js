// cloudfunctions/user/getUserInfo/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response } = require('./config')

exports.main = async (event, context) => {
  const db = cloud.database()
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 获取当前登录用户信息
    const user = await db.collection('users').where({
      openid: openid
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    // 检查是否被封禁
    if (userData.isBanned) {
      return response.error('账号已被封禁', 403)
    }

    // 获取统计数据
    const stats = await getUserStats(db, userData._id)

    // 返回用户信息（去除敏感字段）
    const safeUserData = {
      _id: userData._id,
      openid: userData.openid,
      nickname: userData.nickname,
      avatar: userData.avatar,
      gender: userData.gender,
      role: userData.role,
      phone: userData.phone ? userData.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
      isPhoneVerified: userData.isPhoneVerified,
      points: userData.points,
      helperInfo: userData.helperInfo,
      seekerInfo: userData.seekerInfo,
      pointsStats: userData.pointsStats,
      settings: userData.settings,
      isAdmin: userData.isAdmin,
      adminRole: userData.adminRole,
      createdAt: userData.createdAt,
      stats: stats
    }

    return response.success(safeUserData, '获取成功')

  } catch (error) {
    console.error('获取用户信息失败:', error)
    return response.error('获取失败', -1, error)
  }
}

// 获取用户统计数据
async function getUserStats(db, userId) {
  try {
    // 本月签到天数
    const currentDate = new Date()
    const signInRes = await db.collection('sign_in_records').where({
      userId: userId,
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    }).get()

    const monthlySignInDays = signInRes.data.length > 0 ? signInRes.data[0].totalDays : 0

    // 本周完成任务数
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const completedTasksRes = await db.collection('needs').where({
      helperId: userId,
      status: 'completed',
      completedAt: db.command.gte(weekAgo)
    }).count()

    // 待处理消息数
    const unreadMessagesRes = await db.collection('messages').where({
      receiverId: userId,
      isRead: false
    }).count()

    return {
      monthlySignInDays,
      weeklyCompletedTasks: completedTasksRes.total,
      unreadMessages: unreadMessagesRes.total
    }

  } catch (error) {
    console.error('获取统计数据失败:', error)
    return {
      monthlySignInDays: 0,
      weeklyCompletedTasks: 0,
      unreadMessages: 0
    }
  }
}
