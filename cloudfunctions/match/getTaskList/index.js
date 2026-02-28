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

    let query = db.collection('needs').where({
      status: status || 'matching'
    })

    if (type === 'nearby' && longitude && latitude) {
      query = query.where({
        location: {
          geoNear: {
            geometry: db.Geo.Point(longitude, latitude),
            maxDistance: 10000,
            minDistance: 0
          }
        }
      })
    }

    query = query.where({
      seekerId: _.neq(userData._id)
    })

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

      return {
        ...need,
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