// miniprogram/pages/points/index/index.js
const pointsService = require('../../../services/points')
const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    balance: 0,
    frozen: 0,
    available: 0,
    totalEarned: 0,
    displayBalance: 0,  // 用于动画显示的积分
    todaySignIn: false,
    signInStreak: 0,
    todayReward: 5,
    records: [],
    inviteCode: '',
    isLargeFont: false,
    loading: true,
    monthlyDays: 0,
    animationStarted: false  // 标记动画是否开始
  },

  onLoad() {
    this.loadSettings()
    this.loadData()
  },

  onShow() {
    this.loadPointsInfo()
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载所有数据
  async loadData() {
    try {
      await Promise.all([
        this.loadPointsInfo(),
        this.checkSignInStatus(),
        this.loadRecentRecords()
      ])
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  },

  // 加载用户设置
  loadSettings() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo && userInfo._id) {
      this.setData({
        isLargeFont: userInfo.settings?.largeFont || false,
        inviteCode: this.generateInviteCode(userInfo._id)
      })
    }
  },

  // 生成邀请码（6位）
  generateInviteCode(userId) {
    if (!userId) return '000000'
    return userId.slice(-6).toUpperCase()
  },

  // 加载积分信息 - 带数字滚动动画
  async loadPointsInfo() {
    try {
      const result = await pointsService.getBalance()

      // 安全获取数据
      const data = result.data || {}
      const balance = data.balance || 0
      const frozen = data.frozen || 0
      const available = data.available || 0
      const totalEarned = data.totalEarned || 0

      console.log('积分数据:', { balance, frozen, available, totalEarned })

      // 先设置实际数值
      this.setData({
        balance: balance,
        frozen: frozen,
        available: available,
        totalEarned: totalEarned,
        displayBalance: balance, // 直接设置，动画作为增强
        loading: false
      })

      // 启动数字滚动动画（从0滚动到目标值）
      if (balance > 0) {
        this.setData({ displayBalance: 0 })
        this.animateNumber(0, balance, 800, (value) => {
          this.setData({ displayBalance: Math.round(value) })
        })
      }

    } catch (error) {
      console.error('加载积分信息失败:', error)
      this.setData({ loading: false })
      // 尝试从本地缓存获取
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo && userInfo.points) {
        this.setData({
          balance: userInfo.points.balance || 0,
          frozen: userInfo.points.frozen || 0,
          available: (userInfo.points.balance || 0) - (userInfo.points.frozen || 0),
          displayBalance: userInfo.points.balance || 0
        })
      }
    }
  },

  // 数字滚动动画 - 使用 setTimeout 兼容小程序
  animateNumber(start, end, duration, callback) {
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // 使用 easeOutQuart 缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 4)
      const current = start + (end - start) * easeProgress

      callback(current)

      if (progress < 1) {
        // 小程序使用 setTimeout 代替 requestAnimationFrame
        setTimeout(animate, 16) // 约60fps
      }
    }
    animate()
  },

  // 检查签到状态
  async checkSignInStatus() {
    try {
      const result = await pointsService.checkSignIn()
      const data = result.data

      let todayReward = 5
      if (data.streak >= 30) todayReward = 20
      else if (data.streak >= 7) todayReward = 10

      this.setData({
        todaySignIn: data.hasSigned,
        signInStreak: data.streak,
        todayReward: todayReward,
        monthlyDays: data.monthlyDays
      })
    } catch (error) {
      console.error('检查签到状态失败:', error)
    }
  },

  // 加载最近记录 - 带入场动画
  async loadRecentRecords() {
    try {
      const result = await pointsService.getRecords({ page: 1, pageSize: 5 })

      // 获取记录数组（兼容不同返回格式）
      const recordsData = result.data.records || result.data || []

      // 先设置数据但不显示动画
      this.setData({
        records: recordsData.map((item, index) => ({
          ...item,
          formattedTime: util.formatDate(item.createdAt),
          showAnimation: false,
          animationDelay: index * 100
        }))
      })

      // 延迟启动入场动画
      setTimeout(() => {
        this.startRecordAnimation()
      }, 300)

    } catch (error) {
      console.error('加载记录失败:', error)
    }
  },

  // 启动记录入场动画
  startRecordAnimation() {
    const records = this.data.records
    records.forEach((record, index) => {
      setTimeout(() => {
        this.setData({
          [`records[${index}].showAnimation`]: true
        })
      }, record.animationDelay)
    })
  },

  // 签到
  async signIn() {
    if (this.data.todaySignIn) {
      wx.showToast({ title: '今日已签到', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '签到中...' })
      const result = await pointsService.signIn()
      wx.hideLoading()

      const { points, streak, balance } = result.data

      // 播放签到成功动画
      this.playSignInAnimation(points)

      // 更新数据并播放积分增加动画
      const oldBalance = this.data.balance
      this.setData({
        todaySignIn: true,
        signInStreak: streak,
        balance: balance,
        available: balance - this.data.frozen,
        todayReward: points,
        monthlyDays: this.data.monthlyDays + 1
      })

      // 积分增加动画
      this.animateNumber(oldBalance, balance, 800, (value) => {
        this.setData({ displayBalance: Math.round(value) })
      })

      // 刷新记录
      setTimeout(() => {
        this.loadRecentRecords()
      }, 500)

    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '签到失败', icon: 'none' })
    }
  },

  // 签到成功动画
  playSignInAnimation(points) {
    wx.showToast({
      title: `+${points}积分`,
      icon: 'success',
      duration: 2000
    })
  },

  // 查看全部记录
  goToRecords() {
    wx.navigateTo({ url: '/pages/points/records/records' })
  },

  // 邀请好友
  goToInvite() {
    wx.navigateTo({ url: '/pages/points/invite/invite' })
  },

  // 复制邀请码
  copyInviteCode() {
    if (this.data.inviteCode === '000000') {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    util.copyText(this.data.inviteCode)
  },

  // 分享邀请
  onShareAppMessage() {
    const userInfo = wx.getStorageSync('userInfo')
    return {
      title: `快来加入问当地，互帮互助赚积分！`,
      path: `/pages/index/index?inviteCode=${userInfo._id || ''}`,
      imageUrl: '/static/images/share-invite.png'
    }
  }
})
