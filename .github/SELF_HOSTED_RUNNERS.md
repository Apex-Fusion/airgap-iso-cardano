# 🏃 Self-Hosted Runners Guide

This guide explains how to configure and use self-hosted runners with the AirGap Cardano Protocol Module workflows, including support for Actions Runner Controller (ARC) setups.

## 📋 Overview

Self-hosted runners provide several advantages:

- **🔒 Enhanced Security**: Run builds in your own environment
- **💰 Cost Reduction**: Avoid GitHub Actions minutes charges
- **🎯 Custom Environment**: Use specific tools or hardware
- **⚡ Performance**: Often faster than GitHub-hosted runners
- **🔧 Control**: Full control over the build environment

## 🏗️ Supported Runner Types

### 1. 🏃 GitHub-Hosted Runners (Default)

- Standard GitHub Actions runners
- Pre-configured with common tools
- Pay-per-use model
- No setup required

### 2. 🏠 Self-Hosted Runners

- Runners you manage on your own infrastructure
- Full control over environment and tools
- One-time setup required
- Cost-effective for high usage

### 3. 🚀 Actions Runner Controller (ARC)

- Kubernetes-based runner management
- Auto-scaling capabilities
- Enterprise-grade orchestration
- Example: `arc-runner-set`

## 🔧 Setup Requirements

### Minimum System Requirements

```bash
# Hardware
- CPU: 2+ cores
- RAM: 4GB+ available
- Disk: 20GB+ free space
- Network: Stable internet connection

# Operating System
- Ubuntu 20.04+ (recommended)
- Windows Server 2019+
- macOS 10.15+
```

### Required Software

```bash
# Essential tools
- Node.js 18+ (LTS recommended: v20)
- npm 8+
- Git 2.20+
- curl/wget
- tar/gzip

# Recommended tools
- Docker (for containerized builds)
- Python 3.8+ (for some build tools)
- jq (for JSON processing)
```

## 📦 Setting Up Self-Hosted Runners

### 1. 🏠 Traditional Self-Hosted Runner

#### Step 1: Download and Configure

```bash
# Navigate to your repository -> Settings -> Actions -> Runners
# Click "New self-hosted runner" and follow the instructions

# Example for Linux x64:
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Configure the runner
./config.sh --url https://github.com/YOUR_ORG/airgap-iso-cardano --token YOUR_TOKEN
```

#### Step 2: Install Dependencies

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 8.x.x+

# Install additional tools
sudo apt-get update
sudo apt-get install -y git curl wget jq python3 python3-pip

# Optional: Install Docker
sudo apt-get install -y docker.io
sudo usermod -aG docker $USER
```

#### Step 3: Start the Runner

```bash
# Run as a service (recommended)
sudo ./svc.sh install
sudo ./svc.sh start

# Or run interactively (for testing)
./run.sh
```

### 2. 🚀 Actions Runner Controller (ARC)

#### Step 1: Install ARC in Kubernetes

```yaml
# arc-system.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: arc-systems
---
# Install ARC controller
# Follow: https://github.com/actions/actions-runner-controller
```

#### Step 2: Create RunnerSet

```yaml
# arc-runner-set.yaml
apiVersion: actions.sumologic.com/v1alpha1
kind: RunnerSet
metadata:
  name: arc-runner-set
  namespace: arc-runners
spec:
  githubConfigUrl: "https://github.com/YOUR_ORG/airgap-iso-cardano"
  githubConfigSecret: github-config-secret
  maxRunners: 5
  minRunners: 1
  template:
    spec:
      containers:
        - name: runner
          image: ghcr.io/actions/actions-runner:latest
          env:
            - name: RUNNER_FEATURE_FLAG_ONCE
              value: "true"
          resources:
            requests:
              cpu: "1"
              memory: "2Gi"
            limits:
              cpu: "2"
              memory: "4Gi"
          volumeMounts:
            - name: work
              mountPath: /home/runner/_work
      volumes:
        - name: work
          emptyDir: {}
```

## 🔧 Runner Configuration

### Environment Variables

```bash
# Set these on your self-hosted runner
export NODE_ENV=test
export CI=true
export RUNNER_ALLOW_RUNASROOT=1  # If running as root (not recommended)

# For enhanced security
export ACTIONS_RUNNER_REQUIRE_JOB_CONTAINER=true
export ACTIONS_RUNNER_CONTAINER_HOOKS=true
```

### Runner Labels

Add labels to organize your runners:

```bash
# During configuration, add labels like:
./config.sh --labels self-hosted,linux,x64,fast,secure,cardano-build
```

### Security Configuration

```bash
# Create dedicated user for runner
sudo useradd -m -s /bin/bash github-runner
sudo usermod -aG docker github-runner

# Set up proper permissions
sudo chown -R github-runner:github-runner /home/github-runner/actions-runner
```

## 🎯 Using Self-Hosted Runners

### 1. 🔧 Manual Trigger

Use workflow_dispatch to test specific runner types:

```yaml
# Go to Actions tab -> CI workflow -> Run workflow
# Select runner type: arc-runner-set, self-hosted, or github-hosted
```

### 2. 📝 Modify Workflow Files

Update `runs-on` in workflow files:

```yaml
jobs:
  build:
    runs-on: arc-runner-set # or self-hosted
    steps:
      - uses: actions/checkout@v4
      # ... rest of your steps
```

### 3. 🏷️ Use Runner Labels

Target specific runners with labels:

```yaml
jobs:
  secure-build:
    runs-on: [self-hosted, linux, secure, fast]
    steps:
      - name: Secure build process
        run: echo "Running on secure infrastructure"
