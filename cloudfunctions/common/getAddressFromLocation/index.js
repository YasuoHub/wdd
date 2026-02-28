// cloudfunctions/common/getAddressFromLocation/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { response, CONFIG } = require('./config')
const axios = require('axios')

exports.main = async (event, context) => {
  const { latitude, longitude } = event

  try {
    if (!latitude || !longitude) {
      return response.error('缺少坐标参数', 1001)
    }

    // 调用腾讯地图 API 进行逆地址解析
    const res = await axios.get('https://apis.map.qq.com/ws/geocoder/v1/', {
      params: {
        location: `${latitude},${longitude}`,
        key: CONFIG.mapKey,
        get_poi: 0
      }
    })

    if (res.data.status === 0) {
      const result = res.data.result
      return response.success({
        name: result.formatted_addresses?.recommend || result.address,
        address: result.address,
        province: result.address_component?.province,
        city: result.address_component?.city,
        district: result.address_component?.district
      }, '获取成功')
    } else {
      return response.success({
        name: '未知位置',
        address: ''
      }, '解析失败')
    }

  } catch (error) {
    console.error('逆地址解析失败:', error)
    return response.success({
      name: '位置获取失败',
      address: ''
    }, '请求失败')
  }
}
