// components/empty/empty.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    image: {
      type: String,
      value: '' // 默认使用文字图标
    },
    title: {
      type: String,
      value: '暂无数据'
    },
    description: {
      type: String,
      value: ''
    },
    buttonText: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 点击按钮
    onButtonTap() {
      this.triggerEvent('buttonTap');
    }
  }
});
