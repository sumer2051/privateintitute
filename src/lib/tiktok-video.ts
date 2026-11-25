export function validateTikTokVideo(file: { name: string; type: string; size: number }): string | null {
  if (file.size === 0) return "This file is empty. Choose a video.";
  if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type) && !(file.type === "" && /\.(mp4|mov|webm)$/i.test(file.name))) return "Choose an MP4, MOV, or WebM video.";
  return null;
}