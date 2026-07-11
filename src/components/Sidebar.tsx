import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Folder, Users, Presentation, BookOpen, Settings, Clapperboard, LogOut, Type, X, ChevronLeft, ChevronRight, Menu, Image } from 'lucide-react';
import { auth, signOut } from '../lib/firebase';
import { cn } from '../lib/utils';
import { useStore } from '../store';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const { isMobileMenuOpen, setMobileMenuOpen, isLeftSidebarCollapsed, setLeftSidebarCollapsed } = useStore();

  const match = path.match(/^\/editor\/([^\/]+)/);
  const projectId = match ? match[1] : null;

  const handleNav = (to: string) => {
    navigate(to);
    setMobileMenuOpen(false);
  };

  const getBtnClass = (active: boolean) => 
    cn(
      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors overflow-hidden",
      active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
    );

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity",
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileMenuOpen(false)}
      />
      <div className={cn(
        "fixed md:static inset-y-0 left-0 z-50 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0 h-full text-slate-300 transition-all duration-200 ease-in-out z-[60]",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        isLeftSidebarCollapsed ? "w-16" : "w-64"
      )}>
        <div className="p-4 flex items-center justify-between shrink-0 h-16 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Clapperboard className="w-4 h-4 text-white" />
            </div>
            {!isLeftSidebarCollapsed && <span className="font-medium text-white tracking-wide shrink-0">ScriptForge</span>}
          </div>
          <button 
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <div className="px-3 space-y-1">
            <button title="Dashboard" onClick={() => handleNav('/dashboard')} className={getBtnClass(path === '/dashboard')}>
              <LayoutDashboard className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Dashboard"}
            </button>
            <button title="Projects" onClick={() => handleNav('/projects')} className={getBtnClass(path === '/projects')}>
              <Folder className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Projects"}
            </button>
            
            {projectId && (
              <>
                {!isLeftSidebarCollapsed && (
                  <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                    Current Project
                  </div>
                )}
                {isLeftSidebarCollapsed && <div className="h-4" />}
                <button title="Screenplay Editor" onClick={() => handleNav(`/editor/${projectId}`)} className={getBtnClass(path === `/editor/${projectId}`)}>
                  <Type className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Screenplay Editor"}
                </button>
                <button title="Characters" onClick={() => handleNav(`/editor/${projectId}/characters`)} className={getBtnClass(path === `/editor/${projectId}/characters`)}>
                  <Users className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Characters"}
                </button>
                <button title="Storyboard" onClick={() => handleNav(`/editor/${projectId}/storyboard`)} className={getBtnClass(path === `/editor/${projectId}/storyboard`)}>
                  <Image className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Storyboard"}
                </button>
                <button title="Beat Board" onClick={() => handleNav(`/editor/${projectId}/beat-board`)} className={getBtnClass(path === `/editor/${projectId}/beat-board`)}>
                  <Presentation className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Beat Board"}
                </button>
                <button title="Settings" onClick={() => handleNav(`/editor/${projectId}/settings`)} className={getBtnClass(path === `/editor/${projectId}/settings`)}>
                  <Settings className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Settings"}
                </button>
              </>
            )}

            {!projectId && (
              <button title="Settings" onClick={() => handleNav('/settings')} className={getBtnClass(path === '/settings')}>
                <Settings className="w-5 h-5 shrink-0" /> {!isLeftSidebarCollapsed && "Settings"}
              </button>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 overflow-hidden mb-4">
            <div className="flex items-center gap-3 min-w-0">
               <img src={auth.currentUser?.photoURL || ''} alt="" className="w-8 h-8 rounded-full bg-slate-800 shrink-0 pointer-events-none" />
               {!isLeftSidebarCollapsed && <span className="text-sm font-medium text-slate-300 truncate">{auth.currentUser?.displayName || 'User'}</span>}
            </div>
          </div>
          <div className={cn("flex", isLeftSidebarCollapsed ? "flex-col gap-2" : "flex-row justify-between")}>
             <button onClick={signOut} className="p-2 text-slate-500 shrink-0 hover:text-white transition-colors rounded-lg hover:bg-slate-800 flex justify-center items-center" title="Sign out">
                <LogOut className="w-5 h-5" />
             </button>
             <button 
                onClick={() => setLeftSidebarCollapsed(!isLeftSidebarCollapsed)} 
                className="hidden md:flex p-2 text-slate-500 shrink-0 hover:text-white transition-colors rounded-lg hover:bg-slate-800 justify-center items-center" 
                title={isLeftSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isLeftSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
             </button>
          </div>
        </div>
      </div>
    </>
  );
}
