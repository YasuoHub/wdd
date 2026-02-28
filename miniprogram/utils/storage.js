/**
 * 本地存储封装
 */

const STORAGE_KEY = {
  USER_INFO: 'userInfo',
  TOKEN: 'token',
  SETTINGS: 'settings',
  SEARCH_HISTORY: 'searchHistory',
  LAST_LOCATION: 'lastLocation'
}

/**
 * 设置缓存
 * @param {string} key 键
 * @param {any} value 值
 * @param {number} expire 过期时间（秒）
 */
function set(key, value, expire = 0) {
  try {
    const data = {
      value: value,
      expire: expire > 0 ? Date.now() + expire * 1000 : 0
    }
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error('设置缓存失败:', e)
    return false
  }
}

/**
 * 获取缓存
 * @param {string} key 键
 * @param {any} defaultValue 默认值
 */
function get(key, defaultValue = null) {
  try {
    const data = wx.getStorageSync(key)
    if (!data) return defaultValue

    // 检查是否过期
    if (data.expire > 0 && Date.now() > data.expire) {
      remove(key)
      return defaultValue
    }

    return data.value
  } catch (e) {
    console.error('获取缓存失败:', e)
    return defaultValue
  }
}

/**
 * 删除缓存
 * @param {string} key 键
 */
function remove(key) {
  try {
    wx.removeStorageSync(key)
    return true
  } catch (e) {
    console.error('删除缓存失败:', e)
    return false
  }
}

/**
 * 清空缓存
 */
function clear() {
  try {
    wx.clearStorageSync()
    return true
  } catch (e) {
    console.error('清空缓存失败:', e)
    return false
  }
}

module.exports = {
  STORAGE_KEY,
  set,
  get,
  remove,
  clear
}
