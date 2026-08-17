/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { GOD_MODE_URL } from "@plane/constants";
import DefaultLayout from "@/layouts/default-layout";
import { Button } from "@plane/propel/button";

export function InstanceNotReady() {
  return (
    <DefaultLayout>
      <div className="relative z-10 flex h-screen w-screen overflow-hidden bg-[#f6f7f9]">
        <div className="flex h-full w-full flex-col items-center px-8 pt-6 pb-10">
          <div className="sticky top-0 flex w-full shrink-0 items-center justify-between gap-6">
            <span className="text-base font-semibold text-[#252f49]">个人产品工作台</span>
          </div>
          <div className="flex h-full w-full flex-col items-center justify-center gap-7">
            <div className="flex flex-col items-center gap-11">
              <div className="text-2xl relative flex h-16 w-16 items-center justify-center rounded-lg bg-[#252f49] font-semibold text-white">
                产
                <span className="absolute right-2 bottom-2 h-3 w-3 rounded-full bg-[#ffc928]" />
              </div>
              <div className="flex max-w-124 flex-col items-center gap-3">
                <h1 className="text-h2-semibold text-primary">个人产品工作台尚未准备好</h1>
                <p className="text-center text-body-md-regular text-secondary">
                  完成一次初始化后，就可以开始管理产品目标、需求和任务。
                </p>
              </div>
            </div>
            <a href={GOD_MODE_URL} className="w-72">
              <Button variant="primary" className="w-full" size="xl">
                开始设置
              </Button>
            </a>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
