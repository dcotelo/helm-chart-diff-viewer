FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat git
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install Helm and dyff
RUN apk add --no-cache curl tar && \
    curl -fsSL https://get.helm.sh/helm-v3.14.0-linux-amd64.tar.gz | tar -xz && \
    mv linux-amd64/helm /usr/local/bin/helm && \
    rm -rf linux-amd64 && \
    # Install dyff (get latest version dynamically)
    DYFF_VERSION=$(curl -s https://api.github.com/repos/homeport/dyff/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/v//') && \
    curl -fsSL "https://github.com/homeport/dyff/releases/latest/download/dyff_${DYFF_VERSION}_linux_amd64.tar.gz" | tar -xz && \
    mv dyff /usr/local/bin/dyff && \
    chmod +x /usr/local/bin/dyff

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install Helm, Git, and dyff
RUN apk add --no-cache curl git tar && \
    curl -fsSL https://get.helm.sh/helm-v3.14.0-linux-amd64.tar.gz | tar -xz && \
    mv linux-amd64/helm /usr/local/bin/helm && \
    rm -rf linux-amd64 && \
    # Install dyff (get latest version dynamically)
    DYFF_VERSION=$(curl -s https://api.github.com/repos/homeport/dyff/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/v//') && \
    curl -fsSL "https://github.com/homeport/dyff/releases/latest/download/dyff_${DYFF_VERSION}_linux_amd64.tar.gz" | tar -xz && \
    mv dyff /usr/local/bin/dyff && \
    chmod +x /usr/local/bin/dyff && \
    # Configure Git to not prompt for credentials
    git config --global credential.helper "" && \
    git config --global init.defaultBranch main

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV GIT_TERMINAL_PROMPT=0
ENV GIT_ASKPASS=""

CMD ["node", "server.js"]

