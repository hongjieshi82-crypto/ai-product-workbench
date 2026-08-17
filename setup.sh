#!/bin/bash

# Personal Product Workbench setup script
# Prepares the local single-user environment without replacing existing configuration.

# Set colors for output messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Print header
echo -e "${BOLD}${BLUE}======================================================================${NC}"
echo -e "${BOLD}${BLUE}                         个人产品工作台                               ${NC}"
echo -e "${BOLD}${BLUE}======================================================================${NC}"
echo -e "${BOLD}正在准备本地运行环境...${NC}\n"

# Function to handle file copying with error checking
copy_env_file() {
    local source=$1
    local destination=$2

    if [ ! -f "$source" ]; then
        echo -e "${RED}错误：找不到配置模板 $source。${NC}"
        return 1
    fi

    if [ -f "$destination" ]; then
        echo -e "${YELLOW}保留已有配置：${destination}${NC}"
        return 0
    fi

    cp "$source" "$destination"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}完成：${NC}已创建 $destination"
    else
        echo -e "${RED}失败：${NC}无法创建 $destination"
        return 1
    fi
}

# Export character encoding settings for macOS compatibility
export LC_ALL=C
export LC_CTYPE=C
echo -e "${YELLOW}正在检查本地配置文件...${NC}"

# Copy all environment example files
services=("" "web" "api")
success=true

for service in "${services[@]}"; do
    if [ "$service" == "" ]; then
        # Handle root .env file
        prefix="./"
    else
        # Handle service .env files in apps folder
        prefix="./apps/$service/"
    fi

    copy_env_file "${prefix}.env.example" "${prefix}.env" || success=false
done

# Generate SECRET_KEY for Django
if [ -f "./apps/api/.env" ] && ! grep -q '^SECRET_KEY=' ./apps/api/.env; then
    echo -e "\n${YELLOW}正在生成本地安全密钥...${NC}"
    SECRET_KEY=$(tr -dc 'a-z0-9' < /dev/urandom | head -c50)

    if [ -z "$SECRET_KEY" ]; then
        echo -e "${RED}错误：无法生成本地安全密钥。${NC}"
        success=false
    else
        echo -e "SECRET_KEY=\"$SECRET_KEY\"" >> ./apps/api/.env
        echo -e "${GREEN}完成：${NC}已生成本地安全密钥"
    fi
else
    if [ ! -f "./apps/api/.env" ]; then
        echo -e "${RED}失败：${NC}没有找到 apps/api/.env"
        success=false
    fi
fi

# Activate pnpm (version set in package.json)
corepack enable pnpm || success=false
# Install Node dependencies
pnpm install || success=false

# Summary
echo -e "\n${YELLOW}初始化结果：${NC}"
if [ "$success" = true ]; then
    echo -e "${GREEN}完成：${NC}个人产品工作台已准备好。\n"
    echo -e "${BOLD}下一步：${NC}"
    echo -e "1. 打开 Docker Desktop"
    echo -e "2. 运行：${BOLD}docker compose -f docker-compose-local.yml up -d${NC}"
    echo -e "3. 运行：${BOLD}corepack pnpm --filter=web dev${NC}"
    echo -e "4. 打开：http://localhost:3000/workbench/calendar"
else
    echo -e "${RED}初始化没有完成，请检查上面的错误。${NC}\n"
    exit 1
fi
