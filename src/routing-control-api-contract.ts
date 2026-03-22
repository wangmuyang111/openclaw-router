import type {
  RuntimeRoutingDTO,
  SessionDetailDTO,
  SessionSummaryDTO,
} from "./routing-state-dto.js";

export type ControlApiErrorCode = "invalid_argument" | "not_found";

export type ControlApiError = {
  code: ControlApiErrorCode;
  message: string;
};

export type ControlApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ControlApiFailure = {
  ok: false;
  error: ControlApiError;
};

export type ControlApiResult<T> = ControlApiSuccess<T> | ControlApiFailure;

export type GetRuntimeResponse = ControlApiResult<RuntimeRoutingDTO>;

export type ListSessionsResponse = ControlApiResult<{
  items: SessionSummaryDTO[];
}>;

export type GetSessionRequest = {
  sessionKey?: string | null;
};

export type GetSessionResponse = ControlApiResult<SessionDetailDTO>;
