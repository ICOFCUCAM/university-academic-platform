// ---------------------------------------------------------------------------
// READING THIS PLATFORM WHEN THE DEFAULT DOES NOT WORK.
//
// A student who needs larger text, more contrast, a typeface that does not
// swim, or a page that does not move under them is not asking for a feature.
// They are asking to be able to use the course they are enrolled on, and
// every one of these settings is the difference between a lecture being
// available to them and not.
//
// Four rules this file exists to hold:
//
//   THE SETTINGS ARE THE PERSON'S OWN. Unlike the working language — which is
//   the registry's, so that a term is studied in one language — nobody else
//   sets these and nobody else has any business reading them. A screen that
//   showed a lecturer "this student uses the dyslexia-friendly typeface"
//   would be disclosing a disability the student disclosed to a stylesheet.
//
//   THE SYSTEM'S OWN PREFERENCE IS HONOURED UNTIL THEY OVERRIDE IT. Somebody
//   who has set "reduce motion" in their operating system has already said
//   this once and should not have to say it again; but if they turn motion
//   back on here, here wins.
//
//   THEY CHANGE HOW IT IS PRESENTED, NEVER WHAT IT SAYS. None of this touches
//   an artefact, a translation or a term. High contrast is a palette.
//
//   AND WHAT IS NOT REAL IS NOT CLAIMED. "Captions" here means the script that
//   was spoken, shown beside the audio rather than behind a click. It is not a
//   timed caption track: the speech services this platform talks to return
//   audio and a duration, not word timings, and a caption that claims to be
//   synchronised and is not is worse than one that never claimed it.
// ---------------------------------------------------------------------------

export interface AccessibilitySettings {
  typeface: 'standard' | 'dyslexia-friendly';
  textSize: 'standard' | 'large' | 'larger';
  contrast: 'standard' | 'high';
  motion: 'system' | 'reduced' | 'full';
  /** Show the spoken script with the audio rather than behind a disclosure. */
  captions: boolean;
  /** Underline every link rather than relying on colour alone. */
  underlineLinks: boolean;
}

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  typeface: 'standard',
  textSize: 'standard',
  contrast: 'standard',
  motion: 'system',
  captions: false,
  underlineLinks: false,
};

/** Every setting, with what each is for, so the screen is written from here. */
export const ACCESSIBILITY_CHOICES: {
  key: keyof AccessibilitySettings;
  label: string;
  blurb: string;
  options: { value: string | boolean; label: string }[];
}[] = [
  {
    key: 'textSize',
    label: 'Text size',
    blurb: 'Raises the prose most, since that is what is read for twenty minutes at a time, and lifts the interface’s small type with it. Rows wrap rather than the layout breaking.',
    options: [
      { value: 'standard', label: 'Standard' },
      { value: 'large', label: 'Large' },
      { value: 'larger', label: 'Larger' },
    ],
  },
  {
    key: 'typeface',
    label: 'Typeface',
    blurb: 'Wider letter and word spacing, looser lines, and a face already on your device — Atkinson Hyperlegible where it is installed, otherwise Verdana or Tahoma. No font is downloaded.',
    options: [
      { value: 'standard', label: 'Standard' },
      { value: 'dyslexia-friendly', label: 'Dyslexia-friendly' },
    ],
  },
  {
    key: 'contrast',
    label: 'Contrast',
    blurb: 'Darkens the text and the borders, and removes the tints behind panels.',
    options: [
      { value: 'standard', label: 'Standard' },
      { value: 'high', label: 'High contrast' },
    ],
  },
  {
    key: 'motion',
    label: 'Motion',
    blurb: 'Spinners and transitions. “Follow my system” uses what your device already says.',
    options: [
      { value: 'system', label: 'Follow my system' },
      { value: 'reduced', label: 'Reduce motion' },
      { value: 'full', label: 'Full motion' },
    ],
  },
  {
    key: 'captions',
    label: 'The spoken script',
    blurb: 'Shows the words of an audio lesson beside it rather than behind a click. Not a timed caption track — see below.',
    options: [
      { value: false, label: 'Behind a click' },
      { value: true, label: 'Always shown' },
    ],
  },
  {
    key: 'underlineLinks',
    label: 'Links',
    blurb: 'Underlines every link, so a link is never signalled by colour alone.',
    options: [
      { value: false, label: 'Underline on hover' },
      { value: true, label: 'Always underlined' },
    ],
  },
];

/** What a stored value becomes: unknown or absent is the default, never a crash. */
export function settingsOf(stored: Partial<AccessibilitySettings> | undefined): AccessibilitySettings {
  const valid = <K extends keyof AccessibilitySettings>(key: K): AccessibilitySettings[K] => {
    const value = stored?.[key];
    const choice = ACCESSIBILITY_CHOICES.find((c) => c.key === key);
    if (!choice || value === undefined) return DEFAULT_ACCESSIBILITY[key];
    return choice.options.some((o) => o.value === value)
      ? (value as AccessibilitySettings[K])
      : DEFAULT_ACCESSIBILITY[key];
  };
  return {
    typeface: valid('typeface'),
    textSize: valid('textSize'),
    contrast: valid('contrast'),
    motion: valid('motion'),
    captions: valid('captions'),
    underlineLinks: valid('underlineLinks'),
  };
}

/**
 * The attributes the stylesheet reads, put on `<body>` by the layout so the
 * first paint is already right — a student should never watch the page load
 * in the typeface they cannot read and then correct itself.
 *
 * `data-motion` is omitted when the answer is "follow my system", which leaves
 * the CSS media query in charge rather than overruling it with a default.
 */
export function bodyAttributes(settings: AccessibilitySettings): Record<string, string> {
  const attributes: Record<string, string> = {
    'data-typeface': settings.typeface,
    'data-text': settings.textSize,
    'data-contrast': settings.contrast,
  };
  if (settings.motion !== 'system') attributes['data-motion'] = settings.motion;
  if (settings.underlineLinks) attributes['data-links'] = 'underlined';
  return attributes;
}

/** Whether anything here is turned on, for a screen that says so plainly. */
export function anythingChosen(settings: AccessibilitySettings): boolean {
  return (Object.keys(DEFAULT_ACCESSIBILITY) as (keyof AccessibilitySettings)[])
    .some((key) => settings[key] !== DEFAULT_ACCESSIBILITY[key]);
}
