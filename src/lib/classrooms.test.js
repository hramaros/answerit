import { test } from "node:test";
import assert from "node:assert/strict";
import { setRedisClient } from "./redis.js";
import {
  createClass,
  listClasses,
  getClass,
  renameClass,
  deleteClass,
  addStudent,
  removeStudent,
} from "./classrooms.js";

function createFakeRedis() {
  const store = new Map();
  const lists = new Map();
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  return {
    async set(key, value) {
      store.set(key, clone(value));
      return "OK";
    },
    async get(key) {
      return store.has(key) ? clone(store.get(key)) : null;
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
    async lpush(key, ...vals) {
      const arr = lists.get(key) || [];
      for (const v of vals.flat()) arr.unshift(v);
      lists.set(key, arr);
      return arr.length;
    },
    async lrange(key, start, stop) {
      const arr = lists.get(key) || [];
      const e = stop < 0 ? arr.length + stop + 1 : stop + 1;
      return arr.slice(start, e).map(clone);
    },
    async lrem(key, _count, value) {
      const arr = lists.get(key) || [];
      const filtered = arr.filter((v) => v !== value);
      lists.set(key, filtered);
      return arr.length - filtered.length;
    },
    async mget(...keys) {
      return keys.flat().map((k) => (store.has(k) ? clone(store.get(k)) : null));
    },
  };
}

test("createClass → listClasses → getClass (appartenance)", async () => {
  setRedisClient(createFakeRedis());
  const r = await createClass("acc1", "6ème A");
  assert.equal(r.ok, true);
  assert.equal(r.classroom.name, "6ème A");

  const list = await listClasses("acc1");
  assert.equal(list.length, 1);
  assert.equal(list[0].studentCount, 0);

  assert.equal((await getClass("acc1", r.classroom.id)).name, "6ème A");
  assert.equal(await getClass("autre", r.classroom.id), null); // autre compte
});

test("addStudent / removeStudent", async () => {
  setRedisClient(createFakeRedis());
  const { classroom } = await createClass("acc1", "6ème A");
  const a = await addStudent("acc1", classroom.id, "Alice");
  await addStudent("acc1", classroom.id, "Bob");
  assert.equal((await getClass("acc1", classroom.id)).students.length, 2);
  assert.equal((await listClasses("acc1"))[0].studentCount, 2);

  await removeStudent("acc1", classroom.id, a.student.id);
  const after = await getClass("acc1", classroom.id);
  assert.equal(after.students.length, 1);
  assert.equal(after.students[0].name, "Bob");
});

test("renameClass et deleteClass", async () => {
  setRedisClient(createFakeRedis());
  const { classroom } = await createClass("acc1", "Provisoire");
  await renameClass("acc1", classroom.id, "5ème B");
  assert.equal((await getClass("acc1", classroom.id)).name, "5ème B");

  await deleteClass("acc1", classroom.id);
  assert.equal(await getClass("acc1", classroom.id), null);
  assert.equal((await listClasses("acc1")).length, 0);
});

test("opérations refusées sur une classe d'un autre compte", async () => {
  setRedisClient(createFakeRedis());
  const { classroom } = await createClass("acc1", "6ème A");
  assert.equal((await addStudent("acc2", classroom.id, "X")).ok, false);
  assert.equal((await deleteClass("acc2", classroom.id)).ok, false);
});
