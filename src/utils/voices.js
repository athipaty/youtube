// Curated from edge-tts-universal's VoicesManager, confirmed live against the two locales the
// series form actually offers (see backend/utils/youtube/edgeTts.js) — Microsoft's edge-tts
// service only exposes 2 Thai neural voices total, vs. 17 for en-US, so voice variety is
// inherently locale-limited rather than a gap in this list.
export const VOICE_CATALOG = {
  'en-US': [
    { value: 'en-US-AndrewNeural', label: 'Andrew', gender: 'Male' },
    { value: 'en-US-AndrewMultilingualNeural', label: 'Andrew (Multilingual)', gender: 'Male' },
    { value: 'en-US-BrianNeural', label: 'Brian', gender: 'Male' },
    { value: 'en-US-BrianMultilingualNeural', label: 'Brian (Multilingual)', gender: 'Male' },
    { value: 'en-US-ChristopherNeural', label: 'Christopher', gender: 'Male' },
    { value: 'en-US-EricNeural', label: 'Eric', gender: 'Male' },
    { value: 'en-US-GuyNeural', label: 'Guy', gender: 'Male' },
    { value: 'en-US-RogerNeural', label: 'Roger', gender: 'Male' },
    { value: 'en-US-SteffanNeural', label: 'Steffan', gender: 'Male' },
    { value: 'en-US-AvaNeural', label: 'Ava', gender: 'Female' },
    { value: 'en-US-AvaMultilingualNeural', label: 'Ava (Multilingual)', gender: 'Female' },
    { value: 'en-US-EmmaNeural', label: 'Emma', gender: 'Female' },
    { value: 'en-US-EmmaMultilingualNeural', label: 'Emma (Multilingual)', gender: 'Female' },
    { value: 'en-US-AnaNeural', label: 'Ana', gender: 'Female' },
    { value: 'en-US-AriaNeural', label: 'Aria', gender: 'Female' },
    { value: 'en-US-JennyNeural', label: 'Jenny', gender: 'Female' },
    { value: 'en-US-MichelleNeural', label: 'Michelle', gender: 'Female' },
  ],
  'th-TH': [
    { value: 'th-TH-NiwatNeural', label: 'Niwat', gender: 'Male' },
    { value: 'th-TH-PremwadeeNeural', label: 'Premwadee', gender: 'Female' },
  ],
};

export const ALL_VOICES = Object.entries(VOICE_CATALOG).flatMap(([locale, voices]) =>
  voices.map((v) => ({ ...v, locale }))
);

export function voicesForLocale(locale) {
  return VOICE_CATALOG[locale] || ALL_VOICES;
}
