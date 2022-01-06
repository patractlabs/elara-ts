## Elara Deploy

你需要准备postgresql、redis来存储数据。

在项目根目录下使用 `yarn build` 命令编译。

在.env文件和config目录下default.json文件中按需更改服务配置。

我们部署wsrpc服务的方式：

在dist目录下配创建pm2 配置文件。

```yaml
let name = "wsrpc"
const instances = "max"
module.exports = {
  apps: [{
    name,
    script: "src/app.js",
    exec_mode: "cluster",
    max_memory_restart: '4G',
    instances,
    wait_ready: true,
    listen_timeout: 5000,
    node_args: "--max-semi-space-size=128",
    env: {
        "PORT": 7003
    },
  }]
}
```

可以参考以下Dockerfile文件编译出镜像，来启动wsrpc服务。

```dockerfile
FROM node:14.17.3
WORKDIR /usr/src/elara
COPY . .
WORKDIR /usr/src/elara/dist
RUN npm install -g wscat
ENV TZ=Asia/Shanghai
CMD  ["pm2-runtime" ,"src/app.js" ,"-i", "max" ,"--wait-ready"]
```

也可以将其部署到 kubernetes 集群中。

例如我们将其部署至阿里云的ACK集群上，我们将日志采集服务集成到每个pod中，

当然也可以选择部署到其他云服务商的集群服务、serverless 等。

```yaml
apiVersion: v1
kind: Service
metadata:
  annotations:
    service.beta.kubernetes.io/alibaba-cloud-loadbalancer-protocol-port: "https:443"
    service.beta.kubernetes.io/alibaba-cloud-loadbalancer-cert-id: "1730003425739616_17b9f7897a8_1039460414_-340151266"
    service.beta.kubernetes.io/alibaba-cloud-loadbalancer-bandwidth: "200"

  name: wsrpc-pro
  labels:
    app: wsrpc-pro
spec:
  type: LoadBalancer
  ports:
  - name: https
    port: 443 
    protocol: TCP
    targetPort: 7003
  - name: http
    port: 80
    protocol: TCP
    targetPort: 7003
  selector:
    app: wsrpc-pro
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wsrpc-pro
  labels:
    app: wsrpc-pro
spec:
  replicas: 5
  selector:
    matchLabels:
      app: wsrpc-pro
  template:
    metadata:
       annotations: 
         kubernetes.io/ingress-bandwidth: 50M 
         kubernetes.io/egress-bandwidth: 50M 
      labels:
        app: wsrpc-pro
    spec:
      containers:
        - name: wsrpc-pro
          image: registry-vpc.ap-southeast-1.aliyuncs.com/patract-pro/elara:wsrpc
          ports:
            - containerPort: 7003
          env:
            - name: NODE_ENV
              value: pro
            - name: TZ
              value: Asia/Shanghai 
            - name: aliyun_logs_wsrpc-pro-stdout
              value: stdout
            - name: aliyun_logs_wsrpc-pro-stdout_ttl
              value: "1"
            - name: aliyun_logs_wsrpc-pro-app
              value: /usr/src/elara/dist/logs/app*.log
            - name: aliyun_logs_wsrpc-pro-app_ttl
              value: "1"
            - name: aliyun_logs_wsrpc-pro-error
              value: /usr/src/elara/dist/logs/error*.log
            - name: aliyun_logs_wsrpc-pro-error_ttl
              value: "1"
            - name: aliyun_logs_wsrpc-pro-exception
              value: /usr/src/elara/dist/logs/exception*.log
            - name: aliyun_logs_wsrpc-pro-exception_ttl
              value: "1"
            - name: aliyun_logs_wsrpc-pro-stdout_shard
              value: "1" 
```
