// cloudfunctions/need/getNeedDetail/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, utils } = require('./config')

exports.main = async (event, context) => {
  const { needId } = event
  const db = cloud.database()
  const wxContext = cloud.getWXContext()

  try {
    // 获取需求详情
    const need = await db.collection('needs').doc(needId).get()
    
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    // 检查权限（只有求助者和帮助者可以查看）
    if (needData.seekerOpenid !== wxContext.OPENID && 
        needData.helperOpenid !== wxContext.OPENID) {
      return response.error('无权查看', 403)
    }

    // 获取求助者信息（使用 where 查询代替 doc+field，兼容性更好）
    const seekerResult = await db.collection('users')
      .where({ _id: needData.seekerId })
      .limit(1)
      .get()
    const seeker = seekerResult.data && seekerResult.data.length > 0 ? seekerResult.data[0] : null

    // 获取帮助者信息（如果有）
    let helper = null
    if (needData.helperId) {
      const helperResult = await db.collection('users')
        .where({ _id: needData.helperId })
        .limit(1)
        .get()
      helper = helperResult.data && helperResult.data.length > 0 ? helperResult.data[0] : null
    }

    // 获取匹配信息
    let matchInfo = null
    if (needData.helperId) {
      const match = await db.collection('matches').where({
        needId: needId,
        helperId: needData.helperId
      }).get()
      if (match.data.length > 0) {
        matchInfo = {
          distance: match.data[0].distance,
          typeMatch: match.data[0].typeMatch
        }
      }
    }

    // 获取消息数
    const messageCount = await db.collection('messages').where({
      needId: needId
    }).count()

    // 状态名称映射
    const statusNameMap = {
      'matching': '待匹配',
      'executing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    }

    // 计算总悬赏积分（初始悬赏 + 追加悬赏）
    // 注意：即使需求取消，也保持原始悬赏金额显示，不改变points/bonusPoints字段
    const totalBounty = (needData.points || 0) + (needData.bonusPoints || 0)

    console.log('需求详情 - needId:', needId, 'status:', needData.status)
    console.log('location数据:', JSON.stringify(needData.location))

    // 组合 location 数据（兼容旧数据和新的分离结构）
    const locationData = needData.location || {}
    const locationInfo = needData.locationInfo || {}
    const combinedLocation = {
      ...locationData,
      name: locationInfo.name || locationData.name || '未知位置',
      address: locationInfo.address || locationData.address || ''
    }

    return response.success({
      ...needData,
      location: combinedLocation,
      statusName: statusNameMap[needData.status] || '未知状态',
      bounty: totalBounty, // 总悬赏积分（兼容前端显示，保持原始值不变）
      originalPoints: needData.points, // 保留原始字段供调试
      originalBonusPoints: needData.bonusPoints,
      seekerInfo: seeker ? {
        nickname: seeker.nickname,
        avatar: seeker.avatar,
        seekerInfo: seeker.seekerInfo
      } : null,
      helperInfo: helper,
      matchInfo: matchInfo,
      messageCount: messageCount.total,
      canComplete: needData.status === 'executing' && needData.seekerOpenid === wxContext.OPENID,
      canCancel: ['matching', 'executing'].includes(needData.status) && needData.seekerOpenid === wxContext.OPENID,
      timeLeft: needData.deadline ? Math.max(0, new Date(needData.deadline) - new Date()) : null
    })

  } catch (error) {
    console.error('获取需求详情失败:', error)
    return response.error('获取失败', -1, error)
  }
}
