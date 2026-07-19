import * as service from './homework.service.js';

const send = (res, promise, successStatus = 200) => promise.then(data => res.status(successStatus).json({ success: true, data })).catch(error => {
  res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Academic content request failed', code: error.code,
    ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {}) });
});

export const createHomework = (req,res) => send(res, service.createHomework(req.user, req.body), 201);
export const listHomework = (req,res) => send(res, service.listHomework(req.user, req.query));
export const getHomework = (req,res) => send(res, service.getHomework(req.user, req.params.id, req.query.studentId));
export const updateHomework = (req,res) => send(res, service.updateHomework(req.user, req.params.id, req.body));
export const publishHomework = (req,res) => send(res, service.transitionHomework(req.user, req.params.id, 'publish'));
export const closeHomework = (req,res) => send(res, service.transitionHomework(req.user, req.params.id, 'close'));
export const archiveHomework = (req,res) => send(res, service.transitionHomework(req.user, req.params.id, 'archive'));
export const cancelHomework = (req,res) => send(res, service.transitionHomework(req.user, req.params.id, 'cancel'));
export const deleteHomework = (req,res) => send(res, service.deleteHomework(req.user, req.params.id).then(() => ({ message: 'Homework deleted' })));
export const saveSubmissionDraft = (req,res) => send(res, service.saveSubmission(req.user, req.params.id, req.body, true), 201);
export const submitHomework = (req,res) => send(res, service.saveSubmission(req.user, req.params.id, req.body, false), 201);
export const listSubmissions = (req,res) => send(res, service.listSubmissions(req.user, req.params.id, req.query));
export const reviewSubmission = (req,res) => send(res, service.reviewSubmission(req.user, req.params.id, req.params.submissionId, req.body));
export const requestResubmission = (req,res) => send(res, service.reviewSubmission(req.user, req.params.id, req.params.submissionId, { ...req.body, requestResubmission: true }));
export const listResources = (req,res) => send(res, service.listResources(req.user, req.query));
export const createResource = (req,res) => send(res, service.createResource(req.user, req.body), 201);
export const getResource = (req,res) => send(res, service.getResource(req.user, req.params.id, req.query.studentId));
export const updateResource = (req,res) => send(res, service.updateResource(req.user, req.params.id, req.body));
export const publishResource = (req,res) => send(res, service.transitionResource(req.user, req.params.id, 'publish'));
export const archiveResource = (req,res) => send(res, service.transitionResource(req.user, req.params.id, 'archive'));
export const deleteResource = (req,res) => send(res, service.deleteResource(req.user, req.params.id).then(() => ({ message: 'Resource deleted' })));
export const analytics = (req,res) => send(res, service.getAnalytics(req.user));
export const runScheduledPublishing = (req,res) => send(res, service.publishScheduledContent());
export const runReminders = (req,res) => send(res, service.processHomeworkReminders());
export const creationContext = (req,res) => send(res, service.getCreationContext(req.user));
export const linkedChildren = (req,res) => send(res, service.listLinkedChildren(req.user));
