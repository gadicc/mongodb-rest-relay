import type {
  Collection as MongoCollection,
  CountDocumentsOptions,
  Document,
  EstimatedDocumentCountOptions,
  Filter,
  FindOptions,
  WithId,
  FindCursor,
} from "mongodb";
import { EJSON } from "bson";
import RelayCursor from "./cursor";
import type { RelayDb } from "./database";
import { shiftOptionsOnce } from "./setOptions";

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

/**
 * The **Collection** class is an internal class that embodies a MongoDB collection
 * allowing for insert/find/update/delete and other command operation on that MongoDB collection.
 *
 * **COLLECTION Cannot directly be instantiated**
 * @public
 *
 * @example
 * ```ts
 * import { MongoClient } from 'mongodb';
 *
 * interface Pet {
 *   name: string;
 *   kind: 'dog' | 'cat' | 'fish';
 * }
 *
 * const client = new MongoClient('mongodb://localhost:27017');
 * const pets = client.db().collection<Pet>('pets');
 *
 * const petCursor = pets.find();
 *
 * for await (const pet of petCursor) {
 *   console.log(`${pet.name} is a ${pet.kind}!`);
 * }
 * ```
 */
class RelayCollection<TSchema extends Document = Document> {
  db: RelayDb;
  name: string;
  _cacheable = ["find", "findOne", "estimatedDocumentCount", "countDocuments"];

  constructor(db: RelayDb, name: string) {
    this.db = db;
    this.name = name;
  }

  /**
   * Creates a cursor for a filter that can be used to iterate over results from MongoDB
   *
   * @param filter - The filter predicate. If unspecified, then all documents in the collection will match the predicate
   */
  find(): RelayCursor<WithId<TSchema>>;
  find(
    filter: Filter<TSchema>,
    options?: FindOptions,
  ): RelayCursor<WithId<TSchema>>;
  find<T extends Document>(
    filter: Filter<TSchema>,
    options?: FindOptions,
  ): RelayCursor<T>;
  find(filter?: Filter<TSchema>, opts?: FindOptions) {
    if (opts)
      throw new Error("find(filter, OPTIONS) - OPTIONS not implemented yet");
    return new RelayCursor<WithId<TSchema>>(this, filter || {});
  }

  /**
   * Gets an estimate of the count of documents in a collection using collection metadata.
   * This will always run a count command on all server versions.
   *
   * due to an oversight in versions 5.0.0-5.0.8 of MongoDB, the count command,
   * which estimatedDocumentCount uses in its implementation, was not included in v1 of
   * the Stable API, and so users of the Stable API with estimatedDocumentCount are
   * recommended to upgrade their server version to 5.0.9+ or set apiStrict: false to avoid
   * encountering errors.
   *
   * @see {@link https://www.mongodb.com/docs/manual/reference/command/count/#behavior|Count: Behavior}
   * @param options - Optional settings for the command
   */
  async estimatedDocumentCount(
    options?: EstimatedDocumentCountOptions,
  ): Promise<number> {
    const data = await this._exec("estimatedDocumentCount", [options || {}]);
    return throwOrReturnAs<number>(data);
  }

  /**
   * Gets the number of documents matching the filter.
   * For a fast count of the total documents in a collection see {@link Collection#estimatedDocumentCount| estimatedDocumentCount}.
   * **Note**: When migrating from {@link Collection#count| count} to {@link Collection#countDocuments| countDocuments}
   * the following query operators must be replaced:
   *
   * | Operator | Replacement |
   * | -------- | ----------- |
   * | `$where`   | [`$expr`][1] |
   * | `$near`    | [`$geoWithin`][2] with [`$center`][3] |
   * | `$nearSphere` | [`$geoWithin`][2] with [`$centerSphere`][4] |
   *
   * [1]: https://www.mongodb.com/docs/manual/reference/operator/query/expr/
   * [2]: https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin/
   * [3]: https://www.mongodb.com/docs/manual/reference/operator/query/center/#op._S_center
   * [4]: https://www.mongodb.com/docs/manual/reference/operator/query/centerSphere/#op._S_centerSphere
   *
   * @param filter - The filter for the count
   * @param options - Optional settings for the command
   *
   * @see https://www.mongodb.com/docs/manual/reference/operator/query/expr/
   * @see https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin/
   * @see https://www.mongodb.com/docs/manual/reference/operator/query/center/#op._S_center
   * @see https://www.mongodb.com/docs/manual/reference/operator/query/centerSphere/#op._S_centerSphere
   */
  async countDocuments(
    filter?: Document,
    opts?: CountDocumentsOptions,
  ): Promise<number> {
    const data = await this._exec("countDocuments", [filter || {}, opts || {}]);
    console.log("cdd", data);
    return throwOrReturnAs<number>(data);
  }

