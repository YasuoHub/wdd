// miniprogram/pages/mine/mine.js
const userService = require('../../services/user')
const util = require('../../utils/util')
const app = getApp()

Page({
  data: {
    userInfo: null,
    isLargeFont: false,
    loading: false,

    // 菜单列表
    menuList: [
      {
        title: '我的需求',
        icon: '📍',
        path: '/pages/seeker/needs/needs'
      },
      {
        title: '我的任务',
        icon: '💰',
        path: '/pages/helper/tasks/tasks'
      },
      {
        title: '积分明细',
        icon: '🏆',
        path: '/pages/points/records/records'
      },
      {
        title: '邀请好友',
        icon: '🎁',
        path: '/pages/points/invite/invite'
      }
    ],

    // 设置菜单
    settingList: [
      {
        title: '大字体模式',
        icon: '🔤',
        type: 'switch',
        key: 'largeFont'
      },
      {
        title: '帮助与反馈',
        icon: '❓',
        path: '/pages/feedback/feedback'
      },
      {
        title: '关于问当地',
        icon: 'ℹ️',
        type: 'about'
      }
    ]
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const result = await userService.getUserInfo()
      const userInfo = result.data

      // 获取真实统计数据
      const statsResult = await userService.getUserStats()
      const stats = statsResult.data || {}

      // 合并统计数据
      const updatedUserInfo = {
        ...userInfo,
        needCount: stats.needCount || 0,        // 发布需求数量
        helpCount: stats.completedTasks || 0,   // 帮助次数（已完成任务）
        seekerInfo: {
          ...userInfo.seekerInfo,
          totalRequests: stats.needCount || 0
        },
        helperInfo: {
          ...userInfo.helperInfo,
          completedTasks: stats.completedTasks || 0
        }
      }

      this.setData({
        userInfo: updatedUserInfo,
        isLargeFont: updatedUserInfo.settings?.largeFont || false
      })
      app.globalData.userInfo = updatedUserInfo
      wx.setStorageSync('userInfo', updatedUserInfo)
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  // 跳转到页面
  navigateTo(e) {
    const { path } = e.currentTarget.dataset
    if (path) {
      wx.navigateTo({ url: path })
    }
  },

  // 切换设置
  toggleSetting(e) {
    const { key } = e.currentTarget.dataset
    const { value } = e.detail

    if (key === 'largeFont') {
      this.setData({ isLargeFont: value })
      app.globalData.isLargeFont = value

      // 保存到服务器
      userService.updateSettings({ largeFont: value }).catch(err => {
        console.error('保存设置失败:', err)
      })
    }
  },

  // 完善信息
  completeProfile() {
    if (this.data.userInfo?.role === 'seeker') {
      wx.navigateTo({
        url: '/pages/helper/profile/profile'
      })
    } else {
      wx.navigateTo({
        url: '/pages/helper/profile/profile?mode=edit'
      })
    }
  },

  // 关于我们
  showAbout() {
    wx.showModal({
      title: '关于问当地',
      content: '问当地是一款基于地理位置的互帮互助平台，帮助您快速获取异地实时信息。',
      showCancel: false
    })
  },

  // 退出登录
  async logout() {
    const confirmed = await util.showConfirm(
      '确认退出',
      '退出后需要重新登录',
      { confirmText: '退出' }
    )

    if (confirmed) {
      app.clearUserData()
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '问当地 - 异地信息即时获取',
      path: '/pages/index/index'
    }
  }
})
