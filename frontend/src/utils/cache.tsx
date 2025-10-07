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