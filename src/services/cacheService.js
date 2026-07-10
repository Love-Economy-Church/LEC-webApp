const CACHE_PREFIX = 'app_cache_';
const DEFAULT_TTL_MINUTES = 5;

export const CACHE_KEYS = {
    PEOPLE: 'people_data',
    HIERARCHY: 'hierarchy_data',
    POSITIONS: 'positions_data'
};

export const cacheService = {
    get: (key) => {
        try {
            const itemStr = localStorage.getItem(CACHE_PREFIX + key);
            if (!itemStr) return null;

            const item = JSON.parse(itemStr);
            const now = new Date();

            if (now.getTime() > item.expiry) {
                localStorage.removeItem(CACHE_PREFIX + key);
                return null;
            }

            return item.value;
        } catch (err) {
            console.error('Cache read error:', err);
            return null;
        }
    },

    set: (key, value, ttlMinutes = DEFAULT_TTL_MINUTES) => {
        try {
            const now = new Date();
            const item = {
                value: value,
                expiry: now.getTime() + (ttlMinutes * 60 * 1000)
            };
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
        } catch (err) {
            console.error('Cache write error:', err);
        }
    },

    remove: (key) => {
        try {
            localStorage.removeItem(CACHE_PREFIX + key);
        } catch (err) {
            console.error('Cache remove error:', err);
        }
    },

    clear: () => {
        Object.values(CACHE_KEYS).forEach(key => {
            localStorage.removeItem(CACHE_PREFIX + key);
        });
    }
};
