/**
 * Auto-remove temporary role when user gets permanent role
 * Listens to guildMemberUpdate event
 */

const { PERMANENT_ROLE_ID, TEMP_ROLE_ID } = require("../config/env");

/**
 * Handle guild member update event
 * @param {Client} client - Discord client
 * @returns {Function} Event handler
 */
function onGuildMemberUpdate(client) {
  return async (oldMember, newMember) => {
    try {
      // Check if roles were actually changed
      if (oldMember.roles.cache.size === newMember.roles.cache.size) {
        return; // No role changes
      }

      // Check if member has both permanent and temporary roles
      const hasPermanentRole = newMember.roles.cache.has(PERMANENT_ROLE_ID);
      const hasTempRole = newMember.roles.cache.has(TEMP_ROLE_ID);

      if (hasPermanentRole && hasTempRole) {
        // Remove temporary role
        await newMember.roles.remove(TEMP_ROLE_ID);

        console.log(
          `✅ Removed temporary role from ${newMember.user.tag} (${newMember.id})`
        );
      }
    } catch (error) {
      console.error("❌ Error in autoRemoveTempRole:", error);
    }
  };
}

module.exports = { onGuildMemberUpdate };
