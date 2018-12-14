import { Observable, Subject, Subscription, forkJoin, fromEvent } from "rxjs";
import { takeLast, map } from "rxjs/operators";
interface IdbCreate extends IDBObjectStoreParameters {
  name: string;
  index: IdbIndex[];
}
interface IdbIndex extends IDBIndexParameters {
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
export interface IdbReadWrite extends IdbReadonly {
  add(value: any, key?: IDBValidKey | IDBKeyRange): Observable<IDBValidKey>;
  delete(key: IDBValidKey | IDBKeyRange): Observable<undefined>;
  clear(): Observable<undefined>;
  put(value: any, key?: IDBValidKey | IDBKeyRange): Observable<IDBValidKey>;
}
export interface OpenIdbResult {
  readonly: (name: string) => IdbReadonly;
  readwrite: (name: string) => IdbReadWrite;
  index: (name: string) => IdbReadonly;
}
export function openIdb(
  name: string = "imeepos",
  version: number = 1,
  install?: IDbInstall
): Observable<OpenIdbResult> {
  return new Observable<OpenIdbResult>(obs => {
    function onupgradeneeded(event: IDBVersionChangeEvent) {
      let db: IDBDatabase = (event.target as any).result;
      let { newVersion, oldVersion } = event;
      // install
      if (install) {
        for (oldVersion; oldVersion < newVersion; oldVersion++) {
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
            let transaction: IDBTransaction = db.transaction(
              keys,
              "versionchange"
            );
            if (keys.length > 0) {
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
              transaction.onerror = function() {
                obs.error(new Error(`更新失败`));
              };
            }
          }
        }
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
      obs.next(create(openDBRequest.result));
      obs.complete();
    };
  });
}

function create(db: IDBDatabase): OpenIdbResult {
  function transaction(
    storeNames: string | string[],
    mode?: IDBTransactionMode
  ): IDBTransaction {
    return db.transaction(storeNames, mode);
  }
  function readonly(name: string): IdbReadonly {
    let store = transaction(name, "readonly").objectStore(name);
    return createReadonlyStore(store);
  }
  function index(name: string): IdbReadonly {
    let index = name.split(".");
    let [table, idx] = index;
    let idbIndex: IDBIndex = transaction(table, "readonly")
      .objectStore(table)
      .index(idx);
    return createIndexStore(idbIndex);
  }
  function readwrite(name: string): IdbReadWrite {
    let store = transaction(name, "readwrite").objectStore(name);
    return createReadWriteStore(store);
  }
  return { readonly: readonly, index, readwrite };
}
function createReadonlyStore(store: IDBObjectStore | IDBIndex): IdbReadonly {
  function count(key?: IDBValidKey | IDBKeyRange): Observable<number> {
    return createObservable(store.count(key));
  }
  function get(query: IDBValidKey | IDBKeyRange): Observable<any> {
    return createObservable(store.get(query));
  }
  function getAllKeys(
    query?: IDBValidKey | IDBKeyRange,
    count?: number
  ): Observable<IDBValidKey[]> {
    return createObservable(store.getAllKeys(query, count));
  }
  function getKey(
    query: IDBValidKey | IDBKeyRange
  ): Observable<IDBValidKey | undefined> {
    return createObservable(store.getKey(query));
  }
  function openCursor(
    range?: IDBValidKey | IDBKeyRange,
    direction?: IDBCursorDirection
  ): Observable<IDBCursorWithValue | null> {
    return createObservable(store.openCursor(range, direction));
  }
  function openKeyCursor(
    query?: IDBValidKey | IDBKeyRange,
    direction?: IDBCursorDirection
  ): Observable<IDBCursor | null> {
    return createObservable(store.openKeyCursor(query, direction));
  }
  return { openKeyCursor, openCursor, getKey, getAllKeys, get, count };
}
function createReadWriteStore(store: IDBObjectStore): IdbReadWrite {
  function add(
    value: any,
    key?: IDBValidKey | IDBKeyRange
  ): Observable<IDBValidKey> {
    return createObservable(store.add(value, key));
  }
  function _delete(key: IDBValidKey | IDBKeyRange): Observable<undefined> {
    return createObservable(store.delete(key));
  }
  function clear(): Observable<undefined> {
    return createObservable(store.clear());
  }
  function put(
    value: any,
    key?: IDBValidKey | IDBKeyRange
  ): Observable<IDBValidKey> {
    return createObservable(store.put(value, key));
  }
  return { ...createReadonlyStore(store), add, delete: _delete, clear, put };
}
function createIndexStore(index: IDBIndex) {
  return createReadonlyStore(index);
}
function createObservable<T>(target: IDBRequest<T>): Observable<T> {
  return new Observable(obs => {
    let sub = new Subscription();
    let success = fromEvent<T>(target, "success").pipe(
      map(() => target.result)
    );
    let error = fromEvent(target, "error");
    sub.add(
      error.subscribe(res => {
        try {
          obs.error((res.target as any).error);
        } catch (e) {
          obs.error(e);
        }
      })
    );
    sub.add(
      success.subscribe(res => {
        obs.next(res);
        obs.complete();
      })
    );
    return () => sub.unsubscribe();
  });
}
