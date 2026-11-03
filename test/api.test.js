"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const IMAGE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

async function waitForFile(file, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("fake rembg did not start");
}

async function waitForCleanup(dir, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const leftovers = fs.readdirSync(dir).filter((name) => name.startsWith("rembg-"));
    if (!leftovers.length) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("temporary rembg files were not cleaned up");
}

test("remove-bg API handles success, failure, timeout and concurrency", async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "removebg-test-"));
  const fakeBin = path.join(runtime, "fake-rembg");
  const marker = path.join(runtime, "started");
  fs.writeFileSync(fakeBin, [
    "#!/bin/sh",
    "if [ \"$FAKE_REMBG_MODE\" = \"fail\" ]; then exit 7; fi",
    "if [ \"$FAKE_REMBG_MODE\" = \"sleep\" ]; then : > \"$FAKE_REMBG_MARKER\"; exec sleep 5; fi",
    "cp \"$2\" \"$3\"",
    "",
  ].join("\n"));
  fs.chmodSync(fakeBin, 0o755);

  process.env.REMBG_BIN = fakeBin;
  process.env.REMBG_TMP_DIR = runtime;
  process.env.REMBG_RUNTIME_DIR = runtime;
  process.env.PROCESS_TIMEOUT_MS = "500";
  process.env.MAX_JOBS = "1";
  process.env.FAKE_REMBG_MARKER = marker;

  const { createApp } = require("../server");
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(runtime, { recursive: true, force: true });
  });

  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}/api/remove-bg`;
  const request = () => fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "image/png" },
    body: IMAGE,
  });

  process.env.FAKE_REMBG_MODE = "success";
  const success = await request();
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await success.arrayBuffer()), IMAGE);

  process.env.FAKE_REMBG_MODE = "fail";
  const failure = await request();
  assert.equal(failure.status, 500);

  process.env.FAKE_REMBG_MODE = "sleep";
  const slowRequest = request();
  await waitForFile(marker);
  const busy = await request();
  assert.equal(busy.status, 503);
  const timedOut = await slowRequest;
  assert.equal(timedOut.status, 504);
  await waitForCleanup(runtime);
});
