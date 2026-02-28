/**
 * 通用工具函数
 */

/**
 * 格式化时间
 * @param {string|number|Date} date 时间
 * @param {string} format 格式
 */
function formatTime(date, format = 'YYYY-MM-DD HH:mm') {
  if (!date) return ''

  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 格式化日期（今天/昨天/前天/具体日期）
 * @param {string|number|Date} date 时间
 */
function formatDate(date) {
  if (!date) return ''

  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.floor((today - target) / (1000 * 60 * 60 * 24))

  if (diff === 0) {
    return '今天 ' + formatTime(d, 'HH:mm')
  } else if (diff === 1) {
    return '昨天 ' + formatTime(d, 'HH:mm')
  } else if (diff === 2) {
    return '前天 ' + formatTime(d, 'HH:mm')
  } else if (diff < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[d.getDay()] + ' ' + formatTime(d, 'HH:mm')
  } else {
    return formatTime(d, 'MM-DD HH:mm')
  }
}

/**
 * 防抖
 * @param {function} fn 函数
 * @param {number} delay 延迟时间
 */
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流
 * @param {function} fn 函数
 * @param {number} interval 间隔时间
 */
function throttle(fn, interval = 300) {
  let lastTime = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastTime >= interval) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

/**
 * 生成UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 获取设备ID
 */
function getDeviceId() {
  let deviceId = wx.getStorageSync('deviceId')
  if (!deviceId) {
    deviceId = generateUUID()
    wx.setStorageSync('deviceId', deviceId)
  }
  return deviceId
}

/**
 * 复制文本
 * @param {string} text 文本
 */
function copyText(text) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '复制成功',
          icon: 'success'
        })
        resolve()
      },
      fail: (err) => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * 预览图片
 * @param {string} current 当前图片
 * @param {array} urls 图片列表
 */
function previewImage(current, urls) {
  wx.previewImage({
    current: current,
    urls: urls
  })
}

/**
 * 保存图片
 * @param {string} url 图片地址
 */
function saveImage(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: url,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.showToast({
              title: '保存成功',
              icon: 'success'
            })
            resolve()
          },
          fail: (err) => {
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            })
            reject(err)
          }
        })
      },
      fail: reject
    })
  })
}

/**
 * 显示确认对话框
 * @param {string} title 标题
 * @param {string} content 内容
 * @param {object} options 选项
 */
function showConfirm(title, content, options = {}) {
  return new Promise((resolve) => {
    wx.showModal({
      title: title,
      content: content,
      showCancel: options.showCancel !== false,
      cancelText: options.cancelText || '取消',
      confirmText: options.confirmText || '确定',
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

module.exports = {
  formatTime,
  formatDate,
  debounce,
  throttle,
  generateUUID,
  getDeviceId,
  copyText,
  previewImage,
  saveImage,
  showConfirm
}
