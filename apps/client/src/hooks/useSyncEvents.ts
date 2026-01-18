import { useEffect, useRef, useCallback } from 'react';
import type { SyncEvent, TicketCompletedEvent, XPAwardedEvent, MemberLevelUpEvent } from '@jira-planner/shared';
import { useMemberProgressStore } from '../store/memberProgressStore';
import { useWorldStore } from '../store/worldStore';

const API_BASE = '/api';

interface UseSyncEventsOptions {
  enabled?: boolean;
  onTicketCompleted?: (event: TicketCompletedEvent) => void;
  onXPAwarded?: (event: XPAwardedEvent) => void;
  onLevelUp?: (event: MemberLevelUpEvent) => void;
  onSyncStarted?: () => void;
  onSyncCompleted?: (result: { ticketsProcessed: number; xpAwarded: number }) => void;
  onSyncError?: (error: string) => void;
}

export function useSyncEvents(options: UseSyncEventsOptions = {}) {
  const { enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const { addXpToMember, loadLevelUpEvents } = useMemberProgressStore();
  const { addXPFloat, setUnitActivityState } = useWorldStore();

  const handleEvent = useCallback(
    (event: SyncEvent) => {
      switch (event.type) {
        case 'connected':
          console.log('[SSE] Connected to sync events');
          reconnectAttemptsRef.current = 0;
          break;

        case 'sync_started':
          console.log('[SSE] Sync started');
          options.onSyncStarted?.();
          break;

        case 'sync_completed':
          console.log('[SSE] Sync completed:', event.data);
          options.onSyncCompleted?.(event.data as { ticketsProcessed: number; xpAwarded: number });
          break;

        case 'sync_error':
          console.error('[SSE] Sync error:', event.data);
          options.onSyncError?.((event.data as { error: string }).error);
          break;

        case 'ticket_completed': {
          const ticketEvent = event as TicketCompletedEvent;
          console.log('[SSE] Ticket completed:', ticketEvent.data);
          options.onTicketCompleted?.(ticketEvent);

          // Trigger completing animation for member
          if (ticketEvent.data.teamMemberId) {
            setUnitActivityState(ticketEvent.data.teamMemberId, 'completing');
            setTimeout(() => {
              setUnitActivityState(ticketEvent.data.teamMemberId!, 'working');
            }, 2000);
          }
          break;
        }

        case 'xp_awarded': {
          const xpEvent = event as XPAwardedEvent;
          console.log('[SSE] XP awarded:', xpEvent.data);
          options.onXPAwarded?.(xpEvent);

          // Update member progress locally
          addXpToMember(xpEvent.data.teamMemberId, xpEvent.data.amount);

          // Show XP float animation
          addXPFloat(xpEvent.data.teamMemberId, xpEvent.data.amount);
          break;
        }

        case 'level_up': {
          const levelUpEvent = event as MemberLevelUpEvent;
          console.log('[SSE] Level up:', levelUpEvent.data);
          options.onLevelUp?.(levelUpEvent);

          // Trigger leveling_up animation
          if (levelUpEvent.data.entityType === 'member') {
            setUnitActivityState(levelUpEvent.data.entityId, 'leveling_up');
          }

          // Reload level-up events to show modal
          loadLevelUpEvents();
          break;
        }

        default:
          console.log('[SSE] Unknown event:', event);
      }
    },
    [
      options,
      addXpToMember,
      addXPFloat,
      setUnitActivityState,
      loadLevelUpEvents,
    ]
  );

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_BASE}/sync/events`);
    eventSourceRef.current = eventSource;

    // Handle all event types
    const eventTypes = [
      'connected',
      'sync_started',
      'sync_completed',
      'sync_error',
      'ticket_completed',
      'xp_awarded',
      'level_up',
      'member_moved',
      'region_updated',
    ];

    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data);
          handleEvent({ type: type as SyncEvent['type'], ...data });
        } catch (err) {
          console.error(`[SSE] Failed to parse ${type} event:`, err);
        }
      });
    });

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      eventSource.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      console.log(`[SSE] Reconnecting in ${delay}ms...`);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, delay);
    };
  }, [enabled, handleEvent]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, connect]);

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnect: connect,
  };
}
