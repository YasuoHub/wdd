#!/bin/bash
# 一键部署脚本

echo "================================"
echo "问当地 - 一键部署脚本"
echo "================================"

# 检查环境
if ! command -v tcb &> /dev/null; then
    echo "错误: 未安装 CloudBase CLI"
    echo "请运行: npm install -g @cloudbase/cli"
    exit 1
fi

# 登录检查
echo ""
echo "检查登录状态..."
tcb login
if [ $? -ne 0 ]; then
    echo "登录失败，请重试"
    exit 1
fi

ENV_ID="wdd-2grpiy1r6f9f4cf2"

echo ""
echo "部署环境: $ENV_ID"
echo ""

# 部署云函数
echo "================================"
echo "开始部署云函数..."
echo "================================"

cd cloudfunctions

for func in */; do
    func_name=$(basename $func)

    # 跳过 config 目录
    if [ "$func_name" = "config" ]; then
        continue
    fi

    echo ""
    echo "部署: $func_name"

    cd $func_name

    # 安装依赖
    if [ -f "package.json" ]; then
        echo "  安装依赖..."
        npm install --production
    fi

    # 部署
    echo "  上传云函数..."
    tcb fn deploy $func_name --env $ENV_ID

    cd ..
done

cd ..

echo ""
echo "================================"
echo "云函数部署完成!"
echo "================================"

# 初始化数据库
echo ""
echo "是否初始化数据库? (y/n)"
read -r answer
if [ "$answer" = "y" ]; then
    echo ""
    echo "初始化数据库..."
    node scripts/init-db.js
fi

echo ""
echo "================================"
echo "部署完成!"
echo "================================"
echo ""
echo "请完成以下步骤："
echo "1. 在微信开发者工具中打开 miniprogram 目录"
echo "2. 点击'云开发'按钮，进入云开发控制台"
echo "3. 检查云函数是否部署成功"
echo "4. 在小程序后台配置模板消息"
echo "5. 修改 cloudfunctions/config/index.js 中的管理员OpenID"
echo ""
echo "云函数列表:"
tcb fn list --env $ENV_ID
