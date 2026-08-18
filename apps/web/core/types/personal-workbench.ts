export type TPersonalWorkbenchOption = {
  id: string;
  name: string;
  color?: number | string | null;
};

export type TPersonalWorkbenchField = {
  id: string;
  name: string;
  type: number;
  ui_type: string;
  is_primary: boolean;
  multiple: boolean;
  options: TPersonalWorkbenchOption[];
  readonly: boolean;
};

export type TPersonalWorkbenchView = {
  id: string;
  name: string;
  type: number;
  fields: string[];
  source_record_ids: string[];
  col_infos: Record<string, { width?: number }>;
  frozen_col_count: number;
};

export type TPersonalWorkbenchTable = {
  id: string;
  key: string;
  name: string;
  sort_order: number;
  primary_field_id: string;
  fields: TPersonalWorkbenchField[];
  views: TPersonalWorkbenchView[];
  item_count: number;
};

export type TPersonalWorkbenchConfig = {
  workspace_slug: string;
  project_id: string;
  project_name: string;
  tables: TPersonalWorkbenchTable[];
};

export type TPersonalWorkbenchItem = {
  id: string;
  issue_id: string;
  issue_identifier: string;
  source_record_id: string | null;
  values: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TPersonalWorkbenchCalendarItem = {
  id: string;
  issue_id: string;
  title: string;
  table_key: string;
  table_name: string;
  start_date: string;
  end_date: string;
};

export type TPersonalWorkbenchAISuggestion = {
  table_key: string;
  reason: string;
  confidence: number;
  values: Record<string, unknown>;
  source_text: string;
  mode: "ai" | "local";
  notice: string;
};
