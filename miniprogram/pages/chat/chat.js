// miniprogram/pages/chat/chat.js
const chatService = require('../../services/chat')
const needService = require('../../services/need')
const util = require('../../utils/util')
const app = getApp()

Page({
  data: {
    needId: '',
    needInfo: null,
    messages: [],
    inputValue: '',
    scrollToMessage: '',
    isLargeFont: false,
    userInfo: null,
    isSeeker: false,
    loading: true,
    hasMore: true,
    page: 1,

    // 录音相关
    isRecording: false,
    recordStartTime: 0
  },

  onLoad(options) {
    const { needId } = options
    this.setData({
      needId,
      userInfo: wx.getStorageSync('userInfo'),
      isLargeFont: wx.getStorageSync('userInfo')?.settings?.largeFont || false
    })

    this.loadNeedInfo()
    this.loadMessages()
    this.startRealtimeListener()
  },

  onUnload() {
    this.stopRealtimeListener()
  },

  // 加载需求信息
  async loadNeedInfo() {
    try {
      const result = await needService.getNeedDetail(this.data.needId)
      this.setData({
        needInfo: result.data,
        isSeeker: result.data.seekerId === this.data.userInfo._id,
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 加载消息列表
  async loadMessages(refresh = false) {
    try {
      const result = await chatService.getMessages(this.data.needId, {
        page: refresh ? 1 : this.data.page,
        pageSize: 20
      })

      // 安全获取消息数据
      const data = result.data || {}
      const messageList = data.messages || []
      const messages = messageList.map(msg => ({
        ...msg,
        isMe: msg.senderId === this.data.userInfo._id,
        showTime: this.shouldShowTime(msg, messageList)
      }))

      // 安全获取 hasMore
      const hasMore = data.hasMore !== undefined ? data.hasMore : false

      if (refresh) {
        this.setData({
          messages: messages,
          page: 1,
          hasMore: hasMore,
          scrollToMessage: messages[messages.length - 1]?._id || ''
        })
      } else {
        this.setData({
          messages: [...messages, ...this.data.messages],
          hasMore: hasMore
        })
      }
    } catch (error) {
      console.error('加载消息失败:', error)
    }
  },

  // 判断是否显示时间
  shouldShowTime(msg, messages) {
    const index = messages.findIndex(m => m._id === msg._id)
    if (index === 0) return true

    const prevMsg = messages[index - 1]
    const timeDiff = new Date(msg.createdAt) - new Date(prevMsg.createdAt)
    return timeDiff > 5 * 60 * 1000 // 5分钟
  },

  // 启动实时监听
  startRealtimeListener() {
    const db = wx.cloud.database()
    this.watcher = db.collection('messages')
      .where({
        needId: this.data.needId
      })
      .watch({
        onChange: (snapshot) => {
          if (snapshot.docChanges.length > 0) {
            this.loadMessages(true)
          }
        },
        onError: (err) => {
          console.error('实时监听失败:', err)
        }
      })
  },

  // 停止实时监听
  stopRealtimeListener() {
    if (this.watcher) {
      this.watcher.close()
    }
  },

  // 输入消息
  inputMessage(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // 发送文字消息
  async sendTextMessage() {
    const { inputValue, needId } = this.data
    if (!inputValue.trim()) return

    try {
      await chatService.sendMessage(needId, 'text', inputValue)
      this.setData({ inputValue: '' })
    } catch (error) {
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  // 发送图片消息
  async sendImageMessage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image']
      })

      const tempFile = res.tempFiles[0]

      // 上传图片
      const cloudPath = `chat/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFile.tempFilePath
      })

      // 发送消息
      await chatService.sendMessage(this.data.needId, 'image', uploadRes.fileID, {
        width: tempFile.width,
        height: tempFile.height,
        size: tempFile.size
      })
    } catch (error) {
      console.error('发送图片失败:', error)
    }
  },

  // 预览图片
  previewImage(e) {
    const { url } = e.currentTarget.dataset
    const urls = this.data.messages
      .filter(m => m.type === 'image')
      .map(m => m.content)

    wx.previewImage({ current: url, urls })
  },

  // 加载更多消息
  loadMoreMessages() {
    if (!this.data.hasMore) return
    this.setData({ page: this.data.page + 1 })
    this.loadMessages()
  },

  // 完成任务
  async completeNeed() {
    const confirmed = await util.showConfirm(
      '确认完成',
      '确认任务已完成并结算积分给帮助者？',
      { confirmText: '确认完成' }
    )

    if (!confirmed) return

    wx.navigateTo({
      url: `/pages/reviews/reviews?needId=${this.data.needId}&type=complete`
    })
  },

  // 客服介入
  async support() {
    wx.navigateTo({
      url: `/pages/support/support?needId=${this.data.needId}`
    })
  }
})
