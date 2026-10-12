import { describe, expect, it } from "vitest";
import {
  instagramSrc,
  linkedInSrc,
  pilotMeasure,
} from "./__fixtures__/SocialMediaPosts-pilot.js";
import { youtubeThumbnail } from "./__fixtures__/youtube-stopgap.js";
import {
  INSTAGRAM_CROP,
  INSTAGRAM_PLACEHOLDER_HEIGHT,
  instagramCardHeight,
  instagramEmbedSrc,
  isMissingYoutubeThumbnail,
  linkedInEmbedSrc,
  readInstagramMeasure,
  socialEmbedSrc,
  youtubeEmbedSrc,
  youtubePlayerSrc,
  youtubeThumbnailSrc,
} from "./index.js";

const embed = (urn: string) =>
  `https://www.linkedin.com/embed/feed/update/urn:li:${urn}?compact=1`;

const iframe = (urn: string, query: string, height: number) =>
  `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:${urn}?${query}" height="${height}" width="504" frameborder="0" allowfullscreen="" title="Embedded post"></iframe>`;

// The pharmtech CMS values (data/socialMediaPosts.ts at HEAD) plus the requester's extras.
const LINKEDIN: [string, string, string | null][] = [
  ["CMS snippet 1", iframe("ugcPost:7503697686274031617", "collapsed=1", 567), embed("ugcPost:7503697686274031617")],
  ["CMS snippet 2", iframe("share:7501237627262795776", "collapsed=1", 670), embed("share:7501237627262795776")],
  ["CMS snippet 3", iframe("share:7498268744561868800", "collapsed=1", 670), embed("share:7498268744561868800")],
  ["CMS snippet 4", iframe("share:7493571825906532352", "collapsed=1", 670), embed("share:7493571825906532352")],
  ["CMS snippet 5", iframe("ugcPost:7488477350171684864", "collapsed=1", 610), embed("ugcPost:7488477350171684864")],
  ["snippet already compact", iframe("ugcPost:7512772318247563264", "compact=1", 399), embed("ugcPost:7512772318247563264")],
  ["bare urn", "urn:li:share:7498268744561868800", embed("share:7498268744561868800")],
  [
    "bare embed URL",
    "https://www.linkedin.com/embed/feed/update/urn:li:share:7501237627262795776?collapsed=1",
    embed("share:7501237627262795776"),
  ],
  [
    "feed URL",
    "https://www.linkedin.com/feed/update/urn:li:activity:7503697686274031617/",
    embed("activity:7503697686274031617"),
  ],
  [
    "whitespace around a snippet",
    `\n  ${iframe("ugcPost:7503697686274031617", "collapsed=1", 567)}  \n`,
    embed("ugcPost:7503697686274031617"),
  ],
  [
    "urn-like text outside the src",
    `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:7501237627262795776?collapsed=1" title="activity-7503697686274031617"></iframe>`,
    embed("share:7501237627262795776"),
  ],
  ["junk text", "see our LinkedIn page", null],
  ["empty string", "", null],
];

const ig = (path: string) => `https://www.instagram.com/${path}/embed/`;

const BLOCKQUOTE = `<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="https://www.instagram.com/p/Db-NgmEDrAG/?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14"><a href="https://www.instagram.com/p/Db-NgmEDrAG/?utm_source=ig_embed&amp;utm_campaign=loading" target="_blank">View this post on Instagram</a></blockquote> <script async src="//www.instagram.com/embed.js"></script>`;

