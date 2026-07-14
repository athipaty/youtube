import { useEffect, useState } from 'react';
import { useLanguage } from '../utils/i18n';

// Every option carries its own English label because the composed description is fed directly
// into the Pollinations/Flux image prompt (see backend generateCharacterSprites) — that model
// responds far better to English keyword prompts, so the SENT text always uses .en regardless
// of which UI language is displayed to the user.
const SPECIES = [
  { value: 'human', en: 'Human', th: 'มนุษย์' },
  { value: 'animal', en: 'Talking animal', th: 'สัตว์พูดได้' },
  { value: 'robot', en: 'Robot', th: 'หุ่นยนต์' },
  { value: 'fantasy', en: 'Fantasy creature', th: 'สิ่งมีชีวิตแฟนตาซี' },
  { value: 'object', en: 'Object / other', th: 'สิ่งของ/อื่นๆ' },
];
const GENDERS = [
  { value: 'unspecified', en: 'Not specified', th: 'ไม่ระบุ' },
  { value: 'female', en: 'Female', th: 'หญิง' },
  { value: 'male', en: 'Male', th: 'ชาย' },
];
const AGES = [
  { value: 'child', en: 'Child', th: 'เด็ก' },
  { value: 'teen', en: 'Teen', th: 'วัยรุ่น' },
  { value: 'young-adult', en: 'Young adult', th: 'วัยหนุ่มสาว' },
  { value: 'adult', en: 'Adult', th: 'ผู้ใหญ่' },
  { value: 'elderly', en: 'Elderly', th: 'ผู้สูงอายุ' },
];
const BUILDS = [
  { value: 'slim', en: 'Slim', th: 'ผอมเพรียว' },
  { value: 'average', en: 'Average', th: 'ปานกลาง' },
  { value: 'sturdy', en: 'Sturdy / muscular', th: 'ล่ำ/บึกบึน' },
  { value: 'round', en: 'Chubby / round', th: 'อ้วนกลม' },
  { value: 'tall-lanky', en: 'Tall & lanky', th: 'สูงเพรียว' },
  { value: 'short-small', en: 'Short & small', th: 'เตี้ยและตัวเล็ก' },
];
const COLORS = [
  { value: 'red', en: 'Red', th: 'แดง' },
  { value: 'orange', en: 'Orange', th: 'ส้ม' },
  { value: 'yellow', en: 'Yellow', th: 'เหลือง' },
  { value: 'green', en: 'Green', th: 'เขียว' },
  { value: 'blue', en: 'Blue', th: 'น้ำเงิน' },
  { value: 'purple', en: 'Purple', th: 'ม่วง' },
  { value: 'pink', en: 'Pink', th: 'ชมพู' },
  { value: 'brown', en: 'Brown', th: 'น้ำตาล' },
  { value: 'black', en: 'Black', th: 'ดำ' },
  { value: 'white', en: 'White', th: 'ขาว' },
  { value: 'gray', en: 'Gray', th: 'เทา' },
  { value: 'gold', en: 'Gold', th: 'ทอง' },
];
const HAIR_STYLES = [
  { value: 'short', en: 'Short', th: 'สั้น' },
  { value: 'long', en: 'Long', th: 'ยาว' },
  { value: 'curly', en: 'Curly', th: 'หยิก' },
  { value: 'straight', en: 'Straight', th: 'ตรง' },
  { value: 'ponytail', en: 'Ponytail', th: 'มัดหางม้า' },
  { value: 'braided', en: 'Braided', th: 'ถักเปีย' },
  { value: 'messy-spiky', en: 'Messy / spiky', th: 'ยุ่ง/ตั้งฟู' },
  { value: 'bald', en: 'Bald / none', th: 'ล้าน/ไม่มีผม' },
];
const OUTFITS = [
  { value: 'none', en: 'None / bare skin or fur', th: 'ไม่มี/เผยผิวหรือขน' },
  { value: 'casual', en: 'Casual t-shirt & pants', th: 'ลำลอง เสื้อยืดกับกางเกง' },
  { value: 'dress', en: 'Dress', th: 'ชุดเดรส' },
  { value: 'superhero', en: 'Superhero suit', th: 'ชุดซูเปอร์ฮีโร่' },
  { value: 'armor', en: 'Armor', th: 'ชุดเกราะ' },
  { value: 'lab-coat', en: 'Lab coat', th: 'เสื้อกาวน์' },
  { value: 'uniform', en: 'School / work uniform', th: 'ชุดยูนิฟอร์ม' },
  { value: 'robe', en: 'Robe / cloak', th: 'ชุดคลุม' },
  { value: 'overalls', en: 'Overalls', th: 'ชุดเอี๊ยม' },
  { value: 'sporty', en: 'Sporty outfit', th: 'ชุดกีฬา' },
];
const ACCESSORIES = [
  { value: 'glasses', en: 'glasses', th: 'แว่นตา' },
  { value: 'hat', en: 'a hat', th: 'หมวก' },
  { value: 'backpack', en: 'a backpack', th: 'เป้สะพายหลัง' },
  { value: 'cape', en: 'a cape', th: 'ผ้าคลุม' },
  { value: 'scarf', en: 'a scarf', th: 'ผ้าพันคอ' },
  { value: 'bowtie', en: 'a bowtie', th: 'หูกระต่าย' },
  { value: 'crown', en: 'a crown', th: 'มงกุฎ' },
  { value: 'wings', en: 'wings', th: 'ปีก' },
  { value: 'bag', en: 'a bag', th: 'กระเป๋า' },
  { value: 'weapon', en: 'a weapon', th: 'อาวุธ' },
];
const VIBES = [
  { value: 'cheerful', en: 'cheerful, friendly', th: 'ร่าเริงเป็นมิตร' },
  { value: 'heroic', en: 'brave, heroic', th: 'กล้าหาญเหมือนฮีโร่' },
  { value: 'shy', en: 'shy, gentle', th: 'ขี้อายและอ่อนโยน' },
  { value: 'mischievous', en: 'mischievous, playful', th: 'ซุกซนขี้เล่น' },
  { value: 'wise', en: 'wise, calm', th: 'ฉลาดและสงบนิ่ง' },
  { value: 'grumpy', en: 'grumpy but lovable', th: 'บึ้งตึงแต่น่ารัก' },
  { value: 'goofy', en: 'silly, goofy', th: 'ตลกและงี่เง่าน่ารัก' },
];

