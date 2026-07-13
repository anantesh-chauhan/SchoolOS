import { ISSUE_CATEGORIES, ISSUE_PRIORITIES, ISSUE_STATUSES } from './issueReport.constants.js';

const clean = (value) => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
  : value;
const text = (body, key, min, max, required = false) => {
  const value = clean(body[key]);
  if (required && !value) throw new Error(`${key} is required`);
  if (value && (value.length < min || value.length > max)) throw new Error(`${key} must be between ${min} and ${max} characters`);
  return value || undefined;
};
export const validateCreateIssue = (body = {}) => {
  if (!ISSUE_CATEGORIES.includes(body.category)) throw new Error('Invalid category');
  const priority = body.priority || 'MEDIUM';
  if (!ISSUE_PRIORITIES.includes(priority)) throw new Error('Invalid priority');
  const screenshotUrl = text(body, 'screenshotUrl', 8, 1000);
  if (screenshotUrl && !/^https:\/\//i.test(screenshotUrl)) throw new Error('Screenshot URL must be secure');
  return {
    title:text(body,'title',5,160,true), description:text(body,'description',20,10000,true),
    category:body.category, priority, stepsToReproduce:text(body,'stepsToReproduce',1,5000),
    expectedResult:text(body,'expectedResult',1,3000), actualResult:text(body,'actualResult',1,3000),
    additionalComment:text(body,'additionalComment',1,3000), currentRoute:text(body,'currentRoute',1,500),
    moduleName:text(body,'moduleName',1,120), browser:text(body,'browser',1,120),
    operatingSystem:text(body,'operatingSystem',1,120), deviceType:text(body,'deviceType',1,80),
    screenResolution:text(body,'screenResolution',1,40), applicationVersion:text(body,'applicationVersion',1,80),
    screenshotUrl, screenshotPublicId:text(body,'screenshotPublicId',1,500),
  };
};
export const validateMessage = (body = {}) => ({ message:text(body,'message',2,5000,true), isInternal:body.isInternal === true });
export const validateStatus = (value) => { if (!ISSUE_STATUSES.includes(value)) throw new Error('Invalid status'); return value; };
export const validatePriority = (value) => { if (!ISSUE_PRIORITIES.includes(value)) throw new Error('Invalid priority'); return value; };