const INSTAGRAM: [string, string, string | null][] = [
  ["CMS post 1", "https://www.instagram.com/p/DdV1vMBOYOy/", ig("p/DdV1vMBOYOy")],
  ["CMS reel", "https://www.instagram.com/reel/DblEnWKqOPa/", ig("reel/DblEnWKqOPa")],
  ["share-sheet reels", "https://www.instagram.com/reels/DblEnWKqOPa/", ig("reel/DblEnWKqOPa")],
  ["CMS post 3", "https://www.instagram.com/p/Db-NgmEDrAG/", ig("p/Db-NgmEDrAG")],
  ["profile-prefixed post", "https://www.instagram.com/pharmtech_expo/p/DdV1vMBOYOy/", ig("p/DdV1vMBOYOy")],
  ["tv", "https://www.instagram.com/tv/CdWq3xYhP_1/", ig("tv/CdWq3xYhP_1")],
  ["embed-code blockquote", BLOCKQUOTE, ig("p/Db-NgmEDrAG")],
  ["embed URL", "https://www.instagram.com/p/X/embed/", ig("p/X")],
  [
    "permalink wins over a post src=",
    `<blockquote data-instgrm-permalink="https://www.instagram.com/p/AAAAA/"><img src="https://www.instagram.com/p/BBBBB/media/?size=l"></blockquote>`,
    ig("p/AAAAA"),
  ],
  [
    "a post src= wins over an earlier link",
    `<a href="https://www.instagram.com/p/AAAAA/">caption</a><img src="https://www.instagram.com/p/BBBBB/media/?size=l">`,
    ig("p/BBBBB"),
  ],
  ["junk text", "follow us on Instagram", null],
  ["empty string", "", null],
];

const yt = (id: string) => `https://www.youtube.com/embed/${id}`;

const YOUTUBE: [string, string, string | null][] = [
  ["CMS video 1", "https://www.youtube.com/watch?v=mFX_vPKZ7hE", yt("mFX_vPKZ7hE")],
  ["CMS video 2", "https://www.youtube.com/watch?v=aiO3E5Ea0mo", yt("aiO3E5Ea0mo")],
  ["CMS short", "https://www.youtube.com/shorts/I3ye9D7gSRo", yt("I3ye9D7gSRo")],
  ["CMS video 3", "https://www.youtube.com/watch?v=2iAyiVMdhSQ", yt("2iAyiVMdhSQ")],
  ["CMS video 4", "https://www.youtube.com/watch?v=xtzeAywVyNw", yt("xtzeAywVyNw")],
  ["watch with extra params", "https://www.youtube.com/watch?t=42s&v=mFX_vPKZ7hE&list=PLx&si=abc", yt("mFX_vPKZ7hE")],
  ["youtube.com without www", "https://youtube.com/watch?v=mFX_vPKZ7hE", yt("mFX_vPKZ7hE")],
  ["m.youtube.com", "https://m.youtube.com/watch?v=mFX_vPKZ7hE", yt("mFX_vPKZ7hE")],
  ["youtu.be", "https://youtu.be/mFX_vPKZ7hE?si=abc&t=4", yt("mFX_vPKZ7hE")],
  ["short with share params", "https://youtube.com/shorts/I3ye9D7gSRo?feature=share", yt("I3ye9D7gSRo")],
  ["embed URL", "https://www.youtube.com/embed/mFX_vPKZ7hE?si=abc", yt("mFX_vPKZ7hE")],
  ["live URL", "https://www.youtube.com/live/mFX_vPKZ7hE", yt("mFX_vPKZ7hE")],
  ["nocookie embed URL", "https://www.youtube-nocookie.com/embed/mFX_vPKZ7hE", yt("mFX_vPKZ7hE")],
  [
    "embed snippet",
    `<iframe width="560" height="315" src="https://www.youtube.com/embed/mFX_vPKZ7hE?si=abc&amp;start=10" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`,
    yt("mFX_vPKZ7hE"),
  ],
  [
    "protocol-relative embed snippet",
    `<iframe width="560" height="315" src="//www.youtube.com/embed/mFX_vPKZ7hE" frameborder="0" allowfullscreen></iframe>`,
    yt("mFX_vPKZ7hE"),
  ],
  ["whitespace around a URL", "\n  //www.youtube.com/embed/mFX_vPKZ7hE  ", yt("mFX_vPKZ7hE")],
  ["watch on another host", "https://evil.example/watch?v=mFX_vPKZ7hE", null],
  ["embed on another host", "https://vimeo.com/embed/12345678901", null],
  ["snippet on another host", `<iframe src="https://evil.example/embed/mFX_vPKZ7hE"></iframe>`, null],
  ["short v param", "https://www.youtube.com/watch?v=abc", null],
  ["encoded path in v", "https://www.youtube.com/watch?v=abcde%2F..%2Fxx", null],
  ["long youtu.be segment", "https://youtu.be/not-an-id-at-all", null],
  ["id with trailing characters", "https://www.youtube.com/shorts/I3ye9D7gSRoextra", null],
  ["embed segment not at the path start", "https://www.youtube.com/user/embed/mFX_vPKZ7hE", null],
  ["playlist embed", "https://www.youtube.com/embed/videoseries?list=PL1234567890", null],
  ["playlist page", "https://www.youtube.com/playlist?list=PL1234567890", null],
  ["channel", "https://www.youtube.com/@pharmtech", null],
  ["bare 11-character text", "hello_world", null],
  ["schemeless URL", "youtube.com/watch?v=mFX_vPKZ7hE", null],
  ["junk text", "watch us on YouTube", null],
  ["empty string", "", null],
];

