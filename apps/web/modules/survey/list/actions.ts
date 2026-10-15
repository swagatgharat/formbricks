"use server";

import { z } from "zod";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromWorkspaceId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";
import {
  generateSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParamsList,
} from "@/lib/utils/single-use-surveys";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sanitizeSurveyForExport } from "@/modules/survey/lib/export-survey";
import { getSurvey } from "@/modules/survey/lib/survey";
import { copySurveyToOtherWorkspace, importSurvey } from "@/modules/survey/list/lib/survey";

const ZCopySurveyToOtherWorkspaceAction = z.object({
  surveyId: z.cuid2(),
  targetWorkspaceId: z.cuid2(),
});

export const copySurveyToOtherWorkspaceAction = authenticatedActionClient
  .inputSchema(ZCopySurveyToOtherWorkspaceAction)
  .action(
    withAuditLogging("copiedToOtherWorkspace", "survey", async ({ ctx, parsedInput }) => {
      const sourceWorkspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

      const sourceOrganizationId = await getOrganizationIdFromWorkspaceId(sourceWorkspaceId);
      const targetOrganizationId = await getOrganizationIdFromWorkspaceId(parsedInput.targetWorkspaceId);

      if (sourceOrganizationId !== targetOrganizationId) {
        throw new OperationNotAllowedError("Source and target workspaces must be in the same organization");
      }

      // authorization check for source workspace
      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: sourceWorkspaceId,
      });

      // authorization check for target workspace
      await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
        type: "workspace",
        id: parsedInput.targetWorkspaceId,
      });
      await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.targetWorkspaceId);

      ctx.auditLoggingCtx.organizationId = sourceOrganizationId;
      ctx.auditLoggingCtx.surveyId = parsedInput.surveyId;
      const result = await copySurveyToOtherWorkspace(
        sourceWorkspaceId,
        parsedInput.surveyId,
        parsedInput.targetWorkspaceId,
        ctx.user.id
      );
      ctx.auditLoggingCtx.newObject = result;
      return result;
    })
  );

const ZGenerateSingleUseIdAction = z
  .object({
    surveyId: z.cuid2(),
    isEncrypted: z.boolean(),
    count: z.number().min(1).max(5000).prefault(1),
    singleUseId: z.string().trim().min(1).max(255).optional(),
  })
  .refine((data) => !data.singleUseId || (!data.isEncrypted && data.count === 1), {
    message: "Custom single-use IDs can only be generated one at a time without encryption",
  });

export const generateSingleUseIdsAction = authenticatedActionClient
  .inputSchema(ZGenerateSingleUseIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: await getWorkspaceIdFromSurveyId(parsedInput.surveyId),
    });

    if (parsedInput.singleUseId) {
      return [generateSurveySingleUseLinkParams(parsedInput.surveyId, false, parsedInput.singleUseId)];
    }

    return generateSurveySingleUseLinkParamsList(
      parsedInput.count,
      parsedInput.surveyId,
      parsedInput.isEncrypted
    );
  });

const ZGetSurveyForExportAction = z.object({
  surveyId: z.cuid2(),
});

export const getSurveyForExportAction = authenticatedActionClient
  .inputSchema(ZGetSurveyForExportAction)
  .action(async ({ ctx, parsedInput }) => {
    const workspaceId = await getWorkspaceIdFromSurveyId(parsedInput.surveyId);

    await assertCan({ type: "user", id: ctx.user.id }, "workspace.read", {
      type: "workspace",
      id: workspaceId,
    });

    const survey = await getSurvey(parsedInput.surveyId);
    if (!survey) {
      throw new ResourceNotFoundError("Survey", parsedInput.surveyId);
    }

    return sanitizeSurveyForExport(survey);
  });

const ZImportSurveyAction = z.object({
  workspaceId: z.cuid2(),
  survey: z.record(z.string(), z.unknown()),
});

export const importSurveyAction = authenticatedActionClient.inputSchema(ZImportSurveyAction).action(
  withAuditLogging("created", "survey", async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });

    await applyRateLimit(rateLimitConfigs.actions.stateMutation, parsedInput.workspaceId);

    const organizationId = await getOrganizationIdFromWorkspaceId(parsedInput.workspaceId);
    ctx.auditLoggingCtx.organizationId = organizationId;

    const result = await importSurvey(parsedInput.workspaceId, parsedInput.survey, ctx.user.id);
    ctx.auditLoggingCtx.surveyId = result.id;
    ctx.auditLoggingCtx.newObject = result;

    return result;
  })
);
