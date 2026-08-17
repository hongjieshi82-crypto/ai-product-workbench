# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import login

from plane.utils.personal_workspace import get_personal_user


class PersonalWorkspaceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_anonymous and self._is_local_request(request):
            user = get_personal_user()
            if user:
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return self.get_response(request)

    @staticmethod
    def _is_local_request(request):
        hostname = urlsplit(f"//{request.get_host()}").hostname
        return hostname in settings.PERSONAL_WORKSPACE_ALLOWED_HOSTS
