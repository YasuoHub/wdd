/**
 * 位置服务
 */

const request = require('../utils/request')

module.exports = {
  /**
   * 检查位置权限
   */
  checkLocationAuth() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          const authSetting = res.authSetting
          if (authSetting['scope.userLocation'] === true) {
            resolve('authorized')
          } else if (authSetting['scope.userLocation'] === false) {
            resolve('denied')
          } else {
            resolve('notDetermined')
          }
        },
        fail: () => {
          resolve('unknown')
        }
      })
    })
  },

  /**
   * 申请位置权限
   */
  requestLocationAuth() {
    return new Promise((resolve, reject) => {
      wx.authorize({
        scope: 'scope.userLocation',
        success: () => {
          resolve()
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },

  /**
   * 获取当前位置（带权限检查）
   */
  async getCurrentLocation() {
    // 先检查权限状态
    const authStatus = await this.checkLocationAuth()

    if (authStatus === 'denied') {
      // 用户之前拒绝过，需要引导去设置页面
      throw { type: 'PERMISSION_DENIED', message: '需要位置权限，请前往设置开启' }
    }

    if (authStatus === 'notDetermined') {
      // 还未申请权限，先申请
      try {
        await this.requestLocationAuth()
      } catch (err) {
        throw { type: 'PERMISSION_DENIED', message: '位置权限被拒绝' }
      }
    }

    // 获取位置
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 5000,
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude
          })
        },
        fail: (err) => {
          if (err.errCode === 2) {
            reject({ type: 'TIMEOUT', message: '获取位置超时，请重试' })
          } else {
            reject({ type: 'ERROR', message: '获取位置失败', error: err })
          }
        }
      })
    })
  },

  /**
   * 根据坐标获取地址信息（调用云函数）
   */
  getAddressFromLocation(location) {
    return request.callFunction('common_getAddressFromLocation', {
      latitude: location.latitude,
      longitude: location.longitude
    }).then(res => res.data)
  }
}