import {
  JarvisTask,
  LearnedMemory,
  LearningQuestion,
  MemoryCategory,
  PermissionSettings,
  TaskPriority,
  TeamsDraftSpec,
  WindowsActionSpec,
} from '../types/jarvis';

export interface BrainResponse {
  reply: string;
  newTask?: JarvisTask;
  learnedItems: LearnedMemory[];
  question?: LearningQuestion;
  actionRequest?: WindowsActionSpec;
  shouldExecuteBriefing?: boolean;
  askTeamsMessageFor?: string;
  teamsDraft?: TeamsDraftSpec;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const KNOWN_APPS: Record<string, { label: string; target: string }> = {
  chrome: { label: 'Google Chrome', target: 'chrome' },
  'google chrome': { label: 'Google Chrome', target: 'chrome' },
  edge: { label: 'Microsoft Edge', target: 'edge' },
  notepad: { label: 'Notepad', target: 'notepad' },
  calculator: { label: 'Calculator', target: 'calculator' },
  calc: { label: 'Calculator', target: 'calculator' },
  vscode: { label: 'Visual Studio Code', target: 'vscode' },
  'vs code': { label: 'Visual Studio Code', target: 'vscode' },
  code: { label: 'Visual Studio Code', target: 'vscode' },
  explorer: { label: 'File Explorer', target: 'explorer' },
  terminal: { label: 'Windows Terminal', target: 'terminal' },
  cmd: { label: 'Command Prompt', target: 'cmd' },
  spotify: { label: 'Spotify', target: 'spotify' },
  outlook: { label: 'Microsoft Outlook', target: 'outlook' },
};

const INTERVIEW_TOPICS: Array<{
  key: string;
  category: MemoryCategory;
  question: string;
  context: string;
  quickOptions: string[];
}> = [
  {
    key: 'preferred_browser',
    category: 'preference',
    question: 'Which browser should I open by default on your Windows laptop?',
    context: 'Learning your Windows app defaults',
    quickOptions: ['Google Chrome', 'Microsoft Edge', 'Brave', 'Firefox'],
  },
  {
    key: 'work_start_time',
    category: 'schedule',
    question: 'What time do you usually start your daily work or study session?',
    context: 'Calibrating your daily briefing schedule',
    quickOptions: ['08:00 AM', '09:00 AM', '09:30 AM', '10:00 AM'],
  },
  {
    key: 'primary_editor',
    category: 'preference',
    question: 'When you ask me to open your coding or notes workspace, which app do you prefer?',
    context: 'Learning your workspace tools',
    quickOptions: ['VS Code', 'Notepad', 'Notion (Web)', 'Windows Terminal'],
  },
  {
    key: 'morning_routine',
    category: 'routine',
    question: 'What is the first thing you like to do each morning when you sit at your laptop?',
    context: 'Building your Morning Autopilot routine',
    quickOptions: ['Check emails & tasks', 'Open VS Code & music', 'Read tech news', 'Review calendar'],
  },
  {
    key: 'focus_music',
    category: 'preference',
    question: 'Do you want me to launch music or ambient audio when you enter Focus Mode?',
    context: 'Personalizing Focus Mode automation',
    quickOptions: ['Open Spotify', 'Lo-fi on YouTube', 'Keep it silent'],
  },
];

export function getNextProactiveQuestion(
  memories: LearnedMemory[],
  askedKeys: Set<string>
): LearningQuestion | undefined {
  const knownKeys = new Set(memories.map((m) => m.key.toLowerCase()));
  const next = INTERVIEW_TOPICS.find(
    (t) => !knownKeys.has(t.key.toLowerCase()) && !askedKeys.has(t.key)
  );
  if (!next) return undefined;
  return {
    id: uid(),
    question: next.question,
    context: next.context,
    targetKey: next.key,
    targetCategory: next.category,
    quickOptions: next.quickOptions,
  };
}

function extractTime(input: string): string | undefined {
  const match = input.match(/\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d{1,2}:\d{2})\b/i);
  return match ? match[1].toUpperCase() : undefined;
}

function makeMemory(
  category: MemoryCategory,
  key: string,
  value: string,
  source: string,
  confidence = 92
): LearnedMemory {
  return {
    id: uid(),
    category,
    key,
    value,
    confidence,
    source,
    learnedAt: nowTime(),
    timesApplied: 1,
  };
}

