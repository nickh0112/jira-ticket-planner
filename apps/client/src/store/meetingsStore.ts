import { create } from 'zustand';
import type {
  Meeting,
  MeetingType,
  MeetingObjective,
  MeetingDecision,
  MeetingActionItem,
  MeetingActionItemStatus,
  MeetingSuggestedTicket,
} from '@jira-planner/shared';
import {
  processMeetingNotes as apiProcessNotes,
  getMeetings,
  getMeeting,
  updateMeetingActionItem,
  convertActionItemToTicket as apiConvertToTicket,
} from '../utils/api';

/** Client-side enriched meeting with all related data embedded */
export interface MeetingView extends Meeting {
  summary: string | null;
  objectives: MeetingObjective[];
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
  suggestedTickets: MeetingSuggestedTicket[];
}

interface MeetingsState {
  // Data
  meetings: MeetingView[];
  currentMeeting: MeetingView | null;

  // UI State
  isProcessing: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  processMeetingNotes: (title: string, meetingType: MeetingType, rawNotes: string) => Promise<void>;
  fetchMeetings: () => Promise<void>;
  fetchMeeting: (id: string) => Promise<void>;
  updateActionItem: (meetingId: string, actionItemId: string, status: MeetingActionItemStatus) => Promise<void>;
  convertToTicket: (meetingId: string, actionItemId: string) => Promise<string | null>;
  setCurrentMeeting: (meeting: MeetingView | null) => void;
  setError: (error: string | null) => void;
}

/** Convert a bare Meeting to a MeetingView with empty related data */
function toMeetingView(meeting: Meeting): MeetingView {
  return {
    ...meeting,
    summary: meeting.aiSummary,
    objectives: [],
    decisions: [],
    actionItems: [],
    suggestedTickets: [],
  };
}

export const useMeetingsStore = create<MeetingsState>((set) => ({
  meetings: [],
  currentMeeting: null,
  isProcessing: false,
  isLoading: false,
  error: null,

  processMeetingNotes: async (title, meetingType, rawNotes) => {
    set({ isProcessing: true, error: null });
    try {
      const result = await apiProcessNotes({ title, type: meetingType, rawInput: rawNotes });
      // result is MeetingProcessResult
      const view: MeetingView = {
        ...result.meeting,
        summary: result.summary,
        objectives: result.objectives,
        decisions: result.decisions,
        actionItems: result.actionItems,
        suggestedTickets: result.ticketSuggestions,
      };
      set((state) => ({
        meetings: [view, ...state.meetings],
        currentMeeting: view,
        isProcessing: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to process meeting notes',
        isProcessing: false,
      });
    }
  },

  fetchMeetings: async () => {
    set({ isLoading: true, error: null });
    try {
      const meetings = await getMeetings();
      // GET /meetings returns bare Meeting[] — convert to MeetingView[]
      set({ meetings: meetings.map(toMeetingView), isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load meetings',
        isLoading: false,
      });
    }
  },

  fetchMeeting: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const full = await getMeeting(id);
      // GET /meetings/:id returns MeetingFull
      const view: MeetingView = {
        ...full.meeting,
        summary: full.meeting.aiSummary,
        objectives: full.objectives,
        decisions: full.decisions,
        actionItems: full.actionItems,
        suggestedTickets: [],
      };
      set({ currentMeeting: view, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load meeting',
        isLoading: false,
      });
    }
  },

  updateActionItem: async (meetingId, actionItemId, status) => {
    try {
      const updatedItem = await updateMeetingActionItem(meetingId, actionItemId, status);
      set((state) => {
        const updateMeeting = (m: MeetingView): MeetingView => ({
          ...m,
          actionItems: m.actionItems.map((ai) =>
            ai.id === actionItemId ? { ...ai, status: updatedItem.status } : ai
          ),
        });
        return {
          currentMeeting: state.currentMeeting?.id === meetingId
            ? updateMeeting(state.currentMeeting)
            : state.currentMeeting,
          meetings: state.meetings.map((m) =>
            m.id === meetingId ? updateMeeting(m) : m
          ),
        };
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update action item' });
    }
  },

  convertToTicket: async (meetingId, actionItemId) => {
    try {
      const result = await apiConvertToTicket(meetingId, actionItemId);
      set((state) => {
        const updateMeeting = (m: MeetingView): MeetingView => ({
          ...m,
          actionItems: m.actionItems.map((ai) =>
            ai.id === actionItemId ? { ...ai, jiraTicketId: result.ticketId } : ai
          ),
        });
        return {
          currentMeeting: state.currentMeeting?.id === meetingId
            ? updateMeeting(state.currentMeeting)
            : state.currentMeeting,
          meetings: state.meetings.map((m) =>
            m.id === meetingId ? updateMeeting(m) : m
          ),
        };
      });
      return result.ticketId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to convert to ticket' });
      return null;
    }
  },

  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),
  setError: (error) => set({ error }),
}));