```

## 📊 Monitoring and Maintenance

### Health Checks

Use our runner health check workflow:

```bash
# Triggers automatically for self-hosted runners
# Checks system resources, tools, and configuration
```

### Performance Monitoring

```bash
# Monitor resource usage
htop
iostat 5
df -h

# Check runner logs
sudo journalctl -u actions.runner.* -f

# Monitor workflow performance
# Compare execution times between runner types
```

### Maintenance Tasks

```bash
# Weekly maintenance script
#!/bin/bash

# Update runner software
cd /home/github-runner/actions-runner
sudo ./svc.sh stop
./config.sh remove --token YOUR_TOKEN
# Download latest version and reconfigure
sudo ./svc.sh start

# Clean up old builds
docker system prune -f
npm cache clean --force

# Update system packages
sudo apt-get update && sudo apt-get upgrade -y
```

## 🔒 Security Best Practices

### Runner Security

1. **🏠 Isolated Environment**: Run each job in containers
2. **🔐 Minimal Permissions**: Use dedicated service accounts
3. **🛡️ Network Security**: Restrict outbound connections
4. **📋 Regular Updates**: Keep runner software updated
5. **🕵️ Monitoring**: Log and monitor all activities

### Repository Security

```yaml
# Limit self-hosted runner usage to specific workflows
jobs:
  secure-build:
    runs-on: self-hosted
    environment: production # Require manual approval
    if: github.actor == 'trusted-user'
```

### Secret Management

```bash
# Use GitHub secrets for sensitive data
# Never store secrets in runner environment
# Use tools like HashiCorp Vault for advanced secret management
```

## 🚨 Troubleshooting

### Common Issues

#### 1. 🔧 Node.js Version Mismatch

```bash
# Problem: Wrong Node.js version
# Solution: Install correct version
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v20.x.x
```

#### 2. 📦 Permission Issues

```bash
# Problem: Permission denied errors
# Solution: Fix ownership and permissions
sudo chown -R github-runner:github-runner /home/github-runner
sudo chmod +x /home/github-runner/actions-runner/run.sh
```

#### 3. 🌐 Network Connectivity

```bash
# Problem: Cannot reach GitHub
# Solution: Check network and firewall
curl -I https://github.com
ping github.com

# Check proxy settings if behind corporate firewall
export https_proxy=http://proxy.company.com:8080
```

#### 4. 💾 Disk Space Issues

```bash
# Problem: Insufficient disk space
# Solution: Clean up build artifacts
cd /home/github-runner/actions-runner/_work
find . -name "node_modules" -type d -exec rm -rf {} +
find . -name "dist" -type d -exec rm -rf {} +
docker system prune -f
```

### Debugging Workflows

```yaml
# Add debug steps to workflows
- name: 🔍 Debug Environment
  run: |
    echo "Runner: ${{ runner.name }}"
    echo "OS: ${{ runner.os }}"
    echo "Architecture: ${{ runner.arch }}"
    echo "Working Directory: $(pwd)"
    echo "Available Tools:"
    which node npm git docker || true
    echo "System Resources:"
    free -h || true
    df -h || true
```

## 📈 Performance Optimization

### Resource Allocation

```yaml
# Optimize for your hardware
jobs:
  build:
    runs-on: self-hosted
    env:
      NODE_OPTIONS: "--max-old-space-size=4096" # Increase memory for Node.js
      JEST_WORKERS: "4" # Match your CPU cores
```

### Caching Strategy

```bash
# Use local caching for dependencies
mkdir -p ~/.npm-cache
npm config set cache ~/.npm-cache

# For Docker builds
docker build --cache-from previous-image .
```

### Parallel Execution

```yaml
# Run multiple jobs in parallel on different runners
strategy:
  matrix:
    runner: [self-hosted-1, self-hosted-2, self-hosted-3]
    node-version: [18, 20, 22]
```

## 📊 Cost Analysis

### GitHub-Hosted vs Self-Hosted

```
GitHub-Hosted Runners:
- Ubuntu: $0.008/minute
- Windows: $0.016/minute
- macOS: $0.08/minute

Self-Hosted Runners:
- Setup cost: ~$100-500 (hardware)
- Operating cost: ~$20-50/month (cloud instance)
- Break-even: ~1000-2000 minutes/month
```

### ROI Calculator

```bash
# Monthly usage estimation
GITHUB_MINUTES=5000
COST_PER_MINUTE=0.008
MONTHLY_GITHUB_COST=$((GITHUB_MINUTES * COST_PER_MINUTE))

SELF_HOSTED_MONTHLY_COST=50
SAVINGS=$((MONTHLY_GITHUB_COST - SELF_HOSTED_MONTHLY_COST))

echo "Monthly savings: $${SAVINGS}"
```

## 🎯 Best Practices Summary

1. **🔒 Security First**: Always prioritize security over convenience
2. **📊 Monitor Performance**: Track execution times and resource usage
3. **🧹 Regular Maintenance**: Keep runners updated and clean
4. **💰 Cost Optimization**: Monitor usage and optimize for your workload
5. **🚨 Have Fallbacks**: Always have GitHub-hosted runners as backup
6. **📝 Document Everything**: Keep configuration and procedures documented
7. **🧪 Test Thoroughly**: Test runner changes in non-production environments

---

## 🤝 Support

For issues with self-hosted runners:

1. Check this guide first
2. Review GitHub's official documentation
3. Open an issue in the repository
4. Contact your infrastructure team (for enterprise setups)

**Remember**: Self-hosted runners require ongoing maintenance and security attention. Ensure your team is prepared for the operational overhead.

---

_Last updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')_
