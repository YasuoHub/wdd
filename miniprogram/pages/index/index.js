// miniprogram/pages/index/index.js
const userService = require('../../services/user')
const app = getApp()

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    isLargeFont: false
  },

  onLoad() {
    // 检查是否支持 getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }

    // 检查登录状态
    this.checkLoginStatus()
  },

  onShow() {
    this.checkLoginStatus()
  },

  // 检查登录
  async checkLoginStatus() {
    try {
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.setData({
          userInfo: userInfo,
          hasUserInfo: true,
          isLargeFont: userInfo.settings?.largeFont || false
        })
        app.globalData.userInfo = userInfo
        app.globalData.isLargeFont = userInfo.settings?.largeFont || false
      }
    } catch (error) {
      console.error('检查登录失败:', error)
    }
  },

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        this.login(res.userInfo)
      },
      fail: (err) => {
        console.log('用户拒绝授权:', err)
        wx.showToast({
          title: '需要授权才能使用',
          icon: 'none'
        })
      }
    })
  },

  // 登录
  async login(userInfo) {
    try {
      wx.showLoading({ title: '登录中...' })

      // 获取邀请码（从分享进入）
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const inviteCode = currentPage.options.inviteCode || ''

      const result = await userService.login(userInfo, inviteCode)

      wx.hideLoading()

      // 保存用户信息
      wx.setStorageSync('userInfo', result.data)
      app.globalData.userInfo = result.data

      this.setData({
        userInfo: result.data,
        hasUserInfo: true,
        isLargeFont: result.data.settings?.largeFont || false
      })

      // 新用户提示
      if (result.data.isNewUser) {
        wx.showModal({
          title: '欢迎加入问当地',
          content: `赠送您${result.data.points.balance}积分，快去发布需求或帮助他人吧！`,
          showCancel: false
        })
      }

    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      })
    }
  },

  // 选择角色 - 求助者
  goToSeeker() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: '/pages/seeker/home/home'
    })
  },

  // 选择角色 - 帮助者
  goToHelper() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    const userInfo = this.data.userInfo

    // 检查是否已完善帮助者信息
    if (userInfo.role === 'seeker' || !userInfo.helperInfo?.locations?.length) {
      wx.showModal({
        title: '完善信息',
        content: '您还未设置帮助者信息，是否现在设置？完善后可获得30积分奖励！',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/helper/profile/profile?from=index'
            })
          }
        }
      })
      return
    }

    wx.navigateTo({
      url: '/pages/helper/home/home'
    })
  },

  // 跳转到积分中心
  goToPoints() {
    if (!this.data.hasUserInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.switchTab({
      url: '/pages/points/index/index'
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '问当地 - 异地信息即时获取',
      path: '/pages/index/index',
      imageUrl: '/static/images/share.png'
    }
  }
})
