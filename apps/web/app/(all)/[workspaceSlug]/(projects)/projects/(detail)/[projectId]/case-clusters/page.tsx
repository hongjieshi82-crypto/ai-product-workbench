/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import { EUserPermissionsLevel } from "@plane/constants";
import { EUserProjectRoles } from "@plane/types";
import { CreateCaseClusterAnalysisModal, CaseClusterRoot } from "@/components/case-cluster";
import { PageHead } from "@/components/core/page-title";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { Route } from "./+types/page";

function CaseClustersPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const { allowPermissions } = useUserPermissions();
  const isCreateModalOpen = searchParams.get("create") === "1";
  const route = `/${workspaceSlug}/projects/${projectId}/case-clusters`;
  const canManage = allowPermissions(
    [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspaceSlug,
    projectId
  );

  return (
    <div className="h-full w-full overflow-hidden">
      <PageHead title="Case 聚类分析" />
      <CaseClusterRoot
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        onCreate={() => router.push(`${route}?create=1`)}
      />
      <CreateCaseClusterAnalysisModal
        isOpen={isCreateModalOpen && canManage}
        onClose={() => router.replace(route)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
      />
    </div>
  );
}

export default observer(CaseClustersPage);
