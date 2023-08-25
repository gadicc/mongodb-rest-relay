import fetchMock, { enableFetchMocks } from "jest-fetch-mock";
enableFetchMocks();

import { MongoClient } from "mongodb";
import type { Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

import makeRelay from "../src/express";
import RelayMongoClient from "../src/client";
import type { RelayDb } from "../src/database";

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

      return new Promise((resolve, reject) => {
        const res = {
          json: (data: Parameters<JSON["stringify"]>[0]) => {
            resolve(new Response(JSON.stringify(data)));
          },
        };
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

    result = await collection.find({}).toArray();
    expect(result.length).toBe(1);
    expect(result[0].a).toBe(1);
  });

  afterAll(async () => {
    await remoteClient.close();
    await mongod.stop();
    fetchMock.dontMock();
  });
});
