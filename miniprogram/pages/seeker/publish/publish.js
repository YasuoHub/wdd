// miniprogram/pages/seeker/publish/publish.js
const needService = require('../../../services/need')
const locationUtil = require('../../../utils/location')
const util = require('../../../utils/util')
const app = getApp()

Page({
  data: {
    isLargeFont: false,
    loading: false,

    // 位置信息
    location: {
      name: '',
      address: '',
      longitude: 0,
      latitude: 0
    },

    // 需求类型
    needTypes: [
      { value: 'weather', name: '实时天气', icon: '☀️' },
      { value: 'traffic', name: '道路拥堵', icon: '🚗' },
      { value: 'shop', name: '店铺营业', icon: '🏪' },
      { value: 'parking', name: '停车场空位', icon: '🅿️' },
      { value: 'queue', name: '排队情况', icon: '👥' },
      { value: 'other', name: '其他', icon: '📝' }
    ],
    selectedType: '',
    selectedTypeName: '',

    // 问题描述
    description: '',
    descriptionLength: 0,

    // 参考图片
    referenceImages: [],

    // 悬赏金额
    points: '',
    minPoints: 10,
    availablePoints: 0,

    // 时限设置
    timeLimits: [
      { value: 15, label: '15分钟' },
      { value: 30, label: '30分钟', default: true },
      { value: 60, label: '1小时' },
      { value: 120, label: '2小时' },
      { value: 0, label: '无限制' }
    ],
    selectedTimeLimit: 30,

    // 匹配范围
    matchRanges: [
      { value: 1, label: '1公里', default: true },
      { value: 2, label: '2公里' },
      { value: 3, label: '3公里' },
      { value: 5, label: '5公里' }
    ],
    selectedMatchRange: 1
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      isLargeFont: (userInfo && userInfo.settings && userInfo.settings.largeFont) || false,
      availablePoints: (userInfo && userInfo.points && userInfo.points.balance - userInfo.points.frozen) || 0,
      showAdvanced: false
    })
    
    // 处理快速发布参数
    if (options.type) {
      this.setData({
        selectedType: options.type,
        selectedTypeName: options.typeName || options.name
      })
    }
  },

  // 切换高级设置
  toggleAdvanced() {
    this.setData({
      showAdvanced: !this.data.showAdvanced
    })
  },

  // 快捷选择积分
  quickPoints(e) {
    const { value } = e.currentTarget.dataset
    this.setData({ points: value })
  },

  // 预览图片
  previewImage(e) {
    const { url } = e.currentTarget.dataset
    wx.previewImage({
      current: url,
      urls: this.data.referenceImages
    })
  },

  // 选择位置
  async chooseLocation() {
    try {
      const location = await locationUtil.chooseLocation()
      console.log('选择位置:', JSON.stringify(location))
      this.setData({ location })
    } catch (error) {
      if (error.errMsg !== 'chooseLocation:fail cancel') {
        wx.showToast({ title: '选择位置失败', icon: 'none' })
      }
    }
  },

  // 选择需求类型
  selectType(e) {
    const { value, name } = e.currentTarget.dataset
    this.setData({
      selectedType: value,
      selectedTypeName: name
    })
  },

  // 输入问题描述
  inputDescription(e) {
    const value = e.detail.value
    this.setData({
      description: value,
      descriptionLength: value.length
    })
  },

  // 选择图片
  chooseImage() {
    const { referenceImages } = this.data
    if (referenceImages.length >= 3) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      })
      return
    }

    wx.chooseMedia({
      count: 3 - referenceImages.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadImages(res.tempFiles)
      }
    })
  },

  // 上传图片
  async uploadImages(tempFiles) {
    wx.showLoading({ title: '上传中...' })

    try {
      const uploadTasks = tempFiles.map(file => {
        const ext = file.tempFilePath.match(/\.[^.]+$/)[0] || '.jpg'
        const cloudPath = `needs/${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`
        return wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath
        })
      })

      const results = await Promise.all(uploadTasks)
      const fileIDs = results.map(res => res.fileID)

      this.setData({
        referenceImages: [...this.data.referenceImages, ...fileIDs]
      })

      wx.hideLoading()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  // 删除图片
  deleteImage(e) {
    const { index } = e.currentTarget.dataset
    const { referenceImages } = this.data
    referenceImages.splice(index, 1)
    this.setData({ referenceImages })
  },

  // 输入积分
  inputPoints(e) {
    this.setData({ points: e.detail.value })
  },

  // 选择时限
  selectTimeLimit(e) {
    const { value } = e.currentTarget.dataset
    this.setData({ selectedTimeLimit: value })
  },

  // 选择匹配范围
  selectMatchRange(e) {
    const { value } = e.currentTarget.dataset
    this.setData({ selectedMatchRange: value })
  },

  // 提交需求
  async submitNeed() {
    const {
      location,
      selectedType,
      selectedTypeName,
      description,
      referenceImages,
      points,
      minPoints,
      selectedTimeLimit,
      selectedMatchRange,
      availablePoints
    } = this.data

    // 表单验证
    if (!location.name) {
      wx.showToast({ title: '请选择求助地点', icon: 'none' })
      return
    }
    if (!selectedType) {
      wx.showToast({ title: '请选择求助类型', icon: 'none' })
      return
    }
    if (!description.trim()) {
      wx.showToast({ title: '请描述您的需求', icon: 'none' })
      return
    }

    const pointsNum = parseInt(points)
    if (!pointsNum || pointsNum < minPoints) {
      wx.showToast({ title: `悬赏积分不能低于${minPoints}`, icon: 'none' })
      return
    }

    if (pointsNum > availablePoints) {
      wx.showModal({
        title: '积分不足',
        content: `当前可用积分${availablePoints}，需要${pointsNum}积分\n\n去赚取积分？`,
        confirmText: '去赚取',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/points/index/index' })
          }
        }
      })
      return
    }

    // 构建需求数据
    const needData = {
      location: location,
      type: selectedType,
      typeName: selectedTypeName,
      description: description,
      referenceImages: referenceImages,
      points: pointsNum,
      timeLimit: selectedTimeLimit,
      matchRange: selectedMatchRange
    }

    console.log('提交需求 - location:', JSON.stringify(location))
    console.log('提交需求 - needData:', JSON.stringify(needData))

    try {
      this.setData({ loading: true })
      const result = await needService.createNeed(needData)
      this.setData({ loading: false })

      wx.showToast({
        title: '发布成功',
        icon: 'success'
      })

      // 跳转到需求详情
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/seeker/need-detail/need-detail?id=${result.data.needId}`
        })
      }, 1500)

    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '发布失败', icon: 'none' })
    }
  }
})
