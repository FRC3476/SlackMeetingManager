import { App } from '@slack/bolt';
import { readConfig, writeConfig, AppConfig } from './storage';
import { checkChannelRestriction } from './utils/channelRestriction';
import { syncSchedulerWithConfig } from './cloudScheduler';

const DAYS_OF_WEEK = [
  { text: 'Sunday', value: '0' },
  { text: 'Monday', value: '1' },
  { text: 'Tuesday', value: '2' },
  { text: 'Wednesday', value: '3' },
  { text: 'Thursday', value: '4' },
  { text: 'Friday', value: '5' },
  { text: 'Saturday', value: '6' },
];

export function setupConfigHandlers(app: App): void {
  // Handle /meeting-config command
  app.command('/meeting-config', async ({ ack, body, client }) => {
    await ack();

    const config = await readConfig();

    // Check channel restriction
    if (!checkChannelRestriction(body.channel_id, config.allowedChannels)) {
      await client.chat.postEphemeral({
        channel: body.channel_id,
        user: body.user_id,
        text: '❌ This command can only be executed in specific channels. Please contact an administrator.',
      });
      return;
    }

    const modal: any = {
      type: 'modal' as const,
      callback_id: 'config_modal',
      title: {
        type: 'plain_text',
        text: 'Meeting Configuration',
      },
      submit: {
        type: 'plain_text',
        text: 'Save',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
      blocks: [
        {
          type: 'input',
          block_id: 'channel',
          element: {
            type: 'channels_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select a channel',
            },
            initial_channel: config.channelId || undefined,
            action_id: 'channel_select',
          },
          label: {
            type: 'plain_text',
            text: 'Announcement Channel',
          },
        },
        {
          type: 'input',
          block_id: 'calendar_id',
          element: {
            type: 'plain_text_input',
            placeholder: {
              type: 'plain_text',
              text: 'calendar@example.com',
            },
            initial_value: config.calendarId || '',
            action_id: 'calendar_input',
          },
          label: {
            type: 'plain_text',
            text: 'Google Calendar ID',
          },
        },
        {
          type: 'input',
          block_id: 'timezone',
          element: {
            type: 'plain_text_input',
            placeholder: {
              type: 'plain_text',
              text: 'America/New_York',
            },
            initial_value: config.timezone || 'America/Los_Angeles',
            action_id: 'timezone_input',
          },
          label: {
            type: 'plain_text',
            text: 'Timezone (IANA format, e.g., America/New_York)',
          },
          hint: {
            type: 'plain_text',
            text: 'Used for displaying meeting times. Common: America/New_York, America/Los_Angeles, America/Chicago',
          },
        },
        {
          type: 'input',
          block_id: 'weekly_day',
          element: {
            type: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select day',
            },
            options: DAYS_OF_WEEK.map(day => ({
              text: {
                type: 'plain_text',
                text: day.text,
              },
              value: day.value,
            })),
            initial_option: config.weeklySchedule?.dayOfWeek !== undefined
              ? (() => {
                  const day = DAYS_OF_WEEK.find(d => parseInt(d.value) === config.weeklySchedule!.dayOfWeek);
                  return day ? {
                    text: {
                      type: 'plain_text',
                      text: day.text,
                    },
                    value: day.value,
                  } : undefined;
                })()
              : undefined,
            action_id: 'day_select',
          },
          label: {
            type: 'plain_text',
            text: 'Weekly Announcement Day',
          },
        },
        {
          type: 'input',
          block_id: 'weekly_time',
          element: {
            type: 'timepicker',
            initial_time: config.weeklySchedule?.time || '09:00',
            placeholder: {
              type: 'plain_text',
              text: 'Select time',
            },
            action_id: 'time_select',
          },
          label: {
            type: 'plain_text',
            text: 'Weekly Announcement Time',
          },
          hint: {
            type: 'plain_text',
            text: 'You can type the time directly (e.g., 09:30 or 14:45) or use the time picker',
          },
        },
        {
          type: 'input',
          block_id: 'reminder_time',
          element: {
            type: 'timepicker',
            initial_time: config.reminderTime || '08:00',
            placeholder: {
              type: 'plain_text',
              text: 'Select time',
            },
            action_id: 'reminder_time_select',
          },
          label: {
            type: 'plain_text',
            text: 'Daily Reminder Time',
          },
          hint: {
            type: 'plain_text',
            text: 'You can type the time directly (e.g., 09:30 or 14:45) or use the time picker',
          },
        },
        {
          type: 'input',
          block_id: 'weekly_template',
          element: {
            type: 'plain_text_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Weekly announcement message template',
            },
            initial_value: config.weeklyTemplate || '',
            action_id: 'weekly_template_input',
          },
          label: {
            type: 'plain_text',
            text: 'Weekly Announcement Template',
          },
          optional: true,
        },
        {
          type: 'input',
          block_id: 'daily_template',
          element: {
            type: 'plain_text_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Daily reminder message template',
            },
            initial_value: config.dailyTemplate || '',
            action_id: 'daily_template_input',
          },
          label: {
            type: 'plain_text',
            text: 'Daily Reminder Template',
          },
          optional: true,
        },
        {
          type: 'input',
          block_id: 'allowed_channels',
          element: {
            type: 'multi_channels_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select channels',
            },
            initial_channels: config.allowedChannels || [],
            action_id: 'channels_select',
          },
          label: {
            type: 'plain_text',
            text: 'Allowed Channels (for restricted commands)',
          },
          hint: {
            type: 'plain_text',
            text: 'Channels where /meeting-config, /create-event, and /update-event can be executed. Leave empty to allow all channels.',
          },
          optional: true,
        },
      ],
    };

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: modal,
      });
    } catch (error) {
      console.error('Error opening config modal:', error);
    }
  });

  // Handle config modal submission
  app.view('config_modal', async ({ ack, body, view, client }) => {
    console.log('=== VIEW HANDLER TRIGGERED ===');
    console.log('View submission received for config_modal');
    console.log('View ID:', view.id);
    console.log('View callback_id:', view.callback_id);
    
    try {
      const values = view.state.values;
      console.log('View values:', JSON.stringify(values, null, 2));
      
      const dayOfWeek = values.weekly_day?.day_select?.selected_option
        ? parseInt(values.weekly_day.day_select.selected_option.value)
        : undefined;
      const weeklyTime = values.weekly_time?.time_select?.selected_time;
      const allowedChannels = values.allowed_channels?.channels_select?.selected_channels || [];

      const newConfig: AppConfig = {
        channelId: values.channel?.channel_select?.selected_channel || undefined,
        calendarId: values.calendar_id?.calendar_input?.value || undefined,
        timezone: values.timezone?.timezone_input?.value || 'America/Los_Angeles',
        weeklySchedule: (dayOfWeek !== undefined && weeklyTime) ? {
          dayOfWeek,
          time: weeklyTime,
        } : undefined,
        reminderTime: values.reminder_time?.reminder_time_select?.selected_time || undefined,
        weeklyTemplate: values.weekly_template?.weekly_template_input?.value || undefined,
        dailyTemplate: values.daily_template?.daily_template_input?.value || undefined,
        allowedChannels: allowedChannels.length > 0 ? allowedChannels : undefined,
      };

      console.log('Writing configuration...');
      await writeConfig(newConfig);
      console.log('Configuration saved successfully');

      // Update Cloud Scheduler jobs (if they exist) to match the new configuration
      let schedulerError: string | null = null;
      try {
        await syncSchedulerWithConfig(newConfig);
        console.log('Cloud Scheduler jobs updated with new configuration');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        schedulerError = errorMessage;
        console.error(
          'Error updating Cloud Scheduler jobs with new configuration:',
          error
        );
      }

      // Ack with success message (and warning if scheduler update failed)
      const blocks: any[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ Configuration has been saved successfully!',
          },
        },
      ];

      if (schedulerError) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ *Warning:* Cloud Scheduler jobs could not be updated automatically.\n\`\`\`${schedulerError}\`\`\`\nYou may need to update them manually or check your deployment configuration.`,
          },
        });
      }

      await ack({
        response_action: 'update',
        view: {
          type: 'modal' as const,
          title: {
            type: 'plain_text',
            text: 'Configuration Saved',
          },
          close: {
            type: 'plain_text',
            text: 'Close',
          },
          blocks,
        },
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      // Ack with error message
      await ack({
        response_action: 'errors',
        errors: {
          calendar_id: 'Failed to save configuration. Please check the logs and try again.',
        },
      });
    }
  });
}

