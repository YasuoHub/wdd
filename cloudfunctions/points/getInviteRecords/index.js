// cloudfunctions/points/getInviteRecords/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, utils } = require('./config')

exports.main = async (event, context) => {
  const { page = 1, pageSize = 20 } = event
  const db = cloud.database()
  const wxContext = cloud.getWXContext()

  try {
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userId = user.data[0]._id
    const { skip, page: pageNum, pageSize: size } = utils.pagination({ page, pageSize })

    const totalRes = await db.collection('invite_records').where({
      inviterId: userId
    }).count()
    const total = totalRes.total

    const records = await db.collection('invite_records')
      .where({ inviterId: userId })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(size)
      .get()

    const formattedRecords = records.data.map(record => ({
      ...record,
      formattedTime: utils.formatTime(record.createdAt)
    }))

    // 生成6位邀请码（从用户ID中提取或生成随机码）
    const inviteCode = userId.slice(-6).toUpperCase()

    // 获取本月邀请数量
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    const monthlyInvites = records.data.filter(record => {
      const recordDate = new Date(record.createdAt)
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
    })

    return response.success({
      records: formattedRecords,
      totalReward: user.data[0].pointsStats.inviteCount * 50,
      totalCount: total,
      monthlyCount: monthlyInvites.length,
      monthlyLimit: 20,
      inviteCode: inviteCode,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: total,
        totalPages: Math.ceil(total / size)
      }
    }, '获取成功')

  } catch (error) {
    console.error('获取邀请记录失败:', error)
    return response.error('获取失败', -1, error)
  }
}