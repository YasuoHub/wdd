// cloudfunctions/match/getTaskList/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, utils } = require('./config')

exports.main = async (event, context) => {
  const { longitude, latitude, type = 'nearby', page = 1, pageSize = 10, status } = event
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

    const userData = user.data[0]
    const { skip, page: pageNum, pageSize: size } = utils.pagination({ page, pageSize })

    // 构建查询条件
    let whereCondition = {
      status: status || 'matching',
      seekerId: _.neq(userData._id)
    }

    // 附近查询使用 geoNear（需要 location 字段的 2dsphere 索引）
    if (type === 'nearby' && longitude && latitude) {
      try {
        whereCondition.location = _.geoNear({
          geometry: db.Geo.Point(longitude, latitude),
          maxDistance: 10000,
          minDistance: 0
        })
      } catch (geoErr) {
        console.log('地理查询失败，可能是缺少索引:', geoErr)
        // 降级为普通查询，查询最近发布的匹配中需求
      }
    }

    let query = db.collection('needs').where(whereCondition)

    const totalRes = await query.count()
    const total = totalRes.total

    const needs = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(size)
      .get()

    const formattedNeeds = needs.data.map(need => {
      let distance = null
      if (longitude && latitude && need.location && need.location.coordinates) {
        distance = utils.calculateDistance(
          latitude,
          longitude,
          need.location.coordinates[1],
          need.location.coordinates[0]
        )
      }

      // 组合 location 数据（兼容旧数据和新的分离结构）
      const locationData = need.location || {}
      const locationInfo = need.locationInfo || {}
      const combinedLocation = {
        ...locationData,
        name: locationInfo.name || locationData.name || '未知位置',
        address: locationInfo.address || locationData.address || ''
      }

      return {
        ...need,
        location: combinedLocation,
        bounty: (need.points || 0) + (need.bonusPoints || 0), // 总悬赏积分
        distance: distance,
        formattedTime: utils.formatTime(need.createdAt)
      }
    })

    return response.success({
      needs: formattedNeeds,
      pagination: {
        page: pageNum,
        pageSize: size,
        total: total,
        totalPages: Math.ceil(total / size)
      }
    }, '获取成功')

  } catch (error) {
    console.error('获取任务列表失败:', error)
    return response.error('获取失败', -1, error)
  }
}