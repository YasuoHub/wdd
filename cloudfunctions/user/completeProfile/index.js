// cloudfunctions/user/completeProfile/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response, utils } = require('./config')

exports.main = async (event, context) => {
  const { phone, locations, helpTypes, role } = event
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
    let bonusPoints = 0
    let updateData = {
      phone: phone,
      updatedAt: db.serverDate()
    }

    // 验证手机号
    if (phone && !utils.validatePhone(phone)) {
      return response.error('手机号格式不正确', 1001)
    }

    // 首次完善信息奖励30积分
    if (!userData.pointsStats.hasCompletedProfile) {
      bonusPoints = CONFIG.points.COMPLETE_PROFILE

      // 更新积分
      updateData['points.balance'] = _.inc(bonusPoints)
      updateData['points.totalEarned'] = _.inc(bonusPoints)
      updateData['pointsStats.hasCompletedProfile'] = true

      // 记录积分
      await db.collection('points_records').add({
        data: {
          userId: userData._id,
          type: 'complete_profile',
          amount: bonusPoints,
          balance: userData.points.balance + bonusPoints,
          description: '完善个人信息奖励',
          createdAt: db.serverDate()
        }
      })
    }

    // 更新帮助者信息
    if (locations && locations.length > 0) {
      if (locations.length > 3) {
        return response.error('最多添加3个常活动地点', 1002)
      }
      updateData['helperInfo.locations'] = locations
      updateData['helperInfo.helpTypes'] = helpTypes || []
      updateData['helperInfo.isAvailable'] = true
    }

    // 更新角色
    if (role) {
      updateData.role = role
    } else if (locations && locations.length > 0) {
      updateData.role = userData.role === 'seeker' ? 'both' : userData.role
    }

    await db.collection('users').doc(userData._id).update({
      data: updateData
    })

    return response.success({
      bonusPoints: bonusPoints,
      message: bonusPoints > 0 ? `完善成功，获得${bonusPoints}积分！` : '完善成功'
    })

  } catch (error) {
    console.error('完善信息失败:', error)
    return response.error('完善失败', -1, error)
  }
}
