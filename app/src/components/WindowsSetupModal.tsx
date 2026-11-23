import React, { useState } from 'react';
import { Check, Copy, Download, Laptop, ShieldCheck, Terminal, X } from 'lucide-react';
import {
  WINDOWS_AGENT_BAT,
  WINDOWS_AGENT_JS,
  WINDOWS_INSTALL_BAT,
} from '../engine/windowsAgentTemplate';
import { AgentConnectionState } from '../types/jarvis';

interface WindowsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: AgentConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const WindowsSetupModal: React.FC<WindowsSetupModalProps> = ({
  isOpen,
  onClose,
  connectionState,
  onConnect,
  onDisconnect,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyCommands = () => {
    navigator.clipboard.writeText('Run install_requirements.bat, then start_jarvis_agent.bat');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="hud-panel rounded-2xl max-w-2xl w-full p-6 relative border border-cyan-400/30 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-lg text-white tracking-wide">
              WINDOWS 10/11 COMPANION BRIDGE
            </h2>
            <p className="text-xs text-slate-400">
              Connect this HUD to your Windows laptop via local WebSocket (ws://127.0.0.1:8765)
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 mb-4 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-cyan-300 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Permission-First Architecture</span>
          </div>
          <p className="leading-relaxed text-slate-400">
            Browsers cannot directly launch Windows apps or modify local files for security reasons.
            Running the lightweight local companion below on your Windows laptop lets J.A.R.V.I.S.
            execute <span className="text-slate-200">only the actions you approve</span> in this interface.
          </p>
          <p className="leading-relaxed text-slate-400">
            This companion uses Node.js and does not need Python. From the extracted app folder, run
            <span className="text-slate-200"> setup_windows.bat</span> once, then
            <span className="text-slate-200"> run_jarvis.bat</span>. The full setup can install Node.js LTS with winget.
          </p>
        </div>

        <div className="space-y-3 mb-5">
          <div className="text-xs font-mono-tech text-cyan-400 uppercase tracking-wider">
            Step 1 — Download Companion Files
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => downloadFile('install_requirements.bat', WINDOWS_INSTALL_BAT)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-xs font-medium transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download install_requirements.bat
            </button>
            <button
              type="button"
              onClick={() => downloadFile('jarvis_windows_agent.mjs', WINDOWS_AGENT_JS)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-medium transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download jarvis_windows_agent.mjs
            </button>
            <button
              type="button"
              onClick={() => downloadFile('start_jarvis_agent.bat', WINDOWS_AGENT_BAT)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download start_jarvis_agent.bat
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <div className="text-xs font-mono-tech text-cyan-400 uppercase tracking-wider">
            Step 2 — Install requirements, then double-click start_jarvis_agent.bat
          </div>
          <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 font-mono-tech text-xs text-emerald-300">
            <div className="flex items-center gap-2 overflow-x-auto">
              <Terminal className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="whitespace-nowrap">
                Run install_requirements.bat, then start_jarvis_agent.bat
              </span>
            </div>
            <button
              type="button"
              onClick={copyCommands}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
              title="Copy command"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="text-xs font-mono-tech">
            Bridge Status:{' '}
            <span
              className={
                connectionState === 'CONNECTED'
                  ? 'text-emerald-400'
                  : connectionState === 'CONNECTING'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }
            >
              {connectionState}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {connectionState === 'CONNECTED' ? (
              <button
                type="button"
                onClick={onDisconnect}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-medium cursor-pointer"
              >
                Disconnect Bridge
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-medium cursor-pointer"
              >
                Connect to ws://127.0.0.1:8765
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
