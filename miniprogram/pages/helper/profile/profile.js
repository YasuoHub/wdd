// pages/helper/profile/profile.js
const userService = require('../../../services/user')
const util = require('../../../utils/util')

Page({
  data: {
    userInfo: null,
    isLargeFont: false,
    loading: false,
    isEdit: false,
    
    // 表单数据
    form: {
      helpTypes: [],
      locations: []
    },
    
    // 可选帮助类型
    helpTypeOptions: [
      { key: 'scenic', name: '景点实况', icon: '🏞️' },
      { key: 'food', name: '美食探店', icon: '🍜' },
      { key: 'shopping', name: '购物指南', icon: '🛍️' },
      { key: 'traffic', name: '交通路况', icon: '🚗' },
      { key: 'weather', name: '天气情况', icon: '🌤️' },
      { key: 'hotel', name: '酒店住宿', icon: '🏨' },
      { key: 'queue', name: '排队状况', icon: '👥' },
      { key: 'event', name: '活动演出', icon: '🎭' },
      { key: 'other', name: '其他需求', icon: '📋' }
    ],
    
    // 当前编辑的位置
    editingLocation: null,
    showLocationModal: false,
    editingIndex: -1
  },

  onLoad(options) {
    const { mode } = options
    this.setData({
      isEdit: mode === 'edit',
      userInfo: wx.getStorageSync('userInfo'),
      isLargeFont: wx.getStorageSync('userInfo') && wx.getStorageSync('userInfo').settings && wx.getStorageSync('userInfo').settings.largeFont || false
    })
    this.loadUserInfo()
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      this.setData({ loading: true })
      const result = await userService.getUserInfo()
      const userData = result.data
      
      this.setData({
        userInfo: userData,
        form: {
          helpTypes: userData.helperInfo && userData.helperInfo.helpTypes || [],
          locations: userData.helperInfo && userData.helperInfo.locations || []
        },
        loading: false
      })
    } catch (error) {
      console.error('加载用户信息失败:', error)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 选择帮助类型
  toggleHelpType(e) {
    const { key } = e.currentTarget.dataset
    const { helpTypes } = this.data.form
    
    const index = helpTypes.indexOf(key)
    if (index > -1) {
      helpTypes.splice(index, 1)
    } else {
      helpTypes.push(key)
    }
    
    this.setData({
      'form.helpTypes': helpTypes
    })
  },

  // 添加服务位置
  addLocation() {
    // 限制最多3个位置
    if (this.data.form.locations.length >= 3) {
      wx.showToast({ title: '最多可设置3个服务地点', icon: 'none' })
      return
    }

    wx.chooseLocation({
      success: (res) => {
        this.setData({
          editingLocation: {
            name: res.name,
            address: res.address,
            longitude: res.longitude,
            latitude: res.latitude,
            radius: 5000,
            radiusText: '5.0公里'
          },
          showLocationModal: true,
          editingIndex: -1
        })
      },
      fail: (err) => {
        console.error('选择位置失败:', err)
        wx.showToast({ title: '选择位置失败', icon: 'none' })
      }
    })
  },

  // 编辑位置
  editLocation(e) {
    const { index } = e.currentTarget.dataset
    const location = this.data.form.locations[index]
    this.setData({
      editingLocation: { ...location },
      showLocationModal: true,
      editingIndex: index
    })
  },

  // 删除位置
  deleteLocation(e) {
    const { index } = e.currentTarget.dataset
    const locations = this.data.form.locations
    locations.splice(index, 1)
    this.setData({
      'form.locations': locations
    })
  },

  // 关闭位置弹窗
  closeLocationModal() {
    this.setData({
      showLocationModal: false,
      editingLocation: null,
      editingIndex: -1
    })
  },

  // 修改范围
  onRadiusChange(e) {
    const radius = parseInt(e.detail.value)
    const radiusText = radius >= 1000 
      ? (radius / 1000).toFixed(1) + '公里'
      : radius + '米'
    this.setData({
      'editingLocation.radius': radius,
      'editingLocation.radiusText': radiusText
    })
  },

  // 保存位置
  saveLocation() {
    const { editingLocation, editingIndex, form } = this.data
    if (!editingLocation) return
    
    // 生成显示文本
    const radius = editingLocation.radius
    const radiusText = radius >= 1000 
      ? (radius / 1000).toFixed(1) + '公里'
      : radius + '米'
    editingLocation.radiusText = radiusText
    
    const locations = [...form.locations]
    if (editingIndex > -1) {
      locations[editingIndex] = editingLocation
    } else {
      locations.push(editingLocation)
    }
    
    this.setData({
      'form.locations': locations,
      showLocationModal: false,
      editingLocation: null,
      editingIndex: -1
    })
  },

  // 提交表单
  async submitForm() {
    const { form, userInfo } = this.data
    
    if (form.helpTypes.length === 0) {
      wx.showToast({ title: '请至少选择一种帮助类型', icon: 'none' })
      return
    }
    
    if (form.locations.length === 0) {
      wx.showToast({ title: '请至少添加一个服务位置', icon: 'none' })
      return
    }
    
    try {
      wx.showLoading({ title: '保存中...' })
      
      await userService.completeProfile({
        role: 'helper',
        helperInfo: {
          helpTypes: form.helpTypes,
          locations: form.locations,
          isAvailable: true
        }
      })
      
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      
      const updatedUserInfo = {
        ...userInfo,
        role: 'helper',
        helperInfo: {
          helpTypes: form.helpTypes,
          locations: form.locations,
          isAvailable: true
        }
      }
      wx.setStorageSync('userInfo', updatedUserInfo)
      
      setTimeout(() => {
        if (this.data.isEdit) {
          wx.navigateBack()
        } else {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }, 1500)
      
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    }
  }
})