import type {
  Filter,
  WithId,
  Collection as MongoCollection,
  Sort,
  SortDirection,
  Document as MongoDocument,
} from "mongodb";

import type { RelayCollection } from "./collection";
import type { RelayDb } from "./database";

export interface FindOptions {
  sort?: RelayCursor["_sort"];
  limit?: RelayCursor["_limit"];
  skip?: RelayCursor["_skip"];
  project?: RelayCursor["_project"];
}

export default class RelayCursor<
  DocType extends MongoDocument = MongoDocument,
> {
  db: RelayDb;
  coll: RelayCollection<DocType>;
  filter: Filter<DocType>;
  _limit: number | null = null;
  _sort: { sort: Sort; direction?: SortDirection } | null = null;
  _skip: number | null = null;
  _project: MongoDocument | null = null;

  constructor(coll: RelayCollection<DocType>, filter: Filter<DocType>) {
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

  project<T extends MongoDocument>(value: MongoDocument) {
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

    const data = await this.coll._exec("find", payload);

    if (data.$result) return data.$result as WithId<MongoDocument>[];
    else throw new Error("TODO");
  }
}
