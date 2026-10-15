import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../services/apiClient';
import { getSocket } from '../services/socketClient';

export interface MaintenanceNoticeState {
  isActive: boolean;
  maintenanceType: 'SCHEDULED' | 'EMERGENCY' | 'UPGRADE' | 'SECURITY';
  header: string;
  message: string;
  supportContact?: string;
  customColor?: string;
  updatedAt?: string;
}

export function useMaintenanceNotice(portal: 'customer' | 'rider' = 'customer'): MaintenanceNoticeState {
  const [notice, setNotice] = useState<MaintenanceNoticeState>({
    isActive: false,
    maintenanceType: 'SCHEDULED',
    header: 'System Under Maintenance',
    message: 'Scheduled system maintenance in progress. Services will resume shortly.',
    supportContact: 'support@sugo-express.org',
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // 1. Initial status fetch
    const fetchStatus = async () => {
      try {
        const res = await apiClient.get('/maintenance/status', {
          params: { portal },
          timeout: 5000,
        });
        if (isMountedRef.current && res.data) {
          setNotice({
            isActive: Boolean(res.data.isActive),
            maintenanceType: res.data.maintenanceType || 'SCHEDULED',
            header: res.data.header || 'System Under Maintenance',
            message:
              res.data.message ||
              res.data.notice ||
              'Scheduled system maintenance in progress. Services will resume shortly.',
            supportContact: res.data.supportContact,
            customColor: res.data.customColor,
            updatedAt: res.data.updatedAt,
          });
        }
      } catch {
        // Fail open silently; do not disrupt the user
      }
    };

    fetchStatus();

    // 2. Real-time push listener over socket
    let cleanUpSocket: (() => void) | undefined;
    getSocket()
      .then((socket) => {
        if (!isMountedRef.current) return;
        const handler = (payload: any) => {
          if (!isMountedRef.current) return;
          if (payload && payload.portal === portal) {
            setNotice({
              isActive: Boolean(payload.isActive),
              maintenanceType: payload.maintenanceType || 'SCHEDULED',
              header: payload.header || 'System Under Maintenance',
              message:
                payload.message ||
                payload.notice ||
                'Scheduled system maintenance in progress. Services will resume shortly.',
              supportContact: payload.supportContact,
              customColor: payload.customColor,
              updatedAt: payload.updatedAt,
            });
          }
        };

        socket.on('maintenance:update', handler);
        cleanUpSocket = () => {
          socket.off('maintenance:update', handler);
        };
      })
      .catch(() => {});

    // 3. Fallback interval polling (every 60s)
    const interval = setInterval(fetchStatus, 60000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      cleanUpSocket?.();
    };
  }, [portal]);

  return notice;
}

export default useMaintenanceNotice;
