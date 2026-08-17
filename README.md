# 个人产品工作台

一个面向个人产品经理的轻量需求管理工作台。页面强调直接、表格化和可编辑，不是通用项目管理系统。

## 管理内容

- 排期日历
- 产品目标
- 个人任务
- 场景挖掘
- 需求池
- 功能清单
- 迭代任务
- Bug 清单
- Badcase
- Case 聚类分析

## 已有能力

- 新增、编辑和删除个人事项
- 自定义下拉选项
- 手动调整表格列宽
- 在需求池中拖动事项调整顺序
- 根据日期在排期日历中同步展示
- 对反馈、需求和 Badcase 进行 Case 聚类分析
- 手动修改、合并、拆分和重新归类聚类结果
- 保留所有原始事项，聚类分析不会覆盖或删除原始数据

## 当前使用方式

当前版本是本地单人版，默认只在自己的电脑上使用。

1. 打开 Docker Desktop。
2. 在项目目录运行后台服务：

   ```bash
   docker compose -f docker-compose-local.yml up -d
   ```

3. 启动网页：

   ```bash
   corepack pnpm --filter=web dev
   ```

4. 打开 <http://localhost:3000/workbench/calendar>。

已有本地数据保存在 Docker 数据卷中，不在 GitHub 仓库里。重新拉取代码不会自动带上个人事项。

## 上传 GitHub 前

- 建议先使用私有仓库。
- 不要提交 `.env`、密码、密钥、数据库文件或本地导出的原始资料。
- `node_modules`、构建产物和本地运行数据已经加入忽略规则。
- 当前版本不是可直接公开部署的多人服务。上线给他人使用前，还需要增加账号数据隔离、部署配置和安全检查。

更具体的操作见 [GitHub 上传说明](docs/GITHUB_UPLOAD.md)。

## 主要目录

- `apps/web`：个人产品工作台网页
- `apps/api`：数据接口、个人工作台模型和 Case 聚类能力
- `packages`：网页运行依赖的共用组件
- `docker-compose-local.yml`：本地数据库和后台服务

## 开源来源

本项目基于 [Plane](https://github.com/makeplane/plane) 修改，并继续遵循 GNU Affero General Public License v3.0。为了保证程序可以继续构建，部分底层包名、代码路径和 Docker 内部名称仍保留 `plane`。这些是技术依赖名称，不是产品对外名称。

完整许可证见 [LICENSE.txt](LICENSE.txt)，修改与来源说明见 [NOTICE.md](NOTICE.md)。
