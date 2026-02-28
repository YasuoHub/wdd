#!/bin/bash
# 云函数批量部署脚本（Bash）
# 递归找到 cloudfunctions 下所有含 package.json 的目录，按 name 顺序部署到指定环境，同名覆盖。

ENV_ID="wdd-2grpiy1r6f9f4cf2"
# 可配置：不部署的云函数 name，空格分隔（默认跳过 config）
SKIP_NAMES="config"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLOUD_FUNCTIONS="${PROJECT_ROOT}/cloudfunctions"

if ! command -v tcb &> /dev/null; then
    echo "错误: 未安装 CloudBase CLI"
    echo "请运行: npm install -g @cloudbase/cli"
    exit 1
fi

if [[ ! -d "$CLOUD_FUNCTIONS" ]]; then
    echo "错误: 未找到目录 $CLOUD_FUNCTIONS"
    exit 1
fi

echo "================================"
echo "云函数批量部署"
echo "================================"
echo "环境: $ENV_ID"
echo "根目录: $CLOUD_FUNCTIONS"
echo ""

DEPLOYED=0
FAILED_NAMES=()
FAILED_DIRS=()

while IFS= read -r -d '' pkg; do
    DIR="$(dirname "$pkg")"
    REL_PATH="cloudfunctions${DIR#$CLOUD_FUNCTIONS}"
    REL_PATH="${REL_PATH//\\/\/}"

    if command -v node &> /dev/null; then
        NAME="$(node -e "console.log(require(process.argv[1]).name || '')" "$pkg")"
    elif command -v jq &> /dev/null; then
        NAME="$(jq -r '.name // ""' "$pkg")"
    else
        echo "[跳过] $REL_PATH (需要 node 或 jq 解析 package.json)"
        continue
    fi

    if [[ -z "$NAME" ]]; then
        echo "[跳过] $REL_PATH (package.json 无 name)"
        continue
    fi

    if [[ " $SKIP_NAMES " == *" $NAME "* ]]; then
        echo "[跳过] $NAME ($REL_PATH)"
        continue
    fi

    echo "[部署] $NAME ($REL_PATH) ..."
    if (cd "$DIR" && tcb fn deploy "$NAME" -e "$ENV_ID" --force); then
        ((DEPLOYED++)) || true
        echo "  完成"
    else
        FAILED_NAMES+=("$NAME")
        FAILED_DIRS+=("$REL_PATH")
        echo "  失败"
    fi
done < <(find "$CLOUD_FUNCTIONS" -name "package.json" -type f | sort -z)

echo ""
echo "================================"
echo "部署汇总: 成功 $DEPLOYED, 失败 ${#FAILED_NAMES[@]}"
echo "================================"
if [[ ${#FAILED_NAMES[@]} -gt 0 ]]; then
    echo ""
    echo "失败列表:"
    for i in "${!FAILED_NAMES[@]}"; do
        echo "  - ${FAILED_NAMES[$i]} (${FAILED_DIRS[$i]})"
    done
    exit 1
fi
