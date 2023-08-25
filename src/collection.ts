import type {
  Collection as MongoCollection,
  Document as MongoDocument,
  Filter,
  WithId,
} from "mongodb";
import RelayCursor from "./cursor";
import type { RelayDb } from "./database";

function toError(jsonError: Record<string, string> | string) {
  let error: Error;

  if (!jsonError) {
    error = new Error(
      "throwError(jsonError) called with falsey jsonError argument",
    );
  } else if (typeof jsonError === "object") {
    error = new Error(jsonError.message);
    if (jsonError.stack) error.stack = jsonError.stack;
    if (jsonError.name) error.name = jsonError.name;
  } else if (typeof jsonError === "string") {
    error = new Error(jsonError as string);
  } else {
    error = new Error("throwError(jsonError) called with invalid jsonError");
  }

  return error;
}

function throwOrReturnAs<T extends (...args: any) => any>(
  data: Record<string, unknown>,
) {
  if (data.$result) return data.$result as unknown as ReturnType<T>;
  else throw toError(data.$error as Record<string, string> | string);
}

class RelayCollection<DocType extends MongoDocument = MongoDocument> {
  db: RelayDb;
  name: string;

  constructor(db: RelayDb, name: string) {
    this.db = db;
    this.name = name;
  }

  find(filter: Filter<DocType>) {
    return new RelayCursor(this, filter);
  }

  async insertOne(doc: DocType) {
    const data = await this._exec("insertOne", [doc]);
    return throwOrReturnAs<MongoCollection["insertOne"]>(data);
  }

  async insertMany(docs: DocType[]) {
    const data = await this._exec("insertMany", [docs]);
    return throwOrReturnAs<MongoCollection["insertMany"]>(data);
  }

  async updateOne(filter: Filter<DocType>, update: unknown) {
    const data = await this._exec("updateOne", [filter, update]);
    return throwOrReturnAs<MongoCollection["updateOne"]>(data);
  }

  async updateMany(filter: Filter<DocType>, update: unknown) {
    const data = await this._exec("updateMany", [filter, update]);
    return throwOrReturnAs<MongoCollection["updateMany"]>(data);
  }

  async deleteOne(filter: Filter<DocType>) {
    const data = await this._exec("deleteOne", [filter]);
    return throwOrReturnAs<MongoCollection["deleteOne"]>(data);
  }

  async deleteMany(filter: Filter<DocType>) {
    const data = await this._exec("deleteMany", [filter]);
    return throwOrReturnAs<MongoCollection["deleteMany"]>(data);
  }

  async _exec(op: string, payload: unknown) {
    const params = new URLSearchParams();
    // params.append("db", this.db._dbName || "");
    params.append("coll", this.name);
    params.append("op", op);

    const url = this.db._client._url + "?" + params;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return (await response.json()) as Record<string, unknown>;
  }
}

export type { RelayCollection };
export default RelayCollection;
