export const clearAllCache = () => {
  try {
    const keysToKeep = ['access_token', 'refresh_token'];
    const keysToRemove = Object.keys(localStorage).filter(
      key => !keysToKeep.includes(key)
    );
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    sessionStorage.clear();

    console.log("✅ All cache cleared except tokens");
  } catch (error) {
    console.error("❌ Error clearing cache:", error);
  }
};

export const clearUserDataCache = () => {
  try {
    localStorage.removeItem('user');
    localStorage.removeItem('user_data');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('user_data');

    console.log("✅ User data cache cleared");
  } catch (error) {
    console.error("❌ Error clearing user data cache:", error);
  }
};

export const refreshUserData = async (apiClient: any) => {
  try {
    clearUserDataCache();

    const response = await apiClient.getMe();
    const freshUserData = response.data;

    localStorage.setItem('user', JSON.stringify(freshUserData));
    localStorage.setItem('user_data', JSON.stringify(freshUserData));

    console.log("✅ User data refreshed from server");

    return freshUserData;
  } catch (error) {
    console.error("❌ Error refreshing user data:", error);
    throw error;
  }
};

export const clearServiceWorkerCache = async () => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log("✅ Service Worker cache cleared");
    } catch (error) {
      console.error("❌ Error clearing Service Worker cache:", error);
    }
  }
};