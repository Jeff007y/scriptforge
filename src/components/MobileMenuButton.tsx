import { Menu } from 'lucide-react';
import { useStore } from '../store';

export function MobileMenuButton() {
  const { setMobileMenuOpen } = useStore();
  
  return (
    <button 
      onClick={() => setMobileMenuOpen(true)}
      className="md:hidden p-2 -ml-2 mr-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
      title="Open Menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