const DEFAULT_ATTRS = {
  species: 'human',
  animalType: '',
  gender: 'unspecified',
  age: 'adult',
  build: 'average',
  bodyColor: '',
  hairStyle: '',
  eyeColor: '',
  outfit: '',
  outfitColor: '',
  accessories: [],
  vibe: '',
  extra: '',
};

function label(opt, lang) {
  return (opt && (opt[lang] || opt.en)) || '';
}
function findOpt(list, value) {
  return list.find(o => o.value === value);
}

// Always composes from .en labels — see the file-level comment on why.
export function composeDescription(a) {
  const parts = [];

  const speciesWord = a.species === 'animal'
    ? `anthropomorphic ${a.animalType.trim() || 'animal'}`
    : a.species === 'robot' ? 'robot'
    : a.species === 'fantasy' ? 'fantasy creature'
    : a.species === 'object' ? 'character'
    : 'human';
  const genderWord = a.gender !== 'unspecified' ? findOpt(GENDERS, a.gender)?.en.toLowerCase() : '';
  const ageWord = findOpt(AGES, a.age)?.en.toLowerCase() || '';
  parts.push([ageWord, genderWord, speciesWord].filter(Boolean).join(' '));

  const buildLabel = findOpt(BUILDS, a.build)?.en.toLowerCase();
  if (buildLabel) parts.push(`${buildLabel} build`);

  const isRobotOrObject = a.species === 'robot' || a.species === 'object';
  if (!isRobotOrObject) {
    const furWord = a.species === 'animal' ? 'fur' : 'hair';
    const colorLabel = a.bodyColor && findOpt(COLORS, a.bodyColor)?.en.toLowerCase();
    const styleLabel = a.hairStyle && findOpt(HAIR_STYLES, a.hairStyle)?.en.toLowerCase();
    const bits = [colorLabel, styleLabel, furWord].filter(Boolean);
    if (colorLabel || styleLabel) parts.push(bits.join(' '));
  } else if (a.bodyColor) {
    parts.push(`${findOpt(COLORS, a.bodyColor).en.toLowerCase()} colored`);
  }

  if (a.eyeColor && a.species !== 'object') {
    parts.push(`${findOpt(COLORS, a.eyeColor).en.toLowerCase()} eyes`);
  }

  if (a.outfit && a.outfit !== 'none') {
    const outfitWord = findOpt(OUTFITS, a.outfit)?.en.toLowerCase();
    if (outfitWord) {
      parts.push(a.outfitColor
        ? `wearing a ${outfitWord} in ${findOpt(COLORS, a.outfitColor).en.toLowerCase()}`
        : `wearing a ${outfitWord}`);
    }
  }

  if (a.accessories.length) {
    parts.push(a.accessories.map(v => findOpt(ACCESSORIES, v).en).join(', '));
  }

  if (a.vibe) parts.push(`${findOpt(VIBES, a.vibe).en} expression`);

  if (a.extra.trim()) parts.push(a.extra.trim());

  return parts.filter(Boolean).join(', ');
}

function Field({ label: text, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
      {text}
      {children}
    </label>
  );
}

function selectClass() {
  return 'px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 bg-white font-normal text-slate-900';
}

