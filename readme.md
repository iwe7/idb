## 库
1. rxjs 强大的异步管理库

## 浏览器端 indexed db 封装成更简洁易操作的接口

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
  let db = await openIdb("imeepos", 1, update).toPromise();
  console.log(db);
  let addResult = await db
    .readwrite("member")
    .add({
      openid: "fromUser"
    })
    .toPromise();
  console.log(addResult);
}
bootstrap();
```

## docs

### openIdb

```ts
export function openIdb(
  // 数据库名字
  name: string = "imeepos",
  // 数据库版本号
  version: number = 1,
  // 数据库更新及安装脚本
  install?: IDbInstall
): Observable<OpenIdbResult>;
```

### IDbInstall

```ts
export interface IDbInstall {
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
}
```

### OpenIdbResult

```ts
// openIdb返回结果
export interface OpenIdbResult {
  // 读
  readonly: (name: string) => IdbReadonly;
  // 读写
  readwrite: (name: string) => IdbReadWrite;
  // 索引 index('member.openid')
  index: (name: string) => IdbReadonly;
}
```

### IdbReadonly

```ts
export interface IdbReadonly {
  count(key?: IDBValidKey | IDBKeyRange): Observable<number>;
  get(query: IDBValidKey | IDBKeyRange): Observable<any | undefined>;
  getAllKeys(
    query?: IDBValidKey | IDBKeyRange,
    count?: number
  ): Observable<IDBValidKey[]>;
  getKey(query: IDBValidKey | IDBKeyRange): Observable<IDBValidKey | undefined>;
  openCursor(
    range?: IDBValidKey | IDBKeyRange,
    direction?: IDBCursorDirection
  ): Observable<IDBCursorWithValue | null>;
  openKeyCursor(
    query?: IDBValidKey | IDBKeyRange,
    direction?: IDBCursorDirection
  ): Observable<IDBCursor | null>;
}
```

### IdbReadWrite

```ts
export interface IdbReadWrite extends IdbReadonly {
  add(value: any, key?: IDBValidKey | IDBKeyRange): Observable<IDBValidKey>;
  delete(key: IDBValidKey | IDBKeyRange): Observable<undefined>;
  clear(): Observable<undefined>;
  put(value: any, key?: IDBValidKey | IDBKeyRange): Observable<IDBValidKey>;
}
```
