import { useEffect } from 'react';
import { messaging } from '../config/firebase';
import { getToken, onMessage } from 'firebase/messaging';

export const requestNotificationPermission = async () => {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Permissão de notificação concedida!');
      
      const token = await getToken(messaging, { 
        vapidKey: 'BERfkXXXhGhptdwEsTIayna2gA0iJClW2wXAB7YPeMPWINNEH9eeHPUGlbfeIXyMB8cRyKlHePQv7J4SjxDU1mU' 
      });

      if (token) {
        console.log('FCM Token:', token);
        return token;
      }
    }
  } catch (error) {
    console.error('Erro ao configurar notificações:', error);
  }
  return null;
};

const NotificationHandler = () => {
  useEffect(() => {
    // No iOS, não pedimos automaticamente no mount, apenas via clique
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const notificationsEnabledPref = localStorage.getItem('zimbroo_notifications_enabled') !== 'false';
    
    if (!isIOS && notificationsEnabledPref) {
      requestNotificationPermission();
    }

    let unsubscribe = () => {};
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('Mensagem recebida no foreground:', payload);
      });
    }

    return () => unsubscribe();
  }, []);

  return null;
};

export default NotificationHandler;
