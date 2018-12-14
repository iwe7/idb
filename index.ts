import { Observable, Subject, Subscription, forkJoin } from "rxjs";
import { takeLast } from "rxjs/operators";
export interface IdbCreate extends IDBObjectStoreParameters {
  name: string;
  index: IdbIndex[];
}
export interface IdbUpdate {
  old: any;
  new: any;
}
export interface IdbIndex extends IDBIndexParameters {
  name: string;
  keyPath: string | string[];
}
export interface IDbInstall {
  [key: string]: {
    create?: IdbCreate[];
    update?: {
      [key: string]: {
        create: IdbIndex[];
        delete: string[];
      };
    };
    delete?: string[];
  };
}
export interface IdbWrite {
  add(value: any, key?: IDBValidKey | IDBKeyRange): Promise<IDBValidKey>;
}
export interface OpenIdbResult {
  readonly: (name: string) => IDBObjectStore;
  readwrite: (name: string) => IdbWrite;
  index: (name: string) => IDBIndex;
}
export function openIdb(
  name: string = "imeepos",
  version: number = 1,
  install?: IDbInstall
): Promise<OpenIdbResult> {
  return new Observable<OpenIdbResult>(obs => {
    let upgradeneeded = new Subject();
    let updating = false;
    let sub = new Subscription();
    function onupgradeneeded(event: IDBVersionChangeEvent) {
      updating = true;
      let db: IDBDatabase = (event.target as any).result;
      let dbHandler: OpenIdbResult = create(db);
      let { newVersion, oldVersion } = event;
      // install
      if (install) {
        let updates = [];
        for (oldVersion; oldVersion < newVersion; oldVersion++) {
          let obs: Subject<void> = new Subject();
          let item = install[`${oldVersion}-${newVersion}`];
          if (item.create) {
            item.create.forEach(store => {
              let { name, index, ...opt } = store;
              if (!db.objectStoreNames.contains(name)) {
                let objectStore = db.createObjectStore(name, opt);
                index.forEach(idx => {
                  let { name, keyPath, ...opt } = idx;
                  objectStore.createIndex(name, keyPath, opt);
                });
              }
            });
          }
          if (item.delete) {
            item.delete.forEach(store => {
              db.deleteObjectStore(store);
            });
          }
          if (item.update) {
            let keys = Object.keys(item.update);
            if (keys.length > 0) {
              let transaction: IDBTransaction = db.transaction(
                keys,
                "versionchange"
              );
              keys.map((key, index) => {
                let store: IDBObjectStore = transaction.objectStore(key);
                let data = item.update[key];
                data.create.map(idx => {
                  let { name, keyPath, ...opt } = idx;
                  store.createIndex(name, keyPath, opt);
                });
                data.delete.map(name => {
                  store.deleteIndex(name);
                });
              });
              transaction.oncomplete = function() {
                obs.next();
                obs.complete();
              };
              transaction.onerror = function() {
                obs.error(new Error(`更新失败`));
              };
            }
          } else {
            obs.next();
            obs.complete();
          }
          updates.push(obs);
        }
        sub.add(
          forkJoin(...updates)
            .pipe(takeLast(1))
            .subscribe(() => {
              upgradeneeded.next(dbHandler);
              upgradeneeded.complete();
            })
        );
      } else {
        upgradeneeded.next(dbHandler);
        upgradeneeded.complete();
      }
    }
    let openDBRequest: IDBOpenDBRequest = indexedDB.open(name, version);
    openDBRequest.onerror = function() {
      obs.error(new Error(`打开数据库错误`));
    };
    openDBRequest.onupgradeneeded = onupgradeneeded;
    openDBRequest.onblocked = function() {
      console.log("onblocked");
    };
    openDBRequest.onsuccess = function() {
      upgradeneeded.next(create(openDBRequest.result));
      if (!updating) {
        upgradeneeded.complete();
      }
    };
    sub.add(
      upgradeneeded.pipe(takeLast(1)).subscribe((res: any) => {
        obs.next(res);
        obs.complete();
        sub.unsubscribe();
      })
    );
  }).toPromise();
}

function create(db: IDBDatabase) {
  function transaction(
    storeNames: string | string[],
    mode?: IDBTransactionMode
  ): IDBTransaction {
    return db.transaction(storeNames, mode);
  }
  function readonly(name: string): IDBObjectStore {
    return transaction(name, "readonly").objectStore(name);
  }
  function index(name: string): IDBIndex {
    let index = name.split(".");
    let [table, idx] = index;
    return readonly(table).index(idx);
  }
  function readwrite(name: string): IdbWrite {
    let store = transaction(name, "readwrite").objectStore(name);
    return createWriteStore(store);
  }
  return { readonly, index, readwrite };
}

function createWriteStore(store: IDBObjectStore) {
  function add(value: any, key?: IDBValidKey | IDBKeyRange) {
    return new Promise<IDBValidKey>((resolve, reject) => {
      let request = store.add(value, key);
      request.onsuccess = function() {
        resolve(request.result);
      };
      request.onerror = function() {
        reject(new Error(`插入数据失败`));
      };
    });
  }
  return { add };
}
