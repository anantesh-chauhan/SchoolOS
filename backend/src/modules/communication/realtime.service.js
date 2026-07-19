const clients = new Map();

export const subscribe = (recipientKey, response) => {
  const set = clients.get(recipientKey) || new Set(); set.add(response); clients.set(recipientKey, set);
  return () => { set.delete(response); if (!set.size) clients.delete(recipientKey); };
};

export const emitToRecipient = (recipientKey, event, data) => {
  for (const response of clients.get(recipientKey) || []) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
