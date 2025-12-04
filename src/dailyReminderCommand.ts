import { App } from '@slack/bolt';
import { postDailyReminders } from './reminders';

export function setupDailyReminderCommand(app: App): void {
  app.command('/daily-reminder', async ({ ack, body, client }) => {
    await ack();

    try {
      // Post daily reminders (this posts publicly to the configured channel)
      await postDailyReminders(app);
      
      // Confirm to the user (ephemeral - only visible to them)
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '✅ Daily reminder posted successfully to the configured channel!',
      });
    } catch (error) {
      console.error('Error posting daily reminder:', error);
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: `❌ Error posting daily reminder: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });
}

