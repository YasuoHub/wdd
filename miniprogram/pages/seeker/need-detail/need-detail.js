// pages/seeker/need-detail/need-detail.js
const needService = require('../../../services/need')
const chatService = require('../../../services/chat')
const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    needId: '',
    needInfo: null,
    helperInfo: null,
    messages: [],
    userInfo: null,
    isLargeFont: false,
    loading: true,
    
    // 状态相关
    canCancel: false,
    canComplete: false,
    canReview: false,
    showActions: false
  },

  onLoad(options) {
    const { id } = options
    if (!id) {
      wx.showToast({ title: '需求ID错误', icon: 'none' })
      wx.navigateBack()
      return
    }
    
    this.setData({ 
      needId: id,
      userInfo: wx.getStorageSync('userInfo')
    })
    
    this.loadSettings()
    this.loadNeedDetail()
  },

  onShow() {
    if (this.data.needId) {
      this.loadNeedDetail()
    }
  },

  onPullDownRefresh() {
    this.loadNeedDetail().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载设置
  loadSettings() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo.settings) {
      this.setData({
        isLargeFont: userInfo.settings.largeFont || false
      })
    }
  },

  // 加载需求详情
  async loadNeedDetail() {
    try {
      this.setData({ loading: true })
      const result = await needService.getNeedDetail(this.data.needId)
      const needInfo = result.data

      // 调试输出
      console.log('需求详情 - location:', JSON.stringify(needInfo.location))
      console.log('需求详情 - location.name:', needInfo.location && needInfo.location.name)

      // 格式化时间
      needInfo.formattedTime = util.formatDate(needInfo.createdAt)
      if (needInfo.deadline) {
        needInfo.timeLeft = this.calculateTimeLeft(needInfo.deadline)
      }
      
      // 判断权限
      const isSeeker = needInfo.seekerId === (this.data.userInfo && this.data.userInfo._id)
      const status = needInfo.status
      
      this.setData({
        needInfo: needInfo,
        helperInfo: needInfo.helperInfo || null,
        loading: false,
        canCancel: isSeeker && (status === 'matching' || status === 'executing'),
        canComplete: isSeeker && status === 'executing',
        canReview: isSeeker && status === 'completed' && !needInfo.review.seekerToHelper,
        showActions: isSeeker && (status === 'matching' || status === 'executing' || status === 'completed')
      })
    } catch (error) {
      console.error('加载需求详情失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 计算剩余时间
  calculateTimeLeft(deadline) {
    const now = new Date().getTime()
    const end = new Date(deadline).getTime()
    const diff = end - now
    
    if (diff <= 0) return '已超时'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    }
    return `${minutes}分钟`
  },

  // 复制需求编号
  copyNeedNo() {
    const needNo = this.data.needInfo && this.data.needInfo.needNo
    if (needNo) {
      util.copyText(needNo)
    }
  },

  // 跳转到聊天
  goToChat() {
    wx.navigateTo({
      url: `/pages/chat/chat?needId=${this.data.needId}`
    })
  },

  // 取消需求
  async cancelNeed() {
    const confirmed = await util.showConfirm(
      '确认取消',
      '取消后积分将退还，是否确认取消该需求？',
      { confirmText: '确认取消' }
    )
    
    if (!confirmed) return
    
    try {
      wx.showLoading({ title: '取消中...' })
      await needService.cancelNeed(this.data.needId)
      wx.hideLoading()
      
      wx.showToast({ title: '已取消', icon: 'success' })
      setTimeout(() => {
        this.loadNeedDetail()
      }, 1500)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '取消失败', icon: 'none' })
    }
  },

  // 确认完成
  async completeNeed() {
    const confirmed = await util.showConfirm(
      '确认完成',
      '确认帮助者已完成任务？积分将转给帮助者。',
      { confirmText: '确认完成' }
    )
    
    if (!confirmed) return
    
    // 跳转到评价页面
    wx.navigateTo({
      url: `/pages/reviews/reviews?needId=${this.data.needId}&type=complete`
    })
  },

  // 申请客服介入
  async requestSupport() {
    const confirmed = await util.showConfirm(
      '申请客服介入',
      '遇到纠纷无法解决？客服将协助处理。',
      { confirmText: '申请介入' }
    )
    
    if (!confirmed) return
    
    wx.navigateTo({
      url: `/pages/support/support?needId=${this.data.needId}`
    })
  },

  // 预览图片
  previewImage(e) {
    const { url } = e.currentTarget.dataset
    const images = this.data.needInfo && this.data.needInfo.referenceImages
    if (images && images.length > 0) {
      wx.previewImage({
        current: url,
        urls: images
      })
    }
  },

  // 再次发布
  publishAgain() {
    wx.redirectTo({
      url: '/pages/seeker/publish/publish'
    })
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 分享
  onShareAppMessage() {
    const needInfo = this.data.needInfo
    return {
      title: `问当地 - ${needInfo && needInfo.typeName || '求助'}`,
      path: `/pages/seeker/need-detail/need-detail?id=${this.data.needId}`,
      imageUrl: '/static/images/share.png'
    }
  }
})
