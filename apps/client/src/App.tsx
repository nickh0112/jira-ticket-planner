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
import { PMDashboard } from './components/PMDashboard';
import { MemberDetailPage } from './components/MemberDetailPage';
import { IdeasTab } from './components/ideas/IdeasTab';
import { DevActivityTab } from './components/DevActivity';
import { AutomationDashboard } from './components/AutomationDashboard';
import { MeetingNotesProcessor } from './components/MeetingNotesProcessor';
import { ReportsDashboard } from './components/ReportsDashboard';
import { SlackSettings } from './components/SlackSettings';
import { getTickets, getTeamMembers, getEpics } from './utils/api';

const tabs = [
  { key: 'tickets' as const, label: 'Quests', icon: '📜' },
  { key: 'ideas' as const, label: 'Forge', icon: '🧠' },
  { key: 'team' as const, label: 'Squad', icon: '⚔️' },
  { key: 'epics' as const, label: 'Campaigns', icon: '🏰' },
  { key: 'world' as const, label: 'World', icon: '🗺️' },
  { key: 'dev' as const, label: 'Dev', icon: '💻' },
  { key: 'pm' as const, label: 'PM', icon: '📊' },
  { key: 'engine' as const, label: 'Engine', icon: '🔧' },
  { key: 'reports' as const, label: 'Reports', icon: '📋' },
  { key: 'meetings' as const, label: 'Meetings', icon: '🗣️' },
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
    selectedMemberId,
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
    <div className={`bg-stone-primary ${activeTab === 'ideas' ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen'}`}>
      {/* Command Center Header - Compact */}
      <header className="bg-stone-secondary border-b-4 border-border-gold shadow-pixel flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
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
            <XPBar />
          </div>
        </div>
      </header>

      {/* Ideas Tab - Full Width (rendered outside main) */}
      {activeTab === 'ideas' && <IdeasTab />}

      {/* Main Content - Only render when not on ideas tab */}
      {activeTab !== 'ideas' && (
        <main className="max-w-6xl mx-auto px-4 py-6">
          {activeTab === 'tickets' && (
            <div className="space-y-6">
              <TranscriptInput />
              <TicketList />
            </div>
          )}

          {activeTab === 'team' && (
            selectedMemberId ? <MemberDetailPage /> : <TeamManager />
          )}

          {activeTab === 'epics' && <EpicManager />}

          {activeTab === 'agent' && <AgentPanel />}

          {activeTab === 'world' && <RTSWorldView />}

          {activeTab === 'pm' && <PMDashboard />}

          {activeTab === 'dev' && <DevActivityTab />}

          {activeTab === 'engine' && <AutomationDashboard />}

          {activeTab === 'reports' && <ReportsDashboard />}

          {activeTab === 'meetings' && <MeetingNotesProcessor />}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              <JiraSettings />
              <SlackSettings />
            </div>
          )}
        </main>
      )}

      {/* Modals and Overlays */}
      <TicketEditor />
      <Toast />
      <XPPopup />
      <LevelUpModal />
      <MemberLevelUpModal />
    </div>
  );
}
