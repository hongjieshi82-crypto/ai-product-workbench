# 修改与来源说明

“个人产品工作台”基于 Plane 社区版源代码修改。

- 上游项目：Plane
- 上游地址：https://github.com/makeplane/plane
- 上游许可证：GNU Affero General Public License v3.0
- 当前产品名称：个人产品工作台

当前仓库保留 Plane 原有的版权声明和 `LICENSE.txt`。新增或修改的个人工作台功能同样按 GNU Affero General Public License v3.0 发布。

主要定制范围包括：

- 中文产品工作台、邮箱验证码登录和账号数据隔离
- 产品目标、个人任务、场景、需求、功能、迭代任务、Bug 和 Badcase 表格
- 排期日历
- Case 聚类分析
- 可编辑选项、列宽和需求排序

代码中的 `plane`、`@plane` 和部分 Docker 服务名属于上游兼容标识。保留这些名称是为了继续使用现有依赖、数据库迁移和本地数据，不代表产品仍以 Plane 的名称对外提供。
