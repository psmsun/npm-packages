/**
 * Extracts an 11-character YouTube video ID from any YouTube URL format,
 * or returns a bare ID as-is. Returns null if nothing can be extracted.
 *
 * Supported formats:
 * - Bare ID: `dQw4w9WgXcQ`
 * - `youtube.com/watch?v=ID`
 * - `youtu.be/ID`
 * - `youtube.com/embed/ID`
 * - `youtube.com/shorts/ID`
 * - `youtube.com/live/ID`
 * - Bare ID with pasted share params: `dQw4w9WgXcQ&t=4s`
 */
export declare function extractYoutubeID(input: string | null | undefined): string | null;

/**
 * Extracts VK video `oid` and `id` from any VK video URL format or raw ID string.
 * Returns `{ oid: string; id: string }` or null if nothing can be extracted.
 *
 * Supported formats:
 * - Raw `oid_id` or `-oid_id`
 * - `vk.com/video_ext.php?oid=...&id=...`
 * - `vk.com/video{oid}_{id}`
 * - `vk.com/clip{oid}_{id}`
 * - Query string fragment `oid=...&id=...`
 * - Raw `oid_id` with pasted share params: `-178652725_456239064&t=4s`
 */
export declare function extractVKIDs(input: string | null | undefined): { oid: string; id: string } | null;
