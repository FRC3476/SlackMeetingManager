import { WebClient } from '@slack/web-api';

export interface UserInfo {
  id: string;
  real_name?: string;
  name?: string;
  display_name?: string;
}

export class UserCache {
  private cache: Map<string, UserInfo> = new Map();
  private client: WebClient | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the user cache by fetching all workspace users
   */
  async initialize(client: WebClient): Promise<void> {
    this.client = client;
    console.log('Initializing user cache...');
    
    try {
      await this.refresh();
      this.isInitialized = true;
      
      // Setup automatic refresh every 30 minutes
      this.refreshInterval = setInterval(() => {
        this.refresh().catch(error => {
          console.error('Error during scheduled user cache refresh:', error);
        });
      }, 30 * 60 * 1000); // 30 minutes
      
      console.log(`User cache initialized with ${this.cache.size} users`);
    } catch (error) {
      console.error('Error initializing user cache:', error);
      throw error;
    }
  }

  /**
   * Refresh the user cache by fetching all users from Slack
   */
  async refresh(): Promise<void> {
    if (!this.client) {
      throw new Error('UserCache not initialized with client');
    }

    console.log('Refreshing user cache...');
    const newCache = new Map<string, UserInfo>();
    
    try {
      let cursor: string | undefined;
      let totalUsers = 0;
      
      do {
        const result = await this.client.users.list({
          cursor,
          limit: 200, // Maximum allowed by Slack API
        });
        
        if (result.members) {
          for (const member of result.members) {
            if (!member.deleted && !member.is_bot) {
              newCache.set(member.id!, {
                id: member.id!,
                real_name: member.real_name,
                name: member.name,
                display_name: member.profile?.display_name || member.real_name || member.name,
              });
              totalUsers++;
            }
          }
        }
        
        cursor = result.response_metadata?.next_cursor;
      } while (cursor);
      
      // Replace the cache atomically
      this.cache = newCache;
      console.log(`User cache refreshed with ${totalUsers} users`);
    } catch (error) {
      console.error('Error refreshing user cache:', error);
      // Keep existing cache on error
      throw error;
    }
  }

  /**
   * Get user info from cache
   * @param userId The Slack user ID
   * @returns UserInfo if found, undefined otherwise
   */
  get(userId: string): UserInfo | undefined {
    return this.cache.get(userId);
  }

  /**
   * Get display name for a user (with fallback)
   * @param userId The Slack user ID
   * @returns Display name or the userId if not found
   */
  getDisplayName(userId: string): string {
    const user = this.cache.get(userId);
    if (!user) {
      console.warn(`User ${userId} not found in cache, using ID as fallback`);
      return userId;
    }
    return user.display_name || user.real_name || user.name || userId;
  }

  /**
   * Get display name for a user with on-demand API lookup
   * Falls back to API call if user is not in cache, then caches the result
   * @param userId The Slack user ID
   * @returns Display name or the userId if not found
   */
  async getDisplayNameAsync(userId: string): Promise<string> {
    // First check cache
    const cachedUser = this.cache.get(userId);
    if (cachedUser) {
      return cachedUser.display_name || cachedUser.real_name || cachedUser.name || userId;
    }

    // On-demand lookup for missing user
    if (this.client) {
      try {
        const result = await this.client.users.info({ user: userId });
        if (result.user && !result.user.deleted) {
          const userInfo: UserInfo = {
            id: result.user.id!,
            real_name: result.user.real_name,
            name: result.user.name,
            display_name: result.user.profile?.display_name || result.user.real_name || result.user.name,
          };
          // Add to cache for future lookups
          this.cache.set(userId, userInfo);
          return userInfo.display_name || userInfo.real_name || userInfo.name || userId;
        }
      } catch (error) {
        console.warn(`Failed to fetch user ${userId} from API:`, error);
      }
    }

    // Final fallback to user ID
    return userId;
  }

  /**
   * Check if cache is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.cache.size > 0;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup - stop refresh interval
   */
  destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Singleton instance
let userCacheInstance: UserCache | null = null;

/**
 * Get the global UserCache instance
 */
export function getUserCache(): UserCache {
  if (!userCacheInstance) {
    userCacheInstance = new UserCache();
  }
  return userCacheInstance;
}

