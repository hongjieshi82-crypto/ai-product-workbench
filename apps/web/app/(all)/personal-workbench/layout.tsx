import { Outlet } from "react-router";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import type { Route } from "./+types/layout";

export const meta: Route.MetaFunction = () => [{ title: "个人产品工作台" }];

export default function PersonalWorkbenchLayout() {
  return (
    <AuthenticationWrapper>
      <Outlet />
    </AuthenticationWrapper>
  );
}
