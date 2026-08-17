# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from plane.db.models import (
    Issue,
    IssueType,
    PersonalWorkbenchItem,
    PersonalWorkbenchTable,
    Project,
    ProjectMember,
)
from plane.db.models.issue_type import ProjectIssueType
from plane.utils.feishu_base import normalize_feishu_base
from plane.utils.personal_workspace import get_personal_user


class Command(BaseCommand):
    help = "Import a Feishu Base export into the personal product workbench without replacing existing items"

    def add_arguments(self, parser):
        parser.add_argument("file_path", type=str)
        parser.add_argument("--project-id", type=str, default=None)

    @transaction.atomic
    def handle(self, *args, **options):
        user = get_personal_user()
        if user is None:
            raise CommandError("Personal user does not exist")

        if options["project_id"]:
            project = Project.objects.filter(id=options["project_id"]).first()
        else:
            membership = (
                ProjectMember.objects.select_related("project")
                .filter(member=user, is_active=True)
                .order_by("created_at")
                .first()
            )
            project = membership.project if membership else None
        if project is None:
            raise CommandError("Personal project does not exist")

        tables = normalize_feishu_base(options["file_path"])
        project.is_issue_type_enabled = True
        project.save(update_fields=["is_issue_type_enabled", "updated_at"])

        created_count = 0
        skipped_count = 0
        for table_data in tables:
            issue_type, _ = IssueType.objects.get_or_create(
                workspace=project.workspace,
                external_source="personal_workbench",
                external_id=table_data["key"],
                defaults={
                    "name": table_data["name"],
                    "description": "个人产品经理工作台事项类型",
                    "is_active": True,
                    "created_by": user,
                },
            )
            ProjectIssueType.objects.get_or_create(
                project=project,
                issue_type=issue_type,
                defaults={"level": table_data["sort_order"], "created_by": user},
            )
            table, _ = PersonalWorkbenchTable.objects.update_or_create(
                project=project,
                key=table_data["key"],
                defaults={
                    "workspace": project.workspace,
                    "name": table_data["name"],
                    "source_table_id": table_data["source_table_id"],
                    "sort_order": table_data["sort_order"],
                    "primary_field_id": table_data["primary_field_id"],
                    "fields": table_data["fields"],
                    "views": table_data["views"],
                    "source_schema": table_data["source_schema"],
                    "updated_by": user,
                },
            )

            for record in table_data["records"]:
                if PersonalWorkbenchItem.objects.filter(
                    table=table,
                    source_record_id=record["id"],
                ).exists():
                    skipped_count += 1
                    continue

                issue = Issue.objects.filter(
                    project=project,
                    external_source=f"feishu_base:{table.source_table_id}",
                    external_id=record["id"],
                ).first()
                if issue is None:
                    issue = Issue.objects.create(
                        project=project,
                        workspace=project.workspace,
                        name=record["title"][:255],
                        type=issue_type,
                        external_source=f"feishu_base:{table.source_table_id}",
                        external_id=record["id"],
                        created_by=user,
                    )
                PersonalWorkbenchItem.objects.create(
                    project=project,
                    workspace=project.workspace,
                    table=table,
                    issue=issue,
                    values=record["values"],
                    source_values={
                        "cells": record["source_values"],
                        "meta": record["source_meta"],
                    },
                    source_record_id=record["id"],
                    sort_order=record["sort_order"],
                    created_by=user,
                )
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Personal workbench imported: {len(tables)} tables, {created_count} created, {skipped_count} preserved"
            )
        )
