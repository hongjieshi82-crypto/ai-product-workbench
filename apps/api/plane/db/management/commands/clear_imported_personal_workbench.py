# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from plane.db.models import Issue, PersonalWorkbenchItem, ProjectMember
from plane.utils.personal_workspace import get_personal_user


class Command(BaseCommand):
    help = "Hide imported Feishu records from the personal workbench while preserving the source file"

    @transaction.atomic
    def handle(self, *args, **options):
        user = get_personal_user()
        if user is None:
            raise CommandError("Personal user does not exist")
        membership = (
            ProjectMember.objects.select_related("project")
            .filter(member=user, is_active=True)
            .order_by("created_at")
            .first()
        )
        if membership is None:
            raise CommandError("Personal project does not exist")

        imported_items = PersonalWorkbenchItem.objects.filter(
            project=membership.project,
            source_record_id__isnull=False,
            issue__external_source__startswith="feishu_base:",
        )
        issue_ids = list(imported_items.values_list("issue_id", flat=True))
        now = timezone.now()
        item_count = imported_items.update(deleted_at=now, updated_by=user)
        issue_count = Issue.objects.filter(id__in=issue_ids).update(deleted_at=now, updated_by=user)

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported copies cleared: {item_count} workbench items, "
                f"{issue_count} Plane issues. Source file preserved."
            )
        )
