// ── UI-Native Color Tokens (P5) ─────────────────────────────────────────────
//
// Per-platform color palettes pinned to the 2024 UI vintage. Templates
// reference these instead of hardcoding hex literals so a UI refresh
// (eg WhatsApp 2025 theme) can be added without rewriting the template.

export interface ChatColorPalette {
  /** Background of the conversation area. */
  conversationBg: string
  /** Header / app bar background. */
  headerBg: string
  /** Header text + icons color. */
  headerFg: string
  /** Incoming bubble fill. */
  incomingBubbleBg: string
  /** Incoming bubble text. */
  incomingBubbleFg: string
  /** Outgoing bubble fill. */
  outgoingBubbleBg: string
  /** Outgoing bubble text. */
  outgoingBubbleFg: string
  /** Timestamp + read-receipt subdued color. */
  bubbleMetaFg: string
  /** Date separator pill background. */
  dateSeparatorBg: string
  /** Date separator pill text. */
  dateSeparatorFg: string
  /** Composer input bar background. */
  composerBg: string
  /** Composer placeholder text. */
  composerPlaceholder: string
}

/** WhatsApp 2024 light theme — taken from observed screenshots. */
export const WHATSAPP_LIGHT_2024: ChatColorPalette = {
  conversationBg:    '#E5DDD5',  // classic doodle background base color
  headerBg:          '#075E54',  // WhatsApp dark teal
  headerFg:          '#FFFFFF',
  incomingBubbleBg:  '#FFFFFF',
  incomingBubbleFg:  '#111B21',
  outgoingBubbleBg:  '#DCF8C6',  // signature green
  outgoingBubbleFg:  '#111B21',
  bubbleMetaFg:      '#667781',
  dateSeparatorBg:   '#E1F2FB',
  dateSeparatorFg:   '#54656F',
  composerBg:        '#F0F2F5',
  composerPlaceholder:'#8696A0',
}

/** Messenger 2024 light theme — observed from Facebook Messenger v420. */
export const MESSENGER_LIGHT_2024: ChatColorPalette = {
  conversationBg:    '#FFFFFF',
  headerBg:          '#FFFFFF',
  headerFg:          '#050505',
  incomingBubbleBg:  '#F0F0F0',
  incomingBubbleFg:  '#050505',
  outgoingBubbleBg:  '#0084FF',  // Messenger signature blue
  outgoingBubbleFg:  '#FFFFFF',
  bubbleMetaFg:      '#65676B',
  dateSeparatorBg:   '#FFFFFF',
  dateSeparatorFg:   '#65676B',
  composerBg:        '#F0F2F5',
  composerPlaceholder:'#65676B',
}

/** Generic status bar text color (auto-flipped per header). */
export const STATUS_BAR_LIGHT_FG = '#FFFFFF'
export const STATUS_BAR_DARK_FG  = '#050505'

// ── Marketplace review palettes (P6) ────────────────────────────────────

export interface ReviewColorPalette {
  /** Page background. */
  pageBg: string
  /** Page foreground / primary text. */
  pageFg: string
  /** Secondary muted text. */
  mutedFg: string
  /** Header (app bar) background. */
  headerBg: string
  /** Header text + icon color. */
  headerFg: string
  /** Star rating fill color. */
  starFill: string
  /** Star rating empty color. */
  starEmpty: string
  /** "Verified purchase" / variant badge color. */
  accent: string
  /** Bottom action bar background. */
  footerBg: string
  /** Primary CTA color (buy button background). */
  ctaBg: string
  /** Primary CTA foreground. */
  ctaFg: string
  /** Divider between review items. */
  divider: string
}

export const SHOPEE_LIGHT_2024: ReviewColorPalette = {
  pageBg:    '#FFFFFF',
  pageFg:    '#222222',
  mutedFg:   '#9B9B9B',
  headerBg:  '#EE4D2D',  // Shopee signature orange
  headerFg:  '#FFFFFF',
  starFill:  '#EE4D2D',
  starEmpty: '#E7E7E7',
  accent:    '#26AA99',  // teal for "Verified" tag
  footerBg:  '#FFFFFF',
  ctaBg:     '#EE4D2D',
  ctaFg:     '#FFFFFF',
  divider:   '#F0F0F0',
}

export const TIKTOK_SHOP_LIGHT_2024: ReviewColorPalette = {
  pageBg:    '#FFFFFF',
  pageFg:    '#161823',
  mutedFg:   '#86878D',
  headerBg:  '#FFFFFF',
  headerFg:  '#161823',
  starFill:  '#FE2C55',  // TikTok signature pink-red
  starEmpty: '#E6E6E8',
  accent:    '#25F4EE',  // TikTok cyan
  footerBg:  '#FFFFFF',
  ctaBg:     '#FE2C55',
  ctaFg:     '#FFFFFF',
  divider:   '#F1F1F2',
}

// ── Social comment palettes (P6) ────────────────────────────────────────

export interface CommentColorPalette {
  pageBg: string
  pageFg: string
  mutedFg: string
  headerBg: string
  headerFg: string
  /** Comment author name color. */
  authorFg: string
  /** Like / heart accent color. */
  likeAccent: string
  /** Reply line indicator color. */
  replyAccent: string
  /** Footer composer background. */
  composerBg: string
  composerPlaceholder: string
  divider: string
}

export const FACEBOOK_LIGHT_2024: CommentColorPalette = {
  pageBg:    '#FFFFFF',
  pageFg:    '#050505',
  mutedFg:   '#65676B',
  headerBg:  '#FFFFFF',
  headerFg:  '#050505',
  authorFg:  '#050505',
  likeAccent:'#1B74E4',  // Facebook blue
  replyAccent:'#65676B',
  composerBg:'#F0F2F5',
  composerPlaceholder:'#65676B',
  divider:   '#E4E6EB',
}

export const TIKTOK_COMMENT_DARK_2024: CommentColorPalette = {
  pageBg:    '#000000',  // TikTok comment overlay on dark video
  pageFg:    '#FFFFFF',
  mutedFg:   '#86878D',
  headerBg:  '#161823',
  headerFg:  '#FFFFFF',
  authorFg:  '#FFFFFF',
  likeAccent:'#FE2C55',
  replyAccent:'#86878D',
  composerBg:'#161823',
  composerPlaceholder:'#86878D',
  divider:   '#1E1E22',
}
