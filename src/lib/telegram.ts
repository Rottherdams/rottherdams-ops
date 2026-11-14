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
  targetChatId?: string;
}

export async function sendTelegramAlert({
  title,
  actor,
  details,
  footerNote,
  photoUrl,
  mapUrl,
  targetChatId,
}: TelegramNotifyOptions): Promise<{ ok: boolean; error?: string }> {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = targetChatId?.trim() || import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return { ok: false, error: 'Bot Token atau Chat ID belum dikonfigurasi.' };
  }

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
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || 'Gagal mengirim pesan ke Telegram.' };
    }

    return { ok: true };
  } catch (err: any) {
    console.warn('Gagal mengirim notifikasi Telegram:', err);
    return { ok: false, error: err?.message || 'Koneksi ke Telegram gagal.' };
  }
}

// 🤖 Ambil username bot Telegram otomatis dari token
export async function getTelegramBotUsername(): Promise<string | null> {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (data?.ok && data?.result?.username) {
      return data.result.username;
    }
    return null;
  } catch {
    return null;
  }
}

// 🔍 Deteksi otomatis Chat ID user berdasarkan perintah /start <staff_id> atau /start terbaru
export async function detectStaffTelegramChatId(
  staffId: string
): Promise<{ ok: boolean; chatId?: string; telegramName?: string; error?: string }> {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { ok: false, error: 'Token Bot Telegram belum dikonfigurasi.' };
  }

  try {
    // 0. Nonaktifkan webhook lama (jika ada) agar getUpdates tidak bentrok
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
    });

    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=50`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.description || 'Gagal membaca update dari bot Telegram.',
      };
    }

    const updates: any[] = data.result || [];
    const targetCode = staffId.trim().toLowerCase();

    // Prioritas 1: Cari dari pesan terbaru ke terlama yang berisi "/start <staff_id>"
    let matchedChat: any = null;
    for (let i = updates.length - 1; i >= 0; i--) {
      const msg = updates[i]?.message;
      const text = (msg?.text || '').trim().toLowerCase();
      const chat = msg?.chat;

      if (
        chat?.type === 'private' &&
        (text === `/start ${targetCode}` || text.includes(targetCode))
      ) {
        matchedChat = chat;
        break;
      }
    }

    // Prioritas 2: Fallback ke pesan "/start" pribadi terbaru jika user mengetik /start manual
    if (!matchedChat) {
      for (let i = updates.length - 1; i >= 0; i--) {
        const msg = updates[i]?.message;
        const text = (msg?.text || '').trim().toLowerCase();
        const chat = msg?.chat;

        if (chat?.type === 'private' && text.startsWith('/start')) {
          matchedChat = chat;
          break;
        }
      }
    }

    if (matchedChat) {
      const chatId = String(matchedChat.id);
      const fullName =
        [matchedChat.first_name, matchedChat.last_name].filter(Boolean).join(' ') ||
        matchedChat.username ||
        'Akun Telegram';

      // Langsung kirim balasan ke Telegram user sebagai konfirmasi
      await sendTelegramAlert({
        title: '🤖 AKUN TELEGRAM TERHUBUNG',
        actor: `${fullName} (${staffId})`,
        details: {
          'Telegram Chat ID': chatId,
          'Status': 'Siap menerima notifikasi Rottherdams Ops',
        },
        targetChatId: chatId,
      });

      return {
        ok: true,
        chatId,
        telegramName: fullName,
      };
    }

    return {
      ok: false,
      error: `Webhook lama sudah dibersihkan. Silakan klik "1. Buka Bot & Klik Start" lalu kirim /start sekali lagi di Telegram, kemudian klik "2. Ambil ID Otomatis".`,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Gagal terhubung ke server Telegram.' };
  }
}