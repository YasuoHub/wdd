// cloudfunctions/need/createNeed/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response, utils } = require('./config')

exports.main = async (event, context) => {
  const {
    location,
    type,
    typeName,
    description,
    referenceImages,
    points,
    timeLimit,
    matchRange
  } = event

  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()

  try {
    // 获取用户信息
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    const userData = user.data[0]

    // 检查封禁状态
    if (userData.isBanned) {
      return response.error('账号已被封禁', 403)
    }

    // 防刷检查：同IP发布限制
    const recentPublishes = await db.collection('needs').where({
      seekerOpenid: wxContext.OPENID,
      createdAt: _.gte(new Date(Date.now() - CONFIG.antiSpam.ipPublish.period))
    }).count()

    if (recentPublishes.total >= CONFIG.antiSpam.ipPublish.max) {
      return response.error('发布过于频繁，请稍后再试', 1001)
    }

    // 验证最低积分
    if (points < CONFIG.business.MIN_POINTS_PUBLISH) {
      return response.error(`悬赏积分不能低于${CONFIG.business.MIN_POINTS_PUBLISH}`, 1002)
    }

    // 检查积分余额
    const available = userData.points.balance - userData.points.frozen
    if (available < points) {
      return response.error(
        `积分不足，当前可用${available}积分，需要${points}积分`,
        1003,
        {
          available,
          required: points,
          deficit: points - available
        }
      )
    }

    // 敏感词过滤
    const { filtered: filteredDesc, hasSensitive: hasSensitiveDesc } = utils.filterSensitiveWords(description)
    if (hasSensitiveDesc) {
      return response.error('需求描述包含敏感词，请修改后重试', 1004)
    }

    // 验证图片
    if (referenceImages && referenceImages.length > CONFIG.business.MAX_IMAGES_PER_UPLOAD) {
      return response.error(`最多上传${CONFIG.business.MAX_IMAGES_PER_UPLOAD}张图片`, 1005)
    }

    // 计算截止时间
    let deadline = null
    if (timeLimit && timeLimit > 0) {
      deadline = new Date(Date.now() + timeLimit * 60 * 1000)
    }

    // 生成需求编号
    const needNo = utils.generateOrderNo('N')

    // 创建需求
    const needData = {
      needNo: needNo,
      seekerId: userData._id,
      seekerOpenid: wxContext.OPENID,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        name: location.name,
        address: location.address
      },
      type: type,
      typeName: typeName,
      description: description,
      referenceImages: referenceImages || [],
      points: points,
      bonusPoints: 0,
      pointsStatus: 'paid',
      pointsPaidAt: db.serverDate(),
      timeLimit: timeLimit || 0,
      deadline: deadline,
      matchRange: matchRange || 1,
      status: 'matching',
      helperId: null,
      helperOpenid: '',
      matchedAt: null,
      acceptedAt: null,
      completedAt: null,
      review: {
        seekerToHelper: null,
        helperToSeeker: null
      },
      support: {
        isInvolved: false,
        involvedAt: null,
        reason: '',
        result: '',
        handlerId: null
      },
      modifyCount: 0,
      lastModifiedAt: null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }

    // 使用事务确保数据一致性
    const transaction = await db.startTransaction()

    try {
      // 1. 冻结积分
      await transaction.collection('users').doc(userData._id).update({
        data: {
          'points.frozen': _.inc(points),
          'points.totalSpent': _.inc(points),
          'seekerInfo.totalRequests': _.inc(1),
          updatedAt: db.serverDate()
        }
      })

      // 2. 创建需求
      const needResult = await transaction.collection('needs').add({
        data: needData
      })

      // 3. 记录积分变动
      await transaction.collection('points_records').add({
        data: {
          userId: userData._id,
          type: 'publish_deduct',
          amount: -points,
          balance: userData.points.balance,
          frozen: userData.points.frozen + points,
          relatedId: needResult._id,
          relatedType: 'need',
          description: `发布需求"${typeName}"扣除${points}积分`,
          extra: {
            needNo: needNo,
            type: type
          },
          createdAt: db.serverDate()
        }
      })

      await transaction.commit()

      // 异步触发匹配（不阻塞响应）
      setTimeout(async () => {
        try {
          await cloud.callFunction({
            name: 'match_findHelpers',
            data: { needId: needResult._id }
          })
        } catch (err) {
          console.error('触发匹配失败:', err)
        }
      }, 100)

      return response.success({
        needId: needResult._id,
        needNo: needNo,
        status: 'matching',
        points: points,
        message: '需求发布成功，正在匹配帮助者...'
      }, '发布成功')

    } catch (error) {
      await transaction.rollback()
      throw error
    }

  } catch (error) {
    console.error('发布需求失败:', error)
    return response.error('发布失败', -1, error)
  }
}
