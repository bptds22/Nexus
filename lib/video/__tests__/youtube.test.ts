/* ID YouTube : les Shorts doivent rendre leur miniature comme une vidéo
   normale (tuto « faits saillants », 2026-10-05). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getYouTubeId } from "@/lib/video/youtube";

test("formes déjà couvertes", () => {
  assert.equal(getYouTubeId("https://www.youtube.com/watch?v=11h8-jmWEj0"), "11h8-jmWEj0");
  assert.equal(getYouTubeId("https://m.youtube.com/watch?v=11h8-jmWEj0&t=30"), "11h8-jmWEj0");
  assert.equal(getYouTubeId("https://youtu.be/11h8-jmWEj0?si=t1ibQArAI6XDOpgK"), "11h8-jmWEj0");
});

test("Shorts, live et embed", () => {
  assert.equal(getYouTubeId("https://youtube.com/shorts/aBcD3fGh1jK?si=xyz"), "aBcD3fGh1jK");
  assert.equal(getYouTubeId("https://www.youtube.com/shorts/aBcD3fGh1jK/"), "aBcD3fGh1jK");
  assert.equal(getYouTubeId("https://www.youtube.com/live/aBcD3fGh1jK"), "aBcD3fGh1jK");
  assert.equal(getYouTubeId("https://www.youtube.com/embed/aBcD3fGh1jK"), "aBcD3fGh1jK");
  assert.equal(getYouTubeId("  https://youtube.com/shorts/aBcD3fGh1jK  "), "aBcD3fGh1jK");
});

test("pas de vidéo → null", () => {
  assert.equal(getYouTubeId("https://www.youtube.com/@nexussportsca"), null);
  assert.equal(getYouTubeId("https://www.youtube.com/shorts/"), null);
  assert.equal(getYouTubeId("https://www.youtube.com/playlist?list=PL1"), null);
  assert.equal(getYouTubeId("https://notyoutube.com/shorts/aBcD3fGh1jK"), null);
  assert.equal(getYouTubeId("https://hudl.com/video/3/14714152/nexus-demo"), null);
  assert.equal(getYouTubeId("pas une url"), null);
});
