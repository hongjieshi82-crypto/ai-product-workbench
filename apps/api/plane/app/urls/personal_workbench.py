# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import (
    PersonalWorkbenchAISuggestionEndpoint,
    PersonalWorkbenchEndpoint,
    PersonalWorkbenchCalendarEndpoint,
    PersonalWorkbenchFieldOptionsEndpoint,
    PersonalWorkbenchItemDetailEndpoint,
    PersonalWorkbenchItemEndpoint,
    PersonalWorkbenchItemReorderEndpoint,
)


urlpatterns = [
    path(
        "personal-workbench/ai-suggestion/",
        PersonalWorkbenchAISuggestionEndpoint.as_view(),
        name="personal-workbench-ai-suggestion",
    ),
    path("personal-workbench/", PersonalWorkbenchEndpoint.as_view(), name="personal-workbench"),
    path(
        "personal-workbench/calendar/",
        PersonalWorkbenchCalendarEndpoint.as_view(),
        name="personal-workbench-calendar",
    ),
    path(
        "personal-workbench/tables/<uuid:table_id>/fields/<str:field_id>/options/",
        PersonalWorkbenchFieldOptionsEndpoint.as_view(),
        name="personal-workbench-field-options",
    ),
    path(
        "personal-workbench/items/",
        PersonalWorkbenchItemEndpoint.as_view(),
        name="personal-workbench-items",
    ),
    path(
        "personal-workbench/items/reorder/",
        PersonalWorkbenchItemReorderEndpoint.as_view(),
        name="personal-workbench-items-reorder",
    ),
    path(
        "personal-workbench/items/<uuid:item_id>/",
        PersonalWorkbenchItemDetailEndpoint.as_view(),
        name="personal-workbench-item-detail",
    ),
]
