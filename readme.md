## demo

```ts
import { openIdb, IDbInstall } from "imeepos/idb";
async function bootstrap() {
  let update: IDbInstall = {
    [`0-1`]: {
      create: [
        {
          name: "member",
          autoIncrement: true,
          keyPath: "id",
          index: [
            {
              name: "openid",
              keyPath: "openid",
              unique: true
            }
          ]
        }
      ]
    }
  };
  let db = await openIdb("imeepos", 1, update);
  let addResult = await db.readwrite("member").add({
    openid: "fromUser"
  });
}
bootstrap();
```

## docs

1. openIdb(name: string = "imeepos",version: number = 1,install?: IDbInstall)
   - name 数据库名字
   - version 数据库版本号
   - install 数据库更新及安装配置
     - 0-1 数据库安装
     - 1-2 数据库 v1 升级到 v2 脚本
2. IDbInstall

```ts
[key: string]: {
    // 新建
    create?: IdbCreate[];
    // 更新
    update?: {
      [key: string]: {
        create: IdbIndex[];
        delete: string[];
      };
    };
    // 删除
    delete?: string[];
  };
```
