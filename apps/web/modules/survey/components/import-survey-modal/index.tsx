"use client";

import { AlertCircleIcon, FileTextIcon, HelpCircleIcon, LayersIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  TSurveyImportValidationResult,
  validateSurveyImportPayload,
} from "@/modules/survey/lib/export-survey";
import { importSurveyAction } from "@/modules/survey/list/actions";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { FileDropZone } from "@/modules/ui/components/file-drop-zone";

interface ImportSurveyModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspaceId: string;
}

export const ImportSurveyModal = ({ open, setOpen, workspaceId }: Readonly<ImportSurveyModalProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [validationResult, setValidationResult] = useState<TSurveyImportValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const resetState = () => {
    setFile(null);
    setRawJson(null);
    setValidationResult(null);
    setError(null);
    setIsImporting(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    setOpen(newOpen);
  };

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);

    try {
      const fileText = await selectedFile.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(fileText);
      } catch {
        setError(t("workspace.surveys.import_survey_invalid_json"));
        setRawJson(null);
        setValidationResult(null);
        return;
      }

      const result = validateSurveyImportPayload(parsed);
      if (!result.valid) {
        setError(result.error ?? t("workspace.surveys.import_survey_validation_failed"));
        setRawJson(null);
        setValidationResult(null);
        return;
      }

      setValidationResult(result);
      setRawJson(parsed as Record<string, unknown>);
    } catch {
      setError(t("workspace.surveys.import_survey_invalid_json"));
      setRawJson(null);
      setValidationResult(null);
    }
  };

  const handleImport = async () => {
    if (!rawJson) return;

    setIsImporting(true);
    try {
      const response = await importSurveyAction({
        workspaceId,
        survey: rawJson,
      });

      if (response?.data?.id) {
        toast.success(t("workspace.surveys.import_survey_success"));
        setOpen(false);
        router.push(`/workspaces/${workspaceId}/surveys/${response.data.id}/edit`);
      } else {
        const errorMsg = getFormattedErrorMessage(response) || t("workspace.surveys.import_survey_error");
        toast.error(errorMsg);
        setIsImporting(false);
      }
    } catch {
      toast.error(t("workspace.surveys.import_survey_error"));
      setIsImporting(false);
    }
  };

  const summary = validationResult?.summary;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent width="default" className="max-w-lg">
        <DialogHeader>
          <UploadIcon />
          <DialogTitle>{t("workspace.surveys.import_survey")}</DialogTitle>
          <DialogDescription>{t("workspace.surveys.import_survey_description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 py-2">
          {error && (
            <Alert variant="error">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>{t("common.error")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!summary ? (
            <FileDropZone
              id="survey-json-import"
              accept=".json,application/json"
              onFileSelect={handleFileSelect}
              primaryText={t("workspace.surveys.import_survey_drop_primary")}
              secondaryText={t("workspace.surveys.import_survey_drop_secondary")}
              helpText={t("workspace.surveys.import_survey_drop_help")}
              disabled={isImporting}
            />
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileTextIcon className="size-5 shrink-0 text-slate-500" />
                  <div className="truncate">
                    <p className="truncate font-semibold text-slate-800">{summary.name}</p>
                    {file && <p className="truncate text-xs text-slate-500">{file.name}</p>}
                  </div>
                </div>
                <Badge
                  type="gray"
                  size="normal"
                  text={summary.type === "app" ? "In-App Survey" : "Link Survey"}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-200/80 pt-2 text-xs text-slate-600 sm:grid-cols-3">
                <div className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-white p-2">
                  <HelpCircleIcon className="size-4 text-slate-400" />
                  <span>
                    <strong className="text-slate-800">{summary.elementsCount}</strong>{" "}
                    {t("workspace.surveys.import_survey_preview_questions")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-white p-2">
                  <LayersIcon className="size-4 text-slate-400" />
                  <span>
                    <strong className="text-slate-800">{summary.endingsCount}</strong>{" "}
                    {t("workspace.surveys.import_survey_preview_endings")}
                  </span>
                </div>
                {summary.languagesCount > 0 && (
                  <div className="col-span-2 flex items-center gap-1.5 rounded-md border border-slate-100 bg-white p-2 sm:col-span-1">
                    <span className="font-semibold text-slate-400">🌐</span>
                    <span>
                      <strong className="text-slate-800">{summary.languagesCount}</strong>{" "}
                      {t("workspace.surveys.import_survey_preview_languages")}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={resetState}
                  disabled={isImporting}
                  className="text-xs font-medium text-slate-600 underline transition-colors hover:text-slate-900">
                  {t("workspace.surveys.import_survey_change_file")}
                </button>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isImporting}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            loading={isImporting}
            disabled={!summary || isImporting}>
            {t("workspace.surveys.import_survey_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
