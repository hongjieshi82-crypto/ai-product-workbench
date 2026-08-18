#!/bin/bash

set -euo pipefail

: "${PORT:=10000}"
: "${PREVIEW_USERNAME:=workbench}"
: "${PREVIEW_PASSWORD:?Set PREVIEW_PASSWORD in Render before deploying}"
: "${RENDER_EXTERNAL_HOSTNAME:?Render did not provide RENDER_EXTERNAL_HOSTNAME}"
: "${RENDER_EXTERNAL_URL:?Render did not provide RENDER_EXTERNAL_URL}"

export WEB_URL="${WEB_URL:-$RENDER_EXTERNAL_URL}"
export APP_BASE_URL="${APP_BASE_URL:-$RENDER_EXTERNAL_URL}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-$RENDER_EXTERNAL_URL}"
export PERSONAL_WORKSPACE_ALLOWED_HOSTS="${PERSONAL_WORKSPACE_ALLOWED_HOSTS:-$RENDER_EXTERNAL_HOSTNAME}"

htpasswd -bc /etc/nginx/preview.htpasswd "$PREVIEW_USERNAME" "$PREVIEW_PASSWORD" >/dev/null
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

cd /code
python manage.py wait_for_db
python manage.py migrate --noinput
CELERY_TASK_ALWAYS_EAGER=0 python manage.py register_instance "${RENDER_SERVICE_ID:-render-preview}"
python manage.py configure_instance
python manage.py setup_personal_workspace
python manage.py clear_cache
python manage.py collectstatic --noinput

gunicorn \
  --workers "${GUNICORN_WORKERS:-1}" \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 127.0.0.1:8000 \
  --max-requests 1200 \
  --max-requests-jitter 1000 \
  --access-logfile - \
  plane.asgi:application &
api_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

shutdown() {
  kill -TERM "$api_pid" "$nginx_pid" 2>/dev/null || true
  wait "$api_pid" "$nginx_pid" 2>/dev/null || true
}

trap shutdown EXIT INT TERM

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

exit 1
