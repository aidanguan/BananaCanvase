# BananaCanvas Docker 部署指南

## 快速启动

### 方式一:使用 docker-compose(推荐)

1. 确保已安装 Docker 和 Docker Compose
2. 在项目根目录下运行:

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问 http://localhost:3000

### 方式二:使用 Docker 命令

1. 构建镜像:
```bash
docker build -t banana-canvas .
```

2. 运行容器:
```bash
docker run -d -p 3000:80 --name banana-canvas-app banana-canvas
```

3. 停止容器:
```bash
docker stop banana-canvas-app
docker rm banana-canvas-app
```

## 使用 Gemini API Key

如果需要在构建时注入 API Key:

```bash
# 使用 docker-compose
docker-compose build --build-arg GEMINI_API_KEY=your_api_key_here

# 或使用 docker build
docker build --build-arg GEMINI_API_KEY=your_api_key_here -t banana-canvas .
```

## 端口说明

- 容器内部: nginx 监听 80 端口
- 宿主机映射: 3000 端口
- 可在 docker-compose.yml 中修改宿主机端口

## 常用命令

```bash
# 查看运行中的容器
docker ps

# 查看所有容器
docker ps -a

# 查看镜像
docker images

# 删除镜像
docker rmi banana-canvas

# 进入容器
docker exec -it banana-canvas-app sh

# 查看容器日志
docker logs banana-canvas-app
```
