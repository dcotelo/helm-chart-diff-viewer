# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Available Workflows

### 1. `ci.yml` - Continuous Integration
**Triggers:** Push and Pull Requests to `main` and `develop` branches

**Jobs:**
- **Test**: Runs linter, type checking, and tests
- **Build**: Builds the Next.js application

**Features:**
- Automated testing on every push/PR
- Code coverage reporting (optional, requires Codecov token)
- Build verification

### 2. `release.yml` - Release Workflow
**Triggers:** When a tag matching `v*.*.*` is pushed (e.g., `v1.0.0`)

**Features:**
- Runs full test suite
- Builds the application
- Creates a GitHub release
- Builds Docker image (optional push to registry)

**Usage:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

### 3. `deploy-vercel.yml` - Deploy to Vercel
**Triggers:** Push to `main` branch or manual dispatch

**Requirements:**
- `VERCEL_TOKEN` - Vercel authentication token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

**Setup:**
1. Get your Vercel token from [Vercel Settings](https://vercel.com/account/tokens)
2. Get your org and project IDs from your Vercel project settings
3. Add them as GitHub Secrets:
   - Go to Repository Settings → Secrets and variables → Actions
   - Add the three secrets

### 4. `docker-publish.yml` - Build and Publish Docker Image
**Triggers:** Push to `main`, version tags, or manual dispatch

**Requirements:**
- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password or access token

**Features:**
- Builds multi-platform Docker images
- Pushes to Docker Hub
- Automatic tagging based on branch/tag
- Image caching for faster builds

**Setup:**
1. Create a Docker Hub account
2. Generate an access token at [Docker Hub Account Settings](https://hub.docker.com/settings/security)
3. Add secrets to GitHub:
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub access token

## Setting Up Secrets

To configure deployment workflows, add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the required secrets:

### For Vercel Deployment:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### For Docker Hub:
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

## Workflow Status Badge

Add this to your README.md to show CI status:

```markdown
![CI](https://github.com/your-username/helm-chart-diff-viewer/workflows/CI/badge.svg)
```

## Customization

### Enable Code Coverage
1. Sign up at [Codecov](https://codecov.io)
2. Add your repository
3. Get your Codecov token
4. Add `CODECOV_TOKEN` as a GitHub secret
5. Update `ci.yml` to use the token

### Custom Docker Registry
To use a different registry (e.g., GitHub Container Registry), update `docker-publish.yml`:

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ghcr.io/${{ github.repository }}
```

And add this step before login:
```yaml
- name: Log in to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting

### Tests Failing
- Check that all dependencies are in `package.json`
- Ensure test environment variables are set if needed
- Review test output in Actions tab

### Build Failing
- Verify Node.js version matches `package.json` engines
- Check for TypeScript errors: `npm run type-check`
- Review build logs in Actions tab

### Deployment Issues
- Verify all required secrets are set
- Check that deployment tokens have correct permissions
- Review deployment logs in Actions tab

