const ENUMS = {
  category: new Set(['GENERAL','SYSTEM','SECURITY','ACADEMIC','EXAM','RESULT','FEE','ATTENDANCE','HOMEWORK','RESOURCE','TRANSPORT','EVENT','HOLIDAY','ADMISSION','SPORTS','EMERGENCY','STAFF','PARENT','STUDENT','LEGAL','OTHER']),
  priority: new Set(['LOW','NORMAL','HIGH','URGENT','EMERGENCY']),
  audience: new Set(['DIRECT','ROLE','SCHOOL_WIDE','STAFF','CLASS','SECTION','SUBJECT','PARENT_OF_STUDENT','AUTOMATED_RULE','SAVED_GROUP']),
  channel: new Set(['IN_APP','EMAIL','SMS','PUSH','WHATSAPP','WEB_SOCKET']),
  conversation: new Set(['DIRECT','PARENT_TEACHER','STUDENT_TEACHER','ADMIN_STAFF','FEE_SUPPORT','ACADEMIC_SUPPORT','GROUP','SYSTEM_SUPPORT']),
  message: new Set(['TEXT','IMAGE','FILE','AUDIO','SYSTEM','ANNOUNCEMENT_REFERENCE','HOMEWORK_REFERENCE','FEE_REFERENCE','ATTENDANCE_REFERENCE']),
};

export class CommunicationError extends Error {
  constructor(message, statusCode = 400, code = 'COMMUNICATION_ERROR') {
    super(message); this.statusCode = statusCode; this.code = code;
  }
}

const text = (value, name, max, required = false) => {
  const result = String(value ?? '').trim();
  if (required && !result) throw new CommunicationError(`${name} is required.`);
  if (result.length > max) throw new CommunicationError(`${name} must be ${max} characters or fewer.`);
  return result || null;
};

const date = (value, name) => {
  if (!value) return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new CommunicationError(`${name} is invalid.`);
  return result;
};

const enumValue = (value, name, values, fallback) => {
  const result = String(value || fallback || '').toUpperCase();
  if (!values.has(result)) throw new CommunicationError(`${name} is invalid.`);
  return result;
};

const safeUrl = (value, name = 'actionUrl') => {
  const result = text(value, name, 2048);
  if (!result) return null;
  if (result.startsWith('/')) return result;
  let parsed;
  try { parsed = new URL(result); } catch { throw new CommunicationError(`${name} must be a valid HTTPS URL or application path.`); }
  if (parsed.protocol !== 'https:') throw new CommunicationError(`${name} must use HTTPS.`);
  return result;
};

export const validateAudienceRules = (rules) => {
  if (!Array.isArray(rules) || !rules.length) throw new CommunicationError('At least one audience rule is required.');
  if (rules.length > 100) throw new CommunicationError('Too many audience rules.');
  return rules.map((rule) => {
    const kind = enumValue(rule?.kind, 'audience kind', ENUMS.audience);
    const role = rule?.role ? String(rule.role).toUpperCase() : null;
    const entityIds = Array.isArray(rule?.entityIds) ? [...new Set(rule.entityIds.map(String).filter(Boolean))] : [];
    if (['DIRECT','CLASS','SECTION','SUBJECT','PARENT_OF_STUDENT','SAVED_GROUP'].includes(kind) && !entityIds.length) {
      throw new CommunicationError(`${kind} requires entityIds.`);
    }
    if (kind === 'ROLE' && !role) throw new CommunicationError('ROLE requires role.');
    return { kind, role, entityIds, metadata: rule?.metadata && typeof rule.metadata === 'object' ? rule.metadata : null };
  });
};

export const validateAnnouncement = (body = {}, partial = false) => {
  const publishAt = date(body.publishAt, 'publishAt');
  const expiresAt = date(body.expiresAt, 'expiresAt');
  const acknowledgementDeadline = date(body.acknowledgementDeadline, 'acknowledgementDeadline');
  if (expiresAt && publishAt && expiresAt <= publishAt) throw new CommunicationError('expiresAt must be after publishAt.');
  if (acknowledgementDeadline && publishAt && acknowledgementDeadline <= publishAt) throw new CommunicationError('acknowledgementDeadline must be after publishAt.');
  const result = {
    title: text(body.title, 'title', 180, !partial), content: text(body.content, 'content', 10000, !partial),
    summary: text(body.summary, 'summary', 500), category: enumValue(body.category, 'category', ENUMS.category, 'GENERAL'),
    priority: enumValue(body.priority, 'priority', ENUMS.priority, 'NORMAL'), publishAt, expiresAt, acknowledgementDeadline,
    requiresAcknowledgement: body.requiresAcknowledgement === true, allowComments: body.allowComments === true,
    allowReplies: body.allowReplies === true, actionUrl: safeUrl(body.actionUrl),
    audienceRules: body.audienceRules ? validateAudienceRules(body.audienceRules) : undefined,
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
};

export const validateConversation = (body = {}) => ({
  type: enumValue(body.type, 'type', ENUMS.conversation, 'DIRECT'), subject: text(body.subject, 'subject', 180),
  classId: text(body.classId, 'classId', 100), sectionId: text(body.sectionId, 'sectionId', 100), studentId: text(body.studentId, 'studentId', 100),
  participantKeys: [...new Set((Array.isArray(body.participantKeys) ? body.participantKeys : []).map(String).filter(Boolean))],
  message: text(body.message, 'message', 5000, true),
});

export const validateMessage = (body = {}) => ({
  content: text(body.content, 'content', 5000, true), messageType: enumValue(body.messageType, 'messageType', ENUMS.message, 'TEXT'),
  replyToMessageId: text(body.replyToMessageId, 'replyToMessageId', 100),
});

export const validateTemplateVariables = (template, variables = {}) => {
  const used = [...`${template.titleTemplate} ${template.bodyTemplate} ${template.shortBodyTemplate || ''}`.matchAll(/{{\s*([a-zA-Z][\w]*)\s*}}/g)].map((match) => match[1]);
  const disallowed = used.filter((name) => !template.allowedVariables.includes(name));
  if (disallowed.length) throw new CommunicationError(`Template contains unsupported variables: ${[...new Set(disallowed)].join(', ')}.`);
  const missing = used.filter((name) => variables[name] === undefined || variables[name] === null);
  if (missing.length) throw new CommunicationError(`Missing template variables: ${[...new Set(missing)].join(', ')}.`);
  const render = (input) => input?.replace(/{{\s*([a-zA-Z][\w]*)\s*}}/g, (_, name) => String(variables[name]));
  return { title: render(template.titleTemplate), message: render(template.bodyTemplate), shortMessage: render(template.shortBodyTemplate) };
};

export const constants = ENUMS;