export function craftPoliteTeamsMessage(recipient: string, rawIntent: string): string {
  const clean = rawIntent.trim();
  const lower = clean.toLowerCase();

  if (/\b(call|hop on a call|quick call|voice call|video call|meet)\b/i.test(lower)) {
    return `Hi ${recipient}, hope you're doing well! Whenever you have a few minutes free, could we please hop on a quick call? Please let me know what time works best for you. Thank you!`;
  }

  if (/\b(late|running late|delay|5 min|10 min)\b/i.test(lower)) {
    return `Hi ${recipient}, so sorry for the slight delay — I'm running a few minutes behind and will join you right away. Thank you for your patience!`;
  }

  if (/\b(status|update|progress|report|check)\b/i.test(lower)) {
    return `Hi ${recipient}, hope your day is going great! Whenever you get a moment, could you please share a quick update on ${clean.replace(/^(?:check|ask about|get)\s+/i, '')}? Thanks so much!`;
  }

  return `Hi ${recipient}, hope you're doing well! ${clean.charAt(0).toUpperCase() + clean.slice(1)}. Please let me know whenever you get a moment. Thanks so much!`;
}

export function processJarvisCommand(
  rawInput: string,
  memories: LearnedMemory[],
  tasks: JarvisTask[],
  permissions: PermissionSettings,
  askedKeys: Set<string>
): BrainResponse {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const learnedItems: LearnedMemory[] = [];

  // 0b. Microsoft Teams message composer ("drop message to Gomathi on teams")
  const teamsDirectMatch = input.match(
    /(?:drop|send|write|ping|message)\s+(?:a\s+)?(?:message\s+)?(?:to\s+)?([a-zA-Z0-9_.-]+)(?:\s+on\s+teams|\s+in\s+teams)?(?:\s+(?:saying|that|to)\s+(.+))?$/i
  );
  if (
    teamsDirectMatch &&
    (/\bteams\b/i.test(lower) || /^(?:drop|ping|message)\s+/i.test(lower))
  ) {
    const recipient =
      teamsDirectMatch[1].charAt(0).toUpperCase() + teamsDirectMatch[1].slice(1);
    const inlineMsg = teamsDirectMatch[2]?.trim();

    if (inlineMsg) {
      const politeMessage = craftPoliteTeamsMessage(recipient, inlineMsg);
      return {
        reply: `I've drafted a polite Teams message for ${recipient}. Review and send it below:`,
        learnedItems,
        teamsDraft: {
          id: uid(),
          recipient,
          rawIntent: inlineMsg,
          politeMessage,
          status: 'draft',
        },
      };
    }

    return {
      reply: `Sure — what message would you like me to drop to ${recipient} on Microsoft Teams?`,
      learnedItems,
      askTeamsMessageFor: recipient,
    };
  }

  // 0. Greetings & conversational check-ins
  if (
    /^(?:hi|hello|hey|good morning|good afternoon|good evening|yo|jarvis|hey jarvis|hi jarvis|hello jarvis|how are you|greet me)\b[!.?]*$/i.test(
      lower
    )
  ) {
    const hour = new Date().getHours();
    const timeGreeting =
      hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const pending = tasks.filter((t) => !t.completed);
    const nameMemory = memories.find((m) =>
      /^(?:user_name|my name|name)$/i.test(m.key)
    );
    const honorific = nameMemory ? nameMemory.value : 'sir';
    const nextQ = getNextProactiveQuestion(memories, askedKeys);

    return {
      reply: `${timeGreeting}, ${honorific}. J.A.R.V.I.S. is online and listening. You have ${pending.length} active task${
        pending.length === 1 ? '' : 's'
      } in your queue today. Tell me what you'd like to do or teach me next.`,
      learnedItems,
      question: nextQ,
    };
  }

  // 1. Check custom learned rules first!
  const matchedRule = memories.find(
    (m) =>
      m.category === 'rule' &&
      lower.includes(m.key.replace(/^rule:/i, '').trim().toLowerCase())
  );
  if (matchedRule) {
    const ruleActionText = matchedRule.value;
    const appMatch = Object.keys(KNOWN_APPS).find((appKey) =>
      ruleActionText.toLowerCase().includes(appKey)
    );
    const actionRequest: WindowsActionSpec | undefined = appMatch
      ? {
          id: uid(),
          type: 'open_app',
          label: `Launch ${KNOWN_APPS[appMatch].label}`,
          commandPreview: `windows-agent: open_app("${KNOWN_APPS[appMatch].target}")`,
          target: KNOWN_APPS[appMatch].target,
          risk: 'LOW',
          requiredPermission: 'appLaunch',
          status: 'pending',
        }
      : undefined;

    return {
      reply: `Recognized your learned rule "${matchedRule.key}". Executing: ${matchedRule.value}.`,
      learnedItems: [],
      actionRequest,
    };
  }

  // 2. Teach / Remember explicit statements
  const ruleMatch = input.match(/when i say\s+["']?(.+?)["']?(?:,|\s+then|\s+do)\s+(.+)/i);
  if (ruleMatch) {
    const trigger = ruleMatch[1].trim();
    const action = ruleMatch[2].trim();
    const mem = makeMemory('rule', trigger, action, 'Direct rule training', 96);
    learnedItems.push(mem);
    return {
      reply: `Neural rule stored. Whenever you say "${trigger}", I will ${action}.`,
      learnedItems,
      question: {
        id: uid(),
        question: `Should "${trigger}" also automatically create a focused task in your daily queue?`,
        context: `Refining rule: ${trigger}`,
        targetKey: `rule_task_${trigger.toLowerCase().replace(/\s+/g, '_')}`,
        targetCategory: 'rule',
        quickOptions: ['Yes, add a focus task', 'No, just run the action'],
      },
    };
  }

  const rememberMatch = input.match(/^(?:remember(?:\s+that)?|learn(?:\s+that)?|note(?:\s+that)?)\s+(.+)/i);
  if (rememberMatch) {
    const fact = rememberMatch[1].trim();
    const isSchedule = /\b(every|morning|evening|night|am|pm|daily|work|sleep|wake)\b/i.test(fact);
    const isPref = /\b(prefer|favorite|like|love|hate|use|always|never)\b/i.test(fact);
    const category: MemoryCategory = isSchedule ? 'schedule' : isPref ? 'preference' : 'fact';
    const shortKey = fact.split(/\s+/).slice(0, 4).join(' ');
    const mem = makeMemory(category, shortKey, fact, 'User taught directly', 94);
    learnedItems.push(mem);

    return {
      reply: `Got it — I've saved that to my ${category} memory: "${fact}". I'll keep adapting around this.`,
      learnedItems,
      question: getNextProactiveQuestion([...memories, mem], askedKeys),
    };
  }

  // 3. Proactive ask-me-to-learn trigger
  if (
    /\b(ask me|learn about me|interview me|teach you|train jarvis)\b/i.test(lower)
  ) {
    const q = getNextProactiveQuestion(memories, askedKeys);
    if (q) {
      return {
        reply: `I'm ready to learn more about your daily workflow. Here is my next question:`,
        learnedItems,
        question: q,
      };
    }
    return {
      reply: `I already have a solid profile of your core preferences! Tell me any new habit, shortcut, or daily task anytime and I'll learn from it.`,
      learnedItems,
    };
  }

  // 4. Morning / Daily Briefing
  if (/\b(plan my day|daily briefing|morning briefing|briefing|what are my tasks|status report)\b/i.test(lower)) {
    const pending = tasks.filter((t) => !t.completed);
    const highCount = pending.filter((t) => t.priority === 'HIGH').length;
    const prefSummary =
      memories.length > 0
        ? `I'm applying ${memories.length} learned preference${memories.length === 1 ? '' : 's'} & rules.`
        : `I'm still learning your preferences.`;
    return {
      reply: `Daily Briefing ready: You have ${pending.length} active task${pending.length === 1 ? '' : 's'} (${highCount} high priority). ${prefSummary}`,
      learnedItems,
      shouldExecuteBriefing: true,
      question: getNextProactiveQuestion(memories, askedKeys),
    };
  }

  // 5. Windows Laptop Commands
  if (/^(?:open|launch|start|run)\s+(.+)/i.test(lower)) {
    const targetRaw = input.replace(/^(?:open|launch|start|run)\s+/i, '').trim();
    const targetLower = targetRaw.toLowerCase();

    // Check known Windows apps
    const matchedAppKey = Object.keys(KNOWN_APPS).find((k) => targetLower.includes(k));
    if (matchedAppKey) {
      const app = KNOWN_APPS[matchedAppKey];
      const mem = makeMemory('preference', `uses_${app.target}`, `Uses ${app.label} on Windows`, 'Observed app command', 85);
      learnedItems.push(mem);

      return {
        reply: `Preparing to launch ${app.label} on your Windows laptop.${
          !permissions.appLaunch ? ' Note: App Launch permission is currently disabled in your guardrails.' : ''
        }`,
        learnedItems,
        actionRequest: {
          id: uid(),
          type: 'open_app',
          label: `Launch ${app.label}`,
          commandPreview: `windows-agent: open_app("${app.target}")`,
          target: app.target,
          risk: 'LOW',
          requiredPermission: 'appLaunch',
          status: 'pending',
        },
      };
    }

    // Check URL / website
    if (/\.(com|org|net|io|dev|ai)\b/i.test(targetLower) || targetLower.startsWith('http')) {
      const url = targetRaw.startsWith('http') ? targetRaw : `https://${targetRaw}`;
      return {
        reply: `Ready to open ${url} in your browser.`,
        learnedItems,
        actionRequest: {
          id: uid(),
          type: 'open_url',
          label: `Open ${url}`,
          commandPreview: `open_url("${url}")`,
          target: url,
          risk: 'LOW',
          requiredPermission: 'browserControl',
          status: 'pending',
        },
      };
    }
  }

  // Search Google
  const searchMatch = input.match(/^(?:search(?:\s+google)?(?:\s+for)?|google|look up)\s+(.+)/i);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return {
      reply: `Searching the web for "${query}".`,
      learnedItems,
      actionRequest: {
        id: uid(),
        type: 'open_url',
        label: `Search Google: ${query}`,
        commandPreview: `open_url("${url}")`,
        target: url,
        risk: 'LOW',
        requiredPermission: 'browserControl',
        status: 'pending',
      },
    };
  }

  // Create File on Windows Desktop
  const fileMatch = input.match(/^(?:create|make|write)\s+(?:a\s+)?file(?:\s+named|\s+called)?\s+(.+)/i);
  if (fileMatch) {
    const fileName = fileMatch[1].trim().replace(/["']/g, '');
    return {
      reply: `Prepared file creation request for "${fileName}" inside Desktop\\JARVIS_Notes.`,
      learnedItems,
      actionRequest: {
        id: uid(),
        type: 'create_file',
        label: `Create File: ${fileName}`,
        commandPreview: `windows-agent: create_file("${fileName}")`,
        target: fileName,
        risk: 'MEDIUM',
        requiredPermission: 'fileSystem',
        status: 'pending',
      },
    };
  }

  // System Telemetry / Lock Screen / Clean Temp
  if (/\b(system info|cpu|ram|battery|laptop status|pc status)\b/i.test(lower)) {
    return {
      reply: `Requesting live Windows system telemetry from your local companion.`,
      learnedItems,
      actionRequest: {
        id: uid(),
        type: 'system_info',
        label: 'Read Windows System Telemetry',
        commandPreview: 'windows-agent: system_info()',
        target: 'localhost',
        risk: 'LOW',
        requiredPermission: 'systemPower',
        status: 'pending',
      },
    };
  }

  if (/\b(lock screen|lock laptop|lock pc|lock windows)\b/i.test(lower)) {
    return {
      reply: `Locking your Windows workstation requires explicit confirmation.`,
      learnedItems,
      actionRequest: {
        id: uid(),
        type: 'lock_screen',
        label: 'Lock Windows Workstation',
        commandPreview: 'rundll32.exe user32.dll,LockWorkStation',
        target: 'workstation',
        risk: 'HIGH',
        requiredPermission: 'systemPower',
        status: 'pending',
      },
    };
  }

  if (/\b(clean temp|clear temp|cleanup)\b/i.test(lower)) {
    return {
      reply: `Prepared safe temporary folder cleanup on Windows.`,
      learnedItems,
      actionRequest: {
        id: uid(),
        type: 'clean_temp',
        label: 'Clean JARVIS Temporary Files',
        commandPreview: 'windows-agent: clean_temp()',
        target: '%TEMP%',
        risk: 'HIGH',
        requiredPermission: 'fileSystem',
        status: 'pending',
      },
    };
  }

  // 6. Task & Routine Detection (the core daily-task workflow!)
  const isQuestion =
    /[?]$/.test(lower) ||
    /^(?:what|who|when|where|why|how|can you|could you|would you|do you|is|are)\b/i.test(lower);
  const explicitTaskIntent = /^(?:remind me to|add task|new task|task:|todo:|schedule|i need to|i have to|don't forget to|every day|daily)/i.test(
    lower
  );
  const isTaskIntent =
    explicitTaskIntent ||
    (!isQuestion && /\b(meeting|report|call|email|workout|study|buy|submit|finish|review)\b/i.test(lower));

  if (isTaskIntent) {
    const cleanedTitle = input
      .replace(/^(?:remind me to|add task:?|new task:?|task:|todo:|i need to|i have to|don't forget to)\s*/i, '')
      .trim();
    const time = extractTime(input);
    const isRoutine = /\b(every day|daily|every morning|every night|routine)\b/i.test(lower);
    const isUrgent = /\b(urgent|asap|important|immediately|high priority)\b/i.test(lower);

    const priority: TaskPriority = isUrgent ? 'HIGH' : isRoutine ? 'ROUTINE' : 'NORMAL';
    const category: JarvisTask['category'] = isRoutine
      ? 'routine'
      : /\b(report|meeting|email|code|project|client|work)\b/i.test(lower)
      ? 'work'
      : 'personal';

    const newTask: JarvisTask = {
      id: uid(),
      title: cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1),
      completed: false,
      priority,
      scheduledTime: time,
      category,
      createdAt: nowTime(),
      learnedFrom: input,
    };

    if (isRoutine) {
      learnedItems.push(
        makeMemory('routine', cleanedTitle.slice(0, 28), `${cleanedTitle}${time ? ` at ${time}` : ''}`, 'Task routine', 90)
      );
    }

    // Ask a smart follow-up question while learning this daily task!
    let followUp: LearningQuestion | undefined;
    if (!time) {
      followUp = {
        id: uid(),
        question: `What time should I schedule "${newTask.title}", and is it a daily habit?`,
        context: `Learning schedule for: ${newTask.title}`,
        targetKey: `task_schedule_${newTask.id}`,
        targetCategory: 'schedule',
        quickOptions: ['Today at 10:00 AM', 'Today at 3:00 PM', 'Make it a daily routine', 'No fixed time'],
        relatedTaskId: newTask.id,
      };
    } else if (/\b(email|mail|report|message)\b/i.test(lower)) {
      followUp = {
        id: uid(),
        question: `When "${newTask.title}" is due, which app should I open for you automatically?`,
        context: 'Learning your communication tool',
        targetKey: 'preferred_mail_app',
        targetCategory: 'preference',
        quickOptions: ['Microsoft Outlook', 'Gmail in Chrome', 'Slack / Teams', 'Just remind me'],
        relatedTaskId: newTask.id,
      };
    } else {
      followUp = getNextProactiveQuestion([...memories, ...learnedItems], askedKeys);
    }

    return {
      reply: `Task logged: "${newTask.title}"${time ? ` for ${time}` : ''}. ${
        isRoutine ? "I've also added this to your learned daily routines." : ''
      }`,
      newTask,
      learnedItems,
      question: followUp,
    };
  }

  // Treat short natural-language entries as tasks too. This makes the chat useful
  // when the user types a task without a special prefix (e.g. "prepare slides").
  const looksLikeTask =
    /^(?:prepare|write|call|buy|finish|complete|review|study|clean|plan|organize|pay|send|create|update|fix|check|book|meet|read|practice|submit|visit|pick up|take|build|design|draft|research|renew|cancel|water|do|make|work on|look into)\b/i.test(
      input.trim()
    );
  if (looksLikeTask && input.trim().split(/\s+/).length >= 2 && !isQuestion) {
    const title = input.trim().replace(/[.!]+$/, '');
    const time = extractTime(title);
    const newTask: JarvisTask = {
      id: uid(),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      completed: false,
      priority: /\b(urgent|asap|important|immediately)\b/i.test(title) ? 'HIGH' : 'NORMAL',
      scheduledTime: time,
      category: /\b(report|meeting|email|code|project|client|work|review)\b/i.test(title) ? 'work' : 'personal',
      createdAt: nowTime(),
      learnedFrom: input,
    };
    return { reply: `Added to your task list: "${newTask.title}"${time ? ` at ${time}` : ''}.`, newTask, learnedItems };
  }

  // 7. General conversational response + continuous learning
  const nextQuestion = getNextProactiveQuestion(memories, askedKeys);
  return {
    reply: `Understood. You can tell me tasks ("Remind me to review code at 4pm"), teach me rules ("When I say Focus Mode, open VS Code"), or command your Windows laptop ("Open Chrome", "Check system info").`,
    learnedItems,
    question: nextQuestion,
  };
}