describe("youtubeEmbedSrc", () => {
  it.each(YOUTUBE)("%s", (_, pasted, expected) => {
    expect(youtubeEmbedSrc(pasted)).toBe(expected);
  });

  it("returns null for null and undefined", () => {
    expect(youtubeEmbedSrc(null)).toBeNull();
    expect(youtubeEmbedSrc(undefined)).toBeNull();
  });
});

// The five CMS videos, as [url, id].
const CMS_VIDEOS: [string, string][] = [
  ["https://www.youtube.com/watch?v=mFX_vPKZ7hE", "mFX_vPKZ7hE"],
  ["https://www.youtube.com/watch?v=aiO3E5Ea0mo", "aiO3E5Ea0mo"],
  ["https://www.youtube.com/shorts/I3ye9D7gSRo", "I3ye9D7gSRo"],
  ["https://www.youtube.com/watch?v=2iAyiVMdhSQ", "2iAyiVMdhSQ"],
  ["https://www.youtube.com/watch?v=xtzeAywVyNw", "xtzeAywVyNw"],
];

const SIZES = ["maxresdefault", "hqdefault"] as const;

const YOUTUBE_REJECTED = YOUTUBE.filter(([, , expected]) => expected === null);

describe("youtubeThumbnailSrc", () => {
  it.each(CMS_VIDEOS)("matches the pharmtech stopgap for %s", (url, id) => {
    for (const size of SIZES) {
      expect(youtubeThumbnailSrc(url, size)).toBe(youtubeThumbnail(youtubeEmbedSrc(url)!, size));
      expect(youtubeThumbnailSrc(url, size)).toBe(`https://i.ytimg.com/vi/${id}/${size}.jpg`);
    }
  });

  it("defaults to maxresdefault", () => {
    expect(youtubeThumbnailSrc("https://youtu.be/mFX_vPKZ7hE")).toBe(
      "https://i.ytimg.com/vi/mFX_vPKZ7hE/maxresdefault.jpg",
    );
  });

  it.each(["sddefault", "../../evil", "", "hqdefault.jpg?x="])(
    "falls back to maxresdefault for the unknown size %j",
    (size) => {
      expect(youtubeThumbnailSrc("https://youtu.be/mFX_vPKZ7hE", size as never)).toBe(
        "https://i.ytimg.com/vi/mFX_vPKZ7hE/maxresdefault.jpg",
      );
    },
  );

  it.each(YOUTUBE_REJECTED)("returns null for %s", (_, pasted) => {
    expect(youtubeThumbnailSrc(pasted)).toBeNull();
    expect(youtubeThumbnailSrc(pasted, "hqdefault")).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(youtubeThumbnailSrc(null)).toBeNull();
    expect(youtubeThumbnailSrc(undefined, "hqdefault")).toBeNull();
  });
});

describe("youtubePlayerSrc", () => {
  it.each(CMS_VIDEOS)("matches the pharmtech stopgap for %s", (url, id) => {
    expect(youtubePlayerSrc(url)).toBe(`${youtubeEmbedSrc(url)}?autoplay=1&rel=0`);
    expect(youtubePlayerSrc(url)).toBe(`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`);
  });

  it.each(YOUTUBE_REJECTED)("returns null for %s", (_, pasted) => {
    expect(youtubePlayerSrc(pasted)).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(youtubePlayerSrc(null)).toBeNull();
    expect(youtubePlayerSrc(undefined)).toBeNull();
  });
});

