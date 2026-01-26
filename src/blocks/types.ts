/**
 * Slack Block Kit type definitions
 * These types provide structure for building Slack messages and modals
 */

export interface PlainTextElement {
  type: 'plain_text';
  text: string;
  emoji?: boolean;
}

export interface MrkdwnElement {
  type: 'mrkdwn';
  text: string;
}

export type TextElement = PlainTextElement | MrkdwnElement;

export interface HeaderBlock {
  type: 'header';
  text: PlainTextElement;
}

export interface DividerBlock {
  type: 'divider';
}

export interface SectionBlock {
  type: 'section';
  text: TextElement;
  block_id?: string;
  accessory?: ButtonElement | SelectElement;
}

export interface ButtonElement {
  type: 'button';
  text: PlainTextElement;
  action_id: string;
  value?: string;
  style?: 'primary' | 'danger';
}

export interface SelectElement {
  type: 'static_select' | 'channels_select' | 'multi_channels_select';
  placeholder?: PlainTextElement;
  action_id: string;
  options?: SelectOption[];
  initial_option?: SelectOption;
  initial_channel?: string;
  initial_channels?: string[];
}

export interface SelectOption {
  text: PlainTextElement;
  value: string;
}

export interface ActionsBlock {
  type: 'actions';
  elements: ButtonElement[];
  block_id?: string;
}

export interface InputBlock {
  type: 'input';
  block_id: string;
  element: InputElement;
  label: PlainTextElement;
  hint?: PlainTextElement;
  optional?: boolean;
}

export type InputElement = 
  | PlainTextInputElement
  | DatepickerElement
  | TimepickerElement
  | SelectElement;

export interface PlainTextInputElement {
  type: 'plain_text_input';
  action_id: string;
  placeholder?: PlainTextElement;
  initial_value?: string;
  multiline?: boolean;
}

export interface DatepickerElement {
  type: 'datepicker';
  action_id: string;
  placeholder?: PlainTextElement;
  initial_date?: string;
}

export interface TimepickerElement {
  type: 'timepicker';
  action_id: string;
  placeholder?: PlainTextElement;
  initial_time?: string;
}

export type SlackBlock = 
  | HeaderBlock 
  | DividerBlock 
  | SectionBlock 
  | ActionsBlock 
  | InputBlock;

export interface ModalView {
  type: 'modal';
  callback_id: string;
  title: PlainTextElement;
  submit?: PlainTextElement;
  close?: PlainTextElement;
  blocks: SlackBlock[];
  private_metadata?: string;
}

/**
 * Event with attendance data - used across multiple modules
 */
export interface EventWithAttendance {
  event: {
    id: string;
    recurringEventId?: string;
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    htmlLink?: string;
  };
  attendanceKey: string;
  attending: string[];
  notAttending: string[];
}



