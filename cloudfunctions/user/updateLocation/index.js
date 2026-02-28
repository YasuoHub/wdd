// cloudfunctions/user/updateLocation/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response } = require('./config')

exports.main = async (event, context) => {
  const { longitude, latitude } = event
  const db = cloud.database()
  const wxContext = cloud.getWXContext()

  try {
    // 查询用户
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    // 更新当前位置
    await db.collection('users').doc(userData._id).update({
      data: {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        locationUpdatedAt: db.serverDate()
      }
    })

    return response.success({
      longitude,
      latitude,
      updatedAt: new Date().toISOString()
    }, '位置更新成功')

  } catch (error) {
    console.error('更新位置失败:', error)
    return response.error('更新位置失败', -1, error)
  }
}
