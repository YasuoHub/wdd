// cloudfunctions/user/login/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { CONFIG, response, utils } = require('./config')

exports.main = async (event, context) => {
  const { userInfo, inviteCode, deviceId } = event
  const db = cloud.database()
  const _ = db.command
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const clientIP = wxContext.CLIENTIP

  try {
    // 防刷检查：同设备注册限制
    if (deviceId) {
      const recentReg = await db.collection('users').where({
        deviceId: deviceId,
        createdAt: _.gte(new Date(Date.now() - CONFIG.antiSpam.deviceRegister.period))
      }).get()

      if (recentReg.data.length >= CONFIG.antiSpam.deviceRegister.max) {
        return response.error('该设备今日注册次数已达上限', 1001)
      }
    }

    // 登录失败次数检查
    const loginAttempts = await db.collection('login_attempts').where({
      openid: openid,
      createdAt: _.gte(new Date(Date.now() - CONFIG.antiSpam.loginAttempts.period))
    }).count()

    if (loginAttempts.total >= CONFIG.antiSpam.loginAttempts.max) {
      return response.error('登录尝试次数过多，请10分钟后重试', 1002)
    }

    // 查询用户是否存在
    let user = await db.collection('users').where({ openid }).get()

    if (user.data.length === 0) {
      // 新用户注册
      const newUser = {
        openid,
        unionid: wxContext.UNIONID || '',
        nickname: userInfo.nickName,
        avatar: userInfo.avatarUrl,
        gender: userInfo.gender || 0,
        country: userInfo.country || '',
        province: userInfo.province || '',
        city: userInfo.city || '',
        role: 'seeker',
        phone: '',
        isPhoneVerified: false,
        points: {
          balance: CONFIG.points.NEW_USER,
          frozen: 0
        },
        helperInfo: {
          locations: [],
          helpTypes: [],
          isAvailable: false,
          rating: 5.0,
          completedTasks: 0,
          cancelledTasks: 0
        },
        seekerInfo: {
          totalRequests: 0,
          completedRequests: 0
        },
        pointsStats: {
          signInStreak: 0,
          lastSignIn: null,
          inviteCount: 0,
          monthlyInviteCount: 0,
          lastInviteMonth: new Date().getMonth(),
          hasCompletedProfile: false
        },
        settings: {
          largeFont: false,
          highContrast: false,
          notifyMatch: true,
          notifyMessage: true,
          notifyPoints: true
        },
        isAdmin: openid === CONFIG.admin.openid,
        adminRole: openid === CONFIG.admin.openid ? 'super' : null,
        adminPermissions: openid === CONFIG.admin.openid ? CONFIG.admin.permissions.super : [],
        isBanned: false,
        banReason: '',
        deviceId: deviceId || '',
        lastIp: clientIP,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      const result = await db.collection('users').add({
        data: newUser
      })

      // 记录积分获取
      await db.collection('points_records').add({
        data: {
          userId: result._id,
          type: 'register',
          amount: CONFIG.points.NEW_USER,
          balance: CONFIG.points.NEW_USER,
          description: '新用户注册奖励',
          extra: {
            source: 'system'
          },
          createdAt: db.serverDate()
        }
      })

      // 处理邀请
      if (inviteCode) {
        await handleInvite(db, result._id, inviteCode, newUser.nickname)
      }

      // 发送欢迎通知
      await sendWelcomeNotification(openid, newUser.nickname)

      // 记录登录成功
      await db.collection('login_logs').add({
        data: {
          openid,
          userId: result._id,
          type: 'register',
          deviceId: deviceId || '',
          ip: clientIP,
          createdAt: db.serverDate()
        }
      })

      return response.success({
        userId: result._id,
        ...newUser,
        isNewUser: true
      }, '注册成功')

    } else {
      // 老用户登录
      const existingUser = user.data[0]

      // 检查是否被封禁
      if (existingUser.isBanned) {
        return response.error('账号已被封禁，原因：' + existingUser.banReason, 1003)
      }

      // 更新登录信息
      await db.collection('users').doc(existingUser._id).update({
        data: {
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl,
          lastIp: clientIP,
          updatedAt: db.serverDate()
        }
      })

      // 记录登录成功
      await db.collection('login_logs').add({
        data: {
          openid,
          userId: existingUser._id,
          type: 'login',
          deviceId: deviceId || '',
          ip: clientIP,
          createdAt: db.serverDate()
        }
      })

      return response.success({
        ...existingUser,
        isNewUser: false
      }, '登录成功')
    }

  } catch (error) {
    console.error('登录失败:', error)

    // 记录登录失败
    await db.collection('login_attempts').add({
      data: {
        openid,
        deviceId: deviceId || '',
        ip: clientIP,
        error: error.message,
        createdAt: db.serverDate()
      }
    })

    return response.error('登录失败，请重试', -1, error)
  }
}

// 处理邀请
async function handleInvite(db, newUserId, inviterId, newUserNickname) {
  const _ = db.command

  try {
    // 检查邀请人是否存在
    const inviter = await db.collection('users').doc(inviterId).get()
    if (!inviter.data) {
      console.log('邀请人不存在:', inviterId)
      return
    }

    const inviterData = inviter.data
    const currentMonth = new Date().getMonth()
    const lastInviteMonth = inviterData.pointsStats?.lastInviteMonth ?? -1

    let monthlyInviteCount = inviterData.pointsStats?.monthlyInviteCount || 0

    // 检查月度邀请上限
    if (currentMonth !== lastInviteMonth) {
      monthlyInviteCount = 0
    }

    if (monthlyInviteCount >= CONFIG.antiSpam.inviteLimit.max) {
      console.log('邀请人本月已达上限:', inviterId)
      return
    }

    // 检查是否已被邀请过
    const existingInvite = await db.collection('invite_records').where({
      invitedId: newUserId
    }).get()

    if (existingInvite.data.length > 0) {
      console.log('该用户已被邀请过:', newUserId)
      return
    }

    // 记录邀请关系
    await db.collection('invite_records').add({
      data: {
        inviterId: inviterId,
        invitedId: newUserId,
        invitedNickname: newUserNickname,
        pointsReward: CONFIG.points.INVITE,
        createdAt: db.serverDate()
      }
    })

    // 邀请人获得积分
    const inviterNewBalance = inviterData.points.balance + CONFIG.points.INVITE
    await db.collection('users').doc(inviterId).update({
      data: {
        'points.balance': _.inc(CONFIG.points.INVITE),
        'pointsStats.inviteCount': _.inc(1),
        'pointsStats.monthlyInviteCount': monthlyInviteCount + 1,
        'pointsStats.lastInviteMonth': currentMonth,
        updatedAt: db.serverDate()
      }
    })

    await db.collection('points_records').add({
      data: {
        userId: inviterId,
        type: 'invite',
        amount: CONFIG.points.INVITE,
        balance: inviterNewBalance,
        relatedId: newUserId,
        relatedType: 'user',
        description: '邀请好友成功',
        extra: {
          invitedNickname: newUserNickname
        },
        createdAt: db.serverDate()
      }
    })

    // 被邀请人额外获得积分
    await db.collection('users').doc(newUserId).update({
      data: {
        'points.balance': _.inc(CONFIG.points.INVITE),
        updatedAt: db.serverDate()
      }
    })

    await db.collection('points_records').add({
      data: {
        userId: newUserId,
        type: 'invite_bonus',
        amount: CONFIG.points.INVITE,
        balance: CONFIG.points.NEW_USER + CONFIG.points.INVITE,
        relatedId: inviterId,
        relatedType: 'user',
        description: '被邀请奖励',
        extra: {
          inviterNickname: inviterData.nickname
        },
        createdAt: db.serverDate()
      }
    })

    // 发送邀请成功通知给邀请人
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: inviterData.openid,
        templateId: CONFIG.templates.points,
        data: {
          thing1: { value: '邀请好友成功' },
          amount2: { value: CONFIG.points.INVITE + '积分' },
          time3: { value: utils.formatTime(new Date()) }
        }
      })
    } catch (err) {
      console.log('发送邀请通知失败:', err)
    }

  } catch (error) {
    console.error('处理邀请失败:', error)
  }
}

// 发送欢迎通知
async function sendWelcomeNotification(openid, nickname) {
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: CONFIG.templates.signIn,
      data: {
        thing1: { value: '欢迎加入问当地' },
        time2: { value: utils.formatTime(new Date()) },
        thing3: { value: `您好${nickname}，欢迎加入互帮互助平台，赠送${CONFIG.points.NEW_USER}积分！` }
      }
    })
  } catch (error) {
    console.log('发送欢迎通知失败:', error)
  }
}
