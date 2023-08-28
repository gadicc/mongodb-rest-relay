import type {
  Collection as MongoCollection,
  Document as MongoDocument,
  Filter,
  FindOptions,
  WithId,
} from "mongodb";
import { EJSON } from "bson";
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

function throwOrReturnAs<T>(data: Record<string, unknown>) {
  if ("$result" in data) return data.$result as unknown as T;
  else throw toError(data.$error as Record<string, string> | string);
}

class RelayCollection<TSchema extends MongoDocument = MongoDocument> {
  db: RelayDb;
  name: string;

  constructor(db: RelayDb, name: string) {
    this.db = db;
    this.name = name;
  }

  find(filter: Filter<TSchema>) {
    return new RelayCursor(this, filter);
  }

  createIndex() {}

  /**
   * Fetches the first document that matches the filter
   *
   * @param filter - Query for find Operation
   * @param options - Optional settings for the command
   */
  findOne(): Promise<WithId<TSchema> | null>;
  findOne(filter: Filter<TSchema>): Promise<WithId<TSchema> | null>;
  findOne(
    filter: Filter<TSchema>,
    options: FindOptions,
  ): Promise<WithId<TSchema> | null>;
  findOne<T = TSchema>(): Promise<T | null>;
  findOne<T = TSchema>(filter: Filter<TSchema>): Promise<T | null>;
  findOne<T = TSchema>(
    filter: Filter<TSchema>,
    options?: FindOptions,
  ): Promise<T | null>;

  async findOne(filter?: Filter<TSchema>): Promise<WithId<TSchema> | null> {
    const data = await this._exec("findOne", [filter]);
    type x = ReturnType<MongoCollection<TSchema>["findOne"]>;
    return throwOrReturnAs<WithId<TSchema> | null>(data);
  }

  async insertOne(doc: TSchema) {
    const data = await this._exec("insertOne", [doc]);
    return throwOrReturnAs<ReturnType<MongoCollection["insertOne"]>>(data);
  }

  async insertMany(docs: TSchema[]) {
    const data = await this._exec("insertMany", [docs]);
    return throwOrReturnAs<ReturnType<MongoCollection["insertMany"]>>(data);
  }

  async updateOne(filter: Filter<TSchema>, update: unknown) {
    const data = await this._exec("updateOne", [filter, update]);
    return throwOrReturnAs<ReturnType<MongoCollection["updateOne"]>>(data);
  }

  async updateMany(filter: Filter<TSchema>, update: unknown) {
    const data = await this._exec("updateMany", [filter, update]);
    return throwOrReturnAs<ReturnType<MongoCollection["updateMany"]>>(data);
  }

  async deleteOne(filter: Filter<TSchema>) {
    const data = await this._exec("deleteOne", [filter]);
    return throwOrReturnAs<ReturnType<MongoCollection["deleteOne"]>>(data);
  }

  async deleteMany(filter: Filter<TSchema>) {
    const data = await this._exec("deleteMany", [filter]);
    return throwOrReturnAs<ReturnType<MongoCollection["deleteMany"]>>(data);
  }

  async _exec(op: string, payload: unknown) {
    const relayPassword = process.env.MONGODB_RELAY_PASSWORD;
    if (relayPassword === undefined)
      throw new Error("Set process.env.MONGODB_RELAY_PASSWORD first");

    const params = new URLSearchParams();
    // params.append("db", this.db._dbName || "");
    params.append("coll", this.name);
    params.append("op", op);

    const url = this.db._client._url + "?" + params;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Bearer: relayPassword,
      },
      body: EJSON.stringify(payload),
    });

    if (response.status === 200) {
      const text = await response.text();
      return EJSON.parse(text) as Record<string, unknown>;
    }

    const text = await response.text();
    throw new Error("HTTP " + response.status + ": " + text);
  }
}

export type { RelayCollection };
export default RelayCollection;
