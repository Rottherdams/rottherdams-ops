import type { StaffItem } from '../components/staff/StaffFormModal';

/**
 * Mengembalikan prioritas pengurutan berdasarkan awalan ID (OWN- > MNG- > STF-).
 */
export const getSortPriority = (id: string): number => {
  if (id.startsWith('OWN-')) return 1;
  if (id.startsWith('MNG-')) return 2;
  return 3;
};

/**
 * Memuat urutan ID berikutnya secara otomatis berdasarkan role/divisi.
 */
export const generateNextStaffId = (role: string, staffList: StaffItem[]): string => {
  let prefix = 'STF-';
  const r = role.toLowerCase();
  if (
    r.includes('management') ||
    r.includes('hrd') ||
    r.includes('finance') ||
    r.includes('general_manager')
  ) {
    prefix = 'MNG-';
  }
  if (r.includes('owner')) {
    prefix = 'OWN-';
  }

  const samePrefixStaff = staffList.filter(s => (s.staff_id || '').startsWith(prefix));
  const nextNum = samePrefixStaff.length + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

/**
 * Memeriksa apakah role staf termasuk dalam jajaran Manajemen/Owner.
 */
export const checkIsManagement = (role?: string, staffId?: string): boolean => {
  const r = (role || '').toLowerCase();
  const id = (staffId || '').toUpperCase();

  return (
    r.includes('management') ||
    r.includes('owner') ||
    r.includes('general_manager') ||
    r.includes('spv') ||
    r.includes('hrd') ||
    r.includes('finance') ||
    id.startsWith('MNG-') ||
    id.startsWith('OWN-')
  );
};