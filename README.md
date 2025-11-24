# Helm Chart Diff Viewer

A modern web application for comparing differences between two Helm chart versions. Built with Next.js, TypeScript, and designed to work seamlessly with Git repositories.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

- 🔍 **Version Comparison** - Compare any two versions (tags, branches, or commits) of a Helm chart
- 📊 **Visual Diff Display** - Beautiful syntax-highlighted diff output
- 🎨 **Modern UI** - Clean, responsive interface built with React and Next.js
- ⚡ **Fast & Efficient** - Optimized for quick comparisons
- 🔧 **Flexible** - Support for custom values files or inline values content
- 🚀 **Easy Deployment** - Ready for deployment on Vercel, Docker, or any Node.js hosting

## 📋 Table of Contents

- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Requirements](#-requirements)
- [Deployment](#-deployment)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Helm 3.x installed on the system
- Git (for cloning repositories)
- (Optional) dyff for enhanced diff output

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/helm-chart-diff-viewer.git
cd helm-chart-diff-viewer
```

2. **Install dependencies**

```bash
npm install
```

3. **Run the development server**

```bash
npm run dev
```

4. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Basic Comparison

1. Enter the **Repository URL** (e.g., `https://github.com/user/repo.git`)
2. Specify the **Chart Path** (e.g., `charts/app`)
3. Enter **Version 1** (tag, branch, or commit SHA)
4. Enter **Version 2** (tag, branch, or commit SHA)
5. (Optional) Provide a values file path or paste values content
6. Click **Compare Versions**

### Example

```
Repository: https://github.com/myorg/helm-charts.git
Chart Path: charts/myapp
Version 1: v1.0.0
Version 2: v1.1.0
Values File: values/prod.yaml
```

### Supported Version Formats

- Git tags: `v1.0.0`, `1.2.3`, `release-2024-01-01`
- Branches: `main`, `develop`, `feature/new-feature`
- Commit SHAs: `abc123def456...`

## 🔌 API Reference

### POST `/api/compare`

Compare two Helm chart versions.

**Request Body:**

```json
{
  "repository": "https://github.com/user/repo.git",
  "chartPath": "charts/app",
  "version1": "v1.0.0",
  "version2": "v1.1.0",
  "valuesFile": "values/prod.yaml",
  "valuesContent": "replicaCount: 3\nimage:\n  tag: latest"
}
```

**Response:**

```json
{
  "success": true,
  "diff": "--- version1\n+++ version2\n...",
  "version1": "v1.0.0",
  "version2": "v1.1.0"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Error message here"
}
```

## 🔒 Requirements

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Helm**: 3.x (must be installed and available in PATH)
- **Git**: For cloning repositories

### Optional Tools

- **dyff**: For enhanced YAML diff output (falls back to simple diff if not available)

### Installing Helm

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

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables if needed
4. Deploy!

### Docker

```bash
# Build the image
docker build -t helm-chart-diff-viewer .

# Run the container
docker run -p 3000:3000 helm-chart-diff-viewer
```

### Self-Hosted

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🔄 CI/CD

This project includes GitHub Actions workflows for automated testing, building, and deployment:

- **CI Pipeline** (`ci.yml`): Runs tests and builds on every push/PR
- **Release Workflow** (`release.yml`): Creates releases when version tags are pushed
- **Vercel Deployment** (`deploy-vercel.yml`): Automatically deploys to Vercel
- **Docker Publishing** (`docker-publish.yml`): Builds and publishes Docker images

See [`.github/workflows/README.md`](.github/workflows/README.md) for detailed setup instructions.

### Status Badge

Add this to your README to show CI status:

```markdown
![CI](https://github.com/your-username/helm-chart-diff-viewer/workflows/CI/badge.svg)
```

## 🛠️ Development

### Project Structure

```
helm-chart-diff-viewer/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   └── compare/       # Comparison endpoint
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── CompareForm.tsx    # Input form
│   └── DiffDisplay.tsx    # Diff output display
├── lib/                   # Shared utilities
│   └── types.ts           # TypeScript types
├── services/              # Business logic
│   └── helm-service.ts    # Helm comparison service
└── public/                # Static assets
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Environment Variables

Create a `.env.local` file for local development:

```env
# Optional: Custom timeout for operations (in milliseconds)
HELM_TIMEOUT=30000
```

## 🐛 Troubleshooting

### "Helm not found" Error

Ensure Helm is installed and available in your PATH:

```bash
which helm
helm version
```

### "Failed to clone repository" Error

- Verify the repository URL is correct and accessible
- Check network connectivity
- Ensure the repository is public or credentials are configured

### "Chart path not found" Error

- Verify the chart path exists in the repository
- Check that the specified version contains the chart
- Ensure the path is relative to the repository root

### Slow Performance

- Large repositories may take time to clone
- Consider using shallow clones for faster performance
- Check system resources (CPU, memory, disk)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Helm](https://helm.sh/) - The package manager for Kubernetes
- [dyff](https://github.com/homeport/dyff) - YAML diff tool
- [Next.js](https://nextjs.org/) - The React framework
- [React Syntax Highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) - Syntax highlighting

## 📞 Support

- 🐛 [Report a bug](https://github.com/your-username/helm-chart-diff-viewer/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/your-username/helm-chart-diff-viewer/issues/new?template=feature_request.md)
- 💬 [Start a discussion](https://github.com/your-username/helm-chart-diff-viewer/discussions)

---

Made with ❤️ for the Kubernetes and Helm community

