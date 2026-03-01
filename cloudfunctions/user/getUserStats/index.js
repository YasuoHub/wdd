// cloudfunctions/user/getUserStats/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response } = require('./config')

exports.main = async (event, context) => {
  const db = cloud.database()
  const wxContext = cloud.getWXContext()

  try {
    // 获取用户信息
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]
    const userId = userData._id

    // 统计发布的需求数量（所有状态）
    const needCountResult = await db.collection('needs').where({
      seekerId: userId
    }).count()

    // 统计完成的任务数量
    const completedTasksResult = await db.collection('needs').where({
      helperId: userId,
      status: 'completed'
    }).count()

    // 统计进行中的任务数量
    const ongoingTasksResult = await db.collection('needs').where({
      helperId: userId,
      status: 'executing'
    }).count()

    return response.success({
      needCount: needCountResult.total,           // 发布需求总数
      completedTasks: completedTasksResult.total, // 已完成任务数
      ongoingTasks: ongoingTasksResult.total,     // 进行中任务数
      totalTasks: completedTasksResult.total + ongoingTasksResult.total // 总任务数
    }, '获取成功')

  } catch (error) {
    console.error('获取用户统计失败:', error)
    return response.error('获取失败', -1, error)
  }
}
