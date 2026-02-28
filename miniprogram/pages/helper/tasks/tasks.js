// pages/helper/tasks/tasks.js
const needService = require('../../../services/need')
const util = require('../../../utils/util')

Page({
  data: {
    userInfo: null,
    isLargeFont: false,
    
    // 当前选中的标签
    currentTab: 'executing',
    
    // 标签列表
    tabs: [
      { key: 'executing', name: '进行中', icon: '🚀' },
      { key: 'completed', name: '已完成', icon: '✅' },
      { key: 'cancelled', name: '已取消', icon: '❌' }
    ],
    
    // 任务列表
    taskList: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10
  },

  onLoad() {
    this.setData({
      userInfo: wx.getStorageSync('userInfo'),
      isLargeFont: wx.getStorageSync('userInfo') && wx.getStorageSync('userInfo').settings && wx.getStorageSync('userInfo').settings.largeFont || false
    })
    this.loadTaskList()
  },

  onShow() {
    this.loadTaskList()
  },

  onPullDownRefresh() {
    this.refreshList().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreTasks()
    }
  },

  // 切换标签
  switchTab(e) {
    const { key } = e.currentTarget.dataset
    this.setData({ 
      currentTab: key,
      taskList: [],
      page: 1,
      hasMore: true
    })
    this.loadTaskList()
  },

  // 刷新列表
  async refreshList() {
    this.setData({ page: 1, taskList: [] })
    await this.loadTaskList()
  },

  // 加载任务列表
  async loadTaskList() {
    try {
      this.setData({ loading: true })
      
      const result = await needService.getNeedList({
        role: 'helper',
        status: this.data.currentTab,
        page: this.data.page,
        pageSize: this.data.pageSize
      })
      
      const tasks = result.data.list || []
      
      // 格式化数据
      const formattedTasks = tasks.map(task => ({
        ...task,
        formattedTime: util.formatDate(task.createdAt),
        statusText: this.getStatusText(task.status),
        statusClass: task.status
      }))
      
      this.setData({
        taskList: formattedTasks,
        hasMore: tasks.length >= this.data.pageSize,
        loading: false
      })
    } catch (error) {
      console.error('加载任务列表失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 加载更多
  async loadMoreTasks() {
    this.setData({ page: this.data.page + 1 })
    await this.loadTaskList()
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'executing': '进行中',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  },

  // 查看任务详情
  viewTaskDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/helper/task-detail/task-detail?id=${id}`
    })
  },

  // 完成任务
  async completeTask(e) {
    const { id } = e.currentTarget.dataset
    
    const confirmed = await util.showConfirm(
      '确认完成',
      '确认已完成该任务？',
      { confirmText: '确认完成' }
    )
    
    if (!confirmed) return
    
    try {
      wx.showLoading({ title: '处理中...' })
      await needService.completeNeed(id)
      wx.hideLoading()
      
      wx.showToast({ title: '操作成功', icon: 'success' })
      this.refreshList()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    }
  },

  // 联系求助者
  contactSeeker(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/chat/chat?needId=${id}`
    })
  },

  // 跳转到帮助者首页
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})