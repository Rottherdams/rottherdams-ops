// src/lib/telegram.ts

const escapeHtml = (str: string) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export interface TelegramNotifyOptions {
  title: string;
  actor?: string;
  details: Record<string, string | number | undefined | null>;
  footerNote?: string;
  photoUrl?: string;
  mapUrl?: string;
}

export async function sendTelegramAlert({
  title,
  actor,
  details,
  footerNote,
  photoUrl,
  mapUrl,
}: TelegramNotifyOptions) {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  const lines: string[] = [
    `🔔 <b>${escapeHtml(title)}</b>`,
    `━━━━━━━━━━━━━━━━━━`,
  ];

  if (actor) {
    lines.push(`👤 <b>Oleh:</b> ${escapeHtml(actor)}`);
  }

  for (const [label, value] of Object.entries(details)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      lines.push(`• <b>${escapeHtml(label)}:</b> ${escapeHtml(String(value))}`);
    }
  }

  if (mapUrl) {
    lines.push(`• <b>Lokasi GPS:</b> <a href="${mapUrl}">📍 Buka Google Maps</a>`);
  }

  if (photoUrl) {
    lines.push(`• <b>Foto Bukti:</b> <a href="${photoUrl}">📸 Lihat Foto Selfie</a>`);
  }

  if (footerNote) {
    lines.push(`\n<pre>${escapeHtml(footerNote)}</pre>`);
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
  } catch (err) {
    console.warn('Gagal mengirim notifikasi Telegram:', err);
  }
}