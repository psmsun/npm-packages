import assert from "node:assert/strict";
import { test } from "node:test";
import { extractVKIDs, extractYoutubeID } from "../src/index.js";

// Every YouTube value currently stored in the ITE Strapi testimonial
// collections, plus the shapes the extractor already supported.
test("extractYoutubeID accepts a bare ID", () => {
  assert.equal(extractYoutubeID("v64mnVRKmcY"), "v64mnVRKmcY");
  assert.equal(extractYoutubeID("XQlKOcTAcNA"), "XQlKOcTAcNA");
  assert.equal(extractYoutubeID("ScMzIvxBSi4"), "ScMzIvxBSi4");
});

test("extractYoutubeID strips share params pasted after a bare ID", () => {
  // fastnex testimonial 7 — returned null before 1.0.3, so the card rendered
  // neither its video nor its text.
  assert.equal(extractYoutubeID("VN_F1FAKdMg&t=4s"), "VN_F1FAKdMg");
  assert.equal(extractYoutubeID("VN_F1FAKdMg?t=4s"), "VN_F1FAKdMg");
  assert.equal(extractYoutubeID("VN_F1FAKdMg#t=4s"), "VN_F1FAKdMg");
});

test("extractYoutubeID still handles URL forms", () => {
  assert.equal(
    extractYoutubeID("https://www.youtube.com/watch?v=v64mnVRKmcY"),
    "v64mnVRKmcY",
  );
  assert.equal(extractYoutubeID("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(
    extractYoutubeID("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(
    extractYoutubeID("https://youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(
    extractYoutubeID("https://www.youtube.com/live/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
  assert.equal(
    extractYoutubeID("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4s"),
    "dQw4w9WgXcQ",
  );
});

test("extractYoutubeID rejects what it cannot resolve", () => {
  assert.equal(extractYoutubeID(null), null);
  assert.equal(extractYoutubeID(undefined), null);
  assert.equal(extractYoutubeID(""), null);
  assert.equal(extractYoutubeID("not an id"), null);
  assert.equal(extractYoutubeID("https://example.com/watch"), null);
  // The anchored bare-ID match must not fire part-way into a URL.
  assert.equal(extractYoutubeID("https://vk.com/foo"), null);
});

test("extractVKIDs accepts the raw oid_id fleet values", () => {
  assert.deepEqual(extractVKIDs("227470780_456240128"), {
    oid: "-227470780",
    id: "456240128",
  });
  assert.deepEqual(extractVKIDs("-178652725_456239064"), {
    oid: "-178652725",
    id: "456239064",
  });
});

test("extractVKIDs strips share params pasted after a raw oid_id", () => {
  assert.deepEqual(extractVKIDs("227470780_456240128&t=4s"), {
    oid: "-227470780",
    id: "456240128",
  });
});

test("extractVKIDs still handles URL forms", () => {
  assert.deepEqual(
    extractVKIDs(
      "https://vk.com/video_ext.php?oid=-227470780&id=456240128&hash=d79895b5c0835fc7",
    ),
    { oid: "-227470780", id: "456240128" },
  );
  assert.deepEqual(extractVKIDs("https://vk.com/video-144893972_456246327"), {
    oid: "-144893972",
    id: "456246327",
  });
  assert.deepEqual(extractVKIDs("https://vk.com/clip-12345678_456239123"), {
    oid: "-12345678",
    id: "456239123",
  });
});

test("extractVKIDs rejects what it cannot resolve", () => {
  assert.equal(extractVKIDs(null), null);
  assert.equal(extractVKIDs(""), null);
  assert.equal(extractVKIDs("nonsense"), null);
});
