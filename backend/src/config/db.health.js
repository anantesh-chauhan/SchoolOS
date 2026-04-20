import masterDb from './db.master.js';
import { getDbMode, sanitizeError } from '../utils/dbMode.util.js';

export const checkDatabaseHealth = async () => {
  const mode = getDbMode();

  try {
    if (typeof masterDb.healthCheck === 'function') {
      await masterDb.healthCheck();
    } else {
      await masterDb.query('SELECT 1');
    }

    return {
      status: 'connected',
      mode,
    };
  } catch (error) {
    return {
      status: 'failed',
      mode,
      reason: sanitizeError(error),
    };
  }
};

export default { checkDatabaseHealth };
