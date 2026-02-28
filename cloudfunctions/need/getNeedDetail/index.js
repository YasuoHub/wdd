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

    // 获取求助者信息
    const seeker = await db.collection('users').doc(needData.seekerId).field({
      nickname: true,
      avatar: true,
      'seekerInfo.completedRequests': true
    }).get()

    // 获取帮助者信息（如果有）
    let helper = null
    if (needData.helperId) {
      const helperData = await db.collection('users').doc(needData.helperId).field({
        nickname: true,
        avatar: true,
        'helperInfo.rating': true,
        'helperInfo.completedTasks': true
      }).get()
      helper = helperData.data
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

    return response.success({
      ...needData,
      seekerInfo: seeker.data,
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
