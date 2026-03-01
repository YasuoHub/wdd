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

  console.log('创建需求 - 接收到的完整event:', JSON.stringify(event))
  console.log('创建需求 - 接收到的location:', JSON.stringify(location))
  console.log('创建需求 - location各字段:', {
    name: location && location.name,
    address: location && location.address,
    latitude: location && location.latitude,
    longitude: location && location.longitude
  })

  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()

  // 用于存储需要在事务后使用的数据
  let userData = null
  let needNo = null
  let needData = null
  let newBalance = null
  let newFrozen = null

  try {
    // ========== 阶段1：所有前置校验（在事务外执行）==========

    // 获取用户信息
    const user = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    if (user.data.length === 0) {
      return response.error('用户不存在', 404)
    }

    userData = user.data[0]

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
    needNo = utils.generateOrderNo('N')

    // 预先计算新的积分状态
    newBalance = userData.points.balance - points
    newFrozen = userData.points.frozen + points

    // 创建需求数据
    needData = {
      needNo: needNo,
      seekerId: userData._id,
      seekerOpenid: wxContext.OPENID,
      location: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      },
      locationInfo: {
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

    // ========== 阶段2：执行事务（仅包含核心写操作）==========
    console.log('开始执行数据库事务...')

    let needResult = null
    let transactionSuccess = false
    let needId = null

    // 使用 runTransaction 自动处理事务生命周期
    try {
      const transactionResult = await db.runTransaction(async (transaction) => {
        // 1. 冻结积分：从 balance 扣除，加到 frozen（总额不变）
        await transaction.collection('users').doc(userData._id).update({
          data: {
            'points.balance': _.inc(-points),
            'points.frozen': _.inc(points),
            'seekerInfo.totalRequests': _.inc(1),
            updatedAt: db.serverDate()
          }
        })

        // 2. 创建需求
        needResult = await transaction.collection('needs').add({
          data: needData
        })

        needId = needResult._id

        // 3. 记录积分变动（冻结）
        await transaction.collection('points_records').add({
          data: {
            userId: userData._id,
            type: 'publish_freeze',
            amount: -points,
            balance: newBalance,
            frozen: newFrozen,
            relatedId: needResult._id,
            relatedType: 'need',
            description: `发布需求"${typeName}"冻结${points}积分`,
            extra: {
              needNo: needNo,
              type: type
            },
            createdAt: db.serverDate()
          }
        })

        return { needId: needResult._id }
      })

      transactionSuccess = true
      needId = transactionResult.needId
      console.log('事务执行成功，needId:', needId)

    } catch (transactionError) {
      console.error('事务执行失败:', transactionError)

      // 判断是否是事务不存在错误，如果是则尝试非事务方式补偿
      if (transactionError.code === 'DATABASE_TRANSACTION_FAIL' ||
          transactionError.message?.includes('TransactionNotExist')) {
        console.log('事务不存在，尝试使用非事务方式执行...')

        // 非事务方式执行（补偿机制）
        try {
          // 1. 冻结积分
          await db.collection('users').doc(userData._id).update({
            data: {
              'points.balance': _.inc(-points),
              'points.frozen': _.inc(points),
              'seekerInfo.totalRequests': _.inc(1),
              updatedAt: db.serverDate()
            }
          })

          // 2. 创建需求
          needResult = await db.collection('needs').add({
            data: needData
          })

          needId = needResult._id

          // 3. 记录积分变动
          await db.collection('points_records').add({
            data: {
              userId: userData._id,
              type: 'publish_freeze',
              amount: -points,
              balance: newBalance,
              frozen: newFrozen,
              relatedId: needResult._id,
              relatedType: 'need',
              description: `发布需求"${typeName}"冻结${points}积分`,
              extra: {
                needNo: needNo,
                type: type
              },
              createdAt: db.serverDate()
            }
          })

          transactionSuccess = true
          console.log('非事务方式执行成功，needId:', needId)
        } catch (fallbackError) {
          console.error('非事务方式执行失败:', fallbackError)
          throw fallbackError
        }
      } else {
        throw transactionError
      }
    }

    if (!transactionSuccess || !needId) {
      return response.error('发布失败，请稍后重试', -1)
    }

    // ========== 阶段3：异步触发匹配（不阻塞响应）==========
    setTimeout(async () => {
      try {
        await cloud.callFunction({
          name: 'match_findHelpers',
          data: { needId: needId }
        })
      } catch (err) {
        console.error('触发匹配失败:', err)
      }
    }, 100)

    return response.success({
      needId: needId,
      needNo: needNo,
      status: 'matching',
      points: points,
      message: '需求发布成功，正在匹配帮助者...'
    }, '发布成功')

  } catch (error) {
    console.error('发布需求失败:', error)
    return response.error('发布失败：' + (error.message || '未知错误'), -1, error)
  }
}
