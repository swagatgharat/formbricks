import { TSurvey } from "@formbricks/types/surveys/types";

export interface TSanitizedSurveyForExport extends Omit<
  Record<string, unknown>,
  | "id"
  | "workspaceId"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "archivedAt"
  | "embeddedFields"
  | "responseCount"
  | "completedResponseCount"
> {
  name: string;
  status: "draft";
}

/**
 * Sanitizes a survey object for export by stripping environment-specific,
 * ephemeral, and database-generated identifiers while preserving questions,
 * blocks, logic, styling, variables, and endings.
 */
export const sanitizeSurveyForExport = (
  survey: Partial<TSurvey> & { name?: string; [key: string]: unknown }
): TSanitizedSurveyForExport => {
  const {
    id: _id,
    workspaceId: _workspaceId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    createdBy: _createdBy,
    archivedAt: _archivedAt,
    embeddedFields: _embeddedFields,
    responseCount: _responseCount,
    completedResponseCount: _completedResponseCount,
    ...rest
  } = survey;

  // Clean actionClass inside triggers if present (remove DB identifiers from actionClasses)
  const cleanedTriggers = Array.isArray(rest.triggers)
    ? rest.triggers.map((trigger) => {
        if (
          trigger &&
          "actionClass" in trigger &&
          trigger.actionClass &&
          typeof trigger.actionClass === "object"
        ) {
          const {
            id: _acId,
            workspaceId: _acWsId,
            createdAt: _acCreatedAt,
            updatedAt: _acUpdatedAt,
            ...actionClassRest
          } = trigger.actionClass as Record<string, unknown>;

          return {
            ...trigger,
            actionClass: actionClassRest,
          };
        }
        return trigger;
      })
    : rest.triggers;

  // Clean languages if present (remove DB identifiers)
  const cleanedLanguages = Array.isArray(rest.languages)
    ? rest.languages.map((lang) => {
        if (lang && "language" in lang && lang.language && typeof lang.language === "object") {
          const {
            id: _langId,
            workspaceId: _langWsId,
            createdAt: _langCreatedAt,
            updatedAt: _langUpdatedAt,
            ...languageRest
          } = lang.language as Record<string, unknown>;

          return {
            ...lang,
            language: languageRest,
          };
        }
        return lang;
      })
    : rest.languages;

  return {
    ...rest,
    triggers: cleanedTriggers,
    languages: cleanedLanguages,
    name: survey.name ?? "Exported Survey",
    status: "draft",
  };
};

/**
 * Generates a clean, kebab-cased filename from the survey name.
 */
export const generateSurveyExportFilename = (surveyName?: string): string => {
  const sanitized = (surveyName ?? "survey")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${sanitized || "survey"}-survey.json`;
};

/**
 * Triggers a client-side file download of the sanitized survey JSON.
 */
export const downloadSurveyJson = (data: unknown, filename: string): void => {
  if (typeof window === "undefined") return;

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

/**
 * High-level export helper: sanitizes survey and triggers browser download.
 */
export const exportSurveyAsJson = (
  survey: Partial<TSurvey> & { name?: string; [key: string]: unknown }
): void => {
  const sanitized = sanitizeSurveyForExport(survey);
  const filename = generateSurveyExportFilename(sanitized.name);
  downloadSurveyJson(sanitized, filename);
};

export interface TSurveyImportValidationResult {
  valid: boolean;
  error?: string;
  summary?: {
    name: string;
    type: string;
    elementsCount: number;
    endingsCount: number;
    languagesCount: number;
  };
}

/**
 * Validates an uploaded survey JSON payload and returns preview metadata.
 */
export const validateSurveyImportPayload = (data: unknown): TSurveyImportValidationResult => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      valid: false,
      error: "The uploaded file is not a valid JSON object.",
    };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== "string" || !obj.name.trim()) {
    return {
      valid: false,
      error: "Survey name is missing or invalid in the uploaded JSON.",
    };
  }

  const hasBlocks = Array.isArray(obj.blocks) && obj.blocks.length > 0;
  const hasQuestions = Array.isArray(obj.questions) && obj.questions.length > 0;

  if (!hasBlocks && !hasQuestions) {
    return {
      valid: false,
      error: "Survey must contain at least one question or block.",
    };
  }

  let elementsCount = 0;
  if (hasBlocks) {
    elementsCount = (obj.blocks as Record<string, unknown>[]).reduce((acc, b) => {
      if (b && typeof b === "object" && Array.isArray(b.elements)) {
        return acc + b.elements.length;
      }
      return acc + 1;
    }, 0);
  } else if (hasQuestions) {
    elementsCount = (obj.questions as unknown[]).length;
  }

  const endingsCount = Array.isArray(obj.endings) ? obj.endings.length : 0;
  const languagesCount = Array.isArray(obj.languages) ? obj.languages.length : 0;
  const type = typeof obj.type === "string" ? obj.type : "link";

  return {
    valid: true,
    summary: {
      name: obj.name.trim(),
      type,
      elementsCount,
      endingsCount,
      languagesCount,
    },
  };
};
