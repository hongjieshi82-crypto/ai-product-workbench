/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { ScanSearch } from "lucide-react";
import { useParams } from "next/navigation";
import { EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { EUserProjectRoles } from "@plane/types";
import { Breadcrumbs, Header } from "@plane/ui";
import { CommonProjectBreadcrumbs } from "@/components/breadcrumbs/common";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

export const CaseClustersHeader = observer(function CaseClustersHeader() {
  const { workspaceSlug, projectId } = useParams();
  const router = useAppRouter();
  const { loader } = useProject();
  const { allowPermissions } = useUserPermissions();
  const workspace = workspaceSlug?.toString() ?? "";
  const project = projectId?.toString() ?? "";
  const canManage = allowPermissions(
    [EUserProjectRoles.ADMIN, EUserProjectRoles.MEMBER],
    EUserPermissionsLevel.PROJECT,
    workspace,
    project
  );

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs workspaceSlug={workspace} projectId={project} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Case 聚类分析"
                href={`/${workspace}/projects/${project}/case-clusters`}
                icon={<ScanSearch className="size-4 text-tertiary" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      {canManage && (
        <Header.RightItem>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push(`/${workspace}/projects/${project}/case-clusters?create=1`)}
          >
            新建分析
          </Button>
        </Header.RightItem>
      )}
    </Header>
  );
});
