export type JarvisMode =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'LEARNING'
  | 'EXECUTING'
  | 'AWAITING_PERMISSION'
  | 'HALTED';

export type TaskPriority = 'HIGH' | 'NORMAL' | 'ROUTINE';

export interface JarvisTask {
  id: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  scheduledTime?: string;
  category: 'work' | 'personal' | 'system' | 'routine';
  linkedAction?: WindowsActionSpec;
  createdAt: string;
  learnedFrom?: string;
}

export type MemoryCategory =
  | 'routine'
  | 'preference'
  | 'rule'
  | 'schedule'
  | 'fact';

export interface LearnedMemory {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number; // 0-100
  source: string;
  learnedAt: string;
  timesApplied: number;
}

export interface LearningQuestion {
  id: string;
  question: string;
  context: string;
  targetKey: string;
  targetCategory: MemoryCategory;
  quickOptions: string[];
  relatedTaskId?: string;
  answered?: boolean;
  answer?: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type PermissionKey =
  | 'appLaunch'
  | 'browserControl'
  | 'fileSystem'
  | 'systemPower'
  | 'requireApprovalForHighRisk';

export type PermissionSettings = Record<PermissionKey, boolean>;

export interface WindowsActionSpec {
  id: string;
  type:
    | 'open_app'
    | 'open_url'
    | 'create_file'
    | 'system_info'
    | 'clean_temp'
    | 'lock_screen'
    | 'custom_command';
  label: string;
  commandPreview: string;
  target: string;
  risk: RiskLevel;
  requiredPermission: PermissionKey;
  status: 'pending' | 'approved' | 'executed' | 'simulated' | 'denied' | 'blocked';
}

export interface TeamsDraftSpec {
  id: string;
  recipient: string;
  rawIntent: string;
  politeMessage: string;
  status: 'draft' | 'sent' | 'copied';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'jarvis' | 'system';
  text: string;
  timestamp: string;
  createdTask?: JarvisTask;
  learnedItems?: LearnedMemory[];
  question?: LearningQuestion;
  actionRequest?: WindowsActionSpec;
  teamsDraft?: TeamsDraftSpec;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  mode: 'WINDOWS_AGENT' | 'BROWSER_SANDBOX' | 'BLOCKED' | 'LEARNING';
  status: 'SUCCESS' | 'DENIED' | 'SIMULATED' | 'HALTED';
}

export type AgentConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface TeamsAgentConfig {
  enabled: boolean;
  userName: string;
  callOutMentions: boolean;
  callOutDirectQuestions: boolean;
}

export interface TeamsAlert {
  id: string;
  sender: string;
  channel: string;
  message: string;
  reason: 'TAGGED' | 'NAME_MENTIONED' | 'DIRECT_QUESTION';
  timestamp: string;
}
