import * as oson from "o-son";
import { ObjectId } from "mongodb";

const ObjectIdSerializer: oson.ValueConstructor<ObjectId, string> = {
  instance: ObjectId,
  from: (oid) => [oid.toHexString()],
  create: ([hexString]) => new ObjectId(hexString),
};

oson.GLOBAL_CONSTRUCTOR_MAP.set(ObjectId.name, ObjectIdSerializer);
