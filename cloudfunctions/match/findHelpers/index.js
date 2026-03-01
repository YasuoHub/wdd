// cloudfunctions/match/findHelpers/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response, utils } = require('./config')

exports.main = async (event, context) => {
  const { needId } = event
  const db = cloud.database()
  const _ = db.command

  try {
    // 获取需求信息
    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    // 检查需求状态
    if (needData.status !== 'matching') {
      return response.error('需求不在匹配状态', 1001)
    }

    // 查找符合条件的帮助者
    const helpers = await db.collection('users').where({
      role: _.in(['helper', 'both']),
      'helperInfo.isAvailable': true,
      isBanned: false,
      _id: _.neq(needData.seekerId) // 排除求助者自己
    }).get()

    // 计算匹配得分
    const matches = []

    for (const helper of helpers.data) {
      // 检查帮助类型是否匹配
      const typeMatch = helper.helperInfo.helpTypes.includes(needData.type)

      // 计算距离 - 优先使用最新位置
      let minDistance = Infinity
      let bestLocation = null
      let usedCurrentLocation = false

      // 首先检查最新位置（currentLocation）- 以最新位置优先
      if (helper.currentLocation && helper.currentLocation.coordinates) {
        const distance = utils.calculateDistance(
          needData.location.latitude,
          needData.location.longitude,
          helper.currentLocation.coordinates[1], // latitude
          helper.currentLocation.coordinates[0]  // longitude
        )
        minDistance = distance
        usedCurrentLocation = true
      }

      // 然后检查设置的服务位置
      for (const loc of helper.helperInfo.locations) {
        const distance = utils.calculateDistance(
          needData.location.latitude,
          needData.location.longitude,
          loc.latitude,
          loc.longitude
        )

        if (distance <= loc.radius && distance < minDistance) {
          minDistance = distance
          bestLocation = loc
          usedCurrentLocation = false
        }
      }

      // 如果在匹配范围内（使用当前位置时不检查radius限制）
      const inRange = usedCurrentLocation
        ? minDistance <= needData.matchRange
        : (bestLocation && minDistance <= bestLocation.radius) || minDistance <= needData.matchRange

      if (inRange) {
        let score = 1000 - minDistance * 100
        if (typeMatch) score += 500
        score += helper.helperInfo.rating * 10
        score += helper.helperInfo.completedTasks

        matches.push({
          helperId: helper._id,
          helperOpenid: helper.openid,
          nickname: helper.nickname,
          avatar: helper.avatar,
          rating: helper.helperInfo.rating,
          completedTasks: helper.helperInfo.completedTasks,
          distance: minDistance,
          typeMatch: typeMatch,
          score: score
        })
      }
    }

    // 按得分排序
    matches.sort((a, b) => b.score - a.score)

    // 保存匹配记录
    const matchRecords = []
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]
      const record = {
        needId: needId,
        helperId: match.helperId,
        helperOpenid: match.helperOpenid,
        distance: match.distance,
        typeMatch: match.typeMatch,
        score: match.score,
        notifiedAt: null,
        notifyMethod: '',
        status: 'pending',
        respondedAt: null,
        rejectReason: '',
        priority: i + 1,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      const result = await db.collection('matches').add({ data: record })
      matchRecords.push({
        matchId: result._id,
        ...match,
        priority: i + 1
      })
    }

    // 通知前N位帮助者
    const notifyCount = Math.min(matchRecords.length, CONFIG.business.MAX_MATCH_NOTIFY)
    for (let i = 0; i < notifyCount; i++) {
      const match = matchRecords[i]
      await sendMatchNotification(match.helperOpenid, needData, match.distance)

      // 更新通知状态
      await db.collection('matches').doc(match.matchId).update({
        data: {
          notifiedAt: db.serverDate(),
          notifyMethod: 'wechat',
          updatedAt: db.serverDate()
        }
      })
    }

    // 更新需求匹配状态
    await db.collection('needs').doc(needId).update({
      data: {
        matchedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    return response.success({
      totalMatches: matches.length,
      notifiedCount: notifyCount,
      matches: matchRecords.slice(0, notifyCount).map(m => ({
        matchId: m.matchId,
        distance: m.distance,
        typeMatch: m.typeMatch,
        priority: m.priority,
        helperInfo: {
          nickname: m.nickname,
          avatar: m.avatar,
          rating: m.rating,
          completedTasks: m.completedTasks
        }
      }))
    }, '匹配成功')

  } catch (error) {
    console.error('匹配失败:', error)
    return response.error('匹配失败', -1, error)
  }
}

// 发送匹配通知
async function sendMatchNotification(openid, needData, distance) {
  try {
    // 获取位置名称（兼容新旧数据结构）
    const locationName = needData.locationInfo?.name || needData.location?.name || '未知位置'

    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: CONFIG.templates.match,
      data: {
        thing1: { value: needData.typeName },
        thing2: { value: locationName },
        amount3: { value: needData.points + '积分' },
        thing4: { value: `距离${Math.round(distance * 1000)}米，点击查看详情` }
      }
    })
  } catch (error) {
    console.error('发送匹配通知失败:', error)
  }
}
