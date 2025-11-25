# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 创建.env.local文件(如果需要在构建时使用)
ARG GEMINI_API_KEY
RUN if [ -n "$GEMINI_API_KEY" ]; then echo "GEMINI_API_KEY=$GEMINI_API_KEY" > .env.local; fi

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 从构建阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
