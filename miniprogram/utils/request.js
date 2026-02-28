/**
 * 请求封装
 */

const app = getApp()

/**
 * 调用云函数
 * @param {string} name 云函数名
 * @param {object} data 请求数据
 * @param {object} options 配置选项
 */
function callFunction(name, data = {}, options = {}) {
  return new Promise((resolve, reject) => {
    // 显示加载提示
    if (options.loading !== false) {
      wx.showLoading({
        title: options.loadingText || '加载中...',
        mask: true
      })
    }

    // 调用云函数
    wx.cloud.callFunction({
      name: name,
      data: data
    }).then(res => {
      if (options.loading !== false) {
        wx.hideLoading()
      }

      const result = res.result

      if (result.code === 0) {
        resolve(result)
      } else {
        // 业务错误
        if (options.showError !== false) {
          wx.showToast({
            title: result.message || '操作失败',
            icon: 'none',
            duration: 2000
          })
        }
        reject(result)
      }
    }).catch(err => {
      if (options.loading !== false) {
        wx.hideLoading()
      }

      console.error('请求失败:', err)

      if (options.showError !== false) {
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        })
      }

      reject({
        code: -1,
        message: '网络错误',
        error: err
      })
    })
  })
}

/**
 * 上传文件
 * @param {string} filePath 文件路径
 * @param {string} cloudPath 云端路径
 * @param {object} options 配置选项
 */
function uploadFile(filePath, cloudPath, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.loading !== false) {
      wx.showLoading({
        title: options.loadingText || '上传中...',
        mask: true
      })
    }

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath
    }).then(res => {
      if (options.loading !== false) {
        wx.hideLoading()
      }

      resolve({
        code: 0,
        data: {
          fileID: res.fileID,
          statusCode: res.statusCode
        }
      })
    }).catch(err => {
      if (options.loading !== false) {
        wx.hideLoading()
      }

      console.error('上传失败:', err)

      if (options.showError !== false) {
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }

      reject({
        code: -1,
        message: '上传失败',
        error: err
      })
    })
  })
}

/**
 * 批量上传文件
 * @param {array} files 文件列表
 * @param {string} prefix 云端路径前缀
 */
function uploadFiles(files, prefix = '') {
  const uploadTasks = files.map((file, index) => {
    const ext = file.tempFilePath.match(/\.[^.]+$/)[0] || '.jpg'
    const cloudPath = `${prefix}/${Date.now()}_${index}${ext}`
    return uploadFile(file.tempFilePath, cloudPath, { showError: false, loading: false })
  })

  return Promise.all(uploadTasks)
}

module.exports = {
  callFunction,
  uploadFile,
  uploadFiles
}
