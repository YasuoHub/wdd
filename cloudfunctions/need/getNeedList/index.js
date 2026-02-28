// cloudfunctions/need/getNeedList/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, utils } = require('./config')

exports.main = async (event, context) => {
  const { status, type, role = 'seeker', page = 1, pageSize = 20 } = event
  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()

  try {
    const { skip } = utils.pagination({ page, pageSize })

    // 构建查询条件
    let where = {}
    
    if (role === 'helper') {
      // 帮助者查询自己的任务
      where.helperOpenid = wxContext.OPENID
    } else {
      // 求助者查询自己的需求
      where.seekerOpenid = wxContext.OPENID
    }

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    // 查询总数
    const countResult = await db.collection('needs').where(where).count()
    const total = countResult.total

    // 查询列表
    const listResult = await db.collection('needs')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    // 处理数据
    const list = listResult.data.map(item => ({
      _id: item._id,
      needNo: item.needNo,
      type: item.type,
      typeName: item.typeName,
      location: item.location,
      points: item.points,
      status: item.status,
      statusText: getStatusText(item.status),
      helperInfo: item.helperId ? {
        nickname: '', // 需要查询
        distance: 0   // 需要计算
      } : null,
      createdAt: item.createdAt,
      formattedTime: utils.formatTime(item.createdAt, 'MM-DD HH:mm')
    }))

    // 获取帮助者信息（如果有）
    for (let item of list) {
      if (item.helperId) {
        const helper = await db.collection('users').doc(item.helperId).field({
          nickname: true,
          avatar: true
        }).get()
        if (helper.data) {
          item.helperInfo = {
            nickname: helper.data.nickname,
            avatar: helper.data.avatar
          }
        }
      }
    }

    return response.page(list, {
      page,
      pageSize,
      total
    })

  } catch (error) {
    console.error('获取需求列表失败:', error)
    return response.error('获取失败', -1, error)
  }
}

function getStatusText(status) {
  const statusMap = {
    'pending': '待支付',
    'matching': '匹配中',
    'executing': '进行中',
    'completed': '已完成',
    'cancelled': '已取消',
    'disputed': '纠纷中'
  }
  return statusMap[status] || status
}
