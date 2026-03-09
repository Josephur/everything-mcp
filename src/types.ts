export interface EverythingResult {
  type: "file" | "folder";
  name: string;
  path: string;
  size?: string;
  date_modified?: string;
}

export interface EverythingResponse {
  totalResults: number;
  results: EverythingResult[];
}

export interface SearchParams {
  query: string;
  count: number;
  offset: number;
  sort: string;
  ascending: boolean;
  regex: boolean;
  case_sensitive: boolean;
  whole_word: boolean;
  match_path: boolean;
  global: boolean;
  project_path: string;
}
