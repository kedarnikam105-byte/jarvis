import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  Brain,
  CheckCircle2,
  Circle,
  Cpu,
  HelpCircle,
  Laptop,
  ListTodo,
  MessageSquareWarning,
  Mic,
  MicOff,
  Play,
  Plus,
  Radio,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { NeuralCore } from './components/NeuralCore';
import { WindowsSetupModal } from './components/WindowsSetupModal';
import { analyzeTeamsMessage, formatTeamsCallout } from './engine/teamsAgent';
import {
  craftPoliteTeamsMessage,
  getNextProactiveQuestion,
  processJarvisCommand,
} from './engine/jarvisBrain';
import {
  AgentConnectionState,
  AuditLogEntry,
  ChatMessage,
  JarvisMode,
  JarvisTask,
  LearnedMemory,
  LearningQuestion,
  PermissionKey,
  PermissionSettings,
  TeamsAgentConfig,
  TeamsAlert,
  TeamsDraftSpec,
  WindowsActionSpec,
} from './types/jarvis';

const STORAGE_KEYS = {
  tasks: 'jarvis_tasks_v1',
  memories: 'jarvis_memories_v1',
  permissions: 'jarvis_permissions_v1',
  audit: 'jarvis_audit_v1',
  teams: 'jarvis_teams_v1',
};

const DEFAULT_PERMISSIONS: PermissionSettings = {
  appLaunch: true,
  browserControl: true,
  fileSystem: false,
  systemPower: false,
  requireApprovalForHighRisk: true,
};

const INITIAL_TASKS: JarvisTask[] = [
  {
    id: 't-1',
    title: 'Morning system & inbox check',
    completed: false,
    priority: 'ROUTINE',
    scheduledTime: '09:00 AM',
    category: 'routine',
    createdAt: '08:30 AM',
  },
  {
    id: 't-2',
    title: 'Review today’s priority work items',
    completed: false,
    priority: 'HIGH',
    scheduledTime: '10:30 AM',
    category: 'work',
    createdAt: '08:31 AM',
  },
];

