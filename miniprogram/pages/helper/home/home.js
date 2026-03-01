// pages/helper/home/home.js
const matchService = require('../../../services/match')
const locationService = require('../../../services/location')
const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    userInfo: null,
    isLargeFont: false,

    // 需求列表
    needList: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 10,

    // 筛选
    currentTab: 'nearby', // nearby:附近, all:全部
    tabs: [
      { key: 'nearby', name: '附近需求', icon: '📍' },
      { key: 'all', name: '全部需求', icon: '🌐' }
    ],

    // 位置
    currentLocation: null,
    locationName: '定位中...',
    hasLocation: false, // 是否已获取位置
    locationError: null, // 位置错误信息

    // 任务统计
    taskStats: {
      ongoing: 0,
      completed: 0,
      total: 0
    }
  },

  onLoad() {
    this.setData({
      userInfo: wx.getStorageSync('userInfo'),
      isLargeFont: wx.getStorageSync('userInfo') && wx.getStorageSync('userInfo').settings && wx.getStorageSync('userInfo').settings.largeFont || false
    })
    
    this.getLocation()
    this.loadTaskStats()
  },

  onShow() {
    // 如果有位置则刷新列表
    if (this.data.currentLocation) {
      this.refreshList()
    }
    // 如果没有位置且之前拒绝了权限，检查权限状态
    else if (this.data.locationError === 'PERMISSION_DENIED') {
      this.checkLocationPermission()
    }
  },

  // 检查位置权限状态
  async checkLocationPermission() {
    const authStatus = await locationService.checkLocationAuth()
    if (authStatus === 'authorized') {
      // 用户已授权，重新获取位置
      this.getLocation()
    }
  },

  onPullDownRefresh() {
    this.refreshList().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreNeeds()
    }
  },

  // 获取当前位置
  async getLocation() {
    try {
      this.setData({
        loading: true,
        locationError: null
      })

      const location = await locationService.getCurrentLocation()
      const address = await locationService.getAddressFromLocation(location)

      this.setData({
        currentLocation: location,
        locationName: address && address.name || '当前位置',
        hasLocation: true,
        locationError: null
      })

      // 更新用户位置到服务器
      this.updateUserLocation(location)

      // 获取到位置后才加载需求列表
      this.loadNeedList()
    } catch (error) {
      console.error('获取位置失败:', error)

      if (error.type === 'PERMISSION_DENIED') {
        this.setData({
          hasLocation: false,
          locationError: 'PERMISSION_DENIED',
          locationName: '需要位置权限',
          loading: false,
          needList: []
        })

        // 权限被拒绝，引导用户去设置
        const res = await wx.showModal({
          title: '需要位置权限',
          content: '获取附近任务需要您的位置信息，是否前往设置开启？',
          confirmText: '去开启',
          cancelText: '手动选择'
        })

        if (res.confirm) {
          // 打开设置页面
          wx.openSetting({
            success: (settingRes) => {
              if (settingRes.authSetting['scope.userLocation']) {
                // 用户开启了权限，重新获取位置
                this.getLocation()
              }
            }
          })
          return
        }
        return
      }

      // 其他错误（如超时）
      this.setData({
        hasLocation: false,
        locationError: error.type || 'ERROR',
        locationName: '点击选择位置',
        loading: false,
        needList: []
      })
    }
  },

  // 更新用户位置到服务器
  async updateUserLocation(location) {
    try {
      const userService = require('../../../services/user')
      await userService.updateLocation(location)
      console.log('位置已更新到服务器')
    } catch (error) {
      console.log('更新位置失败:', error)
    }
  },

  // 刷新列表
  async refreshList() {
    this.setData({ page: 1, needList: [] })
    await this.loadNeedList()
  },

  // 加载需求列表
  async loadNeedList() {
    // 没有位置时不加载数据
    if (!this.data.currentLocation) {
      this.setData({
        loading: false,
        needList: [],
        hasMore: false
      })
      return
    }

    try {
      this.setData({ loading: true })
      
      const params = {
        longitude: this.data.currentLocation.longitude,
        latitude: this.data.currentLocation.latitude,
        type: this.data.currentTab,
        page: this.data.page,
        pageSize: this.data.pageSize
      }
      
      const result = await matchService.getTaskList(params)
      const needs = result.data.needs || []
      
      // 格式化数据
      const formattedNeeds = needs.map(need => ({
        ...need,
        distanceText: this.formatDistance(need.distance),
        formattedTime: util.formatDate(need.createdAt),
        timeLeft: this.calculateTimeLeft(need.deadline)
      }))
      
      this.setData({
        needList: formattedNeeds,
        hasMore: needs.length >= this.data.pageSize,
        loading: false
      })
    } catch (error) {
      console.error('加载需求列表失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  // 加载更多
  async loadMoreNeeds() {
    this.setData({ page: this.data.page + 1 })
    await this.loadNeedList()
  },

  // 加载任务统计
  async loadTaskStats() {
    try {
      // 这里应该调用统计API
      // 暂时使用模拟数据
      this.setData({
        taskStats: {
          ongoing: 3,
          completed: 15,
          total: 18
        }
      })
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  },

  // 切换Tab
  switchTab(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ currentTab: key, page: 1, needList: [] })
    this.loadNeedList()
  },

  // 选择位置
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          currentLocation: {
            longitude: res.longitude,
            latitude: res.latitude
          },
          locationName: res.name || res.address,
          hasLocation: true,
          locationError: null
        })
        this.refreshList()
      },
      fail: (err) => {
        console.log('选择位置失败:', err)
        // 用户取消选择时不做任何处理
      }
    })
  },

  // 查看需求详情
  viewNeedDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/helper/task-detail/task-detail?id=${id}`
    })
  },

  // 接受任务
  async acceptTask(e) {
    const { id } = e.currentTarget.dataset
    
    const confirmed = await util.showConfirm(
      '接受任务',
      '确认接受此任务？接受后需在规定时间内完成。',
      { confirmText: '接受' }
    )
    
    if (!confirmed) return
    
    try {
      wx.showLoading({ title: '处理中...' })
      await matchService.acceptTask(id)
      wx.hideLoading()
      
      wx.showToast({ title: '接受成功', icon: 'success' })
      
      // 跳转到任务详情
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/helper/task-detail/task-detail?id=${id}`
        })
      }, 1500)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '接受失败', icon: 'none' })
    }
  },

  // 格式化距离
  formatDistance(distance) {
    if (!distance) return ''
    if (distance < 1) {
      return Math.round(distance * 1000) + 'm'
    }
    return distance.toFixed(1) + 'km'
  },

  // 计算剩余时间
  calculateTimeLeft(deadline) {
    if (!deadline) return ''
    const now = new Date().getTime()
    const end = new Date(deadline).getTime()
    const diff = end - now
    
    if (diff <= 0) return '已超时'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours > 24) {
      return Math.floor(hours / 24) + '天'
    }
    return hours + '小时'
  },

  // 跳转到我的任务
  goToMyTasks() {
    wx.navigateTo({
      url: '/pages/helper/tasks/tasks'
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '问当地 - 帮助身边需要帮助的人',
      path: '/pages/helper/home/home'
    }
  }
})