  createIndex() {
    console.warn(
      "createIndex() not implemented yet... your code won't crash but no index will be created",
    );
  }

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

  /**
   * Inserts a single document into MongoDB. If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @param doc - The document to insert
   * @param options - Optional settings for the command
   */
  async insertOne(doc: TSchema) {
    const data = await this._exec("insertOne", [doc]);
    return throwOrReturnAs<ReturnType<MongoCollection["insertOne"]>>(data);
  }

  /**
   * Inserts an array of documents into MongoDB. If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @param docs - The documents to insert
   * @param options - Optional settings for the command
   */
  async insertMany(docs: TSchema[]) {
    const data = await this._exec("insertMany", [docs]);
    return throwOrReturnAs<ReturnType<MongoCollection["insertMany"]>>(data);
  }

  /**
   * Update a single document in a collection
   *
   * @param filter - The filter used to select the document to update
   * @param update - The update operations to be applied to the document
   * @param options - Optional settings for the command
   */
  async updateOne(filter: Filter<TSchema>, update: unknown) {
    const data = await this._exec("updateOne", [filter, update]);
    return throwOrReturnAs<ReturnType<MongoCollection["updateOne"]>>(data);
  }

  /**
   * Update multiple documents in a collection
   *
   * @param filter - The filter used to select the documents to update
   * @param update - The update operations to be applied to the documents
   * @param options - Optional settings for the command
   */
  async updateMany(filter: Filter<TSchema>, update: unknown) {
    const data = await this._exec("updateMany", [filter, update]);
    return throwOrReturnAs<ReturnType<MongoCollection["updateMany"]>>(data);
  }

  /**
   * Delete a document from a collection
   *
   * @param filter - The filter used to select the document to remove
   * @param options - Optional settings for the command
   */
  async deleteOne(filter: Filter<TSchema>) {
    const data = await this._exec("deleteOne", [filter]);
    return throwOrReturnAs<ReturnType<MongoCollection["deleteOne"]>>(data);
  }

  /**
   * Delete multiple documents from a collection
   *
   * @param filter - The filter used to select the documents to remove
   * @param options - Optional settings for the command
   */
  async deleteMany(filter: Filter<TSchema>) {
    const data = await this._exec("deleteMany", [filter]);
    return throwOrReturnAs<ReturnType<MongoCollection["deleteMany"]>>(data);
  }

  async _exec(
    op: string,
    payload: unknown,
    returnResponse: true,
  ): Promise<Response>;
  async _exec(
    op: string,
    payload: unknown,
    returnResponse?: false,
  ): Promise<Record<string, unknown>>;
  async _exec(op: string, payload: unknown, returnResponse?: boolean) {
    const nextOptions = shiftOptionsOnce();

    const relayPassword = process.env.MONGODB_RELAY_PASSWORD;
    if (relayPassword === undefined)
      throw new Error("Set process.env.MONGODB_RELAY_PASSWORD first");

    const params = new URLSearchParams();
    // params.append("db", this.db._dbName || "");
    params.append("coll", this.name);
    params.append("op", op);

    const url = this.db._client._url + "?" + params;
    const requestInit: RequestInit = {
      ...this.db._client._options.fetch,
      ...nextOptions?.fetch,
      method: "POST",
      headers: {
        ...this.db._client._options.fetch?.headers,
        ...nextOptions?.fetch?.headers,
        "Content-Type": "application/json",
        Bearer: relayPassword,
      },
      body: EJSON.stringify(payload),
    };
    if (!this._cacheable.includes(op)) requestInit.cache = "no-store";

    const response = await fetch(url, requestInit);
    if (returnResponse) return response;

    if (response.status === 200) {
      const text = await response.text();
      return EJSON.parse(text) as Record<string, unknown>;
    }

    const text = await response.text();
    console.error("HTTP " + response.status + ": " + text);
    console.error("url", url);
    console.error("requestInit", requestInit);
    throw new Error("HTTP " + response.status + ": " + text);
  }
}

export type { RelayCollection };
export default RelayCollection;
