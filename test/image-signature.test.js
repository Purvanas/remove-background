"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { isSupportedImage } = require("../server");

test("accepte les signatures des formats annoncés", () => {
  const samples = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    Buffer.from([0xff, 0xd8, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]),
    Buffer.from("GIF89a......", "ascii"),
    Buffer.from("RIFF....WEBP", "ascii"),
    Buffer.from("BM..........", "ascii"),
    Buffer.from([0x49, 0x49, 0x2a, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]),
  ];
  for (const sample of samples) assert.equal(isSupportedImage(sample), true);
});

test("refuse une extension simulée sans signature image", () => {
  assert.equal(isSupportedImage(Buffer.from("<script>not an image</script>")), false);
  assert.equal(isSupportedImage(Buffer.alloc(3)), false);
});
