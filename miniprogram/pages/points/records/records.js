// pages/points/records/records.js
const pointsService = require('../../../services/points')
const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    records: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 20,
    total: 0,
    isLargeFont: false,

    // 当前积分
    balance: 0,
    frozen: 0,
    available: 0,

    // 筛选
    currentFilter: 'all',
    filters: [
      { key: 'all', name: '全部' },
      { key: 'income', name: '收入' },
      { key: 'expense', name: '支出' }
    ],

    // 统计数据（基于所有记录，切换tab时不变化）
    allStats: {
      totalIncome: 0,
      totalExpense: 0,
      totalCount: 0
    }
  },

  onLoad() {
    this.setData({
      isLargeFont: app.globalData.isLargeFont || false
    })
    // 加载积分余额、统计数据和列表
    this.loadBalance()
    this.loadAllStats()
    this.loadRecords()
  },

  onShow() {
    // 每次显示页面时刷新余额
    this.loadBalance()
  },

  // 加载积分余额
  async loadBalance() {
    try {
      const result = await pointsService.getBalance()
      const data = result.data || {}
      this.setData({
        balance: data.balance || 0,
        frozen: data.frozen || 0,
        available: data.available || 0
      })
    } catch (error) {
      console.error('加载积分余额失败:', error)
    }
  },

  // 加载所有统计数据（用于顶部统计卡片）
  async loadAllStats() {
    try {
      // 获取全部记录用于统计（最多获取100条，或者可以单独调用统计接口）
      const result = await pointsService.getRecords({
        page: 1,
        pageSize: 100,
        type: ''
      })

      const data = result.data || {}
      const allRecords = data.records || []
      const pagination = data.pagination || { total: 0 }

      // 计算统计数据
      let totalIncome = 0
      let totalExpense = 0

      allRecords.forEach(record => {
        if (record.amount > 0) {
          totalIncome += record.amount
        } else {
          totalExpense += Math.abs(record.amount)
        }
      })

      this.setData({
        'allStats.totalIncome': totalIncome,
        'allStats.totalExpense': totalExpense,
        'allStats.totalCount': pagination.total
      })

    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, records: [] })
    this.loadRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreRecords()
    }
  },

  // 加载积分记录（列表数据，不包含统计）
  async loadRecords() {
    try {
      this.setData({ loading: true })

      const result = await pointsService.getRecords({
        page: 1,
        pageSize: this.data.pageSize,
        type: this.data.currentFilter === 'all' ? '' : this.data.currentFilter
      })

      // 安全获取数据
      const data = result.data || {}
      const records = data.records || []
      const pagination = data.pagination || { total: 0, totalPages: 0 }

      this.setData({
        records: records,
        total: pagination.total,
        hasMore: pagination.totalPages > 1,
        page: 1,
        loading: false
      })

    } catch (error) {
      console.error('加载积分记录失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 加载更多记录
  async loadMoreRecords() {
    const nextPage = this.data.page + 1

    try {
      this.setData({ loading: true })

      const result = await pointsService.getRecords({
        page: nextPage,
        pageSize: this.data.pageSize,
        type: this.data.currentFilter === 'all' ? '' : this.data.currentFilter
      })

      const data = result.data || {}
      const newRecords = data.records || []
      const pagination = data.pagination || { totalPages: 0 }

      this.setData({
        records: [...this.data.records, ...newRecords],
        hasMore: nextPage < pagination.totalPages,
        page: nextPage,
        loading: false
      })

    } catch (error) {
      console.error('加载更多记录失败:', error)
      this.setData({ loading: false })
    }
  },


  // 切换筛选
  switchFilter(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      currentFilter: key,
      page: 1,
      records: []
    })
    this.loadRecords()
  },

  // 获取类型图标
  getTypeIcon(type) {
    const iconMap = {
      'register': '🎁',
      'sign_in': '📅',
      'task_complete': '✅',
      'task_publish': '📝',
      'invite': '🤝',
      'invite_bonus': '🎉',
      'profile_complete': '👤',
      'bonus': '💎',
      'refund': '↩️',
      'punish': '⚠️'
    }
    return iconMap[type] || '💰'
  },

  // 获取类型名称
  getTypeName(type) {
    const nameMap = {
      'register': '新用户注册',
      'sign_in': '每日签到',
      'task_complete': '任务完成',
      'task_publish': '发布需求',
      'invite': '邀请好友',
      'invite_bonus': '被邀请奖励',
      'profile_complete': '完善资料',
      'bonus': '奖励',
      'refund': '退款',
      'punish': '惩罚扣除'
    }
    return nameMap[type] || type
  }
})
