# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from plane.license.models import Instance
from plane.utils.personal_workspace import setup_personal_workspace


class Command(BaseCommand):
    help = "Prepare the local single-user workspace when personal mode is enabled"

    def handle(self, *args, **options):
        if not settings.PERSONAL_WORKSPACE_MODE:
            return

        instance = Instance.objects.first()
        if instance is None:
            raise CommandError("The Plane instance has not been registered yet.")

        result = setup_personal_workspace(instance)
        self.stdout.write(
            self.style.SUCCESS(
                f"Personal workspace ready: /{result.workspace.slug}/projects/{result.project.id}/case-clusters"
            )
        )