export default function CharacterAttributePicker({ onChange, onManualToggle }) {
  const { t, lang } = useLanguage();
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [attrs, setAttrs] = useState(DEFAULT_ATTRS);

  const composed = composeDescription(attrs);

  useEffect(() => {
    onChange(manual ? manualText : composed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, manualText, composed]);

  function set(key, value) {
    setAttrs(v => ({ ...v, [key]: value }));
  }
  function toggleAccessory(value) {
    setAttrs(v => ({
      ...v,
      accessories: v.accessories.includes(value)
        ? v.accessories.filter(a => a !== value)
        : [...v.accessories, value],
    }));
  }

  if (manual) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          placeholder={t('series.descriptionPlaceholder')}
          value={manualText}
          onChange={e => setManualText(e.target.value)}
          rows={3}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10 resize-none"
        />
        <button
          type="button"
          onClick={() => { setManual(false); onManualToggle?.(false); }}
          className="self-start text-xs font-semibold text-reel hover:text-reel-dark underline"
        >
          {t('attrPicker.useGuided')}
        </button>
      </div>
    );
  }

  const showHair = attrs.species !== 'robot' && attrs.species !== 'object';
  const showEyes = attrs.species !== 'object';

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Field label={t('attrPicker.species')}>
          <select className={selectClass()} value={attrs.species} onChange={e => set('species', e.target.value)}>
            {SPECIES.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
          </select>
        </Field>
        {attrs.species === 'animal' && (
          <Field label={t('attrPicker.animalTypePlaceholder')}>
            <input
              type="text" value={attrs.animalType} onChange={e => set('animalType', e.target.value)}
              className={selectClass()}
            />
          </Field>
        )}
        <Field label={t('attrPicker.age')}>
          <select className={selectClass()} value={attrs.age} onChange={e => set('age', e.target.value)}>
            {AGES.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
          </select>
        </Field>
        <Field label={t('attrPicker.gender')}>
          <select className={selectClass()} value={attrs.gender} onChange={e => set('gender', e.target.value)}>
            {GENDERS.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
          </select>
        </Field>
        <Field label={t('attrPicker.build')}>
          <select className={selectClass()} value={attrs.build} onChange={e => set('build', e.target.value)}>
            {BUILDS.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
          </select>
        </Field>
        <Field label={t('attrPicker.bodyColor')}>
          <select className={selectClass()} value={attrs.bodyColor} onChange={e => set('bodyColor', e.target.value)}>
            <option value="">{t('attrPicker.pick')}</option>
            {COLORS.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
          </select>
        </Field>
        {showHair && (
          <Field label={t('attrPicker.hairStyle')}>
            <select className={selectClass()} value={attrs.hairStyle} onChange={e => set('hairStyle', e.target.value)}>
              <option value="">{t('attrPicker.pick')}</option>
              {HAIR_STYLES.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
            </select>
          </Field>
        )}
        {showEyes && (
          <Field label={t('attrPicker.eyeColor')}>
            <select className={selectClass()} value={attrs.eyeColor} onChange={e => set('eyeColor', e.target.value)}>
              <option value="">{t('attrPicker.pick')}</option>
              {COLORS.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('attrPicker.outfit')}>
          <select className={selectClass()} value={attrs.outfit} onChange={e => set('outfit', e.target.value)}>
            <option value="">{t('attrPicker.pick')}</option>
            {OUTFITS.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
          </select>
        </Field>
        {attrs.outfit && attrs.outfit !== 'none' && (
          <Field label={t('attrPicker.outfitColor')}>
            <select className={selectClass()} value={attrs.outfitColor} onChange={e => set('outfitColor', e.target.value)}>
              <option value="">{t('attrPicker.pick')}</option>
              {COLORS.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
            </select>
          </Field>
        )}
        <Field label={t('attrPicker.vibe')}>
          <select className={selectClass()} value={attrs.vibe} onChange={e => set('vibe', e.target.value)}>
            <option value="">{t('attrPicker.pick')}</option>
            {VIBES.map(o => <option key={o.value} value={o.value}>{label(o, lang)}</option>)}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-slate-500">{t('attrPicker.accessories')}</p>
        <div className="flex flex-wrap gap-1.5">
          {ACCESSORIES.map(o => {
            const active = attrs.accessories.includes(o.value);
            return (
              <button
                type="button" key={o.value}
                onClick={() => toggleAccessory(o.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  active ? 'bg-reel text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {label(o, lang)}
              </button>
            );
          })}
        </div>
      </div>

      <input
        type="text" placeholder={t('attrPicker.extraPlaceholder')} value={attrs.extra}
        onChange={e => set('extra', e.target.value)}
        className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-reel focus:ring-4 focus:ring-reel/10"
      />

      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
        <p className="text-[11px] font-semibold text-slate-400 mb-0.5">{t('attrPicker.preview')}</p>
        <p className="text-xs text-slate-600">{composed || '—'}</p>
      </div>

      <button
        type="button"
        onClick={() => { setManualText(composed); setManual(true); onManualToggle?.(true); }}
        className="self-start text-xs font-semibold text-slate-400 hover:text-reel underline"
      >
        {t('attrPicker.useManual')}
      </button>
    </div>
  );
}
