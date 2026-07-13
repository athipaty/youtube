import { createContext, useCallback, useContext, useState } from 'react';

// UI language only — this switches the app's own labels/buttons, not the generated video's
// script/narration language (that's the per-series voiceLocale, a separate concern entirely:
// you could run the whole app in Thai while still producing an English-narrated video).
const TRANSLATIONS = {
  en: {
    'nav.series': 'Series',
    'nav.episodes': 'Episodes',

    'error.title': 'App Error',

    'common.loading': 'Loading…',
    'common.cancel': 'Cancel',

    'series.heading': 'Series & Characters',
    'series.subtitle': 'Set up a story world once — characters keep the same look across every episode.',
    'series.newSeries': '+ New series',
    'series.titlePlaceholder': 'Series title',
    'series.premisePlaceholder': 'Premise — a one-paragraph pitch for the whole series',
    'series.genrePlaceholder': 'Genre (optional)',
    'series.tonePlaceholder': 'Tone (optional) — e.g. gentle, whimsical, funny',
    'series.artStylePlaceholder': 'Art style (optional) — e.g. flat vector cartoon, pastel colors',
    'series.creating': 'Creating…',
    'series.createSeries': 'Create series',
    'series.charactersHeading': 'Characters — {title}',
    'series.newCharacter': '+ New character',
    'series.namePlaceholder': 'Character name',
    'series.descriptionPlaceholder': "Locked visual description — be specific, this is reused in every sprite image forever (e.g. 'a friendly young cartoon fox, orange fur, cream belly, big round brown eyes')",
    'series.voiceNamePlaceholder': 'edge-tts voice name (e.g. en-US-AvaNeural, th-TH-PremwadeeNeural)',
    'series.createCharacter': 'Create character',
    'series.noCharacters': 'No characters yet — add one above.',
    'series.generateSprites': '🎨 Generate sprites',
    'series.deleteCharacter': '🗑 Delete',
    'series.deleteCharacterTitle': 'Delete this character?',
    'series.deleteCharacterMessage': '{name} and all of its generated sprites will be permanently removed. Episodes already rendered with them are unaffected.',
    'series.deleteCharacterConfirm': 'Delete character',

    'spriteSteps.neutral': '😐 Neutral pose…',
    'spriteSteps.happy': '😊 Happy pose…',
    'spriteSteps.sad': '😢 Sad pose…',
    'spriteSteps.surprised': '😲 Surprised pose…',
    'spriteSteps.action': '🏃 Action pose…',

    'spriteGrid.none': 'No sprites generated yet.',
    'spriteGrid.generating': '🎨 Generating sprite set…',
    'spriteGrid.failed': '⚠ Sprite generation failed: {error}',

    'episodes.heading': 'Episodes',
    'episodes.subtitle': 'Pitch one line — the pipeline writes the script, generates art, records narration, and renders the video.',
    'episodes.noSeries': 'No series yet — create one on the Series tab first.',
    'episodes.premisePlaceholder': "What happens in this episode? e.g. 'Ruso gets lost and a wise old owl helps him find his way home.'",
    'episodes.starting': 'Starting…',
    'episodes.createEpisode': '🎬 Create episode',
    'episodes.noEpisodes': 'No episodes yet — pitch one above.',
    'episodes.deleteEpisode': '🗑 Delete',
    'episodes.deleteEpisodeTitle': 'Delete this episode?',
    'episodes.deleteEpisodeMessage': 'Ep. {number}{titleSuffix} and its rendered video will be permanently removed.',
    'episodes.deleteEpisodeConfirm': 'Delete episode',
    'episodes.errorFallback': 'Something went wrong.',
    'episodes.retry': '🔄 Retry',
    'episodes.scriptSummary': 'Script ({count} scenes)',

    'episodeSteps.pending': '⏳ Queued…',
    'episodeSteps.script': '✍️ Writing script…',
    'episodeSteps.sprites': '🎨 Generating character sprites…',
    'episodeSteps.backgrounds': '🖼️ Generating scene backgrounds…',
    'episodeSteps.tts': '🎙️ Recording narration…',
    'episodeSteps.rendering': '🎬 Rendering video…',
    'episodeSteps.uploading': '☁️ Uploading…',
  },
  th: {
    'nav.series': 'ซีรีส์',
    'nav.episodes': 'ตอน',

    'error.title': 'แอปพลิเคชันขัดข้อง',

    'common.loading': 'กำลังโหลด…',
    'common.cancel': 'ยกเลิก',

    'series.heading': 'ซีรีส์และตัวละคร',
    'series.subtitle': 'ตั้งค่าโลกของเรื่องราวเพียงครั้งเดียว — ตัวละครจะมีหน้าตาเหมือนเดิมในทุกตอน',
    'series.newSeries': '+ สร้างซีรีส์ใหม่',
    'series.titlePlaceholder': 'ชื่อซีรีส์',
    'series.premisePlaceholder': 'พล็อตเรื่อง — สรุปแนวคิดของซีรีส์ทั้งหมดสั้นๆ หนึ่งย่อหน้า',
    'series.genrePlaceholder': 'แนวเรื่อง (ไม่บังคับ)',
    'series.tonePlaceholder': 'โทนเรื่อง (ไม่บังคับ) — เช่น อบอุ่น, สนุกสนาน, ตลก',
    'series.artStylePlaceholder': 'สไตล์ภาพ (ไม่บังคับ) — เช่น การ์ตูนเวกเตอร์แบนราบ, โทนสีพาสเทล',
    'series.creating': 'กำลังสร้าง…',
    'series.createSeries': 'สร้างซีรีส์',
    'series.charactersHeading': 'ตัวละคร — {title}',
    'series.newCharacter': '+ เพิ่มตัวละคร',
    'series.namePlaceholder': 'ชื่อตัวละคร',
    'series.descriptionPlaceholder': "คำอธิบายรูปลักษณ์ที่ตายตัว — ระบุให้ชัดเจน เพราะจะถูกใช้ซ้ำในทุกภาพสไปรต์ตลอดไป (เช่น 'จิ้งจอกการ์ตูนน่ารักตัวเล็ก ขนสีส้ม ท้องสีครีม ตาสีน้ำตาลกลมโต')",
    'series.voiceNamePlaceholder': 'ชื่อเสียง edge-tts (เช่น en-US-AvaNeural, th-TH-PremwadeeNeural)',
    'series.createCharacter': 'สร้างตัวละคร',
    'series.noCharacters': 'ยังไม่มีตัวละคร — เพิ่มด้านบนได้เลย',
    'series.generateSprites': '🎨 สร้างภาพสไปรต์',
    'series.deleteCharacter': '🗑 ลบ',
    'series.deleteCharacterTitle': 'ลบตัวละครนี้หรือไม่?',
    'series.deleteCharacterMessage': '{name} และภาพสไปรต์ทั้งหมดที่สร้างไว้จะถูกลบถาวร ตอนที่เรนเดอร์ไปแล้วจะไม่ได้รับผลกระทบ',
    'series.deleteCharacterConfirm': 'ลบตัวละคร',

    'spriteSteps.neutral': '😐 ท่าปกติ…',
    'spriteSteps.happy': '😊 ท่ายิ้ม…',
    'spriteSteps.sad': '😢 ท่าเศร้า…',
    'spriteSteps.surprised': '😲 ท่าประหลาดใจ…',
    'spriteSteps.action': '🏃 ท่าแอ็กชัน…',

    'spriteGrid.none': 'ยังไม่มีการสร้างภาพสไปรต์',
    'spriteGrid.generating': '🎨 กำลังสร้างชุดภาพสไปรต์…',
    'spriteGrid.failed': '⚠ สร้างภาพสไปรต์ไม่สำเร็จ: {error}',

    'episodes.heading': 'ตอน',
    'episodes.subtitle': 'พิมพ์พล็อตสั้นๆ หนึ่งบรรทัด — ระบบจะเขียนบท สร้างภาพ อัดเสียงบรรยาย และเรนเดอร์วิดีโอให้',
    'episodes.noSeries': 'ยังไม่มีซีรีส์ — ไปสร้างซีรีส์ที่แท็บ Series ก่อน',
    'episodes.premisePlaceholder': "ตอนนี้เกิดอะไรขึ้นบ้าง? เช่น 'รูโซ่หลงทางและนกฮูกผู้ชาญฉลาดช่วยพาเขากลับบ้าน'",
    'episodes.starting': 'กำลังเริ่ม…',
    'episodes.createEpisode': '🎬 สร้างตอนใหม่',
    'episodes.noEpisodes': 'ยังไม่มีตอน — พิมพ์พล็อตด้านบนได้เลย',
    'episodes.deleteEpisode': '🗑 ลบ',
    'episodes.deleteEpisodeTitle': 'ลบตอนนี้หรือไม่?',
    'episodes.deleteEpisodeMessage': 'ตอนที่ {number}{titleSuffix} และวิดีโอที่เรนเดอร์แล้วจะถูกลบถาวร',
    'episodes.deleteEpisodeConfirm': 'ลบตอน',
    'episodes.errorFallback': 'เกิดข้อผิดพลาดบางอย่าง',
    'episodes.retry': '🔄 ลองใหม่',
    'episodes.scriptSummary': 'บท ({count} ฉาก)',

    'episodeSteps.pending': '⏳ กำลังรอคิว…',
    'episodeSteps.script': '✍️ กำลังเขียนบท…',
    'episodeSteps.sprites': '🎨 กำลังสร้างภาพตัวละคร…',
    'episodeSteps.backgrounds': '🖼️ กำลังสร้างภาพฉากหลัง…',
    'episodeSteps.tts': '🎙️ กำลังอัดเสียงบรรยาย…',
    'episodeSteps.rendering': '🎬 กำลังเรนเดอร์วิดีโอ…',
    'episodeSteps.uploading': '☁️ กำลังอัปโหลด…',
  },
};

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('uiLang') || 'en');

  const setLang = useCallback((l) => {
    localStorage.setItem('uiLang', l);
    setLangState(l);
  }, []);

  const t = useCallback((key, vars) => {
    const str = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
    return interpolate(str, vars);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
