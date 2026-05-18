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
