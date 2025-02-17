declare global {
  // eslint-disable-next-line no-var
  var RealResponse: typeof Response;
}
global.RealResponse = Response;

import fetchMock, { enableFetchMocks } from "jest-fetch-mock";
enableFetchMocks();

import { MongoClient, ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

import makeRelay from "./express";
import { processDbRequest } from "./server/common";
import RelayMongoClient from "./client";
import type { RelayDb } from "./database";

process.env.MONGODB_RELAY_PASSWORD = "test";

class FakeRes {
  body = "";
  headers = new Headers();
  statusCode = 200;
  defaultEncoding = "utf-8";
  _resolve: (...args: any) => void;
  _reject: (error: any) => void;

  constructor(resolve: (...args: any) => void, reject: (error: any) => void) {
    this._resolve = resolve;
    this._reject = reject;
  }

  writeHead(statusCode: number, headers: Headers) {
    this.statusCode = statusCode;
    this.headers = new Headers(headers);
  }

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }

  end(bodyOrResponse?: string | Response) {
    if (bodyOrResponse instanceof Response)
      return this._resolve(bodyOrResponse);

    if (bodyOrResponse) this.body = bodyOrResponse;
    this._resolve(
      new Response(this.body, {
        status: this.statusCode,
        headers: this.headers,
      }),
    );
  }

  json(data: Parameters<JSON["stringify"]>[0]) {
    this.headers.set("Content-Type", "application/json");
    this.end(JSON.stringify(data));
  }
}

