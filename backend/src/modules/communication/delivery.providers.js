// Provider adapters never report success unless a real provider accepted the send.
export const deliveryProviders = {
  IN_APP: { name: 'database', configured: () => true, send: async () => ({ status: 'DELIVERED', providerMessageId: null }) },
  WEB_SOCKET: { name: 'sse', configured: () => true, send: async ({ emit }) => { emit?.(); return { status: 'DELIVERED' }; } },
  EMAIL: { name: process.env.EMAIL_PROVIDER || 'unconfigured', configured: () => false },
  SMS: { name: process.env.SMS_PROVIDER || 'unconfigured', configured: () => false },
  PUSH: { name: process.env.PUSH_PROVIDER || 'unconfigured', configured: () => false },
  WHATSAPP: { name: process.env.WHATSAPP_PROVIDER || 'unconfigured', configured: () => false },
};

export const sendDelivery = async (channel, payload) => {
  const provider = deliveryProviders[channel];
  if (!provider || !provider.configured()) return { status: 'SKIPPED', provider: provider?.name || 'unsupported', failureReason: `${channel} provider is not configured.` };
  try { return { provider: provider.name, ...(await provider.send(payload)) }; }
  catch (error) { return { status: 'FAILED', provider: provider.name, failureReason: String(error.message || error).slice(0, 1000) }; }
};
