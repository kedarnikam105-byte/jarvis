import React from 'react';
import { JarvisMode } from '../types/jarvis';

interface NeuralCoreProps {
  mode: JarvisMode;
  onPulseClick: () => void;
  memoryCount: number;
  learningScore: number;
}

const MODE_STYLES: Record<
  JarvisMode,
  {
    ring: string;
    glow: string;
    badge: string;
    label: string;
    barColor: string;
  }
> = {
  IDLE: {
    ring: 'border-cyan-400/50',
    glow: 'shadow-[0_0_45px_rgba(0,229,255,0.3)]',
    badge: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    label: 'STANDBY // READY',
    barColor: 'bg-cyan-400',
  },
  LISTENING: {
    ring: 'border-sky-300',
    glow: 'shadow-[0_0_55px_rgba(56,189,248,0.55)]',
    badge: 'text-sky-200 border-sky-400/60 bg-sky-500/20',
    label: 'AUDIO INPUT // LISTENING',
    barColor: 'bg-sky-300',
  },
  THINKING: {
    ring: 'border-cyan-300',
    glow: 'shadow-[0_0_50px_rgba(0,229,255,0.45)]',
    badge: 'text-cyan-200 border-cyan-400/60 bg-cyan-500/20',
    label: 'NEURAL PARSING...',
    barColor: 'bg-cyan-300',
  },
  LEARNING: {
    ring: 'border-violet-400',
    glow: 'shadow-[0_0_55px_rgba(167,139,250,0.5)]',
    badge: 'text-violet-200 border-violet-400/60 bg-violet-500/20',
    label: 'ADAPTIVE LEARNING',
    barColor: 'bg-violet-400',
  },
  EXECUTING: {
    ring: 'border-emerald-400',
    glow: 'shadow-[0_0_55px_rgba(52,211,153,0.5)]',
    badge: 'text-emerald-200 border-emerald-400/60 bg-emerald-500/20',
    label: 'EXECUTING COMMAND',
    barColor: 'bg-emerald-400',
  },
  AWAITING_PERMISSION: {
    ring: 'border-amber-400',
    glow: 'shadow-[0_0_55px_rgba(251,191,36,0.5)]',
    badge: 'text-amber-200 border-amber-400/60 bg-amber-500/20',
    label: 'AWAITING APPROVAL',
    barColor: 'bg-amber-400',
  },
  HALTED: {
    ring: 'border-rose-500',
    glow: 'shadow-[0_0_55px_rgba(244,63,94,0.55)]',
    badge: 'text-rose-200 border-rose-500/60 bg-rose-500/20',
    label: 'KILL SWITCH ACTIVE',
    barColor: 'bg-rose-500',
  },
};

export const NeuralCore: React.FC<NeuralCoreProps> = ({
  mode,
  onPulseClick,
  memoryCount,
  learningScore,
}) => {
  const style = MODE_STYLES[mode];
  const isActive = mode !== 'IDLE' && mode !== 'HALTED';

  return (
    <div className="hud-panel rounded-2xl p-4 flex flex-col items-center relative overflow-hidden">
      <div className="w-full flex items-center justify-between text-[10px] font-mono-tech tracking-widest text-cyan-400/70 mb-2">
        <span>CORE // MK-IV</span>
        <span>SYNC {learningScore}%</span>
      </div>

      <button
        type="button"
        onClick={onPulseClick}
        title="Click to toggle voice listening"
        className="group relative w-40 h-40 my-1 flex items-center justify-center rounded-full focus:outline-none cursor-pointer"
      >
        {/* Outer dashed HUD ring */}
        <div
          className={`absolute inset-0 rounded-full border border-dashed ${style.ring} animate-spin-slow opacity-70`}
        />
        {/* Middle segmented ring */}
        <div
          className={`absolute inset-3 rounded-full border-2 border-t-transparent border-b-transparent ${style.ring} animate-spin-reverse-slow`}
        />
        {/* Inner glowing reactor */}
        <div
          className={`relative w-24 h-24 rounded-full border ${style.ring} ${style.glow} bg-slate-950/90 flex flex-col items-center justify-center transition-all duration-300 group-hover:scale-105 ${
            isActive ? 'animate-pulse-ring' : ''
          }`}
        >
          <div className="flex items-end gap-1 h-7 mb-1">
            {[0.4, 0.85, 0.6, 1, 0.55, 0.9, 0.45].map((delay, i) => (
              <span
                key={i}
                className={`w-1 rounded-full ${style.barColor} transition-all`}
                style={{
                  height: isActive ? undefined : `${Math.round(delay * 55)}%`,
                  animation: isActive
                    ? `wave-bar ${0.55 + i * 0.11}s ease-in-out infinite`
                    : 'none',
                }}
              />
            ))}
          </div>
          <span className="font-display text-[10px] tracking-[0.22em] text-slate-200">
            JARVIS
          </span>
        </div>
      </button>

      <div
        className={`mt-2 px-3 py-1 rounded-full border text-[10px] font-mono-tech tracking-wider ${style.badge}`}
      >
        {style.label}
      </div>

      <div className="w-full grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-cyan-500/15 text-center">
        <div className="bg-slate-900/60 rounded-lg py-1.5 px-2 border border-slate-800/80">
          <div className="text-[10px] font-mono-tech text-slate-400">LEARNED NODES</div>
          <div className="text-sm font-display text-cyan-300">{memoryCount}</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg py-1.5 px-2 border border-slate-800/80">
          <div className="text-[10px] font-mono-tech text-slate-400">AUTONOMY</div>
          <div className="text-sm font-display text-emerald-300">GUARDED</div>
        </div>
      </div>
    </div>
  );
};
