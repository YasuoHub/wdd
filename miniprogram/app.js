// miniprogram/app.js
App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    isLargeFont: false
  },

  onLaunch() {
    // 初始化CloudBase
    wx.cloud.init({
      env: 'wdd-2grpiy1r6f9f4cf2',
      traceUser: true
    })

    // 获取系统信息
    this.getSystemInfo()

    // 检查登录状态
    this.checkLoginStatus()

    // 更新用户当前位置
    this.updateUserLocation()

    // 设置全局错误处理
    this.setupErrorHandling()
  },

  onShow() {
    // 应用显示时更新
  },

  onHide() {
    // 应用隐藏时处理
  },

  onError(err) {
    console.error('全局错误:', err)
  },

  onPageNotFound(res) {
    wx.redirectTo({
      url: '/pages/index/index'
    })
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.globalData.systemInfo = systemInfo
      console.log('系统信息:', systemInfo)
    } catch (e) {
      console.error('获取系统信息失败:', e)
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    try {
      const userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.globalData.userInfo = userInfo
        this.globalData.isLargeFont = userInfo.settings?.largeFont || false
        console.log('已登录用户:', userInfo.nickname)
      }
    } catch (e) {
      console.error('检查登录状态失败:', e)
    }
  },

  // 设置全局错误处理
  setupErrorHandling() {
    // 重写console.error以记录到服务器（生产环境）
    if (this.globalData.systemInfo?.environment !== 'development') {
      const originalError = console.error
      console.error = (...args) => {
        originalError.apply(console, args)
        // 可以在这里发送错误日志到服务器
      }
    }
  },

  // 更新用户信息
  updateUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    wx.setStorageSync('userInfo', userInfo)
  },

  // 清除用户数据
  clearUserData() {
    this.globalData.userInfo = null
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('token')
  },

  // 获取用户信息
  getUserInfo() {
    return this.globalData.userInfo
  },

  // 检查是否登录
  isLoggedIn() {
    return !!this.globalData.userInfo
  },

  // 切换大字体模式
  toggleLargeFont() {
    const newValue = !this.globalData.isLargeFont
    this.globalData.isLargeFont = newValue

    const userInfo = this.globalData.userInfo
    if (userInfo) {
      userInfo.settings = userInfo.settings || {}
      userInfo.settings.largeFont = newValue
      this.updateUserInfo(userInfo)
    }

    return newValue
  },

  // 更新用户当前位置
  async updateUserLocation() {
    try {
      // 检查是否登录
      const userInfo = this.globalData.userInfo
      if (!userInfo || !userInfo._id) return

      // 获取当前位置
      const location = await this.getCurrentLocation()
      if (!location) return

      // 保存到全局
      this.globalData.currentLocation = location

      // 更新到服务器（使用云函数）
      wx.cloud.callFunction({
        name: 'user_updateLocation',
        data: {
          longitude: location.longitude,
          latitude: location.latitude,
          updatedAt: new Date().toISOString()
        }
      }).catch(err => {
        console.log('更新位置到服务器失败:', err)
      })

      console.log('用户位置已更新:', location)
    } catch (error) {
      console.error('更新用户位置失败:', error)
    }
  },

  // 获取当前位置
  getCurrentLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            longitude: res.longitude,
            latitude: res.latitude,
            accuracy: res.accuracy,
            timestamp: Date.now()
          })
        },
        fail: (err) => {
          console.log('获取位置失败:', err)
          resolve(null)
        }
      })
    })
  }
})
