// cloudfunctions/need/modifyNeed/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, CONFIG, utils } = require('./config')

exports.main = async (event, context) => {
  const { needId, description, referenceImages } = event
  const db = cloud.database()
  const wxContext = cloud.getWXContext()

  try {
    if (!needId) {
      return response.error('需求ID不能为空', 1001)
    }

    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    const need = await db.collection('needs').doc(needId).get()
    if (!need.data) {
      return response.error('需求不存在', 404)
    }

    const needData = need.data

    if (needData.seekerId !== userData._id) {
      return response.error('无权修改该需求', 403)
    }

    if (needData.status !== 'matching') {
      return response.error('只有匹配中的需求可以修改', 1002)
    }

    if (needData.modifyCount >= CONFIG.business.NEED_MODIFY_LIMIT) {
      return response.error('已达到修改次数上限', 1003)
    }

    const updateData = {
      modifyCount: db.command.inc(1),
      updatedAt: db.serverDate()
    }

    if (description && description.trim()) {
      const filterResult = utils.filterSensitiveWords(description)
      if (filterResult.hasSensitive) {
        return response.error('描述包含敏感词', 1004)
      }
      updateData.description = description.trim()
    }

    if (referenceImages && Array.isArray(referenceImages)) {
      updateData.referenceImages = referenceImages
    }

    await db.collection('needs').doc(needId).update({
      data: updateData
    })

    return response.success({
      modifyCount: needData.modifyCount + 1,
      remainingModifies: CONFIG.business.NEED_MODIFY_LIMIT - needData.modifyCount - 1
    }, '修改成功')

  } catch (error) {
    console.error('修改需求失败:', error)
    return response.error('修改失败', -1, error)
  }
}