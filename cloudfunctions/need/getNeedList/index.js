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

    // 获取当前用户 OPENID
    const openid = wxContext.OPENID
    if (!openid) {
      return response.error('用户未登录', -2)
    }

    // 构建查询条件
    let where = {}

    if (role === 'helper') {
      // 帮助者查询自己的任务
      where.helperOpenid = openid
    } else {
      // 求助者查询自己的需求
      where.seekerOpenid = openid
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
    const list = listResult.data.map(item => {
      // 组合 location 数据（兼容旧数据和新的分离结构）
      const locationData = item.location || {}
      const locationInfo = item.locationInfo || {}
      const combinedLocation = {
        ...locationData,
        name: locationInfo.name || locationData.name || '未知位置',
        address: locationInfo.address || locationData.address || ''
      }

      return {
        _id: item._id,
        needNo: item.needNo,
        type: item.type,
        typeName: item.typeName,
        location: combinedLocation,
        points: item.points,
        bonusPoints: item.bonusPoints || 0,
        bounty: (item.points || 0) + (item.bonusPoints || 0), // 总悬赏积分
        status: item.status,
        statusText: getStatusText(item.status),
        helperId: item.helperId,
        helperOpenid: item.helperOpenid,
        helperInfo: item.helperId ? {
          nickname: '', // 需要查询
          distance: 0   // 需要计算
        } : null,
        createdAt: item.createdAt,
        formattedTime: utils.formatTime(item.createdAt, 'MM-DD HH:mm')
      }
    })

    // 获取帮助者信息（如果有）
    for (let item of list) {
      if (item.helperId && typeof item.helperId === 'string' && item.helperId.length === 24) {
        try {
          // 使用 where 查询代替 doc + field，兼容性更好
          const helperResult = await db.collection('users')
            .where({ _id: item.helperId })
            .limit(1)
            .get()
          if (helperResult.data && helperResult.data.length > 0) {
            const helper = helperResult.data[0]
            item.helperInfo = {
              nickname: helper.nickname || '',
              avatar: helper.avatar || ''
            }
          }
        } catch (err) {
          console.error(`获取帮助者信息失败, helperId: ${item.helperId}`, err)
          // 不阻塞主流程，继续处理
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