describe("relay integration test", () => {
  let localDb: RelayDb;
  let localClient: RelayMongoClient;
  let remoteDb: Db;
  let remoteClient: MongoClient;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    localClient = new RelayMongoClient("http://moo.com/");
    remoteClient = new MongoClient(uri);
    await remoteClient.connect();
    await localClient.connect();
    remoteDb = remoteClient.db("gongoDB");
    localDb = localClient.db("gongoDB");

    const express = makeRelay(remoteDb);

    fetchMock.mockImplementation((req, init) => {
      if (!req)
        throw new Error("fetchMock needs to be called with a request object");
      if (typeof req === "string") req = new Request(req, init);

      if (req.url.match(/findStream/)) {
        return processDbRequest(remoteDb, req).then((response) => {
          if (
            !(
              response instanceof global.RealResponse ||
              response instanceof Response
            )
          )
            throw new Error(
              "Expected a Response but got: " + JSON.stringify(response),
            );
          return response;
        });
      }

      return new Promise((resolve, reject) => {
        const res = new FakeRes(resolve, reject);
        try {
          express(req as Request, res);
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  it("basic crud", async () => {
    let result;
    const collection = localDb.collection("testColl");

    result = await collection.find({}).toArray();
    expect(result).toEqual([]);

    // { acknowledged: true, insertedId: '64e77ac444f03d4af4d8ff4e' }
    result = await collection.insertOne({ a: 1 });
    expect(result.acknowledged).toBe(true);
    const _id = result.insertedId;

    result = await collection
      .find({})
      .sort("a", "asc")
      .limit(1)
      .skip(0)
      .project({ a: 1 })
      .toArray();
    expect(result.length).toBe(1);
    expect(result[0].a).toBe(1);

    result = await collection.replaceOne({ _id }, { a: 2 });
    expect(result.acknowledged).toBe(true);
    expect(result.matchedCount).toBe(1);
    expect(result.modifiedCount).toBe(1);
    expect(result.upsertedCount).toBe(0);
    expect(result.upsertedId).toBe(null);
    result = await collection.findOne({ _id });
    expect(result).not.toBeNull();
    expect(result!.a).toBe(2);

    result = await collection.bulkWrite([
      { insertOne: { document: { a: 3 } } },
    ]);
    expect(result.insertedCount).toBe(1);
    expect(result.insertedIds[0]).toBeInstanceOf(ObjectId);
  });

  it("countDocuments, estimatedDocumentCount", async () => {
    let result;
    const collection = localDb.collection("countDocuments");

    expect(await collection.countDocuments()).toEqual(0);
    expect(await collection.estimatedDocumentCount()).toEqual(0);
    await collection.insertOne({ a: 1 });
    expect(await collection.countDocuments()).toEqual(1);
    expect(await collection.estimatedDocumentCount()).toEqual(1);
  });

  it("other tests", async () => {
    let result;
    const collection = localDb.collection("test_many");

    // { acknowledged: true, insertedCount: 2, insertedIds: { 0: 'id1', 1: 'id2' } }
    result = await collection.insertMany([{ a: 1 }, { a: 2 }]);
    expect(result.acknowledged).toBe(true);
    expect(result.insertedCount).toBe(2);
    expect(typeof result.insertedIds).toBe("object");
    expect(Object.keys(result.insertedIds).length).toBe(2);
    expect(result.insertedIds[0]).toBeInstanceOf(ObjectId);
    expect(result.insertedIds[1]).toBeInstanceOf(ObjectId);
    expect(result.insertedIds[0].toHexString()).toMatch(/[A-Fa-f0-9]+/);
    expect(result.insertedIds[1].toHexString()).toMatch(/[A-Fa-f0-9]+/);

    // { acknowledged: true, modifiedCount: 2, upsertedId: null, upsertedCount: 0, matchedCount: 2 }
    result = await collection.updateMany({}, { $set: { b: 3 } });
    expect(result.acknowledged).toBe(true);
    expect(result.modifiedCount).toBe(2);
    expect(result.upsertedId).toBe(null);
    expect(result.upsertedCount).toBe(0);
    expect(result.matchedCount).toBe(2);

    // { acknowledged: true, modifiedCount: 1, upsertedId: null, upsertedCount: 0, matchedCount: 1 }
    result = await collection.updateOne({ a: 1 }, { $set: { a: 4 } });
    expect(result.acknowledged).toBe(true);
    expect(result.modifiedCount).toBe(1);
    expect(result.upsertedId).toBe(null);
    expect(result.upsertedCount).toBe(0);
    expect(result.matchedCount).toBe(1);

    result = await collection.deleteOne({ noMatch: true });
    expect(result.acknowledged).toBe(true);
    expect(result.deletedCount).toBe(0);

    // { acknowledged: true, deletedCount: 2 }
    result = await collection.deleteMany({});
    expect(result.acknowledged).toBe(true);
    expect(result.deletedCount).toBe(2);
  });

  it("atomic operations", async () => {
    let result;
    const collection = localDb.collection("test_atomic");

    result = await collection.insertOne({ a: 1 });
    expect(result.acknowledged).toBe(true);

    result = await collection.findOneAndUpdate({ a: 1 }, { $set: { a: 2 } });
    expect(result!.a).toBe(1);

    result = await collection.findOne({ a: 2 });
    expect(result!.a).toBe(2);
  });

  it("works with dates and object ids", async () => {
    const collection = localDb.collection("test_arson");

    const _id = new ObjectId("5f9c0b2b6c3b2e1d1c9d9b9b");
    const date = new Date("2012-12-12");

    await collection.insertOne({ _id, date });

    // find by ObjectId
    const result = await collection.findOne({ _id });
    if (!result) throw new Error("result is null");

    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.getTime()).toBe(date.getTime());
    expect(result._id).toBeInstanceOf(ObjectId);
    expect(result._id.toHexString()).toBe(_id.toHexString());
  });

  describe("streaming", () => {
    it("works", async () => {
      const collection = localDb.collection("test_streaming");
      await collection.insertMany([{ a: 1 }, { a: 2 }, { a: 3 }]);

      const cursor = collection.find({});
      const stream = collection.find({}).stream();
      for await (const doc of stream) {
        expect(doc._id).toBeInstanceOf(ObjectId);
        expect(typeof doc.a).toBe("number");
      }
    });
  });

  afterAll(async () => {
    await remoteClient.close();
    await mongod.stop();
    fetchMock.dontMock();
  });
});
