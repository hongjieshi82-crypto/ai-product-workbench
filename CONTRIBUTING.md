# 参与开发

这个仓库只接受与个人产品工作台范围直接相关的修改：产品目标、个人任务、场景挖掘、需求池、功能清单、迭代任务、Bug、Badcase、排期日历和 Case 聚类分析。

不要增加 OKR、工时、财务、通知、复杂权限或通用团队项目管理功能。

## 提交问题

请使用仓库中的中文问题模板，并说明：

- 实际操作步骤
- 当前结果和期望结果
- 使用环境
- 必要的截图

不要在问题或截图中包含密码、API 密钥、客户名称或真实用户隐私数据。

## 修改代码

1. 从 `main` 创建分支。
2. 保持修改范围小而明确。
3. 不删除、覆盖或合并原始事项数据。
4. 前端修改至少运行：

   ```bash
   corepack pnpm --filter=web check:types
   ```

5. 后端个人工作台测试运行：

   ```bash
   docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/unit/views/test_personal_workbench.py
   ```

6. 在拉取请求中写明测试结果和数据安全影响。

## 上游代码

仓库基于 Plane 修改。涉及底层共用代码时，需要保留原始版权头和 AGPL-3.0 许可证要求；具体见 `NOTICE.md` 和 `LICENSE.txt`。
