import { TeamsAgentConfig, TeamsAlert } from '../types/jarvis';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Evaluates an incoming Microsoft Teams message to see if the user was
 * @tagged, mentioned by name, or asked a direct question.
 */
export function analyzeTeamsMessage(
  sender: string,
  channel: string,
  message: string,
  config: TeamsAgentConfig
): TeamsAlert | null {
  if (!config.enabled) return null;

  const cleanName = config.userName.trim().toLowerCase();
  const lower = message.toLowerCase();

  const isTagged =
    (cleanName && lower.includes(`@${cleanName}`)) ||
    lower.includes('@you') ||
    lower.includes('@everyone');

  const isNameMentioned = Boolean(
    cleanName &&
      new RegExp(`\\b${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(message)
  );

  const isDirectQuestion =
    config.callOutDirectQuestions &&
    (/\?/.test(message) ||
      /\b(can you|could you|please check|are you|did you|help me|update me)\b/i.test(lower)) &&
    (isNameMentioned || isTagged || channel.toLowerCase().includes('direct'));

  if (isTagged && config.callOutMentions) {
    return {
      id: uid(),
      sender,
      channel,
      message,
      reason: 'TAGGED',
      timestamp: nowTime(),
    };
  }

  if (isDirectQuestion) {
    return {
      id: uid(),
      sender,
      channel,
      message,
      reason: 'DIRECT_QUESTION',
      timestamp: nowTime(),
    };
  }

  if (isNameMentioned && config.callOutMentions) {
    return {
      id: uid(),
      sender,
      channel,
      message,
      reason: 'NAME_MENTIONED',
      timestamp: nowTime(),
    };
  }

  return null;
}

export function formatTeamsCallout(alert: TeamsAlert): string {
  const reasonLabel =
    alert.reason === 'TAGGED'
      ? 'tagged you'
      : alert.reason === 'DIRECT_QUESTION'
      ? 'asked you directly'
      : 'mentioned your name';
  return `Teams Alert: ${alert.sender} ${reasonLabel} in ${alert.channel}: "${alert.message}"`;
}
