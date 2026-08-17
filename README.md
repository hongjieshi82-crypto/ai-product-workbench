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
- 邮箱验证码登录
- 每个账号拥有独立的空白工作台，账号之间的数据互不可见

## 当前使用方式

当前版本既可以继续在自己的电脑上使用，也已经具备多人账号的数据隔离。

1. 打开 Docker Desktop。
2. 在项目目录运行后台服务：

   ```bash
   docker compose -f docker-compose-local.yml up -d
   ```

3. 启动网页：

   ```bash
   corepack pnpm --filter=web dev
   ```

4. 打开 <http://localhost:3000>，输入邮箱登录。

本机默认会把测试验证码直接显示在登录页，方便自己使用。这个方式只允许从 `localhost` 访问。

已有本地数据保存在 Docker 数据卷中，不在 GitHub 仓库里。重新拉取代码不会自动带上个人事项。

## 部署前

- 不要提交 `.env`、密码、密钥、数据库文件或本地导出的原始资料。
- `node_modules`、构建产物和本地运行数据已经加入忽略规则。
- 把 `WORKBENCH_DEV_LOGIN_CODE` 设为 `0`，不能在线上显示测试验证码。
- 在 `apps/api/.env` 中填写邮件服务商提供的 `EMAIL_HOST`、账号、密码、端口和发件地址。
- 线上需要使用独立的 PostgreSQL、Redis、对象存储和 HTTPS 域名。

更具体的操作见 [GitHub 上传说明](docs/GITHUB_UPLOAD.md)。

## 主要目录

- `apps/web`：个人产品工作台网页
- `apps/api`：数据接口、个人工作台模型和 Case 聚类能力
- `packages`：网页运行依赖的共用组件
- `docker-compose-local.yml`：本地数据库和后台服务

## 开源来源

本项目基于 [Plane](https://github.com/makeplane/plane) 修改，并继续遵循 GNU Affero General Public License v3.0。为了保证程序可以继续构建，部分底层包名、代码路径和 Docker 内部名称仍保留 `plane`。这些是技术依赖名称，不是产品对外名称。

完整许可证见 [LICENSE.txt](LICENSE.txt)，修改与来源说明见 [NOTICE.md](NOTICE.md)。
