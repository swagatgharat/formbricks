"use client";

import { UploadIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface ImportSurveyTemplateProps {
  onImportClick: () => void;
}

export const ImportSurveyTemplate = ({ onImportClick }: Readonly<ImportSurveyTemplateProps>) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onImportClick}
      className={cn(
        "group relative flex flex-col rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-6 text-left transition-colors duration-150 hover:border-brand-dark"
      )}>
      <UploadIcon className="size-8 text-brand-dark transition-all duration-150 group-hover:scale-110" />
      <h3 className="text-md mt-3 mb-1 font-bold text-slate-700">{t("workspace.surveys.import_survey")}</h3>
      <p className="text-xs text-slate-600">{t("workspace.surveys.import_survey_card_description")}</p>
    </button>
  );
};
