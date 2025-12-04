/**
 * Channel restriction utility
 * Checks if a command can be executed in a specific channel
 */

/**
 * Check if a command can be executed in the given channel
 * @param channelId - The channel ID where the command was executed
 * @param allowedChannels - Array of allowed channel IDs (undefined/empty means all channels allowed)
 * @returns true if command can be executed, false otherwise
 */
export function checkChannelRestriction(
  channelId: string,
  allowedChannels?: string[]
): boolean {
  // If no restrictions configured, allow all channels (backward compatible)
  if (!allowedChannels || allowedChannels.length === 0) {
    return true;
  }

  // Check if the channel is in the allowed list
  return allowedChannels.includes(channelId);
}







