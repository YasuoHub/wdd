// cloudfunctions/points/getRecords/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, utils } = require('./config')

exports.main = async (event, context) => {
  const { type, page = 1, pageSize = 20 } = event
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

    const userId = user.data[0]._id
    const { skip, page: pageNum, pageSize: size } = utils.pagination({ page, pageSize })

    let query = db.collection('points_records').where({
      userId: userId
    })

    // 根据类型筛选：income(收入)表示金额>0，expense(支出)表示金额<0
    if (type === 'income') {
      query = query.where({ amount: _.gt(0) })
    } else if (type === 'expense') {
      query = query.where({ amount: _.lt(0) })
    }

    const totalRes = await query.count()
    const total = totalRes.total

    const records = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(size)
      .get()

    const formattedRecords = records.data.map(record => ({
      ...record,
      formattedTime: utils.formatTime(record.createdAt),
      amountText: record.amount > 0 ? `+${record.amount}` : `${record.amount}`,
      isIncome: record.amount > 0
    }))

    return response.success({
      records: formattedRecords,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: total,
        totalPages: Math.ceil(total / size)
      }
    }, '获取成功')

  } catch (error) {
    console.error('获取积分记录失败:', error)
    return response.error('获取失败', -1, error)
  }
}