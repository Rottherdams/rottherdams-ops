import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useStaffDetails(isOpen: boolean, staffId: string) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (isOpen && staffId) {
      fetchStaffDetails();
    }
  }, [isOpen, staffId]);

  const fetchStaffDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('staff_id', staffId)
        .single();

      if (!error && data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setStaffName(data.staff_name || data.name || '');
        setPhoneNumber(data.phone_number || '');
        setEmail(data.email || '');
        setTelegramChatId(data.telegram_chat_id || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (err) {
      console.error('Error fetching staff profile details:', err);
    }
  };

  return {
    firstName, setFirstName,
    lastName, setLastName,
    staffName, setStaffName,
    phoneNumber, setPhoneNumber,
    email, setEmail,
    telegramChatId, setTelegramChatId,
    avatarUrl, setAvatarUrl,
  };
}