// Small icons: SVG on the desktop, a glyph in the theme's colour in the
// terminal (which draws no SVG). An SVG is drawn as an image and can't read
// the theme, so its colours are mid tones that hold up on light and dark.

import type { Ui } from './act'

export type IconName =
  | 'host'
  | 'profile'
  | 'claude'
  | 'running'
  | 'waiting'
  | 'stopped'
  | 'remote'
  | 'update'
  | 'offline'
  | 'folder'

export type IconTone = 'success' | 'warning' | 'error' | 'permission' | 'claude' | 'inactive'

const HEX: Record<IconTone, string> = {
  success: '#3fb950',
  warning: '#d29922',
  error: '#f85149',
  permission: '#58a6ff',
  claude: '#d97757',
  inactive: '#8b949e',
}

/** Lucide's style (24×24, 2-wide round strokes), as the Mac app's icons. */
const lucide = (c: string, body: string) =>
  `<g fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`

/**
 * Each icon's drawing in a 24×24 box, in `c` (its colour). `host` and
 * `remote` are Lucide's Server and Laptop, the icons the Mac app uses
 * (lucide.dev, ISC licence, © Lucide Icons and Contributors).
 */
const PATHS: Record<IconName, (c: string) => string> = {
  host: (c) =>
    lucide(
      c,
      '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    ),
  offline: (c) =>
    lucide(
      c,
      '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><path d="M3 23 21 1"/>',
    ),
  remote: (c) =>
    lucide(
      c,
      '<path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/><path d="M20.054 15.987H3.946"/>',
    ),
  // Claude's mark, as the Mac app's sidebar shows it beside each profile: a logo in its own colour.
  claude: () =>
    '<path transform="scale(0.09375)" fill="#D97757" d="M121.344 256L114.944 251.136L111.36 243.2L114.944 227.328L119.04 206.848L122.368 190.464L125.44 170.24L127.232 163.584L126.976 163.072L125.696 163.328L110.336 184.32L87.04 215.808L68.608 235.264L64.256 237.056L56.576 233.216L57.344 226.048L61.696 219.904L87.04 187.392L102.4 167.168L112.384 155.648L112.128 154.112H111.616L44.032 198.144L32 199.68L26.624 194.816L27.392 186.88L29.952 184.32L50.176 170.24L100.608 142.08L101.376 139.52L100.608 138.24H98.048L89.6 137.728L60.928 136.96L36.096 135.936L11.776 134.656L5.632 133.376L0 125.696L0.512 121.856L5.632 118.528L13.056 119.04L29.184 120.32L53.504 121.856L71.168 122.88L97.28 125.696H101.376L101.888 123.904L100.608 122.88L99.584 121.856L74.24 104.96L47.104 87.04L32.768 76.544L25.088 71.168L21.248 66.304L19.712 55.552L26.624 47.872L36.096 48.64L38.4 49.152L47.872 56.576L68.096 72.192L94.72 91.904L98.56 94.976L100.352 93.952V93.184L98.56 90.368L84.224 64.256L68.864 37.632L61.952 26.624L60.16 19.968C59.4773 17.664 59.136 15.104 59.136 12.288L67.072 1.53601L71.424 0L82.176 1.53601L86.528 5.37601L93.184 20.48L103.68 44.288L120.32 76.544L125.184 86.272L127.744 94.976L128.768 97.792H130.56V96.256L131.84 77.824L134.4 55.552L136.96 26.88L137.728 18.688L141.824 8.96001L149.76 3.84001L155.904 6.65601L161.024 14.08L160.256 18.688L157.44 38.4L151.296 69.376L147.456 90.368H149.76L152.32 87.552L162.816 73.728L180.48 51.712L188.16 43.008L197.376 33.28L203.264 28.672H214.272L222.208 40.704L218.624 53.248L207.36 67.584L197.888 79.616L184.32 97.792L176.128 112.384L176.896 113.408H178.688L209.152 106.752L225.792 103.936L245.248 100.608L254.208 104.704L255.232 108.8L251.648 117.504L230.656 122.624L206.08 127.488L169.472 136.192L168.96 136.448L169.472 137.216L185.856 138.752L193.024 139.264H210.432L242.688 141.568L251.136 147.2L256 153.856L255.232 159.232L242.176 165.632L224.768 161.536L183.808 151.808L169.984 148.48H167.936V149.504L179.712 161.024L200.96 180.224L227.84 205.056L229.12 211.2L225.792 216.32L222.208 215.808L198.656 197.888L189.44 189.952L168.96 172.8H167.68V174.592L172.288 181.504L197.376 219.136L198.656 230.656L196.864 234.24L190.208 236.544L183.296 235.264L168.448 214.784L153.344 191.488L141.056 170.752L139.776 171.776L132.352 249.088L129.024 252.928L121.344 256Z"/>',
  profile: (c) => lucide(c, '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>'),
  update: (c) => lucide(c, '<circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>'),
  folder: (c) =>
    lucide(
      c,
      '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    ),
  running: (c) => `<circle cx="12" cy="12" r="7" fill="${c}"/>`,
  waiting: (c) =>
    `<circle cx="12" cy="12" r="7" fill="none" stroke="${c}" stroke-width="2"/><path d="M12 5a7 7 0 0 1 0 14z" fill="${c}"/>`,
  stopped: (c) => `<circle cx="12" cy="12" r="7" fill="none" stroke="${c}" stroke-width="2"/>`,
}

/** What the terminal draws instead. */
const GLYPHS: Record<IconName, string> = {
  host: '▣',
  offline: '▢',
  profile: '◉',
  claude: '✻',
  running: '●',
  waiting: '◐',
  stopped: '○',
  remote: '◆',
  update: '↑',
  folder: '',
}

/** An icon: SVG where the surface draws it, else its glyph. */
export function Icon(ui: Ui, name: IconName, tone: IconTone, size = 14) {
  if (ui.surface === 'desktop') {
    const { Svg } = ui
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${PATHS[name](HEX[tone])}</svg>`
    return <Svg alt={name} width={size} height={size} source={source} />
  }
  const { Text } = ui
  return <Text color={tone}>{GLYPHS[name]}</Text>
}
