# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Test Settings"""

from .common import *  # noqa

DEBUG = True

# Product-specific redirects are covered by focused workbench tests. Keep the
# shared authentication contract suite on its standard redirect behavior.
PRODUCT_WORKBENCH_MODE = False
WORKBENCH_DEV_LOGIN_CODE = False

# Send it in a dummy outbox
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

INSTALLED_APPS.append(  # noqa
    "plane.tests"
)
