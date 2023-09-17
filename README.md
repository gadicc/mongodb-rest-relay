# mongodb-rest-relay

Relay mongodb queries over HTTP REST. Great for Edge.

Copyright (c) 2023 by Gadi Cohen. [MIT Licensed](./LICENSE.txt).

![npm](https://img.shields.io/npm/v/mongodb-rest-relay) ![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/gadicc/mongodb-rest-relay/release.yml) ![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/gadicc/92f2b56335875f380d828a6f0b870fbb/raw/mongodb-rest-relay-coverage-main.json) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) [![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Intro

`mongodb-rest-relay` is meant to be a drop-in replacement for `mongodb`, that sends
the actual request to the real `mongodb` elsewhere over HTTP. It may be a better fit
for edge and serverless, depending on your use case. You get the advantages of
MongoDB's own REST service but with the same fixed and predictable pricing (but no
elastic scaling).

## Quick Start

1. Modify an existing **edge** or serverless function (or create one as usual):

```diff
- import { MongoClient } from "mongodb";
+ import { MongoClient } from "mongodb-rest-relay"

- const MONGO_URL = process.env.MONGO_URL;
+ const MONGO_URL = "http://localhost:3000/api/mongoRelay.ts"
+
+ // Optional: only if Mongo's ObjectId doesn't work in your edge environment.
- import { ObjectId } from "mongodb" // "bson"
+ import { ObjectId } from "mongodb-rest-relay"
+
+ export const runtime = 'edge' // if relevant (e.g. on Vercel)

// Then use as usual.
const client = new MongoClient(MONGO_URL);
```

That's it! Since the API is the same, there's nothing else to do.
Note: only basic functionality / simple CRUD operations are
supported (see notes at the end of the README).

**See also the section on [Caching](#caching) below**.

2. You can run the other side of the relay as **serverless**
   or servered (near your database), e.g. `pages/api/mongoRelay.ts`:

```js
import { MongoClient } from "mongodb";
// There is also server/{nextServerless{App,Pages},vercelServerlessOther}
import makeExpressRelay from "mongodb-rest-relay/lib/server/express";

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1";
const client = new MongoClient(MONGO_URL);

export default makeExpressRelay((await client.connect()).db(/* dbName? */));
// or next app router: export const POST = makeRelay.... with correct import.
```

3. Set the `MONGODB_RELAY_PASSWORD` environment variable to the same value
   on both sides.

## Notes

- Supported functionality:

  - `insertOne()`, `insertMany()`
  - `find()` - with `sort()`, `limit()`, `skip()`, `project()`.
    - `toArray()`, `stream()` (yes! streaming!)
  - `updateOne()`, `updateMany()`
  - `deleteOne()`, `deleteMany()`
  - `countDocuments()`, `estimatedDocumentCount()`
  - Open an issue or submit a PR for more :)

## Init Options

```ts
new MongoClient(url, {
  fetch: {}, // Additional options to past to ALL fetch requests (RequestInit)
});
```

## Caching

`mongodb-rest-relay` can take advantage of the
[NextJS Cache](https://nextjs.org/docs/app/building-your-application/caching)
and
[Vercel's Data Cache](https://vercel.com/docs/infrastructure/data-cache)
for significantly faster repeat results and lower load on your database.
You should read these docs for a full picture but the basics are (for NextJS):

1. You need to call `mongodb-rest-relay` from within the `app` router,
   the functionality does not exist in `pages`. So instead of e.g.
   `pages/api/something.ts`, you want `app/api/something/route.ts`, with
   the necessary changes.

2. You can set your GLOBAL cache policy for ALL (internal) `fetch()`
   requests, using:

   ```ts
   new MongoClient(url, {
     fetch: {
       next: {
         revalidate: 1, // revalidate after this amount of time (in seconds)
         tags: ["myTag"], // can use revalidateTag("myTag") later.
       },
       // or
       cache: "force-cache", // this lasts a long time, probably you don't want it :)
     },
   });
   ```

   Note: after `revalidate` seconds, the stale cache is still returned, and
   fresh data will be fetched in the background. For more info, see
   [NextJS time-based revalidation](https://nextjs.org/docs/app/building-your-application/caching#time-based-revalidation).

3. You can also set these options PER REQUEST. This involves a separate API
   call, so that you can still switch back between the original `mongodb`
   driver without polluting the real mongo options or failing type validation.

   ```diff
   - import { MongoClient } from "mongodb";
   + import { MongoClient, setOptionsOnce } from "mongodb-rest-relay";

   // ... setup the client, etc.

   + setOptionsOnce({ fetch: { next: { revalidate: 1 } } });
   const result = await db.collection("test").find().toArray();
   ```

   You can call `setOptionsOnce()` multiple times and the options will be
   used in that order (think of Jest's `mockImplementationOnce()`).

The result is that even in `next dev` you'll get output like this:

```bash
-  ┌ POST /api/something 200 in 148ms
   │
   ├──── POST http://localhost:3000/api/mongoRelay?coll=accounts&o.. 200 in 6ms (cache: HIT)
   │
   ├──── POST http://localhost:3000/api/mongoRelay?coll=stars&op=f.. 200 in 3ms (cache: HIT)
   │
   ├──── POST http://localhost:3000/api/mongoRelay?coll=sessions&o.. 200 in 2ms (cache: HIT)
   │
   ├── 1 level ── POST http://localhost:3000/api/mongoRelay?coll=users&op=f.. 200 in 1ms (cache: HIT)
   │
   └── 1 level ── POST http://localhost:3000/api/mongoRelay?coll=likes&op=f.. 200 in 1ms (cache: HIT)
```

Note:

1. Mutations (insert, update, delete, etc) will _always_ set `{ cache: "no-store" }`.
   So caching is only applied to: `find()`, `findOne()`, `estimatedDocumentCount()`, `countDocuments()`.

## TODO

- [x] ObjectID / Date support `:) - in next release!
- [x] streaming!
- [ ] aggregation - ask for it.
- [ ] Instead of sending MONGODB_RELAY_PASSWORD, just use it to sign requests.
- [x] Caching
  - [x] Global options
  - [x] Per-request options