describe("isMissingYoutubeThumbnail", () => {
  it.each([
    [0, true],
    [120, true],
    [121, false],
    [480, false],
    [1280, false],
  ])("naturalWidth %i is missing: %s", (naturalWidth, missing) => {
    expect(isMissingYoutubeThumbnail({ naturalWidth })).toBe(missing);
  });
});

describe("agreement with the pharmtech pilot", () => {
  it.each(LINKEDIN)("linkedInEmbedSrc: %s", (_, pasted, expected) => {
    expect(linkedInEmbedSrc(pasted)).toBe(expected);
    expect(linkedInSrc(pasted)).toBe(expected);
  });

  it.each(INSTAGRAM)("instagramEmbedSrc: %s", (_, pasted, expected) => {
    expect(instagramEmbedSrc(pasted)).toBe(expected);
    expect(instagramSrc(pasted)).toBe(expected);
  });
});

describe("socialEmbedSrc", () => {
  it.each(LINKEDIN)("dispatches linkedin: %s", (_, pasted, expected) => {
    expect(socialEmbedSrc("linkedin", pasted)).toBe(expected);
  });

  it.each(INSTAGRAM)("dispatches instagram: %s", (_, pasted, expected) => {
    expect(socialEmbedSrc("instagram", pasted)).toBe(expected);
  });

  it.each(YOUTUBE)("dispatches youtube: %s", (_, pasted, expected) => {
    expect(socialEmbedSrc("youtube", pasted)).toBe(expected);
  });

  it("trims", () => {
    expect(socialEmbedSrc("linkedin", "  urn:li:share:7498268744561868800\n")).toBe(
      embed("share:7498268744561868800"),
    );
    expect(socialEmbedSrc("instagram", "\t https://www.instagram.com/p/DdV1vMBOYOy/ ")).toBe(
      ig("p/DdV1vMBOYOy"),
    );
  });
});

const MEASURE = '{"type":"MEASURE","details":{"height":812}}';
const IG = "https://www.instagram.com";

describe("readInstagramMeasure", () => {
  it.each([IG, "https://instagram.com"])("reads the height from %s", (origin) => {
    expect(readInstagramMeasure({ origin, data: MEASURE })).toBe(812);
    expect(pilotMeasure({ origin, data: MEASURE })).toBe(812);
  });

  it.each([
    "https://evil.example",
    "http://www.instagram.com",
    "https://www.instagram.com.evil.example",
    "https://evil.example/https://www.instagram.com",
  ])("ignores origin %s", (origin) => {
    expect(readInstagramMeasure({ origin, data: MEASURE })).toBeNull();
    expect(pilotMeasure({ origin, data: MEASURE })).toBeNull();
  });

  it.each([
    ["non-JSON string", "not json"],
    ["wrong type", '{"type":"RESIZE","details":{"height":812}}'],
    ["missing details", '{"type":"MEASURE"}'],
    ["missing height", '{"type":"MEASURE","details":{}}'],
    ["height 0", '{"type":"MEASURE","details":{"height":0}}'],
    ["null", null],
    ['"null"', "null"],
    ["42", 42],
  ])("returns null for %s without throwing", (_, data) => {
    expect(readInstagramMeasure({ origin: IG, data })).toBeNull();
    expect(pilotMeasure({ origin: IG, data })).toBeNull();
  });
});

describe("Instagram crop", () => {
  it("measures the crop", () => {
    expect(INSTAGRAM_CROP).toEqual({ header: 54, belowMedia: 154 });
    expect(INSTAGRAM_PLACEHOLDER_HEIGHT).toBe(560);
  });

  it("crops a frame to its card", () => {
    expect(instagramCardHeight(INSTAGRAM_PLACEHOLDER_HEIGHT)).toBe(352);
    expect(instagramCardHeight(812)).toBe(604);
  });
});

