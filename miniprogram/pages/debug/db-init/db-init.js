// 数据库初始化页面
Page({
  data: {
    logs: [],
    loading: false
  },

  onLoad() {
    this.addLog('页面加载完成，点击下方按钮开始初始化')
  },

  addLog(msg) {
    const logs = this.data.logs
    const time = new Date().toLocaleTimeString()
    logs.unshift(`[${time}] ${msg}`)
    this.setData({ logs })
  },

  // 初始化数据库
  async initDatabase() {
    this.setData({ loading: true })
    this.addLog('开始初始化数据库...')

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'admin_initDatabase'
      })

      if (result.code === 0) {
        this.addLog('✅ 初始化完成!')

        result.data.success.forEach(item => {
          this.addLog(`✅ ${item}`)
        })

        result.data.existing.forEach(item => {
          this.addLog(`ℹ️ ${item}`)
        })

        if (result.data.failed.length > 0) {
          this.addLog('⚠️ 以下项目失败:')
          result.data.failed.forEach(item => {
            this.addLog(`❌ ${item}`)
          })
        }

        wx.showToast({ title: '初始化完成', icon: 'success' })
      } else {
        this.addLog(`❌ 失败: ${result.message}`)
        wx.showToast({ title: '初始化失败', icon: 'none' })
      }
    } catch (error) {
      this.addLog(`❌ 错误: ${error.message || error}`)
      wx.showToast({ title: '调用失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 清除日志
  clearLogs() {
    this.setData({ logs: [] })
  }
})
