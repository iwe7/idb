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
