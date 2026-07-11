import { useState } from 'react';
import { Sparkles, Send, Loader2, RefreshCw, MessageSquare, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface AIAssistantProps {
  context: string;
}

export function AIAssistant({ context }: AIAssistantProps) {
  const [activeTab, setActiveTab] = useState<'brainstorm' | 'improve'>('brainstorm');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const { isRightSidebarCollapsed, setRightSidebarCollapsed } = useStore();

  const submitPrompt = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult('');
    
    try {
      const endpoint = activeTab === 'brainstorm' ? '/api/ai/brainstorm' : '/api/ai/rewrite';
      // @ts-ignore
      const settings = window.__PROJECT_SETTINGS__ || window.__GLOBAL_SETTINGS__ || {};
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: activeTab === 'brainstorm' ? prompt : undefined, 
          text: activeTab === 'improve' ? prompt : undefined,
          instructions: activeTab === 'improve' ? 'Make it more dramatic and natural.' : undefined,
          context,
          model: settings.aiModel,
          temperature: settings.aiTemperature ? parseFloat(settings.aiTemperature) : undefined
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "hidden lg:flex lg:flex-col bg-slate-950 border-l border-slate-800 shrink-0 text-slate-300 transition-all duration-200 ease-in-out",
      isRightSidebarCollapsed ? "w-16" : "w-80"
    )}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 h-16">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
          {!isRightSidebarCollapsed && <span className="font-medium text-slate-100 shrink-0">AI Assistant</span>}
        </div>
        <button 
          onClick={() => setRightSidebarCollapsed(!isRightSidebarCollapsed)}
          className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors flex shrink-0"
          title={isRightSidebarCollapsed ? "Expand AI Assistant" : "Collapse AI Assistant"}
        >
          {isRightSidebarCollapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
      
      {!isRightSidebarCollapsed && (
        <>
          <div className="flex border-b border-slate-800 p-2 gap-2 shrink-0">
            <button 
              onClick={() => setActiveTab('brainstorm')}
              className={cn("flex-1 text-xs py-2 rounded-md transition-colors flex items-center justify-center gap-2", activeTab === 'brainstorm' ? "bg-slate-800 text-slate-100" : "hover:bg-slate-900 text-slate-400")}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              Brainstorm
            </button>
            <button 
              onClick={() => setActiveTab('improve')}
              className={cn("flex-1 text-xs py-2 rounded-md transition-colors flex items-center justify-center gap-2", activeTab === 'improve' ? "bg-slate-800 text-slate-100" : "hover:bg-slate-900 text-slate-400")}
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              Improve Text
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
            {result && (
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-300">
                {result}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
            <textarea 
              placeholder={activeTab === 'brainstorm' ? 'What needs brainstorming? (e.g. plot twists, themes...)' : 'Paste dialogue to rewrite...'}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-500 text-slate-100 placeholder:text-slate-500 min-h-[100px] custom-scrollbar"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   submitPrompt();
                }
              }}
            />
            <button 
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              onClick={submitPrompt}
              disabled={loading || !prompt.trim()}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Send className="w-4 h-4 shrink-0" />}
              {loading ? 'Thinking...' : 'Send to AI'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