describe("divergences from the pilot", () => {
  it("2: rebuilds every URL on the network's own host", () => {
    const cases: [string, typeof linkedInSrc, typeof linkedInEmbedSrc, string, string | null][] = [
      [
        `<iframe src="https://evil.example/x"></iframe>`,
        linkedInSrc,
        linkedInEmbedSrc,
        "https://evil.example/x?compact=1",
        null,
      ],
      [
        `<iframe src="https://evil.example/x" title="urn:li:share:7501237627262795776"></iframe>`,
        linkedInSrc,
        linkedInEmbedSrc,
        "https://evil.example/x?compact=1",
        null,
      ],
      [
        `<iframe src="https://evil.example/embed/feed/update/urn:li:share:7501237627262795776?x=1"></iframe>`,
        linkedInSrc,
        linkedInEmbedSrc,
        "https://evil.example/embed/feed/update/urn:li:share:7501237627262795776?compact=1",
        embed("share:7501237627262795776"),
      ],
      [
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        instagramSrc,
        instagramEmbedSrc,
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        null,
      ],
      ["https://evil.example/embed/", instagramSrc, instagramEmbedSrc, "https://evil.example/embed/", null],
      [
        "//www.instagram.com/p/X/embed/captioned/?cr=1&amp;v=14",
        instagramSrc,
        instagramEmbedSrc,
        "//www.instagram.com/p/X/embed/captioned/?cr=1&amp;v=14",
        ig("p/X"),
      ],
    ];

    for (const [pasted, pilot, pkg, pilotOut, pkgOut] of cases) {
      expect(pilot(pasted)).toBe(pilotOut);
      expect(pkg(pasted)).toBe(pkgOut);
    }
  });

  it("3: null, undefined and an unknown network give null instead of throwing", () => {
    for (const input of [null, undefined]) {
      expect(() => linkedInSrc(input as never)).toThrow();
      expect(() => instagramSrc(input as never)).toThrow();
      expect(linkedInEmbedSrc(input)).toBeNull();
      expect(instagramEmbedSrc(input)).toBeNull();
      expect(socialEmbedSrc("linkedin", input)).toBeNull();
      expect(socialEmbedSrc("instagram", input)).toBeNull();
    }
    expect(socialEmbedSrc("x" as never, "urn:li:share:7498268744561868800")).toBeNull();
  });

  it("4: only a positive finite number is a height; object data is read as-is", () => {
    const object = { type: "MEASURE", details: { height: 812 } };
    expect(pilotMeasure({ origin: IG, data: object })).toBeNull();
    expect(readInstagramMeasure({ origin: IG, data: object })).toBe(812);

    const stringHeight = '{"type":"MEASURE","details":{"height":"812"}}';
    expect(pilotMeasure({ origin: IG, data: stringHeight })).toBe("812");
    expect(readInstagramMeasure({ origin: IG, data: stringHeight })).toBeNull();

    const negative = '{"type":"MEASURE","details":{"height":-5}}';
    expect(pilotMeasure({ origin: IG, data: negative })).toBe(-5);
    expect(readInstagramMeasure({ origin: IG, data: negative })).toBeNull();

    const infinite = { type: "MEASURE", details: { height: Infinity } };
    expect(readInstagramMeasure({ origin: IG, data: infinite })).toBeNull();
  });

  it("5: INSTAGRAM_CROP is frozen", () => {
    expect(Object.isFrozen(INSTAGRAM_CROP)).toBe(true);
  });

  it("6: the last urn wins over a number in the permalink slug", () => {
    const permalink =
      "https://www.linkedin.com/posts/pharmtech_we-share-25000-samples-activity-7503697686274031617-AbCd";
    expect(linkedInSrc(permalink)).toBe(embed("share:25000"));
    expect(linkedInEmbedSrc(permalink)).toBe(embed("activity:7503697686274031617"));
    expect(
      linkedInEmbedSrc(`${permalink}?utm_source=share&utm_medium=member_desktop`),
    ).toBe(embed("activity:7503697686274031617"));
  });
});
