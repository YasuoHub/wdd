// 生成占位图标脚本
const fs = require('fs');
const path = require('path');

// 创建 icons 目录
const iconsDir = path.join(__dirname, 'miniprogram/static/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1x1 透明 PNG (Base64)
const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 解码 Base64
const transparentBuffer = Buffer.from(transparentPng, 'base64');

// 要生成的图标列表
const icons = [
  'home.png',
  'home-active.png',
  'points.png',
  'points-active.png',
  'mine.png',
  'mine-active.png'
];

// 生成图标
icons.forEach(icon => {
  const filePath = path.join(iconsDir, icon);
  fs.writeFileSync(filePath, transparentBuffer);
  console.log(`✅ 生成: ${icon}`);
});

console.log('\n🎉 所有占位图标生成完成！');
console.log('📁 位置: miniprogram/static/icons/');
console.log('\n💡 提示: 这些是现在可以使用的占位图标。');
console.log('   您可以稍后替换为真实的设计图标。');
