import config from '../app.config.json';

/** Display name. Change it in app.config.json; nothing else needs editing. */
export const APP_NAME: string = config.name;

/**
 * IndexedDB database name. Deliberately NOT tied to the display name:
 * renaming the app must not orphan existing data.
 */
export const DB_NAME = 'questday';
