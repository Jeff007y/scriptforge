import { create } from 'zustand';

export interface ProjectSettings {
  theme?: string;
  autosaveFrequency?: string;
  aiModel?: string;
  aiTemperature?: string;
}

export interface Project {
  id: string;
  title: string;
  logline: string;
  updatedAt?: string;
  settings?: ProjectSettings;
}

interface ScriptForgeState {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isLeftSidebarCollapsed: boolean;
  setLeftSidebarCollapsed: (collapsed: boolean) => void;
  isRightSidebarCollapsed: boolean;
  setRightSidebarCollapsed: (collapsed: boolean) => void;
}

export const useStore = create<ScriptForgeState>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),
  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  isLeftSidebarCollapsed: false,
  setLeftSidebarCollapsed: (collapsed) => set({ isLeftSidebarCollapsed: collapsed }),
  isRightSidebarCollapsed: false,
  setRightSidebarCollapsed: (collapsed) => set({ isRightSidebarCollapsed: collapsed }),
}));
