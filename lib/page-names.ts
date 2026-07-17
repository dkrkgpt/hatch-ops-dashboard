export const PANCAKE_PAGE_NAMES: Record<string, string> = {
  "124072347455733": "KG Kimiko Glow – UAE",
  "1647526645358126": "Beauty & Wellness Hong Kong",
  "452828185281118": "KG Essentials",
  "102382939341238": "Kimiko Philippines",
  "ttm_-000yTA68ZawssS3BN5BospdUUUayV3IP064": "TikTok Messages 1",
  "ttm_-000ZWjFrZ_G7c4sgmJsvTfuGTUdximl-stM": "TikTok Messages 2",
  "tts_7494728711398132556": "TikTok Shop",
  "spo_23408563": "Other social inbox",
};

export function pageName(pageId: string) {
  return PANCAKE_PAGE_NAMES[pageId] ?? "Unknown source";
}
