export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const WEEKS = [1, 2, 3, 4];

/**
 * Menghitung rentang tanggal Senin-Minggu berdasarkan nomor minggu (M1 - M4).
 */
export const getWeekDateRange = (weekNum: number) => {
  const baseMonday = new Date(2026, 10, 2); // November 2, 2026

  const startDate = new Date(baseMonday);
  startDate.setDate(baseMonday.getDate() + (weekNum - 1) * 7);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const weekDates: string[] = [];
  const dateFormattedLabels: { [day: string]: string } = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    weekDates.push(dateStr);

    const dayName = DAYS[i];
    dateFormattedLabels[dayName] = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });
  }

  const formatLocalIso = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    start: formatLocalIso(startDate),
    end: formatLocalIso(endDate),
    weekDates,
    dateFormattedLabels,
  };
};

/**
 * Menentukan nomor minggu (1-4) berdasarkan tanggal hari ini.
 */
export const getCurrentWeekKey = (): number => {
  const today = new Date();
  const currentDate = today.getDate();

  if (currentDate <= 8) return 1;
  if (currentDate <= 15) return 2;
  if (currentDate <= 22) return 3;
  return 4;
};

/**
 * Mendapatkan nama hari bahasa Indonesia (Senin - Minggu) untuk hari ini.
 */
export const getTodayName = (): string => {
  const dayIndex = new Date().getDay();
  const dayMap: { [key: number]: string } = {
    0: 'Minggu',
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
  };
  return dayMap[dayIndex] || 'Senin';
};

/**
 * Memeriksa apakah string tanggal sama dengan hari ini (format YYYY-MM-DD).
 */
export const isSameDate = (dateString: string): boolean => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayFormatted = `${y}-${m}-${d}`;
  return dateString === todayFormatted;
};