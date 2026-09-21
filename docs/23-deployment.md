# 23 — AWS Cloud Deployment Architecture & Production DevOps Plan

## 1. Infrastructure Architecture Diagram

```mermaid
graph TD
    Client["Browser / Mobile Client"]
    Route53["AWS Route 53 (DNS: store.yourdomain.com)"]
    
    subgraph AWS Cloud - Virtual Private Cloud
        subgraph EC2 Instance (Ubuntu 24.04 LTS)
            SecurityGroup["AWS Security Group<br/>(Inbound: 80, 443, SSH:22 from Admin IP)"]
            Certbot["Let's Encrypt / Certbot (Auto-renewing SSL)"]
            Nginx["Nginx Web Server / Reverse Proxy<br/>(:80 -> :443 HTTPS)"]
            StaticFiles["/var/www/frontend/dist<br/>(Compiled React Vite Assets)"]
            PM2["PM2 Process Daemon (Cluster Mode)"]
            NodeExpress["Node.js Express API (:5000)<br/>Internal Only"]
        end

        AWSS3["AWS S3 Bucket<br/>(store-media-assets)<br/>Images & Invoices"]
        AWSSES["AWS Simple Email Service<br/>(Transactional OTPs)"]
    end

    MongoAtlas[("MongoDB Atlas Cloud<br/>(M0 / Dedicated Cluster)<br/>Network IP Whitelisted")]
    RazorpayGateway["Razorpay Cloud API<br/>(Payments & Webhooks)"]

    Client -->|HTTPS :443| Route53
    Route53 --> SecurityGroup
    SecurityGroup --> Nginx
    Nginx -->|Static Assets| StaticFiles
    Nginx -->|Proxy Pass /api/v1/*| NodeExpress
    PM2 -.->|Monitors & Restarts| NodeExpress

    NodeExpress -->|Mongoose TLS| MongoAtlas
    NodeExpress -->|AWS SDK v3| AWSS3
    NodeExpress -->|AWS SDK v3| AWSSES
    NodeExpress -->|HTTPS REST| RazorpayGateway
```

---

## 2. Server Infrastructure Specifications

### 2.1 AWS EC2 Instance Configuration
- **AMI**: Ubuntu Server 24.04 LTS (64-bit x86).
- **Instance Type**: `t3.small` (2 vCPU, 2GB RAM) or `t2.micro` (free-tier eligible).
- **Storage**: 20GB General Purpose SSD (gp3).

### 2.2 AWS Security Group Configuration (Firewall Rules)
| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP** | TCP | `80` | `0.0.0.0/0` (Anywhere) | Redirects HTTP traffic to HTTPS via Nginx. |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` (Anywhere) | Encrypted browser communication. |
| **SSH** | TCP | `22` | `Admin_IP/32` (Restricted) | Secure terminal management; never open to `0.0.0.0/0`! |
| **Custom (5000)** | TCP | `5000` | **BLOCKED FROM INTERNET** | Port 5000 is accessible ONLY via Nginx internal loopback (`127.0.0.1:5000`). |

---

## 3. Web Server & Reverse Proxy Configuration (Nginx)

Nginx handles HTTPS termination, serves static frontend assets, and reverse-proxies `/api/v1` to the local Node.js application:

```nginx
server {
    listen 80;
    server_name store.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name store.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/store.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/store.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Frontend Single Page Application (Static Files)
    location / {
        root /var/www/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend REST API Proxy
    location /api/v1/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Process Management & Auto-Restart (PM2)

PM2 guarantees continuous uptime and zero-downtime reloads:
```json
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "ecommerce-api",
      script: "./src/server.js",
      instances: "max",
      exec_mode: "cluster",
      env_production: {
        NODE_ENV: "production",
        PORT: 5000
      },
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      max_memory_restart: "400M"
    }
  ]
};
```

Commands:
```bash
# Start backend in cluster mode
pm2 start ecosystem.config.js --env production

# Ensure PM2 restarts automatically on EC2 reboot
pm2 startup
pm2 save
```

---

## 5. Cloud Service Configurations

### 5.1 MongoDB Atlas Security
- **Network Access Whitelist**: Restrict IP access to the **Elastic IP** of the AWS EC2 instance.
- **Database User**: Create a dedicated database user with `readWrite` permissions strictly scoped to the `ecommerce` database.

### 5.2 AWS S3 Media Bucket
- **Bucket Policy**: Block all public ACL writes.
- **IAM Policy**: Grant the application EC2 role `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject`.

### 5.3 Health Check & Monitoring
- Dedicated endpoint: `GET /api/v1/health` returns `{ status: "ok", uptime: 1248, timestamp: ... }`.
- Route 53 or external uptime pingers (UptimeRobot) monitor this endpoint to alert if the server becomes unresponsive.
