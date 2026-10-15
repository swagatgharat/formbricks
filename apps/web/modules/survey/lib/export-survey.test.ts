import { describe, expect, test } from "vitest";
import {
  generateSurveyExportFilename,
  sanitizeSurveyForExport,
  validateSurveyImportPayload,
} from "./export-survey";

describe("export-survey utility", () => {
  describe("generateSurveyExportFilename", () => {
    test("should generate a clean filename from a normal survey name", () => {
      expect(generateSurveyExportFilename("Customer Onboarding Survey")).toBe(
        "customer-onboarding-survey-survey.json"
      );
    });

    test("should handle special characters and extra spaces", () => {
      expect(generateSurveyExportFilename("  Product CSAT 2024! (v2.0)  ")).toBe(
        "product-csat-2024-v2-0-survey.json"
      );
    });

    test("should fallback gracefully if name is empty", () => {
      expect(generateSurveyExportFilename("")).toBe("survey-survey.json");
      expect(generateSurveyExportFilename(undefined)).toBe("survey-survey.json");
    });
  });

  describe("sanitizeSurveyForExport", () => {
    test("should strip DB identifiers and timestamps while preserving survey content", () => {
      const mockSurvey: Record<string, unknown> = {
        id: "survey_cuid_123",
        workspaceId: "workspace_cuid_456",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        createdBy: "user_cuid_789",
        archivedAt: null,
        embeddedFields: [{ id: "emb_1" }],
        responseCount: 42,
        completedResponseCount: 30,
        name: "Feature Feedback Survey",
        type: "link",
        status: "inProgress",
        welcomeCard: {
          enabled: true,
          headline: { default: "Welcome" },
        },
        blocks: [
          {
            id: "block_1",
            elements: [
              {
                id: "q_1",
                type: "openText",
                headline: { default: "What do you think?" },
              },
            ],
          },
        ],
        endings: [
          {
            id: "ending_1",
            type: "endScreen",
            headline: { default: "Thank you!" },
          },
        ],
        variables: [{ id: "var_1", name: "userId", type: "text" }],
      };

      const sanitized = sanitizeSurveyForExport(mockSurvey) as Record<string, unknown>;

      // Verify stripped fields
      expect(sanitized.id).toBeUndefined();
      expect(sanitized.workspaceId).toBeUndefined();
      expect(sanitized.createdAt).toBeUndefined();
      expect(sanitized.updatedAt).toBeUndefined();
      expect(sanitized.createdBy).toBeUndefined();
      expect(sanitized.archivedAt).toBeUndefined();
      expect(sanitized.embeddedFields).toBeUndefined();
      expect(sanitized.responseCount).toBeUndefined();
      expect(sanitized.completedResponseCount).toBeUndefined();

      // Verify status reset to draft
      expect(sanitized.status).toBe("draft");

      // Verify preserved survey content
      expect(sanitized.name).toBe("Feature Feedback Survey");
      expect(sanitized.type).toBe("link");
      expect(sanitized.welcomeCard).toEqual(mockSurvey.welcomeCard);
      expect(sanitized.blocks).toEqual(mockSurvey.blocks);
      expect(sanitized.endings).toEqual(mockSurvey.endings);
      expect(sanitized.variables).toEqual(mockSurvey.variables);
    });

    test("should sanitize trigger actionClasses and languages", () => {
      const mockSurveyWithTriggers: Record<string, unknown> = {
        name: "Trigger Survey",
        triggers: [
          {
            actionClass: {
              id: "ac_123",
              workspaceId: "ws_456",
              createdAt: new Date(),
              updatedAt: new Date(),
              name: "Page Visit",
              type: "code",
              key: "visit_checkout",
            },
          },
        ],
        languages: [
          {
            default: true,
            enabled: true,
            language: {
              id: "lang_1",
              workspaceId: "ws_456",
              createdAt: new Date(),
              updatedAt: new Date(),
              code: "en",
              alias: "English",
            },
          },
        ],
      };

      const sanitized = sanitizeSurveyForExport(mockSurveyWithTriggers);

      const triggers = sanitized.triggers as Array<{
        actionClass: Record<string, unknown>;
      }>;
      const trigger = triggers[0];
      expect(trigger.actionClass.id).toBeUndefined();
      expect(trigger.actionClass.workspaceId).toBeUndefined();
      expect(trigger.actionClass.name).toBe("Page Visit");
      expect(trigger.actionClass.key).toBe("visit_checkout");

      const languages = sanitized.languages as Array<{
        language: Record<string, unknown>;
      }>;
      const lang = languages[0];
      expect(lang.language.id).toBeUndefined();
      expect(lang.language.workspaceId).toBeUndefined();
      expect(lang.language.code).toBe("en");
      expect(lang.language.alias).toBe("English");
    });
  });

  describe("validateSurveyImportPayload", () => {
    test("should reject non-object payloads", () => {
      expect(validateSurveyImportPayload(null).valid).toBe(false);
      expect(validateSurveyImportPayload("string").valid).toBe(false);
      expect(validateSurveyImportPayload([]).valid).toBe(false);
    });

    test("should reject payloads without a valid name", () => {
      const result = validateSurveyImportPayload({
        blocks: [{ id: "b1", elements: [{ id: "q1" }] }],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Survey name is missing");
    });

    test("should reject payloads without questions or blocks", () => {
      const result = validateSurveyImportPayload({ name: "Empty Survey", blocks: [], questions: [] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least one question or block");
    });

    test("should accept valid payload with blocks and return summary", () => {
      const result = validateSurveyImportPayload({
        name: "Valid Block Survey",
        type: "app",
        blocks: [
          {
            id: "b1",
            elements: [{ id: "e1" }, { id: "e2" }],
          },
        ],
        endings: [{ id: "end1" }],
        languages: [{ default: true }],
      });

      expect(result.valid).toBe(true);
      expect(result.summary).toEqual({
        name: "Valid Block Survey",
        type: "app",
        elementsCount: 2,
        endingsCount: 1,
        languagesCount: 1,
      });
    });

    test("should accept valid payload with questions and return summary", () => {
      const result = validateSurveyImportPayload({
        name: "Valid Question Survey",
        type: "link",
        questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }],
      });

      expect(result.valid).toBe(true);
      expect(result.summary).toEqual({
        name: "Valid Question Survey",
        type: "link",
        elementsCount: 3,
        endingsCount: 0,
        languagesCount: 0,
      });
    });

    test("should reject whitespace-only survey names", () => {
      const result = validateSurveyImportPayload({
        name: "   \t\n  ",
        questions: [{ id: "q1" }],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Survey name is missing");
    });
  });

  describe("Roundtrip Export -> Import Payload Simulation", () => {
    test("should accurately preserve complex survey questions, conditional branching logic, styling, and variables through export and validation", () => {
      const complexSurvey: Record<string, unknown> = {
        id: "surv_prod_xyz",
        workspaceId: "ws_live_999",
        name: "Quarterly NPS & Feature Branching Survey",
        type: "link",
        status: "inProgress",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-06-01"),
        createdBy: "usr_admin_1",
        welcomeCard: {
          enabled: true,
          headline: { default: "Welcome to our quarterly check-in" },
          buttonLabel: { default: "Start Feedback" },
        },
        blocks: [
          {
            id: "block_nps",
            elements: [
              {
                id: "q_nps",
                type: "nps",
                headline: { default: "How likely are you to recommend us?" },
                logic: [
                  {
                    condition: "lessThan",
                    value: 7,
                    destination: "q_detractor_reason",
                  },
                  {
                    condition: "greaterEqual",
                    value: 9,
                    destination: "q_promoter_praise",
                  },
                ],
              },
            ],
          },
          {
            id: "block_follow_up",
            elements: [
              {
                id: "q_detractor_reason",
                type: "openText",
                headline: { default: "What could we do better?" },
              },
              {
                id: "q_promoter_praise",
                type: "openText",
                headline: { default: "What do you love most?" },
              },
            ],
          },
        ],
        endings: [
          {
            id: "end_thank_you",
            type: "endScreen",
            headline: { default: "Thank you for your valuable feedback!" },
          },
        ],
        variables: [
          { id: "var_tier", name: "planTier", type: "text" },
          { id: "var_score", name: "npsScore", type: "number" },
        ],
        hiddenFields: {
          fieldIds: ["utm_source", "user_id"],
        },
        styling: {
          brandColor: { light: "#00E699" },
          highlightBorderColor: { light: "#00C482" },
        },
        triggers: [
          {
            actionClass: {
              id: "ac_event_checkout",
              workspaceId: "ws_live_999",
              name: "Completed Checkout",
              type: "code",
              key: "completed_checkout",
            },
          },
        ],
      };

      // 1. Export Sanitization
      const exportedJson = sanitizeSurveyForExport(complexSurvey);
      const exportedRecord = exportedJson as Record<string, unknown>;

      // Verify that database identifiers are eliminated
      expect(exportedRecord.id).toBeUndefined();
      expect(exportedRecord.workspaceId).toBeUndefined();
      expect(exportedRecord.createdAt).toBeUndefined();
      expect(exportedRecord.updatedAt).toBeUndefined();
      expect(exportedRecord.createdBy).toBeUndefined();

      // Verify trigger actionClass is sanitized
      const triggers = exportedJson.triggers as Array<{
        actionClass: Record<string, unknown>;
      }>;
      expect(triggers[0].actionClass.id).toBeUndefined();
      expect(triggers[0].actionClass.workspaceId).toBeUndefined();
      expect(triggers[0].actionClass.name).toBe("Completed Checkout");

      // Verify status is draft
      expect(exportedJson.status).toBe("draft");

      // 2. Validate payload for Import
      const validation = validateSurveyImportPayload(exportedJson);
      expect(validation.valid).toBe(true);
      expect(validation.summary?.name).toBe("Quarterly NPS & Feature Branching Survey");
      expect(validation.summary?.elementsCount).toBe(3);
      expect(validation.summary?.endingsCount).toBe(1);

      // 3. Verify logic rules, variables, and styling were completely preserved
      const exportedBlocks = exportedJson.blocks as Array<{
        elements: Array<{
          logic?: Array<{
            condition: string;
            value: number;
            destination: string;
          }>;
        }>;
      }>;
      const npsElement = exportedBlocks[0].elements[0];
      expect(npsElement.logic).toHaveLength(2);
      expect(npsElement.logic?.[0]).toEqual({
        condition: "lessThan",
        value: 7,
        destination: "q_detractor_reason",
      });
      expect(npsElement.logic?.[1]).toEqual({
        condition: "greaterEqual",
        value: 9,
        destination: "q_promoter_praise",
      });

      expect(exportedJson.variables).toEqual([
        { id: "var_tier", name: "planTier", type: "text" },
        { id: "var_score", name: "npsScore", type: "number" },
      ]);

      expect(exportedJson.hiddenFields).toEqual({
        fieldIds: ["utm_source", "user_id"],
      });

      expect(exportedJson.styling).toEqual({
        brandColor: { light: "#00E699" },
        highlightBorderColor: { light: "#00C482" },
      });
    });
  });
});
