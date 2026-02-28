// components/navbar/navbar.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    title: {
      type: String,
      value: ''
    },
    backgroundColor: {
      type: String,
      value: '#07c160'
    },
    color: {
      type: String,
      value: '#ffffff'
    },
    showBack: {
      type: Boolean,
      value: false
    },
    showHome: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    statusBarHeight: 20,
    navBarHeight: 44
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 获取系统信息
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight,
        navBarHeight: (systemInfo.statusBarHeight || 0) + 44
      });
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 返回上一页
    goBack() {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      });
    },

    // 返回首页
    goHome() {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  }
});
