/**
 * 位置服务
 */

/**
 * 获取当前位置
 */
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy
        })
      },
      fail: (err) => {
        console.error('获取位置失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 选择位置
 */
function chooseLocation() {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success: (res) => {
        resolve({
          name: res.name,
          address: res.address,
          latitude: res.latitude,
          longitude: res.longitude
        })
      },
      fail: (err) => {
        if (err.errMsg !== 'chooseLocation:fail cancel') {
          console.error('选择位置失败:', err)
        }
        reject(err)
      }
    })
  })
}

/**
 * 使用腾讯地图解析地址
 * @param {string} address 地址
 */
function geocoder(address) {
  return new Promise((resolve, reject) => {
    // 这里需要调用腾讯地图API
    // 由于小程序限制，建议在云函数中调用
    reject(new Error('请在云函数中调用'))
  })
}

/**
 * 计算两点距离（公里）
 * @param {number} lat1 纬度1
 * @param {number} lng1 经度1
 * @param {number} lat2 纬度2
 * @param {number} lng2 经度2
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const radLat1 = lat1 * Math.PI / 180.0
  const radLat2 = lat2 * Math.PI / 180.0
  const a = radLat1 - radLat2
  const b = lng1 * Math.PI / 180.0 - lng2 * Math.PI / 180.0
  const s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)))
  const EARTH_RADIUS = 6378.137
  const distance = s * EARTH_RADIUS
  return Math.round(distance * 10000) / 10000
}

/**
 * 格式化距离显示
 * @param {number} distance 距离（米）
 */
function formatDistance(distance) {
  if (distance < 1000) {
    return Math.round(distance) + '米'
  } else {
    return (distance / 1000).toFixed(1) + '公里'
  }
}

module.exports = {
  getCurrentLocation,
  chooseLocation,
  geocoder,
  calculateDistance,
  formatDistance
}
