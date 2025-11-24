# Getting Started with Helm Chart Diff Viewer

This guide will help you quickly get started with the Helm Chart Diff Viewer web application.

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **npm 9+** (comes with Node.js)
- **Helm 3.x** installed ([Installation Guide](https://helm.sh/docs/intro/install/))
- **Git** installed

### Installation Steps

1. **Clone or download the repository**

```bash
git clone https://github.com/your-username/helm-chart-diff-viewer.git
cd helm-chart-diff-viewer
```

2. **Install dependencies**

```bash
npm install
```

3. **Verify Helm installation**

```bash
helm version
```

You should see something like:
```
version.BuildInfo{Version:"v3.x.x", ...}
```

4. **Start the development server**

```bash
npm run dev
```

5. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## 📝 First Comparison

### Example: Compare Two Chart Versions

1. **Repository URL**: `https://github.com/your-org/helm-charts.git`
2. **Chart Path**: `charts/myapp`
3. **Version 1**: `v1.0.0` (or a git tag/branch/commit)
4. **Version 2**: `v1.1.0` (or a git tag/branch/commit)
5. **Values File** (optional): `values/prod.yaml`

Click **Compare Versions** and wait for the results!

### Understanding the Output

- **✅ No differences**: The two versions are identical
- **⚠️ Differences detected**: A syntax-highlighted diff showing what changed

## 🔧 Common Use Cases

### Compare Tags

```
Version 1: v1.0.0
Version 2: v1.1.0
```

### Compare Branches

```
Version 1: main
Version 2: develop
```

### Compare Commits

```
Version 1: abc123def456...
Version 2: xyz789ghi012...
```

### With Custom Values

You can either:
- Provide a **values file path** (relative to repo root)
- Or **paste values content** directly in the textarea

## 🐛 Troubleshooting

### "Helm command not found"

Install Helm:

**macOS:**
```bash
brew install helm
```

**Linux:**
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

**Windows:**
```powershell
choco install kubernetes-helm
```

### "Failed to clone repository"

- Check your internet connection
- Verify the repository URL is correct
- Ensure the repository is public or you have access

### "Chart path not found"

- Verify the chart path exists in the repository
- Check that the path is relative to the repository root
- Ensure the specified version contains the chart

### Slow Performance

- Large repositories may take time to clone
- First-time comparisons may be slower
- Check your system resources

## 🚢 Running in Production

### Using Docker

```bash
docker build -t helm-chart-diff-viewer .
docker run -p 3000:3000 helm-chart-diff-viewer
```

### Using npm

```bash
npm run build
npm start
```

## 📚 Next Steps

- Read the [full documentation](README.md)
- Check out [API reference](README.md#api-reference)
- Explore [deployment options](README.md#deployment)

## 💡 Tips

- Use **shallow clones** for faster performance (handled automatically)
- **Values files** are optional but recommended for accurate comparisons
- The app supports both **public and private** repositories (if properly authenticated)
- **Commit SHAs** work great for comparing specific changes

---

Happy comparing! 🎉