const INITIAL_MEMORIES: LearnedMemory[] = [
  {
    id: 'm-1',
    category: 'fact',
    key: 'operating_system',
    value: 'Windows Laptop Companion Target',
    confidence: 100,
    source: 'Initial setup',
    learnedAt: 'System Init',
    timesApplied: 1,
  },
];

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function App() {
  const [mode, setMode] = useState<JarvisMode>('IDLE');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'tasks' | 'memory' | 'permissions'>('tasks');
  const [setupOpen, setSetupOpen] = useState(false);
  const [agentState, setAgentState] = useState<AgentConnectionState>('DISCONNECTED');

  const [teamsConfig, setTeamsConfig] = useState<TeamsAgentConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.teams);
      return saved
        ? JSON.parse(saved)
        : {
            enabled: true,
            userName: 'Boss',
            callOutMentions: true,
            callOutDirectQuestions: true,
          };
    } catch {
      return {
        enabled: true,
        userName: 'Boss',
        callOutMentions: true,
        callOutDirectQuestions: true,
      };
    }
  });
  const [teamsAlerts, setTeamsAlerts] = useState<TeamsAlert[]>([]);
  const [teamsTestSender, setTeamsTestSender] = useState('Priya');
  const [teamsTestText, setTeamsTestText] = useState('');
  const [showTeamsTest, setShowTeamsTest] = useState(false);
  const [pendingTeamsRecipient, setPendingTeamsRecipient] = useState<string | null>(null);

  const [tasks, setTasks] = useState<JarvisTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.tasks);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [memories, setMemories] = useState<LearnedMemory[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.memories);
      return saved ? JSON.parse(saved) : INITIAL_MEMORIES;
    } catch {
      return INITIAL_MEMORIES;
    }
  });

  const [permissions, setPermissions] = useState<PermissionSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.permissions);
      return saved ? JSON.parse(saved) : DEFAULT_PERMISSIONS;
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.audit);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [askedKeys, setAskedKeys] = useState<Set<string>>(() => new Set());
  const [questionCustomInputs, setQuestionCustomInputs] = useState<Record<string, string>>({});
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTeachInput, setNewTeachInput] = useState('');
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());

  const getInitialGreeting = () => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${part}. J.A.R.V.I.S. Neural Command is online. Click the core or microphone to speak with me, or type your daily tasks below.`;
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-1',
      sender: 'jarvis',
      text: getInitialGreeting(),
      timestamp: nowTime(),
      question: getNextProactiveQuestion(INITIAL_MEMORIES, new Set()),
    },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingWindowsActionsRef = useRef<Map<string, string>>(new Map());
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<unknown>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.permissions, JSON.stringify(permissions));
  }, [permissions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(auditLogs.slice(0, 60)));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(teamsConfig));
  }, [teamsConfig]);

  // Clock ticker
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.03;
    utter.pitch = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en-(gb|us)/i.test(v.lang) && /natural|google|daniel|david|mark/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  };

  const addAudit = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    setAuditLogs((prev) => [{ id: uid(), timestamp: nowTime(), ...entry }, ...prev].slice(0, 60));
  };

  const handleIncomingTeamsMessage = (sender: string, channel: string, message: string) => {
    const alert = analyzeTeamsMessage(sender, channel, message, teamsConfig);
    if (!alert) {
      addAudit({
        action: `Teams msg ignored (${sender})`,
        target: message.slice(0, 40),
        mode: 'LEARNING',
        status: 'SUCCESS',
      });
      return;
    }

    setTeamsAlerts((prev) => [alert, ...prev].slice(0, 10));
    const callout = formatTeamsCallout(alert);
    addAudit({
      action: `Teams Callout (${alert.reason})`,
      target: `${sender}: ${message.slice(0, 40)}`,
      mode: 'WINDOWS_AGENT',
      status: 'SUCCESS',
    });
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        sender: 'jarvis',
        text: `TEAMS CALLOUT — ${callout}`,
        timestamp: nowTime(),
      },
    ]);
    speak(callout);
  };

  // WebSocket Windows Companion Bridge
  const connectWindowsAgent = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    setAgentState('CONNECTING');
    try {
      const ws = new WebSocket('ws://127.0.0.1:8765');
      wsRef.current = ws;

      ws.onopen = () => {
        setAgentState('CONNECTED');
        ws.send(JSON.stringify({ type: 'ping' }));
        addAudit({
          action: 'Windows Bridge Connected',
          target: 'ws://127.0.0.1:8765',
          mode: 'WINDOWS_AGENT',
          status: 'SUCCESS',
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'teams_message') {
            handleIncomingTeamsMessage(
              data.sender || 'Teammate',
              data.channel || 'Teams',
              data.message || ''
            );
          }
          if (data.type === 'action_result') {
            const messageId = pendingWindowsActionsRef.current.get(data.actionId);
            if (messageId) {
              const resultStatus = data.ok ? 'executed' : 'denied';
              setMessages((prev) => prev.map((m) =>
                m.id === messageId && m.actionRequest?.id === data.actionId
                  ? { ...m, actionRequest: { ...m.actionRequest, status: resultStatus } }
                  : m
              ));
              pendingWindowsActionsRef.current.delete(data.actionId);
              addAudit({
                action: data.ok ? 'Windows action completed' : 'Windows action failed',
                target: data.message || data.actionId,
                mode: 'WINDOWS_AGENT',
                status: data.ok ? 'SUCCESS' : 'DENIED',
              });
              setMode('IDLE');
            }
            setMessages((prev) => [
              ...prev,
              {
                id: uid(),
                sender: 'system',
                text: `[Windows Agent] ${data.message}`,
                timestamp: nowTime(),
              },
            ]);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        setAgentState('DISCONNECTED');
      };

      ws.onclose = () => {
        setAgentState('DISCONNECTED');
        if (wsRef.current === ws) wsRef.current = null;
        const failedActionIds = new Set(pendingWindowsActionsRef.current.keys());
        if (failedActionIds.size) {
          setMessages((prev) => prev.map((m) =>
            m.actionRequest && failedActionIds.has(m.actionRequest.id)
              ? { ...m, actionRequest: { ...m.actionRequest, status: 'denied' } }
              : m
          ));
          pendingWindowsActionsRef.current.clear();
          setMode('IDLE');
        }
        setMessages((prev) => [...prev, {
          id: uid(), sender: 'system',
          text: 'Windows companion disconnected. Restart start_jarvis_agent.bat, then reconnect here.',
          timestamp: nowTime(),
        }]);
      };
    } catch {
      setAgentState('DISCONNECTED');
    }
  };

  const disconnectWindowsAgent = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setAgentState('DISCONNECTED');
  };

  const executeWindowsAction = (action: WindowsActionSpec, messageId?: string) => {
    if (mode === 'HALTED') {
      addAudit({
        action: action.label,
        target: action.target,
        mode: 'BLOCKED',
        status: 'HALTED',
      });
      return;
    }

    const hasPermission = permissions[action.requiredPermission];
    if (!hasPermission) {
      updateActionStatus(messageId, action.id, 'blocked');
      addAudit({
        action: action.label,
        target: action.target,
        mode: 'BLOCKED',
        status: 'DENIED',
      });
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          sender: 'jarvis',
          text: `Action blocked: "${action.label}" requires the "${action.requiredPermission}" permission to be enabled in your Guardrails panel.`,
          timestamp: nowTime(),
        },
      ]);
      return;
    }

    setMode('EXECUTING');

    // Browser-native URL opening works directly even without Windows Agent!
    if (action.type === 'open_url' && agentState !== 'CONNECTED') {
      window.open(action.target, '_blank', 'noopener,noreferrer');
      updateActionStatus(messageId, action.id, 'executed');
      addAudit({
        action: action.label,
        target: action.target,
        mode: 'BROWSER_SANDBOX',
        status: 'SUCCESS',
      });
      setTimeout(() => setMode('IDLE'), 700);
      return;
    }

    // Browser fallback for Chrome / Edge when Windows Agent is not connected yet
    if (
      action.type === 'open_app' &&
      agentState !== 'CONNECTED' &&
      (action.target === 'chrome' || action.target === 'edge')
    ) {
      window.open('https://www.google.com', '_blank', 'noopener,noreferrer');
      updateActionStatus(messageId, action.id, 'executed');
      addAudit({
        action: `${action.label} (Browser Tab)`,
        target: 'https://www.google.com',
        mode: 'BROWSER_SANDBOX',
        status: 'SUCCESS',
      });
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          sender: 'system',
          text: `Opened a new browser tab. (Connect the Windows PC Agent in the top bar to launch desktop apps like VS Code, Notepad, or Chrome directly from Windows.)`,
          timestamp: nowTime(),
        },
      ]);
      setTimeout(() => setMode('IDLE'), 700);
      return;
    }

    // If local Windows Agent is connected, send real command
    if (agentState === 'CONNECTED' && wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'execute', action }));
      } catch {
        updateActionStatus(messageId, action.id, 'denied');
        setMessages((prev) => [...prev, {
          id: uid(), sender: 'system',
          text: 'Could not send the action to the Windows companion. Check that it is still running and reconnect.',
          timestamp: nowTime(),
        }]);
        setMode('IDLE');
        return;
      }
      if (messageId) pendingWindowsActionsRef.current.set(action.id, messageId);
      updateActionStatus(messageId, action.id, 'approved');
      addAudit({
        action: `${action.label} (sent to companion)`,
        target: action.target,
        mode: 'WINDOWS_AGENT',
        status: 'SUCCESS',
      });
      return;
    }

    // Otherwise simulate transparently & offer Windows Agent setup
    updateActionStatus(messageId, action.id, 'simulated');
    addAudit({
      action: action.label,
      target: action.target,
      mode: 'BROWSER_SANDBOX',
      status: 'SIMULATED',
    });
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        sender: 'system',
        text: `Simulated "${action.commandPreview}". Connect the Windows Companion Agent (top-right button) to execute this directly on your Windows laptop.`,
        timestamp: nowTime(),
      },
    ]);
    setTimeout(() => setMode('IDLE'), 700);
  };

  const updateActionStatus = (
    messageId: string | undefined,
    actionId: string,
    status: WindowsActionSpec['status']
  ) => {
    if (!messageId) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.actionRequest?.id === actionId
          ? { ...m, actionRequest: { ...m.actionRequest, status } }
          : m
      )
    );
  };

  const handleSendCommand = (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;

    if (mode === 'HALTED') {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          sender: 'system',
          text: 'Kill Switch is active. Click "RESUME" in the top bar to re-enable J.A.R.V.I.S.',
          timestamp: nowTime(),
        },
      ]);
      return;
    }

    if (!overrideText) setInput('');

    const userMsg: ChatMessage = {
      id: uid(),
      sender: 'user',
      text,
      timestamp: nowTime(),
    };

    // Multi-turn Microsoft Teams message drafting
    if (pendingTeamsRecipient) {
      const recipient = pendingTeamsRecipient;
      setPendingTeamsRecipient(null);
      const politeMessage = craftPoliteTeamsMessage(recipient, text);
      const draft: TeamsDraftSpec = {
        id: uid(),
        recipient,
        rawIntent: text,
        politeMessage,
        status: 'draft',
      };
      const reply = `Here is a polite Teams message for ${recipient}. You can send it to Microsoft Teams or copy it below:`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: uid(),
          sender: 'jarvis',
          text: reply,
          timestamp: nowTime(),
          teamsDraft: draft,
        },
      ]);
      speak(`${reply} ${politeMessage}`);
      setMode('IDLE');
      return;
    }

    setMode('THINKING');
    const response = processJarvisCommand(text, memories, tasks, permissions, askedKeys);

    if (response.askTeamsMessageFor) {
      setPendingTeamsRecipient(response.askTeamsMessageFor);
    }

    if (response.newTask) {
      setTasks((prev) => [response.newTask!, ...prev]);
    }

    if (response.learnedItems.length > 0) {
      setMemories((prev) => [...response.learnedItems, ...prev]);
      setMode('LEARNING');
      addAudit({
        action: `Learned ${response.learnedItems.length} node(s)`,
        target: response.learnedItems.map((l) => l.key).join(', '),
        mode: 'LEARNING',
        status: 'SUCCESS',
      });
    }

    if (response.question) {
      setAskedKeys((prev) => new Set(prev).add(response.question!.targetKey));
    }

    const jarvisMsgId = uid();
    const jarvisMsg: ChatMessage = {
      id: jarvisMsgId,
      sender: 'jarvis',
      text: response.reply,
      timestamp: nowTime(),
      createdTask: response.newTask,
      learnedItems: response.learnedItems,
      question: response.question,
      actionRequest: response.actionRequest,
      teamsDraft: response.teamsDraft,
    };

    setMessages((prev) => [...prev, userMsg, jarvisMsg]);
    speak(response.reply + (response.question ? ` ${response.question.question}` : ''));

    if (response.actionRequest) {
      const needsApproval =
        (response.actionRequest.risk === 'HIGH' && permissions.requireApprovalForHighRisk) ||
        !permissions[response.actionRequest.requiredPermission];
      if (!needsApproval && response.actionRequest.risk === 'LOW') {
        setTimeout(() => executeWindowsAction(response.actionRequest!, jarvisMsgId), 250);
      } else {
        setMode('AWAITING_PERMISSION');
      }
    } else {
      setTimeout(() => setMode('IDLE'), 900);
    }
  };

  const handleAnswerQuestion = (
    messageId: string,
    question: LearningQuestion,
    answerText: string
  ) => {
    const cleanAnswer = answerText.trim();
    if (!cleanAnswer) return;

    setMode('LEARNING');

    // Mark question answered in chat
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.question?.id === question.id
          ? { ...m, question: { ...m.question, answered: true, answer: cleanAnswer } }
          : m
      )
    );

    // Save into Neural Memory
    const newMem: LearnedMemory = {
      id: uid(),
      category: question.targetCategory,
      key: question.targetKey,
      value: cleanAnswer,
      confidence: 98,
      source: 'Interactive Q&A',
      learnedAt: nowTime(),
      timesApplied: 1,
    };
    setMemories((prev) => [newMem, ...prev.filter((m) => m.key !== question.targetKey)]);

    // If this question was about scheduling a specific task, update that task!
    if (question.relatedTaskId) {
      const timeMatch = cleanAnswer.match(/(\d{1,2}(?::\d{2})?\s?(?:AM|PM))/i);
      const isRoutine = /routine|daily|every day/i.test(cleanAnswer);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === question.relatedTaskId
            ? {
                ...t,
                scheduledTime: timeMatch ? timeMatch[1].toUpperCase() : t.scheduledTime,
                priority: isRoutine ? 'ROUTINE' : t.priority,
                category: isRoutine ? 'routine' : t.category,
              }
            : t
        )
      );
    }

    addAudit({
      action: `Learned: ${question.targetKey}`,
      target: cleanAnswer,
      mode: 'LEARNING',
      status: 'SUCCESS',
    });

    const followUpReply = `Memory updated: "${question.targetKey}" → "${cleanAnswer}". Thank you — I'll use this automatically going forward.`;
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        sender: 'jarvis',
        text: followUpReply,
        timestamp: nowTime(),
        learnedItems: [newMem],
      },
    ]);
    speak(followUpReply);
    setTimeout(() => setMode('IDLE'), 800);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop?.();
      setIsListening(false);
      setMode('IDLE');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          sender: 'system',
          text: 'Voice recognition is not supported in this browser. Please type your command or use Chrome/Edge on Windows.',
          timestamp: nowTime(),
        },
      ]);
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => {
      setIsListening(true);
      setMode('LISTENING');
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        handleSendCommand(transcript);
      }
    };
    rec.onerror = () => {
      setIsListening(false);
      setMode('IDLE');
    };
    rec.onend = () => {
      setIsListening(false);
      setMode((curr) => (curr === 'LISTENING' ? 'IDLE' : curr));
    };

    rec.start();
  };

  const learningScore = useMemo(() => {
    return Math.min(100, 35 + memories.length * 9);
  }, [memories.length]);

  const completedTasksCount = tasks.filter((t) => t.completed).length;

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleKillSwitch = () => {
    if (mode === 'HALTED') {
      setMode('IDLE');
      setMessages((prev) => [
        ...prev,
        { id: uid(), sender: 'system', text: 'J.A.R.V.I.S. resumed.', timestamp: nowTime() },
      ]);
    } else {
      setMode('HALTED');
      window.speechSynthesis?.cancel();
      addAudit({
        action: 'Emergency Kill Switch',
        target: 'All execution halted',
        mode: 'BLOCKED',
        status: 'HALTED',
      });
    }
  };

  return (
    <div className="min-h-screen hud-grid-bg text-slate-100 flex flex-col">
      {/* Top Tactical Header */}
      <header className="sticky top-0 z-30 border-b border-cyan-500/20 bg-[#040812]/90 backdrop-blur-xl px-4 lg:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(0,229,255,0.25)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg tracking-[0.18em] text-white">
                  J.A.R.V.I.S.
                </h1>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                  WINDOWS COMPANION
                </span>
              </div>
              <p className="text-[11px] font-mono-tech text-slate-400">
                ADAPTIVE DAILY TASK ENGINE // {clock}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDrawerTab('tasks');
                setDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:border-cyan-400/40 text-xs font-mono-tech text-slate-200 transition cursor-pointer"
            >
              <ListTodo className="w-3.5 h-3.5 text-cyan-400" />
              <span>TASKS ({tasks.length - completedTasksCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawerTab('memory');
                setDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:border-violet-400/40 text-xs font-mono-tech text-slate-200 transition cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5 text-violet-400" />
              <span>MEMORY ({memories.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawerTab('permissions');
                setDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:border-amber-400/40 text-xs font-mono-tech text-slate-200 transition cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">GUARDRAILS</span>
            </button>

            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono-tech transition cursor-pointer ${
                agentState === 'CONNECTED'
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-slate-900/80 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/15'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>
                {agentState === 'CONNECTED' ? 'PC: LIVE' : 'WINDOWS PC'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
                voiceEnabled
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={voiceEnabled ? 'Mute JARVIS voice' : 'Enable JARVIS voice'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleKillSwitch}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono-tech font-semibold transition cursor-pointer ${
                mode === 'HALTED'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-rose-500/15 border-rose-500/50 text-rose-300 hover:bg-rose-500/25'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>{mode === 'HALTED' ? 'RESUME' : 'KILL SWITCH'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Minimal Focused HUD Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: J.A.R.V.I.S. Core + Teams Watchdog Agent */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <NeuralCore
            mode={mode}
            onPulseClick={toggleVoiceInput}
            memoryCount={memories.length}
            learningScore={learningScore}
          />

          {/* Microsoft Teams Watchdog Agent under J.A.R.V.I.S. */}
          <div className="hud-panel rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono-tech text-cyan-300">
                <Radio
                  className={`w-4 h-4 ${
                    teamsConfig.enabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
                  }`}
                />
                <span>TEAMS WATCHDOG AGENT</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setTeamsConfig((prev) => ({ ...prev, enabled: !prev.enabled }))
                }
                className={`text-[10px] font-mono-tech px-2.5 py-0.5 rounded-full border cursor-pointer transition ${
                  teamsConfig.enabled
                    ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15'
                    : 'text-slate-400 border-slate-700 bg-slate-900'
                }`}
              >
                {teamsConfig.enabled ? 'ACTIVE' : 'PAUSED'}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono-tech text-slate-400 block">
                WATCH FOR YOUR NAME / @TAG
              </label>
              <input
                type="text"
                value={teamsConfig.userName}
                onChange={(e) =>
                  setTeamsConfig((prev) => ({ ...prev, userName: e.target.value }))
                }
                placeholder="Enter your name (e.g. Rahul)"
                className="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Calls out aloud whenever a new Teams message{' '}
              <span className="text-cyan-300">@{teamsConfig.userName || 'tags'}</span> you,
              mentions your name, or asks you directly.
            </p>

            {teamsAlerts.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-400/35 p-2.5 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono-tech text-amber-300">
                  <MessageSquareWarning className="w-3.5 h-3.5" />
                  <span>LAST CALLOUT • {teamsAlerts[0].timestamp}</span>
                </div>
                <div className="text-slate-200 font-medium truncate">
                  {teamsAlerts[0].sender}: {teamsAlerts[0].message}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowTeamsTest((s) => !s)}
                className="text-[11px] font-mono-tech text-cyan-300 hover:text-cyan-200 underline underline-offset-4 cursor-pointer"
              >
                {showTeamsTest ? 'Hide Simulator' : 'Test Incoming Teams Msg'}
              </button>
              <button
                type="button"
                onClick={() =>
                  handleIncomingTeamsMessage(
                    'Priya',
                    'Engineering',
                    `@${teamsConfig.userName || 'Boss'} can you check the latest deployment?`
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-[11px] font-mono-tech text-cyan-200 cursor-pointer"
              >
                Quick Ping
              </button>
            </div>

            {showTeamsTest && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <input
                  type="text"
                  value={teamsTestSender}
                  onChange={(e) => setTeamsTestSender(e.target.value)}
                  placeholder="Sender name"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <input
                  type="text"
                  value={teamsTestText}
                  onChange={(e) => setTeamsTestText(e.target.value)}
                  placeholder={`e.g. Hey @${teamsConfig.userName || 'Boss'}, are you free?`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!teamsTestText.trim()) return;
                    handleIncomingTeamsMessage(
                      teamsTestSender || 'Teammate',
                      'Teams Chat',
                      teamsTestText.trim()
                    );
                    setTeamsTestText('');
                  }}
                  className="w-full py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-mono-tech cursor-pointer"
                >
                  Send to Teams Agent
                </button>
              </div>
            )}
          </div>
        </section>

        {/* MAIN STAGE: J.A.R.V.I.S. Command Console */}
        <section className="lg:col-span-8 hud-panel rounded-2xl flex flex-col h-[78vh] min-h-[540px] overflow-hidden">
          {/* Console Header */}
          <div className="px-4 py-3 border-b border-cyan-500/15 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono-tech tracking-wider text-cyan-200">
                NEURAL COMMAND CONSOLE
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSendCommand('Ask me a question to learn my routine')}
              className="flex items-center gap-1.5 text-[11px] font-mono-tech px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/40 text-violet-200 transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>ASK ME TO LEARN</span>
            </button>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-50 rounded-br-sm'
                      : msg.sender === 'system'
                      ? 'bg-slate-900/90 border border-slate-700/80 text-slate-300 font-mono-tech text-xs'
                      : 'bg-slate-900/80 border border-cyan-500/20 text-slate-100 rounded-bl-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[10px] font-mono-tech opacity-65">
                    <span>
                      {msg.sender === 'user'
                        ? 'YOU'
                        : msg.sender === 'system'
                        ? 'SYSTEM'
                        : 'J.A.R.V.I.S.'}
                    </span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p>{msg.text}</p>

                  {/* Task Created Pill */}
                  {msg.createdTask && (
                    <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-xs text-emerald-200">
                      <ListTodo className="w-4 h-4 shrink-0" />
                      <span className="font-medium">{msg.createdTask.title}</span>
                      {msg.createdTask.scheduledTime && (
                        <span className="ml-auto font-mono-tech text-[10px] px-2 py-0.5 rounded bg-emerald-500/20">
                          {msg.createdTask.scheduledTime}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Learned Memory Pill */}
                  {msg.learnedItems && msg.learnedItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.learnedItems.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/35 text-[11px] text-violet-200"
                        >
                          <Brain className="w-3 h-3" />
                          Learned: {item.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Teams Polite Message Draft Card */}
                  {msg.teamsDraft && (
                    <div className="mt-3 rounded-xl bg-cyan-950/35 border border-cyan-400/35 p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono-tech text-cyan-300">
                        <span>TEAMS MESSAGE DRAFT // TO: {msg.teamsDraft.recipient.toUpperCase()}</span>
                        <span className="uppercase text-emerald-300">{msg.teamsDraft.status}</span>
                      </div>
                      <p className="text-xs text-slate-100 bg-slate-950/75 border border-slate-800 rounded-lg p-2.5 leading-relaxed">
                        {msg.teamsDraft.politeMessage}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(msg.teamsDraft!.politeMessage);
                            const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?message=${encodeURIComponent(
                              msg.teamsDraft!.politeMessage
                            )}`;
                            window.open(teamsUrl, '_blank', 'noopener,noreferrer');
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id && m.teamsDraft
                                  ? { ...m, teamsDraft: { ...m.teamsDraft, status: 'sent' } }
                                  : m
                              )
                            );
                            addAudit({
                              action: `Teams Message to ${msg.teamsDraft!.recipient}`,
                              target: msg.teamsDraft!.politeMessage.slice(0, 48),
                              mode: 'BROWSER_SANDBOX',
                              status: 'SUCCESS',
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-100 text-xs font-medium cursor-pointer"
                        >
                          Open Teams &amp; Copy Message
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(msg.teamsDraft!.politeMessage);
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id && m.teamsDraft
                                  ? { ...m, teamsDraft: { ...m.teamsDraft, status: 'copied' } }
                                  : m
                              )
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs cursor-pointer"
                        >
                          Copy Only
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Permission / Action Execution Card */}
                  {msg.actionRequest && (
                    <div className="mt-3 rounded-xl bg-slate-950/80 border border-amber-400/35 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <span>{msg.actionRequest.label}</span>
                        </div>
                        <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-400/30">
                          RISK: {msg.actionRequest.risk}
                        </span>
                      </div>
                      <div className="font-mono-tech text-[11px] text-cyan-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 overflow-x-auto">
                        {msg.actionRequest.commandPreview}
                      </div>

                      {msg.actionRequest.status === 'pending' ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => executeWindowsAction(msg.actionRequest!, msg.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-medium transition cursor-pointer"
                          >
                            Approve &amp; Execute
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateActionStatus(msg.id, msg.actionRequest!.id, 'denied');
                              setMode('IDLE');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] font-mono-tech text-slate-400 uppercase">
                          Status: <span className="text-cyan-300">{msg.actionRequest.status}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proactive Learning Question Card */}
                  {msg.question && (
                    <div className="mt-3 rounded-xl bg-violet-950/35 border border-violet-400/40 p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono-tech text-violet-300">
                        <span>LEARNING QUESTION // {msg.question.context}</span>
                      </div>
                      <p className="text-xs font-medium text-white">{msg.question.question}</p>

                      {msg.question.answered ? (
                        <div className="text-xs text-emerald-300 font-mono-tech">
                          ✓ Learned: {msg.question.answer}
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.question.quickOptions.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleAnswerQuestion(msg.id, msg.question!, opt)}
                                className="px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/35 border border-violet-400/40 text-violet-100 text-[11px] transition cursor-pointer"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={questionCustomInputs[msg.question.id] ?? ''}
                              onChange={(e) =>
                                setQuestionCustomInputs((prev) => ({
                                  ...prev,
                                  [msg.question!.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAnswerQuestion(
                                    msg.id,
                                    msg.question!,
                                    questionCustomInputs[msg.question!.id] ?? ''
                                  );
                                }
                              }}
                              placeholder="Or type your own answer..."
                              className="flex-1 bg-slate-950/80 border border-violet-400/30 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleAnswerQuestion(
                                  msg.id,
                                  msg.question!,
                                  questionCustomInputs[msg.question!.id] ?? ''
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-violet-500/30 hover:bg-violet-500/45 text-white text-xs cursor-pointer"
                            >
                              Teach
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Command Chips */}
          <div className="px-4 py-2 border-t border-cyan-500/10 bg-slate-950/50 flex items-center gap-1.5 overflow-x-auto">
            {[
              'Hey Jarvis',
              'Plan my day',
              'Remind me to send report at 5pm',
              'When I say Focus Mode, open VS Code',
              'Open Chrome',
              'Check system info',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendCommand(chip)}
                className="shrink-0 text-[11px] font-mono-tech px-2.5 py-1 rounded-full bg-slate-900 hover:bg-cyan-500/15 border border-slate-700 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-200 transition cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Command Input Bar */}
          <div className="p-3 border-t border-cyan-500/20 bg-slate-950/80 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                isListening
                  ? 'bg-sky-500/30 border-sky-400 text-sky-200 animate-pulse'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200'
              }`}
              title="Speak command"
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendCommand();
              }}
              placeholder="Tell J.A.R.V.I.S. a task, teach a rule, or command Windows..."
              className="flex-1 bg-slate-900/90 border border-slate-700 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => handleSendCommand()}
              className="px-4 py-2.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-100 flex items-center gap-1.5 text-xs font-mono-tech font-semibold transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">SEND</span>
            </button>
          </div>
        </section>

      </main>

      {/* Slide-Over Drawer for Tasks, Memory & Guardrails (keeps main HUD clean) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-md h-full flex flex-col border-l border-cyan-500/25">
            <div className="px-4 py-3 border-b border-cyan-500/15 flex items-center justify-between bg-slate-950/60">
              <span className="font-display text-xs tracking-widest text-cyan-200">
                J.A.R.V.I.S. WORKSPACE
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

          {/* Tabs */}
          <div className="grid grid-cols-3 border-b border-cyan-500/15 bg-slate-950/50 text-xs font-mono-tech">
            <button
              type="button"
              onClick={() => setDrawerTab('tasks')}
              className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                drawerTab === 'tasks'
                  ? 'border-cyan-400 text-cyan-200 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>TASKS ({tasks.length - completedTasksCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab('memory')}
              className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                drawerTab === 'memory'
                  ? 'border-violet-400 text-violet-200 bg-violet-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>MEMORY ({memories.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab('permissions')}
              className={`py-3 flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                drawerTab === 'permissions'
                  ? 'border-emerald-400 text-emerald-200 bg-emerald-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>GUARDRAILS</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {drawerTab === 'tasks' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskInput.trim()) {
                        handleSendCommand(`Add task: ${newTaskInput.trim()}`);
                        setNewTaskInput('');
                      }
                    }}
                    placeholder="Quick add daily task..."
                    className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTaskInput.trim()) return;
                      handleSendCommand(`Add task: ${newTaskInput.trim()}`);
                      setNewTaskInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 cursor-pointer"
                    title="Add & let JARVIS learn"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No tasks yet. Tell J.A.R.V.I.S. what you need to do today.
                  </p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-xl p-3 border transition flex items-start gap-2.5 ${
                        task.completed
                          ? 'bg-slate-900/40 border-slate-800/70 opacity-60'
                          : 'bg-slate-900/80 border-slate-700/80 hover:border-cyan-500/35'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setTasks((prev) =>
                            prev.map((t) =>
                              t.id === task.id ? { ...t, completed: !t.completed } : t
                            )
                          )
                        }
                        className="mt-0.5 text-cyan-400 hover:text-cyan-200 cursor-pointer"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs font-medium ${
                            task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span
                            className={`text-[10px] font-mono-tech px-1.5 py-0.5 rounded ${
                              task.priority === 'HIGH'
                                ? 'bg-rose-500/20 text-rose-300'
                                : task.priority === 'ROUTINE'
                                ? 'bg-violet-500/20 text-violet-300'
                                : 'bg-cyan-500/15 text-cyan-300'
                            }`}
                          >
                            {task.priority}
                          </span>
                          {task.scheduledTime && (
                            <span className="text-[10px] font-mono-tech text-slate-400">
                              {task.scheduledTime}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {!task.completed && (
                          <button
                            type="button"
                            onClick={() => handleSendCommand(task.title)}
                            className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 cursor-pointer"
                            title="Ask JARVIS to help execute this task"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setTasks((prev) => prev.filter((t) => t.id !== task.id))}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-300 cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {drawerTab === 'memory' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTeachInput}
                    onChange={(e) => setNewTeachInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTeachInput.trim()) {
                        handleSendCommand(`Remember that ${newTeachInput.trim()}`);
                        setNewTeachInput('');
                      }
                    }}
                    placeholder="Teach JARVIS a new fact or rule..."
                    className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTeachInput.trim()) return;
                      handleSendCommand(`Remember that ${newTeachInput.trim()}`);
                      setNewTeachInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-200 text-xs font-mono-tech cursor-pointer"
                  >
                    TEACH
                  </button>
                </div>

                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="rounded-xl p-3 bg-slate-900/80 border border-violet-500/25 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono-tech uppercase px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-400/30">
                        {mem.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono-tech text-emerald-300">
                          {mem.confidence}% CONF
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setMemories((prev) => prev.filter((m) => m.id !== mem.id))
                          }
                          className="text-slate-500 hover:text-rose-300 cursor-pointer"
                          title="Forget memory"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-white">{mem.value}</div>
                    <div className="text-[10px] font-mono-tech text-slate-500">
                      Key: {mem.key} • Learned {mem.learnedAt}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {drawerTab === 'permissions' && (
              <div className="space-y-4">
                <div className="rounded-xl p-3.5 bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <div className="text-xs font-mono-tech text-cyan-300">LAPTOP PERMISSIONS</div>
                  {(
                    [
                      ['appLaunch', 'Launch Windows Apps'],
                      ['browserControl', 'Browser & Search'],
                      ['fileSystem', 'Create / Clean Files'],
                      ['systemPower', 'System Info & Lock PC'],
                      ['requireApprovalForHighRisk', 'Ask Before High-Risk'],
                    ] as Array<[PermissionKey, string]>
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer select-none"
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => togglePermission(key)}
                        className={`w-10 h-5 rounded-full transition relative cursor-pointer ${
                          permissions[key]
                            ? 'bg-cyan-500/40 border border-cyan-400'
                            : 'bg-slate-800 border border-slate-700'
                        }`}
                      >
                        <span
                          className={`block w-3.5 h-3.5 rounded-full transition-transform ${
                            permissions[key]
                              ? 'translate-x-5 bg-cyan-300'
                              : 'translate-x-1 bg-slate-500'
                          }`}
                        />
                      </button>
                    </label>
                  ))}
                </div>
                <div className="space-y-2.5">
                  <div className="text-xs font-mono-tech text-emerald-300">ACTION AUDIT LOG</div>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    No actions logged yet. Every command, learning event, and permission check
                    appears here.
                  </p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl p-2.5 bg-slate-900/70 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono-tech text-[10px]">
                        <span className="text-slate-400">{log.timestamp}</span>
                        <span
                          className={
                            log.status === 'SUCCESS'
                              ? 'text-emerald-400'
                              : log.status === 'SIMULATED'
                              ? 'text-cyan-300'
                              : 'text-rose-400'
                          }
                        >
                          {log.status} // {log.mode}
                        </span>
                      </div>
                      <div className="text-slate-200 font-medium">{log.action}</div>
                      <div className="text-[11px] font-mono-tech text-slate-400 truncate">
                        {log.target}
                      </div>
                    </div>
                  ))
                )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      <WindowsSetupModal
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        connectionState={agentState}
        onConnect={connectWindowsAgent}
        onDisconnect={disconnectWindowsAgent}
      />
    </div>
  );
}
