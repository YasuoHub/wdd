/**
 * 位置服务
 */

module.exports = {
  /**
   * 获取当前位置
   */
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude
          })
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },

  /**
   * 根据坐标获取地址信息（使用腾讯地图）
   */
  getAddressFromLocation(location) {
    return new Promise((resolve, reject) => {
      // 使用微信小程序内置的逆地址解析
      wx.request({
        url: 'https://apis.map.qq.com/ws/geocoder/v1/',
        data: {
          location: `${location.latitude},${location.longitude}`,
          key: 'LTXBZ-6QBEW-T7CRL-YCDUQ-WHXFK-GSFRJ',
          get_poi: 0
        },
        success: (res) => {
          if (res.data.status === 0) {
            const result = res.data.result
            resolve({
              name: result.formatted_addresses.recommend || result.address,
              address: result.address,
              province: result.address_component.province,
              city: result.address_component.city,
              district: result.address_component.district
            })
          } else {
            resolve({
              name: '未知位置',
              address: ''
            })
          }
        },
        fail: () => {
          resolve({
            name: '位置获取失败',
            address: ''
          })
        }
      })
    })
  }
}