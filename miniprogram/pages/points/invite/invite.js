// pages/points/invite/invite.js
const pointsService = require('../../../services/points')
const app = getApp()

Page({
  data: {
    inviteCode: '',
    inviteList: [],
    loading: true,
    totalCount: 0,
    monthlyCount: 0,
    monthlyLimit: 20,
    totalReward: 0,
    isLargeFont: false
  },

  onLoad() {
    this.setData({
      isLargeFont: app.globalData.isLargeFont || false
    })
    this.loadInviteRecords()
  },

  onShow() {
    this.loadInviteRecords()
  },

  onPullDownRefresh() {
    this.loadInviteRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载邀请记录
  async loadInviteRecords() {
    try {
      this.setData({ loading: true })

      const result = await pointsService.getInviteRecords()
      const data = result.data || {}

      this.setData({
        inviteList: data.records || [],
        totalCount: data.totalCount || 0,
        monthlyCount: data.monthlyCount || 0,
        monthlyLimit: data.monthlyLimit || 20,
        totalReward: data.totalReward || 0,
        inviteCode: data.inviteCode || '',
        loading: false
      })

    } catch (error) {
      console.error('加载邀请记录失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 复制邀请码
  copyInviteCode() {
    if (!this.data.inviteCode) {
      wx.showToast({ title: '邀请码生成中', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' })
      }
    })
  },

  // 分享邀请
  onShareAppMessage() {
    const userInfo = wx.getStorageSync('userInfo')
    const userId = userInfo ? userInfo._id : ''
    const inviteCode = this.data.inviteCode || (userId ? userId.slice(-6).toUpperCase() : '')

    return {
      title: `快来加入问当地，互帮互助赚积分！我的邀请码：${inviteCode}`,
      path: `/pages/index/index?inviteCode=${userId}`,
      imageUrl: '/static/images/share-invite.png'
    }
  },

  // 显示分享选项
  showShareOptions() {
    wx.showActionSheet({
      itemList: ['分享给好友', '复制邀请码'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 分享给好友 - 触发系统分享
          // 这里会触发 onShareAppMessage
        } else if (res.tapIndex === 1) {
          this.copyInviteCode()
        }
      }
    })
  }
})
