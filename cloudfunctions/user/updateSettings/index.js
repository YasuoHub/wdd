// cloudfunctions/user/updateSettings/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response } = require('./config')

exports.main = async (event, context) => {
  const { settings } = event
  const db = cloud.database()
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    if (!settings || typeof settings !== 'object') {
      return response.error('设置参数不能为空', 1001)
    }

    const user = await db.collection('users').where({
      openid: openid
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    const validSettings = {}
    if (typeof settings.largeFont === 'boolean') {
      validSettings['settings.largeFont'] = settings.largeFont
    }
    if (typeof settings.highContrast === 'boolean') {
      validSettings['settings.highContrast'] = settings.highContrast
    }
    if (typeof settings.notifyMatch === 'boolean') {
      validSettings['settings.notifyMatch'] = settings.notifyMatch
    }
    if (typeof settings.notifyMessage === 'boolean') {
      validSettings['settings.notifyMessage'] = settings.notifyMessage
    }
    if (typeof settings.notifyPoints === 'boolean') {
      validSettings['settings.notifyPoints'] = settings.notifyPoints
    }

    await db.collection('users').doc(userData._id).update({
      data: {
        ...validSettings,
        updatedAt: db.serverDate()
      }
    })

    return response.success(null, '设置更新成功')

  } catch (error) {
    console.error('更新设置失败:', error)
    return response.error('更新失败', -1, error)
  }
}