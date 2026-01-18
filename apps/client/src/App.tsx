import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { TranscriptInput } from './components/TranscriptInput';
import { TicketList } from './components/TicketList';
import { TicketEditor } from './components/TicketEditor';
import { TeamManager } from './components/TeamManager';
import { EpicManager } from './components/EpicManager';
import { JiraSettings } from './components/JiraSettings';
import { AgentPanel } from './components/AgentPanel';
import { Toast } from './components/Toast';
import { XPBar } from './components/XPBar';
import { XPPopup } from './components/XPPopup';
import { LevelUpModal } from './components/LevelUpModal';
import { MemberLevelUpModal } from './components/MemberLevelUpModal';
import { RTSWorldView } from './components/rts/RTSWorldView';
import { getTickets, getTeamMembers, getEpics } from './utils/api';

const tabs = [
  { key: 'tickets' as const, label: 'Quests', icon: '📜' },
  { key: 'team' as const, label: 'Squad', icon: '⚔️' },
  { key: 'epics' as const, label: 'Campaigns', icon: '🏰' },
  { key: 'world' as const, label: 'World', icon: '🗺️' },
  { key: 'agent' as const, label: 'AI Agent', icon: '🤖' },
  { key: 'settings' as const, label: 'Settings', icon: '⚙️' },
];

export default function App() {
  const {
    activeTab,
    setActiveTab,
    setTickets,
    setTeamMembers,
    setEpics,
    setIsLoading,
    showToast,
  } = useStore();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [ticketsRes, teamRes, epicsRes] = await Promise.all([
          getTickets(),
          getTeamMembers(),
          getEpics(),
        ]);
        setTickets(ticketsRes.tickets);
        setTeamMembers(teamRes.members);
        setEpics(epicsRes.epics);
      } catch (error) {
        showToast('Failed to load data', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [setTickets, setTeamMembers, setEpics, setIsLoading, showToast]);

  return (
    <div className="min-h-screen bg-stone-primary">
      {/* Command Center Header */}
      <header className="bg-stone-secondary border-b-4 border-border-gold shadow-pixel">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* Top row: Title and Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚔️</span>
              <div>
                <h1 className="font-pixel text-pixel-xl text-gold tracking-wide">
                  QUEST LOG
                </h1>
                <p className="font-readable text-lg text-beige/60">
                  Foam Platform - Sdwad DI Team
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`stone-tab flex items-center gap-2 ${
                    activeTab === tab.key ? 'stone-tab-active' : ''
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Bottom row: XP Bar */}
          <div className="pixel-divider mb-3" />
          <XPBar />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <TranscriptInput />
            <TicketList />
          </div>
        )}

        {activeTab === 'team' && <TeamManager />}

        {activeTab === 'epics' && <EpicManager />}

        {activeTab === 'agent' && <AgentPanel />}

        {activeTab === 'world' && <RTSWorldView />}

        {activeTab === 'settings' && <JiraSettings />}
      </main>

      {/* Modals and Overlays */}
      <TicketEditor />
      <Toast />
      <XPPopup />
      <LevelUpModal />
      <MemberLevelUpModal />
    </div>
  );
}
