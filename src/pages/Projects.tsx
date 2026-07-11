import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, auth, signOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, Folder, LogOut, Clapperboard, Settings, LayoutDashboard, Search, Clock, FileText, Users, Type } from 'lucide-react';
import { useStore } from '../store';
import { Sidebar } from '../components/Sidebar';
import { MobileMenuButton } from '../components/MobileMenuButton';

export function Projects() {
  const navigate = useNavigate();
  const { projects, setProjects } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'projects'),
          where('ownerId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const projData = snapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          logline: doc.data().logline,
          updatedAt: doc.data().updatedAt,
        }));
        
        projData.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        setProjects(projData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, [setProjects]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never';
    const d = new Date(isoString);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    ).replace('0 days ago', 'Today');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Global Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-900">
        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <h1 className="text-2xl font-sans tracking-tight font-medium text-white flex items-center gap-2">
              <MobileMenuButton />
              All Projects
            </h1>
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search scripts..." 
                className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 transition-all z-10 relative"
              />
            </div>
          </div>

          <section>
            
            {loading ? (
              <div className="text-slate-500 font-mono text-sm py-8">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="text-slate-500 font-mono py-8 bg-slate-950/50 rounded-2xl border border-slate-800 border-dashed flex flex-col items-center justify-center">
                 <Clapperboard className="w-8 h-8 text-slate-700 mb-3" />
                 <p>No scripts found. Go to Dashboard to create your first project.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    onClick={() => navigate(`/editor/${project.id}`)}
                    className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 cursor-pointer transition-all flex flex-col group h-44 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-blue-500 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(project.updatedAt)}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors text-lg truncate w-full mb-1">{project.title}</h3>
                    <p className="text-slate-500 text-xs mt-auto line-clamp-2">{project.logline || 'Add a logline to describe your story...'}</p>
                    
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800/50">
                       <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clapperboard className="w-3.5 h-3.5" />
                          <span>~12 Scenes</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>~4 Characters</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
