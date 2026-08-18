FROM node:22-alpine AS web-base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN corepack enable

FROM web-base AS web-pruner
WORKDIR /app
RUN apk add --no-cache libc6-compat && pnpm add --global turbo@2.9.18
COPY . .
RUN turbo prune --scope=web --docker

FROM web-base AS web-builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=web-pruner /app/out/json/ .
COPY --from=web-pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=web-pruner /app/out/full/ .
COPY turbo.json turbo.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch --store-dir=/pnpm/store
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store CI=true pnpm install --offline --frozen-lockfile --store-dir=/pnpm/store
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=web

FROM python:3.12.10-alpine AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /code

RUN apk add --no-cache --upgrade \
    apache2-utils \
    bash \
    ca-certificates \
    gettext \
    libffi \
    libpq \
    libxslt \
    nginx \
    openssl \
    xmlsec \
    && apk add --no-cache --virtual .build-deps \
    cargo \
    g++ \
    gcc \
    git \
    libffi-dev \
    libc-dev \
    linux-headers \
    make \
    postgresql-dev

COPY apps/api/requirements.txt ./requirements.txt
COPY apps/api/requirements ./requirements
RUN pip install -r requirements.txt --compile --no-cache-dir \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/*

COPY apps/api/manage.py apps/api/package.json ./
COPY apps/api/plane ./plane
COPY apps/api/templates ./templates
COPY apps/api/bin ./bin
COPY --from=web-builder /app/apps/web/build/client /usr/share/nginx/html
COPY deployments/render-test/nginx.conf.template /etc/nginx/nginx.conf.template
COPY deployments/render-test/start.sh /usr/local/bin/start-render-preview

RUN mkdir -p /code/plane/logs /tmp/nginx/client_temp /tmp/nginx/proxy_temp \
    && chmod +x ./bin/* /usr/local/bin/start-render-preview

EXPOSE 10000

CMD ["/usr/local/bin/start-render-preview"]
