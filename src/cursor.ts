import type {
  Filter,
  Document,
  Collection as MongoCollection,
  Sort,
  SortDirection,
  WithId,
  // FindCursor,
  CursorStreamOptions,
} from "mongodb";

import type { RelayCollection } from "./collection";
import type { RelayDb } from "./database";
import { EJSON } from "bson";

export interface FindOptions {
  sort?: RelayCursor["_sort"];
  limit?: RelayCursor["_limit"];
  skip?: RelayCursor["_skip"];
  project?: RelayCursor["_project"];
}

export default class RelayCursor<TSchema extends Document = Document> {
  db: RelayDb;
  coll: RelayCollection<any>;
  filter: Document;
  _limit: number | null = null;
  _sort: { sort: Sort; direction?: SortDirection } | null = null;
  _skip: number | null = null;
  _project: Document | null = null;

  constructor(coll: RelayCollection<any>, filter: Document) {
    this.db = coll.db;
    this.coll = coll;
    this.filter = filter;
  }

  sort(sort: Sort | string, direction?: SortDirection): this {
    this._sort = { sort, direction };
    return this;
  }

  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  skip(skip: number): this {
    this._skip = skip;
    return this;
  }

  project<T extends Document>(value: Document) {
    this._project = value;
    return this as unknown as RelayCursor<T>;
  }

  async toArray() {
    const payload = {
      filter: this.filter,
      opts: {} as Record<string, unknown>,
    };
    if (this._sort) payload.opts.sort = this._sort;
    if (this._limit) payload.opts.limit = this._limit;
    if (this._skip) payload.opts.skip = this._skip;
    if (this._project) payload.opts.project = this._project;

    const data = await this.coll._exec("findToArray", payload);

    if (data.$result) return data.$result as WithId<Document>[];
    else throw new Error("TODO");
  }

  // stream(options?: CursorStreamOptions): Readable & AsyncIterable<TSchema>;
  stream(cursorStreamOptions?: CursorStreamOptions): AsyncIterable<TSchema> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const payload = {
      filter: this.filter,
      findOptions: {} as Record<string, unknown>,
      cursorStreamOptions,
    };
    if (this._sort) payload.findOptions.sort = this._sort;
    if (this._limit) payload.findOptions.limit = this._limit;
    if (this._skip) payload.findOptions.skip = this._skip;
    if (this._project) payload.findOptions.project = this._project;

    // if (data.$result) return data.$result as WithId<Document>[];

    return {
      async *[Symbol.asyncIterator]() {
        const response = await self.coll._exec("findStream", payload, true);
        if (response.status !== 200)
          throw new Error(
            "HTTP " + response.status + ": " + (await response.text()),
          );
        if (!response.body)
          throw new Error("HTTP " + response.status + ": no body");

        const reader = response.body.getReader();
        let readResult = await reader.read();
        while (!readResult.done) {
          const doc = EJSON.deserialize(readResult.value);
          yield doc as unknown as TSchema;
          readResult = await reader.read();
        }
      },
    };
  }
}
