// pages/seeker/needs/needs.js
const needService = require('../../../services/need')
const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    needs: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 10,
    isLargeFont: false,

    // 筛选
    currentFilter: 'all',
    filters: [
      { key: 'all', name: '全部', status: '' },
      { key: 'matching', name: '匹配中', status: 'matching' },
      { key: 'executing', name: '进行中', status: 'executing' },
      { key: 'completed', name: '已完成', status: 'completed' }
    ]
  },

  onLoad() {
    this.setData({
      isLargeFont: app.globalData.isLargeFont || false
    })
    this.loadNeeds()
  },

  onShow() {
    this.loadNeeds()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, needs: [] })
    this.loadNeeds().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreNeeds()
    }
  },

  // 加载需求列表
  async loadNeeds() {
    try {
      this.setData({ loading: true })

      const filter = this.data.filters.find(f => f.key === this.data.currentFilter)

      const result = await needService.getNeedList({
        page: 1,
        pageSize: this.data.pageSize,
        status: filter ? filter.status : '',
        role: 'seeker'
      })

      // 安全获取数据
      const data = result.data || {}
      const list = data.list || []
      const pagination = data.pagination || { totalPages: 0 }

      this.setData({
        needs: list,
        hasMore: pagination.totalPages > 1,
        page: 1,
        loading: false
      })

    } catch (error) {
      console.error('加载需求列表失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 加载更多需求
  async loadMoreNeeds() {
    const nextPage = this.data.page + 1

    try {
      this.setData({ loading: true })

      const filter = this.data.filters.find(f => f.key === this.data.currentFilter)

      const result = await needService.getNeedList({
        page: nextPage,
        pageSize: this.data.pageSize,
        status: filter ? filter.status : '',
        role: 'seeker'
      })

      const data = result.data || {}
      const newList = data.list || []
      const pagination = data.pagination || { totalPages: 0 }

      this.setData({
        needs: [...this.data.needs, ...newList],
        hasMore: nextPage < pagination.totalPages,
        page: nextPage,
        loading: false
      })

    } catch (error) {
      console.error('加载更多需求失败:', error)
      this.setData({ loading: false })
    }
  },

  // 切换筛选
  switchFilter(e) {
    const { key } = e.currentTarget.dataset
    this.setData({
      currentFilter: key,
      page: 1,
      needs: []
    })
    this.loadNeeds()
  },

  // 查看需求详情
  viewNeedDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/seeker/need-detail/need-detail?id=${id}`
    })
  },

  // 取消需求
  async cancelNeed(e) {
    const { id } = e.currentTarget.dataset

    const confirmed = await util.showConfirm(
      '确认取消',
      '取消后积分将退还，是否确认取消该需求？',
      { confirmText: '确认取消' }
    )

    if (!confirmed) return

    try {
      wx.showLoading({ title: '取消中...' })
      await needService.cancelNeed(id)
      wx.hideLoading()

      wx.showToast({ title: '已取消', icon: 'success' })
      setTimeout(() => {
        this.loadNeeds()
      }, 1500)

    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '取消失败', icon: 'none' })
    }
  },

  // 去发布需求
  goToPublish() {
    wx.switchTab({
      url: '/pages/seeker/home/home'
    })
  },

  // 获取状态样式类
  getStatusClass(status) {
    const classMap = {
      'pending': 'status-pending',
      'matching': 'status-matching',
      'executing': 'status-executing',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
      'disputed': 'status-disputed'
    }
    return classMap[status] || ''
  },

  // 获取类型图标
  getTypeIcon(type) {
    const iconMap = {
      'scenic': '🏞️',
      'food': '🍜',
      'shopping': '🛍️',
      'traffic': '🚗',
      'weather': '🌤️',
      'hotel': '🏨',
      'queue': '👥',
      'event': '🎭',
      'other': '📋'
    }
    return iconMap[type] || '📍'
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 什么都不做，只是阻止冒泡
  }
})
