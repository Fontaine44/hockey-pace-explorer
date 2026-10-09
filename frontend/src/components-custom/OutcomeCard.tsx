import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

import { PanelCard } from "@/components-custom/PanelCard";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OutcomeCardProps {
  title: string;
  question: string;
  explanation: string;
  children?: ReactNode;
}

export function OutcomeCard({
  title,
  question,
  explanation,
  children,
}: OutcomeCardProps) {
  return (
    <PanelCard
      title={title}
      fill
      className="min-w-0"
      headerClassName="pb-2"
      actions={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 cursor-help text-muted-foreground"
              aria-label={`About ${title.toLowerCase()}`}
            >
              <CircleHelp aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs bg-zinc-800 text-sm leading-relaxed text-white">
            <p className="whitespace-pre-line">{explanation}</p>
          </TooltipContent>
        </Tooltip>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <p className="shrink-0 text-sm italic">{question}</p>
        <div className="min-h-16 flex-1">
          {children ?? (
            <div className="flex h-full items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground">
              Plot coming soon
            </div>
          )}
        </div>
      </div>
    </PanelCard>
  );
}
