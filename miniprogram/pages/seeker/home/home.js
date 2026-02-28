// pages/seeker/home/home.js
const needService = require('../../../services/need')
const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    userInfo: null,
    isLargeFont: false,
    loading: true,
    refreshing: false,
    
    // 统计数据
    stats: {
      totalRequests: 0,
      pendingRequests: 0,
      completedRequests: 0
    },
    
    // 需求列表
    needs: [],
    hasMore: true,
    page: 1,
    
    // 需求类型
    needTypes: [
      { value: 'weather', name: '实时天气', icon: '☀️', color: '#F59E0B' },
      { value: 'traffic', name: '道路拥堵', icon: '🚗', color: '#EF4444' },
      { value: 'shop', name: '店铺营业', icon: '🏪', color: '#8B5CF6' },
      { value: 'parking', name: '停车场空位', icon: '🅿️', color: '#06B6D4' },
      { value: 'queue', name: '排队情况', icon: '👥', color: '#EC4899' },
      { value: 'other', name: '其他', icon: '📝', color: '#64748B' }
    ]
  },

  onLoad() {
    this.loadUserInfo()
    this.loadData()
  },

  onShow() {
    // 每次显示都刷新数据
    this.loadData()
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true, page: 1 })
    this.loadData().then(() => {
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreNeeds()
    }
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo: userInfo,
        isLargeFont: userInfo.settings?.largeFont || false
      })
    }
  },

  // 加载所有数据
  async loadData() {
    try {
      this.setData({ loading: true })
      await Promise.all([
        this.loadStats(),
        this.loadNeeds()
      ])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      // 这里应该调用专门的统计接口
      // 临时使用模拟数据
      const userInfo = this.data.userInfo
      if (userInfo && userInfo.seekerInfo) {
        this.setData({
          stats: {
            totalRequests: userInfo.seekerInfo.totalRequests || 0,
            pendingRequests: 0, // 需要计算
            completedRequests: userInfo.seekerInfo.completedRequests || 0
          }
        })
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  },

  // 加载需求列表
  async loadNeeds() {
    try {
      const result = await needService.getNeedList({
        page: 1,
        pageSize: 10
      })

      // 安全获取数据
      const data = result.data || {}
      const needs = (data.list || []).map(item => ({
        ...item,
        formattedTime: util.formatDate(item.createdAt),
        statusText: this.getStatusText(item.status),
        statusColor: this.getStatusColor(item.status)
      }))

      // 安全获取分页信息
      const pagination = data.pagination || { totalPages: 0 }

      this.setData({
        needs: needs,
        hasMore: pagination.totalPages > 1,
        page: 1
      })

      // 更新待处理数量
      const pendingCount = needs.filter(n => ['matching', 'executing'].includes(n.status)).length
      this.setData({
        'stats.pendingRequests': pendingCount
      })

    } catch (error) {
      console.error('加载需求列表失败:', error)
    }
  },

  // 加载更多需求
  async loadMoreNeeds() {
    try {
      const nextPage = this.data.page + 1
      const result = await needService.getNeedList({
        page: nextPage,
        pageSize: 10
      })

      // 安全获取数据
      const data = result.data || {}
      const newNeeds = (data.list || []).map(item => ({
        ...item,
        formattedTime: util.formatDate(item.createdAt),
        statusText: this.getStatusText(item.status),
        statusColor: this.getStatusColor(item.status)
      }))

      // 安全获取分页信息
      const pagination = data.pagination || { page: nextPage, totalPages: 0 }

      this.setData({
        needs: [...this.data.needs, ...newNeeds],
        hasMore: pagination.page < pagination.totalPages,
        page: nextPage
      })

    } catch (error) {
      console.error('加载更多需求失败:', error)
    }
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'matching': '匹配中',
      'executing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消',
      'disputed': '纠纷中'
    }
    return statusMap[status] || status
  },

  // 获取状态颜色
  getStatusColor(status) {
    const colorMap = {
      'matching': '#0EA5E9',
      'executing': '#F59E0B',
      'completed': '#10B981',
      'cancelled': '#94A3B8',
      'disputed': '#EF4444'
    }
    return colorMap[status] || '#64748B'
  },

  // 跳转到发布需求
  goToPublish() {
    wx.navigateTo({
      url: '/pages/seeker/publish/publish'
    })
  },

  // 跳转到需求详情
  goToDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/seeker/need-detail/need-detail?id=${id}`
    })
  },

  // 选择需求类型快速发布
  quickPublish(e) {
    const { type, name, icon, color } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/seeker/publish/publish?type=${type}&typeName=${name}&icon=${icon}&color=${color}`
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '问当地 - 快速获取异地信息',
      path: '/pages/index/index'
    }
  }
})
